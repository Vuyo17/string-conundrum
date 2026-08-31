"""The template pool the Methods practice engine draws questions from.

Same lightweight-template shape as comparison_templates.py (see that
module's docstring for why): a question here is one string method call --
`"banana".count("a")` -- not a slice or an index, so it doesn't fit
practice_engine_core.py's single-entry Template either. Every call's
result is the real return value of actually calling the method on a real
string in this trusted server code (see looping_templates.py's docstring
for the general reasoning), including the real exception where a template
is specifically testing one (`.index()` on a substring that isn't there
raises ValueError for real, not a simulated one).
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
# methods misconception_map has exactly these three).
C_STRIP = "strip_only_removes_one_char"
C_COUNT_OVERLAP = "count_overlap_confusion"
C_COUNT_VS_FIND = "count_vs_find_confusion"
C_GENERAL = "methods_general"


class MTemplate:
    __slots__ = ("id", "band", "build", "concept")

    def __init__(self, id, band, build, concept):
        self.id = id
        self.band = band
        self.build = build
        self.concept = concept

    def __repr__(self):
        return f"MTemplate({self.id!r}, {self.band!r})"


class MethodCall:
    """One concrete method call: the word it's called on, the rendered
    call expression, and the real result -- or the real exception, for
    templates specifically testing one. `method_name`/`args` are kept as
    their own real values (not just baked into `expression`'s rendered
    text) so a worked explanation can use them directly -- e.g. to
    highlight every real match position of `args[0]` in `word` -- without
    ever having to parse them back out of the prompt string."""

    __slots__ = ("word", "expression", "result", "raises", "exc_name", "method_name", "args")

    def __init__(self, word, expression, result, raises=False, exc_name=None, method_name="", args=()):
        self.word = word
        self.expression = expression
        self.result = result
        self.raises = raises
        self.exc_name = exc_name
        self.method_name = method_name
        self.args = args


def _call(word, expr_suffix, fn, args=()):
    """`expr_suffix` is the method-call text after `word.`, e.g.
    `upper()` or `count("a")`. `fn` actually performs the call on `word`.
    `args` are the call's real argument values (e.g. the substring being
    searched for), in order."""
    expression = f'"{word}".{expr_suffix}'
    method_name = expr_suffix.split("(", 1)[0]
    try:
        return MethodCall(word, expression, fn(word), method_name=method_name, args=tuple(args))
    except (ValueError, IndexError) as exc:
        return MethodCall(
            word, expression, None, raises=True, exc_name=type(exc).__name__,
            method_name=method_name, args=tuple(args),
        )


# ─── EASY ───────────────────────────────────────────────────────────────────

def _t_upper(words, rng):
    w = rng.choice(words)
    return _call(w, "upper()", str.upper)


def _t_lower(words, rng):
    w = rng.choice(words)
    variant = w.upper()
    return _call(variant, "lower()", str.lower)


# ─── EASY_MEDIUM ────────────────────────────────────────────────────────────

def _t_strip(words, rng):
    w = rng.choice(words)
    n_left = rng.randint(1, 3)
    n_right = rng.randint(1, 3)
    padded = (" " * n_left) + w + (" " * n_right)
    return _call(padded, "strip()", str.strip)


def _t_replace_char(words, rng):
    w = rng.choice(words)
    target = rng.choice(w)
    replacement = rng.choice("xyz")
    # No space after the internal comma: see immutability_engine's
    # _build_identify_options for why a comma-space sequence inside a
    # single option's own text collides with the "join with ', '" scheme
    # every select_all kind in this engine family serialises its
    # correct-answer set with. Not currently triggered here (.replace()
    # never raises, so it's never a member of KIND_ERROR's raising set),
    # but fixed anyway rather than left as a bug waiting for a future
    # template change to trigger it.
    return _call(
        w, f'replace("{target}","{replacement}")', lambda s: s.replace(target, replacement),
        args=(target, replacement),
    )


# ─── MEDIUM ─────────────────────────────────────────────────────────────────

def _t_count_single_char(words, rng):
    w = rng.choice([x for x in words if len(set(x)) < len(x)] or words)
    # Prefer a word with a repeated letter so the count is genuinely > 1
    # more often than not, without ruling out a real count of 1. Tagged
    # C_GENERAL rather than C_COUNT_OVERLAP: a single character can never
    # overlap with itself the way a multi-character pattern can, so the
    # overlap misconception doesn't actually apply here -- see
    # count_substring/count_overlapping for the templates it does.
    char = rng.choice(w)
    return _call(w, f'count("{char}")', lambda s: s.count(char), args=(char,))


def _t_startswith(words, rng):
    w = rng.choice(words)
    n = rng.randint(1, 3)
    prefix = w[:n]
    return _call(w, f'startswith("{prefix}")', lambda s: s.startswith(prefix), args=(prefix,))


def _t_endswith(words, rng):
    w = rng.choice(words)
    n = rng.randint(1, 3)
    suffix = w[-n:]
    return _call(w, f'endswith("{suffix}")', lambda s: s.endswith(suffix), args=(suffix,))


# ─── MEDIUM_HARD ────────────────────────────────────────────────────────────

def _t_find_present(words, rng):
    w = rng.choice(words)
    n = rng.randint(2, 3)
    start = rng.randint(0, max(0, len(w) - n))
    sub = w[start:start + n]
    return _call(w, f'find("{sub}")', lambda s: s.find(sub), args=(sub,))


def _t_index_present(words, rng):
    w = rng.choice(words)
    n = rng.randint(2, 3)
    start = rng.randint(0, max(0, len(w) - n))
    sub = w[start:start + n]
    return _call(w, f'index("{sub}")', lambda s: s.index(sub), args=(sub,))


def _t_find_absent(words, rng):
    w = rng.choice(words)
    # "zzq" essentially never occurs in a real dictionary word.
    return _call(w, 'find("zzq")', lambda s: s.find("zzq"), args=("zzq",))


def _t_index_absent_raises(words, rng):
    # BAND_MEDIUM_HARD, not BAND_HARD: the same fix comparison_templates.py
    # needed for string_number_type_error and the same reason -- this is
    # the ONLY template that ever raises, so it's what KIND_ERROR's "at
    # least one raising candidate" requirement depends on entirely.
    # _TIER_KINDS declares KIND_ERROR reachable from tier 4, whose band
    # window is (MEDIUM, MEDIUM_HARD); tagging this BAND_HARD (tier 5
    # only) would make error-kind questions silently never generate at
    # tier 4. Caught the same way each time this bug has shown up in this
    # engine family: generating at scale per declared (tier, kind) pair
    # and checking every one actually appeared.
    w = rng.choice(words)
    return _call(w, 'index("zzq")', lambda s: s.index("zzq"), args=("zzq",))


# ─── HARD ───────────────────────────────────────────────────────────────────

def _t_count_substring(words, rng):
    w = rng.choice([x for x in words if len(x) >= 6] or words)
    n = 2
    start = rng.randint(0, max(0, len(w) - n))
    sub = w[start:start + n]
    return _call(w, f'count("{sub}")', lambda s: s.count(sub), args=(sub,))


# ─── VERY_HARD ──────────────────────────────────────────────────────────────

def _t_count_overlapping(words, rng):
    # The genuine overlap surprise: str.count() does NOT count overlapping
    # matches, so "aaaa".count("aa") is 2, not 3. Built directly rather
    # than drawn from the corpus, since a real dictionary word with a
    # triple-or-more repeated letter is rare.
    letter = rng.choice("abcdefghijklmnopqrstuvwxyz")
    reps = rng.randint(4, 6)
    w = letter * reps
    pair = letter * 2
    return _call(w, f'count("{pair}")', lambda s: s.count(pair), args=(pair,))


def _t_replace_multichar(words, rng):
    w = rng.choice([x for x in words if len(x) >= 6] or words)
    n = 2
    start = rng.randint(0, max(0, len(w) - n))
    sub = w[start:start + n]
    replacement = "Q" * n
    return _call(
        w, f'replace("{sub}","{replacement}")', lambda s: s.replace(sub, replacement),
        args=(sub, replacement),
    )


TEMPLATES = [
    MTemplate("upper", BAND_EASY, _t_upper, C_GENERAL),
    MTemplate("lower", BAND_EASY, _t_lower, C_GENERAL),

    MTemplate("strip", BAND_EASY_MEDIUM, _t_strip, C_STRIP),
    MTemplate("replace_char", BAND_EASY_MEDIUM, _t_replace_char, C_GENERAL),

    MTemplate("count_single_char", BAND_MEDIUM, _t_count_single_char, C_GENERAL),
    MTemplate("startswith", BAND_MEDIUM, _t_startswith, C_GENERAL),
    MTemplate("endswith", BAND_MEDIUM, _t_endswith, C_GENERAL),

    MTemplate("find_present", BAND_MEDIUM_HARD, _t_find_present, C_COUNT_VS_FIND),
    MTemplate("index_present", BAND_MEDIUM_HARD, _t_index_present, C_COUNT_VS_FIND),
    MTemplate("find_absent", BAND_MEDIUM_HARD, _t_find_absent, C_COUNT_VS_FIND),

    MTemplate("index_absent_raises", BAND_MEDIUM_HARD, _t_index_absent_raises, C_COUNT_VS_FIND),
    MTemplate("count_substring", BAND_HARD, _t_count_substring, C_COUNT_OVERLAP),

    MTemplate("count_overlapping", BAND_VERY_HARD, _t_count_overlapping, C_COUNT_OVERLAP),
    MTemplate("replace_multichar", BAND_VERY_HARD, _t_replace_multichar, C_GENERAL),
]

BY_ID = {t.id: t for t in TEMPLATES}


def for_tier(tier):
    return core.for_tier(TEMPLATES, tier, TIER_BANDS)


# ─── write_code tasks ───────────────────────────────────────────────────────

CODE_TASKS = {
    # BAND_MEDIUM, not EASY_MEDIUM: KIND_CODE only ever fires from tier 4
    # (see _TIER_KINDS), whose band window starts at MEDIUM -- the same
    # unreachable-by-construction mistake looping_engine's print_each_char
    # and comparison_engine's KIND_ERROR band both made first. Checked
    # here by generating at scale and requiring every task to actually be
    # drawn, not just by eyeballing the band constant.
    "print_upper": {
        "band": BAND_MEDIUM,
        "needs_n": False,
        "statement": "print `word` in all upper case",
        "spec": lambda w: w.upper(),
    },
    "print_stripped": {
        "band": BAND_MEDIUM,
        "needs_n": False,
        "statement": "print `word` with any leading or trailing spaces removed",
        "spec": lambda w: w.strip(),
    },
    "count_letter_e": {
        "band": BAND_MEDIUM_HARD,
        "needs_n": False,
        "statement": 'print how many times the letter "e" appears in `word`, using .count()',
        "spec": lambda w: str(w.count("e")),
    },
    "print_position": {
        "band": BAND_HARD,
        "needs_n": False,
        "statement": 'print the position of the first "e" in `word` if it contains one, or -1 if it does not, using .find()',
        "spec": lambda w: str(w.find("e")),
    },
}


def code_tasks_for_tier(tier):
    bands = TIER_BANDS[tier]
    return [k for k, task in CODE_TASKS.items() if task["band"] in bands]
