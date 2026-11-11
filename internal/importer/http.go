package importer

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"io"
	"net/http"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
)

// Client is the shared HTTP client used by importers. The timeout is generous
// because some handbooks return every unit in a single large response.
var Client = &http.Client{Timeout: 3 * time.Minute}

// StatusError is returned when a request completes with a non-2xx status.
type StatusError struct {
	Method     string
	URL        string
	StatusCode int
}

func (e *StatusError) Error() string {
	return fmt.Sprintf("%s %s: unexpected status %d %s", e.Method, e.URL, e.StatusCode, http.StatusText(e.StatusCode))
}

// do sends a request and returns the open response body after checking for a
// 2xx status. The caller must close the body.
func do(ctx context.Context, method, url string, header http.Header, body io.Reader) (io.ReadCloser, error) {
	req, err := http.NewRequestWithContext(ctx, method, url, body)
	if err != nil {
		return nil, err
	}
	for k, vs := range header {
		for _, v := range vs {
			req.Header.Add(k, v)
		}
	}
	res, err := Client.Do(req)
	if err != nil {
		return nil, err
	}
	if res.StatusCode < 200 || res.StatusCode > 299 {
		_, _ = io.Copy(io.Discard, io.LimitReader(res.Body, 64<<10))
		res.Body.Close()
		return nil, &StatusError{Method: method, URL: url, StatusCode: res.StatusCode}
	}
	return res.Body, nil
}

// GetJSON GETs url and decodes the JSON response into v.
func GetJSON(ctx context.Context, url string, header http.Header, v any) error {
	body, err := do(ctx, http.MethodGet, url, header, nil)
	if err != nil {
		return err
	}
	defer body.Close()
	if err := json.NewDecoder(body).Decode(v); err != nil {
		return fmt.Errorf("decode %s: %w", url, err)
	}
	return nil
}

// PostJSON POSTs payload as JSON to url and decodes the JSON response into v.
// A Content-Type of application/json is set unless header provides one.
func PostJSON(ctx context.Context, url string, header http.Header, payload, v any) error {
	b, err := json.Marshal(payload)
	if err != nil {
		return err
	}
	h := header.Clone()
	if h == nil {
		h = http.Header{}
	}
	if h.Get("Content-Type") == "" {
		h.Set("Content-Type", "application/json")
	}
	body, err := do(ctx, http.MethodPost, url, h, bytes.NewReader(b))
	if err != nil {
		return err
	}
	defer body.Close()
	if err := json.NewDecoder(body).Decode(v); err != nil {
		return fmt.Errorf("decode %s: %w", url, err)
	}
	return nil
}

// GetHTML GETs url and parses the response as an HTML document.
func GetHTML(ctx context.Context, url string, header http.Header) (*goquery.Document, error) {
	body, err := do(ctx, http.MethodGet, url, header, nil)
	if err != nil {
		return nil, err
	}
	defer body.Close()
	doc, err := goquery.NewDocumentFromReader(body)
	if err != nil {
		return nil, fmt.Errorf("parse %s: %w", url, err)
	}
	return doc, nil
}

// Sleep waits for d or until ctx is cancelled, returning ctx.Err() in the
// latter case.
func Sleep(ctx context.Context, d time.Duration) error {
	t := time.NewTimer(d)
	defer t.Stop()
	select {
	case <-ctx.Done():
		return ctx.Err()
	case <-t.C:
		return nil
	}
}

// ParseInt mimics JavaScript's parseInt(s, 10): it skips leading whitespace,
// accepts an optional sign, then reads as many decimal digits as it can. ok is
// false when no digits were found (where JavaScript would return NaN).
func ParseInt(s string) (n int, ok bool) {
	s = strings.TrimLeft(s, " \t\n\v\f\r\u00a0\ufeff")
	neg := false
	if s != "" && (s[0] == '+' || s[0] == '-') {
		neg = s[0] == '-'
		s = s[1:]
	}
	for _, c := range []byte(s) {
		if c < '0' || c > '9' {
			break
		}
		n = n*10 + int(c-'0')
		ok = true
	}
	if neg {
		n = -n
	}
	return n, ok
}
