from functools import wraps

from firebase_admin import auth as firebase_auth
from flask import g, request


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
        return view(*args, **kwargs)

    return wrapped
