"""Procedural, unlimited-question engine for the Slicing module's endless
Practice mode.

Practice/Exam elsewhere draw from a small static exercise bank (see
feedback.py) that runs out after a few dozen questions. This engine
generates fresh slicing questions on demand instead, escalating through
five difficulty tiers as the student answers correctly, then holding at
the hardest tier indefinitely so a session never runs dry.

Questions are never stored anywhere. Each `generate()` call returns a
signed token that encodes the question's parameters (the word, the three
slice components, its tier and a random nonce). `grade()` verifies that
token's signature and recomputes both the correct answer and the
distractor set from it, so a client cannot forge a question or its
answer, and the server needs no database round trip — or session state —
to remember what it just asked.
"""
import base64
import hashlib
import hmac
import json
import os
import random
import time

MAX_TIER = 5
# Anti-tampering, not an auth boundary: generous enough that a student who
# sits on a question for a while (reading, re-reading the code) doesn't get
# a stale-token error, short enough that a token isn't useful long after.
TOKEN_TTL_SECONDS = 30 * 60

_SECRET = os.environ.get("SLICING_ENGINE_SECRET", "dev-only-insecure-secret-change-me").encode()

_WORD_POOL = [
    "python", "wonderland", "jabberwocky", "algorithm", "mockingbird",
    "keyboard", "raspberry", "quicksilver", "labyrinth", "chocolate",
    "umbrella", "butterfly", "hurricane", "xylophone", "asteroid",
    "dolphin", "elephant", "orchestra", "waterfall", "telescope",
]

_MISCONCEPTION_STOP_INCLUSIVE = "slice_stop_inclusive"
_MISCONCEPTION_OFF_BY_ONE = "off_by_one_length"
_MISCONCEPTION_NEGATIVE_INDEX = "negative_index_confusion"
_MISCONCEPTION_NEGATIVE_STEP = "negative_step_unfamiliar"
_MISCONCEPTION_ONE_BASED = "indexing_from_one"

_LEN_RANGE = {1: (6, 8), 2: (7, 10), 3: (8, 12), 4: (9, 13), 5: (10, 14)}


class InvalidToken(Exception):
    pass


# ─── question parameters, by difficulty tier ───────────────────────────────

def _clamped_randint(rng, lo, hi):
    if hi < lo:
        lo, hi = hi, lo
    return rng.randint(lo, hi)


def _pick_word(rng, min_len, max_len):
    candidates = [w for w in _WORD_POOL if min_len <= len(w) <= max_len]
    return rng.choice(candidates or _WORD_POOL)


def _pattern_basic_positive(word, rng):
    """word[start:stop] — small positive bounds only."""
    n = len(word)
    start = _clamped_randint(rng, 0, max(0, n - 4))
    stop = min(start + _clamped_randint(rng, 2, 4), n)
    return start, stop, None


def _pattern_omitted_bound(word, rng):
    """word[start:] or word[:stop] — one bound left to its default."""
    n = len(word)
    start = _clamped_randint(rng, 0, max(0, n - 4))
    stop = min(start + _clamped_randint(rng, 3, 5), n)
    if rng.random() < 0.5:
        return None, stop, None
    return start, None, None


def _pattern_negative_bound(word, rng):
    """One bound counts backwards from the end."""
    n = len(word)
    if rng.random() < 0.5:
        start = -_clamped_randint(rng, 3, max(3, n - 2))
        return start, None, None
    stop = -_clamped_randint(rng, 1, 3)
    start = _clamped_randint(rng, 0, 2)
    return start, stop, None


def _pattern_positive_step(word, rng):
    """A step greater than 1, walking forwards."""
    n = len(word)
    step = rng.choice([2, 3])
    start = 0 if rng.random() < 0.5 else _clamped_randint(rng, 0, 2)
    stop = n if rng.random() < 0.5 else n - _clamped_randint(rng, 0, 2)
    return start, stop, step


def _pattern_negative_step(word, rng):
    """A negative step, walking backwards — reversal territory."""
    n = len(word)
    step = rng.choice([-1, -2, -3])
    start = None if rng.random() < 0.4 else -_clamped_randint(rng, 1, 3)
    stop = None if rng.random() < 0.4 else -_clamped_randint(rng, max(1, n - 3), n)
    return start, stop, step


def _pattern_negative_step_mixed(word, rng):
    """Negative step with an explicit positive start — the hardest combo."""
    n = len(word)
    step = rng.choice([-1, -2])
    start = _clamped_randint(rng, max(0, n - 4), n - 1)
    stop = -_clamped_randint(rng, max(1, n - 2), n) if rng.random() < 0.5 else None
    return start, stop, step


_TIER_PATTERNS = {
    1: [_pattern_basic_positive],
    2: [_pattern_basic_positive, _pattern_omitted_bound],
    3: [_pattern_omitted_bound, _pattern_negative_bound],
    4: [_pattern_negative_bound, _pattern_positive_step],
    5: [_pattern_positive_step, _pattern_negative_step, _pattern_negative_step_mixed],
}


def _params_for_tier(tier, rng):
    word = _pick_word(rng, *_LEN_RANGE[tier])
    pattern = rng.choice(_TIER_PATTERNS[tier])
    start, stop, step = pattern(word, rng)
    return word, start, stop, step


def _slice_str(word, start, stop, step):
    return word[start:stop:step]


# ─── distractors, each tied to a specific slicing misconception ───────────

def _safe_slice(word, start, stop, step):
    # Python slicing never raises for out-of-range int bounds (only step=0
    # would), so every variant below is safe to evaluate unconditionally.
    return word[start:stop:step]


def _variant_stop_inclusive(word, start, stop, step):
    if step not in (None, 1) or stop is None:
        return None
    return _safe_slice(word, start, stop + 1, step), _MISCONCEPTION_STOP_INCLUSIVE


def _variant_off_by_one(word, start, stop, step):
    if stop is None:
        return _safe_slice(word, start, len(word) - 1, step), _MISCONCEPTION_OFF_BY_ONE
    return _safe_slice(word, start, stop - 1, step), _MISCONCEPTION_OFF_BY_ONE


def _variant_negative_index(word, start, stop, step):
    if (start is None or start >= 0) and (stop is None or stop >= 0):
        return None

    def reinterpret(value):
        # "-1 means the second-from-last character" — shifting every
        # negative index one step towards zero.
        return value + 1 if value is not None and value < 0 else value

    return _safe_slice(word, reinterpret(start), reinterpret(stop), step), _MISCONCEPTION_NEGATIVE_INDEX


def _variant_negative_step(word, start, stop, step):
    if step is None or step >= 0:
        return None
    return _safe_slice(word, start, stop, abs(step)), _MISCONCEPTION_NEGATIVE_STEP


def _variant_one_based(word, start, stop, step):
    if (start is not None and start < 0) or (stop is not None and stop < 0):
        return None
    shifted_start = max(0, start - 1) if start is not None else None
    shifted_stop = max(0, stop - 1) if stop is not None else None
    if shifted_start == start and shifted_stop == stop:
        return None
    return _safe_slice(word, shifted_start, shifted_stop, step), _MISCONCEPTION_ONE_BASED


_VARIANT_FUNCS = [
    _variant_stop_inclusive,
    _variant_off_by_one,
    _variant_negative_index,
    _variant_negative_step,
    _variant_one_based,
]


def _build_options(word, start, stop, step, correct, rng):
    """Four shuffled MCQ options: the correct slice plus up to three
    misconception-tagged distractors, padded with harmless letter-shuffles
    if a question's own variants don't yield enough distinct wrong answers.

    `rng` must be freshly seeded from the token's nonce so grading can call
    this again later and reproduce the exact same option set.
    """
    seen = {correct}
    pool = []
    for fn in _VARIANT_FUNCS:
        result = fn(word, start, stop, step)
        if result is None:
            continue
        text, misconception_id = result
        if text in seen:
            continue
        seen.add(text)
        pool.append((text, misconception_id))

    rng.shuffle(pool)
    distractors = pool[:3]

    # A short correct answer (e.g. 2 characters) has too few permutations to
    # reliably fill 3 distractors, so this always has an escape hatch: a
    # random extra letter, tried with growing suffix length until it lands
    # on something unseen. That's guaranteed to terminate rather than
    # depending on permutation space that can run dry.
    guard = 0
    while len(distractors) < 3 and guard < 40:
        guard += 1
        if len(correct) > 2 and guard <= 6:
            candidate = "".join(rng.sample(correct, len(correct)))
        else:
            suffix_len = 1 + guard // 10
            suffix = "".join(rng.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(suffix_len))
            candidate = correct + suffix
        if candidate not in seen:
            seen.add(candidate)
            distractors.append((candidate, None))

    options = [(correct, None)] + distractors
    rng.shuffle(options)
    misconception_by_option = {text: mid for text, mid in options}
    return [text for text, _ in options], misconception_by_option


# ─── prompt rendering ───────────────────────────────────────────────────────

def _bound(value):
    return "" if value is None else str(value)


def _expr(start, stop, step):
    expr = f"word[{_bound(start)}:{_bound(stop)}"
    if step is not None:
        expr += f":{step}"
    return expr + "]"


def _render_prompt(word, start, stop, step):
    # First line is the question title, the rest is shown as a code block —
    # the same split the static exercise bank's prompts use (see
    # PracticeSection.jsx's splitPrompt).
    title = f"What does `{_expr(start, stop, step)}` evaluate to?"
    code = f'word = "{word}"'
    return f"{title}\n{code}"


# ─── token signing ──────────────────────────────────────────────────────────

def _sign(payload: dict) -> str:
    raw = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode()
    body = base64.urlsafe_b64encode(raw).rstrip(b"=")
    sig = hmac.new(_SECRET, body, hashlib.sha256).digest()
    sig_b64 = base64.urlsafe_b64encode(sig).rstrip(b"=")
    return f"{body.decode()}.{sig_b64.decode()}"


def _verify(token: str) -> dict:
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


# ─── public API ─────────────────────────────────────────────────────────────

def generate(tier: int = 1, seed=None) -> dict:
    """Build one procedural slicing question at the given difficulty tier."""
    tier = max(1, min(MAX_TIER, int(tier)))
    rng = random.Random(seed) if seed is not None else random.Random()

    word, start, stop, step = _params_for_tier(tier, rng)
    correct = _slice_str(word, start, stop, step)

    nonce = rng.getrandbits(32)
    options_rng = random.Random(nonce)
    options, _ = _build_options(word, start, stop, step, correct, options_rng)

    payload = {
        "w": word, "a": start, "b": stop, "c": step,
        "t": tier, "n": nonce, "ts": int(time.time()),
    }

    return {
        "token": _sign(payload),
        "tier": tier,
        "stars": tier,
        "type": "mcq",
        "prompt": _render_prompt(word, start, stop, step),
        "options": options,
    }


def grade(token: str, answer: str) -> dict:
    """Verify a token, then grade the submitted answer against it.

    Returns `{"ok": False, "error": ...}` for a missing/expired/tampered
    token — a `POST /answer` with such a token means the session went stale
    or was interfered with, not that the student answered "wrong".
    """
    try:
        payload = _verify(token)
    except InvalidToken as exc:
        return {"ok": False, "error": str(exc)}

    word, start, stop, step = payload["w"], payload["a"], payload["b"], payload["c"]
    tier = payload["t"]
    correct_answer = _slice_str(word, start, stop, step)
    submitted = (answer or "").strip()
    is_correct = submitted == correct_answer

    if is_correct:
        return {
            "ok": True,
            "correct": True,
            "correct_answer": correct_answer,
            "misconception_id": None,
            "stars_awarded": tier,
            "tier": tier,
        }

    options_rng = random.Random(payload["n"])
    _, misconception_by_option = _build_options(word, start, stop, step, correct_answer, options_rng)
    return {
        "ok": True,
        "correct": False,
        "correct_answer": correct_answer,
        "misconception_id": misconception_by_option.get(submitted),
        "stars_awarded": 0,
        "tier": tier,
    }
