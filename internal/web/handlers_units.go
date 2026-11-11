package web

import (
	"database/sql"
	"errors"
	"net/http"
	"net/url"
	"slices"
	"strconv"
	"strings"

	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
)

func (s *Server) home(w http.ResponseWriter, r *http.Request) {
	unis, err := s.q.ListUniversities(r.Context())
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	s.render(w, r, http.StatusOK, "home", data{"Universities": unis})
}

func (s *Server) about(w http.ResponseWriter, r *http.Request) {
	s.render(w, r, http.StatusOK, "about", nil)
}

// findUniversity loads the university named by the {uni} path segment,
// writing a 404 page if there isn't one.
func (s *Server) findUniversity(w http.ResponseWriter, r *http.Request) (db.University, bool) {
	uni, err := s.q.GetUniversityBySlug(r.Context(), r.PathValue("uni"))
	if errors.Is(err, sql.ErrNoRows) {
		s.notFound(w, r)
		return uni, false
	}
	if err != nil {
		s.serverError(w, r, err)
		return uni, false
	}
	return uni, true
}

func uniURL(uni db.University) string { return "/universities/" + uni.Slug }

func unitURL(uniSlug, code string) string {
	return "/universities/" + uniSlug + "/units/" + url.PathEscape(code)
}

func (s *Server) universityHome(w http.ResponseWriter, r *http.Request) {
	uni, ok := s.findUniversity(w, r)
	if !ok {
		return
	}
	units, err := s.q.PopularUnits(r.Context(), db.PopularUnitsParams{UserID: viewerID(r), UniversityID: uni.ID})
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	s.render(w, r, http.StatusOK, "university", data{"University": uni, "Units": units})
}

// unitLookup handles the "enter a unit code" form on a university's page.
func (s *Server) unitLookup(w http.ResponseWriter, r *http.Request) {
	uni, ok := s.findUniversity(w, r)
	if !ok {
		return
	}
	code := strings.ToUpper(strings.TrimSpace(r.URL.Query().Get("code")))
	if code == "" {
		http.Redirect(w, r, uniURL(uni), http.StatusSeeOther)
		return
	}
	http.Redirect(w, r, unitURL(uni.Slug, code), http.StatusSeeOther)
}

var pageSizes = []int{12, 24, 36}

type searchFilters struct {
	Code, Name, Faculty, Level, CreditPoints, Campus, Semester, SortBy string
	PageSize                                                           int
}

type pageLink struct {
	Label   string
	URL     string
	Current bool
}

func (s *Server) search(w http.ResponseWriter, r *http.Request) {
	uni, ok := s.findUniversity(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	query := r.URL.Query()

	f := searchFilters{
		Code:         strings.ToUpper(strings.TrimSpace(query.Get("code"))),
		Name:         strings.TrimSpace(query.Get("name")),
		Faculty:      query.Get("faculty"),
		Level:        query.Get("level"),
		CreditPoints: query.Get("creditPoints"),
		Campus:       query.Get("campus"),
		Semester:     query.Get("semester"),
		SortBy:       query.Get("sortBy"),
		PageSize:     atoiDefault(query.Get("pageSize"), pageSizes[0]),
	}
	if !slices.Contains([]string{"code", "name", "rating", "reviews"}, f.SortBy) {
		f.SortBy = "code"
	}
	if !slices.Contains(pageSizes, f.PageSize) {
		f.PageSize = pageSizes[0]
	}
	page := max(atoiDefault(query.Get("page"), 1), 1)

	params := db.CountUnitsParams{
		UniversityID: uni.ID,
		Code:         nilIfEmpty(f.Code),
		Name:         nilIfEmpty(f.Name),
		FacultyID:    nilIfNotInt(f.Faculty),
		Level:        nilIfEmpty(f.Level),
		CreditPoints: nilIfNotInt(f.CreditPoints),
		CampusID:     nilIfNotInt(f.Campus),
		SemesterID:   nilIfNotInt(f.Semester),
	}
	total, err := s.q.CountUnits(ctx, params)
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	units, err := s.q.SearchUnits(ctx, db.SearchUnitsParams{
		Sort:         f.SortBy,
		UniversityID: params.UniversityID,
		Code:         params.Code,
		Name:         params.Name,
		FacultyID:    params.FacultyID,
		Level:        params.Level,
		CreditPoints: params.CreditPoints,
		CampusID:     params.CampusID,
		SemesterID:   params.SemesterID,
		Limit:        int64(f.PageSize),
		Offset:       int64((page - 1) * f.PageSize),
	})
	if err != nil {
		s.serverError(w, r, err)
		return
	}

	faculties, err1 := s.q.ListFaculties(ctx, uni.ID)
	campuses, err2 := s.q.ListCampuses(ctx, uni.ID)
	semesters, err3 := s.q.ListSemesters(ctx, uni.ID)
	levels, err4 := s.q.ListLevels(ctx, uni.ID)
	creditPoints, err5 := s.q.ListCreditPoints(ctx, uni.ID)
	if err := errors.Join(err1, err2, err3, err4, err5); err != nil {
		s.serverError(w, r, err)
		return
	}

	totalPages := int((total + int64(f.PageSize) - 1) / int64(f.PageSize))
	s.render(w, r, http.StatusOK, "search", data{
		"University":   uni,
		"Units":        units,
		"Total":        total,
		"Filters":      f,
		"PageSizes":    pageSizes,
		"Faculties":    faculties,
		"Campuses":     campuses,
		"Semesters":    semesters,
		"Levels":       levels,
		"CreditPoints": creditPoints,
		"Pages":        paginate(r.URL, page, totalPages),
	})
}

// paginate builds first/prev/numbered/next/last links, keeping the current
// query string. It shows at most five numbered pages around the current one.
func paginate(u *url.URL, page, totalPages int) []pageLink {
	if totalPages <= 1 {
		return nil
	}
	link := func(label string, p int) pageLink {
		q := u.Query()
		q.Set("page", strconv.Itoa(p))
		return pageLink{Label: label, URL: u.Path + "?" + q.Encode(), Current: p == page}
	}
	start := min(max(page-2, 1), max(totalPages-4, 1))
	end := min(start+4, totalPages)

	links := []pageLink{link("«", 1), link("‹", max(page-1, 1))}
	for p := start; p <= end; p++ {
		links = append(links, link(strconv.Itoa(p), p))
	}
	links = append(links, link("›", min(page+1, totalPages)), link("»", totalPages))
	// Only numbered pages are highlighted as current.
	links[0].Current, links[1].Current = false, false
	links[len(links)-1].Current, links[len(links)-2].Current = false, false
	return links
}

var reviewSorts = []string{"helpful", "latest", "oldest"}

func (s *Server) unit(w http.ResponseWriter, r *http.Request) {
	uni, ok := s.findUniversity(w, r)
	if !ok {
		return
	}
	ctx := r.Context()
	code := r.PathValue("code")

	unit, err := s.q.GetUnit(ctx, db.GetUnitParams{UniversityID: uni.ID, Code: code})
	if errors.Is(err, sql.ErrNoRows) {
		if upper := strings.ToUpper(code); upper != code {
			http.Redirect(w, r, unitURL(uni.Slug, upper), http.StatusMovedPermanently)
			return
		}
		s.unitNotFound(w, r, uni, code)
		return
	}
	if err != nil {
		s.serverError(w, r, err)
		return
	}

	sort := r.URL.Query().Get("sort")
	if !slices.Contains(reviewSorts, sort) {
		sort = reviewSorts[0]
	}
	campuses, err1 := s.q.ListUnitCampuses(ctx, unit.ID)
	semesters, err2 := s.q.ListUnitSemesters(ctx, unit.ID)
	reviews, err3 := s.q.ListUnitReviews(ctx, db.ListUnitReviewsParams{Sort: sort, ViewerID: viewerID(r), UnitID: unit.ID})
	if err := errors.Join(err1, err2, err3); err != nil {
		s.serverError(w, r, err)
		return
	}

	hasReviewed := slices.ContainsFunc(reviews, func(rv db.ListUnitReviewsRow) bool { return rv.UserID == viewerID(r) })
	s.render(w, r, http.StatusOK, "unit", data{
		"University":  uni,
		"Unit":        unit,
		"URL":         unitURL(uni.Slug, unit.Code),
		"Campuses":    campuses,
		"Semesters":   semesters,
		"Reviews":     reviews,
		"Sort":        sort,
		"HasReviewed": hasReviewed,
	})
}

func (s *Server) unitNotFound(w http.ResponseWriter, r *http.Request, uni db.University, code string) {
	req, err := s.q.GetUnitAdditionRequest(r.Context(), db.GetUnitAdditionRequestParams{UniversityID: uni.ID, Code: code})
	if err != nil && !errors.Is(err, sql.ErrNoRows) {
		s.serverError(w, r, err)
		return
	}
	d := data{"University": uni, "Code": code, "URL": unitURL(uni.Slug, code)}
	if err == nil {
		d["Request"] = req
	}
	s.render(w, r, http.StatusNotFound, "unit_not_found", d)
}

func (s *Server) requestUnit(w http.ResponseWriter, r *http.Request) {
	uni, ok := s.findUniversity(w, r)
	if !ok {
		return
	}
	code := r.PathValue("code")
	if _, err := s.q.GetUnit(r.Context(), db.GetUnitParams{UniversityID: uni.ID, Code: code}); err == nil {
		http.Redirect(w, r, unitURL(uni.Slug, code), http.StatusSeeOther)
		return
	}
	err := s.q.CreateUnitAdditionRequest(r.Context(), db.CreateUnitAdditionRequestParams{
		Code: code, UserID: viewerID(r), UniversityID: uni.ID,
	})
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	s.flash(r, "success", "Thanks! We'll look into adding "+code+".")
	http.Redirect(w, r, unitURL(uni.Slug, code), http.StatusSeeOther)
}

// unitFromPath loads the university and unit named in the URL for actions.
func (s *Server) unitFromPath(w http.ResponseWriter, r *http.Request) (db.University, db.GetUnitRow, bool) {
	uni, ok := s.findUniversity(w, r)
	if !ok {
		return uni, db.GetUnitRow{}, false
	}
	unit, err := s.q.GetUnit(r.Context(), db.GetUnitParams{UniversityID: uni.ID, Code: r.PathValue("code")})
	if errors.Is(err, sql.ErrNoRows) {
		s.notFound(w, r)
		return uni, unit, false
	}
	if err != nil {
		s.serverError(w, r, err)
		return uni, unit, false
	}
	return uni, unit, true
}

// dialogResult answers a form submitted from a <dialog> via htmx.
func dialogResult(w http.ResponseWriter, ok bool, message string) {
	if !ok {
		trigger(w, toastEvent("error", message))
		w.WriteHeader(http.StatusUnprocessableEntity)
		return
	}
	events := toastEvent("success", message)
	events["close-dialog"] = true
	trigger(w, events)
	w.WriteHeader(http.StatusNoContent)
}

func (s *Server) deprecateUnit(w http.ResponseWriter, r *http.Request) {
	_, unit, ok := s.unitFromPath(w, r)
	if !ok {
		return
	}
	reason := strings.TrimSpace(r.PostFormValue("reason"))
	if reason == "" {
		dialogResult(w, false, "Please give a reason.")
		return
	}
	err := s.q.CreateUnitDeprecation(r.Context(), db.CreateUnitDeprecationParams{Reason: reason, UnitID: unit.ID, UserID: viewerID(r)})
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	dialogResult(w, true, "Deprecation request submitted.")
}

var suggestionFields = []string{"campus", "semester", "name"}

func (s *Server) suggestChange(w http.ResponseWriter, r *http.Request) {
	_, unit, ok := s.unitFromPath(w, r)
	if !ok {
		return
	}
	field := r.PostFormValue("field")
	reason := strings.TrimSpace(r.PostFormValue("reason"))
	if !slices.Contains(suggestionFields, field) || reason == "" {
		dialogResult(w, false, "Please choose a field and describe the change.")
		return
	}
	err := s.q.CreateUnitSuggestion(r.Context(), db.CreateUnitSuggestionParams{Field: field, Reason: reason, UnitID: unit.ID, UserID: viewerID(r)})
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	dialogResult(w, true, "Suggestion submitted.")
}

// fallback redirects URLs from the old /{id}/... scheme and 404s the rest.
func (s *Server) fallback(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet && r.Method != http.MethodHead {
		http.Error(w, "Method not allowed", http.StatusMethodNotAllowed)
		return
	}
	parts := strings.Split(strings.Trim(r.URL.Path, "/"), "/")

	// /reviews/{id} was the old edit page.
	if len(parts) == 2 && parts[0] == "reviews" {
		if id, err := strconv.ParseInt(parts[1], 10, 64); err == nil {
			if loc, err := s.q.GetReviewLocation(r.Context(), id); err == nil {
				http.Redirect(w, r, unitURL(loc.UniversitySlug, loc.UnitCode)+"/review", http.StatusMovedPermanently)
				return
			}
		}
	}

	// /{id}, /{id}/search, /{id}/units/{code}[/review]
	if id, err := strconv.ParseInt(parts[0], 10, 64); err == nil {
		if uni, err := s.q.GetUniversityByID(r.Context(), id); err == nil {
			target := uniURL(uni)
			if rest := strings.Join(parts[1:], "/"); rest != "" {
				target += "/" + rest
			}
			if r.URL.RawQuery != "" {
				target += "?" + r.URL.RawQuery
			}
			http.Redirect(w, r, target, http.StatusMovedPermanently)
			return
		}
	}
	s.notFound(w, r)
}

func atoiDefault(s string, def int) int {
	n, err := strconv.Atoi(s)
	if err != nil {
		return def
	}
	return n
}

// nilIfEmpty and nilIfNotInt turn optional query params into SQL NULLs.
func nilIfEmpty(s string) any {
	if s == "" {
		return nil
	}
	return s
}

func nilIfNotInt(s string) any {
	n, err := strconv.ParseInt(s, 10, 64)
	if err != nil {
		return nil
	}
	return n
}
