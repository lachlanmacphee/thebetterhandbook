-- name: ListUnitReviews :many
-- viewer_reaction is 1 for a like, -1 for a dislike and 0 for no reaction.
SELECT
    r.id, r.title, r.text, r.year_completed,
    r.teaching_rating, r.content_rating, r.difficulty_rating, r.workload_rating,
    r.is_wam_booster, r.created_at, r.user_id,
    CAST(coalesce(nullif(trim(author.name), ''), 'Anonymous') AS TEXT) AS author_name,
    (SELECT count(*) FROM review_reactions rr WHERE rr.review_id = r.id AND rr.is_like) AS likes,
    (SELECT count(*) FROM review_reactions rr WHERE rr.review_id = r.id AND NOT rr.is_like) AS dislikes,
    CAST(coalesce((
        SELECT CASE WHEN rr.is_like THEN 1 ELSE -1 END FROM review_reactions rr
        WHERE rr.review_id = r.id AND rr.user_id = p.viewer_id), 0) AS INTEGER) AS viewer_reaction
FROM reviews r
JOIN users author ON author.id = r.user_id,
    (SELECT CAST(sqlc.arg(sort) AS TEXT) AS sort, CAST(sqlc.arg(viewer_id) AS INTEGER) AS viewer_id) p
WHERE r.unit_id = sqlc.arg(unit_id)
ORDER BY
    CASE WHEN p.sort = 'helpful' THEN likes - dislikes END DESC,
    CASE WHEN p.sort = 'latest' THEN r.year_completed END DESC,
    CASE WHEN p.sort = 'latest' THEN r.created_at END DESC,
    CASE WHEN p.sort = 'oldest' THEN r.year_completed END,
    r.created_at;

-- name: GetReviewReactions :one
SELECT
    (SELECT count(*) FROM review_reactions rr WHERE rr.review_id = sqlc.arg(review_id) AND rr.is_like) AS likes,
    (SELECT count(*) FROM review_reactions rr WHERE rr.review_id = sqlc.arg(review_id) AND NOT rr.is_like) AS dislikes,
    CAST(coalesce((
        SELECT CASE WHEN rr.is_like THEN 1 ELSE -1 END FROM review_reactions rr
        WHERE rr.review_id = sqlc.arg(review_id) AND rr.user_id = sqlc.arg(viewer_id)), 0) AS INTEGER) AS viewer_reaction;

-- name: GetReaction :one
SELECT * FROM review_reactions WHERE user_id = ? AND review_id = ?;

-- name: DeleteReaction :exec
DELETE FROM review_reactions WHERE id = ?;

-- name: UpsertReaction :exec
INSERT INTO review_reactions (user_id, review_id, is_like) VALUES (?, ?, ?)
ON CONFLICT (user_id, review_id) DO UPDATE SET is_like = excluded.is_like;

-- name: ReviewExists :one
SELECT EXISTS (SELECT 1 FROM reviews WHERE id = ?);

-- name: GetUserReviewForUnit :one
SELECT * FROM reviews WHERE user_id = ? AND unit_id = ?;

-- name: CreateReview :exec
INSERT INTO reviews (
    title, text, year_completed, overall_rating, teaching_rating, content_rating,
    difficulty_rating, workload_rating, requires_attendance, is_wam_booster, user_id, unit_id
) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?);

-- name: UpdateReview :exec
UPDATE reviews SET
    title = ?, text = ?, year_completed = ?, overall_rating = ?, teaching_rating = ?,
    content_rating = ?, difficulty_rating = ?, workload_rating = ?, requires_attendance = ?,
    is_wam_booster = ?
WHERE id = sqlc.arg(id) AND user_id = sqlc.arg(user_id);

-- name: ListUserReviews :many
SELECT r.id, r.title, r.text, r.year_completed, r.created_at,
    u.code AS unit_code, un.slug AS university_slug
FROM reviews r
JOIN units u ON u.id = r.unit_id
JOIN universities un ON un.id = u.university_id
WHERE r.user_id = ?
ORDER BY r.created_at DESC;

-- name: GetReviewLocation :one
SELECT u.code AS unit_code, un.slug AS university_slug
FROM reviews r
JOIN units u ON u.id = r.unit_id
JOIN universities un ON un.id = u.university_id
WHERE r.id = ?;
