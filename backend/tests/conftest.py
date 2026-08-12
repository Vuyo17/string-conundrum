import os
import tempfile
from pathlib import Path

# These tests used to pass locally only because "DATABASE_URL is unset"
# implicitly switched the app onto the JSON state file. That rule is gone —
# it also meant a broken DSN in production degraded silently instead of
# failing — so the fallback is now requested explicitly here.
#
# CI sets DATABASE_URL and runs against a real Postgres service, where
# use_local_fallback() returns False and both variables below are ignored.
if not os.environ.get("DATABASE_URL"):
    os.environ.setdefault("LOCAL_DB_FALLBACK", "1")
    os.environ.setdefault(
        "LOCAL_DB_STATE_PATH",
        str(Path(tempfile.gettempdir()) / "string_conundrum_test_state.json"),
    )
