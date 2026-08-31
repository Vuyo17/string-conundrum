"""The template pool the Intro practice engine draws questions from.

Intro's own shape is genuinely different from every other module built on
this engine, by design (the static bank's own intro-01..08/24..29 are
syntax-recognition questions -- "which of these correctly creates a
string?" -- not "what does this operation produce?"): alongside the usual
KIND_EVALUATE pool (concatenation, repetition, length, ord()/chr(),
string+int TypeError -- lightweight templates like
comparison_templates.py/formatting_templates.py, see those modules'
docstrings for why), two more kinds are built from small, dedicated
pools that don't fit a single-corpus-entry Template either:

  * KIND_LITERAL ("select every expression that creates the string X")
  * KIND_UNQUOTED ("which of these correctly creates a string holding X?")

Both of those decide which candidate is correct by literally exec()ing
each candidate statement in a fresh namespace and checking what the
resulting variable actually is -- never by hand-asserting which one
"should" work. That is deliberate: `name = word` (no quotes) really does
raise NameError, and `name = [w,o,r,d]` really does build a list of
undefined names raising the same, so running the real statement is both
the safest and the most honest way to know which options are correct
(the same principle immutability_templates.py explains for exec()ing a
real subscript-assignment statement instead of asserting its exception).

Concepts reuse the grader's real misconception ids where they line up
with exercises.json's own intro misconception_map entries
(strings_need_quotes, string_vs_list_confusion, concatenation_adds_space,
concatenation_requires_same_type_fear, repetition_confused_with_multiplication,
off_by_one_length), plus one borrowed from Formatting's vocabulary
(escape_sequence_literal_confusion) for the len() question built around
an escape sequence -- the exact same misconception (miscounting `\\n` as
two characters) the Learn section's own callout teaches, just probed
through len() instead of through print().
"""
from . import practice_engine_core as core

BAND_EASY = core.BAND_EASY
BAND_EASY_MEDIUM = core.BAND_EASY_MEDIUM
BAND_MEDIUM = core.BAND_MEDIUM
BAND_MEDIUM_HARD = core.BAND_MEDIUM_HARD
BAND_HARD = core.BAND_HARD
BAND_VERY_HARD = core.BAND_VERY_HARD
TIER_BANDS = core.TIER_BANDS

C_QUOTES = "strings_need_quotes"
C_LIST_CONFUSION = "string_vs_list_confusion"
C_CONCAT_SPACE = "concatenation_adds_space"
C_CONCAT_TYPE = "concatenation_requires_same_type_fear"
C_REPEAT_CONFUSION = "repetition_confused_with_multiplication"
C_LENGTH = "off_by_one_length"
C_ESCAPE_SEQUENCE = "escape_sequence_literal_confusion"
C_GENERAL = "intro_general"


class ITemplate:
    __slots__ = ("id", "band", "build", "concept")

    def __init__(self, id, band, build, concept):
        self.id = id
        self.band = band
        self.build = build
        self.concept = concept

    def __repr__(self):
        return f"ITemplate({self.id!r}, {self.band!r})"


class Scenario:
    """One concrete evaluate case: its source lines and the real printed
    result -- or, for the one template that's specifically about the
    string+int TypeError, `printed=None, raises=True`. `meta` carries a
    template's own raw values (e.g. repeat's word/count) for building a
    concept-driven distractor from, without the engine ever having to
    reverse-parse them back out of the rendered source text."""

    __slots__ = ("lines", "printed", "raises", "meta")

    def __init__(self, lines, printed, raises=False, meta=None):
        self.lines = lines
        self.printed = printed
        self.raises = raises
        self.meta = meta or {}

    @property
    def source(self):
        return "\n".join(self.lines)


# ─── EASY: concatenation ─────────────────────────────────────────────────────

def _t_concat(words, rng):
    a, b = rng.sample(words, 2)
    printed = a + b  # real Python: + never inserts a space
    return Scenario([f'a = "{a}"', f'b = "{b}"', "print(a + b)"], printed)


# ─── EASY_MEDIUM: repetition ──────────────────────────────────────────────────

def _t_repeat(words, rng):
    w = rng.choice(words)
    n = rng.randint(2, 4)
    printed = w * n  # real Python: * repeats the string, never does arithmetic
    return Scenario([f'w = "{w}"', f"print(w * {n})"], printed, meta={"word": w, "n": n})


# ─── MEDIUM: plain length ─────────────────────────────────────────────────────

def _t_length_plain(words, rng):
    w = rng.choice(words)
    printed = str(len(w))
    return Scenario([f'w = "{w}"', "print(len(w))"], printed)


# ─── MEDIUM_HARD: length through an escape sequence ──────────────────────────

def _t_length_escape(words, rng):
    a, b = rng.sample(words, 2)
    literal = f"{a}\\n{b}"
    printed = str(len(a + "\n" + b))  # \n is really one character
    return Scenario([f's = "{literal}"', "print(len(s))"], printed)


# ─── HARD: ord()/chr() shift ──────────────────────────────────────────────────

def _t_ord_shift(words, rng):
    w = rng.choice(words)
    idx = rng.randrange(len(w))
    ch = w[idx]
    if not ("a" <= ch <= "y"):  # keep the shift inside a-z, real letters only
        return None
    n = rng.randint(1, min(3, ord("z") - ord(ch)))
    shifted = chr(ord(ch) + n)
    return Scenario(
        [f'ch = "{ch}"', f"print(chr(ord(ch) + {n}))"],
        shifted,
    )


# ─── VERY_HARD: string + int really raises TypeError ─────────────────────────

def _t_type_error(words, rng):
    w = rng.choice(words)
    n = rng.randint(1, 99)
    try:
        w + n  # real Python: str + int always raises TypeError
    except TypeError:
        return Scenario([f'w = "{w}"', f"n = {n}", "print(w + n)"], None, raises=True)
    return None  # pragma: no cover -- str + int cannot not raise


TEMPLATES = [
    ITemplate("concat", BAND_EASY, _t_concat, C_CONCAT_SPACE),
    ITemplate("repeat", BAND_EASY_MEDIUM, _t_repeat, C_REPEAT_CONFUSION),
    ITemplate("length_plain", BAND_MEDIUM, _t_length_plain, C_LENGTH),
    ITemplate("length_escape", BAND_MEDIUM_HARD, _t_length_escape, C_ESCAPE_SEQUENCE),
    ITemplate("ord_shift", BAND_HARD, _t_ord_shift, C_GENERAL),
    ITemplate("type_error", BAND_VERY_HARD, _t_type_error, C_CONCAT_TYPE),
]

BY_ID = {t.id: t for t in TEMPLATES}


def for_tier(tier):
    return core.for_tier(TEMPLATES, tier, TIER_BANDS)


# ─── KIND_LITERAL pool: "select every expression that creates X" ────────────

def build_literal_options(words, rng):
    """Four candidate statements; which ones actually build the target
    string is decided by literally exec()ing each one in a fresh
    namespace, never by asserting it -- see the module docstring."""
    word = rng.choice(words)
    letters = (list(word) + ["p", "q", "r"])[:3]
    candidates = [
        f"value = '{word}'",
        f'value = "{word}"',
        f"value = '''{word}'''",
        f"value = [{letters[0]},{letters[1]},{letters[2]}]",
    ]
    correct = []
    for src in candidates:
        ns = {}
        try:
            exec(compile(src, "<intro_literal>", "exec"), {}, ns)
            ok = isinstance(ns.get("value"), str) and ns["value"] == word
        except Exception:
            ok = False
        if ok:
            correct.append(src)
    return candidates, correct, word


# ─── KIND_UNQUOTED pool: "which of these creates a string holding X?" ───────

def build_unquoted_options(words, rng):
    """Four candidate assignment lines; exactly one really assigns the
    string -- again decided by exec()ing each, not by assertion (a bare
    name really does raise NameError; `<word>` really is a SyntaxError)."""
    word = rng.choice(words)
    candidates = [
        f"name = {word}",
        f"name = '{word}'",
        f"name = ({word})",
        f"name = <{word}>",
    ]
    correct = []
    for src in candidates:
        ns = {}
        try:
            exec(compile(src, "<intro_unquoted>", "exec"), {}, ns)
            ok = isinstance(ns.get("name"), str) and ns["name"] == word
        except Exception:
            ok = False
        if ok:
            correct.append(src)
    return candidates, correct, word


# ─── write_code tasks ─────────────────────────────────────────────────────────

CODE_TASKS = {
    "repeat_word": {
        "band": BAND_MEDIUM,
        "needs_n": False,
        "statement": "use * to print `word` repeated exactly 3 times, with nothing in between",
        "spec": lambda w: w * 3,
    },
    "greet_word": {
        "band": BAND_MEDIUM_HARD,
        "needs_n": False,
        "statement": 'use + to print "Hi, " followed by `word`, followed by "!" (e.g. word "sam" prints "Hi, sam!")',
        "spec": lambda w: f"Hi, {w}!",
    },
}


def code_tasks_for_tier(tier):
    bands = TIER_BANDS[tier]
    return [k for k, task in CODE_TASKS.items() if task["band"] in bands]
