"""Lecturer-facing CRUD over modules and the static exercise bank.

Two stores are in play and they behave differently, which is worth stating
plainly because it shapes every function below:

  * Modules live in the `modules` table (added for the dashboard). Before a
    lecturer has ever touched the dashboard that table is empty, so
    list_modules() falls back to DEFAULT_MODULES -- the same eight modules,
    in the same order, that the student app has always shipped. The first
    write of any kind seeds the table from that default, so a lecturer editing
    one module's title does not make the other seven vanish.

  * Exercises live in the `exercises` table under Postgres and in
    app/data/exercises.json under LOCAL_DB_FALLBACK. Unlike every other
    service here, the JSON side has to be WRITTEN, not just read -- a lecturer
    demoing on a laptop still needs Save to work -- so the fallback path
    edits that file directly rather than going through _LocalCursor.

Lesson prose (learn sections, callouts, worked examples) is NOT here. It is
still bundled in frontend/src/data/moduleContent/*.js and is not runtime
editable; see docs/admin-dashboard.md for why that was scoped out.
"""

import json
from pathlib import Path

from ..db import get_cursor, use_local_fallback

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_EXERCISES_PATH = _DATA_DIR / "exercises.json"

# Mirrors frontend/src/data/modules.js (order, ids, minutes) and the titles
# under `modules.items.<id>` in frontend/src/locales/en.json. Used only to
# seed an empty `modules` table; after that the table is authoritative.
DEFAULT_MODULES = [
    ("intro", "Introduction to Strings", "Understand what strings are in Python.", 15, "Beginner"),
    ("indexing", "String Indexing", "Access characters using indexes.", 20, "Beginner"),
    ("slicing", "String Slicing", "Extract parts of a string using slices.", 25, "Intermediate"),
    ("immutability", "String Immutability", "See why strings cannot be changed in place.", 25, "Intermediate"),
    ("comparison", "String Comparison", "Compare strings using operators.", 20, "Intermediate"),
    ("looping", "Looping Through Strings", "Iterate over characters in a string.", 30, "Intermediate"),
    ("methods", "String Methods", "Explore built-in string methods.", 35, "Advanced"),
    ("formatting", "String Formatting", "Format strings in various ways.", 35, "Advanced"),
]

DEFAULT_SECTION_IDS = ["learn", "examples", "visualize", "practice", "exam"]
VALID_EXERCISE_TYPES = {"mcq", "fill_blank", "select_all", "write_code"}


def _decode_json_field(value, default=None):
    if value in (None, ""):
        return default
    if isinstance(value, (dict, list)):
        return value
    if isinstance(value, str):
        try:
            decoded = json.loads(value)
        except (TypeError, ValueError):
            return default
        return decoded if isinstance(decoded, (dict, list)) else default
    return default


def _normalise_section_ids(value):
    if value is None:
        return list(DEFAULT_SECTION_IDS)
    if not isinstance(value, list):
        raise ValueError("section_ids must be a list of section ids")
    cleaned = []
    seen = set()
    for item in value:
        section_id = str(item).strip().lower()
        if section_id not in DEFAULT_SECTION_IDS:
            raise ValueError("section_ids may only contain: " + ", ".join(DEFAULT_SECTION_IDS))
        if section_id not in seen:
            seen.add(section_id)
            cleaned.append(section_id)
    if not cleaned:
        return list(DEFAULT_SECTION_IDS)
    return cleaned


def _normalise_content(value):
    if value is None:
        return {}
    if not isinstance(value, dict):
        raise ValueError("content must be a JSON object")
    return value


def _default_rows() -> list:
    return [
        {
            "id": module_id,
            "title": title,
            "description": description,
            "minutes": minutes,
            "level": level,
            "objectives": None,
            "section_ids": list(DEFAULT_SECTION_IDS),
            "content": {},
            "sort_order": index,
            "published": True,
            "archived": False,
            "created_at": None,
            "updated_at": None,
        }
        for index, (module_id, title, description, minutes, level)
        in enumerate(DEFAULT_MODULES)
    ]


def _read_modules() -> list:
    with get_cursor() as cur:
        cur.execute(
            "SELECT id, title, description, minutes, level, objectives, "
            "section_ids, content, sort_order, published, archived, "
            "created_at, updated_at FROM modules"
        )
        rows = [dict(row) for row in cur.fetchall()]
    for row in rows:
        row["section_ids"] = _normalise_section_ids(_decode_json_field(row.get("section_ids"), list(DEFAULT_SECTION_IDS)))
        row["content"] = _decode_json_field(row.get("content"), {})
    return sorted(rows, key=lambda r: (r.get("sort_order") or 0, r["id"]))


def _seed_if_empty() -> None:
    """Write DEFAULT_MODULES into the table the first time anything writes.

    Without this, a lecturer's first edit would insert exactly one row and
    list_modules() would stop falling back -- leaving the student app with a
    single module. Seeding on the first write keeps that from happening while
    still leaving a never-touched deployment with an empty table.
    """
    if _read_modules():
        return
    for row in _default_rows():
        _insert_module(row)


def _insert_module(row: dict) -> None:
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO modules
                (id, title, description, minutes, level, objectives, section_ids, content,
                 sort_order, published)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
            ON CONFLICT (id) DO UPDATE SET
                title = EXCLUDED.title,
                description = EXCLUDED.description,
                minutes = EXCLUDED.minutes,
                level = EXCLUDED.level,
                objectives = EXCLUDED.objectives,
                section_ids = EXCLUDED.section_ids,
                content = EXCLUDED.content,
                sort_order = EXCLUDED.sort_order,
                published = EXCLUDED.published,
                updated_at = now()
            """,
            (
                row["id"], row["title"], row.get("description"),
                row.get("minutes") or 20, row.get("level"),
                json.dumps(row["objectives"]) if row.get("objectives") is not None else None,
                json.dumps(row.get("section_ids") or list(DEFAULT_SECTION_IDS)),
                json.dumps(row.get("content") or {}),
                row.get("sort_order") or 0,
                bool(row.get("published", True)),
            ),
        )


def list_modules(include_unpublished: bool = True) -> list:
    rows = _read_modules() or _default_rows()
    rows = [r for r in rows if not r.get("archived")]
    if not include_unpublished:
        rows = [r for r in rows if r.get("published", True)]
    return rows


def get_module(module_id: str):
    for row in list_modules():
        if row["id"] == module_id:
            return row
    return None


def completion_sections(module_id: str) -> tuple:
    """The full navigable section flow for a module, in order.

    This includes 'practice' -- it is a real section a student can open and
    see their own pass/fail on. Do not use this for completion/progress
    math; see gating_sections() below, which mirrors the frontend's
    GATING_SECTION_IDS (frontend/src/utils/moduleSections.js).
    """
    row = get_module(module_id)
    if row and row.get("section_ids"):
        return tuple(row["section_ids"])
    if module_id in {row[0] for row in DEFAULT_MODULES}:
        return tuple(DEFAULT_SECTION_IDS)
    return ("learn", "exam")


def gating_sections(module_id: str) -> tuple:
    """The sections that count toward module completion.

    'practice' is deliberately excluded, matching GATING_SECTION_IDS in
    frontend/src/utils/moduleSections.js: a module can complete on Learn +
    Examples + Visualize exposure plus an Exam pass alone, without ever
    touching Practice. completion_sections() stays the full navigable list
    (used by routes.py to render the module page); this is the subset used
    for progress percentages and the "completed" flag.
    """
    return tuple(s for s in completion_sections(module_id) if s != "practice")


def module_ids() -> list:
    return [row["id"] for row in list_modules()]


def create_module(payload: dict) -> dict:
    module_id = (payload.get("id") or "").strip().lower()
    if not module_id or not module_id.replace("-", "").replace("_", "").isalnum():
        raise ValueError("id must be a short alphanumeric slug, e.g. 'regex-basics'")
    title = (payload.get("title") or "").strip()
    if not title:
        raise ValueError("title is required")

    _seed_if_empty()
    existing = {row["id"] for row in list_modules()}
    if module_id in existing:
        raise ValueError("a module with id '%s' already exists" % module_id)

    row = {
        "id": module_id,
        "title": title,
        "description": (payload.get("description") or "").strip() or None,
        "minutes": int(payload.get("minutes") or 20),
        "level": (payload.get("level") or "").strip() or None,
        "objectives": payload.get("objectives") or None,
        "section_ids": _normalise_section_ids(payload.get("section_ids", list(DEFAULT_SECTION_IDS))),
        "content": _normalise_content(payload.get("content", {})),
        # New modules go to the end of the sequence by default.
        "sort_order": len(existing),
        # ...and start unpublished, so students do not see an empty module the
        # instant a lecturer creates it.
        "published": bool(payload.get("published", False)),
    }
    _insert_module(row)
    return get_module(module_id)


def update_module(module_id: str, payload: dict) -> dict:
    _seed_if_empty()
    current = get_module(module_id)
    if current is None:
        raise LookupError(module_id)

    merged = {**current, **{k: v for k, v in payload.items() if k != "id"}}
    if "section_ids" in payload:
        merged["section_ids"] = _normalise_section_ids(payload.get("section_ids"))
    if "content" in payload:
        merged["content"] = _normalise_content(payload.get("content"))
    objectives = merged.get("objectives")
    section_ids = merged.get("section_ids") or list(DEFAULT_SECTION_IDS)
    content = merged.get("content") or {}
    with get_cursor() as cur:
        cur.execute(
            """
            UPDATE modules SET
                title = %s, description = %s, minutes = %s, level = %s,
                objectives = %s, section_ids = %s, content = %s,
                sort_order = %s, published = %s, archived = %s,
                updated_at = now()
            WHERE id = %s
            """,
            (
                merged.get("title"), merged.get("description"),
                int(merged.get("minutes") or 20), merged.get("level"),
                json.dumps(objectives) if objectives is not None else None,
                json.dumps(section_ids),
                json.dumps(content),
                int(merged.get("sort_order") or 0),
                bool(merged.get("published", True)),
                bool(merged.get("archived", False)),
                module_id,
            ),
        )
    return get_module(module_id)


def reorder_modules(ordered_ids: list) -> list:
    _seed_if_empty()
    known = {row["id"] for row in list_modules()}
    for index, module_id in enumerate(ordered_ids):
        if module_id in known:
            update_module(module_id, {"sort_order": index})
    return list_modules()


def archive_module(module_id: str) -> None:
    """Archive rather than delete.

    A hard delete would orphan every attempt, completion and exam row that
    references the module id -- those are the lecturer's own historical data,
    and losing them to a mis-click is not recoverable. Archived modules
    disappear from both the student app and the dashboard's module list but
    stay joinable by the analytics views.
    """
    _seed_if_empty()
    if get_module(module_id) is None:
        raise LookupError(module_id)
    update_module(module_id, {"archived": True, "published": False})


# --- exercise bank ---------------------------------------------------------

_EXERCISE_COLUMNS = [
    "module_id", "question_id", "type", "prompt", "options", "answer",
    "answers", "misconception_map", "starter_code", "test_cases",
    "explanation", "stars", "xp", "sort_order",
]
_JSON_COLUMNS = {"options", "answers", "misconception_map", "test_cases"}


def _load_json_bank() -> list:
    try:
        data = json.loads(_EXERCISES_PATH.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def _save_json_bank(rows: list) -> None:
    # Trailing newline kept deliberately: the committed file has one, and
    # without it every lecturer edit would show up in git as a one-line
    # change to the last line of a 5,600-line file.
    _EXERCISES_PATH.write_text(
        json.dumps(rows, indent=2, ensure_ascii=False) + "\n", encoding="utf-8"
    )


def list_exercises(module_id: str) -> list:
    """Every exercise in one module, including the answer key.

    Unlike the student-facing GET /api/exercises/<module_id>, this returns
    `answer`/`answers`/`misconception_map` -- a lecturer editing a question
    obviously needs to see its answer. That is exactly why the route calling
    this is behind require_admin.
    """
    if use_local_fallback():
        rows = [r for r in _load_json_bank() if r.get("module_id") == module_id]
        return sorted(rows, key=lambda r: (r.get("sort_order") or 0, r.get("question_id") or ""))

    columns = ", ".join(_EXERCISE_COLUMNS)
    with get_cursor() as cur:
        cur.execute(
            "SELECT " + columns + " FROM exercises WHERE module_id = %s "
            "ORDER BY sort_order, question_id",
            (module_id,),
        )
        return [dict(row) for row in cur.fetchall()]


def _as_int(value, default):
    """Coerce a form field to an int, falling back rather than raising.

    The editor posts numbers as the strings its <input type="number"> produced.
    Postgres will implicitly cast "10" to an integer but not "ten", and the
    failure would surface as a database error on save rather than anything a
    lecturer could act on.
    """
    if value is None or value == "":
        return default
    try:
        return int(value)
    except (TypeError, ValueError):
        return default


def _validate_exercise(payload: dict) -> dict:
    q_type = (payload.get("type") or "").strip()
    if q_type not in VALID_EXERCISE_TYPES:
        raise ValueError("type must be one of: " + ", ".join(sorted(VALID_EXERCISE_TYPES)))
    if not (payload.get("prompt") or "").strip():
        raise ValueError("prompt is required")

    if q_type in {"mcq", "select_all"}:
        if len(payload.get("options") or []) < 2:
            raise ValueError("give at least two options")
    if q_type == "select_all":
        if not payload.get("answers"):
            raise ValueError("select_all needs at least one correct answer")
    elif q_type in {"mcq", "fill_blank"}:
        if not (payload.get("answer") or "").strip():
            raise ValueError("answer is required")
    elif q_type == "write_code":
        if not payload.get("test_cases"):
            raise ValueError("write_code needs at least one test case")

    # An mcq whose answer is not one of its own options can never be got
    # right, and nothing downstream would catch it -- the grader would just
    # mark every student wrong. Cheap to check here, impossible to debug from
    # the student side.
    if q_type == "mcq" and payload.get("answer") not in (payload.get("options") or []):
        raise ValueError("the answer must be one of the options")
    if q_type == "select_all":
        stray = set(payload.get("answers") or []) - set(payload.get("options") or [])
        if stray:
            raise ValueError("these answers are not options: " + ", ".join(sorted(stray)))
    return payload


def save_exercise(module_id: str, question_id: str, payload: dict) -> dict:
    """Create or replace one exercise. Used for both new and edited questions."""
    _validate_exercise(payload)
    row = {
        "module_id": module_id,
        "question_id": question_id,
        "type": payload.get("type"),
        "prompt": payload.get("prompt"),
        "options": payload.get("options"),
        "answer": payload.get("answer"),
        "answers": payload.get("answers"),
        "misconception_map": payload.get("misconception_map"),
        "starter_code": payload.get("starter_code"),
        "test_cases": payload.get("test_cases"),
        "explanation": payload.get("explanation"),
        "stars": _as_int(payload.get("stars"), None),
        "xp": _as_int(payload.get("xp"), 10),
        "sort_order": _as_int(payload.get("sort_order"), 0),
    }

    if use_local_fallback():
        bank = _load_json_bank()
        replaced = False
        for index, existing in enumerate(bank):
            if existing.get("module_id") == module_id and existing.get("question_id") == question_id:
                # Merge rather than replace: the JSON bank carries isiXhosa
                # translation fields (prompt_xh, options_xh, ...) that the
                # dashboard does not edit, and a blind overwrite would delete
                # every translation the moment a lecturer fixed a typo.
                bank[index] = {**existing, **{k: v for k, v in row.items() if v is not None}}
                replaced = True
                break
        if not replaced:
            bank.append({k: v for k, v in row.items() if v is not None})
        _save_json_bank(bank)
        return row

    values = tuple(
        json.dumps(row[col]) if col in _JSON_COLUMNS and row[col] is not None else row[col]
        for col in _EXERCISE_COLUMNS
    )
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO exercises
                (module_id, question_id, type, prompt, options, answer, answers,
                 misconception_map, starter_code, test_cases, explanation,
                 stars, xp, sort_order)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
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
                sort_order = EXCLUDED.sort_order
            """,
            values,
        )
    return row


def delete_exercise(module_id: str, question_id: str) -> None:
    if use_local_fallback():
        bank = _load_json_bank()
        kept = [
            r for r in bank
            if not (r.get("module_id") == module_id and r.get("question_id") == question_id)
        ]
        if len(kept) == len(bank):
            raise LookupError(question_id)
        _save_json_bank(kept)
        return

    with get_cursor() as cur:
        cur.execute(
            "DELETE FROM exercises WHERE module_id = %s AND question_id = %s",
            (module_id, question_id),
        )
