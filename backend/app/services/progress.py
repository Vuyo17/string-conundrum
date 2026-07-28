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


def get_user_progress(user_id: str) -> list[dict]:
    """Per-module completion/score, e.g. for GET /api/progress/<uid>."""
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT
                e.module_id,
                COUNT(DISTINCT e.question_id) AS total_questions,
                COUNT(DISTINCT ec.question_id) AS answered_questions,
                COALESCE(SUM(ec.stars_awarded), 0) AS score,
                MAX(ec.completed_at) AS last_session_at
            FROM exercises e
            LEFT JOIN exercise_completions ec
                ON ec.module_id = e.module_id
                AND ec.question_id = e.question_id
                AND ec.user_id = %s
            GROUP BY e.module_id
            ORDER BY MIN(e.sort_order)
            """,
            (user_id,),
        )
        rows = cur.fetchall()

    return [
        {
            "module_id": row["module_id"],
            "completed": row["total_questions"] > 0 and row["answered_questions"] >= row["total_questions"],
            "score": row["score"],
            "last_session_at": row["last_session_at"].isoformat() if row["last_session_at"] else None,
        }
        for row in rows
    ]


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
