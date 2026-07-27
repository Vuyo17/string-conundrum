import json
from pathlib import Path

from .sandbox import run_io_challenge

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "challenges.json"


def _load_challenges() -> list[dict]:
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


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


def grade_challenge(challenge_id: str, code: str) -> dict:
    """Run submitted code against a challenge's test cases."""
    challenge = find_challenge(challenge_id)
    if challenge is None:
        return {"ok": False, "error": "Challenge not found."}

    outcome = run_io_challenge(code=code, tests=challenge.get("tests", []))
    return {"ok": True, "challenge_id": challenge_id, **outcome}
