package web

import (
	"database/sql"
	"errors"
	"fmt"
	"html/template"
	"net/http"
	"strings"

	"github.com/lachlanmacphee/thebetterhandbook/internal/auth"
	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
)

const sessionLoginEmail = "login_email"

func (s *Server) loginPage(w http.ResponseWriter, r *http.Request) {
	if currentUser(r) != nil {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	s.render(w, r, http.StatusOK, "login", data{"Domains": auth.AllowedDomains})
}

func (s *Server) login(w http.ResponseWriter, r *http.Request) {
	email := auth.NormalizeEmail(r.PostFormValue("email"))
	if !auth.EmailAllowed(email) {
		s.render(w, r, http.StatusUnprocessableEntity, "login", data{
			"Domains": auth.AllowedDomains,
			"Email":   email,
			"Error":   "Please use your student email. Allowed domains: @" + strings.Join(auth.AllowedDomains, ", @") + ".",
		})
		return
	}
	if err := s.sendCode(r, email); err != nil {
		s.serverError(w, r, err)
		return
	}
	s.sessions.Put(r.Context(), sessionLoginEmail, email)
	http.Redirect(w, r, "/auth/verify", http.StatusSeeOther)
}

func (s *Server) sendCode(r *http.Request, email string) error {
	code, err := s.codes.Issue(r.Context(), email)
	if err != nil {
		return err
	}
	if s.dev {
		s.log.Info("sign-in code (development only)", "email", email, "code", code)
	}
	body := fmt.Sprintf("<p>Use the code <strong>%s</strong> to sign in. It expires in 5 minutes.</p>", template.HTMLEscapeString(code))
	return s.mail.Send(r.Context(), email, "The Better Handbook - Login Code", body)
}

func (s *Server) verifyPage(w http.ResponseWriter, r *http.Request) {
	if currentUser(r) != nil {
		http.Redirect(w, r, "/", http.StatusSeeOther)
		return
	}
	email := s.sessions.GetString(r.Context(), sessionLoginEmail)
	if email == "" {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}
	s.render(w, r, http.StatusOK, "verify", data{"Email": email})
}

func (s *Server) verify(w http.ResponseWriter, r *http.Request) {
	email := s.sessions.GetString(r.Context(), sessionLoginEmail)
	if email == "" {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}

	err := s.codes.Verify(r.Context(), email, r.PostFormValue("code"))
	if errors.Is(err, auth.ErrInvalidCode) {
		s.render(w, r, http.StatusUnprocessableEntity, "verify", data{"Email": email, "Error": "That code is incorrect or has expired."})
		return
	}
	if errors.Is(err, auth.ErrTooManyAttempts) {
		s.render(w, r, http.StatusUnprocessableEntity, "verify", data{"Email": email, "Error": "Too many incorrect attempts. Please request a new code."})
		return
	}
	if err != nil {
		s.serverError(w, r, err)
		return
	}

	user, err := s.q.GetUserByEmail(r.Context(), email)
	if errors.Is(err, sql.ErrNoRows) {
		user, err = s.q.CreateUser(r.Context(), db.CreateUserParams{
			Email: email,
			Name:  sql.NullString{String: email[:strings.IndexByte(email, '@')], Valid: true},
		})
	}
	if err != nil {
		s.serverError(w, r, err)
		return
	}

	// New token on privilege change, to prevent session fixation.
	if err := s.sessions.RenewToken(r.Context()); err != nil {
		s.serverError(w, r, err)
		return
	}
	s.sessions.Remove(r.Context(), sessionLoginEmail)
	s.sessions.Put(r.Context(), sessionUserID, user.ID)
	s.flash(r, "success", "Signed in.")
	http.Redirect(w, r, "/", http.StatusSeeOther)
}

func (s *Server) resendCode(w http.ResponseWriter, r *http.Request) {
	email := s.sessions.GetString(r.Context(), sessionLoginEmail)
	if email == "" {
		http.Redirect(w, r, "/auth/login", http.StatusSeeOther)
		return
	}
	if err := s.sendCode(r, email); err != nil {
		s.serverError(w, r, err)
		return
	}
	s.flash(r, "success", "We've sent you a new code.")
	http.Redirect(w, r, "/auth/verify", http.StatusSeeOther)
}

func (s *Server) logout(w http.ResponseWriter, r *http.Request) {
	if err := s.sessions.Destroy(r.Context()); err != nil {
		s.serverError(w, r, err)
		return
	}
	http.Redirect(w, r, "/", http.StatusSeeOther)
}
