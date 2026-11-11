// Package auth implements passwordless sign-in with emailed one-time codes.
package auth

import (
	"context"
	"crypto/hmac"
	"crypto/rand"
	"crypto/sha256"
	"database/sql"
	"encoding/hex"
	"errors"
	"fmt"
	"math/big"
	"strings"
	"time"

	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
)

const (
	codeTTL     = 5 * time.Minute
	maxAttempts = 5
)

// AllowedDomains are the student email domains that may sign in. Restricting
// sign-in to university addresses keeps reviews to actual students.
var AllowedDomains = []string{
	"student.monash.edu",
	"student.unimelb.edu.au",
	"anu.edu.au",
	"students.unsw.edu.au",
	"ad.unsw.edu.au",
	"uq.edu.au",
	"student.uq.edu.au",
	"student.adelaide.edu.au",
	"uni.sydney.edu.au",
	"student.uwa.edu.au",
}

var (
	ErrInvalidCode     = errors.New("that code is incorrect or has expired")
	ErrTooManyAttempts = errors.New("too many incorrect attempts, please request a new code")
)

// NormalizeEmail trims and lower-cases an address.
func NormalizeEmail(email string) string {
	return strings.ToLower(strings.TrimSpace(email))
}

// EmailAllowed reports whether email belongs to an allowed student domain.
func EmailAllowed(email string) bool {
	at := strings.LastIndexByte(email, '@')
	if at <= 0 {
		return false
	}
	domain := email[at+1:]
	for _, d := range AllowedDomains {
		if domain == d {
			return true
		}
	}
	return false
}

// Codes issues and checks sign-in codes. Only an HMAC of each code is stored.
type Codes struct {
	q      *db.Queries
	secret []byte
	now    func() time.Time
}

func NewCodes(q *db.Queries, secret string) *Codes {
	return &Codes{q: q, secret: []byte(secret), now: time.Now}
}

// Issue creates a fresh 6-digit code for email, replacing any previous one.
func (c *Codes) Issue(ctx context.Context, email string) (string, error) {
	n, err := rand.Int(rand.Reader, big.NewInt(1_000_000))
	if err != nil {
		return "", err
	}
	code := fmt.Sprintf("%06d", n.Int64())
	err = c.q.UpsertLoginCode(ctx, db.UpsertLoginCodeParams{
		Email:     email,
		CodeHash:  c.hash(email, code),
		ExpiresAt: c.now().Add(codeTTL).Unix(),
	})
	if err != nil {
		return "", err
	}
	// Opportunistic cleanup; failure here doesn't matter.
	_ = c.q.DeleteExpiredLoginCodes(ctx, c.now().Unix())
	return code, nil
}

// Verify checks code for email. A correct code is consumed.
func (c *Codes) Verify(ctx context.Context, email, code string) error {
	row, err := c.q.GetLoginCode(ctx, email)
	if errors.Is(err, sql.ErrNoRows) {
		return ErrInvalidCode
	}
	if err != nil {
		return err
	}
	if row.ExpiresAt < c.now().Unix() {
		return ErrInvalidCode
	}
	if row.Attempts >= maxAttempts {
		return ErrTooManyAttempts
	}
	if !hmac.Equal([]byte(row.CodeHash), []byte(c.hash(email, strings.TrimSpace(code)))) {
		if err := c.q.IncrementLoginCodeAttempts(ctx, email); err != nil {
			return err
		}
		if row.Attempts+1 >= maxAttempts {
			return ErrTooManyAttempts
		}
		return ErrInvalidCode
	}
	return c.q.DeleteLoginCode(ctx, email)
}

func (c *Codes) hash(email, code string) string {
	m := hmac.New(sha256.New, c.secret)
	m.Write([]byte(email))
	m.Write([]byte{0})
	m.Write([]byte(code))
	return hex.EncodeToString(m.Sum(nil))
}
