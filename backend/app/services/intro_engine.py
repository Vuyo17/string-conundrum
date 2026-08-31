"""Procedural, unlimited-question engine for the Intro module's endless
Practice mode.

Eighth and last module on this pattern (see slicing_engine.py's docstring
for the shared idea). Intro's own shape is deliberately different from
every other module here -- see intro_templates.py's docstring for why and
how KIND_LITERAL/KIND_UNQUOTED decide correctness by literally exec()ing
each candidate rather than asserting it.
"""
import random
import time

from . import corpus
from . import intro_templates as tpl
from . import practice_engine_core as core
from .sandbox import run_for_grading

MAX_TIER = 5
InvalidToken = core.InvalidToken

FORMAT_MCQ = "mcq"
FORMAT_FILL_BLANK = "fill_blank"
FORMAT_SELECT_ALL = "select_all"
FORMAT_WRITE_CODE = "write_code"

KIND_EVALUATE = "evaluate"  # what does this operation print?
KIND_LITERAL = "literal"    # which expressions really build the string X?
KIND_UNQUOTED = "unquoted"  # which assignment line actually works?
KIND_CODE = "code"          # write it yourself

_KIND_FORMATS = {
    KIND_EVALUATE: (FORMAT_MCQ, FORMAT_FILL_BLANK),
    KIND_LITERAL: (FORMAT_SELECT_ALL,),
    KIND_UNQUOTED: (FORMAT_MCQ,),
    KIND_CODE: (FORMAT_WRITE_CODE,),
}

_TIER_KINDS = {
    1: (KIND_EVALUATE, KIND_EVALUATE, KIND_UNQUOTED),
    2: (KIND_EVALUATE, KIND_UNQUOTED, KIND_LITERAL),
    3: (KIND_EVALUATE, KIND_EVALUATE, KIND_LITERAL),
    4: (KIND_EVALUATE, KIND_LITERAL, KIND_CODE),
    5: (KIND_EVALUATE, KIND_CODE, KIND_CODE),
}

_MAX_MCQ_TIER = 3
_WEAK_CONCEPT_WEIGHT = 4

_WORDS = corpus.load_words()


def _weighted_templates(templates, weak):
    return core.weighted_templates(templates, weak, weight=_WEAK_CONCEPT_WEIGHT)


def _pick_case(tier, rng, weak):
    candidates = tpl.for_tier(tier)
    weighted = _weighted_templates(candidates, weak)
    for _ in range(60):
        template = rng.choice(weighted)
        case = template.build(_WORDS, rng)
        if case is not None:
            return template, case
    return None


def _pick_format(kind, tier, rng):
    formats = [
        f for f in _KIND_FORMATS[kind]
        if not (f == FORMAT_MCQ and tier > _MAX_MCQ_TIER)
    ]
    return rng.choice(formats or list(_KIND_FORMATS[kind]))


# ─── evaluate distractors ─────────────────────────────────────────────────────

def _evaluate_options(template, case, rng):
    """Up to four candidate answers: the real one, plus what a learner
    holding the misconception this template is tagged with would expect
    instead."""
    if case.raises:
        return None  # KIND_EVALUATE never offers mcq for the raising case

    correct = case.printed
    pool = []

    if template.concept == tpl.C_CONCAT_SPACE:
        pool.append(correct[: len(correct) // 2] + " " + correct[len(correct) // 2 :])

    if template.concept == tpl.C_REPEAT_CONFUSION:
        w, n = case.meta["word"], case.meta["n"]
        pool.append(f"{w}{n}")  # "the number just gets appended" belief

    if template.concept in (tpl.C_LENGTH, tpl.C_ESCAPE_SEQUENCE):
        n = int(correct)
        pool.append(str(n + 1))  # an escape sequence (or the quotes) miscounted as extra chars
        pool.append(str(n - 1))

    if not pool:
        pool = [correct[::-1] if correct else "?", correct.upper() if correct.isalpha() else correct + "?"]

    seen = {correct}
    distractors = []
    for candidate in pool:
        if candidate in seen:
            continue
        seen.add(candidate)
        distractors.append(candidate)
    rng.shuffle(distractors)

    options = [correct] + distractors[:3]
    guard = 0
    while len(options) < 4 and guard < 20:
        guard += 1
        picked = _pick_case(3, rng, set())
        if picked is None:
            break
        _, filler = picked
        if filler.raises:
            continue
        candidate = filler.printed
        if candidate not in seen:
            seen.add(candidate)
            options.append(candidate)
    rng.shuffle(options)
    return options


# ─── worked explanation (evaluate, correct or wrong) ────────────────────────
# One branch per template rather than one universal walk: unlike
# slicing/indexing's single index-resolution rule, six genuinely different
# operations (concatenation, repetition, length, ord()/chr(), a raised
# TypeError) don't reduce to one mechanic -- but every branch is still
# built from the scenario's own real, already-computed values, never a
# hand-simulated re-derivation of what the operation does.

def _build_intro_explanation(template_id, source, printed, meta, raises, exc_name):
    blocks = [{"kind": "code", "code": source}]

    if raises:
        blocks.append({
            "kind": "p",
            "text": (
                f"`+` between a `str` and an `int` raises a real **{exc_name}** -- "
                "Python never silently converts one to the other."
            ),
        })
        blocks.append({
            "kind": "callout",
            "tone": "warn",
            "title": "Key rule to remember",
            "text": 'Convert first: `"Score: " + str(10)`, not `"Score: " + 10`.',
        })
        return blocks

    if template_id == "concat":
        blocks.append({
            "kind": "p",
            "text": "`+` joins the two strings exactly as they are -- no space is ever inserted between them.",
        })
        blocks.append({
            "kind": "callout",
            "tone": "define",
            "title": "Key rule to remember",
            "text": 'If you want a space, you have to add it yourself: `a + " " + b`.',
        })

    elif template_id == "repeat":
        word, n = meta.get("word", ""), meta.get("n", 0)
        blocks.append({
            "kind": "p",
            "text": f"`*` repeats the string, back to back, exactly **{n}** times -- it never does arithmetic on the text.",
        })
        if word and n:
            blocks.append({"kind": "code", "code": f"{' + '.join([word] * n)} = {printed!r}"})
        blocks.append({
            "kind": "callout",
            "tone": "define",
            "title": "Key rule to remember",
            "text": '`"ab" * 3` builds `"ababab"` -- the number 3 never appears anywhere in the result.',
        })

    elif template_id == "length_plain":
        blocks.append({
            "kind": "p",
            "text": f"`len()` counts every character in the string, one by one -- here that's **{printed}**.",
        })
        blocks.append({
            "kind": "callout",
            "tone": "define",
            "title": "Key rule to remember",
            "text": "`len()` counts characters, not words -- every letter, digit, space and symbol counts as exactly one.",
        })

    elif template_id == "length_escape":
        blocks.append({
            "kind": "p",
            "text": (
                "`\\n` is a single newline character, not two -- it looks like a "
                "backslash and an \"n\" in the source code, but Python turns it into "
                "one character while reading the string literal."
            ),
        })
        blocks.append({
            "kind": "callout",
            "tone": "warn",
            "title": "Key rule to remember",
            "text": f"`len()` counts the *stored* characters, not the source code's symbols -- here that's **{printed}**.",
        })

    elif template_id == "ord_shift":
        blocks.append({
            "kind": "p",
            "text": (
                "The computer never stores letters -- it stores numbers. `ord()` "
                "looks up a character's Unicode number, arithmetic shifts that "
                "number, and `chr()` converts it back to a character."
            ),
        })
        blocks.append({
            "kind": "callout",
            "tone": "define",
            "title": "Key rule to remember",
            "text": "`chr(ord(ch) + n)` moves a character forward by `n` places in the alphabet -- the same idea behind every classic cypher exercise.",
        })

    else:
        blocks.append({"kind": "p", "text": f"This evaluates to {printed!r}."})

    return blocks


# ─── write_code ─────────────────────────────────────────────────────────────

_CODE_STARTER = "# `word` is already defined for you.\n"
_CODE_TEST_RUNS = 3


def _code_test_words(rng):
    return rng.sample(_WORDS, min(_CODE_TEST_RUNS, len(_WORDS)))


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


def _generate_evaluate(tier, rng, weak):
    picked = _pick_case(tier, rng, weak)
    if picked is None:
        return None
    template, case = picked
    nonce = rng.getrandbits(32)
    fmt = FORMAT_FILL_BLANK if case.raises else _pick_format(KIND_EVALUATE, tier, rng)

    payload = _base_payload(tier, nonce, fmt, KIND_EVALUATE)
    # `src`/`meta` stored directly rather than regenerated later -- the
    # same reproducibility hazard looping_engine.py's Loop.lines is stored
    # directly to avoid (see its own comment for the full reasoning).
    payload.update({
        "result": ("raises" if case.raises else case.printed), "tp": template.id,
        "src": case.source, "meta": case.meta,
    })

    question = {
        "tier": tier,
        "stars": tier,
        "type": fmt,
        "kind": KIND_EVALUATE,
        "template": template.id,
        "band": template.band,
        "prompt": f"What does the following code print?\n{case.source}",
    }
    if fmt == FORMAT_MCQ:
        question["options"] = _evaluate_options(template, case, random.Random(nonce))
    else:
        question["answer_label"] = "printed output"
        # A single-line <input> has nowhere for Enter to put a newline --
        # length_escape's own source shows "\n" as literal text, but its
        # printed answer is always a plain number, so this only ever
        # matters if a future template's printed value spans lines.
        if not case.raises and "\n" in case.printed:
            question["multiline"] = True
    question["token"] = core.sign(payload)
    return question


def _generate_literal(tier, rng, weak):
    nonce = rng.getrandbits(32)
    candidates, correct, word = tpl.build_literal_options(_WORDS, random.Random(nonce))
    if not correct:
        return None

    payload = _base_payload(tier, nonce, FORMAT_SELECT_ALL, KIND_LITERAL)
    payload.update({"tp": "literal_pool"})

    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_SELECT_ALL,
        "kind": KIND_LITERAL,
        "template": "literal_pool",
        "band": tpl.BAND_EASY_MEDIUM,
        "prompt": f'Select every expression below that creates the string "{word}".',
        "options": candidates,
    }


def _generate_unquoted(tier, rng, weak):
    nonce = rng.getrandbits(32)
    candidates, correct, word = tpl.build_unquoted_options(_WORDS, random.Random(nonce))
    if len(correct) != 1:
        return None

    payload = _base_payload(tier, nonce, FORMAT_MCQ, KIND_UNQUOTED)
    payload.update({"tp": "unquoted_pool"})

    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_MCQ,
        "kind": KIND_UNQUOTED,
        "template": "unquoted_pool",
        "band": tpl.BAND_EASY,
        "prompt": f"Which of the following correctly creates a string variable holding {word}?",
        "options": candidates,
    }


_KIND_BUILDERS = {
    KIND_EVALUATE: _generate_evaluate,
    KIND_LITERAL: _generate_literal,
    KIND_UNQUOTED: _generate_unquoted,
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

    def verdict(is_correct, correct_answer, misconception_id=None, detail="", explanation_blocks=None):
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
            "explanation_blocks": explanation_blocks,
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

    if kind == KIND_LITERAL:
        seeded = random.Random(payload["n"])
        candidates, correct, _word = tpl.build_literal_options(_WORDS, seeded)
        submitted = {a for a in (submission.get("answers") or []) if a in candidates}
        return verdict(submitted == set(correct), ", ".join(sorted(correct)), tpl.C_LIST_CONFUSION)

    if kind == KIND_UNQUOTED:
        seeded = random.Random(payload["n"])
        candidates, correct, _word = tpl.build_unquoted_options(_WORDS, seeded)
        submitted = str(submission.get("answer") or "")
        correct_answer = correct[0] if correct else ""
        return verdict(submitted == correct_answer, correct_answer, tpl.C_QUOTES)

    # evaluate: compare against the stored real value (or "TypeError").
    correct_answer = payload.get("result", "")
    raises = correct_answer == "raises"
    normalised_correct = "TypeError" if raises else correct_answer
    raw = submission.get("answer")
    submitted = str(raw or "") if fmt == FORMAT_MCQ else str(raw or "").strip()

    explanation_blocks = None
    if "src" in payload:
        explanation_blocks = _build_intro_explanation(
            template_id, payload["src"], None if raises else correct_answer,
            payload.get("meta") or {}, raises, "TypeError" if raises else None,
        )
    return verdict(submitted == normalised_correct, normalised_correct, explanation_blocks=explanation_blocks)
