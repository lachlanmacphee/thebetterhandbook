// Package monash imports units from Monash University.
//
// Unit codes are listed via the CourseLoop publisher search API
// (api-ap-southeast-2.prod.courseloop.com), paged 100 results at a time. Each
// unit's details are then fetched from the Monash handbook's Next.js data
// endpoint (handbook.monash.edu/_next/data/<buildId>/...), in concurrent
// batches of 10 with a 10 second pause between batches. CourseLoop signals
// rate limiting with a 403 rather than a 429, so 403 responses are retried
// after the same delay, up to a bounded number of attempts.
//
// The Next.js build ID changes whenever Monash redeploys the handbook. Set
// MONASH_HANDBOOK_BUILD_ID to override the default; the current value is the
// "buildId" field in the __NEXT_DATA__ script on any handbook.monash.edu page.
//
// This importer is loosely based on Sai's Go implementation
// (https://github.com/saikumarmk/monash-handbook-scraper). Shoutout to Sai for
// the original; the blog post about scraping the Monash Handbook is at
// https://www.saikumarmk.com/universe-of-units/.
package monash

import (
	"context"
	"encoding/json"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"strconv"
	"strings"
	"sync"
	"time"

	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
)

const (
	courseLoopAPIURL   = "https://api-ap-southeast-2.prod.courseloop.com/publisher/search-all"
	courseLoopSiteID   = "monash-prod-pres"
	batchSize          = 10
	interBatchDelay    = 10 * time.Second
	indexPageSize      = 100
	maxAttempts        = 5
	handbookAPIURL     = "https://handbook.monash.edu/_next/data"
	defaultBuildID     = "x72Bg6G_Gp9JqA01tHcsD"
	buildIDEnvVariable = "MONASH_HANDBOOK_BUILD_ID"
)

type index struct {
	unitCodes []string
	aos       []string
	courses   []string
}

type monashImporter struct {
	log *slog.Logger
}

// New returns the Monash University importer.
func New(log *slog.Logger) importer.Importer {
	return &monashImporter{log: log}
}

func (i *monashImporter) University() importer.University {
	return importer.University{
		Name:        "Monash University",
		Slug:        "monash-university",
		HandbookURL: "https://handbook.monash.edu/current/units/",
	}
}

func (i *monashImporter) Units(ctx context.Context) ([]importer.Unit, error) {
	buildID := os.Getenv(buildIDEnvVariable)
	if buildID == "" {
		buildID = defaultBuildID
	}

	idx, err := i.fetchIndex(ctx)
	if err != nil {
		return nil, err
	}
	codes := idx.unitCodes
	i.log.Info("found unit codes to process", "count", len(codes))

	var units []importer.Unit
	totalBatches := (len(codes) + batchSize - 1) / batchSize

	for start := 0; start < len(codes); start += batchSize {
		batchNum := start/batchSize + 1
		batch := codes[start:min(start+batchSize, len(codes))]
		i.log.Info("processing batch", "batch", batchNum, "of", totalBatches, "units", len(batch))

		results := make([]*importer.Unit, len(batch))
		var wg sync.WaitGroup
		for j, code := range batch {
			wg.Go(func() {
				results[j] = i.fetchUnit(ctx, buildID, strings.TrimSpace(code))
			})
		}
		wg.Wait()
		if err := ctx.Err(); err != nil {
			return nil, err
		}

		valid := 0
		for _, u := range results {
			if u != nil {
				units = append(units, *u)
				valid++
			}
		}
		i.log.Info("batch completed", "batch", batchNum, "valid", valid, "units", len(batch))

		if start+batchSize < len(codes) {
			i.log.Debug("waiting before next batch to respect rate limits", "delay", interBatchDelay)
			if err := importer.Sleep(ctx, interBatchDelay); err != nil {
				return nil, err
			}
		}
	}

	i.log.Info("import completed", "units", len(units))
	return units, nil
}

func (i *monashImporter) fetchIndex(ctx context.Context) (index, error) {
	i.log.Info("fetching unit index from CourseLoop API")

	var results []map[string]any
	for start := 0; ; {
		url := fmt.Sprintf("%s?from=%d&query=&searchType=advanced&siteId=%s&siteYear=current&size=%d",
			courseLoopAPIURL, start, courseLoopSiteID, indexPageSize)
		i.log.Debug("fetching index page", "from", start)

		var page struct {
			Data struct {
				Results json.RawMessage `json:"results"`
				Total   any             `json:"total"`
			} `json:"data"`
		}
		if err := importer.GetJSON(ctx, url, nil, &page); err != nil {
			i.log.Error("failed to fetch index page", "from", start, "err", err)
			return index{}, fmt.Errorf("fetch Monash unit index: %w", err)
		}

		// Tolerate a missing or non-array results field, like the TS did.
		var pageResults []map[string]any
		if json.Unmarshal(page.Data.Results, &pageResults) == nil {
			results = append(results, pageResults...)
		}

		total, _ := page.Data.Total.(float64)
		start += indexPageSize
		if float64(start) >= total {
			break
		}
	}

	var idx index
	for _, r := range results {
		uri, ok := r["uri"].(string)
		if !ok {
			continue
		}
		code, ok := r["code"].(string)
		if !ok || code == "" {
			continue
		}
		parts := strings.Split(uri, "/")
		if len(parts) < 3 {
			continue
		}
		code = strings.TrimSpace(code)
		switch parts[2] {
		case "units":
			idx.unitCodes = append(idx.unitCodes, code)
		case "aos":
			idx.aos = append(idx.aos, code)
		case "courses":
			idx.courses = append(idx.courses, code)
		}
	}

	i.log.Info("index fetch completed",
		"units", len(idx.unitCodes), "aos", len(idx.aos), "courses", len(idx.courses))
	return idx, nil
}

// fetchUnit fetches and parses one unit, returning nil (after logging) if it
// could not be fetched or has no content.
func (i *monashImporter) fetchUnit(ctx context.Context, buildID, code string) *importer.Unit {
	url := fmt.Sprintf("%s/%s/current/units/%s.json?year=current&catchAll=current&catchAll=units&catchAll=%s",
		handbookAPIURL, buildID, code, code)

	for attempt := 1; attempt <= maxAttempts; attempt++ {
		var data map[string]any
		err := importer.GetJSON(ctx, url, nil, &data)

		// CourseLoop returns 403 Forbidden rather than 429 Too Many Requests
		// when rate limiting, either as the HTTP status or in the body.
		var statusErr *importer.StatusError
		rateLimited := errors.As(err, &statusErr) && statusErr.StatusCode == http.StatusForbidden
		if err == nil {
			if status, ok := data["status"].(float64); ok && status == http.StatusForbidden {
				rateLimited = true
			}
		}
		if rateLimited {
			if attempt == maxAttempts {
				break
			}
			i.log.Warn("rate limited, retrying after delay", "code", code, "attempt", attempt, "delay", interBatchDelay)
			if importer.Sleep(ctx, interBatchDelay) != nil {
				return nil
			}
			continue
		}

		if err != nil {
			if ctx.Err() == nil {
				i.log.Error("failed to fetch unit content", "code", code, "err", err)
			}
			return nil
		}

		pageProps, _ := data["pageProps"].(map[string]any)
		content, _ := pageProps["pageContent"].(map[string]any)
		if content == nil {
			i.log.Warn("no unit data found", "code", code)
			return nil
		}

		unit, err := parseUnit(content)
		if err != nil {
			i.log.Error("failed to parse unit content", "code", code, "err", err)
			return nil
		}
		i.log.Debug("fetched unit", "code", unit.Code, "name", unit.Name)
		return unit
	}

	i.log.Error("giving up on rate-limited unit", "code", code, "attempts", maxAttempts)
	return nil
}

func parseUnit(c map[string]any) (*importer.Unit, error) {
	code, ok := c["code"].(string)
	if !ok {
		return nil, errors.New("missing code")
	}
	title, ok := c["title"].(string)
	if !ok {
		return nil, errors.New("missing title")
	}

	// Levels are 1-based in the handbook; store them 0-based, defaulting to 0.
	level := 0
	if v, ok := importer.ParseInt(jsString(field(c, "level", "value"))); ok {
		level = v - 1
	}

	creditPoints, ok := importer.ParseInt(jsString(c["credit_points"]))
	if !ok {
		creditPoints = 6
	}

	offerings := []importer.Offering{}
	if list, ok := c["unit_offering"].([]any); ok {
		for _, o := range list {
			offerings = append(offerings, importer.Offering{
				Location: trimmedOr(field(o, "location", "value"), "Unknown"),
				Period:   trimmedOr(field(o, "teaching_period", "value"), "Unknown"),
			})
		}
	}

	return &importer.Unit{
		Code:         strings.TrimSpace(code),
		Name:         strings.TrimSpace(title),
		Level:        strconv.Itoa(level),
		CreditPoints: creditPoints,
		FacultyName:  trimmedOr(field(c, "school", "value"), "Unknown"),
		Offerings:    offerings,
	}, nil
}

// field walks nested JSON objects, returning nil if any step is missing,
// like JavaScript optional chaining.
func field(v any, keys ...string) any {
	for _, k := range keys {
		m, ok := v.(map[string]any)
		if !ok {
			return nil
		}
		v = m[k]
	}
	return v
}

// trimmedOr returns v trimmed if it is a non-blank string, otherwise def.
func trimmedOr(v any, def string) string {
	if s, ok := v.(string); ok {
		if s = strings.TrimSpace(s); s != "" {
			return s
		}
	}
	return def
}

// jsString converts a decoded JSON scalar to the string JavaScript's
// parseInt would see. Missing values become "" (parsing as NaN).
func jsString(v any) string {
	switch t := v.(type) {
	case string:
		return t
	case float64:
		return strconv.FormatFloat(t, 'f', -1, 64)
	default:
		return ""
	}
}
