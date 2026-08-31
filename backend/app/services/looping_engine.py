"""Procedural, unlimited-question engine for the Looping module's endless
Practice mode.

Third module on this pattern, after Slicing and Indexing (see
slicing_engine.py's docstring for the shared idea, unchanged here). What's
specific to looping: a question is built around a whole loop program, not
a single expression, so its four kinds ask about the loop as a whole --
how many times it prints (count), what it prints (trace), whether it
raises before finishing (error), and writing one from scratch (code) --
rather than slicing/indexing's evaluate/construct/identify split, which
doesn't have a loop-shaped equivalent worth forcing in.

looping_templates.py's own Loop objects carry pre-computed ground truth
(the loop's real printed lines, computed by actually running the
equivalent Python in this process -- see that module's docstring for why
that's safe here specifically), so this file never has to re-derive what
a for/while loop does; it only has to build questions and distractors
around numbers/strings that are already known to be correct.
"""
import random
import time

from . import corpus
from . import looping_templates as tpl
from . import practice_engine_core as core
from .sandbox import run_for_grading

MAX_TIER = 5
InvalidToken = core.InvalidToken

_LEN_RANGE = {1: (4, 7), 2: (5, 8), 3: (6, 10), 4: (6, 11), 5: (8, 14)}

FORMAT_MCQ = "mcq"
FORMAT_FILL_BLANK = "fill_blank"
FORMAT_SELECT_ALL = "select_all"
FORMAT_WRITE_CODE = "write_code"

KIND_COUNT = "count"    # how many times does the loop print?
KIND_TRACE = "trace"    # what does the loop print, in full?
KIND_ERROR = "error"    # which of these loop headers raise before finishing?
KIND_CODE = "code"      # write it yourself

_KIND_FORMATS = {
    KIND_COUNT: (FORMAT_MCQ, FORMAT_FILL_BLANK),
    KIND_TRACE: (FORMAT_FILL_BLANK,),
    KIND_ERROR: (FORMAT_SELECT_ALL,),
    KIND_CODE: (FORMAT_WRITE_CODE,),
}

_TIER_KINDS = {
    1: (KIND_COUNT, KIND_COUNT, KIND_TRACE),
    2: (KIND_COUNT, KIND_TRACE, KIND_TRACE),
    3: (KIND_COUNT, KIND_TRACE, KIND_ERROR),
    4: (KIND_COUNT, KIND_TRACE, KIND_ERROR, KIND_CODE),
    5: (KIND_TRACE, KIND_ERROR, KIND_CODE, KIND_CODE),
}

_MAX_MCQ_TIER = 3
_WEAK_CONCEPT_WEIGHT = 4

_WORDS = corpus.load_words()


# ─── template + string selection ────────────────────────────────────────────

def _weighted_templates(templates, weak):
    return core.weighted_templates(templates, weak, weight=_WEAK_CONCEPT_WEIGHT)


def _pick_loop(tier, rng, weak, allow_raise=True):
    """A (template, entry, loop) where loop.raises is allowed or not, per
    `allow_raise` -- count/trace questions need a loop that actually
    finishes; error questions are built separately, from authored
    candidates, not from this picker."""
    candidates = tpl.for_tier(tier)
    weighted = _weighted_templates(candidates, weak)
    min_len, max_len = _LEN_RANGE[tier]

    for _ in range(60):
        template = rng.choice(weighted)
        entry = corpus.sample(
            rng, kinds=template.kinds or None,
            min_len=max(min_len, template.min_len), max_len=max_len, words=_WORDS,
        )
        if not template.accepts(entry):
            continue
        loop = template.build(entry, rng)
        if loop is None:
            continue
        if loop.raises and not allow_raise:
            continue
        if not loop.lines:
            continue
        return template, entry, loop

    return None


def _pick_format(kind, tier, rng):
    formats = [
        f for f in _KIND_FORMATS[kind]
        if not (f == FORMAT_MCQ and tier > _MAX_MCQ_TIER)
    ]
    return rng.choice(formats or list(_KIND_FORMATS[kind]))


# ─── count / trace distractors ───────────────────────────────────────────────

def _count_options(correct_n, rng):
    """Up to four counts: the real one plus off-by-one/off-by-two
    variants -- the exact shape the off_by_one_length misconception
    predicts."""
    pool = {correct_n - 1, correct_n + 1, correct_n - 2, correct_n + 2}
    pool.discard(correct_n)
    pool = sorted(n for n in pool if n >= 0)
    rng.shuffle(pool)
    options = [correct_n] + pool[:3]
    rng.shuffle(options)
    return [str(o) for o in options]


def _trace_options(lines, rng):
    """Up to four printed-output strings: the real one plus off-by-one
    variants (missing the first or last line) and a reordered one."""
    correct = "\n".join(lines)
    seen = {correct}
    pool = []
    if len(lines) > 1:
        missing_last = "\n".join(lines[:-1])
        if missing_last not in seen:
            pool.append(missing_last)
            seen.add(missing_last)
        missing_first = "\n".join(lines[1:])
        if missing_first not in seen:
            pool.append(missing_first)
            seen.add(missing_first)
        reversed_order = "\n".join(reversed(lines))
        if reversed_order not in seen:
            pool.append(reversed_order)
            seen.add(reversed_order)
    rng.shuffle(pool)
    options = [correct] + pool[:3]
    rng.shuffle(options)
    return options


# ─── worked explanation (count / trace, correct or wrong) ───────────────────
# One general builder for both kinds: `lines` is already the loop's real,
# directly-computed output (see looping_templates.py's docstring on why it's
# never re-simulated), so showing every iteration's own printed line *is*
# the ground truth -- there's no per-template narration to author, and
# nothing here needs to know which of the eleven shapes produced `lines`.

def _loop_quoted(text):
    return f'"{text}"' if text else '"" (the empty string)'


def _build_loop_explanation(lines, kind):
    if not lines:
        return [{
            "kind": "p",
            "text": "The loop's condition is already false on the very first check, so its body never runs — nothing is printed.",
        }]

    blocks = [{
        "kind": "table",
        "head": ["Iteration", "Printed"],
        "rows": [[str(i), _loop_quoted(line)] for i, line in enumerate(lines)],
    }]

    if kind == KIND_TRACE:
        blocks.append({
            "kind": "code",
            "code": "\n".join(lines),
            "caption": "Exactly what gets printed, in order — one line per pass through the loop body.",
        })
    else:
        blocks.append({
            "kind": "callout",
            "tone": "define",
            "title": "Key rule to remember",
            "text": (
                f"Count the lines the loop actually prints, one per pass through its "
                f"body — here that's **{len(lines)}**."
            ),
        })
    return blocks


# ─── error-kind candidates ───────────────────────────────────────────────────
# Authored while-loop headers, not template-driven: the four classic bound
# mistakes around `len(word)`, verified by actually attempting each on the
# real word (safe -- these are fixed, hand-written expressions, not
# learner input).

def _header_raises(word, header_key):
    n = len(word)
    i = 0
    try:
        if header_key == "lt":  # correct: i < n
            while i < n:
                word[i]
                i += 1
        elif header_key == "le":  # off by one over: i <= n
            while i <= n:
                word[i]
                i += 1
        elif header_key == "lt_minus1":  # off by one under: i < n - 1
            while i < n - 1:
                word[i]
                i += 1
        elif header_key == "le_minus1":  # correct, phrased differently: i <= n - 1
            while i <= n - 1:
                word[i]
                i += 1
    except IndexError:
        return True
    return False


_HEADER_TEXT = {
    "lt": "while i < len({name}):",
    "le": "while i <= len({name}):",
    "lt_minus1": "while i < len({name}) - 1:",
    "le_minus1": "while i <= len({name}) - 1:",
}


def _build_error_options(word, name, rng):
    keys = list(_HEADER_TEXT)
    rng.shuffle(keys)
    texts = [_HEADER_TEXT[k].format(name=name) for k in keys]
    key_by_text = dict(zip(texts, keys))
    correct = [t for t in texts if _header_raises(word, key_by_text[t])]
    wrong = [t for t in texts if t not in correct]
    if not correct or not wrong:
        return None
    return texts, correct


# ─── write_code ─────────────────────────────────────────────────────────────

_CODE_STARTER = "# `word` is already defined for you.\n"
_CODE_TEST_RUNS = 3


def _code_test_words(rng, tier):
    lo, hi = _LEN_RANGE[tier]
    pool = [w for w in _WORDS if lo - 1 <= len(w) <= hi + 2] or list(_WORDS)
    if len(pool) <= _CODE_TEST_RUNS:
        return pool
    return rng.sample(pool, _CODE_TEST_RUNS)


def _grade_write_code(task_key, tier, rng, code):
    task = tpl.CODE_TASKS.get(task_key)
    if task is None:
        return {"correct": False, "detail": ""}

    submitted = (code or "").strip()
    if not submitted:
        return {"correct": False, "detail": "You didn't write any code yet."}

    for test_word in _code_test_words(rng, tier):
        expected = task["spec"](test_word, 0)
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
    payload.update({"w": "", "k": task_key})

    samples = _code_test_words(random.Random(nonce ^ 0x5EED), tier)[:2]
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
        "examples": [{"word": w, "output": task["spec"](w, 0)} for w in samples],
    }


def _generate_error(tier, rng, weak):
    picked = _pick_loop(tier, rng, weak, allow_raise=True)
    if picked is None:
        return None
    _template, entry, _loop = picked
    nonce = rng.getrandbits(32)

    built = _build_error_options(entry.value, entry.name, random.Random(nonce))
    if built is None:
        return None

    payload = _base_payload(tier, nonce, FORMAT_SELECT_ALL, KIND_ERROR)
    payload.update({"w": entry.value, "nm": entry.name, "tp": "while_header"})

    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_SELECT_ALL,
        "kind": KIND_ERROR,
        "template": "while_header",
        "band": tpl.BAND_HARD,
        "prompt": (
            "Select every loop header below that raises an error before "
            f"the loop finishes.\n{entry.name} = \"{entry.value}\"\ni = 0"
        ),
        "options": built[0],
    }


def _generate_count(tier, rng, weak):
    picked = _pick_loop(tier, rng, weak, allow_raise=False)
    if picked is None:
        return None
    template, entry, loop = picked
    nonce = rng.getrandbits(32)
    fmt = _pick_format(KIND_COUNT, tier, rng)
    correct_n = len(loop.lines)

    payload = _base_payload(tier, nonce, fmt, KIND_COUNT)
    # The loop's own computed ground truth (its printed lines) is stored
    # directly in the payload, not re-derived by calling template.build()
    # again at grading time: some templates (for_slice, nested_pairs) draw
    # random bounds from the *shared* rng threaded through the whole
    # generate() call, at whatever position that rng happens to be in when
    # build() is reached -- a fresh rng seeded from the nonce alone would
    # not reliably land on the same draw. Storing the result sidesteps the
    # whole problem, the same way slicing_engine stores (start, stop, step)
    # and indexing_engine stores the index, rather than either recomputing.
    payload.update({"w": entry.value, "nm": entry.name, "tp": template.id, "lines": loop.lines})

    snippet = f'{entry.name} = "{entry.value}"\n{loop.source}'

    question = {
        "tier": tier,
        "stars": tier,
        "type": fmt,
        "kind": KIND_COUNT,
        "template": template.id,
        "band": template.band,
        "prompt": f"How many times does this loop print?\n{snippet}",
    }
    if fmt == FORMAT_MCQ:
        question["options"] = _count_options(correct_n, random.Random(nonce))
    question["token"] = core.sign(payload)
    return question


def _generate_trace(tier, rng, weak):
    picked = _pick_loop(tier, rng, weak, allow_raise=False)
    if picked is None:
        return None
    template, entry, loop = picked
    nonce = rng.getrandbits(32)
    fmt = _pick_format(KIND_TRACE, tier, rng)

    payload = _base_payload(tier, nonce, fmt, KIND_TRACE)
    payload.update({"w": entry.value, "nm": entry.name, "tp": template.id, "lines": loop.lines})

    snippet = f'{entry.name} = "{entry.value}"\n{loop.source}'
    question = {
        "tier": tier,
        "stars": tier,
        "type": fmt,
        "kind": KIND_TRACE,
        "template": template.id,
        "band": template.band,
        "prompt": f"What does this loop print? One line per answer line.\n{snippet}",
        "answer_label": "printed output",
    }
    if fmt == FORMAT_MCQ:
        question["options"] = _trace_options(loop.lines, random.Random(nonce))
    elif len(loop.lines) > 1:
        # A single-line <input> has nowhere for Enter to put a newline --
        # a multi-iteration loop's trace answer is several lines joined by
        # "\n", so fill_blank needs a <textarea> or it's unanswerable.
        question["multiline"] = True
    question["token"] = core.sign(payload)
    return question


_KIND_BUILDERS = {
    KIND_ERROR: _generate_error,
    KIND_COUNT: _generate_count,
    KIND_TRACE: _generate_trace,
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

    return _generate_count(tier, rng, weak) or _generate_trace(tier, rng, weak)


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

    value = payload.get("w", "")
    name = payload.get("nm", "word")
    tier = payload.get("t", 1)
    fmt = payload.get("f", FORMAT_MCQ)
    kind = payload.get("q", KIND_COUNT)
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
        outcome = _grade_write_code(task_key, tier, random.Random(payload["n"]), submission.get("code", ""))
        statement = task["statement"] if task else ""
        return verdict(
            outcome["correct"], f"code that will {statement}" if statement else "",
            None, outcome["detail"],
        )

    if kind == KIND_ERROR:
        seeded = random.Random(payload["n"])
        built = _build_error_options(value, name, seeded)
        if built is None:
            return {"ok": False, "error": "question could not be regenerated"}
        offered, key = built[0], built[1]
        submitted = {a for a in (submission.get("answers") or []) if a in offered}
        return verdict(submitted == set(key), ", ".join(sorted(key)))

    # count / trace: ground truth is the loop's printed lines, carried in
    # the token itself (see _generate_count/_generate_trace) rather than
    # re-derived here -- see the comment there for why regenerating via
    # template.build() again is not reliably reproducible.
    lines = payload.get("lines") or []

    explanation_blocks = _build_loop_explanation(lines, kind)

    if kind == KIND_COUNT:
        answer = str(len(lines))
        raw = submission.get("answer")
        submitted = str(raw or "") if fmt == FORMAT_MCQ else str(raw or "").strip()
        return verdict(submitted == answer, answer, explanation_blocks=explanation_blocks)

    # trace
    answer = "\n".join(lines)
    raw = submission.get("answer")
    submitted = str(raw or "") if fmt == FORMAT_MCQ else str(raw or "").strip()
    return verdict(submitted == answer, answer, explanation_blocks=explanation_blocks)
