package web

import "net/http"

// Handler returns the site's HTTP handler with all middleware applied.
func (s *Server) Handler() http.Handler {
	mux := http.NewServeMux()

	mux.Handle("GET /static/", s.static())
	mux.HandleFunc("GET /favicon.ico", s.rootAsset("img/favicon.ico"))
	mux.HandleFunc("GET /apple-touch-icon.png", s.rootAsset("img/apple-touch-icon.png"))

	mux.HandleFunc("GET /{$}", s.home)
	mux.HandleFunc("GET /about", s.about)

	mux.HandleFunc("GET /auth/login", s.loginPage)
	mux.HandleFunc("POST /auth/login", s.login)
	mux.HandleFunc("GET /auth/verify", s.verifyPage)
	mux.HandleFunc("POST /auth/verify", s.verify)
	mux.HandleFunc("POST /auth/resend", s.resendCode)
	mux.HandleFunc("POST /auth/logout", s.logout)

	mux.Handle("GET /profile", s.requireUser(s.profile))
	mux.Handle("POST /profile/name", s.requireUser(s.updateName))
	mux.Handle("POST /profile/api-key", s.requireUser(s.generateAPIKey))

	mux.Handle("GET /admin", s.requireAdmin(s.admin))
	mux.Handle("POST /admin/deprecations/{id}", s.requireAdmin(s.handleDeprecation))
	mux.Handle("POST /admin/suggestions/{id}", s.requireAdmin(s.handleSuggestion))
	mux.Handle("POST /admin/additions/{id}", s.requireAdmin(s.handleAddition))

	mux.HandleFunc("GET /api/docs", s.apiDocs)
	mux.HandleFunc("GET /api/units", s.apiUnits)
	mux.HandleFunc("GET /api/universities", s.apiUniversities)

	mux.HandleFunc("GET /universities", func(w http.ResponseWriter, r *http.Request) {
		http.Redirect(w, r, "/", http.StatusMovedPermanently)
	})
	mux.HandleFunc("GET /universities/{uni}", s.universityHome)
	mux.HandleFunc("GET /universities/{uni}/search", s.search)
	mux.HandleFunc("GET /universities/{uni}/units", s.unitLookup)
	mux.HandleFunc("GET /universities/{uni}/units/{code}", s.unit)
	mux.Handle("POST /universities/{uni}/units/{code}/addition-request", s.requireUser(s.requestUnit))
	mux.Handle("POST /universities/{uni}/units/{code}/deprecations", s.requireUser(s.deprecateUnit))
	mux.Handle("POST /universities/{uni}/units/{code}/suggestions", s.requireUser(s.suggestChange))
	mux.Handle("GET /universities/{uni}/units/{code}/review", s.requireUser(s.reviewForm))
	mux.Handle("POST /universities/{uni}/units/{code}/review", s.requireUser(s.saveReview))

	mux.Handle("POST /reviews/{id}/reaction", s.requireUser(s.react))

	// Anything else: redirect URLs from the old numeric-ID scheme, or 404.
	mux.HandleFunc("/", s.fallback)

	var h http.Handler = mux
	h = s.loadUser(h)
	h = s.sessions.LoadAndSave(h)
	h = http.NewCrossOriginProtection().Handler(h)
	h = s.logRequests(h)
	h = s.recoverPanics(h)
	return h
}
