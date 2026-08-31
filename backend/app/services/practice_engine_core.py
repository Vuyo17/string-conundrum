# app/services/practice_engine_core.py
"""Module-agnostic scaffolding shared by every adaptive practice engine.

Extracted from slicing_engine.py (the original, Slicing-only implementation)
once a second module needed the same machinery. Nothing here knows what a
slice, an index, or a loop is -- that is each engine's own templates and
question-kind builders. What's here is the part that never depended on
that: signed, stateless question tokens, and misconception-weighted
template selection.

A signed token means no server-side session or database row is needed to
remember what question was asked: generate() encodes everything needed to
rebuild the question into the token, and grade() re-derives the question
and its answer key from the token itself rather than trusting the client.
The signature (HMAC-SHA256) is anti-tampering, not an auth boundary -- it
stops a learner from editing a token to claim a different answer, not from
reading its (base64, not encrypted) contents.
"""
import base64
import hashlib
import hmac
import json
import os
import time

TOKEN_TTL_SECONDS = 30 * 60
# Anti-tampering, not an auth boundary: generous enough that a student who
# sits on a question for a while (reading, re-reading the code) doesn't get
# a stale-token error, short enough that a token isn't useful long after.
# Kept under the historical name (predates this module) so an already-set
# production environment variable does not need to change.
_SECRET = os.environ.get("SLICING_ENGINE_SECRET", "dev-only-insecure-secret-change-me").encode()


class InvalidToken(Exception):
    pass


def sign(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    body = base64.urlsafe_b64encode(raw).rstrip(b"=")
    sig = hmac.new(_SECRET, body, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=")
    return f"{body.decode()}.{sig_b64.decode()}"


def verify(token: str) -> dict:
    if not token or "." not in token:
        raise InvalidToken("malformed token")
    body_s, sig_s = token.split(".", 1)

    expected_sig = hmac.new(_SECRET, body_s.encode(), hashlib.sha256).digest()
    expected_sig_b64 = base64.urlsafe_b64encode(expected_sig).rstrip(b"=").decode()
    if not hmac.compare_digest(expected_sig_b64, sig_s):
        raise InvalidToken("bad signature")

    try:
        padded = body_s + "=" * (-len(body_s) % 4)
        payload = json.loads(base64.urlsafe_b64decode(padded))
    except (ValueError, UnicodeDecodeError) as exc:
        raise InvalidToken("bad payload") from exc

    if int(time.time()) - payload.get("ts", 0) > TOKEN_TTL_SECONDS:
        raise InvalidToken("expired")
    return payload


def weighted_templates(templates, weak, weight=4):
    """Templates, repeated so weak concepts come up more often.

    Repetition rather than random.choices weights: it keeps selection a
    plain rng.choice, which means a seeded generate() stays reproducible
    across Python versions whose choices() internals may differ.

    `weak` is a set of concept ids; any template whose `.concept` is in
    that set is repeated `weight` times in the returned pool. `templates`
    is returned unchanged if `weak` is empty.
    """
    if not weak:
        return templates
    out = list(templates)
    for template in templates:
        if template.concept in weak:
            out.extend([template] * (weight - 1))
    return out


# ─── difficulty bands ───────────────────────────────────────────────────────
#
# Six bands over five tiers, shared by every module's templates: a band is a
# property of a question *shape* (e.g. "single positive index near the
# start" is easy no matter which string it lands on), and a tier draws from
# a sliding window of bands so difficulty is never a hard cliff -- reaching
# the next tier means a harder band starts appearing *alongside* the
# previous one, not replacing it.

BAND_EASY = "easy"
BAND_EASY_MEDIUM = "easy_medium"
BAND_MEDIUM = "medium"
BAND_MEDIUM_HARD = "medium_hard"
BAND_HARD = "hard"
BAND_VERY_HARD = "very_hard"

BANDS = (
    BAND_EASY, BAND_EASY_MEDIUM, BAND_MEDIUM,
    BAND_MEDIUM_HARD, BAND_HARD, BAND_VERY_HARD,
)

TIER_BANDS = {
    1: (BAND_EASY,),
    2: (BAND_EASY, BAND_EASY_MEDIUM),
    3: (BAND_EASY_MEDIUM, BAND_MEDIUM),
    4: (BAND_MEDIUM, BAND_MEDIUM_HARD),
    5: (BAND_MEDIUM_HARD, BAND_HARD, BAND_VERY_HARD),
}


class Template:
    """One question *shape*, plus everything needed to draw a question from
    it, for any module's engine.

    `build(entry, rng)` returns whatever that module's engine needs to
    build one question from the given corpus entry -- a `(start, stop,
    step)` triple for Slicing, a single index for Indexing, and so on; this
    class does not interpret the return value at all. Returning `None` is
    normal and expected: it means this string cannot carry this shape (too
    short, wrong corpus kind), and the engine should simply try another
    template rather than emit a degenerate question.
    """

    __slots__ = ("id", "band", "build", "concept", "min_len", "kinds", "field_based")

    def __init__(self, id, band, build, concept, min_len=6, kinds=(), field_based=False):
        self.id = id
        self.band = band
        self.build = build
        self.concept = concept
        self.min_len = min_len
        self.kinds = kinds
        self.field_based = field_based

    def accepts(self, entry):
        if len(entry.value) < self.min_len:
            return False
        if self.kinds and entry.kind not in self.kinds:
            return False
        if self.field_based and not entry.fields:
            return False
        return True

    def __repr__(self):
        return f"Template({self.id!r}, {self.band!r})"


def for_tier(templates, tier, tier_bands=None):
    """Every template in `templates` whose band is in this tier's window."""
    bands = (tier_bands or TIER_BANDS)[tier]
    return [t for t in templates if t.band in bands]


def parse_weak_concepts(raw, known_concepts):
    """The client's recent misconceptions, as a set the picker can use.

    Accepts a comma-separated string or a list. Unknown ids are dropped
    rather than rejected: the field is advisory, and a client sending
    something stale should get a normal question, not an error.
    """
    if not raw:
        return set()
    items = raw.split(",") if isinstance(raw, str) else list(raw)
    return {i.strip() for i in items if isinstance(i, str) and i.strip() in known_concepts}
