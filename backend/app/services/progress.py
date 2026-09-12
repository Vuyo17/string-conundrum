import os

from ..db import get_cursor


def upsert_user(uid: str, email: "str | None", display_name: "str | None") -> None:
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (uid, email, display_name)
            VALUES (%s, %s, %s)
            ON CONFLICT (uid) DO UPDATE SET
                email = EXCLUDED.email,
                display_name = COALESCE(EXCLUDED.display_name, users.display_name),
                updated_at = now()
            """,
            (uid, email, display_name),
        )


def record_exercise_completion(user_id: str, module_id: str, question_id: str, stars: int) -> None:
    """Award stars for a question the first time it's answered correctly. A no-op on repeats."""
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO exercise_completions (user_id, module_id, question_id, stars_awarded)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, module_id, question_id) DO NOTHING
            """,
            (user_id, module_id, question_id, stars),
        )


def record_challenge_completion(user_id: str, challenge_id: str, stars: int) -> None:
    """Award stars the first time a challenge's tests all pass. A no-op on repeats."""
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO challenge_completions (user_id, challenge_id, stars_awarded)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, challenge_id) DO NOTHING
            """,
            (user_id, challenge_id, stars),
        )


def record_section_completion(user_id: str, module_id: str, section_id: str) -> None:
    """Mark a module section (learn/examples/visualize/practice/exam) reached. A no-op on repeats."""
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO module_section_completions (user_id, module_id, section_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, module_id, section_id) DO NOTHING
            """,
            (user_id, module_id, section_id),
        )


def get_section_progress(user_id: str) -> list[dict]:
    """Which sections have been reached per module, e.g. for GET /api/progress/<uid>."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT module_id, array_agg(section_id) AS sections_completed
            FROM module_section_completions
            WHERE user_id = %s
            GROUP BY module_id
            """,
            (user_id,),
        )
        rows = cur.fetchall()

    return [
        {"module_id": row["module_id"], "sections_completed": row["sections_completed"]}
        for row in rows
    ]


def get_bypass_unlocks(user_id: str) -> bool:
    with get_cursor() as cur:
        cur.execute("SELECT bypass_unlocks FROM users WHERE uid = %s", (user_id,))
        row = cur.fetchone()
    return bool(row["bypass_unlocks"]) if row else False


def set_bypass_unlocks(user_id: str, value: bool) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE users SET bypass_unlocks = %s WHERE uid = %s", (value, user_id))


def get_leaderboard_prefs(user_id: str) -> dict:
    """Whether this student appears on the leaderboard, and under what name.

    The leaderboard is opt-in-by-default (so it keeps working for everyone
    who existed before these columns) but a student can turn it off entirely,
    or stay ranked while showing up as "Anonymous", from Settings.
    """
    with get_cursor() as cur:
        cur.execute(
            "SELECT leaderboard_optin, leaderboard_anonymous FROM users WHERE uid = %s",
            (user_id,),
        )
        row = cur.fetchone()
    if not row:
        return {"leaderboard_optin": True, "leaderboard_anonymous": False}
    return {
        "leaderboard_optin": bool(row["leaderboard_optin"]),
        "leaderboard_anonymous": bool(row["leaderboard_anonymous"]),
    }


def set_leaderboard_optin(user_id: str, value: bool) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE users SET leaderboard_optin = %s WHERE uid = %s", (value, user_id))


def set_leaderboard_anonymous(user_id: str, value: bool) -> None:
    with get_cursor() as cur:
        cur.execute("UPDATE users SET leaderboard_anonymous = %s WHERE uid = %s", (value, user_id))


def get_leaderboard(limit: int = 20) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                u.uid,
                u.display_name,
                u.email,
                u.leaderboard_anonymous,
                COALESCE(ex.stars, 0) + COALESCE(ch.stars, 0) AS total_stars
            FROM users u
            LEFT JOIN (
                SELECT user_id, SUM(stars_awarded) AS stars
                FROM exercise_completions
                GROUP BY user_id
            ) ex ON ex.user_id = u.uid
            LEFT JOIN (
                SELECT user_id, SUM(stars_awarded) AS stars
                FROM challenge_completions
                GROUP BY user_id
            ) ch ON ch.user_id = u.uid
            WHERE COALESCE(ex.stars, 0) + COALESCE(ch.stars, 0) > 0
              AND u.leaderboard_optin
            ORDER BY total_stars DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall()

    return [
        {
            "uid": row["uid"],
            "name": "Anonymous" if row["leaderboard_anonymous"]
                else (row["display_name"] or ((row["email"] or "Anonymous").split("@")[0])),
            "stars": row["total_stars"],
        }
        for row in rows
    ]


# ─── roles ───────────────────────────────────────────────────────────────────
# A lecturer is just a user row with role='admin'. Two ways in:
#
#   1. ADMIN_EMAILS -- a comma-separated env allowlist, applied on sign-in.
#      This is the bootstrap: without it the very first lecturer account would
#      have no admin to promote it.
#   2. promote/demote from the dashboard itself, once one lecturer exists.
#
# Deliberately NOT a Firebase custom claim. Claims only reach the backend when
# the client refreshes its ID token (up to an hour later), and they do not
# exist at all under LOCAL_DB_FALLBACK, where the whole point is running with
# no Firebase console access.

ROLE_STUDENT = "student"
ROLE_ADMIN = "admin"
VALID_ROLES = {ROLE_STUDENT, ROLE_ADMIN}


def _admin_emails() -> set:
    raw = os.environ.get("ADMIN_EMAILS", "")
    return {part.strip().casefold() for part in raw.split(",") if part.strip()}


def is_allowlisted_admin(email: "str | None") -> bool:
    return bool(email) and email.casefold() in _admin_emails()


def get_role(user_id: str) -> str:
    with get_cursor() as cur:
        cur.execute("SELECT role FROM users WHERE uid = %s", (user_id,))
        row = cur.fetchone()
    return (row["role"] if row and row.get("role") else ROLE_STUDENT)


def set_role(user_id: str, role: str) -> None:
    if role not in VALID_ROLES:
        raise ValueError(f"unknown role: {role!r}")
    with get_cursor() as cur:
        cur.execute("UPDATE users SET role = %s, updated_at = now() WHERE uid = %s", (role, user_id))


def sync_allowlisted_admin(user_id: str, email: "str | None") -> None:
    """Promote an ADMIN_EMAILS address on sign-in. A no-op for everyone else.

    Called from require_auth, so it runs on every authenticated request -- the
    early return keeps that free for students, and the write is idempotent for
    the handful of lecturer accounts that do match.
    """
    if not is_allowlisted_admin(email):
        return
    if get_role(user_id) != ROLE_ADMIN:
        set_role(user_id, ROLE_ADMIN)


def list_users() -> list[dict]:
    """Every account, for the admin dashboard's student roster."""
    with get_cursor() as cur:
        cur.execute(
            "SELECT uid, email, display_name, role, created_at FROM users"
        )
        rows = cur.fetchall()
    return [dict(row) for row in rows]


# ─── event recording ─────────────────────────────────────────────────────────

# Wrong answers are stored verbatim so a lecturer can see what students
# actually typed, but a write_code answer is a whole program -- capped so one
# pathological submission cannot bloat the table.
_ANSWER_MAX = 500


def record_attempt(
    user_id: str,
    module_id: str,
    question_id: "str | None",
    correct: bool,
    *,
    source: str = "bank",
    misconception_id: "str | None" = None,
    answer_given: "str | None" = None,
    tier: "int | None" = None,
) -> None:
    """Append one graded answer to the analytics event log.

    Never raises. This table exists purely so the lecturer dashboard has
    something to read; a student must never lose a correct answer, a star or a
    module unlock because an analytics insert failed, and every caller sits
    directly in a grading path.
    """
    if answer_given is not None:
        answer_given = str(answer_given)[:_ANSWER_MAX]
    try:
        with get_cursor() as cur:
            cur.execute(
                """
                INSERT INTO attempts
                    (user_id, module_id, question_id, source, correct,
                     misconception_id, answer_given, tier)
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
                """,
                (user_id, module_id, question_id, source, correct,
                 misconception_id, answer_given, tier),
            )
    except Exception:
        pass


def record_exam_attempt(
    user_id: str,
    module_id: str,
    correct_count: int,
    total_count: int,
    percent: int,
    passed: bool,
    stars_awarded: int = 0,
    duration_seconds: "int | None" = None,
) -> None:
    """Store one completed exam paper. Every sitting is kept, including retakes."""
    with get_cursor() as cur:
        cur.execute(
            """
            INSERT INTO exam_attempts
                (user_id, module_id, correct_count, total_count, percent,
                 passed, stars_awarded, duration_seconds)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (user_id, module_id, correct_count, total_count, percent,
             passed, stars_awarded, duration_seconds),
        )
