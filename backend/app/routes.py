from flask import Blueprint, g, request

from .auth import require_auth
from .services.feedback import evaluate_answer, get_module_exercises
from .services.progress import (
    get_leaderboard,
    get_user_progress,
    record_challenge_completion,
    record_exercise_completion,
)
from .services.sandbox import execute_code, trace_steps
from .services.visualizer import build_visual_state

api_bp = Blueprint("api", __name__, url_prefix="/api")


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
    result = execute_code(code)

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

    evaluation = evaluate_answer(
        module_id=module_id,
        question_id=question_id,
        answer=answer,
        answers=answers,
        code=code,
    )
    if evaluation.get("correct"):
        record_exercise_completion(g.uid, module_id, question_id, evaluation["stars_awarded"])
    return {"ok": True, **evaluation}


@api_bp.get("/exercises/<module_id>")
def list_module_exercises(module_id: str):
    """Return every exercise for a module, e.g. to render the Exercise screen."""
    exercises = get_module_exercises(module_id)
    return {"ok": True, "module_id": module_id, "exercises": exercises}


@api_bp.get("/challenges")
def list_all_challenges():
    """Return every coding challenge (used to render the Challenges screen)."""
    from .services.challenges import list_challenges

    return {"ok": True, "challenges": list_challenges()}


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
    return result


@api_bp.get("/progress/<user_id>")
@require_auth
def get_progress(user_id: str):
    if g.uid != user_id:
        return {"ok": False, "error": "forbidden"}, 403

    return {
        "ok": True,
        "user_id": user_id,
        "modules": get_user_progress(user_id),
    }


@api_bp.get("/leaderboard")
def leaderboard():
    """Return top scorers across exercises and challenges combined."""
    return {"ok": True, "leaders": get_leaderboard()}


# ─── authentication ──────────────────────────────────────────────────────────

@api_bp.post("/auth/signup")
def auth_signup():
    from .services.auth_store import signup

    payload = request.get_json(silent=True) or {}
    session, error = signup(
        name=payload.get("name", ""),
        email=payload.get("email", ""),
        password=payload.get("password", ""),
    )
    if error:
        return {"ok": False, "error": error}, 400
    return {"ok": True, **session}


@api_bp.post("/auth/login")
def auth_login():
    from .services.auth_store import login

    payload = request.get_json(silent=True) or {}
    session, error = login(
        email=payload.get("email", ""),
        password=payload.get("password", ""),
    )
    if error:
        return {"ok": False, "error": error}, 401
    return {"ok": True, **session}
