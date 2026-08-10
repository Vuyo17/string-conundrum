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
    -- options_xh/answer_xh/answers_xh are DISPLAY TEXT ONLY. Grading always
    -- compares against the English `answer`/`answers`/`misconception_map`
    -- keys, never the translated text, so a submitted choice always matches
    -- regardless of which language rendered it. See feedback.py.
    options_xh JSONB,
    answer_xh TEXT,
    answers_xh JSONB,
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
    sort_order INTEGER NOT NULL,
    -- Translations, mirroring the exercises table. starter_code, solution and
    -- tests have no _xh twin on purpose: they are Python that has to run, and
    -- tests are compared literally against program output.
    title_xh TEXT,
    description_xh TEXT,
    hint_xh TEXT,
    io_xh JSONB
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

-- Recorded once per (user, module, section) the first time a student reaches
-- or passes that stage of a module (learn/examples/visualize/practice/exam).
-- Drives the module card's progress bar and the next-module unlock, replacing
-- the old "every exercise answered correctly" rule.
CREATE TABLE IF NOT EXISTS module_section_completions (
    user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    section_id TEXT NOT NULL,
    completed_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    PRIMARY KEY (user_id, module_id, section_id)
);

CREATE INDEX IF NOT EXISTS idx_exercise_completions_user ON exercise_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_challenge_completions_user ON challenge_completions(user_id);
CREATE INDEX IF NOT EXISTS idx_module_section_completions_user ON module_section_completions(user_id);

-- ─── migrations for existing databases ──────────────────────────────────────
-- CREATE TABLE IF NOT EXISTS above only builds a table that does not yet
-- exist; it will NOT add a column to one already deployed. These run
-- unconditionally and are idempotent, so applying schema.sql to a live
-- database brings it up to date instead of leaving the app querying columns
-- that are not there.
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS prompt_xh TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS explanation_xh TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS hint_xh TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS options_xh JSONB;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS answer_xh TEXT;
ALTER TABLE exercises ADD COLUMN IF NOT EXISTS answers_xh JSONB;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS title_xh TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS description_xh TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS hint_xh TEXT;
ALTER TABLE challenges ADD COLUMN IF NOT EXISTS io_xh JSONB;
-- Lets a student unlock every module/challenge from Settings, bypassing the
-- sequential-completion gate entirely.
ALTER TABLE users ADD COLUMN IF NOT EXISTS bypass_unlocks BOOLEAN NOT NULL DEFAULT false;
