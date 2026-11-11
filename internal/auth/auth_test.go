package auth

import (
	"context"
	"errors"
	"path/filepath"
	"testing"
	"time"

	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
)

func newCodes(t *testing.T) *Codes {
	t.Helper()
	conn, err := db.Open(filepath.Join(t.TempDir(), "auth.db"))
	if err != nil {
		t.Fatal(err)
	}
	t.Cleanup(func() { conn.Close() })
	if err := db.Migrate(context.Background(), conn); err != nil {
		t.Fatal(err)
	}
	return NewCodes(db.New(conn), "secret")
}

func TestEmailAllowed(t *testing.T) {
	for email, want := range map[string]bool{
		"a@student.monash.edu":      true,
		"a@uq.edu.au":               true,
		"a@evil.student.monash.edu": false,
		"a@student.monash.edu.evil": false,
		"a@gmail.com":               false,
		"student.monash.edu":        false,
	} {
		if got := EmailAllowed(email); got != want {
			t.Errorf("EmailAllowed(%q) = %v, want %v", email, got, want)
		}
	}
}

func TestCodes(t *testing.T) {
	ctx := context.Background()
	c := newCodes(t)
	const email = "a@uq.edu.au"

	code, err := c.Issue(ctx, email)
	if err != nil {
		t.Fatal(err)
	}
	if len(code) != 6 {
		t.Fatalf("code %q is not 6 digits", code)
	}
	if err := c.Verify(ctx, "other@uq.edu.au", code); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("code for another email: %v", err)
	}
	if err := c.Verify(ctx, email, code); err != nil {
		t.Fatalf("valid code: %v", err)
	}
	if err := c.Verify(ctx, email, code); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("codes must be single use: %v", err)
	}
}

func TestCodeLockout(t *testing.T) {
	ctx := context.Background()
	c := newCodes(t)
	const email = "a@uq.edu.au"
	code, _ := c.Issue(ctx, email)

	wrong := "000000"
	if code == wrong {
		wrong = "111111"
	}
	for i := range maxAttempts {
		err := c.Verify(ctx, email, wrong)
		want := ErrInvalidCode
		if i == maxAttempts-1 {
			want = ErrTooManyAttempts
		}
		if !errors.Is(err, want) {
			t.Fatalf("attempt %d: %v, want %v", i+1, err, want)
		}
	}
	if err := c.Verify(ctx, email, code); !errors.Is(err, ErrTooManyAttempts) {
		t.Fatalf("correct code after lockout: %v", err)
	}
	// A new code resets the attempt counter.
	code, _ = c.Issue(ctx, email)
	if err := c.Verify(ctx, email, code); err != nil {
		t.Fatalf("new code after lockout: %v", err)
	}
}

func TestCodeExpiry(t *testing.T) {
	ctx := context.Background()
	c := newCodes(t)
	const email = "a@uq.edu.au"
	code, _ := c.Issue(ctx, email)
	c.now = func() time.Time { return time.Now().Add(codeTTL + time.Second) }
	if err := c.Verify(ctx, email, code); !errors.Is(err, ErrInvalidCode) {
		t.Fatalf("expired code: %v", err)
	}
}
