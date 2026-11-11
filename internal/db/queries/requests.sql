-- name: CreateUnitAdditionRequest :exec
INSERT OR IGNORE INTO unit_addition_requests (code, user_id, university_id) VALUES (?, ?, ?);

-- name: GetUnitAdditionRequest :one
SELECT * FROM unit_addition_requests WHERE university_id = ? AND code = ?;

-- name: CreateUnitDeprecation :exec
INSERT INTO unit_deprecations (reason, unit_id, user_id) VALUES (?, ?, ?);

-- name: CreateUnitSuggestion :exec
INSERT INTO unit_suggestions (field, reason, unit_id, user_id) VALUES (?, ?, ?, ?);

-- name: ListPendingDeprecations :many
SELECT d.id, d.reason, d.created_at, u.code AS unit_code, un.slug AS university_slug,
    un.name AS university_name,
    CAST(coalesce(nullif(trim(usr.name), ''), 'Anonymous') AS TEXT) AS author_name
FROM unit_deprecations d
JOIN units u ON u.id = d.unit_id
JOIN universities un ON un.id = u.university_id
JOIN users usr ON usr.id = d.user_id
WHERE d.status = 'PENDING'
ORDER BY d.created_at DESC;

-- name: ListPendingSuggestions :many
SELECT s.id, s.field, s.reason, s.created_at, u.code AS unit_code, un.slug AS university_slug,
    un.name AS university_name,
    CAST(coalesce(nullif(trim(usr.name), ''), 'Anonymous') AS TEXT) AS author_name
FROM unit_suggestions s
JOIN units u ON u.id = s.unit_id
JOIN universities un ON un.id = u.university_id
JOIN users usr ON usr.id = s.user_id
WHERE s.status = 'PENDING'
ORDER BY s.created_at DESC;

-- name: ListAdditionRequests :many
SELECT a.id, a.code AS unit_code, a.created_at, un.slug AS university_slug,
    un.name AS university_name,
    CAST(coalesce(nullif(trim(usr.name), ''), 'Anonymous') AS TEXT) AS author_name
FROM unit_addition_requests a
JOIN universities un ON un.id = a.university_id
JOIN users usr ON usr.id = a.user_id
ORDER BY a.created_at DESC;

-- name: SetDeprecationStatus :one
UPDATE unit_deprecations SET status = ? WHERE id = ? AND status = 'PENDING' RETURNING unit_id;

-- name: SetSuggestionStatus :execrows
UPDATE unit_suggestions SET status = ? WHERE id = ? AND status = 'PENDING';

-- name: AdditionRequestExists :one
SELECT EXISTS (SELECT 1 FROM unit_addition_requests WHERE id = ?);

-- name: DeleteAdditionRequest :exec
DELETE FROM unit_addition_requests WHERE id = ?;
