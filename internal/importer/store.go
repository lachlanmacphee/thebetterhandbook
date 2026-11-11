package importer

import (
	"context"
	"database/sql"
	"fmt"
	"log/slog"
	"strings"

	"github.com/lachlanmacphee/thebetterhandbook/internal/db"
)

// Run fetches every unit for one university and saves them.
func Run(ctx context.Context, conn *sql.DB, imp Importer, log *slog.Logger) error {
	uni := imp.University()
	log.Info("starting import", "name", uni.Name)

	units, err := imp.Units(ctx)
	if err != nil {
		return fmt.Errorf("fetch units for %s: %w", uni.Name, err)
	}
	log.Info("fetched units", "count", len(units))

	if err := Save(ctx, conn, uni, units, log); err != nil {
		return fmt.Errorf("save units for %s: %w", uni.Name, err)
	}
	log.Info("import complete")
	return nil
}

// Save upserts a university and its units in a single transaction.
//
// Faculties, campuses and semesters are created as needed. Each unit's campus
// and semester links are replaced so offerings removed from the handbook
// disappear here too. Existing units are never deleted, because reviews
// reference them.
func Save(ctx context.Context, conn *sql.DB, uni University, units []Unit, log *slog.Logger) error {
	return db.WithTx(ctx, conn, func(q *db.Queries) error {
		uniID, err := q.UpsertUniversity(ctx, db.UpsertUniversityParams{
			Name:        uni.Name,
			Slug:        uni.Slug,
			HandbookUrl: sql.NullString{String: uni.HandbookURL, Valid: uni.HandbookURL != ""},
		})
		if err != nil {
			return fmt.Errorf("upsert university: %w", err)
		}

		faculties := map[string]int64{}
		campuses := map[string]int64{}
		semesters := map[string]int64{}

		lookup := func(cache map[string]int64, name string, upsert func() (int64, error)) (int64, error) {
			if id, ok := cache[name]; ok {
				return id, nil
			}
			id, err := upsert()
			if err != nil {
				return 0, err
			}
			cache[name] = id
			return id, nil
		}

		saved := 0
		for _, unit := range units {
			code := strings.TrimSpace(unit.Code)
			name := strings.TrimSpace(unit.Name)
			if code == "" || name == "" {
				log.Warn("skipping unit with missing code or name", "unit", unit)
				continue
			}

			facultyID, err := lookup(faculties, unit.FacultyName, func() (int64, error) {
				return q.UpsertFaculty(ctx, db.UpsertFacultyParams{Name: unit.FacultyName, UniversityID: uniID})
			})
			if err != nil {
				return fmt.Errorf("upsert faculty %q: %w", unit.FacultyName, err)
			}

			unitID, err := q.UpsertUnit(ctx, db.UpsertUnitParams{
				Code:         code,
				Name:         name,
				Level:        unit.Level,
				CreditPoints: int64(unit.CreditPoints),
				FacultyID:    facultyID,
				UniversityID: uniID,
			})
			if err != nil {
				return fmt.Errorf("upsert unit %s: %w", code, err)
			}

			if err := q.DeleteUnitCampuses(ctx, unitID); err != nil {
				return err
			}
			if err := q.DeleteUnitSemesters(ctx, unitID); err != nil {
				return err
			}

			for _, o := range unit.Offerings {
				campusID, err := lookup(campuses, o.Location, func() (int64, error) {
					return q.UpsertCampus(ctx, db.UpsertCampusParams{Name: o.Location, UniversityID: uniID})
				})
				if err != nil {
					return fmt.Errorf("upsert campus %q: %w", o.Location, err)
				}
				semesterID, err := lookup(semesters, o.Period, func() (int64, error) {
					return q.UpsertSemester(ctx, db.UpsertSemesterParams{Name: o.Period, UniversityID: uniID})
				})
				if err != nil {
					return fmt.Errorf("upsert semester %q: %w", o.Period, err)
				}
				if err := q.InsertUnitCampus(ctx, db.InsertUnitCampusParams{UnitID: unitID, CampusID: campusID}); err != nil {
					return err
				}
				if err := q.InsertUnitSemester(ctx, db.InsertUnitSemesterParams{UnitID: unitID, SemesterID: semesterID}); err != nil {
					return err
				}
			}
			saved++
		}

		log.Info("saved units", "count", saved)
		return nil
	})
}
