"""Concurrency guarantees for the LOCAL_DB_FALLBACK JSON store.

These cover a failure that reached the lecturer dashboard in use: the same
endpoint answered 200 and then 403 for the same signed-in lecturer, seconds
apart, and created modules sometimes vanished.

Both had one cause. Every fallback statement read the whole state file,
changed part of it, and wrote it back, with no atomicity anywhere:

  * save_state() truncated the file and then wrote it, so a concurrent reader
    could observe it empty. load_state() treated an unparseable file as an
    empty database, so a lecturer's user row simply was not there, get_role()
    returned 'student', and require_admin refused them.
  * Two threads reading, changing and writing the whole file interleaved, so
    the second write discarded the first.

The Flask development server is threaded and the dashboard issues several
requests in parallel, so both were reached routinely rather than rarely.
"""

import os
import threading

import pytest

from app.services import analytics, progress

# Enough threads and iterations to interleave reliably. The original code
# failed these within the first few iterations; the numbers are kept modest so
# the suite stays fast.
THREADS = 6
PER_THREAD = 25


@pytest.fixture(autouse=True)
def fallback_state(tmp_path, monkeypatch):
    if os.environ.get("DATABASE_URL"):
        pytest.skip("these assert on the JSON fallback's own behaviour, not Postgres")
    monkeypatch.setenv("LOCAL_DB_STATE_PATH", str(tmp_path / "state.json"))


def _run(target, *args):
    """Run target in several threads, surfacing any exception they raise."""
    errors = []

    def wrapped(*call_args):
        try:
            target(*call_args)
        except BaseException as exc:  # noqa: BLE001 - re-raised on the main thread
            errors.append(exc)

    threads = [threading.Thread(target=wrapped, args=args) for _ in range(THREADS)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    if errors:
        raise errors[0]


def test_a_lecturers_role_survives_concurrent_requests():
    """The 403-at-random bug: a torn read must never look like 'no such user'."""
    progress.upsert_user("lecturer-1", "lect@example.com", "Lect")
    progress.set_role("lecturer-1", progress.ROLE_ADMIN)

    seen = []

    def hammer():
        for _ in range(PER_THREAD):
            # What every authenticated request does: upsert the caller, then
            # resolve their role.
            progress.upsert_user("lecturer-1", "lect@example.com", "Lect")
            seen.append(progress.get_role("lecturer-1"))

    _run(hammer)

    assert len(seen) == THREADS * PER_THREAD
    assert set(seen) == {progress.ROLE_ADMIN}, (
        "a concurrent read reported the lecturer as a student, which is what "
        "made require_admin return 403 at random"
    )


def test_concurrent_writes_are_not_discarded():
    """The vanishing-module bug: interleaved read-modify-write must not lose rows."""
    progress.upsert_user("student-1", "s1@example.com", "S1")

    def hammer():
        name = threading.current_thread().name
        for index in range(PER_THREAD):
            progress.record_attempt(
                "student-1", "intro", f"{name}-{index}", False,
                misconception_id="strings_need_quotes",
            )

    _run(hammer)

    assert len(analytics._all_attempts()) == THREADS * PER_THREAD


def test_an_unreadable_state_file_raises_rather_than_reporting_an_empty_cohort():
    """Corruption must not be reported as 'no users, no progress, no marks'.

    Silently substituting an empty state is what turned a transient read
    failure into a wrong answer about who a user is. A broken environment
    should be visible as a broken environment.
    """
    from app import storage

    storage.save_state(storage.load_state())
    storage._state_path().write_text("{ this is not json", encoding="utf-8")

    with pytest.raises(RuntimeError, match="could not be read"):
        storage.load_state()


def test_a_missing_state_file_is_still_an_empty_state():
    """A fresh environment is not an error -- only an unreadable one is."""
    from app import storage

    assert not storage._state_path().exists()
    assert storage.load_state()["users"] == {}


def test_a_reader_never_observes_a_partially_written_file():
    """save_state must swap the file atomically, not truncate and refill it."""
    from app import storage

    progress.upsert_user("student-2", "s2@example.com", "S2")
    torn = []

    def writer():
        for index in range(PER_THREAD):
            progress.record_attempt("student-2", "intro", f"w-{index}", True)

    def reader():
        for _ in range(PER_THREAD * 2):
            try:
                storage.load_state()
            except RuntimeError:
                torn.append(1)

    threads = [threading.Thread(target=writer), threading.Thread(target=reader)]
    for thread in threads:
        thread.start()
    for thread in threads:
        thread.join()

    assert not torn, "a reader saw a half-written state file"
