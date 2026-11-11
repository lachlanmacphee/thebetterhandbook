package web

import (
	"context"
	"database/sql"
	"encoding/json"
	"io"
	"log/slog"
	"net/http"
	"net/http/cookiejar"
	"net/http/httptest"
	"net/url"
	"path/filepath"
	"strings"
	"testing"

	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
)

type sentMail struct{ to, subject, html string }

type fakeMail struct{ sent []sentMail }

func (f *fakeMail) Send(_ context.Context, to, subject, html string) error {
	f.sent = append(f.sent, sentMail{to, subject, html})
	return nil
}

type testApp struct {
	t      *testing.T
	srv    *Server
	ts     *httptest.Server
	client *http.Client
	conn   *sql.DB
}

func newTestApp(t *testing.T) *testApp {
	t.Helper()
	ctx := context.Background()
	conn, err := db.Open(filepath.Join(t.TempDir(), "test.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	if err := db.Migrate(ctx, conn); err != nil {
		t.Fatal(err)
	}

	log := slog.New(slog.NewTextHandler(io.Discard, nil))
	uni := importer.University{Name: "Test University", Slug: "test-university", HandbookURL: "https://example.edu/units/"}
	units := []importer.Unit{
		{Code: "ABC1001", Name: "Intro to Testing", Level: "1", CreditPoints: 6, FacultyName: "Science",
			Offerings: []importer.Offering{{Location: "Clayton", Period: "Semester 1"}, {Location: "Online", Period: "Semester 2"}}},
		{Code: "ABC2002", Name: "Advanced Testing", Level: "2", CreditPoints: 12, FacultyName: "Science",
			Offerings: []importer.Offering{{Location: "Clayton", Period: "Semester 2"}}},
	}
	if err := importer.Save(ctx, conn, uni, units, log); err != nil {
		t.Fatal(err)
	}
	// Importing twice must be idempotent.
	if err := importer.Save(ctx, conn, uni, units, log); err != nil {
		t.Fatal(err)
	}
	if _, err := conn.Exec(`INSERT INTO users (email, name, role) VALUES ('admin@anu.edu.au', 'Admin', 'ADMIN')`); err != nil {
		t.Fatal(err)
	}

	srv, err := New(Options{DB: conn, Mail: &fakeMail{}, Log: log, SessionSecret: "test", Dev: true})
	if err != nil {
		t.Fatal(err)
	}
	ts := httptest.NewServer(srv.Handler())
	t.Cleanup(ts.Close)
	jar, _ := cookiejar.New(nil)
	client := &http.Client{Jar: jar, CheckRedirect: func(*http.Request, []*http.Request) error { return http.ErrUseLastResponse }}
	return &testApp{t: t, srv: srv, ts: ts, client: client, conn: conn}
}

func (a *testApp) do(method, path string, form url.Values, headers map[string]string) (*http.Response, string) {
	a.t.Helper()
	var body io.Reader
	if form != nil {
		body = strings.NewReader(form.Encode())
	}
	req, err := http.NewRequest(method, a.ts.URL+path, body)
	if err != nil {
		a.t.Fatal(err)
	}
	if form != nil {
		req.Header.Set("Content-Type", "application/x-www-form-urlencoded")
	}
	for k, v := range headers {
		req.Header.Set(k, v)
	}
	res, err := a.client.Do(req)
	if err != nil {
		a.t.Fatal(err)
	}
	defer res.Body.Close()
	b, _ := io.ReadAll(res.Body)
	return res, string(b)
}

func (a *testApp) expect(method, path string, form url.Values, headers map[string]string, status int, contains ...string) (*http.Response, string) {
	a.t.Helper()
	res, body := a.do(method, path, form, headers)
	if res.StatusCode != status {
		a.t.Fatalf("%s %s: status %d, want %d\n%s", method, path, res.StatusCode, status, body)
	}
	for _, c := range contains {
		if !strings.Contains(body, c) {
			a.t.Fatalf("%s %s: body missing %q\n%s", method, path, c, body)
		}
	}
	return res, body
}

func (a *testApp) signIn(email string) {
	a.t.Helper()
	a.expect("POST", "/auth/login", url.Values{"email": {email}}, nil, http.StatusSeeOther)
	code, err := a.srv.codes.Issue(context.Background(), email)
	if err != nil {
		a.t.Fatal(err)
	}
	a.expect("POST", "/auth/verify", url.Values{"code": {"000000x"}}, nil, http.StatusUnprocessableEntity, "incorrect")
	res, _ := a.expect("POST", "/auth/verify", url.Values{"code": {code}}, nil, http.StatusSeeOther)
	if loc := res.Header.Get("Location"); loc != "/" {
		a.t.Fatalf("verify redirected to %q", loc)
	}
}

const unitPath = "/universities/test-university/units/ABC1001"

func TestAnonymousPages(t *testing.T) {
	a := newTestApp(t)
	a.expect("GET", "/", nil, nil, 200, "Test University")
	a.expect("GET", "/about", nil, nil, 200, "About")
	a.expect("GET", "/api/docs", nil, nil, 200, "API Documentation")
	a.expect("GET", "/auth/login", nil, nil, 200, "Sign In")
	a.expect("GET", "/universities/test-university", nil, nil, 200, "ABC1001", "Clayton, Online")
	a.expect("GET", "/universities/test-university/search?name=TESTING&sortBy=rating", nil, nil, 200, "Search Results (2 units)")
	a.expect("GET", "/universities/test-university/search?creditPoints=12", nil, nil, 200, "Search Results (1 units)", "ABC2002")
	a.expect("GET", unitPath, nil, nil, 200, "Intro to Testing", "No reviews yet", "https://example.edu/units/ABC1001")
	a.expect("GET", "/universities/test-university/units/XYZ9999", nil, nil, 404, "Unit Not Found", "sign in")
	a.expect("GET", "/universities/missing", nil, nil, 404)
	a.expect("GET", "/static/css/app.css", nil, nil, 200)
	a.expect("GET", "/favicon.ico", nil, nil, 200)

	// Signed-out users are sent to sign in.
	res, _ := a.expect("GET", "/profile", nil, nil, http.StatusSeeOther)
	if res.Header.Get("Location") != "/auth/login" {
		t.Fatalf("profile redirect = %q", res.Header.Get("Location"))
	}
	a.expect("POST", "/auth/login", url.Values{"email": {"someone@gmail.com"}}, nil, http.StatusUnprocessableEntity, "student email")
}

func TestLegacyRedirects(t *testing.T) {
	a := newTestApp(t)
	for from, to := range map[string]string{
		"/1":                 "/universities/test-university",
		"/1/search?code=ABC": "/universities/test-university/search?code=ABC",
		"/1/units/ABC1001":   unitPath,
		"/universities/test-university/units/abc1001": unitPath,
	} {
		res, _ := a.expect("GET", from, nil, nil, http.StatusMovedPermanently)
		if got := res.Header.Get("Location"); got != to {
			t.Errorf("%s redirected to %q, want %q", from, got, to)
		}
	}
	a.expect("GET", "/2/units/ABC1001", nil, nil, 404)
}

func TestSignedInFlow(t *testing.T) {
	a := newTestApp(t)
	a.signIn("admin@anu.edu.au")
	hx := map[string]string{"HX-Request": "true"}

	a.expect("GET", "/profile", nil, nil, 200, "No reviews yet")
	a.expect("GET", "/admin", nil, nil, 200, "No pending requests")
	a.expect("GET", unitPath+"/review", nil, nil, 200, "Create Review")

	// Validation errors re-render the form with 422.
	a.expect("POST", unitPath+"/review", url.Values{"title": {"Hi"}}, nil, http.StatusUnprocessableEntity, "Description is required")

	review := url.Values{
		"title": {"Great unit"}, "description": {"Loved it"}, "yearCompleted": {"2024"},
		"overallRating": {"5"}, "teachingRating": {"4"}, "contentRating": {"5"},
		"difficultyRating": {"2"}, "workloadRating": {"3"}, "isWamBooster": {"on"},
	}
	a.expect("POST", unitPath+"/review", review, nil, http.StatusSeeOther)
	a.expect("GET", unitPath, nil, nil, 200, "Great unit", "WAM Booster", "4.0 / 5", "Easy", "Moderate", "Thanks for your review!")

	// The same URL now edits the existing review.
	a.expect("GET", unitPath+"/review", nil, nil, 200, "Edit Review", "Great unit")
	review.Set("title", "Still great")
	a.expect("POST", unitPath+"/review", review, nil, http.StatusSeeOther)
	a.expect("GET", "/profile", nil, nil, 200, "Still great")

	var reviewID string
	a.conn.QueryRow(`SELECT id FROM reviews`).Scan(&reviewID)

	// Reactions toggle and return just the fragment for htmx.
	_, body := a.expect("POST", "/reviews/"+reviewID+"/reaction", url.Values{"reaction": {"like"}}, hx, 200, `class="reactions"`)
	if strings.Contains(body, "<html") {
		t.Fatal("reaction returned a full page")
	}
	_, body = a.expect("POST", "/reviews/"+reviewID+"/reaction", url.Values{"reaction": {"like"}}, hx, 200)
	if !strings.Contains(body, `aria-pressed="false"`) || strings.Contains(body, `aria-pressed="true"`) {
		t.Fatalf("second like should clear the reaction:\n%s", body)
	}

	// Dialog forms answer with triggers.
	res, _ := a.expect("POST", unitPath+"/suggestions", url.Values{"field": {"name"}, "reason": {"Renamed"}}, hx, http.StatusNoContent)
	if !strings.Contains(res.Header.Get("HX-Trigger"), "close-dialog") {
		t.Fatalf("HX-Trigger = %q", res.Header.Get("HX-Trigger"))
	}
	a.expect("POST", unitPath+"/deprecations", url.Values{"reason": {""}}, hx, http.StatusUnprocessableEntity)
	a.expect("POST", unitPath+"/deprecations", url.Values{"reason": {"Discontinued"}}, hx, http.StatusNoContent)
	a.expect("POST", "/universities/test-university/units/NEW1000/addition-request", url.Values{}, nil, http.StatusSeeOther)
	a.expect("GET", "/universities/test-university/units/NEW1000", nil, nil, 404, "pending request")

	// Admin decisions.
	a.expect("GET", "/admin", nil, nil, 200, "Deprecation Request", "Change Suggestion", "Unit Addition Request", "NEW1000")
	var depID string
	a.conn.QueryRow(`SELECT id FROM unit_deprecations`).Scan(&depID)
	a.expect("POST", "/admin/deprecations/"+depID, url.Values{"action": {"APPROVED"}}, hx, 200)
	a.expect("POST", "/admin/deprecations/"+depID, url.Values{"action": {"APPROVED"}}, hx, 200) // already handled
	a.expect("GET", unitPath, nil, nil, 200, "Deprecated")

	// API key + JSON API.
	a.expect("POST", "/profile/api-key", url.Values{}, hx, 200, "Regenerate")
	var key string
	a.conn.QueryRow(`SELECT api_key FROM users`).Scan(&key)
	auth := map[string]string{"Authorization": "Bearer " + key}

	_, body = a.expect("GET", "/api/units?university=test-university&sortBy=rating", nil, auth, 200)
	var units struct {
		Units []struct {
			Code     string
			Campuses []struct{ Name string }
			Reviews  []struct {
				Title        string
				IsWamBooster bool
			}
			Ratings struct {
				ReviewCount int
				Overall     float64
			}
			University struct{ Slug string }
		}
		Pagination struct{ TotalCount, TotalPages int }
	}
	if err := json.Unmarshal([]byte(body), &units); err != nil {
		t.Fatalf("units JSON: %v\n%s", err, body)
	}
	if units.Pagination.TotalCount != 2 || len(units.Units) != 2 || units.Units[0].Code != "ABC1001" {
		t.Fatalf("unexpected units response: %s", body)
	}
	u := units.Units[0]
	if len(u.Campuses) != 2 || len(u.Reviews) != 1 || !u.Reviews[0].IsWamBooster || u.Ratings.Overall != 5 || u.University.Slug != "test-university" {
		t.Fatalf("unexpected unit: %+v", u)
	}

	_, body = a.expect("GET", "/api/universities", nil, auth, 200)
	var unis struct {
		Universities []struct {
			Slug   string
			Counts struct{ Units, Reviews int }
		}
	}
	if err := json.Unmarshal([]byte(body), &unis); err != nil {
		t.Fatalf("universities JSON: %v\n%s", err, body)
	}
	if len(unis.Universities) != 1 || unis.Universities[0].Counts.Units != 2 || unis.Universities[0].Counts.Reviews != 1 {
		t.Fatalf("unexpected universities response: %s", body)
	}

	a.expect("GET", "/api/units", nil, nil, http.StatusUnauthorized, "API key required")
	a.expect("GET", "/api/units", nil, map[string]string{"Authorization": "Bearer wrong"}, http.StatusForbidden)

	// Signing out ends the session.
	a.expect("POST", "/auth/logout", url.Values{}, nil, http.StatusSeeOther)
	a.expect("GET", "/profile", nil, nil, http.StatusSeeOther)
}

func TestCrossOriginPostsRejected(t *testing.T) {
	a := newTestApp(t)
	a.expect("POST", "/auth/logout", url.Values{}, map[string]string{"Sec-Fetch-Site": "cross-site"}, http.StatusForbidden)
}

func TestPaginate(t *testing.T) {
	u, _ := url.Parse("/x?code=A&page=7")
	links := paginate(u, 7, 10)
	var labels []string
	for _, l := range links {
		label := l.Label
		if l.Current {
			label = "[" + label + "]"
		}
		labels = append(labels, label)
	}
	if got := strings.Join(labels, " "); got != "« ‹ 5 6 [7] 8 9 › »" {
		t.Fatalf("got %q", got)
	}
	if paginate(u, 1, 1) != nil {
		t.Fatal("single page should have no links")
	}
}
