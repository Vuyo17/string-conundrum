"""Procedural, unlimited-question engine for the Comparison module's endless
Practice mode.

Fourth module on this pattern (see slicing_engine.py's docstring for the
shared idea). Comparison's own shape: a question is built around one
`==`/`!=`/`<`/`>`/`<=`/`>=` expression over two operands (two strings, or a
string and a number -- see comparison_templates.py for why that needed its
own lightweight template class rather than practice_engine_core.py's
single-entry Template), evaluated for real by comparison_templates.py so
this file never re-implements what those operators do.
"""
import random
import time

from . import comparison_templates as tpl
from . import corpus
from . import practice_engine_core as core
from .sandbox import run_for_grading

MAX_TIER = 5
InvalidToken = core.InvalidToken

FORMAT_MCQ = "mcq"
FORMAT_FILL_BLANK = "fill_blank"
FORMAT_SELECT_ALL = "select_all"
FORMAT_WRITE_CODE = "write_code"

KIND_EVALUATE = "evaluate"    # what does this comparison evaluate to?
KIND_IDENTIFY = "identify"    # which of these evaluate to True?
KIND_ERROR = "error"          # which of these raise a TypeError?
KIND_CODE = "code"            # write it yourself

_KIND_FORMATS = {
    KIND_EVALUATE: (FORMAT_MCQ, FORMAT_FILL_BLANK),
    KIND_IDENTIFY: (FORMAT_SELECT_ALL,),
    KIND_ERROR: (FORMAT_SELECT_ALL,),
    KIND_CODE: (FORMAT_WRITE_CODE,),
}

_TIER_KINDS = {
    1: (KIND_EVALUATE, KIND_EVALUATE, KIND_EVALUATE),
    2: (KIND_EVALUATE, KIND_EVALUATE, KIND_IDENTIFY),
    3: (KIND_EVALUATE, KIND_IDENTIFY, KIND_IDENTIFY),
    4: (KIND_EVALUATE, KIND_IDENTIFY, KIND_ERROR, KIND_CODE),
    5: (KIND_IDENTIFY, KIND_ERROR, KIND_CODE, KIND_CODE),
}

_MAX_MCQ_TIER = 3
_WEAK_CONCEPT_WEIGHT = 4

_WORDS = corpus.load_words()


def _weighted_templates(templates, weak):
    return core.weighted_templates(templates, weak, weight=_WEAK_CONCEPT_WEIGHT)


def _pick_comparison(tier, rng, weak):
    candidates = tpl.for_tier(tier)
    weighted = _weighted_templates(candidates, weak)
    for _ in range(60):
        template = rng.choice(weighted)
        comp = template.build(_WORDS, rng)
        if comp is None:
            continue
        return template, comp
    return None


def _pick_format(kind, tier, rng):
    formats = [
        f for f in _KIND_FORMATS[kind]
        if not (f == FORMAT_MCQ and tier > _MAX_MCQ_TIER)
    ]
    return rng.choice(formats or list(_KIND_FORMATS[kind]))


# ─── evaluate distractors ─────────────────────────────────────────────────────

def _evaluate_options(comp, rng):
    """Up to four candidate answers: the real one, plus what a learner
    holding one of this module's three real misconceptions would expect
    instead -- 'the other boolean', 'it must be a TypeError', or (for an
    orderable operator) 'strings can't be compared that way' at all."""
    if comp.raises:
        correct = "TypeError"
        pool = ["True", "False"]
    else:
        correct = str(comp.result)
        pool = ["False" if comp.result else "True", "TypeError"]
        if comp.op in ("<", ">", "<=", ">="):
            pool.append(f"Cannot compare strings with {comp.op}")
    rng.shuffle(pool)
    options = [correct] + pool[:3]
    rng.shuffle(options)
    return options


# ─── identify / error pools ───────────────────────────────────────────────────

def _draw_pool(tier, rng, weak, size=5):
    """`size` independent comparisons (not variants of one), for the two
    select_all kinds. Reused across generation and grading via the same
    seeded rng, the same way slicing/indexing's *_build_select_all
    reconstructs its own candidate list from the token's nonce."""
    candidates = tpl.for_tier(tier)
    weighted = _weighted_templates(candidates, weak)
    pool = []
    seen_exprs = set()
    attempts = 0
    while len(pool) < size and attempts < 60:
        attempts += 1
        template = rng.choice(weighted)
        comp = template.build(_WORDS, rng)
        if comp is None:
            continue
        if comp.expression in seen_exprs:
            continue
        seen_exprs.add(comp.expression)
        pool.append(comp)
    return pool


def _build_identify_options(tier, rng, weak):
    pool = _draw_pool(tier, rng, weak)
    non_raising = [c for c in pool if not c.raises]
    true_ones = [c.expression for c in non_raising if c.result is True]
    false_ones = [c.expression for c in non_raising if c.result is False]
    if not true_ones or not false_ones:
        return None
    texts = [c.expression for c in non_raising]
    return texts, true_ones


def _build_error_options(tier, rng, weak):
    pool = _draw_pool(tier, rng, weak)
    raising = [c.expression for c in pool if c.raises]
    safe = [c.expression for c in pool if not c.raises]
    if not raising or not safe:
        return None
    texts = [c.expression for c in pool]
    return texts, raising


# ─── write_code ─────────────────────────────────────────────────────────────

_CODE_STARTER = "# `word1` and `word2` are already defined for you.\n"
_CODE_TEST_RUNS = 3


def _code_test_pairs(rng, task_key):
    """Three (word1, word2) pairs for grading, deliberately mixing
    same-word/different-case pairs in with distinct ones: a task like
    "are these equal ignoring case" would otherwise be satisfiable by a
    hardcoded `print(False)`, since two random distinct words are almost
    never equal to begin with -- the same defence slicing/indexing's own
    code-task testing gets from varying word length instead."""
    pool = rng.sample(_WORDS, min(6, len(_WORDS)))
    pairs = []
    if task_key == "case_insensitive_equal":
        w = pool[0]
        pairs.append((w, w.upper()))
        pairs.append((pool[1], pool[1]))
        pairs.append((pool[2], pool[3]))
    else:
        pairs = [(pool[0], pool[1]), (pool[2], pool[3]), (pool[4], pool[5])]
    return pairs[:_CODE_TEST_RUNS]


def _grade_write_code(task_key, rng, code):
    task = tpl.CODE_TASKS.get(task_key)
    if task is None:
        return {"correct": False, "detail": ""}

    submitted = (code or "").strip()
    if not submitted:
        return {"correct": False, "detail": "You didn't write any code yet."}

    for w1, w2 in _code_test_pairs(rng, task_key):
        expected = task["spec"](w1, w2)
        run = run_for_grading(f"word1 = {w1!r}\nword2 = {w2!r}\n{submitted}\n")

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
                    f'With word1 = "{w1}" and word2 = "{w2}" your code printed '
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

    samples = _code_test_pairs(random.Random(nonce ^ 0x5EED), task_key)[:2]
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
        "examples": [{"word": f"{w1!r}, {w2!r}", "output": task["spec"](w1, w2)} for w1, w2 in samples],
    }


def _generate_evaluate(tier, rng, weak):
    picked = _pick_comparison(tier, rng, weak)
    if picked is None:
        return None
    template, comp = picked
    nonce = rng.getrandbits(32)
    fmt = _pick_format(KIND_EVALUATE, tier, rng)

    payload = _base_payload(tier, nonce, fmt, KIND_EVALUATE)
    payload.update({
        "expr": comp.expression,
        "result": ("raises" if comp.raises else str(comp.result)),
        "tp": template.id,
    })

    question = {
        "tier": tier,
        "stars": tier,
        "type": fmt,
        "kind": KIND_EVALUATE,
        "template": template.id,
        "band": template.band,
        "prompt": (
            f"What does `{comp.expression}` evaluate to?" if fmt == FORMAT_MCQ
            else f"Type the exact result of `{comp.expression}` (True, False, or TypeError)."
        ),
    }
    if fmt == FORMAT_MCQ:
        question["options"] = _evaluate_options(comp, random.Random(nonce))
    question["token"] = core.sign(payload)
    return question


def _generate_identify(tier, rng, weak):
    nonce = rng.getrandbits(32)
    built = _build_identify_options(tier, random.Random(nonce), weak)
    if built is None:
        return None
    payload = _base_payload(tier, nonce, FORMAT_SELECT_ALL, KIND_IDENTIFY)
    # _draw_pool's template choices depend on `weak` (it changes which
    # templates are repeated in the list rng.choice draws from, which
    # shifts what the *same* rng seed picks even at the same call site --
    # the same reproducibility trap looping_engine's Loop objects avoid by
    # storing their computed lines directly). The pool itself is cheap to
    # re-derive from the seed as long as `weak` is stored alongside it, so
    # grading passes the same weak set back in rather than assuming empty.
    payload.update({"tp": "identify_pool", "weak": sorted(weak)})
    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_SELECT_ALL,
        "kind": KIND_IDENTIFY,
        "template": "identify_pool",
        "band": tpl.BAND_MEDIUM,
        "prompt": "Select every expression below that evaluates to True.",
        "options": built[0],
    }


def _generate_error(tier, rng, weak):
    nonce = rng.getrandbits(32)
    built = _build_error_options(tier, random.Random(nonce), weak)
    if built is None:
        return None
    payload = _base_payload(tier, nonce, FORMAT_SELECT_ALL, KIND_ERROR)
    payload.update({"tp": "error_pool", "weak": sorted(weak)})
    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_SELECT_ALL,
        "kind": KIND_ERROR,
        "template": "error_pool",
        "band": tpl.BAND_HARD,
        "prompt": "Select every expression below that raises a TypeError.",
        "options": built[0],
    }


_KIND_BUILDERS = {
    KIND_EVALUATE: _generate_evaluate,
    KIND_IDENTIFY: _generate_identify,
    KIND_ERROR: _generate_error,
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

    return _generate_evaluate(tier, rng, weak)


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
    kind = payload.get("q", KIND_EVALUATE)
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

    if kind in (KIND_IDENTIFY, KIND_ERROR):
        seeded = random.Random(payload["n"])
        # Must match generation exactly: _draw_pool's template choices
        # depend on `weak` (see _generate_identify's comment), so the
        # weak set from the token, not an assumed-empty one, has to be
        # threaded back in for the seed to reproduce the same pool.
        weak = set(payload.get("weak") or [])
        if kind == KIND_IDENTIFY:
            built = _build_identify_options(tier, seeded, weak)
        else:
            built = _build_error_options(tier, seeded, weak)
        if built is None:
            return {"ok": False, "error": "question could not be regenerated"}
        offered, key = built[0], built[1]
        submitted = {a for a in (submission.get("answers") or []) if a in offered}
        return verdict(submitted == set(key), ", ".join(sorted(key)))

    # evaluate
    correct_answer = payload.get("result", "")
    raw = submission.get("answer")
    submitted = str(raw or "") if fmt == FORMAT_MCQ else str(raw or "").strip()
    normalised_correct = "TypeError" if correct_answer == "raises" else correct_answer
    return verdict(submitted == normalised_correct, normalised_correct)
