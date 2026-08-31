"""The template pool the Indexing practice engine draws questions from.

Structurally the same idea as slicing_templates.py, scaled down to match
what single-character indexing actually needs: a template is a *shape* of
index -- "the first character" or "a small negative index" -- tagged with
a difficulty band and the misconception concept it probes, and every
question multiplies a template against a fresh string. See
slicing_templates.py's own docstring for why that multiplication is what
keeps an endless session from repeating itself; the same reasoning applies
here unchanged.

Word-only for now (`WORDS_ONLY`): Indexing's static exercise bank already
covers plain words, and corpus.py's structured kinds (dates, filenames)
are a natural later extension -- `Template(..., kinds=corpus.STRUCTURED_KINDS,
field_based=True)` is already how slicing_templates.py does it -- not
added here to keep this module's first version reviewable on its own
merits.
"""
from . import corpus
from . import practice_engine_core as core

BAND_EASY = core.BAND_EASY
BAND_EASY_MEDIUM = core.BAND_EASY_MEDIUM
BAND_MEDIUM = core.BAND_MEDIUM
BAND_MEDIUM_HARD = core.BAND_MEDIUM_HARD
BAND_HARD = core.BAND_HARD
BAND_VERY_HARD = core.BAND_VERY_HARD
TIER_BANDS = core.TIER_BANDS
Template = core.Template

# Concepts, reusing the grader's real misconception ids (feedback.py /
# exercises.json's indexing misconception_map) so feedback, template
# tagging and adaptive selection all speak one vocabulary.
C_ONE_BASED = "indexing_from_one"
C_NEGATIVE_INDEX = "negative_index_confusion"
C_OFF_BY_ONE = "off_by_one_length"

WORDS_ONLY = (corpus.KIND_WORD,)


def _clamp(rng, lo, hi):
    if hi < lo:
        lo, hi = hi, lo
    return rng.randint(lo, hi)


# ─── EASY ───────────────────────────────────────────────────────────────────
# The two indices every learner meets first: the very first character, and
# "the last character" via -1 (not via a length calculation yet).

def _t_first(entry, rng):
    return 0


def _t_last_negative(entry, rng):
    return -1


def _t_second(entry, rng):
    return 1


# ─── EASY_MEDIUM ────────────────────────────────────────────────────────────

def _t_small_positive(entry, rng):
    return _clamp(rng, 2, 3)


def _t_small_negative(entry, rng):
    return -_clamp(rng, 2, 3)


# ─── MEDIUM ─────────────────────────────────────────────────────────────────
# A genuine middle index, positive and negative -- nothing at the boundary
# to anchor on, so this is the first band where the learner has to actually
# count rather than recognise a memorised shape.

def _t_mid_positive(entry, rng):
    n = len(entry.value)
    return _clamp(rng, 3, max(3, n - 4))


def _t_mid_negative(entry, rng):
    n = len(entry.value)
    return -_clamp(rng, 3, max(3, n - 4))


# ─── MEDIUM_HARD ────────────────────────────────────────────────────────────
# Positive landing near the end, negative landing near the start -- the
# combination C_ONE_BASED and C_NEGATIVE_INDEX distractors are built to
# exploit: a learner anchored on "positive means near the start, negative
# means near the end" gets these backwards.

def _t_near_end_positive(entry, rng):
    n = len(entry.value)
    return n - 2


def _t_near_start_negative(entry, rng):
    n = len(entry.value)
    return -(n - 1)


# ─── HARD ───────────────────────────────────────────────────────────────────
# The exact boundary values: the correct positive index for "the last
# character" (n - 1, as opposed to the n that raises -- see
# indexing_engine.py's error-kind builder) and the most-negative valid
# index (the first character via -n).

def _t_last_positive(entry, rng):
    n = len(entry.value)
    return n - 1


def _t_first_negative(entry, rng):
    n = len(entry.value)
    return -n


# ─── VERY_HARD ──────────────────────────────────────────────────────────────
# Deep indices on longer words only, where nothing about the shape of the
# number gives away whether it is near an edge.

def _t_deep_positive(entry, rng):
    n = len(entry.value)
    if n < 10:
        return None
    return _clamp(rng, 4, n - 5)


def _t_deep_negative(entry, rng):
    n = len(entry.value)
    if n < 10:
        return None
    return -_clamp(rng, 4, n - 5)


TEMPLATES = [
    Template("first", BAND_EASY, _t_first, C_ONE_BASED, min_len=5, kinds=WORDS_ONLY),
    Template("last_negative", BAND_EASY, _t_last_negative, C_NEGATIVE_INDEX, min_len=5, kinds=WORDS_ONLY),
    Template("second", BAND_EASY, _t_second, C_ONE_BASED, min_len=5, kinds=WORDS_ONLY),

    Template("small_positive", BAND_EASY_MEDIUM, _t_small_positive, C_ONE_BASED, min_len=6, kinds=WORDS_ONLY),
    Template("small_negative", BAND_EASY_MEDIUM, _t_small_negative, C_NEGATIVE_INDEX, min_len=6, kinds=WORDS_ONLY),

    Template("mid_positive", BAND_MEDIUM, _t_mid_positive, C_ONE_BASED, min_len=7, kinds=WORDS_ONLY),
    Template("mid_negative", BAND_MEDIUM, _t_mid_negative, C_NEGATIVE_INDEX, min_len=7, kinds=WORDS_ONLY),

    Template("near_end_positive", BAND_MEDIUM_HARD, _t_near_end_positive, C_NEGATIVE_INDEX, min_len=7, kinds=WORDS_ONLY),
    Template("near_start_negative", BAND_MEDIUM_HARD, _t_near_start_negative, C_NEGATIVE_INDEX, min_len=7, kinds=WORDS_ONLY),

    Template("last_positive", BAND_HARD, _t_last_positive, C_OFF_BY_ONE, min_len=6, kinds=WORDS_ONLY),
    Template("first_negative", BAND_HARD, _t_first_negative, C_NEGATIVE_INDEX, min_len=6, kinds=WORDS_ONLY),

    Template("deep_positive", BAND_VERY_HARD, _t_deep_positive, C_ONE_BASED, min_len=10, kinds=WORDS_ONLY),
    Template("deep_negative", BAND_VERY_HARD, _t_deep_negative, C_NEGATIVE_INDEX, min_len=10, kinds=WORDS_ONLY),
]

BY_ID = {t.id: t for t in TEMPLATES}


def for_tier(tier):
    return core.for_tier(TEMPLATES, tier, TIER_BANDS)


# ─── write_code tasks ───────────────────────────────────────────────────────
# Small, authored (not generated) tasks in the same spirit as
# slicing_templates.py's CODE_TASKS -- each has to hold for *any* string,
# which rules out deriving one from a random index the same way the other
# kinds are built.

CODE_TASKS = {
    "first_char": {
        "band": BAND_MEDIUM,
        "needs_n": False,
        "statement": "print the first character of `word`",
        "spec": lambda w, n: w[0],
    },
    "last_char": {
        "band": BAND_MEDIUM,
        "needs_n": False,
        "statement": "print the last character of `word`, without using its length",
        "spec": lambda w, n: w[-1],
    },
    "nth_char": {
        "band": BAND_MEDIUM_HARD,
        "needs_n": True,
        "statement": "print the character at position {n} of `word`",
        "spec": lambda w, n: w[n],
    },
    "nth_from_end": {
        "band": BAND_HARD,
        "needs_n": True,
        "statement": "print the character {n} positions from the end of `word` (1 means the last character)",
        "spec": lambda w, n: w[-n],
    },
    "first_and_last": {
        "band": BAND_HARD,
        "needs_n": False,
        "statement": "print the first and last characters of `word` next to each other, with nothing in between",
        "spec": lambda w, n: w[0] + w[-1],
    },
}


def code_tasks_for_tier(tier):
    bands = TIER_BANDS[tier]
    return [k for k, task in CODE_TASKS.items() if task["band"] in bands]
