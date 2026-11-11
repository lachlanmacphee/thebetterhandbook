-- name: UpsertFaculty :one
INSERT INTO faculties (name, university_id) VALUES (?, ?)
ON CONFLICT (name, university_id) DO UPDATE SET name = excluded.name
RETURNING id;

-- name: UpsertCampus :one
INSERT INTO campuses (name, university_id) VALUES (?, ?)
ON CONFLICT (name, university_id) DO UPDATE SET name = excluded.name
RETURNING id;

-- name: UpsertSemester :one
INSERT INTO semesters (name, university_id) VALUES (?, ?)
ON CONFLICT (name, university_id) DO UPDATE SET name = excluded.name
RETURNING id;

-- name: UpsertUnit :one
INSERT INTO units (code, name, level, credit_points, faculty_id, university_id)
VALUES (?, ?, ?, ?, ?, ?)
ON CONFLICT (university_id, code) DO UPDATE SET
    name = excluded.name,
    level = excluded.level,
    credit_points = excluded.credit_points,
    faculty_id = excluded.faculty_id
RETURNING id;

-- name: DeleteUnitCampuses :exec
DELETE FROM unit_campuses WHERE unit_id = ?;

-- name: DeleteUnitSemesters :exec
DELETE FROM unit_semesters WHERE unit_id = ?;

-- name: InsertUnitCampus :exec
INSERT OR IGNORE INTO unit_campuses (unit_id, campus_id) VALUES (?, ?);

-- name: InsertUnitSemester :exec
INSERT OR IGNORE INTO unit_semesters (unit_id, semester_id) VALUES (?, ?);
