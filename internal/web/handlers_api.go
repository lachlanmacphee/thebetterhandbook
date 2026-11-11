package web

import (
	"database/sql"
	"errors"
	"net/http"
	"slices"
	"strconv"
	"strings"

	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
)

type apiExample struct {
	ID, Title, Description, Path string
}

var apiExamples = []apiExample{
	{"all-units", "List units", "The first page of units, sorted by code.", "/api/units?page=1&pageSize=12"},
	{"search-by-code", "Search by unit code", "Units whose code contains FIT.", "/api/units?code=FIT"},
	{"sort-by-rating", "Highest rated at one university", "Monash units sorted by average overall rating.", "/api/units?university=monash-university&sortBy=rating"},
	{"most-reviewed", "Most reviewed units", "Units across all universities sorted by review count.", "/api/units?sortBy=reviews"},
	{"all-params", "Every query parameter", "All /api/units filters at once.", "/api/units?university=monash-university&code=FIT&name=data&faculty=1&level=1&creditPoints=6&campus=1&semester=1&sortBy=name&page=1&pageSize=12"},
	{"all-universities", "List universities", "Supported universities with aggregate counts.", "/api/universities"},
	{"search-universities", "Search universities", "Universities matching a name, sorted by unit count.", "/api/universities?name=university&sortBy=unitCount"},
}

func (s *Server) apiDocs(w http.ResponseWriter, r *http.Request) {
	s.render(w, r, http.StatusOK, "api_docs", data{"Examples": apiExamples})
}

func writeJSON(w http.ResponseWriter, status int, body []byte) {
	w.Header().Set("Content-Type", "application/json")
	w.WriteHeader(status)
	w.Write(body)
}

// apiAuth checks the bearer API key, writing a JSON error if it's missing or
// invalid.
func (s *Server) apiAuth(w http.ResponseWriter, r *http.Request) bool {
	key, ok := strings.CutPrefix(r.Header.Get("Authorization"), "Bearer ")
	if !ok || key == "" {
		writeJSON(w, http.StatusUnauthorized, []byte(`{"error":"API key required","message":"Provide your API key in the Authorization header as: Bearer <key>"}`))
		return false
	}
	_, err := s.q.GetUserByAPIKey(r.Context(), sql.NullString{String: key, Valid: true})
	if errors.Is(err, sql.ErrNoRows) {
		writeJSON(w, http.StatusForbidden, []byte(`{"error":"Invalid API key","message":"The provided API key is not valid"}`))
		return false
	}
	if err != nil {
		s.apiError(w, r, err)
		return false
	}
	return true
}

func (s *Server) apiError(w http.ResponseWriter, r *http.Request, err error) {
	s.log.Error("api request failed", "path", r.URL.Path, "err", err)
	writeJSON(w, http.StatusInternalServerError, []byte(`{"error":"Internal server error"}`))
}

func strParam(q map[string][]string, key string) *string {
	v := strings.TrimSpace(firstOf(q[key]))
	if v == "" {
		return nil
	}
	return &v
}

func intParam(q map[string][]string, key string) *int64 {
	n, err := strconv.ParseInt(firstOf(q[key]), 10, 64)
	if err != nil {
		return nil
	}
	return &n
}

func firstOf(v []string) string {
	if len(v) == 0 {
		return ""
	}
	return v[0]
}

func pageParams(q map[string][]string, sizes []int64) (page, size int64) {
	page = max(1, valueOr(intParam(q, "page"), 1))
	size = valueOr(intParam(q, "pageSize"), sizes[0])
	if !slices.Contains(sizes, size) {
		size = sizes[0]
	}
	return page, size
}

func valueOr(p *int64, def int64) int64 {
	if p == nil {
		return def
	}
	return *p
}

func (s *Server) apiUnits(w http.ResponseWriter, r *http.Request) {
	if !s.apiAuth(w, r) {
		return
	}
	q := r.URL.Query()
	page, size := pageParams(q, []int64{12, 24, 36})
	sort := q.Get("sortBy")
	if !slices.Contains([]string{"code", "name", "rating", "reviews"}, sort) {
		sort = "code"
	}
	body, err := db.APIUnits(r.Context(), s.conn, db.APIUnitsParams{
		University:   strParam(q, "university"),
		Code:         strParam(q, "code"),
		Name:         strParam(q, "name"),
		FacultyID:    intParam(q, "faculty"),
		Level:        strParam(q, "level"),
		CreditPoints: intParam(q, "creditPoints"),
		CampusID:     intParam(q, "campus"),
		SemesterID:   intParam(q, "semester"),
		Sort:         sort,
		Page:         page,
		PageSize:     size,
	})
	if err != nil {
		s.apiError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, body)
}

func (s *Server) apiUniversities(w http.ResponseWriter, r *http.Request) {
	if !s.apiAuth(w, r) {
		return
	}
	q := r.URL.Query()
	page, size := pageParams(q, []int64{10, 20, 50})
	sort := q.Get("sortBy")
	if sort != "unitCount" {
		sort = "name"
	}
	body, err := db.APIUniversities(r.Context(), s.conn, db.APIUniversitiesParams{
		Name:     strParam(q, "name"),
		Sort:     sort,
		Page:     page,
		PageSize: size,
	})
	if err != nil {
		s.apiError(w, r, err)
		return
	}
	writeJSON(w, http.StatusOK, body)
}
