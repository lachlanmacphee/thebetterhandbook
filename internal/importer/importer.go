// Package importer defines how unit data is pulled from university handbooks
// and saved into the database. Each university lives in its own subpackage.
package importer

import (
	"context"
	"log/slog"
)

// University describes the university an importer pulls data for.
type University struct {
	// Name is the display name and the unique key used when upserting.
	Name string
	// Slug is used in URLs, e.g. /universities/monash-university.
	Slug string
	// HandbookURL is prefixed to a unit code to link to the official page.
	HandbookURL string
}

// Offering is a single location/teaching period combination for a unit.
type Offering struct {
	Location string
	Period   string
}

// Unit is a unit (subject/course) as scraped from a university handbook.
type Unit struct {
	Code         string
	Name         string
	Level        string
	CreditPoints int
	FacultyName  string
	Offerings    []Offering
}

// Importer fetches every unit for one university.
type Importer interface {
	University() University
	Units(ctx context.Context) ([]Unit, error)
}

// Constructor builds an importer with a logger scoped to that university.
type Constructor func(log *slog.Logger) Importer
