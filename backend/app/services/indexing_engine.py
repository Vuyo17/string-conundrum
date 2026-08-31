"""Procedural, unlimited-question engine for the Indexing module's endless
Practice mode.

The second module built on this pattern, after Slicing (see
slicing_engine.py's own docstring for the general idea: template x string x
question kind x answer format, signed stateless tokens, misconception-
weighted adaptive selection -- all unchanged here, imported from
practice_engine_core.py rather than re-explained). What's specific to this
file is single-character indexing rather than slicing: a question is built
around one index into one string, using indexing_templates.py's shapes and
the three real misconceptions indexing already has a taxonomy for
(indexing_from_one, negative_index_confusion, off_by_one_length -- see
exercises.json's own indexing misconception_map).

Five question kinds cover it: evaluate (what does `word[i]` give), construct
(find an index that gives a target character), identify (which of these
indices give the same character), error (which of these indices raise
IndexError), and write_code. "length" and "trace" -- two of Slicing's eight
kinds -- are not included: every valid index produces exactly one
character, so "how many characters" has only one possible answer and is not
worth asking, and a meaningful two-step trace needs a second operation on
the result (Slicing's is itself another slice); that is left as a natural
future extension rather than forced in for parity.
"""
import random
import time

from . import corpus
from . import indexing_templates as tpl
from . import practice_engine_core as core
from .sandbox import run_for_grading

MAX_TIER = 5
InvalidToken = core.InvalidToken

_LEN_RANGE = {1: (5, 8), 2: (5, 9), 3: (6, 11), 4: (6, 12), 5: (10, 14)}

# ─── answer formats / question kinds ─────────────────────────────────────────

FORMAT_MCQ = "mcq"
FORMAT_FILL_BLANK = "fill_blank"
FORMAT_BUILD_INDEX = "build_index"
FORMAT_SELECT_ALL = "select_all"
FORMAT_WRITE_CODE = "write_code"

KIND_EVALUATE = "evaluate"    # what character does word[i] give?
KIND_CONSTRUCT = "construct"  # find an index that gives a target character
KIND_IDENTIFY = "identify"    # which of these indices give the same character?
KIND_ERROR = "error"          # which of these indices raise IndexError?
KIND_CODE = "code"            # write it yourself

_KIND_FORMATS = {
    KIND_EVALUATE: (FORMAT_MCQ, FORMAT_FILL_BLANK),
    KIND_CONSTRUCT: (FORMAT_BUILD_INDEX,),
    KIND_IDENTIFY: (FORMAT_SELECT_ALL,),
    KIND_ERROR: (FORMAT_SELECT_ALL,),
    KIND_CODE: (FORMAT_WRITE_CODE,),
}

_TIER_KINDS = {
    1: (KIND_EVALUATE, KIND_EVALUATE, KIND_EVALUATE),
    2: (KIND_EVALUATE, KIND_EVALUATE, KIND_CONSTRUCT),
    3: (KIND_EVALUATE, KIND_CONSTRUCT, KIND_CONSTRUCT, KIND_IDENTIFY),
    4: (KIND_EVALUATE, KIND_CONSTRUCT, KIND_IDENTIFY, KIND_ERROR, KIND_CODE),
    5: (KIND_CONSTRUCT, KIND_IDENTIFY, KIND_ERROR, KIND_CODE, KIND_CODE),
}

_MAX_MCQ_TIER = 3
_WEAK_CONCEPT_WEIGHT = 4

_WORDS = corpus.load_words()


# ─── distractor / rewrite generation ─────────────────────────────────────────

def _in_range(idx, n):
    return -n <= idx < n


def _char_at(value, idx):
    n = len(value)
    return value[idx] if _in_range(idx, n) else None


def _variant_one_based(i, n):
    """Off-by-one from treating a positive index as counting from one."""
    if i is None or i < 0:
        return None
    shifted = i - 1
    if shifted < 0 or shifted == i:
        return None
    return shifted


def _variant_negative_shift(i, n):
    """Off-by-one from treating -1 as 'one before the last' rather than
    the last -- shifting every negative index one step towards zero."""
    if i is None or i >= 0:
        return None
    shifted = i + 1
    if shifted == 0 or shifted == i:
        return None
    return shifted


def _variant_sign_flip(i, n):
    """The same magnitude, wrong sign -- typing 2 for -2 or vice versa."""
    if i is None or i == 0:
        return None
    flipped = -i
    if not _in_range(flipped, n) or flipped == i:
        return None
    return flipped


def _variant_adjacent(i, n):
    """A plain off-by-one slip in the direction away from zero."""
    candidate = i + 1 if i >= 0 else i - 1
    if not _in_range(candidate, n) or candidate == i:
        return None
    return candidate


_VARIANTS = (
    (_variant_one_based, tpl.C_ONE_BASED),
    (_variant_negative_shift, tpl.C_NEGATIVE_INDEX),
    (_variant_sign_flip, tpl.C_NEGATIVE_INDEX),
    (_variant_adjacent, tpl.C_OFF_BY_ONE),
)


def _misconception_for_char(value, i, submitted, correct):
    """Which misconception, if any, would produce `submitted` here."""
    if submitted == correct:
        return None
    n = len(value)
    for fn, concept in _VARIANTS:
        alt = fn(i, n)
        if alt is not None and _char_at(value, alt) == submitted:
            return concept
    return None


def _build_options(value, i, correct, rng):
    """Up to four shuffled character options: the correct one plus up to
    three misconception-tagged distractors, padded with other characters
    from the same string if the variants don't yield enough distinct ones.
    """
    n = len(value)
    seen_idx = {i}
    seen_char = {correct}
    pool = []
    for fn, concept in _VARIANTS:
        alt = fn(i, n)
        if alt is None or alt in seen_idx:
            continue
        ch = _char_at(value, alt)
        if ch is None or ch in seen_char:
            continue
        seen_idx.add(alt)
        seen_char.add(ch)
        pool.append((ch, concept))

    rng.shuffle(pool)
    distractors = pool[:3]

    # Escape hatch: pad with other characters actually present in the
    # string, at positions not already used. Guaranteed to terminate --
    # there are at most n-1 other characters to draw from -- rather than
    # depending on the misconception variants alone, which can run dry on
    # a short word or one with few distinct characters nearby.
    #
    # `value[j] not in seen_char` has to be re-checked on every iteration,
    # not filtered once up front: a repeated letter (two 'l's in "hollow")
    # means two different positions can both pass a one-time filter against
    # the *original* seen_char, and both get added as if they were distinct
    # options -- the same duplicate-option failure mode Slicing's own
    # ChoiceList display bug came from, just one layer lower here (in
    # generation rather than rendering). Caught the same way: generating a
    # large sample and checking every option list for exact-text duplicates.
    candidates = [j for j in range(n) if j not in seen_idx]
    rng.shuffle(candidates)
    for j in candidates:
        if len(distractors) >= 3:
            break
        ch = value[j]
        if ch in seen_char:
            continue
        distractors.append((ch, None))
        seen_char.add(ch)
        seen_idx.add(j)

    options = [(correct, None)] + distractors
    rng.shuffle(options)
    misconception_by_option = {ch: mid for ch, mid in options}
    return [ch for ch, _ in options], misconception_by_option


def _rewrites(i, n):
    """Alternative indices worth offering alongside the canonical one for
    identify-kind questions: the same position addressed from the other
    end (always exactly equal, by definition of Python's negative
    indexing), and near-miss neighbours."""
    out = []
    mirror = i - n if i >= 0 else i + n
    if _in_range(mirror, n):
        out.append(mirror)
    for delta in (1, -1, 2, -2):
        candidate = i + delta
        if _in_range(candidate, n) and candidate != i:
            out.append(candidate)
    return out


def _build_select_all(value, name, i, rng):
    """Up to five index expressions to judge, and the subset that actually
    matches the same character as `word[i]`. Mirrors
    slicing_engine.py's own _build_select_all: correctness is computed by
    evaluating each candidate, not authored, so the key cannot drift from
    the options."""
    n = len(value)
    target = value[i]
    candidates = [i] + _rewrites(i, n)

    by_text = {}
    for idx in candidates:
        by_text.setdefault(f"{name}[{idx}]", idx)

    texts = list(by_text)
    rng.shuffle(texts)
    correct = [t for t in texts if value[by_text[t]] == target]
    wrong = [t for t in texts if t not in correct]

    if not correct or len(wrong) < 2:
        return None

    chosen = correct[:2] + wrong[:3]
    rng.shuffle(chosen)
    return chosen, [t for t in chosen if t in correct]


def _build_error_options(value, name, rng):
    """Five index expressions and the subset that actually raises
    IndexError. Mirrors slicing_engine.py's own _build_error_options --
    verified by actually attempting each index, not asserted."""
    n = len(value)
    raising = [n + rng.randint(0, 4), -(n + rng.randint(1, 4))]
    safe = [0, -1, n - 1, -n, rng.randint(1, max(1, n - 2))]

    def raises(idx):
        try:
            value[idx]
        except IndexError:
            return True
        return False

    culprits = [idx for idx in raising if raises(idx)]
    innocents = [idx for idx in safe if not raises(idx)]
    if not culprits or len(innocents) < 3:
        return None

    rng.shuffle(innocents)
    keep = culprits[:rng.choice([1, 2]) if len(culprits) > 1 else 1]
    chosen_idx = keep + innocents[:5 - len(keep)]
    rng.shuffle(chosen_idx)

    texts = [f"{name}[{idx}]" for idx in chosen_idx]
    if len(set(texts)) != len(texts):
        return None
    return texts, [f"{name}[{idx}]" for idx in keep]


# ─── template + string selection ────────────────────────────────────────────

def _weighted_templates(templates, weak):
    return core.weighted_templates(templates, weak, weight=_WEAK_CONCEPT_WEIGHT)


def _pick_index_question(tier, rng, weak):
    """A (template, entry, index) that isn't degenerate."""
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
        i = template.build(entry, rng)
        if i is None or not _in_range(i, len(entry.value)):
            continue
        return template, entry, i

    return None


def _pick_format(kind, tier, rng):
    formats = [
        f for f in _KIND_FORMATS[kind]
        if not (f == FORMAT_MCQ and tier > _MAX_MCQ_TIER)
    ]
    return rng.choice(formats or list(_KIND_FORMATS[kind]))


# ─── write_code ─────────────────────────────────────────────────────────────

_CODE_STARTER = "# `word` is already defined for you.\n"
_CODE_TEST_RUNS = 3


def _code_test_words(rng, tier):
    lo, hi = _LEN_RANGE[tier]
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


# ─── generation ─────────────────────────────────────────────────────────────

def _base_payload(tier, nonce, fmt, kind):
    return {"t": tier, "n": nonce, "ts": int(time.time()), "f": fmt, "q": kind}


def _generate_code(tier, rng):
    keys = tpl.code_tasks_for_tier(tier)
    if not keys:
        return None
    task_key = rng.choice(keys)
    task = tpl.CODE_TASKS[task_key]
    n = rng.randint(2, 4) if task["needs_n"] else 0
    nonce = rng.getrandbits(32)

    payload = _base_payload(tier, nonce, FORMAT_WRITE_CODE, KIND_CODE)
    payload.update({"w": "", "i": None, "k": task_key, "p": n})

    samples = _code_test_words(random.Random(nonce ^ 0x5EED), tier)[:2]
    return {
        "token": core.sign(payload),
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
    picked = _pick_index_question(tier, rng, weak)
    if picked is None:
        return None
    template, entry, _ = picked
    nonce = rng.getrandbits(32)

    built = _build_error_options(entry.value, entry.name, random.Random(nonce))
    if built is None:
        return None

    payload = _base_payload(tier, nonce, FORMAT_SELECT_ALL, KIND_ERROR)
    payload.update({"w": entry.value, "nm": entry.name, "i": None, "tp": template.id})

    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_SELECT_ALL,
        "kind": KIND_ERROR,
        "template": template.id,
        "band": template.band,
        "prompt": (
            "Select every expression below that raises an error.\n"
            f'{entry.name} = "{entry.value}"'
        ),
        "options": built[0],
    }


def _generate_identify(tier, rng, weak):
    picked = _pick_index_question(tier, rng, weak)
    if picked is None:
        return None
    template, entry, i = picked
    nonce = rng.getrandbits(32)

    built = _build_select_all(entry.value, entry.name, i, random.Random(nonce))
    if built is None:
        return None

    payload = _base_payload(tier, nonce, FORMAT_SELECT_ALL, KIND_IDENTIFY)
    payload.update({"w": entry.value, "nm": entry.name, "i": i, "tp": template.id})

    target = entry.value[i]
    # Corpus words are plain lowercase ASCII (corpus.py's _is_usable_word),
    # so target is always a printable letter here -- no empty-string or
    # whitespace rendering case to handle, unlike a slice's result.
    quoted = f'"{target}"'
    return {
        "token": core.sign(payload),
        "tier": tier,
        "stars": tier,
        "type": FORMAT_SELECT_ALL,
        "kind": KIND_IDENTIFY,
        "template": template.id,
        "band": template.band,
        "prompt": (
            f"Select every expression below that evaluates to {quoted}.\n"
            f'{entry.name} = "{entry.value}"'
        ),
        "options": built[0],
        "target": target,
    }


def _generate_slice_question(kind, tier, rng, weak):
    """evaluate / construct — the two kinds that ask directly about one
    index of one string."""
    fmt = _pick_format(kind, tier, rng)
    picked = _pick_index_question(tier, rng, weak)
    if picked is None:
        return None
    template, entry, i = picked
    nonce = rng.getrandbits(32)

    payload = _base_payload(tier, nonce, fmt, kind)
    payload.update({"w": entry.value, "nm": entry.name, "i": i, "tp": template.id})

    question = {
        "tier": tier,
        "stars": tier,
        "type": fmt,
        "kind": kind,
        "template": template.id,
        "band": template.band,
    }

    correct = entry.value[i]
    expression = f"{entry.name}[{i}]"

    if kind == KIND_EVALUATE:
        title = (
            f"What does `{expression}` evaluate to?" if fmt == FORMAT_MCQ
            else f"Type the exact character `{expression}` gives."
        )
        question["prompt"] = f'{title}\n{entry.name} = "{entry.value}"'
        if fmt == FORMAT_MCQ:
            options, _ = _build_options(entry.value, i, correct, random.Random(nonce))
            question["options"] = options
        else:
            question["expression"] = expression
            question["word"] = entry.value

    elif kind == KIND_CONSTRUCT:
        question["prompt"] = (
            f'Fill in the index so the expression gives "{correct}".\n'
            f'{entry.name} = "{entry.value}"'
        )
        question["word"] = entry.value
        question["name"] = entry.name
        question["target"] = correct

    question["token"] = core.sign(payload)
    return question


_KIND_BUILDERS = {
    KIND_ERROR: _generate_error,
    KIND_IDENTIFY: _generate_identify,
}


def generate(tier: int = 1, seed=None, weak=None) -> dict:
    """Build one procedural Indexing question at the given difficulty tier.

    Same contract as slicing_engine.generate(): `weak` biases template
    selection without ever narrowing what a tier can produce, and every
    builder may decline, so this retries across kinds and falls back to
    plain evaluation, which can always be built.
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


def parse_weak_concepts(raw):
    return core.parse_weak_concepts(raw, {t.concept for t in tpl.TEMPLATES})


# ─── grading ────────────────────────────────────────────────────────────────

def grade(token: str, submission: "dict | str") -> dict:
    """Verify a token, then grade the submission against it. Same contract
    as slicing_engine.grade()."""
    try:
        payload = core.verify(token)
    except core.InvalidToken as exc:
        return {"ok": False, "error": str(exc)}

    if not isinstance(submission, dict):
        submission = {"answer": submission}

    value = payload.get("w", "")
    name = payload.get("nm", "word")
    i = payload.get("i")
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
        n = payload.get("p", 0)
        outcome = _grade_write_code(
            task_key, n, tier, random.Random(payload["n"]), submission.get("code", ""),
        )
        statement = task["statement"].format(n=n) if task else ""
        return verdict(
            outcome["correct"], f"code that will {statement}" if statement else "",
            None, outcome["detail"],
        )

    if kind in (KIND_IDENTIFY, KIND_ERROR):
        seeded = random.Random(payload["n"])
        if kind == KIND_ERROR:
            built = _build_error_options(value, name, seeded)
        else:
            built = _build_select_all(value, name, i, seeded)
        if built is None:
            return {"ok": False, "error": "question could not be regenerated"}
        offered, key = built[0], built[1]
        submitted = {a for a in (submission.get("answers") or []) if a in offered}
        return verdict(submitted == set(key), ", ".join(sorted(key)))

    if kind == KIND_CONSTRUCT:
        target = value[i]
        raw = submission.get("slice") or submission.get("index")
        raw_val = raw.get("index") if isinstance(raw, dict) else raw
        try:
            text = str(raw_val if raw_val is not None else "").strip()
            submitted_idx = int(text)
        except (TypeError, ValueError):
            return verdict(
                False, f"{name}[{i}]", None,
                "The index has to be a whole number.",
            )
        produced = _char_at(value, submitted_idx)
        if produced == target:
            return verdict(True, f"{name}[{submitted_idx}]")
        detail = (
            f"{name}[{submitted_idx}] raises an IndexError." if produced is None
            else f'{name}[{submitted_idx}] gives "{produced}".'
        )
        return verdict(
            False, f"{name}[{i}]",
            _misconception_for_char(value, i, produced, target) if produced is not None else None,
            detail,
        )

    # ── evaluate (mcq or typed) ───────────────────────────────────────────
    correct_answer = value[i]
    raw = submission.get("answer")
    submitted = str(raw or "") if fmt == FORMAT_MCQ else str(raw or "").strip()
    # A typed single-quote/double-quote pair is honoured the same way
    # slicing_engine's typed answers are, since the answer here is always
    # exactly one character and a stray quote is a plausible way to type it.
    if fmt != FORMAT_MCQ and len(submitted) >= 2 and submitted[0] == submitted[-1] and submitted[0] in ("'", '"'):
        submitted = submitted[1:-1]

    if submitted == correct_answer:
        return verdict(True, correct_answer)

    if fmt == FORMAT_MCQ:
        _, misconception_by_option = _build_options(value, i, correct_answer, random.Random(payload["n"]))
        return verdict(False, correct_answer, misconception_by_option.get(submitted))

    return verdict(False, correct_answer, _misconception_for_char(value, i, submitted, correct_answer))
