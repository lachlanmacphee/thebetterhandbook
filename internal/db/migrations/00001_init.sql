-- +goose Up
CREATE TABLE universities (
    id           INTEGER PRIMARY KEY,
    name         TEXT NOT NULL UNIQUE,
    slug         TEXT NOT NULL UNIQUE,
    handbook_url TEXT
);

CREATE TABLE users (
    id                      INTEGER PRIMARY KEY,
    email                   TEXT NOT NULL UNIQUE,
    name                    TEXT,
    role                    TEXT NOT NULL DEFAULT 'USER' CHECK (role IN ('USER', 'ADMIN')),
    api_key                 TEXT UNIQUE,
    preferred_university_id INTEGER REFERENCES universities (id)
);

CREATE TABLE faculties (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    university_id INTEGER NOT NULL REFERENCES universities (id),
    UNIQUE (name, university_id)
);

CREATE TABLE campuses (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    university_id INTEGER NOT NULL REFERENCES universities (id),
    UNIQUE (name, university_id)
);

CREATE TABLE semesters (
    id            INTEGER PRIMARY KEY,
    name          TEXT NOT NULL,
    university_id INTEGER NOT NULL REFERENCES universities (id),
    UNIQUE (name, university_id)
);

CREATE TABLE units (
    id            INTEGER PRIMARY KEY,
    code          TEXT NOT NULL,
    name          TEXT NOT NULL,
    level         TEXT NOT NULL,
    credit_points INTEGER NOT NULL,
    is_deprecated BOOLEAN NOT NULL DEFAULT FALSE,
    faculty_id    INTEGER NOT NULL REFERENCES faculties (id),
    university_id INTEGER NOT NULL REFERENCES universities (id),
    UNIQUE (university_id, code)
);
CREATE INDEX units_faculty_id ON units (faculty_id);

CREATE TABLE unit_campuses (
    unit_id   INTEGER NOT NULL REFERENCES units (id) ON DELETE CASCADE,
    campus_id INTEGER NOT NULL REFERENCES campuses (id) ON DELETE CASCADE,
    PRIMARY KEY (unit_id, campus_id)
) WITHOUT ROWID;
CREATE INDEX unit_campuses_campus_id ON unit_campuses (campus_id);

CREATE TABLE unit_semesters (
    unit_id     INTEGER NOT NULL REFERENCES units (id) ON DELETE CASCADE,
    semester_id INTEGER NOT NULL REFERENCES semesters (id) ON DELETE CASCADE,
    PRIMARY KEY (unit_id, semester_id)
) WITHOUT ROWID;
CREATE INDEX unit_semesters_semester_id ON unit_semesters (semester_id);

CREATE TABLE unit_prerequisites (
    unit_id         INTEGER NOT NULL REFERENCES units (id) ON DELETE CASCADE,
    prerequisite_id INTEGER NOT NULL REFERENCES units (id) ON DELETE CASCADE,
    PRIMARY KEY (unit_id, prerequisite_id)
) WITHOUT ROWID;

CREATE TABLE unit_corequisites (
    unit_id        INTEGER NOT NULL REFERENCES units (id) ON DELETE CASCADE,
    corequisite_id INTEGER NOT NULL REFERENCES units (id) ON DELETE CASCADE,
    PRIMARY KEY (unit_id, corequisite_id)
) WITHOUT ROWID;

CREATE TABLE unit_addition_requests (
    id            INTEGER PRIMARY KEY,
    code          TEXT NOT NULL,
    created_at    TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    user_id       INTEGER NOT NULL REFERENCES users (id),
    university_id INTEGER NOT NULL REFERENCES universities (id),
    UNIQUE (university_id, code)
);

CREATE TABLE unit_deprecations (
    id         INTEGER PRIMARY KEY,
    reason     TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    user_id    INTEGER NOT NULL REFERENCES users (id),
    unit_id    INTEGER NOT NULL REFERENCES units (id)
);
CREATE INDEX unit_deprecations_status ON unit_deprecations (status);

CREATE TABLE unit_suggestions (
    id         INTEGER PRIMARY KEY,
    field      TEXT NOT NULL,
    reason     TEXT NOT NULL,
    status     TEXT NOT NULL DEFAULT 'PENDING' CHECK (status IN ('PENDING', 'APPROVED', 'REJECTED')),
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    user_id    INTEGER NOT NULL REFERENCES users (id),
    unit_id    INTEGER NOT NULL REFERENCES units (id)
);
CREATE INDEX unit_suggestions_status ON unit_suggestions (status);

CREATE TABLE reviews (
    id                  INTEGER PRIMARY KEY,
    title               TEXT NOT NULL,
    text                TEXT NOT NULL,
    year_completed      INTEGER NOT NULL,
    overall_rating      INTEGER NOT NULL,
    teaching_rating     INTEGER NOT NULL,
    content_rating      INTEGER NOT NULL,
    difficulty_rating   INTEGER NOT NULL,
    workload_rating     INTEGER NOT NULL,
    requires_attendance BOOLEAN NOT NULL,
    is_wam_booster      BOOLEAN NOT NULL DEFAULT FALSE,
    created_at          TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    user_id             INTEGER NOT NULL REFERENCES users (id),
    unit_id             INTEGER NOT NULL REFERENCES units (id),
    UNIQUE (user_id, unit_id)
);
CREATE INDEX reviews_unit_id ON reviews (unit_id);
CREATE INDEX reviews_created_at ON reviews (created_at);

CREATE TABLE review_reactions (
    id         INTEGER PRIMARY KEY,
    is_like    BOOLEAN NOT NULL,
    created_at TEXT NOT NULL DEFAULT (strftime('%Y-%m-%dT%H:%M:%fZ', 'now')),
    review_id  INTEGER NOT NULL REFERENCES reviews (id) ON DELETE CASCADE,
    user_id    INTEGER NOT NULL REFERENCES users (id),
    UNIQUE (user_id, review_id)
);
CREATE INDEX review_reactions_review_id ON review_reactions (review_id);

-- One-time sign-in codes. The code itself is never stored, only its HMAC.
CREATE TABLE login_codes (
    email      TEXT PRIMARY KEY,
    code_hash  TEXT NOT NULL,
    expires_at INTEGER NOT NULL,
    attempts   INTEGER NOT NULL DEFAULT 0
);

-- Session store used by github.com/alexedwards/scs/sqlite3store.
CREATE TABLE sessions (
    token  TEXT PRIMARY KEY,
    data   BLOB NOT NULL,
    expiry REAL NOT NULL
);
CREATE INDEX sessions_expiry ON sessions (expiry);

-- +goose Down
DROP TABLE sessions;
DROP TABLE login_codes;
DROP TABLE review_reactions;
DROP TABLE reviews;
DROP TABLE unit_suggestions;
DROP TABLE unit_deprecations;
DROP TABLE unit_addition_requests;
DROP TABLE unit_corequisites;
DROP TABLE unit_prerequisites;
DROP TABLE unit_semesters;
DROP TABLE unit_campuses;
DROP TABLE units;
DROP TABLE semesters;
DROP TABLE campuses;
DROP TABLE faculties;
DROP TABLE users;
DROP TABLE universities;
