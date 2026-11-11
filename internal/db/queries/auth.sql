-- name: UpsertLoginCode :exec
INSERT INTO login_codes (email, code_hash, expires_at)
VALUES (?, ?, ?)
ON CONFLICT (email) DO UPDATE SET code_hash = excluded.code_hash, expires_at = excluded.expires_at, attempts = 0;

-- name: GetLoginCode :one
SELECT * FROM login_codes WHERE email = ?;

-- name: IncrementLoginCodeAttempts :exec
UPDATE login_codes SET attempts = attempts + 1 WHERE email = ?;

-- name: DeleteLoginCode :exec
DELETE FROM login_codes WHERE email = ?;

-- name: DeleteExpiredLoginCodes :exec
DELETE FROM login_codes WHERE expires_at < ?;
