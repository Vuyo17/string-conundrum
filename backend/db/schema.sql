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
-- The leaderboard is optional, to avoid demotivating students who'd rather
-- not see themselves ranked. Defaults to true so it keeps behaving the way
-- it already did for every account that existed before this column, and a
-- student can opt out (or stay in but show up as "Anonymous") from Settings.
ALTER TABLE users ADD COLUMN IF NOT EXISTS leaderboard_optin BOOLEAN NOT NULL DEFAULT true;
ALTER TABLE users ADD COLUMN IF NOT EXISTS leaderboard_anonymous BOOLEAN NOT NULL DEFAULT false;

-- ─── lecturer / admin dashboard ─────────────────────────────────────────────
-- Everything below backs the lecturer-facing admin dashboard: role-gated
-- access, lecturer-managed module metadata, and the two event tables the
-- analytics views read. Same idempotent style as above, so applying this file
-- to the live database is still safe.

-- 'student' | 'admin'. Kept as a plain column rather than a Firebase custom
-- claim so it also works under LOCAL_DB_FALLBACK (no Firebase console round
-- trip) and so a lecturer can promote a colleague from the dashboard without
-- waiting for the target's ID token to refresh. Promotion also happens
-- automatically for any address listed in the ADMIN_EMAILS env var -- see
-- resolve_role() in services/progress.py.
ALTER TABLE users ADD COLUMN IF NOT EXISTS role TEXT NOT NULL DEFAULT 'student';
CREATE INDEX IF NOT EXISTS idx_users_role ON users(role);

-- Lecturer-managed module metadata.
--
-- The student app still gets its lesson prose from the bundled
-- frontend/src/data/moduleContent/*.js files; this table owns the things a
-- lecturer can change at runtime -- which modules exist, what they are
-- called, what order they appear in, and whether students can see them yet.
-- A module row with no matching content file renders its description only,
-- which is what a freshly created module looks like until content is written
-- for it.
CREATE TABLE IF NOT EXISTS modules (
    id TEXT PRIMARY KEY,
    title TEXT NOT NULL,
    description TEXT,
    minutes INTEGER NOT NULL DEFAULT 20,
    level TEXT,
    objectives JSONB,
    sort_order INTEGER NOT NULL DEFAULT 0,
    -- Unpublished modules are invisible to students but still editable by the
    -- lecturer, so a module can be built up over several sittings and
    -- released when it is ready.
    published BOOLEAN NOT NULL DEFAULT true,
    archived BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Every graded answer, right or wrong.
--
-- exercise_completions above records only the FIRST CORRECT answer per
-- question, because that is all the star economy needs. That makes it useless
-- for the questions a lecturer actually asks -- which questions are being got
-- wrong, which misconceptions are firing, how many tries a student needed --
-- because wrong answers were never written down anywhere. This table is the
-- append-only event log those views read; it never drives stars or unlocking,
-- so a failed insert here can never cost a student progress.
CREATE TABLE IF NOT EXISTS attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    -- NULL for challenges, which are not scoped to a module.
    question_id TEXT,
    -- 'bank'      static exercise from the exercises table
    -- 'engine'    procedurally generated practice question
    -- 'exam'      answered inside a timed exam paper
    -- 'challenge' capstone coding challenge
    source TEXT NOT NULL DEFAULT 'bank',
    correct BOOLEAN NOT NULL,
    -- The misconception the wrong answer revealed, where the exercise's
    -- misconception_map (or the engine's grader) identified one. This single
    -- column is what turns the existing misconception catalogue from a design
    -- artefact into a measurable one.
    misconception_id TEXT,
    -- Truncated before insert; only wrong answers are worth storing verbatim.
    answer_given TEXT,
    tier INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_attempts_user ON attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_attempts_module ON attempts(module_id);
CREATE INDEX IF NOT EXISTS idx_attempts_question ON attempts(module_id, question_id);
CREATE INDEX IF NOT EXISTS idx_attempts_misconception ON attempts(misconception_id)
    WHERE misconception_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_attempts_created ON attempts(created_at);

-- One row per completed exam paper.
--
-- ExamMode computed this percentage on the client and threw it away, so
-- "marks" did not exist anywhere in the system. Every sitting is kept, not
-- just the best one, so a lecturer can see improvement across retakes; the
-- marks views aggregate with MAX/AVG over these rows as needed.
CREATE TABLE IF NOT EXISTS exam_attempts (
    id BIGSERIAL PRIMARY KEY,
    user_id TEXT NOT NULL REFERENCES users(uid) ON DELETE CASCADE,
    module_id TEXT NOT NULL,
    correct_count INTEGER NOT NULL,
    total_count INTEGER NOT NULL,
    percent INTEGER NOT NULL,
    passed BOOLEAN NOT NULL,
    stars_awarded INTEGER NOT NULL DEFAULT 0,
    duration_seconds INTEGER,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_exam_attempts_user ON exam_attempts(user_id);
CREATE INDEX IF NOT EXISTS idx_exam_attempts_module ON exam_attempts(module_id);
