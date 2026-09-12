"""Generate a cohort of fake students so the lecturer dashboard has something to show.

Why this exists: the attempts and exam_attempts tables only start filling on
the day they are deployed, so a dashboard demoed before any student has used
the new build is a grid of dashes. This populates it with a plausible cohort
-- a spread of strong, middling and struggling students, realistic
misconception patterns, and activity spread over the past six weeks -- so the
views can be shown working.

The data is FAKE and it is labelled as such. Every account it creates has a
uid prefixed `demo-` and a name marked "(demo)", so nothing it writes can be
mistaken for a real student's mark in a screenshot, an export, or the
database.

    python -m db.seed_demo_data --students 40        # write
    python -m db.seed_demo_data --clear              # remove every demo- row
    python -m db.seed_demo_data --students 40 --clear-first

Run from the backend/ directory, with the same DATABASE_URL (or
LOCAL_DB_FALLBACK=1) the app itself uses.
"""

import argparse
import os
import random
import sys
from contextlib import contextmanager
from datetime import datetime, timedelta, timezone

sys.path.insert(0, ".")

from app.db import use_local_fallback  # noqa: E402
from app.services import admin_content  # noqa: E402
from app.services.analytics import GATING_SECTIONS  # noqa: E402

DEMO_PREFIX = "demo-"

FIRST_NAMES = [
    "Thandiwe", "Sipho", "Aisha", "Lerato", "Kagiso", "Nomsa", "Tebogo", "Zanele",
    "Farai", "Mpho", "Ayanda", "Bongani", "Chipo", "Dineo", "Ethan", "Fatima",
    "Gugu", "Hlomla", "Imran", "Jabu", "Karabo", "Lindiwe", "Musa", "Naledi",
    "Olwethu", "Palesa", "Refilwe", "Sibusiso", "Thabo", "Unathi", "Vuyo", "Wandile",
    "Xolani", "Yolanda", "Zodwa", "Amahle", "Buhle", "Cebo", "Didi", "Esihle",
]
SURNAMES = [
    "Mokoena", "Dlamini", "Nkosi", "Botha", "Patel", "Khumalo", "Naidoo", "Mahlangu",
    "Van Wyk", "Sithole", "Adams", "Molefe", "Jacobs", "Ndlovu", "Pillay", "Zulu",
]

# Misconception ids drawn from the real catalogue, so the analytics view shows
# ids a lecturer will recognise rather than invented strings. Keyed by module,
# because a slicing misconception firing inside the intro module would be an
# obvious tell that the data is synthetic.
MISCONCEPTIONS = {
    "intro": ["strings_need_quotes", "escape_counts_as_two"],
    "indexing": ["off_by_one_index", "negative_index_confusion"],
    "slicing": ["stop_index_inclusive", "negative_index_confusion", "step_direction"],
    "immutability": ["strings_mutable_in_place", "method_mutates_original"],
    "comparison": ["case_insensitive_compare", "lexicographic_vs_length"],
    "looping": ["loop_yields_index_not_char", "off_by_one_index"],
    "methods": ["method_mutates_original", "method_returns_none"],
    "formatting": ["fstring_missing_f", "format_spec_confusion"],
}

# Three bands, so the dashboard's at-risk flag, class average and the spread
# on the marks table all have something real to separate.
BANDS = [
    # (label, share of cohort, ability, how far through the course)
    ("strong", 0.30, (0.82, 0.97), (0.85, 1.00)),
    ("middling", 0.45, (0.58, 0.80), (0.45, 0.85)),
    ("struggling", 0.25, (0.30, 0.56), (0.15, 0.50)),
]


def _challenge_ids() -> list:
    """Real challenge ids from the bank, so the demo never invents one."""
    import json
    from pathlib import Path

    path = Path(__file__).resolve().parent.parent / "app" / "data" / "challenges.json"
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return []
    return [c["id"] for c in data if isinstance(c, dict) and c.get("id")]


CHALLENGE_IDS = _challenge_ids()


def _now():
    return datetime.now(timezone.utc)


def _stamp(days_ago: float):
    return _now() - timedelta(days=days_ago, hours=random.uniform(0, 23))


# Both backends assume one statement per web request, and a seeder issues tens
# of thousands of them, so both need batching or a 40-student cohort takes
# minutes:
#
#   * The JSON fallback re-reads and re-writes the whole state file per
#     statement (see _LocalConn in app/db.py) -- about 9,000 rewrites of a
#     growing file. So it holds ONE state dict in memory and flushes once.
#   * get_cursor() opens and closes a Postgres CONNECTION per statement. That
#     measured at five and a half minutes for 40 students; one reused
#     connection does the same work in seconds.
#
# _flush() finishes whichever of the two is in play.
_BUFFER = None
_CONNECTION = None


@contextmanager
def _cursor():
    """One long-lived Postgres connection for the whole seeding run."""
    # Imported here rather than at module scope so the fallback path, which
    # never reaches this function, still runs on a machine with no psycopg2 --
    # the same reason app/db.py guards its own import.
    import psycopg2
    import psycopg2.extras

    global _CONNECTION
    if _CONNECTION is None:
        _CONNECTION = psycopg2.connect(os.environ["DATABASE_URL"])
    with _CONNECTION.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
        yield cur


def _buffer():
    global _BUFFER
    if _BUFFER is None:
        from app.storage import load_state

        _BUFFER = load_state()
    return _BUFFER


def _flush():
    global _BUFFER, _CONNECTION
    if _BUFFER is not None:
        from app.storage import save_state

        save_state(_BUFFER)
        _BUFFER = None
    if _CONNECTION is not None:
        _CONNECTION.commit()
        _CONNECTION.close()
        _CONNECTION = None


def clear_demo_rows() -> int:
    """Delete every demo- account. Cascades take the attempts and marks with them."""
    if use_local_fallback():
        state = _buffer()
        removed = [uid for uid in state["users"] if uid.startswith(DEMO_PREFIX)]
        for uid in removed:
            del state["users"][uid]
        for table in ("exercise_completions", "challenge_completions", "module_section_completions"):
            for key in [k for k in state[table] if k.startswith(DEMO_PREFIX)]:
                del state[table][key]
        for table in ("attempts", "exam_attempts"):
            state[table] = [r for r in state[table] if not r["user_id"].startswith(DEMO_PREFIX)]
        _flush()
        return len(removed)

    with _cursor() as cur:
        cur.execute("DELETE FROM users WHERE uid LIKE %s", (DEMO_PREFIX + "%",))
    return -1  # row count is not exposed through the cursor wrapper


def _insert_user(uid: str, name: str, email: str) -> None:
    if use_local_fallback():
        _buffer()["users"][uid] = {
            "uid": uid, "email": email, "display_name": name, "role": "student",
            "bypass_unlocks": False, "leaderboard_optin": True,
            "leaderboard_anonymous": False,
        }
        return

    with _cursor() as cur:
        cur.execute(
            """
            INSERT INTO users (uid, email, display_name)
            VALUES (%s, %s, %s)
            ON CONFLICT (uid) DO UPDATE SET
                email = EXCLUDED.email, display_name = EXCLUDED.display_name
            """,
            (uid, email, name),
        )


def _insert_attempt(uid, module_id, question_id, source, correct, misconception, when):
    """Insert one attempt, backdated.

    The app's own record_attempt() lets the database stamp created_at with
    now(), which would pile the whole synthetic cohort onto today and make
    every "activity over time" reading meaningless. This writes created_at
    explicitly instead, which is the one thing the seeder needs that the
    production path deliberately does not offer.
    """
    if use_local_fallback():
        _buffer()["attempts"].append({
            "user_id": uid, "module_id": module_id, "question_id": question_id,
            "source": source, "correct": correct, "misconception_id": misconception,
            "answer_given": None, "tier": None, "created_at": when.isoformat(),
        })
        return

    with _cursor() as cur:
        cur.execute(
            """
            INSERT INTO attempts (user_id, module_id, question_id, source, correct,
                                  misconception_id, answer_given, tier, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, NULL, NULL, %s)
            """,
            (uid, module_id, question_id, source, correct, misconception, when),
        )


def _insert_exam(uid, module_id, correct_count, total_count, percent, passed, when):
    if use_local_fallback():
        _buffer()["exam_attempts"].append({
            "user_id": uid, "module_id": module_id, "correct_count": correct_count,
            "total_count": total_count, "percent": percent, "passed": passed,
            "stars_awarded": 3 if percent >= 85 else 2 if percent >= 70 else 1,
            "duration_seconds": random.randint(300, 1500), "created_at": when.isoformat(),
        })
        return

    with _cursor() as cur:
        cur.execute(
            """
            INSERT INTO exam_attempts (user_id, module_id, correct_count, total_count,
                                       percent, passed, stars_awarded, duration_seconds, created_at)
            VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s)
            """,
            (uid, module_id, correct_count, total_count, percent, passed,
             3 if percent >= 85 else 2 if percent >= 70 else 1,
             random.randint(300, 1500), when),
        )


def _insert_challenge(uid, challenge_id, when=None):
    if use_local_fallback():
        _buffer()["challenge_completions"]["|".join((uid, challenge_id))] = {
            "user_id": uid, "challenge_id": challenge_id, "stars_awarded": 3,
            "completed_at": (when or _now()).isoformat(),
        }
        return

    with _cursor() as cur:
        cur.execute(
            """
            INSERT INTO challenge_completions (user_id, challenge_id, stars_awarded)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, challenge_id) DO NOTHING
            """,
            (uid, challenge_id, 3),
        )


def _insert_section(uid, module_id, section_id, when=None):
    if use_local_fallback():
        _buffer()["module_section_completions"]["|".join((uid, module_id, section_id))] = {
            "user_id": uid, "module_id": module_id, "section_id": section_id,
            "completed_at": (when or _now()).isoformat(),
        }
        return

    with _cursor() as cur:
        cur.execute(
            """
            INSERT INTO module_section_completions (user_id, module_id, section_id)
            VALUES (%s, %s, %s)
            ON CONFLICT (user_id, module_id, section_id) DO NOTHING
            """,
            (uid, module_id, section_id),
        )


def _insert_completion(uid, module_id, question_id, stars, when=None):
    if use_local_fallback():
        _buffer()["exercise_completions"]["|".join((uid, module_id, question_id))] = {
            "user_id": uid, "module_id": module_id, "question_id": question_id,
            "stars_awarded": stars, "completed_at": (when or _now()).isoformat(),
        }
        return

    with _cursor() as cur:
        cur.execute(
            """
            INSERT INTO exercise_completions (user_id, module_id, question_id, stars_awarded)
            VALUES (%s, %s, %s, %s)
            ON CONFLICT (user_id, module_id, question_id) DO NOTHING
            """,
            (uid, module_id, question_id, stars),
        )


def _band_for(index: int, total: int):
    position = index / max(total, 1)
    running = 0.0
    for label, share, ability, reach in BANDS:
        running += share
        if position < running:
            return label, ability, reach
    return BANDS[-1][0], BANDS[-1][2], BANDS[-1][3]


def seed(count: int, seed_value: int = 7) -> None:
    # Fixed seed by default so re-running produces the same cohort -- a demo
    # that changes its numbers every time it is opened invites exactly the
    # question you do not want during a supervisor meeting.
    random.seed(seed_value)

    modules = [m["id"] for m in admin_content.list_modules()]
    if not modules:
        print("No modules found; nothing to seed against.")
        return

    used_names = set()
    for index in range(count):
        band, ability_range, reach_range = _band_for(index, count)
        ability = random.uniform(*ability_range)
        reach = random.uniform(*reach_range)

        while True:
            name = "%s %s" % (random.choice(FIRST_NAMES), random.choice(SURNAMES))
            if name not in used_names:
                used_names.add(name)
                break

        uid = "%s%04d" % (DEMO_PREFIX, index)
        email = name.lower().replace(" ", ".").replace("'", "") + "@demo.uct.ac.za"
        _insert_user(uid, name + " (demo)", email)

        # How far through the module sequence this student has got.
        modules_reached = max(1, round(reach * len(modules)))
        # Struggling students also drop off: their last activity is older.
        idle_days = random.uniform(0, 3) if band == "strong" else (
            random.uniform(0, 10) if band == "middling" else random.uniform(2, 30)
        )

        for module_index, module_id in enumerate(modules[:modules_reached]):
            # Earlier modules were done earlier: the first sits 42 days back,
            # the most recent one exactly `idle_days` back. Dividing by
            # modules_reached rather than (modules_reached - 1) would stop the
            # last module short of idle_days and make even the keenest student
            # look like they had not opened the app in a week.
            span = max(modules_reached - 1, 1)
            base_days_ago = 42 - (module_index / span) * (42 - idle_days)

            answered = random.randint(8, 20)
            pool = MISCONCEPTIONS.get(module_id, ["off_by_one_index"])
            for attempt_index in range(answered):
                # Accuracy drifts up within a module: students learn.
                improving = ability + 0.12 * (attempt_index / max(answered - 1, 1))
                correct = random.random() < min(improving, 0.97)
                _insert_attempt(
                    uid, module_id,
                    "%s-%02d" % (module_id, random.randint(1, 12)),
                    random.choice(["bank", "bank", "engine"]),
                    correct,
                    None if correct else random.choice(pool),
                    _stamp(base_days_ago + random.uniform(0, 3)),
                )
                if correct:
                    _insert_completion(
                        uid, module_id, "%s-%02d" % (module_id, attempt_index), 1,
                        _stamp(base_days_ago + random.uniform(0, 3)),
                    )

            is_last = module_index == modules_reached - 1
            # A module still in progress has only got partway -- but not
            # always: without the coin flip nobody would ever finish their
            # last module, and "students who completed everything" would read
            # 0 no matter how strong the cohort.
            partial = is_last and random.random() < 0.5
            sections = GATING_SECTIONS[:random.randint(1, 4)] if partial else GATING_SECTIONS
            for section_id in sections:
                _insert_section(uid, module_id, section_id, _stamp(base_days_ago))

            # An exam only happens where the student reached the exam stage.
            if "exam" in sections:
                total = 10
                score = max(0, min(total, round(random.gauss(ability * total, 1.2))))
                percent = round(100 * score / total)
                _insert_exam(uid, module_id, score, total, percent, percent >= 80,
                             _stamp(base_days_ago))
                # Strong students occasionally retake and improve.
                if band == "strong" and random.random() < 0.3:
                    retake = min(total, score + random.randint(1, 2))
                    retake_pct = round(100 * retake / total)
                    _insert_exam(uid, module_id, retake, total, retake_pct,
                                 retake_pct >= 80, _stamp(base_days_ago - 1))

        # Challenges unlock only after every module is complete, so seeding
        # them for anyone else would put the demo in a state the real app
        # cannot reach.
        finished_everything = (
            modules_reached == len(modules) and not partial
        )
        if finished_everything and CHALLENGE_IDS:
            for challenge_id in random.sample(
                CHALLENGE_IDS, k=min(len(CHALLENGE_IDS), random.randint(1, 4))
            ):
                _insert_challenge(uid, challenge_id, _stamp(idle_days + random.uniform(0, 2)))

        print("  seeded %-28s %s" % (name, band))

    # One write for the whole cohort, under the fallback. A no-op on Postgres,
    # where each statement above already committed.
    _flush()

    print("\nSeeded %d demo students across %d modules." % (count, len(modules)))
    print("Every account is prefixed '%s' and named '(demo)'." % DEMO_PREFIX)
    print("Remove them all with: python -m db.seed_demo_data --clear")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--students", type=int, default=0,
                        help="how many demo students to create")
    parser.add_argument("--clear", action="store_true",
                        help="delete every demo- account and its data, then exit")
    parser.add_argument("--clear-first", action="store_true",
                        help="delete existing demo data before seeding")
    parser.add_argument("--seed", type=int, default=7,
                        help="random seed (default 7, so runs are reproducible)")
    parser.add_argument("--yes-really-seed-postgres", action="store_true",
                        help="required to seed fake data into a Postgres database")
    args = parser.parse_args()

    if args.clear:
        removed = clear_demo_rows()
        print("Cleared demo data." if removed < 0 else "Cleared %d demo accounts." % removed)
        return

    if args.students <= 0:
        parser.error("give --students N, or --clear")

    # Writing fake students into a real database is not recoverable by
    # deleting them: they will already have been counted in whatever a
    # lecturer read, exported, or reported in the meantime. DATABASE_URL means
    # Postgres, which in this project means a deployed environment, so that
    # path has to be asked for explicitly rather than reached by habit.
    if not use_local_fallback() and not args.yes_really_seed_postgres:
        parser.error(
            "refusing to write demo data into a Postgres database. "
            "This writes FAKE students that will be counted in every class "
            "average and every export. If this is genuinely a throwaway "
            "database, re-run with --yes-really-seed-postgres."
        )

    if args.clear_first:
        clear_demo_rows()

    print("Seeding %d demo students into %s...\n" % (
        args.students, "the local JSON state file" if use_local_fallback() else "Postgres"))
    seed(args.students, args.seed)


if __name__ == "__main__":
    main()
