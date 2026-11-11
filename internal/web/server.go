// Package web serves the HTML site and the JSON API.
package web

import (
	"database/sql"
	"log/slog"
	"net/http"
	"time"

	"github.com/alexedwards/scs/sqlite3store"
	"github.com/alexedwards/scs/v2"

	"github.com/lachlanmacphee/thebetterhandbook/internal/auth"
	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
	"github.com/lachlanmacphee/thebetterhandbook/internal/mail"
)

type Options struct {
	DB            *sql.DB
	Mail          mail.Sender
	Log           *slog.Logger
	SessionSecret string
	Dev           bool
}

type Server struct {
	conn     *sql.DB
	q        *db.Queries
	sessions *scs.SessionManager
	codes    *auth.Codes
	mail     mail.Sender
	log      *slog.Logger
	views    *renderer
	dev      bool
}

func New(opts Options) (*Server, error) {
	views, err := newRenderer()
	if err != nil {
		return nil, err
	}

	sessions := scs.New()
	sessions.Store = sqlite3store.New(opts.DB)
	sessions.Lifetime = 30 * 24 * time.Hour
	sessions.IdleTimeout = 14 * 24 * time.Hour
	sessions.Cookie.Name = "tbh_session"
	sessions.Cookie.HttpOnly = true
	sessions.Cookie.SameSite = http.SameSiteLaxMode
	sessions.Cookie.Secure = !opts.Dev
	sessions.Cookie.Persist = true

	q := db.New(opts.DB)
	s := &Server{
		conn:     opts.DB,
		q:        q,
		sessions: sessions,
		codes:    auth.NewCodes(q, opts.SessionSecret),
		mail:     opts.Mail,
		log:      opts.Log,
		views:    views,
		dev:      opts.Dev,
	}
	sessions.ErrorFunc = func(w http.ResponseWriter, r *http.Request, err error) {
		s.serverError(w, r, err)
	}
	return s, nil
}
