"""Drive real student traffic through the running server over HTTP.

This is NOT the same thing as seed_demo_data.py, and the difference matters.
seed_demo_data writes rows straight into the database; nothing it produces has
been through the grading pipeline, so it proves only that the dashboard can
render rows. This script does the opposite: it holds no database connection at
all. It signs accounts in through the real username endpoint, exchanges the
custom token for a real Firebase ID token with Google, and submits answers to
the real grading endpoints over HTTP. Every attempt, misconception and mark it
produces was graded by the server and recorded by the ordinary code path a
student's browser uses.

What is simulated is only the choice of answer. Each account is given a
target accuracy and picks the correct option or a catalogued distractor to
match it, exactly as a stronger or weaker student would; the server decides
what that answer is worth and what it reveals.

    python -m db.simulate_real_traffic --students 12

Accounts are created through the username path and given a "test" suffix so
they are identifiable in the roster. The suffix avoids brackets deliberately:
the username rules accept only word characters, spaces, hyphens, apostrophes
and full stops, and cap the whole name at 24 characters.
"""

import argparse
import json
import random
import sys
import time
import urllib.error
import urllib.request
from pathlib import Path

sys.path.insert(0, ".")

API = "http://127.0.0.1:5000"

# The web API key the browser itself uses (frontend/src/firebase.js). Needed
# to exchange a custom token for an ID token, which is what the client SDK
# does after /api/auth/username hands it one.
FIREBASE_WEB_API_KEY = "AIzaSyDzK73Mq10lyMLBMYpl_ZhkBiZa14vdDOg"
TOKEN_EXCHANGE = (
    "https://identitytoolkit.googleapis.com/v1/accounts:signInWithCustomToken?key="
    + FIREBASE_WEB_API_KEY
)

_EXERCISES = Path(__file__).resolve().parent.parent / "app" / "data" / "exercises.json"

FIRST_NAMES = [
    "Thandiwe", "Sipho", "Aisha", "Lerato", "Kagiso", "Nomsa", "Tebogo", "Zanele",
    "Farai", "Mpho", "Ayanda", "Bongani", "Dineo", "Naledi", "Olwethu", "Palesa",
]
SURNAMES = [
    "Mokoena", "Dlamini", "Nkosi", "Botha", "Patel", "Khumalo", "Naidoo", "Sithole",
]

SECTIONS = ("learn", "examples", "visualize")

# Covers a small clock difference between this machine and Google's issuer.
SKEW_WAIT_SECONDS = 2


def _post(url, payload, token=None):
    body = json.dumps(payload).encode("utf-8")
    request = urllib.request.Request(url, data=body, method="POST")
    request.add_header("Content-Type", "application/json")
    if token:
        request.add_header("Authorization", "Bearer " + token)
    try:
        with urllib.request.urlopen(request, timeout=30) as response:
            return json.loads(response.read().decode("utf-8"))
    except urllib.error.HTTPError as exc:
        detail = exc.read().decode("utf-8", "replace")[:300]
        raise RuntimeError(f"POST {url} -> {exc.code}: {detail}") from exc


def _get(url):
    with urllib.request.urlopen(url, timeout=30) as response:
        return json.loads(response.read().decode("utf-8"))


def sign_in(username: str) -> str:
    """Real sign-in: the backend mints a custom token, Google exchanges it."""
    minted = _post(f"{API}/api/auth/username", {"username": username})
    if not minted.get("token"):
        raise RuntimeError(f"could not sign in as {username}: {minted}")
    exchanged = _post(TOKEN_EXCHANGE, {"token": minted["token"], "returnSecureToken": True})

    # Google stamps the token with ITS clock. If this machine's clock is even
    # a second behind, firebase_admin rejects the token as "used too early"
    # and the server answers 401. Waiting out the skew is the script's
    # business; on a deployed server the real fix is keeping the clock in sync,
    # because the same skew would reject a genuine learner's first requests.
    time.sleep(SKEW_WAIT_SECONDS)
    return exchanged["idToken"]


def load_bank() -> dict:
    """The answer key, read locally purely to decide what a student would type.

    The server is never told which answer is correct; it grades the submission
    itself, so a wrong choice here produces a genuinely wrong answer and a
    genuinely diagnosed misconception.
    """
    data = json.loads(_EXERCISES.read_text(encoding="utf-8"))
    bank = {}
    for row in data:
        # write_code questions run the sandbox on every submission, which is
        # slow and adds nothing this script is trying to demonstrate.
        if row.get("type") == "write_code":
            continue
        bank.setdefault(row["module_id"], []).append(row)
    return bank


def choose_answer(exercise: dict, should_be_correct: bool):
    """Return a payload fragment: the answer this student gives."""
    kind = exercise.get("type")

    if kind == "select_all":
        correct = exercise.get("answers") or []
        if should_be_correct:
            return {"answers": correct}
        options = exercise.get("options") or []
        wrong = [o for o in options if o not in correct]
        # Dropping one correct option is the mistake a student actually makes,
        # rather than selecting something unrelated.
        return {"answers": (correct[:-1] or wrong[:1])}

    correct = exercise.get("answer")
    if should_be_correct:
        return {"answer": correct}

    # Prefer a distractor the catalogue has a misconception mapped to, so the
    # wrong answers this produces are diagnosable rather than noise.
    mapped = [key for key in (exercise.get("misconception_map") or {}) if key != correct]
    if mapped:
        return {"answer": random.choice(mapped)}
    others = [o for o in (exercise.get("options") or []) if o != correct]
    if others:
        return {"answer": random.choice(others)}
    return {"answer": str(correct) + "?"}


def run_student(name: str, ability: float, bank: dict, modules: list) -> dict:
    token = sign_in(name)
    stats = {"answered": 0, "correct": 0, "exams": 0}

    for module_id in modules:
        questions = bank.get(module_id) or []
        if not questions:
            continue

        for exercise in questions[:8]:
            payload = {
                "module_id": module_id,
                "question_id": exercise["question_id"],
                **choose_answer(exercise, random.random() < ability),
            }
            result = _post(f"{API}/api/exercises/submit", payload, token)
            stats["answered"] += 1
            stats["correct"] += 1 if result.get("correct") else 0

        for section in SECTIONS:
            _post(f"{API}/api/modules/{module_id}/sections/{section}/complete", {}, token)

        # An exam paper: the same questions, submitted under exam conditions,
        # then the paper itself recorded from the counts the server graded.
        paper = questions[:10]
        correct_count = 0
        for exercise in paper:
            payload = {
                "module_id": module_id,
                "question_id": exercise["question_id"],
                "exam": True,
                **choose_answer(exercise, random.random() < ability),
            }
            result = _post(f"{API}/api/exercises/submit", payload, token)
            stats["answered"] += 1
            if result.get("correct"):
                correct_count += 1
                stats["correct"] += 1

        exam = _post(f"{API}/api/exams/submit", {
            "module_id": module_id,
            "correct_count": correct_count,
            "total_count": len(paper),
        }, token)
        stats["exams"] += 1
        if exam.get("passed"):
            _post(f"{API}/api/modules/{module_id}/sections/exam/complete", {}, token)

    return stats


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--students", type=int, default=12)
    parser.add_argument("--modules", type=int, default=3,
                        help="how many modules each student works through")
    parser.add_argument("--seed", type=int, default=11)
    args = parser.parse_args()

    random.seed(args.seed)
    bank = load_bank()
    order = [m for m in ["intro", "indexing", "slicing", "immutability",
                         "comparison", "looping", "methods", "formatting"] if m in bank]

    try:
        _get(f"{API}/health")
    except urllib.error.URLError as exc:
        raise SystemExit(f"the server at {API} is not reachable: {exc}")

    totals = {"answered": 0, "correct": 0, "exams": 0}
    used = set()

    for index in range(args.students):
        while True:
            name = f"{random.choice(FIRST_NAMES)} {random.choice(SURNAMES)}"
            if name not in used:
                used.add(name)
                break
        # A spread of ability, so the marks distribution has a shape rather
        # than a single spike.
        ability = min(0.97, max(0.2, random.gauss(0.68, 0.18)))
        reach = max(1, min(len(order), round(args.modules * random.uniform(0.5, 1.3))))

        stats = run_student(f"{name} test", ability, bank, order[:reach])
        for key in totals:
            totals[key] += stats[key]
        accuracy = (100 * stats["correct"] / stats["answered"]) if stats["answered"] else 0
        print(f"  {name:<24} answered {stats['answered']:>3}  "
              f"correct {stats['correct']:>3} ({accuracy:>3.0f}%)  exams {stats['exams']}")

    print(f"\n{args.students} students, {totals['answered']} answers graded by the server, "
          f"{totals['correct']} correct, {totals['exams']} exam papers recorded.")


if __name__ == "__main__":
    main()
