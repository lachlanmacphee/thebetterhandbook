-- Builds the entire /api/universities response document.
WITH matched AS (
    SELECT
        un.*,
        (SELECT count(*) FROM units u WHERE u.university_id = un.id) AS unit_count,
        (SELECT count(*) FROM faculties f WHERE f.university_id = un.id) AS faculty_count,
        (SELECT count(*) FROM campuses c WHERE c.university_id = un.id) AS campus_count,
        (SELECT count(*) FROM semesters s WHERE s.university_id = un.id) AS semester_count,
        (SELECT count(*) FROM reviews r JOIN units u ON u.id = r.unit_id WHERE u.university_id = un.id) AS review_count
    FROM universities un
    WHERE :name IS NULL OR instr(lower(un.name), lower(:name)) > 0
),
page AS (
    SELECT *, row_number() OVER (ORDER BY
        CASE WHEN :sort = 'unitCount' THEN unit_count END DESC,
        name
    ) AS position
    FROM matched
    ORDER BY position
    LIMIT :page_size OFFSET (:page - 1) * :page_size
)
SELECT json_object(
    'universities', json((
        SELECT json_group_array(json_object(
            'id', id,
            'name', name,
            'slug', slug,
            'handbookUrl', handbook_url,
            'counts', json_object(
                'units', unit_count,
                'faculties', faculty_count,
                'campuses', campus_count,
                'semesters', semester_count,
                'reviews', review_count)
        ) ORDER BY position)
        FROM page
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
