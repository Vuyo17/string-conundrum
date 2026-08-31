"""The template pool the Comparison practice engine draws questions from.

Comparison doesn't fit practice_engine_core.py's Template class as neatly
as the other modules: that class (and its .accepts(entry)) assumes a
question is built from *one* corpus entry, but every comparison question
here needs *two* operands -- two strings, or a string and a number. Rather
than bend Template to cover a shape it wasn't designed for, comparison
templates are a light local class carrying just what core.for_tier()
actually needs (.band) plus .id/.concept/.build, and .build takes the word
pool directly instead of a single corpus.Entry.

Every comparison's result is computed by literally evaluating the real
operator on the real operands in this trusted server code (never learner
input -- see looping_templates.py's docstring for the same reasoning
applied to loops), so "what does this evaluate to" is never a
hand-simulated re-implementation of ==, <, or > that could itself be wrong.
"""
import random

from . import practice_engine_core as core

BAND_EASY = core.BAND_EASY
BAND_EASY_MEDIUM = core.BAND_EASY_MEDIUM
BAND_MEDIUM = core.BAND_MEDIUM
BAND_MEDIUM_HARD = core.BAND_MEDIUM_HARD
BAND_HARD = core.BAND_HARD
BAND_VERY_HARD = core.BAND_VERY_HARD
TIER_BANDS = core.TIER_BANDS

# Concepts, reusing the grader's real misconception ids (exercises.json's
# comparison misconception_map has exactly these three).
C_CASE = "comparison_ignores_case"
C_ORDERABLE = "strings_not_orderable_myth"
C_NUMBER_EQUALITY = "string_number_equality_myth"
C_GENERAL = "comparison_general"


class CTemplate:
    __slots__ = ("id", "band", "build", "concept")

    def __init__(self, id, band, build, concept):
        self.id = id
        self.band = band
        self.build = build
        self.concept = concept

    def __repr__(self):
        return f"CTemplate({self.id!r}, {self.band!r})"


class Comparison:
    """One concrete comparison: the two operands as they should appear in
    the prompt (already `repr`-quoted where relevant), the operator, and
    the real result of evaluating them -- or the real exception, for the
    templates that are specifically about the TypeError case."""

    __slots__ = ("left_src", "right_src", "op", "result", "raises")

    def __init__(self, left_src, right_src, op, result, raises=False):
        self.left_src = left_src
        self.right_src = right_src
        self.op = op
        self.result = result
        self.raises = raises

    @property
    def expression(self):
        return f"{self.left_src} {self.op} {self.right_src}"


_OPS = {
    "==": lambda a, b: a == b,
    "!=": lambda a, b: a != b,
    "<": lambda a, b: a < b,
    ">": lambda a, b: a > b,
    "<=": lambda a, b: a <= b,
    ">=": lambda a, b: a >= b,
}


def _compare(left_val, right_val, op, left_src, right_src):
    try:
        result = _OPS[op](left_val, right_val)
        return Comparison(left_src, right_src, op, result)
    except TypeError:
        return Comparison(left_src, right_src, op, None, raises=True)


# ─── EASY ───────────────────────────────────────────────────────────────────

def _t_equal_same(words, rng):
    w = rng.choice(words)
    return _compare(w, w, "==", f'"{w}"', f'"{w}"')


def _t_equal_different(words, rng):
    a, b = rng.sample(words, 2)
    return _compare(a, b, "==", f'"{a}"', f'"{b}"')


# ─── EASY_MEDIUM ────────────────────────────────────────────────────────────

def _t_case_mismatch_equal(words, rng):
    w = rng.choice(words)
    variant = w.upper() if rng.random() < 0.5 else w.capitalize()
    if variant == w:
        return None
    return _compare(w, variant, "==", f'"{w}"', f'"{variant}"')


def _t_not_equal_different(words, rng):
    a, b = rng.sample(words, 2)
    return _compare(a, b, "!=", f'"{a}"', f'"{b}"')


# ─── MEDIUM ─────────────────────────────────────────────────────────────────

def _t_lexicographic_lt(words, rng):
    a, b = rng.sample(words, 2)
    if a == b:
        return None
    return _compare(a, b, "<", f'"{a}"', f'"{b}"')


def _t_lexicographic_gt(words, rng):
    a, b = rng.sample(words, 2)
    if a == b:
        return None
    return _compare(a, b, ">", f'"{a}"', f'"{b}"')


# ─── MEDIUM_HARD ────────────────────────────────────────────────────────────

def _t_string_number_equal(words, rng):
    n = rng.randint(1, 999)
    as_str = str(n)
    return _compare(as_str, n, "==", f'"{as_str}"', str(n))


def _t_prefix_ordering(words, rng):
    # A word that is a real prefix of a longer one in the pool, if any
    # exists in a sample of it -- "cat" < "catalog" is the classic
    # lexicographic-ordering surprise (the shorter, prefix string always
    # sorts first).
    #
    # rng.sample, not rng.shuffle: shuffle reorders its argument IN PLACE,
    # and `words` here is the module-level word list passed straight
    # through from every caller -- shuffling it would permanently corrupt
    # the shared corpus order for every other template's rng.choice/
    # rng.sample calls afterwards, silently breaking grading's ability to
    # reproduce a question from its token (the exact same class of bug
    # looping_engine's Loop objects were built specifically to avoid).
    # Caught by generating the identical (tier, seed, weak) question twice
    # and checking the two pools actually matched.
    sample = rng.sample(words, min(40, len(words)))
    for a in sample:
        for b in sample:
            if a != b and b.startswith(a):
                return _compare(a, b, "<", f'"{a}"', f'"{b}"')
    return None


def _t_string_number_type_error(words, rng):
    # BAND_MEDIUM_HARD, not BAND_HARD: this is the ONLY template that ever
    # raises, so it's what KIND_ERROR's "at least one raising candidate"
    # requirement depends on entirely. _TIER_KINDS declares KIND_ERROR
    # reachable from tier 4, but tier 4's band window is
    # (MEDIUM, MEDIUM_HARD) -- tagging this BAND_HARD (tier 5 only) would
    # make error-kind questions silently never generate at tier 4, exactly
    # the same "declared but unreachable" shape as looping's mistagged
    # code task, just at the kind level instead of the task level.
    w = rng.choice(words)
    n = rng.randint(1, 999)
    op = rng.choice(["<", ">"])
    return _compare(w, n, op, f'"{w}"', str(n))


# ─── HARD ───────────────────────────────────────────────────────────────────

def _t_case_mismatch_not_equal(words, rng):
    w = rng.choice(words)
    variant = w.upper()
    if variant == w:
        return None
    return _compare(w, variant, "!=", f'"{w}"', f'"{variant}"')


# ─── VERY_HARD ──────────────────────────────────────────────────────────────

def _t_numeric_string_lexicographic(words, rng):
    # The genuinely surprising case: '9' < '10' is False, because string
    # comparison is character by character ('9' > '1'), not numeric.
    a = rng.randint(1, 9)
    b = rng.randint(10, 99)
    return _compare(str(a), str(b), "<", f'"{a}"', f'"{b}"')


def _t_case_and_length_combo(words, rng):
    a, b = rng.sample(words, 2)
    op = rng.choice(["<=", ">="])
    return _compare(a.upper(), b, op, f'"{a.upper()}"', f'"{b}"')


TEMPLATES = [
    CTemplate("equal_same", BAND_EASY, _t_equal_same, C_GENERAL),
    CTemplate("equal_different", BAND_EASY, _t_equal_different, C_GENERAL),

    CTemplate("case_mismatch_equal", BAND_EASY_MEDIUM, _t_case_mismatch_equal, C_CASE),
    CTemplate("not_equal_different", BAND_EASY_MEDIUM, _t_not_equal_different, C_GENERAL),

    CTemplate("lexicographic_lt", BAND_MEDIUM, _t_lexicographic_lt, C_ORDERABLE),
    CTemplate("lexicographic_gt", BAND_MEDIUM, _t_lexicographic_gt, C_ORDERABLE),

    CTemplate("string_number_equal", BAND_MEDIUM_HARD, _t_string_number_equal, C_NUMBER_EQUALITY),
    CTemplate("prefix_ordering", BAND_MEDIUM_HARD, _t_prefix_ordering, C_ORDERABLE),

    CTemplate("string_number_type_error", BAND_MEDIUM_HARD, _t_string_number_type_error, C_ORDERABLE),
    CTemplate("case_mismatch_not_equal", BAND_HARD, _t_case_mismatch_not_equal, C_CASE),

    CTemplate("numeric_string_lexicographic", BAND_VERY_HARD, _t_numeric_string_lexicographic, C_ORDERABLE),
    CTemplate("case_and_length_combo", BAND_VERY_HARD, _t_case_and_length_combo, C_CASE),
]

BY_ID = {t.id: t for t in TEMPLATES}


def for_tier(tier):
    return core.for_tier(TEMPLATES, tier, TIER_BANDS)


# ─── write_code tasks ───────────────────────────────────────────────────────
# Two operands, `word1` and `word2` -- the grader deliberately mixes
# same-word/different-case pairs in with plain distinct pairs when testing
# these (see looping_engine.py's _code_test_words for the general pattern
# this follows), so a hardcoded `print(False)` can't pass "are these equal
# ignoring case" just because two random words are almost never equal.

CODE_TASKS = {
    "case_insensitive_equal": {
        "band": BAND_MEDIUM,
        "needs_n": False,
        "statement": "print True if `word1` and `word2` are equal ignoring case, and False otherwise",
        "spec": lambda w1, w2: str(w1.lower() == w2.lower()),
    },
    "alphabetical_order": {
        "band": BAND_MEDIUM_HARD,
        "needs_n": False,
        "statement": "print True if `word1` comes before `word2` alphabetically, and False otherwise",
        "spec": lambda w1, w2: str(w1 < w2),
    },
}


def code_tasks_for_tier(tier):
    bands = TIER_BANDS[tier]
    return [k for k, task in CODE_TASKS.items() if task["band"] in bands]
