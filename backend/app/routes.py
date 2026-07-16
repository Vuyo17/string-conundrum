from flask import Blueprint, request

from .services.feedback import evaluate_answer, get_module_exercises
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
    return {"ok": True, **evaluation}


@api_bp.get("/exercises/<module_id>")
def list_module_exercises(module_id: str):
    """Return every exercise for a module, e.g. to render the Exercise screen."""
    exercises = get_module_exercises(module_id)
    return {"ok": True, "module_id": module_id, "exercises": exercises}


@api_bp.get("/progress/<user_id>")
def get_progress(user_id: str):
    return {
        "ok": True,
        "user_id": user_id,
        "modules": [
            {
                "module_id": "intro",
                "completed": False,
                "score": 0,
                "last_session_at": None,
            }
        ],
    }
