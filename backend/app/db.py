import json
import os
import threading
from contextlib import contextmanager
from datetime import datetime, timezone

try:
    import psycopg2
    import psycopg2.extras
except ModuleNotFoundError:
    # The point of the local fallback is running without Postgres, and
    # psycopg2-binary ships no wheel for some Python/OS combinations — on
    # Python 3.14 for Windows it tries to build from source and fails. A hard
    # import here made the fallback unusable on exactly the machines that
    # needed it. Absence is only an error if a real DSN is actually used.
    psycopg2 = None

from .storage import load_state, save_state

# Serialises the fallback's read-modify-write cycle within this process.
#
# Every fallback statement reads the whole state file, changes part of it and
# writes it back. Two threads doing that at once interleave, and the second
# write silently discards the first -- a created module, a recorded attempt, a
# role change, gone. The Flask development server is threaded, and the
# lecturer dashboard issues several requests in parallel, so this was not
# theoretical: it dropped writes and, combined with a torn read, made
# require_admin refuse a lecturer at random.
#
# Reentrant because a service function already inside a cursor block may call
# another that opens its own. This protects one process only; the fallback has
# always been a single-process development aid, and DATABASE_URL is the
# supported path for anything else.
_FALLBACK_LOCK = threading.RLock()

# The JSON-file fallback is opt-in, and only ever opt-in.
#
# Keying it off "DATABASE_URL happens to be unset" looked convenient but meant
# a missing or misspelt DSN in production degraded silently to a local file
# instead of failing: the app kept answering 200s, and the deploy's
# database-backed smoke checks passed over a database nobody was talking to.
# Requiring an explicit flag keeps that failure loud where it matters and
# convenient only where it was wanted.
_FALLBACK_ENV = "LOCAL_DB_FALLBACK"
_TRUTHY = {"1", "true", "yes", "on"}


def use_local_fallback() -> bool:
    """True when the app should read and write the local JSON state file.

    A real DATABASE_URL always wins, so setting the flag on a deployed host
    cannot accidentally take it off Postgres.
    """
    if os.environ.get("DATABASE_URL"):
        return False
    return os.environ.get(_FALLBACK_ENV, "").strip().lower() in _TRUTHY


def _dsn() -> str:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError(
            "DATABASE_URL is not set, e.g. "
            "postgresql://string_conundrum_app:PASSWORD@127.0.0.1:5432/string_conundrum"
            f" (or set {_FALLBACK_ENV}=1 to run against the local JSON state file)"
        )
    if psycopg2 is None:
        raise RuntimeError(
            "DATABASE_URL is set but psycopg2 is not installed. Install "
            "psycopg2-binary, or unset DATABASE_URL and set "
            f"{_FALLBACK_ENV}=1 to use the local JSON state file."
        )
    return dsn


def _now_iso() -> str:
    """Postgres fills created_at with now(); the JSON fallback has to do it itself."""
    return datetime.now(timezone.utc).isoformat()


def _json_param(value):
    """Undo a caller's json.dumps() so the fallback stores a plain object.

    Callers build params the way a real psycopg2/Postgres jsonb column
    needs -- json.dumps(section_ids), json.dumps(content) -- so this
    in-memory store must decode those strings back before storing them,
    or an isinstance(value, list/dict) check downstream never matches.
    """
    if isinstance(value, str):
        try:
            return json.loads(value)
        except (TypeError, ValueError):
            return value
    return value


def _key(*parts: str) -> str:
    """Flatten a composite primary key into one string.

    JSON object keys must be strings; a tuple key raises TypeError in
    json.dumps, so the composite keys are joined rather than kept as tuples.
    """
    return "|".join(parts)


class _LocalCursor:
    """Just enough of a psycopg2 cursor to run the app off a JSON file.

    Dispatch is by substring match on the SQL, so it only understands the
    statements this app actually issues. Anything else returns no rows, which
    is why this is a development aid and not a general Postgres substitute.
    """

    def __init__(self, state: dict):
        self.state = state
        self._rows: list[dict] = []
        # Only a statement that changed something needs writing back. Saving
        # after a plain SELECT rewrote the entire file on every read, which
        # multiplied the amount of contention for no gain.
        self._dirty = False

    def __enter__(self):
        return self

    def __exit__(self, exc_type, exc, tb):
        if exc_type is None and self._dirty:
            save_state(self.state)
        return False

    def execute(self, query: str, params=None):
        # Reset first: without this, an INSERT following a SELECT would leave
        # the SELECT's rows in place for the next fetchall().
        self._rows = []
        state = self.state

        # Decided once here rather than in each of the branches below, so a
        # new write branch cannot be added without its result being persisted.
        if "INSERT INTO" in query or "UPDATE " in query or "DELETE FROM" in query:
            self._dirty = True

        if "INSERT INTO users" in query:
            # The real query is an upsert — ON CONFLICT (uid) DO UPDATE SET
            # email=..., display_name=... — that only ever touches those two
            # columns, leaving bypass_unlocks/leaderboard prefs alone on a
            # returning user. require_auth() runs this on every single
            # authenticated request, not just first login, so replacing the
            # whole record here (rather than merging into it) silently reset
            # bypass_unlocks/leaderboard_optin/leaderboard_anonymous back to
            # their defaults on the very next request after anyone changed
            # them — e.g. Settings' "Unlock everything" toggle would flip on,
            # then revert the moment any other authenticated call fired.
            uid, email, display_name = params
            existing = state["users"].get(uid, {})
            state["users"][uid] = {
                "uid": uid,
                "email": email,
                "display_name": display_name if display_name is not None else existing.get("display_name"),
                "role": existing.get("role", "student"),
                "bypass_unlocks": existing.get("bypass_unlocks", False),
                "leaderboard_optin": existing.get("leaderboard_optin", True),
                "leaderboard_anonymous": existing.get("leaderboard_anonymous", False),
            }

        elif "SELECT bypass_unlocks FROM users" in query:
            row = state["users"].get(params[0])
            if row:
                self._rows = [{"bypass_unlocks": row.get("bypass_unlocks", False)}]

        elif "UPDATE users SET bypass_unlocks" in query:
            value, user_id = params[0], params[1]
            user = state["users"].get(user_id)
            if user is not None:
                user["bypass_unlocks"] = bool(value)

        elif "SELECT leaderboard_optin, leaderboard_anonymous FROM users" in query:
            row = state["users"].get(params[0])
            if row:
                self._rows = [{
                    "leaderboard_optin": row.get("leaderboard_optin", True),
                    "leaderboard_anonymous": row.get("leaderboard_anonymous", False),
                }]

        elif "UPDATE users SET leaderboard_optin" in query:
            value, user_id = params[0], params[1]
            user = state["users"].get(user_id)
            if user is not None:
                user["leaderboard_optin"] = bool(value)

        elif "UPDATE users SET leaderboard_anonymous" in query:
            value, user_id = params[0], params[1]
            user = state["users"].get(user_id)
            if user is not None:
                user["leaderboard_anonymous"] = bool(value)

        elif "INSERT INTO exercise_completions" in query:
            user_id, module_id, question_id, stars = params
            state["exercise_completions"][_key(user_id, module_id, question_id)] = {
                "user_id": user_id,
                "module_id": module_id,
                "question_id": question_id,
                "stars_awarded": stars,
                "completed_at": _now_iso(),
            }

        elif "INSERT INTO challenge_completions" in query:
            user_id, challenge_id, stars = params
            state["challenge_completions"][_key(user_id, challenge_id)] = {
                "user_id": user_id,
                "challenge_id": challenge_id,
                "stars_awarded": stars,
                "completed_at": _now_iso(),
            }

        elif "INSERT INTO module_section_completions" in query:
            user_id, module_id, section_id = params
            state["module_section_completions"][_key(user_id, module_id, section_id)] = {
                "user_id": user_id,
                "module_id": module_id,
                "section_id": section_id,
                "completed_at": _now_iso(),
            }

        elif "SELECT module_id, array_agg" in query:
            user_id = params[0]
            grouped: dict[str, list[str]] = {}
            for value in state["module_section_completions"].values():
                if value["user_id"] == user_id:
                    grouped.setdefault(value["module_id"], []).append(value["section_id"])
            self._rows = [
                {"module_id": module_id, "sections_completed": sorted(set(sections))}
                for module_id, sections in grouped.items()
            ]

        # ─── admin dashboard ────────────────────────────────────────────
        # The analytics service deliberately fetches whole rows and
        # aggregates in Python rather than issuing GROUP BY/window queries.
        # That costs a little at Postgres scale (a class-sized cohort, not a
        # warehouse) and buys one code path that also runs here, so the
        # lecturer dashboard is demonstrable on a laptop with no Postgres —
        # which is the configuration this project's own README falls back to
        # on Windows.

        elif "SELECT role FROM users" in query:
            row = state["users"].get(params[0])
            if row:
                self._rows = [{"role": row.get("role", "student")}]

        elif "UPDATE users SET role" in query:
            value, user_id = params[0], params[1]
            user = state["users"].get(user_id)
            if user is not None:
                user["role"] = value

        elif "FROM users" in query and "SELECT uid" in query:
            self._rows = [
                {
                    "uid": u["uid"],
                    "email": u.get("email"),
                    "display_name": u.get("display_name"),
                    "role": u.get("role", "student"),
                    "created_at": u.get("created_at"),
                }
                for u in state["users"].values()
            ]

        elif "INSERT INTO attempts" in query:
            (user_id, module_id, question_id, source, correct,
             misconception_id, answer_given, tier) = params
            state["attempts"].append({
                "user_id": user_id,
                "module_id": module_id,
                "question_id": question_id,
                "source": source,
                "correct": bool(correct),
                "misconception_id": misconception_id,
                "answer_given": answer_given,
                "tier": tier,
                "created_at": _now_iso(),
            })

        elif "FROM attempts" in query:
            self._rows = list(state["attempts"])

        elif "INSERT INTO exam_attempts" in query:
            (user_id, module_id, correct_count, total_count, percent,
             passed, stars_awarded, duration_seconds) = params
            state["exam_attempts"].append({
                "user_id": user_id,
                "module_id": module_id,
                "correct_count": correct_count,
                "total_count": total_count,
                "percent": percent,
                "passed": bool(passed),
                "stars_awarded": stars_awarded,
                "duration_seconds": duration_seconds,
                "created_at": _now_iso(),
            })

        elif "FROM exam_attempts" in query:
            self._rows = list(state["exam_attempts"])

        elif "SELECT user_id, module_id, question_id, stars_awarded" in query:
            self._rows = list(state["exercise_completions"].values())

        elif "SELECT user_id, challenge_id, stars_awarded" in query:
            self._rows = list(state["challenge_completions"].values())

        elif "SELECT user_id, module_id, section_id" in query:
            self._rows = list(state["module_section_completions"].values())

        elif "INSERT INTO modules" in query:
            if len(params) >= 10:
                (module_id, title, description, minutes, level, objectives,
                 section_ids, content, sort_order, published) = params
            else:
                (module_id, title, description, minutes, level, objectives,
                 sort_order, published) = params
                section_ids = ["learn", "examples", "visualize", "practice", "exam"]
                content = {}
            # admin_content.py always json.dumps() section_ids/content before
            # passing them, since that is what a real Postgres jsonb column
            # needs. This fallback stores plain Python objects, so those
            # strings must be decoded back first -- otherwise isinstance()
            # below never matches and every write silently reverts to the
            # 5-section default, discarding whatever a lecturer actually set.
            section_ids = _json_param(section_ids)
            content = _json_param(content)
            existing = state["modules"].get(module_id, {})
            state["modules"][module_id] = {
                "id": module_id,
                "title": title,
                "description": description,
                "minutes": minutes,
                "level": level,
                "objectives": objectives,
                "section_ids": section_ids if isinstance(section_ids, list) else ["learn", "examples", "visualize", "practice", "exam"],
                "content": content if isinstance(content, dict) else {},
                "sort_order": sort_order,
                "published": bool(published),
                "archived": existing.get("archived", False),
                "created_at": existing.get("created_at", _now_iso()),
                "updated_at": _now_iso(),
            }

        elif "UPDATE modules SET" in query:
            # Params are (title, description, minutes, level, objectives,
            # section_ids, content, sort_order, published, archived, id) --
            # the same column order admin_content.update_module builds.
            if len(params) >= 11:
                (title, description, minutes, level, objectives,
                 section_ids, content, sort_order, published, archived, module_id) = params
            else:
                (title, description, minutes, level, objectives, sort_order,
                 published, archived, module_id) = params
                section_ids = ["learn", "examples", "visualize", "practice", "exam"]
                content = {}
            # See the matching comment in the INSERT INTO modules branch above.
            section_ids = _json_param(section_ids)
            content = _json_param(content)
            row = state["modules"].get(module_id)
            if row is not None:
                row.update({
                    "title": title,
                    "description": description,
                    "minutes": minutes,
                    "level": level,
                    "objectives": objectives,
                    "section_ids": section_ids if isinstance(section_ids, list) else ["learn", "examples", "visualize", "practice", "exam"],
                    "content": content if isinstance(content, dict) else {},
                    "sort_order": sort_order,
                    "published": bool(published),
                    "archived": bool(archived),
                    "updated_at": _now_iso(),
                })

        elif "DELETE FROM modules" in query:
            state["modules"].pop(params[0], None)

        elif "FROM modules" in query:
            self._rows = list(state["modules"].values())

        # Everything else — leaderboards, the exercise bank — has no local
        # equivalent. Content is read from the JSON files by the services
        # themselves, not through this cursor.

    def fetchall(self) -> list[dict]:
        return list(self._rows)

    def fetchone(self) -> "dict | None":
        return self._rows[0] if self._rows else None


class _LocalConn:
    """A psycopg2-shaped connection over the JSON state file."""

    def __init__(self):
        self._state = load_state()

    def commit(self):
        save_state(self._state)

    def rollback(self):
        # Drop the in-memory edits by re-reading what is actually on disk.
        self._state = load_state()

    def close(self):
        pass

    def cursor(self, cursor_factory=None):
        return _LocalCursor(self._state)


@contextmanager
def get_connection():
    if use_local_fallback():
        # Held across the whole block, so load -> mutate -> save is atomic
        # with respect to any other thread in this process.
        with _FALLBACK_LOCK:
            conn = _LocalConn()
            try:
                yield conn
                conn.commit()
            except Exception:
                conn.rollback()
                raise
            finally:
                conn.close()
        return

    # Resolve the DSN first: `psycopg2.connect(_dsn())` evaluates the
    # attribute before the argument, so a missing psycopg2 raised an opaque
    # AttributeError instead of the explanatory error _dsn() raises.
    dsn = _dsn()
    conn = psycopg2.connect(dsn)
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_cursor():
    if use_local_fallback():
        with _FALLBACK_LOCK:
            with _LocalCursor(load_state()) as cur:
                yield cur
        return

    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
