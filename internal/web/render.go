package web

import (
	"bytes"
	"crypto/sha256"
	"embed"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"html/template"
	"io/fs"
	"math"
	"net/http"
	"path"
	"reflect"
	"strings"
	"time"
)

var (
	//go:embed templates
	templateFS embed.FS
	//go:embed static
	staticFS embed.FS
)

// data is the value passed to templates. render adds the common keys
// User, Toasts and Path.
type data map[string]any

type toast struct {
	Kind    string `json:"kind"` // success | error
	Message string `json:"message"`
}

type renderer struct {
	pages  map[string]*template.Template
	static fs.FS
	hashes map[string]string // static path -> short content hash
}

func newRenderer() (*renderer, error) {
	static, err := fs.Sub(staticFS, "static")
	if err != nil {
		return nil, err
	}
	r := &renderer{pages: map[string]*template.Template{}, static: static, hashes: map[string]string{}}

	err = fs.WalkDir(static, ".", func(p string, d fs.DirEntry, err error) error {
		if err != nil || d.IsDir() {
			return err
		}
		b, err := fs.ReadFile(static, p)
		if err != nil {
			return err
		}
		sum := sha256.Sum256(b)
		r.hashes[p] = hex.EncodeToString(sum[:4])
		return nil
	})
	if err != nil {
		return nil, err
	}

	base, err := template.New("").Funcs(r.funcs()).ParseFS(templateFS, "templates/layout.html", "templates/partials/*.html")
	if err != nil {
		return nil, err
	}
	pages, err := fs.Glob(templateFS, "templates/pages/*.html")
	if err != nil {
		return nil, err
	}
	for _, p := range pages {
		t, err := template.Must(base.Clone()).ParseFS(templateFS, p)
		if err != nil {
			return nil, err
		}
		r.pages[strings.TrimSuffix(path.Base(p), ".html")] = t
	}
	return r, nil
}

func (r *renderer) funcs() template.FuncMap {
	return template.FuncMap{
		// asset returns a cache-busted URL for a file in static/.
		"asset": func(p string) string {
			return "/static/" + p + "?v=" + r.hashes[p]
		},
		"date": func(s string) string {
			t, err := time.Parse(time.RFC3339Nano, s)
			if err != nil {
				return s
			}
			return t.Format("2 Jan 2006")
		},
		// stars returns 5 booleans: whether each star is filled.
		"stars": func(rating float64) []bool {
			filled := int(math.Round(rating))
			out := make([]bool, 5)
			for i := range out {
				out[i] = i < filled
			}
			return out
		},
		"seq": func(from, to int64) []int64 {
			var out []int64
			for i := from; i <= to; i++ {
				out = append(out, i)
			}
			return out
		},
		"ratingLabel": ratingLabel,
		"scaleLabel":  scaleLabel,
		"add":         func(a, b int) int { return a + b },
		"sub":         func(a, b int) int { return a - b },
		"year":        func() int { return time.Now().Year() },
		// dict builds a map for passing several values to a sub-template.
		"dict": func(kv ...any) (map[string]any, error) {
			if len(kv)%2 != 0 {
				return nil, fmt.Errorf("dict: odd number of arguments")
			}
			m := make(map[string]any, len(kv)/2)
			for i := 0; i < len(kv); i += 2 {
				k, ok := kv[i].(string)
				if !ok {
					return nil, fmt.Errorf("dict: key %v is not a string", kv[i])
				}
				m[k] = kv[i+1]
			}
			return m, nil
		},
		"chunk": func(size int, items any) [][]any {
			return chunk(size, items)
		},
	}
}

var scales = map[string][]string{
	"difficulty": {"Very Easy", "Easy", "Medium", "Hard", "Very Hard"},
	"workload":   {"Very Low", "Low", "Moderate", "High", "Very High"},
}

// scaleLabel returns the label for a 1-5 value on a named scale.
func scaleLabel(kind string, value int64) string {
	if labels, ok := scales[kind]; ok && value >= 1 && value <= 5 {
		return labels[value-1]
	}
	return fmt.Sprint(value)
}

// ratingLabel formats an average rating for display.
func ratingLabel(kind string, rating float64) string {
	if rating == 0 {
		return "No ratings"
	}
	if _, ok := scales[kind]; ok {
		return scaleLabel(kind, int64(math.Round(rating)))
	}
	return fmt.Sprintf("%.1f / 5", rating)
}

// chunk splits a slice into rows of size for Pico's .grid layout.
func chunk(size int, items any) [][]any {
	v := reflect.ValueOf(items)
	if v.Kind() != reflect.Slice {
		return nil
	}
	var rows [][]any
	for i := 0; i < v.Len(); i += size {
		var row []any
		for j := i; j < min(i+size, v.Len()); j++ {
			row = append(row, v.Index(j).Interface())
		}
		rows = append(rows, row)
	}
	return rows
}

// render writes a full page using the layout.
func (s *Server) render(w http.ResponseWriter, r *http.Request, status int, page string, d data) {
	s.execute(w, r, status, page, "layout", d)
}

// renderFragment writes a single named template from a page, for htmx swaps.
func (s *Server) renderFragment(w http.ResponseWriter, r *http.Request, status int, page, name string, d data) {
	s.execute(w, r, status, page, name, d)
}

func (s *Server) execute(w http.ResponseWriter, r *http.Request, status int, page, name string, d data) {
	t, ok := s.views.pages[page]
	if !ok {
		s.serverError(w, r, fmt.Errorf("no template %q", page))
		return
	}
	if d == nil {
		d = data{}
	}
	d["User"] = currentUser(r)
	d["Path"] = r.URL.Path
	if name == "layout" {
		d["Toasts"] = s.popFlashes(r)
	}

	var buf bytes.Buffer
	if err := t.ExecuteTemplate(&buf, name, d); err != nil {
		s.serverError(w, r, err)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(status)
	buf.WriteTo(w)
}

// flash queues a toast to show on the next full page render.
func (s *Server) flash(r *http.Request, kind, message string) {
	s.sessions.Put(r.Context(), "flash_"+kind, message)
}

func (s *Server) popFlashes(r *http.Request) []toast {
	var out []toast
	for _, kind := range []string{"success", "error"} {
		if msg := s.sessions.PopString(r.Context(), "flash_"+kind); msg != "" {
			out = append(out, toast{Kind: kind, Message: msg})
		}
	}
	return out
}

// trigger sets the HX-Trigger header so htmx fires these events client-side.
// A "toast" event shows a notification; see static/js/app.js.
func trigger(w http.ResponseWriter, events map[string]any) {
	b, _ := json.Marshal(events)
	w.Header().Set("HX-Trigger", string(b))
}

func toastEvent(kind, message string) map[string]any {
	return map[string]any{"toast": toast{Kind: kind, Message: message}}
}

func isHTMX(r *http.Request) bool {
	return r.Header.Get("HX-Request") == "true"
}

// redirect sends the browser elsewhere after a form post. htmx requests that
// target a fragment get an HX-Redirect so the whole page navigates.
func redirect(w http.ResponseWriter, r *http.Request, url string) {
	if isHTMX(r) && r.Header.Get("HX-Boosted") != "true" {
		w.Header().Set("HX-Redirect", url)
		w.WriteHeader(http.StatusNoContent)
		return
	}
	http.Redirect(w, r, url, http.StatusSeeOther)
}

func (s *Server) static() http.Handler {
	files := http.FileServerFS(s.views.static)
	return http.StripPrefix("/static/", http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if r.URL.Query().Get("v") != "" {
			w.Header().Set("Cache-Control", "public, max-age=31536000, immutable")
		} else {
			w.Header().Set("Cache-Control", "public, max-age=3600")
		}
		files.ServeHTTP(w, r)
	}))
}

func (s *Server) rootAsset(p string) http.HandlerFunc {
	return func(w http.ResponseWriter, r *http.Request) {
		w.Header().Set("Cache-Control", "public, max-age=86400")
		http.ServeFileFS(w, r, s.views.static, p)
	}
}

func (s *Server) notFound(w http.ResponseWriter, r *http.Request) {
	s.render(w, r, http.StatusNotFound, "error", data{
		"Title":   "Not found",
		"Message": "The requested page could not be found.",
	})
}

func (s *Server) serverError(w http.ResponseWriter, r *http.Request, err error) {
	s.log.Error("request failed", "method", r.Method, "path", r.URL.Path, "err", err)
	if isHTMX(r) {
		trigger(w, toastEvent("error", "Something went wrong. Please try again."))
		w.WriteHeader(http.StatusInternalServerError)
		return
	}
	msg := "An unexpected error occurred."
	if s.dev {
		msg = err.Error()
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	w.WriteHeader(http.StatusInternalServerError)
	if t, ok := s.views.pages["error"]; ok {
		_ = t.ExecuteTemplate(w, "layout", data{"Title": "Error", "Message": msg, "Path": r.URL.Path, "User": currentUser(r)})
	}
}
