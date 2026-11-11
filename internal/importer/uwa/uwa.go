// Package uwa imports units from the University of Western Australia.
//
// Data is scraped from a single HTML page: the handbooks.uwa.edu.au unit
// search with blank search text, which lists every unit with a definition
// list of credit points, level(s), school, location(s) and availability.
// Offerings are every combination of location and availability.
package uwa

import (
	"context"
	"fmt"
	"log/slog"
	"regexp"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
)

const searchURL = "https://www.handbooks.uwa.edu.au/search/?type=units&searchtext="

// headingRe matches the unit heading, formatted "Name [CODE]".
var headingRe = regexp.MustCompile(`^(.+?)\s*\[([^\]]+)\]$`)

type uwaImporter struct {
	log *slog.Logger
}

// New returns the University of Western Australia importer.
func New(log *slog.Logger) importer.Importer {
	return &uwaImporter{log: log}
}

func (i *uwaImporter) University() importer.University {
	return importer.University{
		Name:        "University of Western Australia",
		Slug:        "university-of-western-australia",
		HandbookURL: "https://www.handbooks.uwa.edu.au/unitdetails?code=",
	}
}

// dt returns the <dt> elements within s whose text contains label, like
// jQuery's dt:contains('label').
func dt(s *goquery.Selection, label string) *goquery.Selection {
	return s.Find("dt").FilterFunction(func(_ int, d *goquery.Selection) bool {
		return strings.Contains(d.Text(), label)
	})
}

// ddTexts returns the non-empty trimmed text of every <dd> following the
// labelled <dt>, up to the next <dt>.
func ddTexts(s *goquery.Selection, label string) []string {
	var out []string
	dt(s, label).NextUntil("dt").Each(func(_ int, dd *goquery.Selection) {
		if t := strings.TrimSpace(dd.Text()); t != "" {
			out = append(out, t)
		}
	})
	return out
}

func (i *uwaImporter) Units(ctx context.Context) ([]importer.Unit, error) {
	doc, err := importer.GetHTML(ctx, searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("fetch UWA unit search: %w", err)
	}

	var units []importer.Unit
	doc.Find("#filter-target > li.filter-item").Each(func(_ int, li *goquery.Selection) {
		m := headingRe.FindStringSubmatch(strings.TrimSpace(li.Find("h4").Text()))
		if m == nil {
			return
		}
		name := strings.TrimSpace(m[1])
		code := strings.TrimSpace(m[2])

		creditPoints, _ := importer.ParseInt(strings.TrimSpace(
			dt(li, "Credit points:").NextFiltered("dd").Text()))

		level := strings.Join(ddTexts(li, "Level of study:"), ", ")

		faculty := strings.TrimSpace(dt(li, "School:").NextFiltered("dd").Text())
		if faculty == "" {
			faculty = "NA"
		}

		locations := ddTexts(li, "Location:")
		periods := ddTexts(li, "Availability:")
		offerings := make([]importer.Offering, 0, len(locations)*len(periods))
		for _, location := range locations {
			for _, period := range periods {
				offerings = append(offerings, importer.Offering{Location: location, Period: period})
			}
		}

		if code != "" && name != "" {
			units = append(units, importer.Unit{
				Code:         code,
				Name:         name,
				Level:        level,
				CreditPoints: creditPoints,
				FacultyName:  faculty,
				Offerings:    offerings,
			})
		}
	})

	i.log.Info("extracted units", "count", len(units))
	return units, nil
}
