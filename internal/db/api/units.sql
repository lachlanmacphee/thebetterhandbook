-- Builds the entire /api/units response document.
WITH matched AS (
    SELECT
        u.*,
        (SELECT count(*) FROM reviews r WHERE r.unit_id = u.id) AS review_count,
        (SELECT avg(r.overall_rating) FROM reviews r WHERE r.unit_id = u.id) AS avg_rating
    FROM units u
    JOIN universities un ON un.id = u.university_id
    WHERE (:university IS NULL OR un.slug = :university)
        AND (:code IS NULL OR instr(u.code, upper(:code)) > 0)
        AND (:name IS NULL OR instr(lower(u.name), lower(:name)) > 0)
        AND (:faculty_id IS NULL OR u.faculty_id = :faculty_id)
        AND (:level IS NULL OR u.level = :level)
        AND (:credit_points IS NULL OR u.credit_points = :credit_points)
        AND (:campus_id IS NULL OR EXISTS (
            SELECT 1 FROM unit_campuses uc WHERE uc.unit_id = u.id AND uc.campus_id = :campus_id))
        AND (:semester_id IS NULL OR EXISTS (
            SELECT 1 FROM unit_semesters us WHERE us.unit_id = u.id AND us.semester_id = :semester_id))
),
page AS (
    SELECT *, row_number() OVER (ORDER BY
        CASE WHEN :sort = 'rating' THEN coalesce(avg_rating, 0) END DESC,
        CASE WHEN :sort = 'reviews' THEN review_count END DESC,
        CASE WHEN :sort = 'name' THEN name END,
        code,
        university_id
    ) AS position
    FROM matched
    ORDER BY position
    LIMIT :page_size OFFSET (:page - 1) * :page_size
)
SELECT json_object(
    'units', json((
        SELECT json_group_array(json_object(
            'id', p.id,
            'code', p.code,
            'name', p.name,
            'level', p.level,
            'creditPoints', p.credit_points,
            'isDeprecated', json(iif(p.is_deprecated, 'true', 'false')),
            'handbookUrl', un.handbook_url || p.code,
            'university', json_object('id', un.id, 'name', un.name, 'slug', un.slug),
            'faculty', json_object('id', f.id, 'name', f.name),
            'campuses', json((
                SELECT json_group_array(json_object('id', c.id, 'name', c.name) ORDER BY c.name)
                FROM unit_campuses uc JOIN campuses c ON c.id = uc.campus_id
                WHERE uc.unit_id = p.id)),
            'semesters', json((
                SELECT json_group_array(json_object('id', s.id, 'name', s.name) ORDER BY s.name)
                FROM unit_semesters us JOIN semesters s ON s.id = us.semester_id
                WHERE us.unit_id = p.id)),
            'ratings', json((
                SELECT json_object(
                    'reviewCount', count(*),
                    'overall', round(avg(r.overall_rating), 2),
                    'teaching', round(avg(r.teaching_rating), 2),
                    'content', round(avg(r.content_rating), 2),
                    'difficulty', round(avg(r.difficulty_rating), 2),
                    'workload', round(avg(r.workload_rating), 2))
                FROM reviews r WHERE r.unit_id = p.id)),
            'reviews', json((
                SELECT json_group_array(json_object(
                    'id', r.id,
                    'title', r.title,
                    'text', r.text,
                    'yearCompleted', r.year_completed,
                    'overallRating', r.overall_rating,
                    'teachingRating', r.teaching_rating,
                    'contentRating', r.content_rating,
                    'difficultyRating', r.difficulty_rating,
                    'workloadRating', r.workload_rating,
                    'requiresAttendance', json(iif(r.requires_attendance, 'true', 'false')),
                    'isWamBooster', json(iif(r.is_wam_booster, 'true', 'false')),
                    'likes', (SELECT count(*) FROM review_reactions rr WHERE rr.review_id = r.id AND rr.is_like),
                    'dislikes', (SELECT count(*) FROM review_reactions rr WHERE rr.review_id = r.id AND NOT rr.is_like),
                    'createdAt', r.created_at
                ) ORDER BY r.created_at DESC)
                FROM reviews r WHERE r.unit_id = p.id))
        ) ORDER BY p.position)
        FROM page p
        JOIN universities un ON un.id = p.university_id
        JOIN faculties f ON f.id = p.faculty_id
    )),
    'pagination', json((
        SELECT json_object(
            'page', :page,
            'pageSize', :page_size,
            'totalCount', count(*),
            'totalPages', (count(*) + :page_size - 1) / :page_size)
        FROM matched
    ))
);
