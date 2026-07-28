from ..db import get_cursor
from .sandbox import run_io_challenge


def _load_challenges() -> list[dict]:
    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, title, difficulty, description, hint, io, starter_code, solution, tests
            FROM challenges
            ORDER BY sort_order
            """
        )
        return [dict(row) for row in cur.fetchall()]


def list_challenges() -> list[dict]:
    """Return all challenges (used to render the Challenges screen).

    The reference solution is stripped: it is served separately by
    ``get_solution`` so it never reaches the browser until asked for.
    """
    return [
        {k: v for k, v in challenge.items() if k != "solution"}
        for challenge in _load_challenges()
    ]


def find_challenge(challenge_id: str) -> dict | None:
    for challenge in _load_challenges():
        if challenge["id"] == challenge_id:
            return challenge
    return None


def get_solution(challenge_id: str) -> str | None:
    """Return a challenge's reference solution, or None if there isn't one."""
    challenge = find_challenge(challenge_id)
    if challenge is None:
        return None
    return challenge.get("solution")


_STARS_BY_DIFFICULTY = {"Easy": 10, "Medium": 20, "Hard": 30}


def stars_for_challenge(challenge: dict) -> int:
    return _STARS_BY_DIFFICULTY.get(challenge.get("difficulty"), 10)


def grade_challenge(challenge_id: str, code: str) -> dict:
    """Run submitted code against a challenge's test cases."""
    challenge = find_challenge(challenge_id)
    if challenge is None:
        return {"ok": False, "error": "Challenge not found."}

    outcome = run_io_challenge(code=code, tests=challenge.get("tests", []))
    outcome["stars_awarded"] = stars_for_challenge(challenge) if outcome["all_passed"] else 0
    return {"ok": True, "challenge_id": challenge_id, **outcome}
