-- name: PopularUnits :many
SELECT
    u.id, u.code, u.name,
    (SELECT count(*) FROM reviews r WHERE r.unit_id = u.id) AS review_count,
    CAST(coalesce((
        SELECT group_concat(x.name, ', ') FROM (
            SELECT c.name FROM unit_campuses uc JOIN campuses c ON c.id = uc.campus_id
            WHERE uc.unit_id = u.id ORDER BY c.name) x), '') AS TEXT) AS campuses,
    CAST(coalesce((
        SELECT group_concat(x.name, ', ') FROM (
            SELECT s.name FROM unit_semesters us JOIN semesters s ON s.id = us.semester_id
            WHERE us.unit_id = u.id ORDER BY s.name) x), '') AS TEXT) AS semesters,
    CAST(EXISTS (
        SELECT 1 FROM reviews r WHERE r.unit_id = u.id AND r.user_id = sqlc.arg(user_id)
    ) AS BOOLEAN) AS has_reviewed
FROM units u
WHERE u.university_id = sqlc.arg(university_id)
ORDER BY review_count DESC, u.code
LIMIT 6;

-- name: SearchUnits :many
SELECT
    u.id, u.code, u.name, u.level, u.credit_points,
    (SELECT count(*) FROM reviews r WHERE r.unit_id = u.id) AS review_count,
    CAST(coalesce((SELECT avg(r.overall_rating) FROM reviews r WHERE r.unit_id = u.id), 0) AS REAL) AS avg_rating,
    CAST(coalesce((
        SELECT group_concat(x.name, ', ') FROM (
            SELECT c.name FROM unit_campuses uc JOIN campuses c ON c.id = uc.campus_id
            WHERE uc.unit_id = u.id ORDER BY c.name) x), '') AS TEXT) AS campuses,
    CAST(coalesce((
        SELECT group_concat(x.name, ', ') FROM (
            SELECT s.name FROM unit_semesters us JOIN semesters s ON s.id = us.semester_id
            WHERE us.unit_id = u.id ORDER BY s.name) x), '') AS TEXT) AS semesters
FROM units u, (SELECT CAST(sqlc.arg(sort) AS TEXT) AS sort) p
WHERE u.university_id = sqlc.arg(university_id)
    AND (sqlc.narg(code) IS NULL OR instr(u.code, upper(sqlc.narg(code))) > 0)
    AND (sqlc.narg(name) IS NULL OR instr(lower(u.name), lower(sqlc.narg(name))) > 0)
    AND (sqlc.narg(faculty_id) IS NULL OR u.faculty_id = sqlc.narg(faculty_id))
    AND (sqlc.narg(level) IS NULL OR u.level = sqlc.narg(level))
    AND (sqlc.narg(credit_points) IS NULL OR u.credit_points = sqlc.narg(credit_points))
    AND (sqlc.narg(campus_id) IS NULL OR EXISTS (
        SELECT 1 FROM unit_campuses uc WHERE uc.unit_id = u.id AND uc.campus_id = sqlc.narg(campus_id)))
    AND (sqlc.narg(semester_id) IS NULL OR EXISTS (
        SELECT 1 FROM unit_semesters us WHERE us.unit_id = u.id AND us.semester_id = sqlc.narg(semester_id)))
ORDER BY
    CASE WHEN p.sort = 'rating' THEN avg_rating END DESC,
    CASE WHEN p.sort = 'reviews' THEN review_count END DESC,
    CASE WHEN p.sort = 'name' THEN u.name END,
    u.code
LIMIT sqlc.arg(limit) OFFSET sqlc.arg(offset);

-- name: CountUnits :one
SELECT count(*)
FROM units u
WHERE u.university_id = sqlc.arg(university_id)
    AND (sqlc.narg(code) IS NULL OR instr(u.code, upper(sqlc.narg(code))) > 0)
    AND (sqlc.narg(name) IS NULL OR instr(lower(u.name), lower(sqlc.narg(name))) > 0)
    AND (sqlc.narg(faculty_id) IS NULL OR u.faculty_id = sqlc.narg(faculty_id))
    AND (sqlc.narg(level) IS NULL OR u.level = sqlc.narg(level))
    AND (sqlc.narg(credit_points) IS NULL OR u.credit_points = sqlc.narg(credit_points))
    AND (sqlc.narg(campus_id) IS NULL OR EXISTS (
        SELECT 1 FROM unit_campuses uc WHERE uc.unit_id = u.id AND uc.campus_id = sqlc.narg(campus_id)))
    AND (sqlc.narg(semester_id) IS NULL OR EXISTS (
        SELECT 1 FROM unit_semesters us WHERE us.unit_id = u.id AND us.semester_id = sqlc.narg(semester_id)));

-- name: ListFaculties :many
SELECT * FROM faculties WHERE university_id = ? AND trim(name) != '' ORDER BY name;

-- name: ListCampuses :many
SELECT * FROM campuses WHERE university_id = ? AND trim(name) != '' ORDER BY name;

-- name: ListSemesters :many
SELECT * FROM semesters WHERE university_id = ? AND trim(name) != '' ORDER BY name;

-- name: ListLevels :many
SELECT DISTINCT level FROM units WHERE university_id = ? ORDER BY level;

-- name: ListCreditPoints :many
SELECT DISTINCT credit_points FROM units WHERE university_id = ? ORDER BY credit_points;

-- name: GetUnit :one
SELECT
    u.*,
    (SELECT count(*) FROM reviews r WHERE r.unit_id = u.id) AS review_count,
    CAST(coalesce((SELECT avg(r.overall_rating) FROM reviews r WHERE r.unit_id = u.id), 0) AS REAL) AS overall_rating,
    CAST(coalesce((SELECT avg(r.teaching_rating) FROM reviews r WHERE r.unit_id = u.id), 0) AS REAL) AS teaching_rating,
    CAST(coalesce((SELECT avg(r.content_rating) FROM reviews r WHERE r.unit_id = u.id), 0) AS REAL) AS content_rating,
    CAST(coalesce((SELECT avg(r.difficulty_rating) FROM reviews r WHERE r.unit_id = u.id), 0) AS REAL) AS difficulty_rating,
    CAST(coalesce((SELECT avg(r.workload_rating) FROM reviews r WHERE r.unit_id = u.id), 0) AS REAL) AS workload_rating
FROM units u
WHERE u.university_id = sqlc.arg(university_id) AND u.code = sqlc.arg(code);

-- name: ListUnitCampuses :many
SELECT c.name FROM unit_campuses uc JOIN campuses c ON c.id = uc.campus_id
WHERE uc.unit_id = ? ORDER BY c.name;

-- name: ListUnitSemesters :many
SELECT s.name FROM unit_semesters us JOIN semesters s ON s.id = us.semester_id
WHERE us.unit_id = ? ORDER BY s.name;

-- name: MarkUnitDeprecated :exec
UPDATE units SET is_deprecated = TRUE WHERE id = ?;
