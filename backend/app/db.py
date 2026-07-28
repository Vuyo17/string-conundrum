import os
from contextlib import contextmanager

import psycopg2
import psycopg2.extras


def _dsn() -> str:
    dsn = os.environ.get("DATABASE_URL")
    if not dsn:
        raise RuntimeError(
            "DATABASE_URL is not set, e.g. "
            "postgresql://string_conundrum_app:PASSWORD@127.0.0.1:5432/string_conundrum"
        )
    return dsn


@contextmanager
def get_connection():
    conn = psycopg2.connect(_dsn())
    try:
        yield conn
        conn.commit()
    except Exception:
        conn.rollback()
        raise
    finally:
        conn.close()


@contextmanager
def get_cursor():
    with get_connection() as conn:
        with conn.cursor(cursor_factory=psycopg2.extras.RealDictCursor) as cur:
            yield cur
