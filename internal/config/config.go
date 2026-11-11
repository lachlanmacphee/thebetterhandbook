// Package config loads runtime configuration from environment variables.
package config

import (
	"errors"
	"os"
	"strconv"
)

type Config struct {
	// Addr is the address the HTTP server listens on.
	Addr string
	// DatabasePath is the SQLite database file.
	DatabasePath string
	// Dev enables development conveniences: sign-in codes are logged, emails
	// are logged instead of sent when SMTP isn't configured, and cookies
	// aren't marked Secure.
	Dev bool
	// SessionSecret keys the HMAC used to store sign-in codes.
	SessionSecret string
	Email         Email
}

type Email struct {
	Host     string
	Port     int
	User     string
	Password string
}

// Load reads configuration from the environment.
func Load() (Config, error) {
	c := Config{
		Addr:          env("ADDR", ":3000"),
		DatabasePath:  env("DATABASE_PATH", "data/tbh.db"),
		Dev:           os.Getenv("ENV") == "development",
		SessionSecret: os.Getenv("SESSION_SECRET"),
		Email: Email{
			Host:     os.Getenv("EMAIL_HOST"),
			User:     os.Getenv("EMAIL_USER"),
			Password: os.Getenv("EMAIL_PASS"),
		},
	}

	port, err := strconv.Atoi(env("EMAIL_PORT", "465"))
	if err != nil {
		return c, errors.New("EMAIL_PORT must be a number")
	}
	c.Email.Port = port

	if c.SessionSecret == "" && c.Dev {
		c.SessionSecret = "development-only-secret"
	}
	return c, nil
}

// ValidateServer checks the settings the web server needs. Other commands
// (import, backup) only need the database.
func (c Config) ValidateServer() error {
	if c.SessionSecret == "" {
		return errors.New("SESSION_SECRET is required")
	}
	if !c.Dev && c.Email.Host == "" {
		return errors.New("EMAIL_HOST is required outside development (set ENV=development to log emails instead)")
	}
	return nil
}

func env(key, fallback string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return fallback
}
