"""Procedural, unlimited-question engine for the Immutability module's
endless Practice mode.

Sixth module on this pattern (see slicing_engine.py's docstring for the
shared idea). Immutability's own shape -- "what happens when this runs",
not "what value does this produce" -- comes from
immutability_templates.py (see that module's docstring for the two real
misconceptions it covers and why every scenario's outcome is computed by
actually running the equivalent Python rather than simulating it).
"""
import random
import time

from . import corpus
from . import immutability_templates as tpl
from . import practice_engine_core as core
from .sandbox import run_for_grading

MAX_TIER = 5
InvalidToken = core.InvalidToken

FORMAT_MCQ = "mcq"
FORMAT_FILL_BLANK = "fill_blank"
FORMAT_SELECT_ALL = "select_all"
FORMAT_WRITE_CODE = "write_code"

KIND_PREDICT = "predict"    # what happens when this code runs?
KIND_FIX = "fix"            # fix the broken line so it actually reassigns
KIND_IDENTIFY = "identify"  # which operations return a NEW string?
KIND_CODE = "code"          # write it yourself

_KIND_FORMATS = {
    KIND_PREDICT: (FORMAT_MCQ,),
    KIND_FIX: (FORMAT_FILL_BLANK,),
    KIND_IDENTIFY: (FORMAT_SELECT_ALL,),
    KIND_CODE: (FORMAT_WRITE_CODE,),
}

_TIER_KINDS = {
    1: (KIND_PREDICT, KIND_PREDICT, KIND_PREDICT),
    2: (KIND_PREDICT, KIND_PREDICT, KIND_IDENTIFY),
    3: (KIND_PREDICT, KIND_FIX, KIND_IDENTIFY),
    4: (KIND_PREDICT, KIND_FIX, KIND_IDENTIFY, KIND_CODE),
    5: (KIND_PREDICT, KIND_FIX, KIND_IDENTIFY, KIND_CODE, KIND_CODE),
}

_WEAK_CONCEPT_WEIGHT = 4

_WORDS = corpus.load_words()


def _weighted_templates(templates, weak):
    return core.weighted_templates(templates, weak, weight=_WEAK_CONCEPT_WEIGHT)


def _pick_scenario(tier, rng, weak, predicate=None):
    candidates = tpl.for_tier(tier)
    weighted = _weighted_templates(candidates, weak)
    for _ in range(60):
        template = rng.choice(weighted)
        scenario = template.build(_WORDS, rng)
        if scenario is None:
            continue
        if predicate and not predicate(scenario):
            continue
        return template, scenario
    return None


# ─── predict distractors ──────────────────────────────────────────────────────

def _predict_options(scenario, rng):
    """Four descriptive options, matching the static bank's own style
    (whole-sentence choices, not bare values) -- built from whichever of
    the two real misconceptions this scenario actually demonstrates."""
    if scenario.raises:
        correct = f"It raises a {scenario.exc_name} because strings are immutable."
        pool = [
            f"It changes {scenario.name} as shown, in place.",
            f"It silently does nothing, and {scenario.name} is unchanged.",
            f"It creates a new variable instead of changing {scenario.name}.",
        ]
    else:
        printed_render = repr(scenario.printed)
        if not scenario.reassigned:
            correct = (
                f"It prints {scenario.name} unchanged: {printed_render}, because "
                f"the result of .{scenario.method}() was never stored."
            )
            pool = [
                f"It prints a new value, since .{scenario.method}() changes {scenario.name} directly.",
                "It raises a TypeError because strings are immutable.",
                "It prints an empty string.",
            ]
        else:
            correct = f"It prints the new value: {printed_render}."
            pool = [
                f"It prints {scenario.name} unchanged, since {scenario.name} was never reassigned.",
                "It raises a TypeError because strings are immutable.",
                "It silently does nothing.",
            ]
    rng.shuffle(pool)
    options = [correct] + pool[:3]
    rng.shuffle(options)
    return options, correct


# ─── identify pool ────────────────────────────────────────────────────────────

def _build_identify_options(word, rng):
    """select_all: which of five operations on `word` return a NEW string
    rather than modifying the original -- mirrors the static bank's own
    question exactly, with the same "direct assignment" trap option.

    `.replace('a','b')` deliberately has no space after its internal
    comma: every select_all kind across this whole engine family
    serialises its correct-answer set as `", ".join(sorted(key))`, and the
    client parses it back with `.split(", ")` (see PracticeEngine.jsx's
    ChoiceList) -- a comma-space sequence *inside* one option's own text
    collides with that delimiter and corrupts the parse, showing the
    wrong options highlighted as correct after grading. Caught by
    generating at scale and checking the parsed-back set actually matched
    what was graded, the same way looping/comparison's reproducibility
    bugs were caught.
    """
    i = rng.randint(0, len(word) - 1)
    a = rng.randint(0, max(0, len(word) - 3))
    b = min(a + 2, len(word))
    candidates = [
        (f'{word!r}.upper()', True),
        (f"{word!r}.replace('a','b')", True),
        (f'{word!r}[{a}:{b}]', True),
        (f"{word!r}[{i}] = 'Z'  (direct assignment)", False),
    ]
    rng.shuffle(candidates)
    texts = [t for t, _ in candidates]
    correct = [t for t, ok in candidates if ok]
    return texts, correct


# ─── write_code ─────────────────────────────────────────────────────────────

_CODE_STARTER = "# `word` is already defined for you.\n"
_CODE_TEST_RUNS = 3


def _code_test_words(rng):
    pool = rng.sample(_WORDS, min(_CODE_TEST_RUNS, len(_WORDS)))
    return pool


def _grade_write_code(task_key, rng, code):
    task = tpl.CODE_TASKS.get(task_key)
    if task is None:
        return {"correct": False, "detail": ""}

    submitted = (code or "").strip()
    if not submitted:
        return {"correct": False, "detail": "You didn't write any code yet."}

    for test_word in _code_test_words(rng):
        expected = task["spec"](test_word)
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
                    f'With word = {test_word!r} your code printed '
                    f'{actual!r} but should print {expected!r}.'
                ),
            }

    return {"correct": True, "detail": ""}


# ─── generation ─────────────────────────────────────────────────────────────

def _base_payload(tier, nonce, fmt, kind):
    return {"t": tier, "n": nonce, "ts": int(time.time()), "f": fmt, "q": kind}


def _generate_code(tier, rng):
    keys = tpl.code_tasks_for_tier(tier)
    if not keys:
        return None
    task_key = rng.choice(keys)
    task = tpl.CODE_TASKS[task_key]
    nonce = rng.getrandbits(32)

    payload = _base_payload(tier, nonce, FORMAT_WRITE_CODE, KIND_CODE)
    payload.update({"k": task_key})

    samples = _code_test_words(random.Random(nonce ^ 0x5EED))[:2]
    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_WRITE_CODE,
        "kind": KIND_CODE,
        "template": task_key,
        "band": task["band"],
        "prompt": f'Write code that will {task["statement"]}.',
        "starter_code": _CODE_STARTER,
        "examples": [{"word": w, "output": task["spec"](w)} for w in samples],
    }


def _generate_predict(tier, rng, weak):
    picked = _pick_scenario(tier, rng, weak)
    if picked is None:
        return None
    template, scenario = picked
    nonce = rng.getrandbits(32)
    options, correct = _predict_options(scenario, random.Random(nonce))

    payload = _base_payload(tier, nonce, FORMAT_MCQ, KIND_PREDICT)
    payload.update({"result": correct, "tp": template.id})

    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_MCQ,
        "kind": KIND_PREDICT,
        "template": template.id,
        "band": template.band,
        "prompt": f"What happens when the following code runs?\n{scenario.source}",
        "options": options,
    }


def _generate_fix(tier, rng, weak):
    picked = _pick_scenario(tier, rng, weak, predicate=lambda s: s.reassigned is False and not s.raises)
    if picked is None:
        return None
    template, scenario = picked
    nonce = rng.getrandbits(32)
    correct_line = f"{scenario.name} = {scenario.name}.{scenario.method}()"

    payload = _base_payload(tier, nonce, FORMAT_FILL_BLANK, KIND_FIX)
    payload.update({"result": correct_line, "tp": template.id})

    numbered = "\n".join(f"Line {i + 1}: {line}" for i, line in enumerate(scenario.lines))
    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_FILL_BLANK,
        "kind": KIND_FIX,
        "template": template.id,
        "band": template.band,
        "prompt": (
            "Fix the broken code below so that it actually reassigns "
            f"{scenario.name}. Reply with the corrected line that replaces line 2.\n{numbered}"
        ),
        "answer_label": "corrected line",
    }


def _generate_identify(tier, rng, weak):
    word = rng.choice(_WORDS)
    nonce = rng.getrandbits(32)
    texts, correct = _build_identify_options(word, random.Random(nonce))

    payload = _base_payload(tier, nonce, FORMAT_SELECT_ALL, KIND_IDENTIFY)
    payload.update({"tp": "identify_pool", "w": word})

    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_SELECT_ALL,
        "kind": KIND_IDENTIFY,
        "template": "identify_pool",
        "band": tpl.BAND_MEDIUM,
        "prompt": (
            f'word = "{word}"\n'
            "Select every operation below that returns a NEW string, "
            "rather than modifying the original."
        ),
        "options": texts,
    }


_KIND_BUILDERS = {
    KIND_PREDICT: _generate_predict,
    KIND_FIX: _generate_fix,
    KIND_IDENTIFY: _generate_identify,
}


def generate(tier: int = 1, seed=None, weak=None) -> dict:
    tier = max(1, min(MAX_TIER, int(tier)))
    rng = random.Random(seed) if seed is not None else random.Random()
    weak = weak if isinstance(weak, (set, frozenset)) else parse_weak_concepts(weak)

    kinds = list(_TIER_KINDS[tier])
    rng.shuffle(kinds)

    for kind in kinds[:4]:
        if kind == KIND_CODE:
            question = _generate_code(tier, rng)
        else:
            question = _KIND_BUILDERS[kind](tier, rng, weak)
        if question is not None:
            return question

    return _generate_predict(tier, rng, weak)


def parse_weak_concepts(raw):
    return core.parse_weak_concepts(raw, {t.concept for t in tpl.TEMPLATES})


# ─── grading ────────────────────────────────────────────────────────────────

def grade(token: str, submission: "dict | str") -> dict:
    try:
        payload = core.verify(token)
    except core.InvalidToken as exc:
        return {"ok": False, "error": str(exc)}

    if not isinstance(submission, dict):
        submission = {"answer": submission}

    tier = payload.get("t", 1)
    fmt = payload.get("f", FORMAT_MCQ)
    kind = payload.get("q", KIND_PREDICT)
    template_id = payload.get("tp", "")
    concept = tpl.BY_ID[template_id].concept if template_id in tpl.BY_ID else None

    def verdict(is_correct, correct_answer, misconception_id=None, detail=""):
        return {
            "ok": True,
            "correct": is_correct,
            "correct_answer": correct_answer,
            "misconception_id": misconception_id or (None if is_correct else concept),
            "stars_awarded": tier if is_correct else 0,
            "tier": tier,
            "format": fmt,
            "kind": kind,
            "concept": concept,
            "detail": detail,
        }

    if kind == KIND_CODE:
        task_key = payload.get("k", "")
        task = tpl.CODE_TASKS.get(task_key)
        outcome = _grade_write_code(task_key, random.Random(payload["n"]), submission.get("code", ""))
        statement = task["statement"] if task else ""
        return verdict(
            outcome["correct"], f"code that will {statement}" if statement else "",
            None, outcome["detail"],
        )

    if kind == KIND_IDENTIFY:
        seeded = random.Random(payload["n"])
        word = payload.get("w", "")
        texts, correct = _build_identify_options(word, seeded)
        submitted = {a for a in (submission.get("answers") or []) if a in texts}
        return verdict(submitted == set(correct), ", ".join(sorted(correct)))

    # predict and fix both just compare against the stored correct text --
    # both are whole-sentence/whole-line answers computed once at
    # generation time, not re-derived (see comparison_engine's own reasons
    # for preferring that where the answer isn't a single reproducible
    # value).
    correct_answer = payload.get("result", "")
    raw = submission.get("answer")
    submitted = str(raw or "") if fmt == FORMAT_MCQ else str(raw or "").strip()
    return verdict(submitted == correct_answer, correct_answer)
