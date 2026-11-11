// Package unsw imports units from the University of New South Wales.
//
// Data comes from the public course outlines search API
// (courseoutlines.unsw.edu.au) for the current year, which returns one result
// per course outline (i.e. per course/term/location). Level is not available
// and is recorded as "NA".
package unsw

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
)

const apiBaseURL = "https://courseoutlines.unsw.edu.au/v1/publicsitecourseoutlines/search"

type apiUnit struct {
	TeachingPeriod     string `json:"integrat_teachingperiod"`
	CourseCode         string `json:"integrat_coursecode"`
	Location           string `json:"integrat_location"`
	Term               string `json:"integrat_term"`
	UnitsOfCredit      any    `json:"integrat_unitsofcredit"` // usually a string
	CourseName         string `json:"integrat_coursename"`
	OwningAcademicUnit string `json:"integrat_owningacademicunit"`
}

type apiResponse struct {
	Response struct {
		Results []apiUnit `json:"results"`
	} `json:"response"`
}

type unswImporter struct {
	log *slog.Logger
}

// New returns the UNSW importer.
func New(log *slog.Logger) importer.Importer {
	return &unswImporter{log: log}
}

func (i *unswImporter) University() importer.University {
	return importer.University{
		Name:        "University of New South Wales",
		Slug:        "university-of-new-south-wales",
		HandbookURL: "https://www.handbook.unsw.edu.au/undergraduate/courses/" + strconv.Itoa(time.Now().Year()) + "/",
	}
}

func (i *unswImporter) Units(ctx context.Context) ([]importer.Unit, error) {
	url := apiBaseURL + "?pageNumber=1&top=10000&year=" + strconv.Itoa(time.Now().Year())

	var res apiResponse
	header := http.Header{"Content-Type": {"application/json"}}
	if err := importer.GetJSON(ctx, url, header, &res); err != nil {
		return nil, fmt.Errorf("fetch UNSW course outlines: %w", err)
	}

	units := make([]importer.Unit, 0, len(res.Response.Results))
	for _, u := range res.Response.Results {
		// The TypeScript importer stored NaN here, which the seed script
		// turned into -1, so keep that sentinel for unparseable values.
		var uoc string
		if u.UnitsOfCredit != nil {
			uoc = fmt.Sprint(u.UnitsOfCredit)
		}
		creditPoints, ok := importer.ParseInt(uoc)
		if !ok {
			creditPoints = -1
		}
		units = append(units, importer.Unit{
			Code:         u.CourseCode,
			Name:         strings.TrimSpace(u.CourseName),
			Level:        "NA",
			CreditPoints: creditPoints,
			FacultyName:  u.OwningAcademicUnit,
			Offerings: []importer.Offering{{
				Location: strings.TrimSpace(u.Location),
				Period:   strings.TrimSpace(u.Term),
			}},
		})
	}

	i.log.Info("extracted units", "count", len(units))
	return units, nil
}
