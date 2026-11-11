-- name: ListUniversities :many
SELECT * FROM universities ORDER BY name;

-- name: GetUniversityBySlug :one
SELECT * FROM universities WHERE slug = ?;

-- name: GetUniversityByID :one
SELECT * FROM universities WHERE id = ?;

-- name: UpsertUniversity :one
INSERT INTO universities (name, slug, handbook_url)
VALUES (?, ?, ?)
ON CONFLICT (name) DO UPDATE SET slug = excluded.slug, handbook_url = excluded.handbook_url
RETURNING id;
