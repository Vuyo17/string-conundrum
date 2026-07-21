"""Lightweight user store for sign up / sign in.

Users are kept in ``backend/app/data/users.json`` with salted, hashed
passwords (werkzeug). Sessions are stateless: a signed-ish opaque token is
returned to the client, which stores it locally. This is intentionally
simple so it can later be swapped for Firebase Auth without changing the
frontend contract.
"""

from __future__ import annotations

import json
import re
import secrets
import threading
from pathlib import Path

from werkzeug.security import check_password_hash, generate_password_hash

_DATA_DIR = Path(__file__).resolve().parent.parent / "data"
_USERS_FILE = _DATA_DIR / "users.json"
_LOCK = threading.Lock()

_EMAIL_RE = re.compile(r"^[^@\s]+@[^@\s]+\.[^@\s]+$")


def _load_users() -> dict:
    if not _USERS_FILE.exists():
        return {}
    try:
        return json.loads(_USERS_FILE.read_text(encoding="utf-8"))
    except (json.JSONDecodeError, OSError):
        return {}


def _save_users(users: dict) -> None:
    _DATA_DIR.mkdir(parents=True, exist_ok=True)
    _USERS_FILE.write_text(json.dumps(users, indent=2), encoding="utf-8")


def _public_user(email: str, record: dict) -> dict:
    return {
        "email": email,
        "name": record.get("name", ""),
        "initials": _initials(record.get("name", "") or email),
    }


def _initials(name: str) -> str:
    parts = [p for p in re.split(r"[\s@._-]+", name.strip()) if p]
    if not parts:
        return "?"
    if len(parts) == 1:
        return parts[0][:2].upper()
    return (parts[0][0] + parts[1][0]).upper()


def signup(name: str, email: str, password: str) -> tuple[dict | None, str | None]:
    """Create an account. Returns (session, error)."""
    name = (name or "").strip()
    email = (email or "").strip().lower()

    if not name:
        return None, "Please enter your name."
    if not _EMAIL_RE.match(email):
        return None, "That email address doesn't look right."
    if len(password or "") < 6:
        return None, "Password must be at least 6 characters."

    with _LOCK:
        users = _load_users()
        if email in users:
            return None, "An account with this email already exists. Try signing in."
        users[email] = {
            "name": name,
            "password_hash": generate_password_hash(password),
        }
        _save_users(users)

    return {"token": secrets.token_urlsafe(24), "user": _public_user(email, users[email])}, None


def login(email: str, password: str) -> tuple[dict | None, str | None]:
    """Verify credentials. Returns (session, error)."""
    email = (email or "").strip().lower()

    with _LOCK:
        users = _load_users()
        record = users.get(email)

    if record is None or not check_password_hash(record["password_hash"], password or ""):
        return None, "Email or password is incorrect."

    return {"token": secrets.token_urlsafe(24), "user": _public_user(email, record)}, None
