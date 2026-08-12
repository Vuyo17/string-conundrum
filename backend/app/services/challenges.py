import json
from pathlib import Path

from ..db import get_cursor, use_local_fallback
from .i18n import normalise_lang
from .sandbox import run_io_challenge

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"


def _load_json_challenges() -> list[dict]:
    path = _DATA_DIR / "challenges.json"
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []


def _load_challenges() -> list[dict]:
    # Deliberately not wrapped in try/except. A database error here used to be
    # swallowed and answered from JSON, which turned a broken or out-of-date
    # schema into a silent content downgrade — and kept the deploy's
    # database-backed smoke checks green while they were meant to catch it.
    if use_local_fallback():
        return _load_json_challenges()

    with get_cursor() as cur:
        cur.execute(
            """
            SELECT id, title, difficulty, description, hint, io, starter_code, solution, tests,
                   title_xh, description_xh, hint_xh, io_xh
            FROM challenges
            ORDER BY sort_order
            """
        )
        return [dict(row) for row in cur.fetchall()]


def _localise(challenge: dict, lang: str) -> dict:
    """Swap in `<field>_<lang>` variants where the bank carries them.

    Mirrors `feedback._localise`. Fields are localised individually, so a
    challenge with a translated description but an untranslated hint still
    renders rather than being skipped. `starter_code`, `solution` and `tests`
    are never localised: they are Python that has to run, and the tests are
    compared literally against program output.
    """
    if lang == "en":
        return challenge
    out = dict(challenge)
    for field in ("title", "description", "hint", "io"):
        translated = challenge.get(f"{field}_{lang}")
        if translated:
            out[field] = translated
    return out


def list_challenges(lang: "str | None" = None) -> list[dict]:
    """Return all challenges (used to render the Challenges screen).

    The reference solution is stripped: it is served separately by
    ``get_solution`` so it never reaches the browser until asked for. The
    `_xh` columns are dropped too — the caller gets one localised `title`,
    not both languages.
    """
    lang = normalise_lang(lang)
    return [
        {
            k: v
            for k, v in _localise(challenge, lang).items()
            if k != "solution" and not k.endswith("_xh")
        }
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
