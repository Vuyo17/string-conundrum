"""Procedural, unlimited-question engine for the Slicing module's endless
Practice mode.

Practice/Exam elsewhere draw from a small static exercise bank (see
feedback.py) that runs out after a few dozen questions. This engine builds
fresh questions on demand instead, and it does so by composing four
independent choices:

    template  x  string  x  question kind  x  answer format

A **template** (slicing_templates.py) is a slice *shape* — `word[a:b]` with
small positive bounds — tagged with one of six difficulty bands. A
**string** comes from the corpus (corpus.py): a dictionary word, or a real
structured value like a date or a filename whose fields live at known
offsets. A **question kind** is what is being asked about that slice: what
it evaluates to, how long the result is, which expressions match it, which
one actually raises, what a short program using it prints, or write the
code yourself. An **answer format** is how the student replies — the five
the UI can render.

The multiplication is the point. `hello[0:1]` and `friend[3:4]` are the same
template and different questions, and the same template can come back as
multiple choice, as a typed answer, as a slice to build, or as a length to
predict. Thirty-odd templates over a few hundred strings across eight kinds
gives an endless session no reason to repeat itself.

Difficulty escalates on every axis at once: tier 1 draws only easy-band
templates asked as "what does this give", tier 5 draws hard and very-hard
templates asked as anything from "which of these raises" to "write it".

Selection is **adaptive** when the client sends its recent misconceptions:
every template names the concept it probes using the grader's own
misconception vocabulary, so a student who keeps confusing negative indices
starts seeing more negative-index templates instead of a uniform draw.

Questions are never stored anywhere. Each `generate()` call returns a signed
token encoding everything needed to rebuild the question — the string, the
slice, the kind, the format, the template and a nonce. `grade()` verifies
that signature and recomputes the answer and the distractor set from it, so
a client cannot forge a question or its answer, and the server needs no
database round trip, and no session state, to remember what it just asked.

Nothing the client sends is ever eval'd. Typed slice bounds are parsed with
int(), and every multiple-choice option is matched back to a server-built
structure by its rendered text, so a submission can only ever name
something this module generated itself.
"""
import random
import time

from . import corpus
from . import practice_engine_core as core
from . import slicing_templates as tpl
from .sandbox import run_for_grading

MAX_TIER = 5

InvalidToken = core.InvalidToken
TOKEN_TTL_SECONDS = core.TOKEN_TTL_SECONDS

# Loaded once: the word list may have been widened by a corpus refresh, and
# re-reading the cache file per question would put disk IO on the request
# path for no benefit.
_WORDS = corpus.load_words()

_LEN_RANGE = {1: (6, 8), 2: (6, 10), 3: (7, 12), 4: (8, 13), 5: (9, 14)}

# ─── answer formats: how the student replies ────────────────────────────────
# Named to match the static bank's `type` vocabulary (see feedback.py) so the
# frontend renders both with one component per format.

FORMAT_MCQ = "mcq"
FORMAT_FILL_BLANK = "fill_blank"
FORMAT_BUILD_SLICE = "build_slice"
FORMAT_SELECT_ALL = "select_all"
FORMAT_WRITE_CODE = "write_code"

# ─── question kinds: what is being asked ────────────────────────────────────

KIND_EVALUATE = "evaluate"        # what does this slice produce?
KIND_CONSTRUCT = "construct"      # build a slice that produces this
KIND_IDENTIFY = "identify"        # which of these produce it?
KIND_LENGTH = "length"            # how many characters come back?
KIND_ERROR = "error"              # which of these actually raises?
KIND_EQUIVALENCE = "equivalence"  # which are equal for *any* string?
KIND_TRACE = "trace"              # what does this short program print?
KIND_CODE = "code"                # write it yourself

# Which formats each kind can be answered in. A kind that renders as mcq can
# also render as fill_blank when the answer is a single value.
_KIND_FORMATS = {
    KIND_EVALUATE: (FORMAT_MCQ, FORMAT_FILL_BLANK),
    KIND_CONSTRUCT: (FORMAT_BUILD_SLICE,),
    KIND_IDENTIFY: (FORMAT_SELECT_ALL,),
    KIND_LENGTH: (FORMAT_MCQ, FORMAT_FILL_BLANK),
    KIND_ERROR: (FORMAT_SELECT_ALL,),
    KIND_EQUIVALENCE: (FORMAT_SELECT_ALL,),
    KIND_TRACE: (FORMAT_MCQ, FORMAT_FILL_BLANK),
    KIND_CODE: (FORMAT_WRITE_CODE,),
}

# Kinds available per tier, weighted by repetition. Tier 1 leans on plain
# evaluation to get a nervous student moving; the analytical kinds arrive as
# the slices themselves stop being readable at a glance.
_TIER_KINDS = {
    1: (KIND_EVALUATE, KIND_EVALUATE, KIND_EVALUATE),
    2: (KIND_EVALUATE, KIND_EVALUATE, KIND_CONSTRUCT, KIND_LENGTH),
    3: (KIND_EVALUATE, KIND_CONSTRUCT, KIND_IDENTIFY, KIND_LENGTH, KIND_TRACE),
    4: (KIND_EVALUATE, KIND_CONSTRUCT, KIND_IDENTIFY, KIND_LENGTH,
        KIND_ERROR, KIND_TRACE, KIND_CODE),
    5: (KIND_EVALUATE, KIND_CONSTRUCT, KIND_IDENTIFY, KIND_ERROR,
        KIND_EQUIVALENCE, KIND_TRACE, KIND_CODE, KIND_CODE),
}

# Multiple choice is withdrawn once the slices get hard: four options at
# tier 5 would hand a stuck student the answer by elimination.
_MAX_MCQ_TIER = 3

# How much more likely a template is to be picked when it probes something
# the student has recently got wrong. Deliberately a nudge, not a lock —
# drilling one concept to the exclusion of all others would make the rest of
# the module go stale while the student is still climbing tiers.
_WEAK_CONCEPT_WEIGHT = 4


# ─── misconception-tagged distractors ───────────────────────────────────────

_MISCONCEPTION_STOP_INCLUSIVE = "slice_stop_inclusive"
_MISCONCEPTION_OFF_BY_ONE = "off_by_one_length"
_MISCONCEPTION_NEGATIVE_INDEX = "negative_index_confusion"
_MISCONCEPTION_NEGATIVE_STEP = "negative_step_unfamiliar"
_MISCONCEPTION_ONE_BASED = "indexing_from_one"


def _safe_slice(value, start, stop, step):
    # Python slicing never raises for out-of-range int bounds (only step=0
    # would), so every variant below is safe to evaluate unconditionally.
    return value[start:stop:step]


def _variant_stop_inclusive(value, start, stop, step):
    if step not in (None, 1) or stop is None:
        return None
    return _safe_slice(value, start, stop + 1, step), _MISCONCEPTION_STOP_INCLUSIVE


def _variant_off_by_one(value, start, stop, step):
    if stop is None:
        return _safe_slice(value, start, len(value) - 1, step), _MISCONCEPTION_OFF_BY_ONE
    return _safe_slice(value, start, stop - 1, step), _MISCONCEPTION_OFF_BY_ONE


def _variant_negative_index(value, start, stop, step):
    if (start is None or start >= 0) and (stop is None or stop >= 0):
        return None

    def reinterpret(v):
        # "-1 means the second-from-last character" — shifting every
        # negative index one step towards zero.
        return v + 1 if v is not None and v < 0 else v

    return _safe_slice(value, reinterpret(start), reinterpret(stop), step), _MISCONCEPTION_NEGATIVE_INDEX


def _variant_negative_step(value, start, stop, step):
    if step is None or step >= 0:
        return None
    return _safe_slice(value, start, stop, abs(step)), _MISCONCEPTION_NEGATIVE_STEP


def _variant_one_based(value, start, stop, step):
    if (start is not None and start < 0) or (stop is not None and stop < 0):
        return None
    shifted_start = max(0, start - 1) if start is not None else None
    shifted_stop = max(0, stop - 1) if stop is not None else None
    if shifted_start == start and shifted_stop == stop:
        return None
    return _safe_slice(value, shifted_start, shifted_stop, step), _MISCONCEPTION_ONE_BASED


_VARIANT_FUNCS = [
    _variant_stop_inclusive,
    _variant_off_by_one,
    _variant_negative_index,
    _variant_negative_step,
    _variant_one_based,
]


def _misconception_for_text(value, start, stop, step, submitted, correct):
    """Which misconception, if any, would produce `submitted` here.

    Used by the typed formats, where there are no options to look the answer
    up in — the student's own text is matched against what each
    misconception would have produced instead.
    """
    if submitted == correct:
        return None
    for fn in _VARIANT_FUNCS:
        result = fn(value, start, stop, step)
        if result is not None and result[0] == submitted:
            return result[1]
    return None


def _build_options(value, start, stop, step, correct, rng):
    """Four shuffled options: the correct slice plus up to three
    misconception-tagged distractors, padded with harmless letter-shuffles
    if a question's own variants don't yield enough distinct wrong answers.

    `rng` must be freshly seeded from the token's nonce so grading can call
    this again later and reproduce the exact same option set.
    """
    # Two sets, because two options must differ in more than whitespace: on a
    # button "73 " and "73" are the same picture, and offering both makes the
    # question a coin toss rather than a test of anything.
    seen = {correct}
    seen_stripped = {correct.strip()}
    pool = []
    for fn in _VARIANT_FUNCS:
        result = fn(value, start, stop, step)
        if result is None:
            continue
        text, misconception_id = result
        if text in seen or text.strip() in seen_stripped:
            continue
        seen.add(text)
        seen_stripped.add(text.strip())
        pool.append((text, misconception_id))

    rng.shuffle(pool)
    distractors = pool[:3]

    # A short correct answer (e.g. 2 characters) has too few permutations to
    # reliably fill 3 distractors, so this always has an escape hatch: a
    # random extra letter, tried with growing suffix length until it lands
    # on something unseen. That's guaranteed to terminate rather than
    # depending on permutation space that can run dry.
    guard = 0
    alphabet = "abcdefghijklmnopqrstuvwxyz"
    while len(distractors) < 3 and guard < 40:
        guard += 1
        if len(correct) > 2 and guard <= 6:
            candidate = "".join(rng.sample(correct, len(correct)))
        else:
            suffix = "".join(rng.choice(alphabet) for _ in range(1 + guard // 10))
            candidate = correct + suffix
        if candidate not in seen and candidate.strip() not in seen_stripped:
            seen.add(candidate)
            seen_stripped.add(candidate.strip())
            distractors.append((candidate, None))

    options = [(correct, None)] + distractors
    rng.shuffle(options)
    misconception_by_option = {text: mid for text, mid in options}
    return [text for text, _ in options], misconception_by_option


# ─── expression rendering ───────────────────────────────────────────────────

def _bound(value):
    return "" if value is None else str(value)


def _expr(name, start, stop, step):
    text = f"{name}[{_bound(start)}:{_bound(stop)}"
    if step is not None:
        text += f":{step}"
    return text + "]"


def _quoted(text):
    """Render a slice result for prose, keeping the empty string visible."""
    return f'"{text}"' if text else '"" (the empty string)'


def _assignment(name, value):
    return f'{name} = "{value}"'


# ─── select_all / equivalence candidate expressions ─────────────────────────

def _rewrites(value, start, stop, step):
    """Alternative (start, stop, step) triples worth offering alongside the
    canonical one.

    Some of these are exactly equivalent to the original and some are not —
    deliberately. Nothing here asserts equivalence; the callers evaluate
    every candidate and derive the answer key from the results, so a rewrite
    that turns out to differ simply becomes a wrong option rather than a bug.
    """
    n = len(value)
    out = []

    # Same slice, addressed from the other end.
    if step in (None, 1):
        neg_start = start - n if isinstance(start, int) and 0 <= start < n else start
        neg_stop = stop - n if isinstance(stop, int) and 0 < stop < n else stop
        out.append((neg_start, neg_stop, step))

    # Same slice with a redundant bound dropped.
    trimmed_start = None if start in (0, None) else start
    trimmed_stop = None if stop in (n, None) else stop
    if (trimmed_start, trimmed_stop) != (start, stop):
        out.append((trimmed_start, trimmed_stop, step))

    # Same slice with the default step spelled out — equivalent, and a
    # useful thing for a student to recognise as equivalent.
    if step is None:
        out.append((start, stop, 1))

    # Near misses: the bounds nudged by one in each direction.
    if isinstance(stop, int):
        out.append((start, stop + 1, step))
        out.append((start, stop - 1, step))
    if isinstance(start, int):
        out.append((start + 1, stop, step))
        out.append((start - 1, stop, step))

    # A slice with an omitted bound generates few near misses from the rules
    # above, which would leave some questions with only one thing to reject.
    if stop is None and step in (None, 1):
        out.append((start, n - 1, step))
    if start is None and step in (None, 1):
        out.append((1, stop, step))
    if step is None:
        out.append((start, stop, 2))

    return out


def _build_select_all(value, name, start, stop, step, rng):
    """Up to five expressions to judge, and the set that actually matches.

    Returns `(option_texts, correct_texts, triple_by_text)`. Correctness is
    computed by evaluating each candidate rather than being authored, so the
    key cannot drift from the options.

    `rng` must be seeded from the token's nonce: grading regenerates this
    list to work out which of the offered expressions were correct.
    """
    target = _safe_slice(value, start, stop, step)

    candidates = [(start, stop, step)] + _rewrites(value, start, stop, step)
    if isinstance(start, int) and isinstance(stop, int):
        candidates.append((stop, start, step))

    by_text = {}
    for triple in candidates:
        a, b, c = triple
        if c == 0:
            continue
        by_text.setdefault(_expr(name, a, b, c), triple)

    texts = list(by_text)
    rng.shuffle(texts)

    correct = [t for t in texts if _safe_slice(value, *by_text[t]) == target]
    wrong = [t for t in texts if t not in correct]

    # A select_all needs something to accept and enough to reject. With only
    # one wrong option the question collapses into "spot the odd one out",
    # which is easier than the mcq it is supposed to be harder than.
    if not correct or len(wrong) < 2:
        return None

    chosen = correct[:2] + wrong[:3]
    rng.shuffle(chosen)
    return chosen, [t for t in chosen if t in correct], by_text


# Strings an equivalence claim is tested against. Equivalence has to hold for
# *any* string, so it is checked against a deliberately awkward spread —
# short, long, even, odd — rather than against the one on screen.
_EQUIV_PROBES = ("ab", "abc", "abcd", "python", "elephant", "wonderland", "a", "")


def _build_equivalence(value, name, start, stop, step, rng):
    """Expressions that match the base slice for EVERY probe string.

    Stronger than _build_select_all, which only asks about the one string on
    screen: here a candidate that happens to coincide on this word but
    diverges on a shorter one is a *wrong* answer, which is exactly the
    distinction between "equal here" and "equivalent".
    """
    candidates = [(start, stop, step)] + _rewrites(value, start, stop, step)

    by_text = {}
    for a, b, c in candidates:
        if c == 0:
            continue
        by_text.setdefault(_expr(name, a, b, c), (a, b, c))

    def always_matches(triple):
        return all(
            _safe_slice(probe, *triple) == _safe_slice(probe, start, stop, step)
            for probe in _EQUIV_PROBES
        )

    texts = list(by_text)
    rng.shuffle(texts)
    correct = [t for t in texts if always_matches(by_text[t])]
    wrong = [t for t in texts if t not in correct]

    if not correct or len(wrong) < 2:
        return None

    chosen = correct[:2] + wrong[:3]
    rng.shuffle(chosen)
    return chosen, [t for t in chosen if t in correct], by_text


# ─── "which of these raises?" ───────────────────────────────────────────────
# Ops are structured, never strings to be eval'd: ("slice", a, b, c) or
# ("index", i). Whether one raises is determined by actually attempting it
# on the value, so the answer key is observed rather than asserted.

def _op_text(name, op):
    if op[0] == "index":
        return f"{name}[{op[1]}]"
    return _expr(name, op[1], op[2], op[3])


def _op_raises(value, op):
    try:
        if op[0] == "index":
            value[op[1]]
        else:
            value[op[1]:op[2]:op[3]]
    except (IndexError, ValueError, TypeError):
        return True
    return False


def _build_error_options(value, name, rng):
    """Five expressions and the subset of them that actually raises.

    The lesson is the asymmetry: an out-of-range *slice* bound clamps
    silently while an out-of-range *index* raises IndexError, and the only
    slice that raises at all is one with a zero step. So the safe options are
    chosen to look dangerous — a slice running to index 40 of an eight
    character string is completely fine.

    Asked as "select every one that raises" rather than "pick the one",
    because with a single culprit a student who knows only that indexing is
    riskier than slicing can eliminate their way to it without knowing why.
    """
    n = len(value)

    raising = [
        ("index", n + rng.randint(0, 6)),
        ("index", -(n + rng.randint(1, 6))),
        ("slice", rng.choice([None, 0, 1]), rng.choice([None, n]), 0),
    ]
    safe = [
        ("slice", 0, n + rng.randint(5, 40), None),
        ("slice", -(n + rng.randint(5, 40)), None, None),
        ("slice", rng.randint(2, max(2, n - 1)), rng.randint(0, 1), None),
        ("slice", None, None, -1),
        ("slice", n + rng.randint(1, 5), None, None),
        ("index", -min(n, rng.randint(1, max(1, n)))),
    ]

    # Verified, not trusted: an op only counts as raising, or as safe,
    # because it was actually tried on this value.
    culprits = [op for op in rng.sample(raising, len(raising)) if _op_raises(value, op)]
    innocents = [op for op in safe if not _op_raises(value, op)]
    if not culprits or len(innocents) < 3:
        return None

    keep = culprits[:rng.choice([1, 2])]
    rng.shuffle(innocents)
    chosen = keep + innocents[:5 - len(keep)]
    rng.shuffle(chosen)

    texts = [_op_text(name, op) for op in chosen]
    if len(set(texts)) != len(texts):
        return None
    return texts, [_op_text(name, op) for op in keep]


# ─── template + string selection ────────────────────────────────────────────
# Token signing/verification and misconception-weighted selection now live
# in practice_engine_core.py, shared with every other module's engine; see
# that module's docstring. _weighted_templates below is a thin wrapper
# kept under its original name for this file's other call sites.

def _weighted_templates(templates, weak):
    return core.weighted_templates(templates, weak, weight=_WEAK_CONCEPT_WEIGHT)


def _kinds_for_template(template):
    if template.field_based:
        return corpus.STRUCTURED_KINDS
    return template.kinds or None


def _pick_slice_question(tier, rng, weak, allow_empty, stepless=False, bare_answer=False):
    """A (template, entry, start, stop, step, result) that isn't degenerate.

    Degeneracy is the thing worth avoiding here: a slice returning the whole
    string is answerable without reading the question and starves the
    distractor generator, and an empty result gives the construct/identify
    kinds nothing to aim at.

    `stepless` restricts the draw to slices a two-bound builder can express,
    for the tiers where the step box isn't offered yet.

    `bare_answer` excludes results with a leading or trailing space, for
    questions whose answer is shown or typed as unquoted text. The corpus
    contains phone numbers, so `phone[3:9]` really can be `" 299 1"` — which
    is unfair to type into a plain box, and worse as a multiple-choice
    option, where "078 " and "078" are different answers that look identical
    on a button. Formats that show the value quoted (a prompt, an expression
    list) are unaffected.
    """
    candidates = tpl.for_tier(tier)
    if not allow_empty:
        # These templates exist *to* produce '' — excluding them beats
        # rejecting their output sixty times.
        candidates = [t for t in candidates if t.concept != tpl.C_EMPTY]
    if stepless:
        candidates = [t for t in candidates if t.concept != tpl.C_STEP]
    if not candidates:
        candidates = tpl.for_tier(tier)

    weighted = _weighted_templates(candidates, weak)
    min_len, max_len = _LEN_RANGE[tier]

    for _ in range(60):
        template = rng.choice(weighted)
        entry = corpus.sample(
            rng,
            kinds=_kinds_for_template(template),
            min_len=max(min_len, template.min_len),
            max_len=max_len,
            words=_WORDS,
        )
        if not template.accepts(entry):
            continue
        built = template.build(entry, rng)
        if built is None:
            continue
        start, stop, step = built
        if step == 0:
            continue
        if stepless and step not in (None, 1):
            continue
        result = _safe_slice(entry.value, start, stop, step)
        if result == entry.value:
            continue
        if result == "" and not allow_empty:
            continue
        if bare_answer and result != result.strip():
            continue
        return template, entry, start, stop, step, result

    return None


def _pick_format(kind, tier, rng):
    formats = [
        f for f in _KIND_FORMATS[kind]
        if not (f == FORMAT_MCQ and tier > _MAX_MCQ_TIER)
    ]
    return rng.choice(formats or list(_KIND_FORMATS[kind]))


# ─── write_code ─────────────────────────────────────────────────────────────

_CODE_STARTER = "# `word` is already defined for you.\n"

# Three runs is enough to kill a hardcoded answer while keeping the round
# trip well inside the sandbox's 5-second-per-run ceiling.
_CODE_TEST_RUNS = 3


def _code_test_words(rng, tier):
    lo, hi = _LEN_RANGE[tier]
    # Widened deliberately: varying the length across runs is what catches a
    # submission that hardcoded a length as well as one that hardcoded text.
    pool = [w for w in _WORDS if lo - 1 <= len(w) <= hi + 2] or list(_WORDS)
    if len(pool) <= _CODE_TEST_RUNS:
        return pool
    return rng.sample(pool, _CODE_TEST_RUNS)


def _grade_write_code(task_key, n, tier, rng, code):
    task = tpl.CODE_TASKS.get(task_key)
    if task is None:
        return {"correct": False, "detail": ""}

    submitted = (code or "").strip()
    if not submitted:
        return {"correct": False, "detail": "You didn't write any code yet."}

    for test_word in _code_test_words(rng, tier):
        expected = task["spec"](test_word, n)
        # The assignment is prepended rather than left in the starter so the
        # student cannot quietly redefine `word` to something their hardcoded
        # answer happens to match.
        run = run_for_grading(f"word = {test_word!r}\n{submitted}\n")

        if run.get("timed_out"):
            return {"correct": False, "detail": "Your code took too long to finish (5 second limit)."}
        if run.get("stderr"):
            last_line = run["stderr"].strip().splitlines()[-1]
            return {"correct": False, "detail": f"Your code raised an error: {last_line}"}

        actual = (run.get("stdout") or "").rstrip("\n")
        if actual != expected:
            return {
                "correct": False,
                "detail": (
                    f'With word = "{test_word}" your code printed '
                    f'"{actual}" but should print "{expected}".'
                ),
            }

    return {"correct": True, "detail": ""}


# ─── token signing ──────────────────────────────────────────────────────────
# Thin wrappers over practice_engine_core, kept under their original names
# for this file's many call sites.

def _sign(payload: dict) -> str:
    return core.sign(payload)


def _verify(token: str) -> dict:
    return core.verify(token)


# ─── typed-answer normalisation ─────────────────────────────────────────────

def _normalise_typed(text) -> str:
    """What the student typed, as the string they meant.

    Students reasonably type `'eph'` or `"eph"` when the answer is a Python
    string, so a matched pair of surrounding quotes is honoured — and inside
    those quotes nothing is stripped, because quoting is exactly how you say
    "the spaces are part of my answer". Unquoted input is stripped, since
    there a stray space is far more likely to be a typo than an answer.
    (Typed questions whose answer has an edge space are not generated at
    all — see _pick_slice_question — so this is a courtesy, not the load
    bearing part.)

    Case is NOT folded: 'EPH' is genuinely a different string from 'eph',
    and this module is about exact values.
    """
    raw = str(text or "")
    trimmed = raw.strip()
    if len(trimmed) >= 2 and trimmed[0] == trimmed[-1] and trimmed[0] in ("'", '"'):
        return trimmed[1:-1]
    return trimmed


def _submitted_text(submission, fmt):
    """The student's single-value answer, normalised only where that's safe.

    A clicked option is compared verbatim: it is a string this module
    generated, so trimming or unquoting it could only ever turn one option
    into another. Normalisation exists to forgive typing, and nobody types
    a button.
    """
    raw = submission.get("answer")
    return str(raw or "") if fmt == FORMAT_MCQ else _normalise_typed(raw)


def _parse_bound(raw):
    """Parse one typed slice bound into `None` (omitted) or an int.

    Raises ValueError for anything else, which `grade` turns into a "that
    isn't a whole number" message rather than a wrong answer — a typo is not
    a misconception.
    """
    value = str(raw or "").strip()
    if value == "":
        return None
    return int(value)


def parse_weak_concepts(raw):
    return core.parse_weak_concepts(raw, {t.concept for t in tpl.TEMPLATES})


# ─── generation ─────────────────────────────────────────────────────────────

def _base_payload(tier, nonce, fmt, kind):
    return {
        "t": tier, "n": nonce, "ts": int(time.time()),
        "f": fmt, "q": kind,
    }


def _generate_code(tier, rng):
    keys = tpl.code_tasks_for_tier(tier)
    if not keys:
        return None
    task_key = rng.choice(keys)
    task = tpl.CODE_TASKS[task_key]
    n = rng.randint(2, 4) if task["needs_n"] else 0
    nonce = rng.getrandbits(32)

    payload = _base_payload(tier, nonce, FORMAT_WRITE_CODE, KIND_CODE)
    payload.update({"w": "", "a": None, "b": None, "c": None, "k": task_key, "p": n})

    samples = _code_test_words(random.Random(nonce ^ 0x5EED), tier)[:2]
    return {
        "token": _sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_WRITE_CODE,
        "kind": KIND_CODE,
        "template": task_key,
        "band": task["band"],
        "prompt": f'Write code that will {task["statement"].format(n=n)}.',
        "starter_code": _CODE_STARTER,
        "examples": [{"word": w, "output": task["spec"](w, n)} for w in samples],
    }


def _generate_error(tier, rng, weak):
    picked = _pick_slice_question(tier, rng, weak, allow_empty=True)
    if picked is None:
        return None
    template, entry, _, _, _, _ = picked
    nonce = rng.getrandbits(32)

    built = _build_error_options(entry.value, entry.name, random.Random(nonce))
    if built is None:
        return None

    payload = _base_payload(tier, nonce, FORMAT_SELECT_ALL, KIND_ERROR)
    payload.update({
        "w": entry.value, "nm": entry.name,
        "a": None, "b": None, "c": None, "tp": template.id,
    })

    return {
        "token": _sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_SELECT_ALL,
        "kind": KIND_ERROR,
        "template": template.id,
        "band": template.band,
        "prompt": (
            "Select every expression below that raises an error.\n"
            + _assignment(entry.name, entry.value)
        ),
        "options": built[0],
    }


def _generate_trace(tier, rng, weak):
    fmt = _pick_format(KIND_TRACE, tier, rng)
    picked = _pick_slice_question(
        tier, rng, weak, allow_empty=False, bare_answer=True,
    )
    if picked is None:
        return None
    template, entry, start, stop, step, first = picked

    # The second slice runs on the result of the first, so it has to be
    # bounded by that result's length rather than the original's.
    if len(first) < 3:
        return None
    second = rng.choice([
        (None, None, -1),
        (1, None, None),
        (None, -1, None),
        (None, None, 2),
        (0, 2, None),
    ])
    answer = _safe_slice(first, *second)
    if answer == first:
        return None
    # The first slice was checked for edge whitespace; the second can
    # reintroduce it, and it is the second's output that gets typed.
    if answer != answer.strip():
        return None

    nonce = rng.getrandbits(32)

    payload = _base_payload(tier, nonce, fmt, KIND_TRACE)
    payload.update({
        "w": entry.value, "nm": entry.name,
        "a": start, "b": stop, "c": step,
        "s2": list(second), "tp": template.id,
    })

    snippet = "\n".join([
        _assignment(entry.name, entry.value),
        f"part = {_expr(entry.name, start, stop, step)}",
        f"print({_expr('part', *second)})",
    ])

    question = {
        "token": _sign(payload),
        "tier": tier,
        "stars": tier,
        "type": fmt,
        "kind": KIND_TRACE,
        "template": template.id,
        "band": template.band,
        "prompt": f"What does this program print?\n{snippet}",
    }
    if fmt == FORMAT_MCQ:
        options, _ = _build_options(first, *second, answer, random.Random(nonce))
        question["options"] = options
    else:
        # No `expression` field: there is nothing to put on the left of an
        # "=" here, so the UI renders a plain labelled box instead.
        question["answer_label"] = "printed output"
    return question


def _generate_length(tier, rng, weak):
    picked = _pick_slice_question(tier, rng, weak, allow_empty=True)
    if picked is None:
        return None
    template, entry, start, stop, step, result = picked

    nonce = rng.getrandbits(32)
    fmt = _pick_format(KIND_LENGTH, tier, rng)
    expression = _expr(entry.name, start, stop, step)

    payload = _base_payload(tier, nonce, fmt, KIND_LENGTH)
    payload.update({
        "w": entry.value, "nm": entry.name,
        "a": start, "b": stop, "c": step, "tp": template.id,
    })

    question = {
        "token": _sign(payload),
        "tier": tier,
        "stars": tier,
        "type": fmt,
        "kind": KIND_LENGTH,
        "template": template.id,
        "band": template.band,
        "prompt": (
            f"How many characters does `{expression}` return?\n"
            + _assignment(entry.name, entry.value)
        ),
    }

    if fmt == FORMAT_MCQ:
        answer = len(result)
        opts_rng = random.Random(nonce)
        pool = [answer, answer + 1, max(0, answer - 1), len(entry.value)]
        if isinstance(start, int) and isinstance(stop, int):
            pool.append(abs(stop - start))
        seen, options = set(), []
        for candidate in pool:
            if candidate not in seen and candidate >= 0:
                seen.add(candidate)
                options.append(candidate)
        bump = 2
        while len(options) < 4:
            candidate = answer + bump
            if candidate not in seen:
                seen.add(candidate)
                options.append(candidate)
            bump += 1
        options = [str(o) for o in options[:4]]
        opts_rng.shuffle(options)
        question["options"] = options
    else:
        question["expression"] = f"len({expression})"

    return question


def _generate_equivalence(tier, rng, weak):
    picked = _pick_slice_question(tier, rng, weak, allow_empty=False)
    if picked is None:
        return None
    template, entry, start, stop, step, _ = picked

    nonce = rng.getrandbits(32)
    built = _build_equivalence(
        entry.value, entry.name, start, stop, step, random.Random(nonce),
    )
    if built is None:
        return None

    payload = _base_payload(tier, nonce, FORMAT_SELECT_ALL, KIND_EQUIVALENCE)
    payload.update({
        "w": entry.value, "nm": entry.name,
        "a": start, "b": stop, "c": step, "tp": template.id,
    })

    return {
        "token": _sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_SELECT_ALL,
        "kind": KIND_EQUIVALENCE,
        "template": template.id,
        "band": template.band,
        "prompt": (
            f"Select every expression that gives the same result as "
            f"`{_expr(entry.name, start, stop, step)}` for **any** string, "
            f"not just this one.\n" + _assignment(entry.name, entry.value)
        ),
        "options": built[0],
    }


def _generate_slice_question(kind, tier, rng, weak):
    """evaluate / construct / identify — the three kinds that ask directly
    about one slice of one string."""
    # The format is chosen first because it constrains what may be asked: a
    # typed box cannot fairly hold an answer with an edge space, and a
    # two-bound builder cannot express a slice that needs a step.
    fmt = _pick_format(kind, tier, rng)
    picked = _pick_slice_question(
        tier, rng, weak,
        allow_empty=(kind == KIND_EVALUATE),
        stepless=(kind == KIND_CONSTRUCT and tier < 4),
        bare_answer=(kind in (KIND_EVALUATE, KIND_TRACE)),
    )
    if picked is None:
        return None
    template, entry, start, stop, step, result = picked

    nonce = rng.getrandbits(32)

    payload = _base_payload(tier, nonce, fmt, kind)
    payload.update({
        "w": entry.value, "nm": entry.name,
        "a": start, "b": stop, "c": step, "tp": template.id,
    })

    question = {
        "tier": tier,
        "stars": tier,
        "type": fmt,
        "kind": kind,
        "template": template.id,
        "band": template.band,
    }

    if kind == KIND_EVALUATE:
        expression = _expr(entry.name, start, stop, step)
        title = (
            f"What does `{expression}` evaluate to?" if fmt == FORMAT_MCQ
            else f"Type the exact value of `{expression}`."
        )
        question["prompt"] = f"{title}\n{_assignment(entry.name, entry.value)}"
        if fmt == FORMAT_MCQ:
            options, _ = _build_options(
                entry.value, start, stop, step, result, random.Random(nonce),
            )
            question["options"] = options
        else:
            question["expression"] = expression
            question["word"] = entry.value

    elif kind == KIND_CONSTRUCT:
        # A field-based template knows what the span *means*, which turns a
        # bounds puzzle into the question real code actually asks.
        label = None
        if template.field_based:
            label = next(
                (k for k, v in entry.fields.items() if tuple(v) == (start, stop, step)),
                None,
            )
        payload["lbl"] = label or ""
        question["prompt"] = (
            (f"Fill in the bounds so the slice gives {label} of `{entry.name}`."
             if label else
             f"Fill in the bounds so the slice produces {_quoted(result)}.")
            + "\n" + _assignment(entry.name, entry.value)
        )
        question["word"] = entry.value
        question["name"] = entry.name
        question["target"] = result
        question["allow_step"] = tier >= 4

    elif kind == KIND_IDENTIFY:
        built = _build_select_all(
            entry.value, entry.name, start, stop, step, random.Random(nonce),
        )
        if built is None:
            return None
        question["prompt"] = (
            f"Select every expression below that evaluates to {_quoted(result)}.\n"
            + _assignment(entry.name, entry.value)
        )
        question["options"] = built[0]
        question["target"] = result

    question["token"] = _sign(payload)
    return question


_KIND_BUILDERS = {
    KIND_ERROR: _generate_error,
    KIND_TRACE: _generate_trace,
    KIND_LENGTH: _generate_length,
    KIND_EQUIVALENCE: _generate_equivalence,
}


def generate(tier: int = 1, seed=None, weak=None) -> dict:
    """Build one procedural slicing question at the given difficulty tier.

    `weak` is an optional set of misconception ids the student has recently
    got wrong; templates probing those are drawn more often. It only biases
    selection — it can never produce a question the tier wouldn't otherwise
    allow, so a struggling student is nudged, not held back.

    Every builder may decline (a slice that yields no usable options, a tier
    with no coding tasks), so this retries across kinds and finally falls
    back to plain evaluation, which can always be built.
    """
    tier = max(1, min(MAX_TIER, int(tier)))
    rng = random.Random(seed) if seed is not None else random.Random()
    weak = weak if isinstance(weak, (set, frozenset)) else parse_weak_concepts(weak)

    kinds = list(_TIER_KINDS[tier])
    rng.shuffle(kinds)

    for kind in kinds[:4]:
        if kind == KIND_CODE:
            question = _generate_code(tier, rng)
        elif kind in _KIND_BUILDERS:
            question = _KIND_BUILDERS[kind](tier, rng, weak)
        else:
            question = _generate_slice_question(kind, tier, rng, weak)
        if question is not None:
            return question

    return _generate_slice_question(KIND_EVALUATE, tier, rng, weak)


# ─── grading ────────────────────────────────────────────────────────────────

def grade(token: str, submission: "dict | str") -> dict:
    """Verify a token, then grade the submission against it.

    `submission` carries whichever field the question's format calls for:
    `answer` (mcq, fill_blank), `answers` (select_all), `slice`
    (build_slice) or `code` (write_code). A bare string is accepted as a
    shorthand for `answer`.

    Returns `{"ok": False, "error": ...}` for a missing/expired/tampered
    token — a `POST /answer` with such a token means the session went stale
    or was interfered with, not that the student answered "wrong".
    """
    try:
        payload = _verify(token)
    except InvalidToken as exc:
        return {"ok": False, "error": str(exc)}

    if not isinstance(submission, dict):
        submission = {"answer": submission}

    value = payload.get("w", "")
    name = payload.get("nm", "word")
    start, stop, step = payload.get("a"), payload.get("b"), payload.get("c")
    tier = payload.get("t", 1)
    fmt = payload.get("f", FORMAT_MCQ)
    kind = payload.get("q", KIND_EVALUATE)
    template_id = payload.get("tp", "")
    concept = tpl.BY_ID[template_id].concept if template_id in tpl.BY_ID else None

    def verdict(is_correct, correct_answer, misconception_id=None, detail=""):
        return {
            "ok": True,
            "correct": is_correct,
            "correct_answer": correct_answer,
            # Fall back to the template's own concept so feedback still has
            # something specific to say when the wrong answer doesn't match
            # any known misconception exactly.
            "misconception_id": misconception_id or (None if is_correct else concept),
            "stars_awarded": tier if is_correct else 0,
            "tier": tier,
            "format": fmt,
            "kind": kind,
            "concept": concept,
            "detail": detail,
        }

    # ── write_code: run it, don't compare it ──────────────────────────────
    if kind == KIND_CODE:
        task_key = payload.get("k", "")
        task = tpl.CODE_TASKS.get(task_key)
        n = payload.get("p", 0)
        outcome = _grade_write_code(
            task_key, n, tier, random.Random(payload["n"]), submission.get("code", ""),
        )
        statement = task["statement"].format(n=n) if task else ""
        return verdict(
            outcome["correct"],
            f"code that will {statement}" if statement else "",
            None,
            outcome["detail"],
        )

    # ── select_all family: compare against the regenerated answer key ─────
    if kind in (KIND_IDENTIFY, KIND_EQUIVALENCE, KIND_ERROR):
        seeded = random.Random(payload["n"])
        if kind == KIND_ERROR:
            built = _build_error_options(value, name, seeded)
        elif kind == KIND_IDENTIFY:
            built = _build_select_all(value, name, start, stop, step, seeded)
        else:
            built = _build_equivalence(value, name, start, stop, step, seeded)
        if built is None:
            return {"ok": False, "error": "question could not be regenerated"}
        offered, key = built[0], built[1]
        # Anything not offered is discarded rather than counted wrong: the
        # client can only have got it from a tampered payload, and silently
        # ignoring it keeps the comparison a comparison of real choices.
        submitted = {a for a in (submission.get("answers") or []) if a in offered}
        return verdict(submitted == set(key), ", ".join(sorted(key)))

    # ── build_slice: any slice that produces the target counts ────────────
    if kind == KIND_CONSTRUCT:
        target = _safe_slice(value, start, stop, step)
        raw = submission.get("slice") or {}
        try:
            a = _parse_bound(raw.get("start"))
            b = _parse_bound(raw.get("stop"))
            c = _parse_bound(raw.get("step"))
        except (TypeError, ValueError):
            return verdict(
                False, _expr(name, start, stop, step), None,
                "Slice bounds have to be whole numbers, or left blank.",
            )
        if c == 0:
            return verdict(
                False, _expr(name, start, stop, step), None,
                "A step of 0 is not allowed — Python raises ValueError for it.",
            )

        produced = _safe_slice(value, a, b, c)
        if produced == target:
            return verdict(True, _expr(name, a, b, c))
        return verdict(
            False, _expr(name, start, stop, step),
            _misconception_for_text(value, start, stop, step, produced, target),
            f"{_expr(name, a, b, c)} produces {_quoted(produced)}.",
        )

    # ── length: an integer, however it was asked ──────────────────────────
    if kind == KIND_LENGTH:
        answer = str(len(_safe_slice(value, start, stop, step)))
        return verdict(_submitted_text(submission, fmt) == answer, answer)

    # ── trace: the printed output of the two-step snippet ─────────────────
    if kind == KIND_TRACE:
        second = tuple(payload.get("s2", (None, None, None)))
        answer = _safe_slice(_safe_slice(value, start, stop, step), *second)
        return verdict(_submitted_text(submission, fmt) == answer, answer)

    # ── evaluate (mcq or typed) ───────────────────────────────────────────
    correct_answer = _safe_slice(value, start, stop, step)
    submitted = _submitted_text(submission, fmt)
    if submitted == correct_answer:
        return verdict(True, correct_answer)

    if fmt == FORMAT_MCQ:
        _, misconception_by_option = _build_options(
            value, start, stop, step, correct_answer, random.Random(payload["n"]),
        )
        return verdict(False, correct_answer, misconception_by_option.get(submitted))

    return verdict(
        False, correct_answer,
        _misconception_for_text(value, start, stop, step, submitted, correct_answer),
    )
