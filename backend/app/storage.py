import json
import os
from pathlib import Path

# app/data, NOT backend/data. This file lives in app/, one level shallower
# than services/challenges.py, so copying that module's `parent.parent /
# "data"` landed a directory too high — creating a stray backend/data/ and
# putting the state file somewhere .gitignore was not looking.
_DATA_DIR = Path(__file__).resolve().parent / "data"

# Where the local fallback keeps its state. Overridable so tests (and anyone
# running two instances side by side) do not write over the working copy.
_STATE_PATH_ENV = "LOCAL_DB_STATE_PATH"


def _state_path() -> Path:
    override = os.environ.get(_STATE_PATH_ENV, "").strip()
    if override:
        return Path(override)
    return _DATA_DIR / "local_state.json"


def _default_state() -> dict:
    return {
        "users": {},
        "exercise_completions": {},
        "challenge_completions": {},
        "module_section_completions": {},
    }


def load_state() -> dict:
    path = _state_path()
    if not path.exists():
        return _default_state()
    try:
        loaded = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return _default_state()

    state = _default_state()
    if isinstance(loaded, dict):
        for key in state:
            value = loaded.get(key)
            # Guard the shape rather than trusting the file: a hand-edited or
            # half-written state file should reset that section, not crash
            # every request that touches it.
            if isinstance(value, dict):
                state[key] = value
    return state


def save_state(state: dict) -> None:
    path = _state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(state, indent=2, sort_keys=True), encoding="utf-8")


def load_json_file(name: str) -> list[dict]:
    path = _DATA_DIR / name
    if not path.exists():
        return []
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return data if isinstance(data, list) else []
