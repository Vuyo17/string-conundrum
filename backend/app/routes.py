import hashlib
import re
import secrets

from flask import Blueprint, g, request

from .auth import require_auth
from .services import admin_content
from .services.feedback import (
    engine_code_feedback,
    engine_feedback,
    evaluate_answer,
    get_module_exercises,
)
from .services.progress import (
    ROLE_ADMIN,
    get_bypass_unlocks,
    get_role,
    get_leaderboard,
    get_leaderboard_prefs,
    get_section_progress,
    record_attempt,
    record_challenge_completion,
    record_exam_attempt,
    record_exercise_completion,
    record_section_completion,
    set_bypass_unlocks,
    set_leaderboard_anonymous,
    set_leaderboard_optin,
)
from .services.comparison_engine import generate as generate_comparison_question, grade as grade_comparison_question
from .services.formatting_engine import generate as generate_formatting_question, grade as grade_formatting_question
from .services.immutability_engine import generate as generate_immutability_question, grade as grade_immutability_question
from .services.indexing_engine import generate as generate_indexing_question, grade as grade_indexing_question
from .services.intro_engine import generate as generate_intro_question, grade as grade_intro_question
from .services.looping_engine import generate as generate_looping_question, grade as grade_looping_question
from .services.methods_engine import generate as generate_methods_question, grade as grade_methods_question
from .services.sandbox import execute_code, trace_steps
from .services.slicing_engine import generate as generate_slicing_question, grade as grade_slicing_question
from .services.visualizer import build_visual_state

api_bp = Blueprint("api", __name__, url_prefix="/api")

_VALID_SECTION_IDS = {"learn", "examples", "visualize", "practice", "exam"}


@api_bp.post("/visualize")
def visualize():
    payload = request.get_json(silent=True) or {}
    expression = payload.get("expression", "")
    context = payload.get("context", {})

    return {
        "ok": True,
        "visual_state": build_visual_state(expression=expression, context=context),
    }


@api_bp.post("/execute")
def execute():
    payload = request.get_json(silent=True) or {}
    code = payload.get("code", "")
    lang = payload.get("lang")
    result = execute_code(code, lang=lang)

    return {
        "ok": True,
        **result,
    }


@api_bp.post("/debug")
def debug():
    """Return a list of debugger steps for the given code without executing it."""
    payload = request.get_json(silent=True) or {}
    code = payload.get("code", "")
    steps = trace_steps(code)
    return {"ok": True, "steps": steps}


@api_bp.post("/exercises/submit")
@require_auth
def submit_exercise():
    payload = request.get_json(silent=True) or {}
    module_id = payload.get("module_id", "")
    question_id = payload.get("question_id", "")
    answer = payload.get("answer", "")
    answers = payload.get("answers")
    code = payload.get("code")
    lang = payload.get("lang")

    evaluation = evaluate_answer(
        module_id=module_id,
        question_id=question_id,
        answer=answer,
        answers=answers,
        code=code,
        lang=lang,
    )
    if evaluation.get("correct"):
        record_exercise_completion(g.uid, module_id, question_id, evaluation["stars_awarded"])

    # The analytics event log, which unlike exercise_completions above records
    # wrong answers too -- that is the entire point of it. `source` separates
    # a question answered inside a timed exam paper from ordinary practice on
    # the same bank, because a lecturer reading a difficulty figure needs to
    # know which of the two it describes. record_attempt never raises.
    record_attempt(
        g.uid, module_id, question_id, bool(evaluation.get("correct")),
        source="exam" if payload.get("exam") else "bank",
        misconception_id=evaluation.get("misconception_id"),
        answer_given=None if evaluation.get("correct") else (code or answers or answer),
    )
    return {"ok": True, **evaluation}


@api_bp.get("/modules")
def list_published_modules():
    """The student catalogue: published modules, in the lecturer's order."""
    fields = ("id", "title", "description", "minutes", "level", "objectives", "content")
    counts = admin_content.exercise_counts()
    modules = [
        {**{key: row.get(key) for key in fields},
         "section_ids": list(row.get("section_ids") or admin_content.DEFAULT_SECTION_IDS),
         "content": row.get("content") or {},
         "question_count": counts.get(row["id"], 0)}
        for row in admin_content.list_modules(include_unpublished=False)
    ]
    return {"ok": True, "modules": modules}


@api_bp.get("/exercises/<module_id>")
def list_module_exercises(module_id: str):
    """Return every exercise for a module, e.g. to render the Exercise screen."""
    exercises = get_module_exercises(module_id, request.args.get("lang"))
    return {"ok": True, "module_id": module_id, "exercises": exercises}


# ─── procedural endless-practice engines ────────────────────────────────────
# Each module that has adopted the adaptive engine (see
# practice_engine_core.py) gets an identical pair of endpoints --
# GET .../engine/next and POST .../engine/answer -- so rather than hand-copy
# that pair per module (as the first two, slicing and indexing, originally
# were, and promptly drifted apart on one line -- indexing's module_id kwarg
# wasn't in slicing's copy), _register_engine below builds both routes from
# one module's generate()/grade() functions. Adding a module means adding
# one line to _ENGINES, not copying ~50.

_ENGINES = {
    "slicing": (generate_slicing_question, grade_slicing_question),
    "indexing": (generate_indexing_question, grade_indexing_question),
    "looping": (generate_looping_question, grade_looping_question),
    "comparison": (generate_comparison_question, grade_comparison_question),
    "methods": (generate_methods_question, grade_methods_question),
    "immutability": (generate_immutability_question, grade_immutability_question),
    "formatting": (generate_formatting_question, grade_formatting_question),
    "intro": (generate_intro_question, grade_intro_question),
}


def _register_engine(module_id, generate_fn, grade_fn):
    @api_bp.get(f"/exercises/{module_id}/engine/next", endpoint=f"{module_id}_engine_next")
    def _next():
        try:
            tier = int(request.args.get("tier", 1))
        except (TypeError, ValueError):
            tier = 1
        # `weak` is the client's own tally of what it has recently got
        # wrong, sent back so template selection can lean that way.
        # Keeping the tally on the client is what lets adaptive selection
        # work without giving the engine session state; it is advisory,
        # and unknown ids are dropped.
        weak = request.args.get("weak", "")
        question = generate_fn(tier, weak=weak)
        return {"ok": True, **question}

    @api_bp.post(f"/exercises/{module_id}/engine/answer", endpoint=f"{module_id}_engine_answer")
    @require_auth
    def _answer():
        payload = request.get_json(silent=True) or {}
        token = payload.get("token", "")
        lang = payload.get("lang")

        # The whole payload goes to the grader: which field holds the
        # answer depends on the question's format, and only the token
        # knows the format.
        result = grade_fn(token, payload)
        if not result.get("ok"):
            return {"ok": False, "error": result.get("error", "invalid_token")}, 400

        record_attempt(
            g.uid, module_id, None, bool(result["correct"]),
            source="engine",
            misconception_id=result.get("misconception_id"),
            tier=result.get("tier"),
        )

        if result["correct"]:
            # Every generated question carries a fresh random nonce, so
            # unlike the static bank a synthetic id per attempt is correct
            # here — endless mode is meant to award stars every time, not
            # just the first time a particular question is seen.
            synthetic_id = f"engine-{result['tier']}-{token[:24]}"
            record_exercise_completion(g.uid, module_id, synthetic_id, result["stars_awarded"])

        if result.get("format") == "write_code":
            feedback = engine_code_feedback(
                result["correct"], result.get("detail", ""), lang, module_id=module_id,
            )
        else:
            # The worked-example panel below already explains the
            # misconception in full when one exists (explanation_blocks) --
            # appending the same misconception sentence to the terse banner
            # above it would just repeat the same information in two
            # different visual registers. Passing None here only changes
            # that one sentence; `misconception_id` in the response below
            # (which the frontend tallies for adaptive weighting) is
            # untouched.
            has_rich_explanation = bool(result.get("explanation_blocks"))
            feedback = engine_feedback(
                result["correct"], result["correct_answer"],
                None if has_rich_explanation else result["misconception_id"],
                lang, module_id=module_id,
            )
            # A format-specific observation ("word[2:5] produces \"ep\".")
            # is appended rather than substituted: the student still needs
            # to be told what the right answer was.
            detail = result.get("detail")
            if detail and not result["correct"]:
                feedback["feedback"] = f"{feedback['feedback']} {detail}"

        return {
            "ok": True,
            "correct": result["correct"],
            "correct_answer": result["correct_answer"],
            "misconception_id": result["misconception_id"],
            "stars_awarded": result["stars_awarded"],
            "tier": result["tier"],
            "format": result.get("format"),
            # A rich, worked-example version of "why" a wrong answer was
            # wrong, as content blocks the frontend renders with the same
            # components the Learn section uses (ContentBlocks.jsx) rather
            # than one prose sentence. Only Slicing's evaluate kind builds
            # these today (see _build_slice_explanation there); every other
            # module/kind sends None here and the frontend falls back to
            # `feedback["explanation"]`'s plain text, so this key is safe to
            # pass through generically for all eight modules at once.
            "explanation_blocks": result.get("explanation_blocks"),
            **feedback,
        }


for _module_id, (_generate_fn, _grade_fn) in _ENGINES.items():
    _register_engine(_module_id, _generate_fn, _grade_fn)


@api_bp.get("/challenges")
def list_all_challenges():
    """Return every coding challenge (used to render the Challenges screen)."""
    from .services.challenges import list_challenges

    return {"ok": True, "challenges": list_challenges(request.args.get("lang"))}


@api_bp.get("/challenges/<challenge_id>/solution")
def challenge_solution(challenge_id: str):
    """Return one challenge's reference solution, fetched on demand."""
    from .services.challenges import get_solution

    solution = get_solution(challenge_id)
    if solution is None:
        return {"ok": False, "error": "No solution available for this challenge."}, 404

    return {"ok": True, "challenge_id": challenge_id, "solution": solution}


@api_bp.post("/challenges/run")
@require_auth
def run_challenge():
    """Grade submitted code against a challenge's test cases."""
    from .services.challenges import grade_challenge

    payload = request.get_json(silent=True) or {}
    challenge_id = payload.get("challenge_id", "")
    result = grade_challenge(
        challenge_id=challenge_id,
        code=payload.get("code", ""),
    )
    if result.get("all_passed"):
        record_challenge_completion(g.uid, challenge_id, result["stars_awarded"])
    # Challenges are not scoped to a module, so module_id carries the literal
    # "challenges" and question_id the challenge id -- enough for the
    # dashboard's activity feed and attempt counts to include them without
    # giving attempts a nullable second foreign key.
    record_attempt(
        g.uid, "challenges", challenge_id, bool(result.get("all_passed")),
        source="challenge",
    )
    return result


@api_bp.get("/progress/<user_id>")
@require_auth
def get_progress(user_id: str):
    if g.uid != user_id:
        return {"ok": False, "error": "forbidden"}, 403

    return {
        "ok": True,
        "user_id": user_id,
        "modules": get_section_progress(user_id),
        "bypass_unlocks": get_bypass_unlocks(user_id),
        **get_leaderboard_prefs(user_id),
    }


@api_bp.post("/modules/<module_id>/sections/<section_id>/complete")
@require_auth
def complete_section(module_id: str, section_id: str):
    """Mark a module section (learn/examples/visualize/practice/exam) reached."""
    if section_id not in _VALID_SECTION_IDS:
        return {"ok": False, "error": "invalid section"}, 400
    record_section_completion(g.uid, module_id, section_id)
    return {"ok": True}


# The bar a paper has to clear to count toward module completion. Mirrors
# PASS_THRESHOLD in frontend/src/components/module/ExamMode.jsx -- the client
# still decides what to congratulate the student with, but the mark stored
# against their name is judged here.
EXAM_PASS_THRESHOLD = 80


@api_bp.post("/exams/submit")
@require_auth
def submit_exam():
    """Record one completed exam paper.

    ExamMode already grades every question through /exercises/submit; this
    endpoint exists because the PAPER -- the thing a lecturer calls a mark --
    had nowhere to live. The percentage was computed in the browser, shown
    once on the results screen, and lost on navigation.

    The client sends the counts, not the percentage: the percentage and the
    pass flag are both derived here, so a mark in the database is always the
    server's arithmetic on the server's own grading of each question.
    """
    payload = request.get_json(silent=True) or {}
    module_id = (payload.get("module_id") or "").strip()
    if not module_id:
        return {"ok": False, "error": "module_id is required"}, 400

    try:
        correct_count = max(0, int(payload.get("correct_count", 0)))
        total_count = int(payload.get("total_count", 0))
    except (TypeError, ValueError):
        return {"ok": False, "error": "correct_count and total_count must be whole numbers"}, 400

    if total_count <= 0:
        return {"ok": False, "error": "total_count must be at least 1"}, 400
    correct_count = min(correct_count, total_count)

    percent = round(100 * correct_count / total_count)
    passed = percent >= EXAM_PASS_THRESHOLD

    duration = payload.get("duration_seconds")
    try:
        duration = int(duration) if duration is not None else None
    except (TypeError, ValueError):
        duration = None

    record_exam_attempt(
        g.uid, module_id, correct_count, total_count, percent, passed,
        stars_awarded=int(payload.get("stars_awarded") or 0),
        duration_seconds=duration,
    )
    return {"ok": True, "percent": percent, "passed": passed}


@api_bp.get("/me")
@require_auth
def me():
    """Who the caller is, and whether they may open the lecturer dashboard.

    The frontend uses `role` only to decide whether to render the Dashboard
    nav item. It is not the access control -- every /api/admin route checks
    the role again server-side via require_admin, so a student who forges this
    response gets a 403 the moment they call anything.
    """
    role = get_role(g.uid)
    return {
        "ok": True,
        "uid": g.uid,
        "email": g.user_email,
        "role": role,
        "is_admin": role == ROLE_ADMIN,
    }


@api_bp.patch("/settings")
@require_auth
def update_settings():
    payload = request.get_json(silent=True) or {}
    if "bypass_unlocks" in payload:
        set_bypass_unlocks(g.uid, bool(payload["bypass_unlocks"]))
    if "leaderboard_optin" in payload:
        set_leaderboard_optin(g.uid, bool(payload["leaderboard_optin"]))
    if "leaderboard_anonymous" in payload:
        set_leaderboard_anonymous(g.uid, bool(payload["leaderboard_anonymous"]))
    return {
        "ok": True,
        "bypass_unlocks": get_bypass_unlocks(g.uid),
        **get_leaderboard_prefs(g.uid),
    }


@api_bp.get("/leaderboard")
def leaderboard():
    """Return top scorers across exercises and challenges combined."""
    return {"ok": True, "leaders": get_leaderboard()}


# ─── authentication ──────────────────────────────────────────────────────────
# Real sign-up/sign-in goes through the Firebase client SDK directly (see
# frontend/src/context/AuthContext.jsx), not this Flask backend — the only
# auth endpoint the frontend actually calls is /auth/guest below.

@api_bp.post("/auth/guest")
def auth_guest():
    """Issue a Firebase custom token for a fresh guest session.

    The frontend's obvious path here is `signInAnonymously()`, but that
    requires the "Anonymous" provider to be switched on in the Firebase
    console for this project, which it isn't. A custom token is a different
    code path Firebase Admin can mint unconditionally — the app already
    holds full admin credentials (see firebase_admin_init.py) — so guest
    mode works without touching any console setting. The client exchanges
    this token for a normal Firebase session via `signInWithCustomToken()`;
    from that point on it behaves exactly like any other signed-in user,
    just with a random `guest-` uid the frontend recognises as a guest.
    """
    from firebase_admin import auth as firebase_auth

    uid = f"guest-{secrets.token_hex(12)}"
    token = firebase_auth.create_custom_token(uid)
    return {"ok": True, "token": token.decode("utf-8") if isinstance(token, bytes) else token}


# Display names are the whole identity here, so they get the same normalising
# treatment an email address would: trimmed, inner whitespace collapsed, and
# capped at a length the leaderboard can render without truncation.
_USERNAME_RE = re.compile(r"^[\w \-'.]+$", re.UNICODE)
_USERNAME_MIN = 2
_USERNAME_MAX = 24


def _normalise_username(raw: "str | None") -> "str | None":
    if not isinstance(raw, str):
        return None
    name = " ".join(raw.split())
    if not (_USERNAME_MIN <= len(name) <= _USERNAME_MAX):
        return None
    if not _USERNAME_RE.match(name):
        return None
    return name


@api_bp.post("/auth/username")
def auth_username():
    """Issue a Firebase custom token for a username-only account.

    Same custom-token mechanism as /auth/guest above, with two differences that
    matter.

    First, the uid is derived from the username rather than random, so typing
    the same name again returns to the same account and the same progress.
    That is deliberate: without an email there is no other way back in, and a
    random uid would silently strand a student's work the moment they cleared
    site data. The trade-off is that the name alone is the credential — anyone
    who types it gets that account — which is the accepted cost of letting
    people in without authentication.

    Second, the display name rides along as a `name` developer claim. Firebase
    copies developer claims into the ID token, and require_auth() feeds
    decoded['name'] straight to upsert_user(), so the leaderboard has the right
    name on the very first authenticated request — no profile write, no forced
    token refresh.

    The uid is prefixed `named-`, not `guest-`, because the frontend keys guest
    restrictions off that prefix: a named account is a full account.
    """
    from firebase_admin import auth as firebase_auth

    payload = request.get_json(silent=True) or {}
    username = _normalise_username(payload.get("username"))
    if username is None:
        return {"ok": False, "error": "invalid_username"}, 400

    # Case- and spacing-insensitive, so "Thabo M" and "thabo  m" are one account.
    digest = hashlib.sha256(username.casefold().encode("utf-8")).hexdigest()
    uid = f"named-{digest[:24]}"

    token = firebase_auth.create_custom_token(uid, {"name": username})
    return {
        "ok": True,
        "token": token.decode("utf-8") if isinstance(token, bytes) else token,
        "username": username,
        "uid": uid,
    }
