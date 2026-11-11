// Package anu imports units from the Australian National University.
//
// Data comes from the JSON course search API behind
// programsandcourses.anu.edu.au, which returns every course in one response
// when PageSize=Infinity. ANU does not expose a level or faculty in this
// listing, so both are recorded as "NA".
package anu

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strings"

	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
)

const (
	apiBaseURL     = "https://programsandcourses.anu.edu.au/data/CourseSearch/GetCourses"
	apiQueryParams = "?ShowAll=true&PageIndex=0&MaxPageSize=10&PageSize=Infinity"
)

type apiUnit struct {
	CourseCode     string  `json:"CourseCode"`
	Name           string  `json:"Name"`
	Session        string  `json:"Session"`
	Career         string  `json:"Career"`
	Units          float64 `json:"Units"`
	ModeOfDelivery string  `json:"ModeOfDelivery"`
	Year           float64 `json:"Year"`
}

type apiResponse struct {
	Items []apiUnit `json:"Items"`
}

type anuImporter struct {
	log *slog.Logger
}

// New returns the ANU importer.
func New(log *slog.Logger) importer.Importer {
	return &anuImporter{log: log}
}

func (i *anuImporter) University() importer.University {
	return importer.University{
		Name:        "Australian National University",
		Slug:        "australian-national-university",
		HandbookURL: "https://programsandcourses.anu.edu.au/course/",
	}
}

func (i *anuImporter) Units(ctx context.Context) ([]importer.Unit, error) {
	var res apiResponse
	header := http.Header{"Content-Type": {"application/json"}}
	if err := importer.GetJSON(ctx, apiBaseURL+apiQueryParams, header, &res); err != nil {
		return nil, fmt.Errorf("fetch ANU courses: %w", err)
	}

	units := make([]importer.Unit, 0, len(res.Items))
	for _, u := range res.Items {
		sessions := strings.Split(u.Session, "/")
		offerings := make([]importer.Offering, 0, len(sessions))
		for _, session := range sessions {
			offerings = append(offerings, importer.Offering{
				Location: strings.TrimSpace(u.ModeOfDelivery),
				Period:   strings.TrimSpace(session),
			})
		}
		units = append(units, importer.Unit{
			Code:         u.CourseCode,
			Name:         strings.TrimSpace(u.Name),
			Level:        "NA",
			CreditPoints: int(u.Units),
			FacultyName:  "NA",
			Offerings:    offerings,
		})
	}

	i.log.Info("extracted units", "count", len(units))
	return units, nil
}
