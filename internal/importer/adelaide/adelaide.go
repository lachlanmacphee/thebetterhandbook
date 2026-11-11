// Package adelaide imports units from the University of Adelaide.
//
// Data comes from the Course Planner query API
// (courseplanner-api.adelaide.edu.au), which returns one row per course
// offering. Rows are grouped by "SUBJECT CATALOG_NBR" so each unit carries all
// of its offerings. Level and faculty are not available and are recorded as
// "NA".
package adelaide

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
)

const (
	apiBaseURL = "https://courseplanner-api.adelaide.edu.au/api/course-planner-query/v1/"
	// The year is hard-coded, matching the original TypeScript importer.
	apiQueryParams = "?target=/system/COURSE_SEARCH/queryx&virtual=Y&year=2025&course_title=&pagenbr=1&pagesize=10000"
)

type apiResponse struct {
	Status string `json:"status"`
	Data   struct {
		Query struct {
			TotalRows float64   `json:"total_rows"`
			NumRows   float64   `json:"num_rows"`
			QueryName string    `json:"queryname"`
			Rows      []apiUnit `json:"rows"`
		} `json:"query"`
	} `json:"data"`
}

type apiUnit struct {
	CourseID    string  `json:"COURSE_ID"`
	Term        string  `json:"TERM"`
	TermDescr   string  `json:"TERM_DESCR"`
	Subject     string  `json:"SUBJECT"`
	CatalogNbr  string  `json:"CATALOG_NBR"`
	AcadCareer  string  `json:"ACAD_CAREER"`
	CourseTitle string  `json:"COURSE_TITLE"`
	Units       float64 `json:"UNITS"`
	Campus      string  `json:"CAMPUS"`
}

type adelaideImporter struct {
	log *slog.Logger
}

// New returns the University of Adelaide importer.
func New(log *slog.Logger) importer.Importer {
	return &adelaideImporter{log: log}
}

func (i *adelaideImporter) University() importer.University {
	return importer.University{
		Name:        "University of Adelaide",
		Slug:        "university-of-adelaide",
		HandbookURL: "https://www.adelaide.edu.au/course-outlines/",
	}
}

func (i *adelaideImporter) Units(ctx context.Context) ([]importer.Unit, error) {
	var res apiResponse
	header := http.Header{"Content-Type": {"application/json"}}
	if err := importer.GetJSON(ctx, apiBaseURL+apiQueryParams, header, &res); err != nil {
		return nil, fmt.Errorf("fetch Adelaide courses: %w", err)
	}

	// Group rows by course code, since the same course appears once per
	// offering. Keep first-seen order.
	var order []string
	groups := make(map[string][]apiUnit)
	for _, row := range res.Data.Query.Rows {
		code := row.Subject + " " + row.CatalogNbr
		if _, ok := groups[code]; !ok {
			order = append(order, code)
		}
		groups[code] = append(groups[code], row)
	}

	units := make([]importer.Unit, 0, len(order))
	for _, code := range order {
		rows := groups[code]
		first := rows[0]
		offerings := make([]importer.Offering, 0, len(rows))
		for _, r := range rows {
			offerings = append(offerings, importer.Offering{
				Location: strings.TrimSpace(r.Campus),
				Period:   strings.TrimSpace(r.TermDescr),
			})
		}
		units = append(units, importer.Unit{
			Code:         code,
			Name:         strings.TrimSpace(first.CourseTitle),
			Level:        "NA",
			CreditPoints: int(first.Units),
			FacultyName:  "NA",
			Offerings:    offerings,
		})
	}

	i.log.Info("extracted units", "count", len(units))
	return units, nil
}
