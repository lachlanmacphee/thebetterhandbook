// Package mail sends transactional email.
package mail

import (
	"context"
	"fmt"
	"log/slog"
	"time"

	gomail "github.com/wneessen/go-mail"

	"github.com/lachlanmacphee/thebetterhandbook/internal/config"
)

// Sender sends a single HTML email.
type Sender interface {
	Send(ctx context.Context, to, subject, html string) error
}

// New returns an SMTP sender, or a logging sender when no SMTP host is set.
func New(cfg config.Email, log *slog.Logger) Sender {
	if cfg.Host == "" {
		return logSender{log: log}
	}
	return smtpSender{cfg: cfg}
}

type smtpSender struct {
	cfg config.Email
}

func (s smtpSender) Send(ctx context.Context, to, subject, html string) error {
	msg := gomail.NewMsg()
	if err := msg.FromFormat("The Better Handbook", s.cfg.User); err != nil {
		return err
	}
	if err := msg.To(to); err != nil {
		return err
	}
	msg.Subject(subject)
	msg.SetBodyString(gomail.TypeTextHTML, html)

	client, err := gomail.NewClient(s.cfg.Host,
		gomail.WithPort(s.cfg.Port),
		gomail.WithSSL(), // implicit TLS, as with nodemailer's `secure: true`
		gomail.WithSMTPAuth(gomail.SMTPAuthAutoDiscover),
		gomail.WithUsername(s.cfg.User),
		gomail.WithPassword(s.cfg.Password),
		gomail.WithTimeout(15*time.Second),
	)
	if err != nil {
		return err
	}
	if err := client.DialAndSendWithContext(ctx, msg); err != nil {
		return fmt.Errorf("send mail to %s: %w", to, err)
	}
	return nil
}

type logSender struct {
	log *slog.Logger
}

func (s logSender) Send(_ context.Context, to, subject, html string) error {
	s.log.Info("email not sent (EMAIL_HOST unset)", "to", to, "subject", subject, "body", html)
	return nil
}
