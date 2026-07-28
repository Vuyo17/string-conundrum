"""Delete Postgres data for any user who no longer exists in Firebase Auth.

Firebase user deletions (via the Console, Admin SDK, or a self-deletion)
never touch this database on their own, so this script reconciles the two:
any `users` row whose uid Firebase no longer recognizes is deleted, which
cascades to that user's exercise_completions and challenge_completions too
(see the ON DELETE CASCADE foreign keys in db/schema.sql).

Run manually, or on a schedule via cron, e.g. hourly:
    0 * * * * cd /localhome/mtmluv001/string-conundrum-api/backend && \
        DATABASE_URL=... venv/bin/python db/prune_deleted_users.py >> prune.log 2>&1

Usage:
    cd backend
    python db/prune_deleted_users.py
"""

import sys
from pathlib import Path

from dotenv import load_dotenv
from firebase_admin import auth

sys.path.insert(0, str(Path(__file__).resolve().parent.parent))

load_dotenv()

from app.db import get_cursor  # noqa: E402
from app.firebase_admin_init import init_firebase_admin  # noqa: E402


def _all_firebase_uids() -> set[str]:
    init_firebase_admin()
    return {user.uid for user in auth.list_users().iterate_all()}


def _all_postgres_uids(cur) -> set[str]:
    cur.execute("SELECT uid FROM users")
    return {row["uid"] for row in cur.fetchall()}


def prune() -> list[str]:
    firebase_uids = _all_firebase_uids()

    with get_cursor() as cur:
        postgres_uids = _all_postgres_uids(cur)
        orphaned = sorted(postgres_uids - firebase_uids)

        for uid in orphaned:
            cur.execute("DELETE FROM users WHERE uid = %s", (uid,))

    return orphaned


if __name__ == "__main__":
    deleted = prune()
    if deleted:
        print(f"Deleted {len(deleted)} user(s) no longer in Firebase: {', '.join(deleted)}")
    else:
        print("No orphaned users found. Nothing to do.")
