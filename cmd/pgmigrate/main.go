// Command pgmigrate copies the old Prisma/Postgres database into SQLite.
//
// It is a one-off tool for the move to SQLite and can be deleted afterwards.
// IDs are preserved, so old /{id}/... URLs keep redirecting correctly.
//
//	DATABASE_URL=postgres://... go run ./cmd/pgmigrate -sqlite data/tbh.db
package main

import (
	"context"
	"database/sql"
	"flag"
	"fmt"
	"log"
	"os"
	"strings"

	"github.com/jackc/pgx/v5"

	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
)

// Each step selects rows from Postgres in the column order of the SQLite
// insert. Timestamps are formatted as ISO 8601 UTC to match the SQLite schema.
var steps = []struct{ table, pg, sqlite string }{
	{"universities",
		`SELECT id, name, trim(both '-' from lower(regexp_replace(trim(name), '[^A-Za-z0-9]+', '-', 'g'))), "handbookUrl" FROM "University"`,
		`INSERT INTO universities (id, name, slug, handbook_url) VALUES (?, ?, ?, ?)`},
	{"users",
		`SELECT id, email, name, role::text, "apiKey", "preferredUniversityId" FROM "User"`,
		`INSERT INTO users (id, email, name, role, api_key, preferred_university_id) VALUES (?, ?, ?, ?, ?, ?)`},
	{"faculties",
		`SELECT id, name, "universityId" FROM "Faculty"`,
		`INSERT INTO faculties (id, name, university_id) VALUES (?, ?, ?)`},
	{"campuses",
		`SELECT id, name, "universityId" FROM "Campus"`,
		`INSERT INTO campuses (id, name, university_id) VALUES (?, ?, ?)`},
	{"semesters",
		`SELECT id, name, "universityId" FROM "Semester"`,
		`INSERT INTO semesters (id, name, university_id) VALUES (?, ?, ?)`},
	{"units",
		`SELECT id, code, name, level, "creditPoints", "isDeprecated", "facultyId", "universityId" FROM "Unit"`,
		`INSERT INTO units (id, code, name, level, credit_points, is_deprecated, faculty_id, university_id) VALUES (?, ?, ?, ?, ?, ?, ?, ?)`},
	{"unit_campuses",
		`SELECT "unitId", "campusId" FROM "UnitCampus"`,
		`INSERT INTO unit_campuses (unit_id, campus_id) VALUES (?, ?)`},
	{"unit_semesters",
		`SELECT "unitId", "semesterId" FROM "UnitSemester"`,
		`INSERT INTO unit_semesters (unit_id, semester_id) VALUES (?, ?)`},
	{"unit_prerequisites",
		`SELECT "unitId", "prerequisiteId" FROM "UnitPrerequisite"`,
		`INSERT INTO unit_prerequisites (unit_id, prerequisite_id) VALUES (?, ?)`},
	{"unit_corequisites",
		`SELECT "unitId", "corequisiteId" FROM "UnitCorequisite"`,
		`INSERT INTO unit_corequisites (unit_id, corequisite_id) VALUES (?, ?)`},
	{"unit_addition_requests",
		`SELECT id, code, ` + ts(`"createdAt"`) + `, "userId", "universityId" FROM "UnitAdditionRequest"`,
		`INSERT INTO unit_addition_requests (id, code, created_at, user_id, university_id) VALUES (?, ?, ?, ?, ?)`},
	{"unit_deprecations",
		`SELECT id, reason, status::text, ` + ts(`"createdAt"`) + `, "userId", "unitId" FROM "UnitDeprecation"`,
		`INSERT INTO unit_deprecations (id, reason, status, created_at, user_id, unit_id) VALUES (?, ?, ?, ?, ?, ?)`},
	{"unit_suggestions",
		`SELECT id, field, reason, status::text, ` + ts(`"createdAt"`) + `, "userId", "unitId" FROM "UnitSuggestion"`,
		`INSERT INTO unit_suggestions (id, field, reason, status, created_at, user_id, unit_id) VALUES (?, ?, ?, ?, ?, ?, ?)`},
	{"reviews",
		`SELECT id, title, text, "yearCompleted", "overallRating", "teachingRating", "contentRating",
			"difficultyRating", "workloadRating", "requiresAttendance", "isWamBooster", ` + ts(`"createdAt"`) + `,
			"userId", "unitId" FROM "Review"`,
		`INSERT INTO reviews (id, title, text, year_completed, overall_rating, teaching_rating, content_rating,
			difficulty_rating, workload_rating, requires_attendance, is_wam_booster, created_at, user_id, unit_id)
			VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`},
	{"review_reactions",
		`SELECT id, "isLike", ` + ts(`"createdAt"`) + `, "reviewId", "userId" FROM "ReviewReaction"`,
		`INSERT INTO review_reactions (id, is_like, created_at, review_id, user_id) VALUES (?, ?, ?, ?, ?)`},
}

// ts formats a Prisma timestamp (stored as UTC) like the SQLite defaults.
func ts(col string) string {
	return `to_char(` + col + `, 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')`
}

func main() {
	pgURL := flag.String("pg", os.Getenv("DATABASE_URL"), "Postgres connection URL (default $DATABASE_URL)")
	sqlitePath := flag.String("sqlite", "data/tbh.db", "SQLite database to create")
	flag.Parse()
	if *pgURL == "" {
		log.Fatal("set -pg or DATABASE_URL")
	}
	if err := run(context.Background(), *pgURL, *sqlitePath); err != nil {
		log.Fatal(err)
	}
}

func run(ctx context.Context, pgURL, sqlitePath string) error {
	pg, err := pgx.Connect(ctx, pgURL)
	if err != nil {
		return fmt.Errorf("connect to postgres: %w", err)
	}
	defer pg.Close(ctx)
	// Makes to_char correct even if a column turns out to be timestamptz.
	if _, err := pg.Exec(ctx, "SET TIME ZONE 'UTC'"); err != nil {
		return err
	}

	conn, err := db.Open(sqlitePath)
	if err != nil {
		return err
	}
	defer conn.Close()
	if err := db.Migrate(ctx, conn); err != nil {
		return err
	}
	var existing int
	if err := conn.QueryRowContext(ctx, "SELECT count(*) FROM universities").Scan(&existing); err != nil {
		return err
	}
	if existing > 0 {
		return fmt.Errorf("%s already has data; point -sqlite at a new file", sqlitePath)
	}

	tx, err := conn.BeginTx(ctx, nil)
	if err != nil {
		return err
	}
	defer tx.Rollback()

	for _, step := range steps {
		n, err := copyTable(ctx, pg, tx, step.pg, step.sqlite)
		if err != nil {
			return fmt.Errorf("%s: %w", step.table, err)
		}
		log.Printf("%-24s %d rows", step.table, n)
	}

	if err := checkForeignKeys(ctx, tx); err != nil {
		return err
	}
	if err := tx.Commit(); err != nil {
		return err
	}

	rows, err := conn.QueryContext(ctx, "SELECT slug, name FROM universities ORDER BY id")
	if err != nil {
		return err
	}
	defer rows.Close()
	log.Print("university URLs:")
	for rows.Next() {
		var slug, name string
		if err := rows.Scan(&slug, &name); err != nil {
			return err
		}
		log.Printf("  /universities/%s  (%s)", slug, name)
	}
	return rows.Err()
}

func copyTable(ctx context.Context, pg *pgx.Conn, tx *sql.Tx, query, insert string) (int, error) {
	stmt, err := tx.PrepareContext(ctx, insert)
	if err != nil {
		return 0, err
	}
	defer stmt.Close()

	rows, err := pg.Query(ctx, query)
	if err != nil {
		return 0, err
	}
	defer rows.Close()

	n := 0
	for rows.Next() {
		values, err := rows.Values()
		if err != nil {
			return n, err
		}
		if _, err := stmt.ExecContext(ctx, values...); err != nil {
			return n, fmt.Errorf("row %v: %w", values, err)
		}
		n++
	}
	return n, rows.Err()
}

func checkForeignKeys(ctx context.Context, tx *sql.Tx) error {
	rows, err := tx.QueryContext(ctx, "PRAGMA foreign_key_check")
	if err != nil {
		return err
	}
	defer rows.Close()
	var problems []string
	for rows.Next() {
		var table, parent string
		var rowid, fkid sql.NullInt64
		if err := rows.Scan(&table, &rowid, &parent, &fkid); err != nil {
			return err
		}
		problems = append(problems, fmt.Sprintf("%s row %d -> %s", table, rowid.Int64, parent))
	}
	if len(problems) > 0 {
		return fmt.Errorf("foreign key violations:\n%s", strings.Join(problems, "\n"))
	}
	return rows.Err()
}
