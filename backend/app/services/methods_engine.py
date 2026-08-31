"""Procedural, unlimited-question engine for the Methods module's endless
Practice mode.

Fifth module on this pattern (see slicing_engine.py's docstring for the
shared idea). Methods' own shape: a question is built around one string
method call -- `"banana".count("a")` -- evaluated for real by
methods_templates.py (see that module's docstring), covering the three
real misconceptions the static bank already names: strip_only_removes_
one_char, count_overlap_confusion, and count_vs_find_confusion.
"""
import random
import time

from . import corpus
from . import methods_templates as tpl
from . import practice_engine_core as core
from .sandbox import run_for_grading

MAX_TIER = 5
InvalidToken = core.InvalidToken

FORMAT_MCQ = "mcq"
FORMAT_FILL_BLANK = "fill_blank"
FORMAT_SELECT_ALL = "select_all"
FORMAT_WRITE_CODE = "write_code"

KIND_EVALUATE = "evaluate"    # what does this method call return?
KIND_IDENTIFY = "identify"    # which of these correctly find the position of X?
KIND_ERROR = "error"          # which of these raise an error?
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


def _pick_call(tier, rng, weak):
    candidates = tpl.for_tier(tier)
    weighted = _weighted_templates(candidates, weak)
    for _ in range(60):
        template = rng.choice(weighted)
        mc = template.build(_WORDS, rng)
        if mc is None:
            continue
        return template, mc
    return None


def _pick_format(kind, tier, rng):
    formats = [
        f for f in _KIND_FORMATS[kind]
        if not (f == FORMAT_MCQ and tier > _MAX_MCQ_TIER)
    ]
    return rng.choice(formats or list(_KIND_FORMATS[kind]))


def _render(value):
    """How a method call's result appears in a prompt/answer: a string
    result is repr()-quoted so leading/trailing whitespace stays visible
    (exactly why the static bank's own strip() question uses repr in its
    prompt); anything else (int, bool) renders as plain text."""
    return repr(value) if isinstance(value, str) else str(value)


# ─── evaluate distractors ─────────────────────────────────────────────────────

def _evaluate_options(template, mc, rng):
    """Up to four candidate answers, built from whichever of the three
    real misconceptions this template's own concept names -- the
    off-by-one-character strip, the overlap-blind count, or the position-
    vs-count confusion -- plus a generic numeric/boolean fallback so every
    template still gets a full option set even where a concept-specific
    distractor isn't a clean fit (a plain .upper()/.lower() call, say)."""
    if mc.raises:
        correct = mc.exc_name
        pool = ["-1", "None", "0"]
        rng.shuffle(pool)
        options = [correct] + pool[:3]
        rng.shuffle(options)
        return options

    correct = _render(mc.result)
    pool = []

    if template.concept == tpl.C_STRIP and isinstance(mc.result, str):
        one_each_end = mc.word[1:-1] if len(mc.word) > 2 else mc.word
        pool.append(_render(one_each_end))
        pool.append(_render(mc.word))  # "strip does nothing" misreading

    if isinstance(mc.result, int) and not isinstance(mc.result, bool):
        pool.append(str(mc.result + 1))
        pool.append(str(max(0, mc.result - 1)))
        if template.concept == tpl.C_COUNT_VS_FIND and mc.result >= 0:
            # The position-vs-count mixup: offering the *other* method's
            # answer shape as a plausible wrong pick.
            pool.append("1" if mc.result != 1 else "2")

    if isinstance(mc.result, bool):
        pool.append(str(not mc.result))

    if not pool:
        pool = [_render(mc.word), "None"]

    seen = {correct}
    distractors = []
    for candidate in pool:
        if candidate in seen:
            continue
        seen.add(candidate)
        distractors.append(candidate)
    rng.shuffle(distractors)

    options = [correct] + distractors[:3]
    rng.shuffle(options)
    return options


# ─── worked explanation (evaluate, correct or wrong) ────────────────────────
# Grouped by method family rather than one universal walk (unlike
# slicing/indexing's single index-resolution rule, nine different string
# methods genuinely work nine different ways) -- but every family's
# highlighted positions and results are still real, computed matches
# (_find_all uses the exact non-overlapping scan str.count()/str.replace()
# themselves use), never hand-asserted.

def _find_all(word, sub):
    """Every non-overlapping match position of `sub` in `word`, found the
    same way str.count()/str.replace() themselves do -- advancing past the
    whole match rather than by one character -- so highlighting these
    positions is a real demonstration of the overlap rule, not just an
    illustration of it."""
    positions = []
    start = 0
    while True:
        idx = word.find(sub, start)
        if idx == -1:
            break
        positions.append(idx)
        start = idx + len(sub)
    return positions


def _method_quoted(text):
    return f'"{text}"' if text else '"" (the empty string)'


def _build_method_explanation(word, method_name, args, result, raises, exc_name):
    if raises:
        sub = args[0] if args else ""
        return [
            {
                "kind": "string",
                "value": word,
                "highlight": [],
                "caption": f'`"{sub}"` does not occur anywhere in `"{word}"`.',
            },
            {
                "kind": "p",
                "text": (
                    f'`.index("{sub}")` raises **{exc_name}** when the substring '
                    "isn't found -- unlike `.find()`, which returns **-1** instead "
                    "of raising."
                ),
            },
            {
                "kind": "callout",
                "tone": "warn",
                "title": "Key rule to remember",
                "text": (
                    "`.find()` is the safe search (returns -1 on failure); "
                    "`.index()` is the strict one (raises `ValueError` on failure). "
                    "Pick the one that matches how you plan to handle 'not found'."
                ),
            },
        ]

    if method_name in ("upper", "lower"):
        verb = "uppercase" if method_name == "upper" else "lowercase"
        return [
            {"kind": "code", "code": f'"{word}".{method_name}() = {_method_quoted(result)}'},
            {
                "kind": "p",
                "text": f"`.{method_name}()` builds a new string with every letter converted to {verb}; anything that isn't a letter is left exactly as it was.",
            },
            {
                "kind": "callout",
                "tone": "define",
                "title": "Key rule to remember",
                "text": f"`.{method_name}()` returns a **new** string -- `{word!r}` itself is never changed.",
            },
        ]

    if method_name == "strip":
        # The kept range is wherever word.strip()'s own real output starts
        # and ends inside the original -- found the real way, not by
        # hand-walking whitespace rules.
        core_text = word.strip()
        start = word.find(core_text) if core_text else len(word)
        kept = list(range(start, start + len(core_text)))
        return [
            {
                "kind": "string",
                "value": word,
                "highlight": kept,
                "caption": "Highlighted characters are what `.strip()` keeps; the rest (whitespace) is removed.",
            },
            {
                "kind": "p",
                "text": '`.strip()` removes whitespace from **both ends**, and keeps removing it until it reaches a non-whitespace character -- not just one space from each side.',
            },
            {"kind": "code", "code": f'"{word}".strip() = {_method_quoted(result)}'},
            {
                "kind": "callout",
                "tone": "define",
                "title": "Key rule to remember",
                "text": "`.strip()` never touches whitespace **inside** the string, only leading and trailing.",
            },
        ]

    if method_name == "replace":
        target, replacement = args[0], args[1]
        positions = _find_all(word, target)
        highlight = [i + off for i in positions for off in range(len(target))]
        return [
            {
                "kind": "string",
                "value": word,
                "highlight": highlight,
                "caption": f'Every highlighted `"{target}"` is replaced with `"{replacement}"`.',
            },
            {"kind": "code", "code": f'"{word}".replace("{target}","{replacement}") = {_method_quoted(result)}'},
            {
                "kind": "callout",
                "tone": "define",
                "title": "Key rule to remember",
                "text": '`.replace()` swaps **every** occurrence by default, not just the first -- and, like every string method, it returns a new string rather than changing the original.',
            },
        ]

    if method_name == "count":
        sub = args[0]
        positions = _find_all(word, sub)
        highlight = [i + off for i in positions for off in range(len(sub))]
        blocks = [
            {
                "kind": "string",
                "value": word,
                "highlight": highlight,
                "caption": f'Every highlighted `"{sub}"` is one match — {len(positions)} in total.',
            },
            {"kind": "code", "code": f'"{word}".count("{sub}") = {result}'},
        ]
        if len(sub) > 1:
            blocks.append({
                "kind": "callout",
                "tone": "warn",
                "title": "Key rule to remember",
                "text": (
                    f'`.count()` does **not** count overlapping matches: once a match is found, '
                    f"it keeps looking *after* that whole match, not one character later. "
                    f'`"aaaa".count("aa")` is **2**, not 3.'
                ),
            })
        return blocks

    if method_name in ("startswith", "endswith"):
        target = args[0]
        n = len(target)
        highlight = list(range(0, n)) if method_name == "startswith" else list(range(len(word) - n, len(word)))
        return [
            {
                "kind": "string",
                "value": word,
                "highlight": highlight,
                "caption": f'The highlighted span is compared against `"{target}"`.',
            },
            {"kind": "code", "code": f'"{word}".{method_name}("{target}") = {result}'},
            {
                "kind": "callout",
                "tone": "define",
                "title": "Key rule to remember",
                "text": f'`.{method_name}()` checks the exact {"start" if method_name == "startswith" else "end"} of the string, case-sensitively -- nothing in between matters.',
            },
        ]

    if method_name in ("find", "index"):
        sub = args[0]
        position = word.find(sub)
        found = position != -1
        highlight = list(range(position, position + len(sub))) if found else []
        blocks = [
            {
                "kind": "string",
                "value": word,
                "highlight": highlight,
                "caption": (
                    f'The first match of `"{sub}"` starts at the highlighted position.'
                    if found else f'`"{sub}"` does not occur anywhere in `"{word}"`.'
                ),
            },
            {"kind": "code", "code": f'"{word}".{method_name}("{sub}") = {result}'},
        ]
        if not found:
            blocks.append({
                "kind": "callout",
                "tone": "define",
                "title": "Key rule to remember",
                "text": '`.find()` returns **-1** when nothing matches -- it never raises.',
            })
        else:
            blocks.append({
                "kind": "callout",
                "tone": "define",
                "title": "Key rule to remember",
                "text": "The result is the index of the **first** character of the match, counting from 0 -- same as any other index into the string.",
            })
        return blocks

    # No specific family matched (shouldn't happen for any real template,
    # but a plain code line is still an honest, correct fallback).
    return [{"kind": "code", "code": f'"{word}".{method_name}({", ".join(args)}) = {_method_quoted(result) if isinstance(result, str) else result}'}]


# ─── identify / error pools ───────────────────────────────────────────────────

def _draw_pool(tier, rng, weak, size=5):
    candidates = tpl.for_tier(tier)
    weighted = _weighted_templates(candidates, weak)
    pool = []
    seen_exprs = set()
    attempts = 0
    while len(pool) < size and attempts < 60:
        attempts += 1
        template = rng.choice(weighted)
        mc = template.build(_WORDS, rng)
        if mc is None:
            continue
        if mc.expression in seen_exprs:
            continue
        seen_exprs.add(mc.expression)
        pool.append(mc)
    return pool


def _build_identify_options(tier, rng, weak, target_word):
    """select_all: which expressions, called on `target_word`, find the
    position of a specific character in it -- .find()/.index() do,
    .count() and a bare index don't (they answer a different question).
    Built directly rather than drawn from the general pool, to match the
    exact shape of the real static-bank question this mirrors."""
    if not target_word:
        return None
    char = rng.choice(target_word)
    pos = target_word.find(char)
    candidates = [
        (f'"{target_word}".find("{char}")', True),
        (f'"{target_word}".index("{char}")', True),
        (f'"{target_word}".count("{char}")', False),
        (f'"{target_word}"[{pos}]', False),
    ]
    rng.shuffle(candidates)
    texts = [t for t, _ in candidates]
    correct = [t for t, is_pos in candidates if is_pos]
    return texts, correct, target_word


def _build_error_options(tier, rng, weak):
    pool = _draw_pool(tier, rng, weak)
    raising = [c.expression for c in pool if c.raises]
    safe = [c.expression for c in pool if not c.raises]
    if not raising or not safe:
        return None
    texts = [c.expression for c in pool]
    return texts, raising


# ─── write_code ─────────────────────────────────────────────────────────────

_CODE_STARTER = "# `word` is already defined for you.\n"
_CODE_TEST_RUNS = 3


def _code_test_words(rng, task_key):
    """Real dictionary words for grading, padded with random whitespace
    when the task is specifically about stripping -- an unpadded word
    would make `.strip()` a no-op on every test case, letting a submission
    that just prints `word` unchanged pass by accident."""
    pool = rng.sample(_WORDS, min(6, len(_WORDS)))
    if task_key == "print_stripped":
        return [f'{" " * rng.randint(1, 3)}{w}{" " * rng.randint(1, 3)}' for w in pool[:_CODE_TEST_RUNS]]
    return pool[:_CODE_TEST_RUNS]


def _grade_write_code(task_key, rng, code):
    task = tpl.CODE_TASKS.get(task_key)
    if task is None:
        return {"correct": False, "detail": ""}

    submitted = (code or "").strip()
    if not submitted:
        return {"correct": False, "detail": "You didn't write any code yet."}

    for test_word in _code_test_words(rng, task_key):
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

    samples = _code_test_words(random.Random(nonce ^ 0x5EED), task_key)[:2]
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
    picked = _pick_call(tier, rng, weak)
    if picked is None:
        return None
    template, mc = picked
    nonce = rng.getrandbits(32)
    fmt = _pick_format(KIND_EVALUATE, tier, rng)

    payload = _base_payload(tier, nonce, fmt, KIND_EVALUATE)
    payload.update({
        "expr": mc.expression,
        "result": (f"raises:{mc.exc_name}" if mc.raises else _render(mc.result)),
        "tp": template.id,
        # The real call itself (not just its rendered expression text), so
        # grade() can build a worked explanation from the actual word/
        # method/args rather than re-parsing them back out of `expr`.
        "w": mc.word, "mn": mc.method_name, "ar": list(mc.args),
    })

    question = {
        "tier": tier,
        "stars": tier,
        "type": fmt,
        "kind": KIND_EVALUATE,
        "template": template.id,
        "band": template.band,
        "prompt": (
            f"What does `{mc.expression}` evaluate to?" if fmt == FORMAT_MCQ
            else f"Type the exact result of `{mc.expression}` -- a number, True/False, "
                 "or text in quotes, whichever this one returns."
        ),
    }
    if fmt == FORMAT_MCQ:
        question["options"] = _evaluate_options(template, mc, random.Random(nonce))
    question["token"] = core.sign(payload)
    return question


def _generate_identify(tier, rng, weak):
    word = rng.choice(_WORDS)
    nonce = rng.getrandbits(32)
    built = _build_identify_options(tier, random.Random(nonce), weak, word)
    if built is None:
        return None
    texts, correct, target_word = built
    payload = _base_payload(tier, nonce, FORMAT_SELECT_ALL, KIND_IDENTIFY)
    payload.update({"tp": "identify_pool", "w": target_word})
    char = correct[0].split('"')[-2] if correct else ""
    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_SELECT_ALL,
        "kind": KIND_IDENTIFY,
        "template": "identify_pool",
        "band": tpl.BAND_MEDIUM,
        "prompt": (
            f'word = "{target_word}"\n'
            "Select every expression below that correctly finds the "
            f'POSITION of the first occurrence of "{char}" in `word`.'
        ),
        "options": texts,
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
        "prompt": "Select every expression below that raises an error.",
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

    if kind == KIND_IDENTIFY:
        seeded = random.Random(payload["n"])
        word = payload.get("w", "")
        built = _build_identify_options(tier, seeded, set(), word)
        if built is None:
            return {"ok": False, "error": "question could not be regenerated"}
        offered, key, _ = built
        submitted = {a for a in (submission.get("answers") or []) if a in offered}
        return verdict(submitted == set(key), ", ".join(sorted(key)))

    if kind == KIND_ERROR:
        seeded = random.Random(payload["n"])
        weak = set(payload.get("weak") or [])
        built = _build_error_options(tier, seeded, weak)
        if built is None:
            return {"ok": False, "error": "question could not be regenerated"}
        offered, key = built
        submitted = {a for a in (submission.get("answers") or []) if a in offered}
        return verdict(submitted == set(key), ", ".join(sorted(key)))

    # evaluate
    stored = payload.get("result", "")
    raises = stored.startswith("raises:")
    correct_answer = stored.split(":", 1)[1] if raises else stored
    raw = submission.get("answer")
    submitted = str(raw or "") if fmt == FORMAT_MCQ else str(raw or "").strip()

    explanation_blocks = None
    if "w" in payload:
        explanation_blocks = _build_method_explanation(
            payload["w"], payload.get("mn", ""), payload.get("ar", []),
            correct_answer, raises, correct_answer if raises else None,
        )
    return verdict(submitted == correct_answer, correct_answer, explanation_blocks=explanation_blocks)
