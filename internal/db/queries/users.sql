-- name: GetUser :one
SELECT * FROM users WHERE id = ?;

-- name: GetUserByEmail :one
SELECT * FROM users WHERE email = ?;

-- name: GetUserByAPIKey :one
SELECT * FROM users WHERE api_key = ?;

-- name: CreateUser :one
INSERT INTO users (email, name) VALUES (?, ?) RETURNING *;

-- name: UpdateUserName :exec
UPDATE users SET name = ? WHERE id = ?;

-- name: SetUserAPIKey :exec
UPDATE users SET api_key = ? WHERE id = ?;
