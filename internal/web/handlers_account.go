package web

import (
	"crypto/rand"
	"database/sql"
	"errors"
	"net/http"
	"strconv"
	"strings"

	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
)

func (s *Server) profile(w http.ResponseWriter, r *http.Request) {
	reviews, err := s.q.ListUserReviews(r.Context(), viewerID(r))
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	s.render(w, r, http.StatusOK, "profile", data{"Reviews": reviews})
}

func (s *Server) updateName(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	name := strings.TrimSpace(r.PostFormValue("name"))
	if name == "" || len(name) > 100 {
		trigger(w, toastEvent("error", "Please enter a name (up to 100 characters)."))
		w.WriteHeader(http.StatusUnprocessableEntity)
		return
	}
	if err := s.q.UpdateUserName(r.Context(), db.UpdateUserNameParams{Name: sql.NullString{String: name, Valid: true}, ID: user.ID}); err != nil {
		s.serverError(w, r, err)
		return
	}
	user.Name = sql.NullString{String: name, Valid: true}
	if !isHTMX(r) {
		s.flash(r, "success", "Name updated.")
		http.Redirect(w, r, "/profile", http.StatusSeeOther)
		return
	}
	trigger(w, toastEvent("success", "Name updated."))
	s.renderFragment(w, r, http.StatusOK, "profile", "name-form", data{})
}

func (s *Server) generateAPIKey(w http.ResponseWriter, r *http.Request) {
	user := currentUser(r)
	key := "tbh_" + rand.Text() + rand.Text()
	if err := s.q.SetUserAPIKey(r.Context(), db.SetUserAPIKeyParams{ApiKey: sql.NullString{String: key, Valid: true}, ID: user.ID}); err != nil {
		s.serverError(w, r, err)
		return
	}
	user.ApiKey = sql.NullString{String: key, Valid: true}
	if !isHTMX(r) {
		s.flash(r, "success", "API key generated.")
		http.Redirect(w, r, "/profile", http.StatusSeeOther)
		return
	}
	trigger(w, toastEvent("success", "API key generated."))
	s.renderFragment(w, r, http.StatusOK, "profile", "api-key-form", data{})
}

func (s *Server) admin(w http.ResponseWriter, r *http.Request) {
	ctx := r.Context()
	deprecations, err1 := s.q.ListPendingDeprecations(ctx)
	suggestions, err2 := s.q.ListPendingSuggestions(ctx)
	additions, err3 := s.q.ListAdditionRequests(ctx)
	if err := errors.Join(err1, err2, err3); err != nil {
		s.serverError(w, r, err)
		return
	}
	s.render(w, r, http.StatusOK, "admin", data{
		"Deprecations": deprecations,
		"Suggestions":  suggestions,
		"Additions":    additions,
		"Empty":        len(deprecations)+len(suggestions)+len(additions) == 0,
	})
}

// adminDecision reads the {id} path value and APPROVED/REJECTED form value.
func adminDecision(r *http.Request) (int64, string, bool) {
	id, err := strconv.ParseInt(r.PathValue("id"), 10, 64)
	status := r.PostFormValue("action")
	return id, status, err == nil && (status == "APPROVED" || status == "REJECTED")
}

// adminDone removes the handled request card (htmx) or reloads the page.
func (s *Server) adminDone(w http.ResponseWriter, r *http.Request, message string) {
	if !isHTMX(r) {
		s.flash(r, "success", message)
		http.Redirect(w, r, "/admin", http.StatusSeeOther)
		return
	}
	trigger(w, toastEvent("success", message))
	w.WriteHeader(http.StatusOK) // empty body replaces the card
}

func (s *Server) adminMissing(w http.ResponseWriter, r *http.Request) {
	if isHTMX(r) {
		trigger(w, toastEvent("error", "That request no longer exists."))
		w.WriteHeader(http.StatusOK)
		return
	}
	s.flash(r, "error", "That request no longer exists.")
	http.Redirect(w, r, "/admin", http.StatusSeeOther)
}

func (s *Server) handleDeprecation(w http.ResponseWriter, r *http.Request) {
	id, status, ok := adminDecision(r)
	if !ok {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	err := db.WithTx(ctx, s.conn, func(q *db.Queries) error {
		unitID, err := q.SetDeprecationStatus(ctx, db.SetDeprecationStatusParams{Status: status, ID: id})
		if err != nil {
			return err
		}
		if status == "APPROVED" {
			return q.MarkUnitDeprecated(ctx, unitID)
		}
		return nil
	})
	if errors.Is(err, sql.ErrNoRows) {
		s.adminMissing(w, r)
		return
	}
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	s.adminDone(w, r, "Deprecation request "+strings.ToLower(status)+".")
}

func (s *Server) handleSuggestion(w http.ResponseWriter, r *http.Request) {
	id, status, ok := adminDecision(r)
	if !ok {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}
	n, err := s.q.SetSuggestionStatus(r.Context(), db.SetSuggestionStatusParams{Status: status, ID: id})
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	if n == 0 {
		s.adminMissing(w, r)
		return
	}
	s.adminDone(w, r, "Suggestion "+strings.ToLower(status)+".")
}

// handleAddition resolves a unit addition request. Either way the request is
// removed; approving just means the unit will be added via an import.
func (s *Server) handleAddition(w http.ResponseWriter, r *http.Request) {
	id, status, ok := adminDecision(r)
	if !ok {
		http.Error(w, "Bad request", http.StatusBadRequest)
		return
	}
	ctx := r.Context()
	exists, err := s.q.AdditionRequestExists(ctx, id)
	if err != nil {
		s.serverError(w, r, err)
		return
	}
	if !exists {
		s.adminMissing(w, r)
		return
	}
	if err := s.q.DeleteAdditionRequest(ctx, id); err != nil {
		s.serverError(w, r, err)
		return
	}
	s.adminDone(w, r, "Addition request "+strings.ToLower(status)+".")
}
