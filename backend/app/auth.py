from functools import wraps

from firebase_admin import auth as firebase_auth
from flask import g, request

from .services.progress import (
    ROLE_ADMIN,
    get_role,
    sync_allowlisted_admin,
    upsert_user,
)


def require_auth(view):
    @wraps(view)
    def wrapped(*args, **kwargs):
        header = request.headers.get('Authorization', '')
        if not header.startswith('Bearer '):
            return {'ok': False, 'error': 'unauthorized'}, 401

        token = header.removeprefix('Bearer ').strip()
        try:
            decoded = firebase_auth.verify_id_token(token)
        except Exception:
            return {'ok': False, 'error': 'unauthorized'}, 401

        g.uid = decoded['uid']
        g.user_email = decoded.get('email')
        upsert_user(g.uid, g.user_email, decoded.get('name'))
        # Bootstraps the first lecturer account from the ADMIN_EMAILS
        # allowlist. Returns immediately for any address not on it, so the
        # student path costs nothing.
        sync_allowlisted_admin(g.uid, g.user_email)
        return view(*args, **kwargs)

    return wrapped


def require_admin(view):
    """Authenticate, then refuse anyone whose role is not 'admin'.

    Stacked on top of require_auth rather than replacing it, so an admin route
    still gets g.uid and the same token verification every other route uses.
    The role lookup is deliberately here and not in require_auth: it is one
    extra SELECT, and only lecturer-facing routes need to pay for it.

    Every /api/admin route is gated server-side by this. The frontend also
    hides the dashboard from students, but that is a convenience -- hiding a
    button is not access control, and a student who calls the endpoint
    directly gets a 403 here.
    """
    @wraps(view)
    @require_auth
    def wrapped(*args, **kwargs):
        if get_role(g.uid) != ROLE_ADMIN:
            return {'ok': False, 'error': 'forbidden'}, 403
        g.role = ROLE_ADMIN
        return view(*args, **kwargs)

    return wrapped
