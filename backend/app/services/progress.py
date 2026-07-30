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


def get_leaderboard(limit: int = 20) -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                u.uid,
                u.display_name,
                u.email,
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
            ORDER BY total_stars DESC
            LIMIT %s
            """,
            (limit,),
        )
        rows = cur.fetchall()

    return [
        {
            "uid": row["uid"],
            "name": row["display_name"] or ((row["email"] or "Anonymous").split("@")[0]),
            "stars": row["total_stars"],
        }
        for row in rows
    ]
