"""The template pool the Slicing practice engine draws questions from.

A template is a *shape* of slice, not a question. `word[a:b]` with small
positive bounds is one template; every question built from it picks a fresh
string and fresh bounds, so `hello[0:1]` and `friend[3:4]` are the same
template and visibly different questions. Multiplying the pool out —
templates x strings x bounds x question kinds x answer formats — is what
keeps an endless session from repeating itself.

Templates are tagged with one of six difficulty bands. The bands are a
property of the *slice shape*: `word[2:5]` is easy no matter which word it
lands on, and `word[-2:1:-1]` is hard no matter which. Tiers then draw from
a sliding window of bands (see TIER_BANDS), so tier 1 only ever sees easy
shapes and tier 5 only ever sees the hardest — while the five-star rail the
student sees stays exactly as it was.

Each template also names the *concept* it probes, using the same
misconception vocabulary the grader already speaks (see feedback.py). That
is what lets the engine answer "this student keeps getting negative indices
wrong" with "then ask more negative-index templates" rather than continuing
to pick uniformly at random.
"""
from . import corpus

# ─── difficulty bands ───────────────────────────────────────────────────────

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

# Six bands over five stars. The windows overlap so a tier is never a hard
# cliff: reaching tier 3 does not mean easy_medium shapes vanish, it means
# medium ones start appearing alongside them.
TIER_BANDS = {
    1: (BAND_EASY,),
    2: (BAND_EASY, BAND_EASY_MEDIUM),
    3: (BAND_EASY_MEDIUM, BAND_MEDIUM),
    4: (BAND_MEDIUM, BAND_MEDIUM_HARD),
    5: (BAND_MEDIUM_HARD, BAND_HARD, BAND_VERY_HARD),
}

# Concepts, reusing the grader's misconception ids so feedback, template
# tagging and adaptive selection all speak one vocabulary.
C_STOP_EXCLUSIVE = "slice_stop_inclusive"
C_OFF_BY_ONE = "off_by_one_length"
C_NEGATIVE_INDEX = "negative_index_confusion"
C_NEGATIVE_STEP = "negative_step_unfamiliar"
C_ONE_BASED = "indexing_from_one"
C_DEFAULTS = "slice_defaults"
C_STEP = "slice_step"
C_CLAMPING = "slice_clamping"
C_EMPTY = "slice_empty_result"

ANY_KIND = ()
WORDS_ONLY = (corpus.KIND_WORD,)


class Template:
    """One slice shape, plus everything needed to draw a question from it.

    `build(entry, rng)` returns a `(start, stop, step)` triple for the given
    string, or None if that string cannot carry this shape (too short, wrong
    kind). Returning None is normal — the engine simply tries another
    template rather than emitting a degenerate question.
    """

    __slots__ = ("id", "band", "build", "concept", "min_len", "kinds", "field_based")

    def __init__(self, id, band, build, concept, min_len=6, kinds=ANY_KIND, field_based=False):
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


def _clamp(rng, lo, hi):
    if hi < lo:
        lo, hi = hi, lo
    return rng.randint(lo, hi)


# ─── EASY ───────────────────────────────────────────────────────────────────
# Positive bounds, step 1, nothing omitted or negative. The only idea under
# test is that stop is exclusive.

def _t_short_span(entry, rng):
    n = len(entry.value)
    start = _clamp(rng, 0, max(0, n - 4))
    return start, min(start + _clamp(rng, 2, 3), n), None


def _t_from_zero(entry, rng):
    n = len(entry.value)
    return 0, _clamp(rng, 2, max(2, n - 2)), None


def _t_prefix(entry, rng):
    n = len(entry.value)
    return None, _clamp(rng, 2, max(2, n - 2)), None


def _t_suffix(entry, rng):
    n = len(entry.value)
    return _clamp(rng, 2, max(2, n - 2)), None, None


def _t_single_char_span(entry, rng):
    n = len(entry.value)
    start = _clamp(rng, 0, n - 1)
    return start, start + 1, None


# ─── EASY-MEDIUM ────────────────────────────────────────────────────────────
# One bound left to its default, or one counting from the end. Still step 1.

def _t_wide_span(entry, rng):
    n = len(entry.value)
    start = _clamp(rng, 1, 3)
    return start, n - _clamp(rng, 1, 3), None


def _t_last_k(entry, rng):
    n = len(entry.value)
    return -_clamp(rng, 2, max(2, min(4, n - 2))), None, None


def _t_all_but_last_k(entry, rng):
    n = len(entry.value)
    return None, -_clamp(rng, 1, max(1, min(3, n - 2))), None


def _t_explicit_end(entry, rng):
    # word[a:len(word)] — the same as omitting stop, which is the point.
    n = len(entry.value)
    return _clamp(rng, 1, max(1, n - 3)), n, None


def _t_drop_ends(entry, rng):
    return 1, -1, None


# ─── MEDIUM ─────────────────────────────────────────────────────────────────
# Both bounds negative, mixed signs, or a simple forward step.

def _t_both_negative(entry, rng):
    n = len(entry.value)
    stop = -_clamp(rng, 1, 3)
    start = stop - _clamp(rng, 2, 4)
    return (start if -n <= start else None), stop, None


def _t_mixed_signs(entry, rng):
    n = len(entry.value)
    return _clamp(rng, 0, 3), -_clamp(rng, 1, 3), None


def _t_every_other(entry, rng):
    return None, None, 2


def _t_step_from_offset(entry, rng):
    return _clamp(rng, 1, 3), None, 2


def _t_field(entry, rng):
    """Extract a named field of a structured string — the real-world case."""
    return entry.fields[rng.choice(sorted(entry.fields))]


# ─── MEDIUM-HARD ────────────────────────────────────────────────────────────
# Steps combined with real bounds, clamping, and the empty-result trap.

def _t_bounded_step(entry, rng):
    n = len(entry.value)
    start = _clamp(rng, 0, 2)
    return start, n - _clamp(rng, 0, 2), rng.choice([2, 3])


def _t_full_reverse(entry, rng):
    return None, None, -1


def _t_out_of_range_stop(entry, rng):
    # Slicing clamps where indexing would raise — worth meeting head on.
    n = len(entry.value)
    return _clamp(rng, 0, 3), n + _clamp(rng, 5, 40), None


def _t_out_of_range_start(entry, rng):
    n = len(entry.value)
    return -(n + _clamp(rng, 5, 40)), _clamp(rng, 2, max(2, n - 2)), None


def _t_empty_backwards(entry, rng):
    # start after stop with a forward step yields '' rather than an error.
    n = len(entry.value)
    stop = _clamp(rng, 0, max(0, n - 4))
    return stop + _clamp(rng, 2, 4), stop, None


def _t_negative_step_bounded(entry, rng):
    n = len(entry.value)
    return _clamp(rng, max(0, n - 4), n - 1), None, -1


# ─── HARD ───────────────────────────────────────────────────────────────────
# Negative steps with real bounds, where direction and sign interact.

def _t_reverse_every_other(entry, rng):
    return None, None, rng.choice([-2, -3])


def _t_negative_step_negative_bounds(entry, rng):
    n = len(entry.value)
    start = -_clamp(rng, 1, 3)
    return start, -_clamp(rng, max(4, n - 3), n), -1


def _t_negative_step_mixed(entry, rng):
    n = len(entry.value)
    start = _clamp(rng, max(0, n - 4), n - 1)
    return start, _clamp(rng, 0, 2), -1


def _t_empty_wrong_direction(entry, rng):
    # A negative step with start *before* stop gives '' — the mirror of
    # _t_empty_backwards, and the one students almost never predict.
    n = len(entry.value)
    start = _clamp(rng, 0, 2)
    return start, start + _clamp(rng, 2, 4), -1


def _t_step_exceeds_span(entry, rng):
    n = len(entry.value)
    start = _clamp(rng, 0, max(0, n - 5))
    return start, start + 3, _clamp(rng, 4, 6)


# ─── VERY HARD ──────────────────────────────────────────────────────────────
# Everything at once: negative bounds, negative steps, wide strides.

def _t_negative_step_wide(entry, rng):
    n = len(entry.value)
    return -_clamp(rng, 1, 2), -_clamp(rng, max(5, n - 2), n), rng.choice([-2, -3])


def _t_both_negative_step(entry, rng):
    n = len(entry.value)
    start = -_clamp(rng, 1, 3)
    stop = start - _clamp(rng, 3, 5)
    return start, (stop if -n <= stop else None), -2


def _t_stride_three_bounded(entry, rng):
    n = len(entry.value)
    return _clamp(rng, 1, 3), n - _clamp(rng, 1, 2), 3


def _t_reverse_from_middle(entry, rng):
    n = len(entry.value)
    return n // 2, None, -1


TEMPLATES = [
    # easy
    Template("short_span", BAND_EASY, _t_short_span, C_STOP_EXCLUSIVE, kinds=WORDS_ONLY),
    Template("from_zero", BAND_EASY, _t_from_zero, C_STOP_EXCLUSIVE, kinds=WORDS_ONLY),
    Template("prefix", BAND_EASY, _t_prefix, C_DEFAULTS, kinds=WORDS_ONLY),
    Template("suffix", BAND_EASY, _t_suffix, C_DEFAULTS, kinds=WORDS_ONLY),
    Template("single_char_span", BAND_EASY, _t_single_char_span, C_ONE_BASED, kinds=WORDS_ONLY),

    # easy-medium
    Template("wide_span", BAND_EASY_MEDIUM, _t_wide_span, C_STOP_EXCLUSIVE),
    Template("last_k", BAND_EASY_MEDIUM, _t_last_k, C_NEGATIVE_INDEX),
    Template("all_but_last_k", BAND_EASY_MEDIUM, _t_all_but_last_k, C_NEGATIVE_INDEX),
    Template("explicit_end", BAND_EASY_MEDIUM, _t_explicit_end, C_OFF_BY_ONE),
    Template("drop_ends", BAND_EASY_MEDIUM, _t_drop_ends, C_NEGATIVE_INDEX, min_len=5),

    # medium
    Template("both_negative", BAND_MEDIUM, _t_both_negative, C_NEGATIVE_INDEX, min_len=7),
    Template("mixed_signs", BAND_MEDIUM, _t_mixed_signs, C_NEGATIVE_INDEX, min_len=7),
    Template("every_other", BAND_MEDIUM, _t_every_other, C_STEP),
    Template("step_from_offset", BAND_MEDIUM, _t_step_from_offset, C_STEP, min_len=7),
    Template("field_extract", BAND_MEDIUM, _t_field, C_DEFAULTS, min_len=8, field_based=True),

    # medium-hard
    Template("bounded_step", BAND_MEDIUM_HARD, _t_bounded_step, C_STEP, min_len=8),
    Template("full_reverse", BAND_MEDIUM_HARD, _t_full_reverse, C_NEGATIVE_STEP),
    Template("out_of_range_stop", BAND_MEDIUM_HARD, _t_out_of_range_stop, C_CLAMPING, min_len=7),
    Template("out_of_range_start", BAND_MEDIUM_HARD, _t_out_of_range_start, C_CLAMPING, min_len=7),
    Template("empty_backwards", BAND_MEDIUM_HARD, _t_empty_backwards, C_EMPTY, min_len=7),
    Template("negative_step_bounded", BAND_MEDIUM_HARD, _t_negative_step_bounded, C_NEGATIVE_STEP, min_len=7),
    Template("field_extract_hard", BAND_MEDIUM_HARD, _t_field, C_DEFAULTS, min_len=8, field_based=True),

    # hard
    Template("reverse_every_other", BAND_HARD, _t_reverse_every_other, C_NEGATIVE_STEP, min_len=8),
    Template("neg_step_neg_bounds", BAND_HARD, _t_negative_step_negative_bounds, C_NEGATIVE_STEP, min_len=8),
    Template("neg_step_mixed", BAND_HARD, _t_negative_step_mixed, C_NEGATIVE_STEP, min_len=8),
    Template("empty_wrong_direction", BAND_HARD, _t_empty_wrong_direction, C_EMPTY, min_len=8),
    Template("step_exceeds_span", BAND_HARD, _t_step_exceeds_span, C_STEP, min_len=8),

    # very hard
    Template("neg_step_wide", BAND_VERY_HARD, _t_negative_step_wide, C_NEGATIVE_STEP, min_len=9),
    Template("both_negative_step", BAND_VERY_HARD, _t_both_negative_step, C_NEGATIVE_STEP, min_len=9),
    Template("stride_three_bounded", BAND_VERY_HARD, _t_stride_three_bounded, C_STEP, min_len=9),
    Template("reverse_from_middle", BAND_VERY_HARD, _t_reverse_from_middle, C_NEGATIVE_STEP, min_len=9),
]

BY_ID = {t.id: t for t in TEMPLATES}


def for_band(band):
    return [t for t in TEMPLATES if t.band == band]


def for_tier(tier):
    bands = TIER_BANDS[tier]
    return [t for t in TEMPLATES if t.band in bands]


# ─── write_code tasks ───────────────────────────────────────────────────────
# These are templates too, but of a different shape: a coding task has to be
# stateable in one sentence that holds for *any* string, because grading runs
# the submission against several. That rules out generating them from a
# random slice ("print word[3:5]" is satisfiable without understanding it),
# so they are authored — and banded like everything else.

CODE_TASKS = {
    "first_n": {
        "band": BAND_MEDIUM,
        "needs_n": True,
        "statement": "print the first {n} characters of `word`",
        "spec": lambda w, n: w[:n],
    },
    "last_n": {
        "band": BAND_MEDIUM,
        "needs_n": True,
        "statement": "print the last {n} characters of `word`",
        "spec": lambda w, n: w[-n:],
    },
    "skip_first_n": {
        "band": BAND_MEDIUM,
        "needs_n": True,
        "statement": "print `word` with its first {n} characters removed",
        "spec": lambda w, n: w[n:],
    },
    "drop_ends": {
        "band": BAND_MEDIUM_HARD,
        "needs_n": False,
        "statement": "print `word` without its first and last character",
        "spec": lambda w, n: w[1:-1],
    },
    "every_other": {
        "band": BAND_MEDIUM_HARD,
        "needs_n": False,
        "statement": "print every second character of `word`, starting from the first",
        "spec": lambda w, n: w[::2],
    },
    "drop_last_n": {
        "band": BAND_MEDIUM_HARD,
        "needs_n": True,
        "statement": "print `word` with its last {n} characters removed",
        "spec": lambda w, n: w[:-n],
    },
    "reverse": {
        "band": BAND_HARD,
        "needs_n": False,
        "statement": "print `word` backwards",
        "spec": lambda w, n: w[::-1],
    },
    "second_half": {
        "band": BAND_HARD,
        "needs_n": False,
        "statement": "print the second half of `word` (for an odd length, the longer half)",
        "spec": lambda w, n: w[len(w) // 2:],
    },
    "reverse_every_other": {
        "band": BAND_VERY_HARD,
        "needs_n": False,
        "statement": "print every second character of `word`, reading backwards from the last",
        "spec": lambda w, n: w[::-2],
    },
    "reverse_without_ends": {
        "band": BAND_VERY_HARD,
        "needs_n": False,
        "statement": "print `word` backwards, without its first and last character",
        "spec": lambda w, n: w[1:-1][::-1],
    },
}


def code_tasks_for_tier(tier):
    bands = TIER_BANDS[tier]
    keys = [k for k, task in CODE_TASKS.items() if task["band"] in bands]
    # Tiers below the first coding band have no tasks; callers gate on that.
    return keys
