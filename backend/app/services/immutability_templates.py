"""The template pool the Immutability practice engine draws questions from.

A genuinely different question shape from every other module built on
this pattern so far: the others ask "what value does this produce"; this
one asks "what *happens* when this runs" -- a short 2-3 line snippet, and
either it raises (any direct attempt to mutate a string in place always
does, for real, in real Python) or it prints something, and the point is
usually whether a learner expects the *original* variable to have changed
when it did not. See looping_templates.py's docstring for why every
snippet's real outcome is computed by actually running the equivalent
Python in this process rather than a hand-simulated re-implementation of
what item assignment or a method call does.

Same lightweight-template shape as comparison_templates.py/
methods_templates.py -- a snippet built from a word doesn't fit
practice_engine_core.py's single-entry Template either.
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
# immutability misconception_map has exactly these two).
C_IN_PLACE = "immutability_in_place"
C_METHOD_MUTATES = "method_mutates_target"
C_GENERAL = "immutability_general"


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
    """One concrete 2-3 line snippet, plus its real outcome.

    `raises`: True if directly attempting the operation on a real Python
    string raises (item assignment, slice assignment, del) -- `exc_name`
    names which exception. Otherwise `printed` is the real value the
    snippet's own `print(...)` line would show, and `reassigned` records
    whether the snippet actually rebound the variable (correct fix) or
    called a method and discarded its result (the bug).
    """

    __slots__ = ("name", "lines", "raises", "exc_name", "printed", "reassigned", "method")

    def __init__(self, name, lines, raises=False, exc_name=None, printed=None, reassigned=None, method=None):
        self.name = name
        self.lines = lines
        self.raises = raises
        self.exc_name = exc_name
        self.printed = printed
        self.reassigned = reassigned
        self.method = method

    @property
    def source(self):
        return "\n".join(self.lines)


def _try_exec(statement, **names):
    """Actually run `statement` (real Python source, using the real
    subscript/del syntax a learner would write) and report what really
    happens.

    Not `s.__setitem__(i, "X")`: string objects don't define
    `__setitem__` at all, so calling it directly raises AttributeError
    ("no attribute '__setitem__'") -- a completely different exception
    from what the actual syntax `s[i] = "X"` raises through the
    interpreter's own item-assignment protocol (TypeError, "does not
    support item assignment"). Since the whole point of this template
    family is reporting the real exception a learner would see, it has to
    run the real statement, not a method-call stand-in for it. Caught by
    comparing the two directly rather than assuming they'd agree.
    """
    try:
        exec(statement, dict(names))
        return False, None
    except (TypeError, IndexError) as exc:
        return True, type(exc).__name__


# ─── EASY: illegal in-place mutation attempts (always raise) ────────────────

def _t_item_assign(words, rng):
    w = rng.choice(words)
    name = "word"
    i = rng.randint(0, len(w) - 1)
    raises, exc_name = _try_exec("s[i] = 'X'", s=w, i=i)
    return Scenario(
        name,
        [f'{name} = "{w}"', f'{name}[{i}] = "X"'],
        raises=raises, exc_name=exc_name,
    )


def _t_del_item(words, rng):
    w = rng.choice(words)
    name = "word"
    i = rng.randint(0, len(w) - 1)
    raises, exc_name = _try_exec("del s[i]", s=w, i=i)
    return Scenario(
        name,
        [f'{name} = "{w}"', f'del {name}[{i}]'],
        raises=raises, exc_name=exc_name,
    )


# ─── EASY_MEDIUM: slice assignment (also always raises) ─────────────────────

def _t_slice_assign(words, rng):
    w = rng.choice(words)
    name = "word"
    a = rng.randint(0, max(0, len(w) - 3))
    b = min(a + 2, len(w))
    raises, exc_name = _try_exec("s[a:b] = 'XY'", s=w, a=a, b=b)
    return Scenario(
        name,
        [f'{name} = "{w}"', f'{name}[{a}:{b}] = "XY"'],
        raises=raises, exc_name=exc_name,
    )


# ─── MEDIUM: method called but never reassigned -- the real bug ─────────────

def _t_method_not_reassigned(words, rng):
    w = rng.choice(words)
    name = "word"
    method = rng.choice(["upper", "lower", "strip"])
    call_word = w if method != "strip" else f"  {w}  "
    call_word_render = f'"{call_word}"'
    return Scenario(
        name,
        [f'{name} = {call_word_render}', f'{name}.{method}()', f'print({name})'],
        printed=call_word, reassigned=False, method=method,
    )


# ─── MEDIUM_HARD: the correct, reassigned version -- the contrast case ──────

def _t_method_reassigned(words, rng):
    w = rng.choice(words)
    name = "word"
    method = rng.choice(["upper", "lower", "strip"])
    call_word = w if method != "strip" else f"  {w}  "
    call_word_render = f'"{call_word}"'
    result = getattr(call_word, method)()
    return Scenario(
        name,
        [f'{name} = {call_word_render}', f'{name} = {name}.{method}()', f'print({name})'],
        printed=result, reassigned=True, method=method,
    )


# ─── HARD: augmented assignment -- looks like mutation, actually rebinds ────

def _t_augmented_assign(words, rng):
    w = rng.choice(words)
    name = "word"
    suffix = rng.choice(["!", "?", "...", "s"])
    result = w + suffix
    return Scenario(
        name,
        [f'{name} = "{w}"', f'{name} += "{suffix}"', f'print({name})'],
        printed=result, reassigned=True, method=None,
    )


# ─── VERY_HARD: chained method call, still never reassigned ─────────────────

def _t_chained_not_reassigned(words, rng):
    w = rng.choice([x for x in words if len(x) >= 3] or words)
    name = "word"
    return Scenario(
        name,
        [f'{name} = "{w}"', f'{name}.upper().strip()', f'print({name})'],
        printed=w, reassigned=False, method="upper().strip()",
    )


TEMPLATES = [
    ITemplate("item_assign", BAND_EASY, _t_item_assign, C_IN_PLACE),
    ITemplate("del_item", BAND_EASY, _t_del_item, C_IN_PLACE),

    ITemplate("slice_assign", BAND_EASY_MEDIUM, _t_slice_assign, C_IN_PLACE),

    ITemplate("method_not_reassigned", BAND_MEDIUM, _t_method_not_reassigned, C_METHOD_MUTATES),

    ITemplate("method_reassigned", BAND_MEDIUM_HARD, _t_method_reassigned, C_GENERAL),

    ITemplate("augmented_assign", BAND_HARD, _t_augmented_assign, C_GENERAL),

    ITemplate("chained_not_reassigned", BAND_VERY_HARD, _t_chained_not_reassigned, C_METHOD_MUTATES),
]

BY_ID = {t.id: t for t in TEMPLATES}


def for_tier(tier):
    return core.for_tier(TEMPLATES, tier, TIER_BANDS)


# ─── write_code tasks ───────────────────────────────────────────────────────

CODE_TASKS = {
    "capitalise_without_capitalize": {
        "band": BAND_MEDIUM,
        "needs_n": False,
        "statement": "print `word` with its first letter capitalised, without using .capitalize() or .title()",
        "spec": lambda w: w[0].upper() + w[1:] if w else w,
    },
    "reassign_upper": {
        "band": BAND_MEDIUM_HARD,
        "needs_n": False,
        "statement": "reassign `word` to its own upper-case version and print it (not just call .upper() and discard it)",
        "spec": lambda w: w.upper(),
    },
}


def code_tasks_for_tier(tier):
    bands = TIER_BANDS[tier]
    return [k for k, task in CODE_TASKS.items() if task["band"] in bands]
