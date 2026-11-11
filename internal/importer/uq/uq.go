// Package uq imports units (courses) from the University of Queensland.
//
// Data is scraped from a single HTML page: the programs-courses.uq.edu.au
// course search with a blank keyword, which lists every course along with its
// level, units and offerings table. Faculty is not listed and is recorded as
// "NA".
package uq

import (
	"context"
	"fmt"
	"log/slog"
	"strings"

	"github.com/PuerkitoBio/goquery"
	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
)

const searchURL = "https://programs-courses.uq.edu.au/search.html?keywords=+&searchType=course"

type uqImporter struct {
	log *slog.Logger
}

// New returns the University of Queensland importer.
func New(log *slog.Logger) importer.Importer {
	return &uqImporter{log: log}
}

func (i *uqImporter) University() importer.University {
	return importer.University{
		Name:        "University of Queensland",
		Slug:        "university-of-queensland",
		HandbookURL: "https://programs-courses.uq.edu.au/course.html?course_code=",
	}
}

func (i *uqImporter) Units(ctx context.Context) ([]importer.Unit, error) {
	doc, err := importer.GetHTML(ctx, searchURL, nil)
	if err != nil {
		return nil, fmt.Errorf("fetch UQ course search: %w", err)
	}

	var units []importer.Unit
	doc.Find("ul.listing > li").Each(func(_ int, li *goquery.Selection) {
		code := strings.TrimSpace(li.Find("a.code").Text())
		name := strings.TrimSpace(li.Find("a.title").Text())
		level := strings.TrimSpace(li.Find(".course-level").Text())
		creditPoints, _ := importer.ParseInt(strings.TrimSpace(li.Find(".course-units").Text()))

		offerings := []importer.Offering{}
		li.Find("table tbody tr").Each(func(_ int, row *goquery.Selection) {
			cells := row.Find("td")
			if cells.Length() < 3 {
				return
			}
			period := strings.TrimSpace(cells.Eq(0).Text())
			location := strings.TrimSpace(cells.Eq(1).Text())
			if period != "" && location != "" && !strings.Contains(period, "View all") {
				offerings = append(offerings, importer.Offering{Location: location, Period: period})
			}
		})

		if code != "" && name != "" {
			units = append(units, importer.Unit{
				Code:         code,
				Name:         name,
				Level:        level,
				CreditPoints: creditPoints,
				FacultyName:  "NA",
				Offerings:    offerings,
			})
		}
	})

	i.log.Info("extracted units", "count", len(units))
	return units, nil
}
