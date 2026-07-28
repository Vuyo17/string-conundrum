-- String Conundrum: core schema.
-- Idempotent (CREATE ... IF NOT EXISTS) so it can be safely re-run on any
-- environment, including a fresh production database.

CREATE TABLE IF NOT EXISTS users (
    uid TEXT PRIMARY KEY,
    email TEXT,
    display_name TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS exercises (
    module_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    type TEXT NOT NULL,
    prompt TEXT NOT NULL,
    options JSONB,
    answer TEXT,
    answers JSONB,
    misconception_map JSONB,
    starter_code TEXT,
    test_cases JSONB,
    explanation TEXT,
    stars INTEGER,
    xp INTEGER,
    -- Optional translations. NULL means "not translated yet"; the API falls
    -- back to the English column per-field, so a partly translated bank still
    -- renders. Populated by scripts/translate_content.py.
    prompt_xh TEXT,
    explanation_xh TEXT,
    hint_xh TEXT,
    sort_order INTEGER NOT NULL,
    PRIMARY KEY (module_id, question_id)
);

CREATE TABLE IF NOT EXISTS challenges (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    difficulty TEXT,
    description TEXT,
    hint TEXT,
    io JSONB,
    starter_code TEXT,
    solution TEXT,
    tests JSONB,
    sort_order INTEGER NOT NULL
);

-- Recorded once per (user, question) the first time it's answered correctly.
-- Re-answering correctly never double-counts stars.
CREATE TABLE IF NOT EXISTS exercise_completions (
    user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    question_id TEXT NOT NULL,
    stars_awarded INTEGER NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, module_id, question_id)
);

-- Recorded once per (user, challenge) the first time all tests pass.
CREATE TABLE IF NOT EXISTS challenge_completions (
    user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    challenge_id TEXT NOT NULL,
    stars_awarded INTEGER NOT NULL DEFAULT 0,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, challenge_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_completions_user ON exercise_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_completions_user ON challenge_completions(user_id);

-- ─── migrations for existing databases ──────────────────────────────────────
-- CREATE TABLE IF NOT EXISTS above only builds a table that does not yet
-- exist; it will NOT add a column to one already deployed. These run
-- unconditionally and are idempotent, so applying schema.sql to a live
-- database brings it up to date instead of leaving the app querying columns
-- that are not there.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS prompt_xh TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS explanation_xh TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS hint_xh TEXT;
