"""One-shot (and re-runnable) loader: seeds the `exercises` and `challenges`
tables from the existing JSON content files. Safe to re-run after editing the
JSON files — every row is an upsert keyed on its natural id.

Usage:
    cd backend
    python db/migrate_json_to_db.py

Requires DATABASE_URL to be set (backend/.env locally, or exported in the
shell on the server) pointing at the target database.
"""

import json
import sys
from pathlib import Path

from dotenv import load_dotenv

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

from app.db import get_cursor  # noqa: E402

_DATA_DIR = Path(__file__).resolve().parent.parent / "app" / "data"


def _load(name: str) -> list[dict]:
    with open(_DATA_DIR / name, "r", encoding="utf-8") as f:
        return json.load(f)


def migrate_exercises(cur) -> int:
    exercises = _load("exercises.json")
    for i, ex in enumerate(exercises):
        cur.execute(
            """
            INSERT INTO exercises (
                module_id, question_id, type, prompt, options, answer, answers,
                misconception_map, starter_code, test_cases, explanation, stars, xp,
                prompt_xh, explanation_xh, hint_xh, options_xh, answer_xh, answers_xh,
                sort_order
            ) VALUES (
                %(module_id)s, %(question_id)s, %(type)s, %(prompt)s, %(options)s, %(answer)s,
                %(answers)s, %(misconception_map)s, %(starter_code)s, %(test_cases)s,
                %(explanation)s, %(stars)s, %(xp)s,
                %(prompt_xh)s, %(explanation_xh)s, %(hint_xh)s,
                %(options_xh)s, %(answer_xh)s, %(answers_xh)s, %(sort_order)s
            )
            ON CONFLICT (module_id, question_id) DO UPDATE SET
                type = EXCLUDED.type,
                prompt = EXCLUDED.prompt,
                options = EXCLUDED.options,
                answer = EXCLUDED.answer,
                answers = EXCLUDED.answers,
                misconception_map = EXCLUDED.misconception_map,
                starter_code = EXCLUDED.starter_code,
                test_cases = EXCLUDED.test_cases,
                explanation = EXCLUDED.explanation,
                stars = EXCLUDED.stars,
                xp = EXCLUDED.xp,
                -- COALESCE so re-running the migration from JSON never wipes a
                -- translation already present in the database.
                prompt_xh = COALESCE(EXCLUDED.prompt_xh, exercises.prompt_xh),
                explanation_xh = COALESCE(EXCLUDED.explanation_xh, exercises.explanation_xh),
                hint_xh = COALESCE(EXCLUDED.hint_xh, exercises.hint_xh),
                options_xh = COALESCE(EXCLUDED.options_xh, exercises.options_xh),
                answer_xh = COALESCE(EXCLUDED.answer_xh, exercises.answer_xh),
                answers_xh = COALESCE(EXCLUDED.answers_xh, exercises.answers_xh),
                sort_order = EXCLUDED.sort_order
            """,
            {
                "module_id": ex["module_id"],
                "question_id": ex["question_id"],
                "type": ex["type"],
                "prompt": ex["prompt"],
                "options": json.dumps(ex["options"]) if "options" in ex else None,
                "answer": ex.get("answer"),
                "answers": json.dumps(ex["answers"]) if "answers" in ex else None,
                "misconception_map": json.dumps(ex.get("misconception_map") or {}),
                "starter_code": ex.get("starter_code"),
                "prompt_xh": ex.get("prompt_xh"),
                "explanation_xh": ex.get("explanation_xh"),
                "hint_xh": ex.get("hint_xh"),
                "options_xh": json.dumps(ex["options_xh"]) if "options_xh" in ex else None,
                "answer_xh": ex.get("answer_xh"),
                "answers_xh": json.dumps(ex["answers_xh"]) if "answers_xh" in ex else None,
                "test_cases": json.dumps(ex["test_cases"]) if "test_cases" in ex else None,
                "explanation": ex.get("explanation"),
                "stars": ex.get("stars"),
                "xp": ex.get("xp"),
                "sort_order": i,
            },
        )
    return len(exercises)


def migrate_challenges(cur) -> int:
    challenges = _load("challenges.json")
    for i, ch in enumerate(challenges):
        cur.execute(
            """
            INSERT INTO challenges (
                id, title, difficulty, description, hint, io, starter_code, solution, tests,
                title_xh, description_xh, hint_xh, io_xh, sort_order
            ) VALUES (
                %(id)s, %(title)s, %(difficulty)s, %(description)s, %(hint)s, %(io)s,
                %(starter_code)s, %(solution)s, %(tests)s,
                %(title_xh)s, %(description_xh)s, %(hint_xh)s, %(io_xh)s, %(sort_order)s
            )
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                difficulty = EXCLUDED.difficulty,
                description = EXCLUDED.description,
                hint = EXCLUDED.hint,
                io = EXCLUDED.io,
                starter_code = EXCLUDED.starter_code,
                solution = EXCLUDED.solution,
                tests = EXCLUDED.tests,
                -- COALESCE so re-seeding from a JSON file that has not been
                -- translated yet cannot wipe translations already in the table,
                -- matching how the exercises upsert above behaves.
                title_xh = COALESCE(EXCLUDED.title_xh, challenges.title_xh),
                description_xh = COALESCE(EXCLUDED.description_xh, challenges.description_xh),
                hint_xh = COALESCE(EXCLUDED.hint_xh, challenges.hint_xh),
                io_xh = COALESCE(EXCLUDED.io_xh, challenges.io_xh),
                sort_order = EXCLUDED.sort_order
            """,
            {
                "id": ch["id"],
                "title": ch["title"],
                "difficulty": ch.get("difficulty"),
                "description": ch.get("description"),
                "hint": ch.get("hint"),
                "io": json.dumps(ch["io"]) if "io" in ch else None,
                "starter_code": ch.get("starter_code"),
                "solution": ch.get("solution"),
                "tests": json.dumps(ch["tests"]) if "tests" in ch else None,
                "title_xh": ch.get("title_xh"),
                "description_xh": ch.get("description_xh"),
                "hint_xh": ch.get("hint_xh"),
                "io_xh": json.dumps(ch["io_xh"]) if "io_xh" in ch else None,
                "sort_order": i,
            },
        )
    return len(challenges)


if __name__ == "__main__":
    with get_cursor() as cur:
        n_exercises = migrate_exercises(cur)
        n_challenges = migrate_challenges(cur)
    print(f"Upserted {n_exercises} exercises and {n_challenges} challenges.")
