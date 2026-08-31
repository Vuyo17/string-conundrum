"""The template pool the Looping practice engine draws questions from.

Same structural idea as slicing_templates.py/indexing_templates.py: a
template is a *shape*, tagged with a difficulty band and the misconception
concept it probes, multiplied against a fresh string per question. What's
different here is what a template returns: not a slice or an index, but a
`Loop` -- the loop's rendered source (for the prompt) and its real,
directly-computed output (the ground truth an evaluate/trace/count
question is graded against).

That output is computed by literally running the equivalent Python
directly in this process -- `for ch in entry.value: ...` for real, not a
hand-simulated re-implementation of what a for-loop does. That's safe
specifically because every template here is authored by this file, never
learner input: the untrusted-code sandbox (sandbox.py) exists for the
write_code kind's submissions, which this file never touches directly
(looping_engine.py routes those through run_for_grading, same as every
other module's write_code kind).
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

# Concepts, reusing the grader's real misconception id (looping's static
# bank uses exactly one: exercises.json's looping misconception_map).
C_OFF_BY_ONE = "off_by_one_length"
# Looping doesn't have a second real misconception id of its own yet, so
# templates that aren't specifically about the off-by-one count use this
# general concept instead of inventing a new id this project's grader
# doesn't otherwise speak.
C_LOOP_GENERAL = "loop_general"

WORDS_ONLY = (corpus.KIND_WORD,)


class Loop:
    """One concrete loop: its rendered source (sans the `word = "..."`
    assignment line, which the caller prepends) and the real lines it
    prints, computed directly rather than re-simulated."""

    __slots__ = ("source", "lines", "raises")

    def __init__(self, source, lines, raises=False):
        self.source = source
        self.lines = lines
        self.raises = raises


# ─── EASY ───────────────────────────────────────────────────────────────────

def _t_for_each_char(entry, rng):
    word = entry.value
    return Loop("for ch in word:\n    print(ch)", list(word))


def _t_for_range_len(entry, rng):
    word = entry.value
    return Loop(
        "for i in range(len(word)):\n    print(word[i])",
        list(word),
    )


# ─── EASY_MEDIUM ────────────────────────────────────────────────────────────

def _t_for_each_upper(entry, rng):
    word = entry.value
    return Loop("for ch in word:\n    print(ch.upper())", [c.upper() for c in word])


def _t_while_correct(entry, rng):
    word = entry.value
    return Loop(
        "i = 0\nwhile i < len(word):\n    print(word[i])\n    i += 1",
        list(word),
    )


# ─── MEDIUM ─────────────────────────────────────────────────────────────────

def _t_for_slice(entry, rng):
    word = entry.value
    n = len(word)
    a = rng.randint(0, max(0, n - 4))
    b = min(a + rng.randint(2, 3), n)
    return Loop(f"for ch in word[{a}:{b}]:\n    print(ch)", list(word[a:b]))


def _t_for_with_index(entry, rng):
    word = entry.value
    return Loop(
        'for i, ch in enumerate(word):\n    print(f"{i}: {ch}")',
        [f"{i}: {c}" for i, c in enumerate(word)],
    )


# ─── MEDIUM_HARD ────────────────────────────────────────────────────────────

def _t_for_step(entry, rng):
    word = entry.value
    return Loop("for ch in word[::2]:\n    print(ch)", list(word[::2]))


def _t_for_reversed(entry, rng):
    word = entry.value
    return Loop("for ch in reversed(word):\n    print(ch)", list(word[::-1]))


# ─── HARD ───────────────────────────────────────────────────────────────────
# The off-by-one family: a while-loop bound that is one character too far
# in either direction. `_t_while_off_by_one_over` is the specific, real
# misconception (off_by_one_length) the static bank already names --
# `<=` where `<` belongs -- and it genuinely raises, which is exactly the
# lesson.

def _t_while_off_by_one_over(entry, rng):
    word = entry.value
    n = len(word)

    def run():
        i = 0
        out = []
        while i <= n:  # bug: should be i < n
            out.append(word[i])
            i += 1
        return out

    try:
        lines = run()
        raises = False
    except IndexError:
        lines = list(word)  # everything before the failing access
        raises = True
    return Loop(
        "i = 0\nwhile i <= len(word):\n    print(word[i])\n    i += 1",
        lines, raises=raises,
    )


def _t_while_off_by_one_under(entry, rng):
    word = entry.value
    n = len(word)
    lines = [word[i] for i in range(n - 1)]  # misses the last character
    return Loop(
        "i = 0\nwhile i < len(word) - 1:\n    print(word[i])\n    i += 1",
        lines,
    )


# ─── VERY_HARD ──────────────────────────────────────────────────────────────

def _t_nested_pairs(entry, rng):
    word = entry.value
    n = len(word)
    if n < 8:
        return None
    a = rng.randint(0, max(0, n - 6))
    b = min(a + 3, n)
    span = word[a:b]
    lines = []
    for ch in span:
        for other in span:
            lines.append(ch + other)
    return Loop(
        f'for ch in word[{a}:{b}]:\n    for other in word[{a}:{b}]:\n        print(ch + other)',
        lines,
    )


TEMPLATES = [
    Template("for_each_char", BAND_EASY, _t_for_each_char, C_LOOP_GENERAL, min_len=4, kinds=WORDS_ONLY),
    Template("for_range_len", BAND_EASY, _t_for_range_len, C_LOOP_GENERAL, min_len=4, kinds=WORDS_ONLY),

    Template("for_each_upper", BAND_EASY_MEDIUM, _t_for_each_upper, C_LOOP_GENERAL, min_len=5, kinds=WORDS_ONLY),
    Template("while_correct", BAND_EASY_MEDIUM, _t_while_correct, C_OFF_BY_ONE, min_len=5, kinds=WORDS_ONLY),

    Template("for_slice", BAND_MEDIUM, _t_for_slice, C_LOOP_GENERAL, min_len=7, kinds=WORDS_ONLY),
    Template("for_with_index", BAND_MEDIUM, _t_for_with_index, C_LOOP_GENERAL, min_len=5, kinds=WORDS_ONLY),

    Template("for_step", BAND_MEDIUM_HARD, _t_for_step, C_LOOP_GENERAL, min_len=6, kinds=WORDS_ONLY),
    Template("for_reversed", BAND_MEDIUM_HARD, _t_for_reversed, C_LOOP_GENERAL, min_len=6, kinds=WORDS_ONLY),

    Template("while_off_by_one_over", BAND_HARD, _t_while_off_by_one_over, C_OFF_BY_ONE, min_len=5, kinds=WORDS_ONLY),
    Template("while_off_by_one_under", BAND_HARD, _t_while_off_by_one_under, C_OFF_BY_ONE, min_len=5, kinds=WORDS_ONLY),

    Template("nested_pairs", BAND_VERY_HARD, _t_nested_pairs, C_LOOP_GENERAL, min_len=8, kinds=WORDS_ONLY),
]

BY_ID = {t.id: t for t in TEMPLATES}


def for_tier(tier):
    return core.for_tier(TEMPLATES, tier, TIER_BANDS)


# ─── write_code tasks ───────────────────────────────────────────────────────

CODE_TASKS = {
    # BAND_MEDIUM, not EASY/EASY_MEDIUM: KIND_CODE only appears in
    # _TIER_KINDS from tier 4 onward, and tier 4's band window
    # (MEDIUM, MEDIUM_HARD) is the easiest one that ever draws a code
    # task at all -- an EASY_MEDIUM-banded task here would be unreachable
    # by construction, the same way a duplicate option is unreachable by
    # construction once the padding loop is fixed. Caught by generating at
    # scale and checking every code task actually gets drawn, not just by
    # reading the bands.
    "print_each_char": {
        "band": BAND_MEDIUM,
        "needs_n": False,
        "statement": "use a loop to print every character of `word` on its own line",
        "spec": lambda w, n: "\n".join(w),
    },
    "print_each_upper": {
        "band": BAND_MEDIUM,
        "needs_n": False,
        "statement": "use a loop to print every character of `word`, in upper case, on its own line",
        "spec": lambda w, n: "\n".join(c.upper() for c in w),
    },
    "print_reversed_lines": {
        "band": BAND_MEDIUM_HARD,
        "needs_n": False,
        "statement": "use a loop to print `word` backwards, one character per line",
        "spec": lambda w, n: "\n".join(w[::-1]),
    },
    "print_with_index": {
        "band": BAND_HARD,
        "needs_n": False,
        "statement": 'use a loop to print each character of `word` as "position: character", one per line (e.g. "0: c")',
        "spec": lambda w, n: "\n".join(f"{i}: {c}" for i, c in enumerate(w)),
    },
    "count_letter": {
        "band": BAND_VERY_HARD,
        "needs_n": False,
        "statement": 'use a loop to count and print how many times the letter "e" appears in `word`',
        "spec": lambda w, n: str(sum(1 for c in w if c == "e")),
    },
}


def code_tasks_for_tier(tier):
    bands = TIER_BANDS[tier]
    return [k for k, task in CODE_TASKS.items() if task["band"] in bands]
