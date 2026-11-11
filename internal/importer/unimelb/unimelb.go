// Package unimelb imports units (subjects) from the University of Melbourne.
//
// Data comes from the Course Planner API (course-planner.unimelb.edu.au). The
// plan creation config lists every course; subjects are then fetched one
// course at a time, filtered to that course's discipline subjects for the
// current year. Requests are sent with a fixed anonymous x-user-id header.
package unimelb

import (
	"context"
	"fmt"
	"log/slog"
	"net/http"
	"strconv"
	"time"

	"github.com/lachlanmacphee/thebetterhandbook/internal/importer"
)

const (
	apiBaseURL      = "https://course-planner.unimelb.edu.au/apis/v1"
	subjectURL      = apiBaseURL + "/subject"
	planCreationURL = apiBaseURL + "/planCreationConfig"
	userID          = "910cb597-680c-4da6-b7b4-ed32b620ad33"
)

type course struct {
	Code string `json:"code"`
	Name string `json:"name"`
}

type subject struct {
	ID          string  `json:"id"`
	Code        string  `json:"code"`
	Name        string  `json:"name"`
	Points      float64 `json:"points"`
	Level       string  `json:"level"`
	AreaOfStudy []struct {
		Area        string `json:"area"`
		Description string `json:"description"`
	} `json:"areaOfStudy"`
	Availability []struct {
		Campus      string `json:"campus"`
		StudyPeriod string `json:"studyPeriod"`
	} `json:"availability"`
}

type unimelbImporter struct {
	log *slog.Logger
}

// New returns the University of Melbourne importer.
func New(log *slog.Logger) importer.Importer {
	return &unimelbImporter{log: log}
}

func (i *unimelbImporter) University() importer.University {
	return importer.University{
		Name:        "University of Melbourne",
		Slug:        "university-of-melbourne",
		HandbookURL: "https://handbook.unimelb.edu.au/subjects/",
	}
}

// subjectQuery builds the (pre-encoded) query string for the subjects of one
// course, exactly as the Course Planner front end sends it.
func subjectQuery(year int, courseCode string) string {
	y := strconv.Itoa(year)
	return "?year=" + y +
		"&query={%22text%22:%22%22,%22level%22:[],%22studyPeriod%22:[],%22areaOfStudy%22:[],%22courseRecordIds%22:[],%22onlyBreadth%22:false,%22onlyDiscipline%22:true,%22satisfyRequisites%22:false,%22points%22:[%226.25%22,%2212.5%22,%2218.75%22,%2225%22],%22courseCodes%22:[%22" +
		courseCode +
		"%22],%22courseEffectiveYear%22:" + y +
		"}&sort={%22code%22:%22ASC%22}&paging={%22page%22:0,%22pageSize%22:2000}"
}

func (i *unimelbImporter) Units(ctx context.Context) ([]importer.Unit, error) {
	header := http.Header{"x-user-id": {userID}}
	year := time.Now().Year()

	var config struct {
		Courses []course `json:"courses"`
	}
	if err := importer.GetJSON(ctx, planCreationURL, header, &config); err != nil {
		return nil, fmt.Errorf("fetch Melbourne plan creation config: %w", err)
	}
	i.log.Info("found courses to process", "count", len(config.Courses))

	var units []importer.Unit
	for _, c := range config.Courses {
		var res struct {
			Results []subject `json:"results"`
		}
		if err := importer.GetJSON(ctx, subjectURL+subjectQuery(year, c.Code), header, &res); err != nil {
			if ctx.Err() != nil {
				return nil, ctx.Err()
			}
			i.log.Error("couldn't read subjects for course", "code", c.Code, "name", c.Name, "err", err)
			continue
		}

		for _, s := range res.Results {
			level := s.Level
			if level == "" {
				level = "NA"
			}
			faculty := "Unknown"
			if len(s.AreaOfStudy) > 0 {
				faculty = s.AreaOfStudy[0].Description
			}
			offerings := make([]importer.Offering, 0, len(s.Availability))
			for _, a := range s.Availability {
				offerings = append(offerings, importer.Offering{Location: a.Campus, Period: a.StudyPeriod})
			}
			units = append(units, importer.Unit{
				Code: s.Code,
				Name: s.Name,
				// Points can be fractional (e.g. 12.5); truncate like parseInt.
				CreditPoints: int(s.Points),
				Level:        level,
				FacultyName:  faculty,
				Offerings:    offerings,
			})
		}

		i.log.Info("found units for course", "count", len(res.Results), "code", c.Code, "name", c.Name)
	}

	i.log.Info("import completed", "units", len(units))
	return units, nil
}
