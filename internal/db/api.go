package db

import (
	"context"
	"database/sql"
	_ "embed"
)

var (
	//go:embed api/units.sql
	apiUnitsSQL string
	//go:embed api/universities.sql
	apiUniversitiesSQL string
)

// APIUnitsParams filters the /api/units listing. Nil pointers mean "no filter".
type APIUnitsParams struct {
	University   *string // university slug
	Code         *string
	Name         *string
	FacultyID    *int64
	Level        *string
	CreditPoints *int64
	CampusID     *int64
	SemesterID   *int64
	Sort         string // code | name | rating | reviews
	Page         int64
	PageSize     int64
}

// APIUnits returns the complete JSON response body for /api/units, built
// entirely by SQLite.
func APIUnits(ctx context.Context, conn *sql.DB, p APIUnitsParams) ([]byte, error) {
	var body []byte
	err := conn.QueryRowContext(ctx, apiUnitsSQL,
		sql.Named("university", p.University),
		sql.Named("code", p.Code),
		sql.Named("name", p.Name),
		sql.Named("faculty_id", p.FacultyID),
		sql.Named("level", p.Level),
		sql.Named("credit_points", p.CreditPoints),
		sql.Named("campus_id", p.CampusID),
		sql.Named("semester_id", p.SemesterID),
		sql.Named("sort", p.Sort),
		sql.Named("page", p.Page),
		sql.Named("page_size", p.PageSize),
	).Scan(&body)
	return body, err
}

// APIUniversitiesParams filters the /api/universities listing.
type APIUniversitiesParams struct {
	Name     *string
	Sort     string // name | unitCount
	Page     int64
	PageSize int64
}

// APIUniversities returns the complete JSON response body for
// /api/universities, built entirely by SQLite.
func APIUniversities(ctx context.Context, conn *sql.DB, p APIUniversitiesParams) ([]byte, error) {
	var body []byte
	err := conn.QueryRowContext(ctx, apiUniversitiesSQL,
		sql.Named("name", p.Name),
		sql.Named("sort", p.Sort),
		sql.Named("page", p.Page),
		sql.Named("page_size", p.PageSize),
	).Scan(&body)
	return body, err
}
