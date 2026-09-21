"""Lecturer dashboard API. Every route here is behind require_admin.

Split into its own blueprint rather than added to routes.py for one reason
that matters: it makes the access boundary something you can see. Every
endpoint a student is not allowed to reach lives in this file, and every
endpoint in this file carries the same decorator. Mixed into the 400-line
student blueprint, a missing decorator would be one line in a diff nobody
would catch.
"""

from flask import Blueprint, Response, g, request

from .auth import require_admin
from .services import admin_content, analytics
from .services.progress import ROLE_ADMIN, VALID_ROLES, set_role

admin_bp = Blueprint("admin", __name__, url_prefix="/api/admin")


def _wants_guests() -> bool:
    """Guests are excluded from every roster and average by default.

    A guest session is a throwaway uid created by clicking "continue as
    guest"; counting those as students would inflate the enrolment figure and
    drag every class average toward whatever a passer-by happened to click.
    `?include_guests=1` puts them back for anyone who wants to see raw usage.
    """
    return request.args.get("include_guests", "").strip().lower() in {"1", "true", "yes"}


# --- read-only views -------------------------------------------------------

@admin_bp.get("/overview")
@require_admin
def overview():
    return {"ok": True, **analytics.overview(_wants_guests())}


@admin_bp.get("/students")
@require_admin
def students():
    rows = analytics.student_rows(_wants_guests())

    query = (request.args.get("q") or "").strip().casefold()
    if query:
        rows = [
            r for r in rows
            if query in (r["name"] or "").casefold()
            or query in (r["email"] or "").casefold()
        ]
    if request.args.get("at_risk", "").strip().lower() in {"1", "true", "yes"}:
        rows = [r for r in rows if r["at_risk"]]

    return {"ok": True, "students": rows, "count": len(rows)}


@admin_bp.get("/students/<user_id>")
@require_admin
def student_detail(user_id: str):
    try:
        # Guests are included here: if a lecturer has a uid in hand they have
        # already navigated to it deliberately, and refusing to render the
        # page would just look broken.
        return {"ok": True, **analytics.student_detail(user_id, include_guests=True)}
    except LookupError:
        return {"ok": False, "error": "no such student"}, 404


@admin_bp.get("/marks")
@require_admin
def marks():
    return {"ok": True, **analytics.marks(_wants_guests())}


@admin_bp.get("/marks.csv")
@require_admin
def marks_csv():
    csv_text = analytics.marks_csv(_wants_guests())
    return Response(
        csv_text,
        mimetype="text/csv",
        headers={"Content-Disposition": 'attachment; filename="string-conundrum-marks.csv"'},
    )


@admin_bp.get("/misconceptions")
@require_admin
def misconceptions():
    try:
        limit = int(request.args.get("limit", 20))
    except (TypeError, ValueError):
        limit = 20
    return {"ok": True, **analytics.misconceptions(_wants_guests(), limit=limit)}


@admin_bp.get("/questions")
@require_admin
def questions():
    return {
        "ok": True,
        **analytics.question_analytics(
            module_id=request.args.get("module_id") or None,
            include_guests=_wants_guests(),
        ),
    }


# --- module management -----------------------------------------------------

@admin_bp.get("/modules")
@require_admin
def list_modules():
    return {"ok": True, "modules": admin_content.list_modules()}


@admin_bp.post("/modules")
@require_admin
def create_module():
    payload = request.get_json(silent=True) or {}
    try:
        module = admin_content.create_module(payload)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}, 400
    return {"ok": True, "module": module}, 201


@admin_bp.patch("/modules/<module_id>")
@require_admin
def update_module(module_id: str):
    payload = request.get_json(silent=True) or {}
    try:
        module = admin_content.update_module(module_id, payload)
    except LookupError:
        return {"ok": False, "error": "no such module"}, 404
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}, 400
    return {"ok": True, "module": module}


@admin_bp.post("/modules/reorder")
@require_admin
def reorder_modules():
    payload = request.get_json(silent=True) or {}
    order = payload.get("order")
    if not isinstance(order, list):
        return {"ok": False, "error": "expected {\"order\": [module_id, ...]}"}, 400
    return {"ok": True, "modules": admin_content.reorder_modules(order)}


@admin_bp.patch("/modules/<module_id>/content")
@require_admin
def update_module_content(module_id: str):
    payload = request.get_json(silent=True) or {}
    try:
        section_ids = payload.get("section_ids")
        content = payload.get("content")
        update = {}
        if section_ids is not None:
            update["section_ids"] = section_ids
        if content is not None:
            update["content"] = content
        module = admin_content.update_module(module_id, update)
    except LookupError:
        return {"ok": False, "error": "no such module"}, 404
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}, 400
    return {"ok": True, "module": module}


@admin_bp.delete("/modules/<module_id>")
@require_admin
def archive_module(module_id: str):
    try:
        admin_content.archive_module(module_id)
    except LookupError:
        return {"ok": False, "error": "no such module"}, 404
    return {"ok": True, "archived": module_id}


# --- exercise management ---------------------------------------------------

@admin_bp.get("/modules/<module_id>/exercises")
@require_admin
def list_exercises(module_id: str):
    return {
        "ok": True,
        "module_id": module_id,
        "exercises": admin_content.list_exercises(module_id),
    }


@admin_bp.put("/modules/<module_id>/exercises/<question_id>")
@require_admin
def save_exercise(module_id: str, question_id: str):
    payload = request.get_json(silent=True) or {}
    try:
        exercise = admin_content.save_exercise(module_id, question_id, payload)
    except ValueError as exc:
        return {"ok": False, "error": str(exc)}, 400
    return {"ok": True, "exercise": exercise}


@admin_bp.delete("/modules/<module_id>/exercises/<question_id>")
@require_admin
def delete_exercise(module_id: str, question_id: str):
    try:
        admin_content.delete_exercise(module_id, question_id)
    except LookupError:
        return {"ok": False, "error": "no such exercise"}, 404
    return {"ok": True, "deleted": question_id}


# --- people ----------------------------------------------------------------

@admin_bp.patch("/users/<user_id>/role")
@require_admin
def change_role(user_id: str):
    payload = request.get_json(silent=True) or {}
    role = (payload.get("role") or "").strip()
    if role not in VALID_ROLES:
        return {"ok": False, "error": "role must be one of: " + ", ".join(sorted(VALID_ROLES))}, 400

    # Without this an admin can demote themselves and, if they are the only
    # one, lock every lecturer out of the dashboard with no way back in short
    # of editing the database by hand.
    if user_id == g.uid and role != ROLE_ADMIN:
        return {"ok": False, "error": "you cannot remove your own admin access"}, 400

    set_role(user_id, role)
    return {"ok": True, "uid": user_id, "role": role}
