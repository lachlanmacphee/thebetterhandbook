// Package usyd imports units from the University of Sydney.
//
// Unit codes are discovered through the Coveo search API that backs the
// sydney.edu.au site search (querying for the current year), and each unit's
// page under https://www.sydney.edu.au/units/<CODE> is then scraped
// sequentially for its name, credit points, study level, school and the
// current/future year availability tables.
//
// The Coveo API requires a bearer token. Copy it from the Authorization header
// in your browser's network tab while on the Sydney search page and set it as
// USYD_BEARER_TOKEN.
//
// Coveo returns at most a few thousand results per request. To paginate, set
// USYD_FIRST_RESULT (default 0) and re-run, e.g. 2000 after the first run,
// then 4000, and so on.
package usyd

import (
	"context"
	"errors"
	"fmt"
	"log/slog"
	"net/http"
	"os"
	"regexp"
	"slices"
	"strconv"
	"strings"
	"time"

	"github.com/PuerkitoBio/goquery"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
)

const (
	coveoAPIURL  = "https://universityofsydneyproduction10somjans.org.coveo.com/rest/search/v2?organizationId=universityofsydneyproduction10somjans"
	unitsBaseURL = "https://www.sydney.edu.au/units/"
)

var unitURIRe = regexp.MustCompile(`/units/([A-Z]{4}\d{4})`)

type usydImporter struct {
	log *slog.Logger
}

// New returns the University of Sydney importer.
func New(log *slog.Logger) importer.Importer {
	return &usydImporter{log: log}
}

func (i *usydImporter) University() importer.University {
	return importer.University{
		Name:        "University of Sydney",
		Slug:        "university-of-sydney",
		HandbookURL: unitsBaseURL,
	}
}

func (i *usydImporter) Units(ctx context.Context) ([]importer.Unit, error) {
	token := os.Getenv("USYD_BEARER_TOKEN")
	if token == "" {
		return nil, errors.New("USYD_BEARER_TOKEN is not set: copy the bearer token from the Authorization header " +
			"in your browser's network tab while on the University of Sydney search page")
	}
	firstResult := 0
	if v := os.Getenv("USYD_FIRST_RESULT"); v != "" {
		n, err := strconv.Atoi(v)
		if err != nil || n < 0 {
			return nil, fmt.Errorf("USYD_FIRST_RESULT must be a non-negative integer, got %q", v)
		}
		firstResult = n
	}

	codes, err := i.unitCodes(ctx, token, firstResult)
	if err != nil {
		return nil, err
	}
	i.log.Info("found unit codes to process", "count", len(codes))

	var units []importer.Unit
	for _, code := range codes {
		unit, err := i.unitDetails(ctx, code)
		if err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			var statusErr *importer.StatusError
			if errors.As(err, &statusErr) {
				i.log.Warn("unit page not found", "code", code, "status", statusErr.StatusCode)
			} else {
				i.log.Error("error fetching unit details", "code", code, "err", err)
			}
			continue
		}
		units = append(units, unit)
	}

	i.log.Info("import completed", "units", len(units))
	return units, nil
}

func (i *usydImporter) unitCodes(ctx context.Context, token string, firstResult int) ([]string, error) {
	payload := map[string]any{
		"q":               strconv.Itoa(time.Now().Year()),
		"firstResult":     firstResult,
		"numberOfResults": 10000,
		"fieldsToInclude": []string{},
	}
	header := http.Header{"Authorization": {"Bearer " + token}}

	var res struct {
		Results []struct {
			URI      any `json:"uri"`
			ClickURI any `json:"clickUri"`
		} `json:"results"`
	}
	if err := importer.PostJSON(ctx, coveoAPIURL, header, payload, &res); err != nil {
		return nil, fmt.Errorf("fetch Sydney unit codes from Coveo (is USYD_BEARER_TOKEN still valid?): %w", err)
	}

	var codes []string
	for _, r := range res.Results {
		uri, _ := r.URI.(string)
		if uri == "" {
			uri, _ = r.ClickURI.(string)
		}
		m := unitURIRe.FindStringSubmatch(uri)
		if m != nil && !slices.Contains(codes, m[1]) {
			codes = append(codes, m[1])
		}
	}
	return codes, nil
}

func (i *usydImporter) unitDetails(ctx context.Context, code string) (importer.Unit, error) {
	doc, err := importer.GetHTML(ctx, unitsBaseURL+code, nil)
	if err != nil {
		return importer.Unit{}, err
	}

	// Titles look like "CODE: Name". Like the original, take only the text
	// between the first and second colons.
	pageTitle := strings.TrimSpace(doc.Find("h1.pageTitle").Text())
	name := pageTitle
	if parts := strings.Split(pageTitle, ":"); len(parts) > 1 {
		name = strings.TrimSpace(parts[1])
	}

	creditPoints := 0
	level := "NA"
	doc.Find("table.table-striped.table-bordered tr").Each(func(_ int, row *goquery.Selection) {
		header := strings.TrimSpace(row.Find("th").Text())
		value := strings.TrimSpace(row.Find("td").Text())
		switch header {
		case "Credit points":
			creditPoints, _ = importer.ParseInt(value)
		case "Study level":
			level = value
		}
	})

	faculty := strings.TrimSpace(doc.Find("h4.b-title--first.fw-normal").Text())
	if faculty == "" {
		faculty = "NA"
	}

	offerings := []importer.Offering{}
	doc.Find("#current-year tbody tr, #future-year tbody tr").Each(func(_ int, row *goquery.Selection) {
		cells := row.Find("td")
		if cells.Length() < 3 {
			return
		}
		// Only the first child node holds the session; later nodes are notes.
		session := strings.TrimSpace(cells.Eq(0).Contents().First().Text())
		location := strings.TrimSpace(cells.Eq(2).Text())
		if session != "" && location != "" {
			offerings = append(offerings, importer.Offering{Location: location, Period: session})
		}
	})

	i.log.Debug("fetched unit", "code", code, "name", name)
	return importer.Unit{
		Code:         code,
		Name:         name,
		Level:        level,
		CreditPoints: creditPoints,
		FacultyName:  faculty,
		Offerings:    offerings,
	}, nil
}
