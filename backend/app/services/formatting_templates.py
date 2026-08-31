"""The template pool the Formatting practice engine draws questions from.

Same lightweight-template shape as comparison_templates.py/
methods_templates.py/immutability_templates.py (see those modules'
docstrings for why -- a short snippet built from a couple of values
doesn't fit practice_engine_core.py's single-entry Template). Covers the
two real misconceptions the static bank already names:
fstring_missing_prefix_effect (forgetting the `f` leaves the braces as
literal text, rather than raising or silently still substituting) and
escape_sequence_literal_confusion (miscounting how many lines `\\n`
produces).

Every case's printed output is the real result of actually formatting the
values in this trusted server code (f-strings and `.format()` calls
written directly in this file, never built from a runtime string and
`eval`'d) -- see looping_templates.py's docstring for the same reasoning
applied elsewhere in this engine family.
"""
from . import practice_engine_core as core

BAND_EASY = core.BAND_EASY
BAND_EASY_MEDIUM = core.BAND_EASY_MEDIUM
BAND_MEDIUM = core.BAND_MEDIUM
BAND_MEDIUM_HARD = core.BAND_MEDIUM_HARD
BAND_HARD = core.BAND_HARD
BAND_VERY_HARD = core.BAND_VERY_HARD
TIER_BANDS = core.TIER_BANDS

# Concepts, reusing the grader's real misconception ids (exercises.json's
# formatting misconception_map has exactly these two).
C_FSTRING_PREFIX = "fstring_missing_prefix_effect"
C_ESCAPE_SEQUENCE = "escape_sequence_literal_confusion"
C_GENERAL = "formatting_general"

_NAMES = ["Ada", "Thabo", "Lindiwe", "Sam", "Noah", "Zanele", "Priya", "Kofi"]


class FTemplate:
    __slots__ = ("id", "band", "build", "concept")

    def __init__(self, id, band, build, concept):
        self.id = id
        self.band = band
        self.build = build
        self.concept = concept

    def __repr__(self):
        return f"FTemplate({self.id!r}, {self.band!r})"


class FormatCase:
    """One concrete formatting snippet: its source lines and the real
    printed output (possibly multi-line, for the escape-sequence family)."""

    __slots__ = ("lines", "printed")

    def __init__(self, lines, printed):
        self.lines = lines
        self.printed = printed

    @property
    def source(self):
        return "\n".join(self.lines)


# ─── EASY: a correct f-string ────────────────────────────────────────────────

def _t_fstring_correct(words, rng):
    name = rng.choice(_NAMES)
    age = rng.randint(18, 60)
    printed = f"{name} is {age}"
    return FormatCase(
        [f'name = "{name}"', f"age = {age}", 'print(f"{name} is {age}")'],
        printed,
    )


# ─── EASY_MEDIUM: the missing-f-prefix trap ──────────────────────────────────

def _t_fstring_missing_prefix(words, rng):
    name = rng.choice(_NAMES)
    age = rng.randint(18, 60)
    # No f prefix: the braces are printed literally, verbatim -- computed
    # for real (a plain string literal, not interpolated) rather than
    # asserted.
    printed = "{name} is {age}"
    return FormatCase(
        [f'name = "{name}"', f"age = {age}", 'print("{name} is {age}")'],
        printed,
    )


# ─── MEDIUM: .format() -- a second real mechanism, same result ──────────────

def _t_format_method(words, rng):
    name = rng.choice(_NAMES)
    age = rng.randint(18, 60)
    printed = "{} is {}".format(name, age)
    return FormatCase(
        [f'name = "{name}"', f"age = {age}", 'print("{} is {}".format(name, age))'],
        printed,
    )


def _t_format_method_named(words, rng):
    name = rng.choice(_NAMES)
    age = rng.randint(18, 60)
    printed = "{n} is {a}".format(n=name, a=age)
    return FormatCase(
        [f'name = "{name}"', f"age = {age}", 'print("{n} is {a}".format(n=name, a=age))'],
        printed,
    )


# ─── MEDIUM_HARD: escape sequences -- how many lines? ────────────────────────

def _t_newline_count(words, rng):
    n_breaks = rng.randint(1, 3)
    parts = [rng.choice(words) for _ in range(n_breaks + 1)]
    literal = "\\n".join(parts)
    printed = "\n".join(parts)
    return FormatCase([f'print("{literal}")'], printed)


def _t_tab_and_newline(words, rng):
    a, b = rng.sample(words, 2)
    literal = f"{a}\\t{b}\\n{b}"
    printed = f"{a}\t{b}\n{b}"
    return FormatCase([f'print("{literal}")'], printed)


# ─── HARD: an expression inside the braces ───────────────────────────────────

def _t_fstring_expression(words, rng):
    a = rng.randint(2, 20)
    b = rng.randint(2, 20)
    printed = f"{a + b}"
    return FormatCase(
        [f"a = {a}", f"b = {b}", 'print(f"{a + b}")'],
        printed,
    )


def _t_fstring_method_call(words, rng):
    w = rng.choice(words)
    printed = f"{w.upper()}"
    return FormatCase(
        [f'word = "{w}"', 'print(f"{word.upper()}")'],
        printed,
    )


# ─── VERY_HARD: a format spec ────────────────────────────────────────────────

def _t_fstring_format_spec(words, rng):
    whole = rng.randint(1, 99)
    frac = rng.randint(0, 99)
    value = float(f"{whole}.{frac}")
    printed = f"{value:.1f}"
    return FormatCase(
        [f"value = {value}", 'print(f"{value:.1f}")'],
        printed,
    )


TEMPLATES = [
    FTemplate("fstring_correct", BAND_EASY, _t_fstring_correct, C_GENERAL),

    FTemplate("fstring_missing_prefix", BAND_EASY_MEDIUM, _t_fstring_missing_prefix, C_FSTRING_PREFIX),

    FTemplate("format_method", BAND_MEDIUM, _t_format_method, C_GENERAL),
    FTemplate("format_method_named", BAND_MEDIUM, _t_format_method_named, C_GENERAL),

    FTemplate("newline_count", BAND_MEDIUM_HARD, _t_newline_count, C_ESCAPE_SEQUENCE),
    FTemplate("tab_and_newline", BAND_MEDIUM_HARD, _t_tab_and_newline, C_ESCAPE_SEQUENCE),

    FTemplate("fstring_expression", BAND_HARD, _t_fstring_expression, C_GENERAL),
    FTemplate("fstring_method_call", BAND_HARD, _t_fstring_method_call, C_GENERAL),

    FTemplate("fstring_format_spec", BAND_VERY_HARD, _t_fstring_format_spec, C_GENERAL),
]

BY_ID = {t.id: t for t in TEMPLATES}


def for_tier(tier):
    return core.for_tier(TEMPLATES, tier, TIER_BANDS)


# ─── write_code tasks ───────────────────────────────────────────────────────

CODE_TASKS = {
    "fstring_greeting": {
        "band": BAND_MEDIUM,
        "needs_n": False,
        "statement": 'use an f-string to print "Hello, " followed by `word`, followed by "!" (e.g. word "sam" prints "Hello, sam!")',
        "spec": lambda w: f"Hello, {w}!",
    },
    "format_positions": {
        "band": BAND_MEDIUM_HARD,
        "needs_n": False,
        "statement": 'use .format() to print `word` reversed and then forwards, separated by a space (e.g. word "cat" prints "tac cat")',
        "spec": lambda w: "{} {}".format(w[::-1], w),
    },
}


def code_tasks_for_tier(tier):
    bands = TIER_BANDS[tier]
    return [k for k, task in CODE_TASKS.items() if task["band"] in bands]
