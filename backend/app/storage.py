import json
import os
import tempfile
import time
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
        # Lecturer-managed module metadata, keyed by module id.
        "modules": {},
        # Append-only event logs backing the admin dashboard. Lists, not
        # dicts: there is no natural composite key (a student answers the
        # same question many times, and every one of those attempts is the
        # point), and order is the history.
        "attempts": [],
        "exam_attempts": [],
    }


# A read that lands mid-write used to be indistinguishable from an empty
# database, which is a far worse failure than it sounds: load_state() returned
# a state with no users, get_role() then found no row for a signed-in
# lecturer, and require_admin refused them with a 403. The dashboard fires
# several requests in parallel, so the same endpoint would answer 200 and then
# 403 seconds apart for the same account. save_state() below is now atomic, so
# a torn read should no longer be possible; these retries cover the residual
# case of another process writing without going through this module.
_READ_RETRIES = 3
_READ_RETRY_DELAY = 0.05


def load_state() -> dict:
    path = _state_path()
    if not path.exists():
        return _default_state()

    last_error = None
    for attempt in range(_READ_RETRIES):
        try:
            loaded = json.loads(path.read_text(encoding="utf-8"))
            break
        except (json.JSONDecodeError, OSError) as exc:
            last_error = exc
            if attempt < _READ_RETRIES - 1:
                time.sleep(_READ_RETRY_DELAY)
    else:
        # Deliberately NOT a silent fall back to an empty state. An unreadable
        # state file is a broken environment, and reporting it as "no users,
        # no progress, no marks" invites acting on data that is simply absent
        # -- demoting a lecturer, or telling one that nobody has attempted
        # anything. Shape problems below are still tolerated; total
        # unreadability is not.
        raise RuntimeError(
            f"local state file at {path} could not be read: {last_error}. "
            "Delete it to start from an empty state, or fix the JSON."
        ) from last_error

    state = _default_state()
    if isinstance(loaded, dict):
        for key, default in state.items():
            value = loaded.get(key)
            # Guard the shape rather than trusting the file: a hand-edited or
            # half-written state file should reset that section, not crash
            # every request that touches it. The event logs are lists while
            # everything else is a dict, so the check follows the default's
            # own type rather than assuming dict.
            if isinstance(value, type(default)):
                state[key] = value
    return state


# Windows refuses a rename onto a file another handle currently has open, and
# on-access virus scanning routinely holds a just-written file open for a few
# milliseconds. Neither is a real error, so a replace that fails this way is
# retried briefly before being reported. POSIX never needs this.
_REPLACE_RETRIES = 10
_REPLACE_RETRY_DELAY = 0.02


def _replace_with_retry(source: str, target: Path) -> None:
    for attempt in range(_REPLACE_RETRIES):
        try:
            os.replace(source, target)
            return
        except PermissionError:
            if attempt == _REPLACE_RETRIES - 1:
                raise
            time.sleep(_REPLACE_RETRY_DELAY)


def save_state(state: dict) -> None:
    """Write the state file atomically.

    write_text() truncates the file and then writes into it, so any concurrent
    reader could observe it empty or half-written. Writing to a temporary file
    in the same directory and then replacing the target makes the swap atomic
    at the filesystem level (os.replace is atomic on both Windows and POSIX),
    so a reader sees either the complete previous state or the complete new
    one, never a torn file.
    """
    path = _state_path()
    path.parent.mkdir(parents=True, exist_ok=True)
    payload = json.dumps(state, indent=2, sort_keys=True)

    # Same directory as the target: os.replace cannot be atomic across
    # filesystems, and the system temp directory is often a different one.
    handle, tmp_name = tempfile.mkstemp(dir=str(path.parent), prefix=".state-", suffix=".tmp")
    try:
        with os.fdopen(handle, "w", encoding="utf-8") as tmp_file:
            tmp_file.write(payload)
            tmp_file.flush()
            os.fsync(tmp_file.fileno())
        _replace_with_retry(tmp_name, path)
    except BaseException:
        # Never leave a stray .state-*.tmp behind on a failed write.
        try:
            os.unlink(tmp_name)
        except OSError:
            pass
        raise
