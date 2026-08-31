import random

from app.services import corpus
from app.services import slicing_engine as engine
from app.services import slicing_templates as tpl


# ─── helpers ────────────────────────────────────────────────────────────────

def _first(tier, kind=None, fmt=None, limit=1200, weak=None):
    """The first seeded question matching the filters.

    generate() draws kind, template, string and format from a seeded RNG, so
    searching seeds is the only way to get a deterministic sample of one
    particular combination.
    """
    for seed in range(limit):
        question = engine.generate(tier=tier, seed=seed, weak=weak)
        if kind and question["kind"] != kind:
            continue
        if fmt and question["type"] != fmt:
            continue
        return question
    raise AssertionError(f"no kind={kind} fmt={fmt} question at tier {tier} in {limit} seeds")


def _payload(question):
    return engine._verify(question["token"])


def _slice_of(question):
    p = _payload(question)
    return p.get("w", ""), p.get("a"), p.get("b"), p.get("c")


def _find_slice_producing(value, target, allow_step):
    bounds = list(range(-len(value) - 1, len(value) + 2)) + [None]
    steps = [None, 1, 2, 3, -1, -2, -3] if allow_step else [None]
    for step in steps:
        for start in bounds:
            for stop in bounds:
                if value[start:stop:step] == target:
                    return start, stop, step
    return None


def _answer_key(question):
    """Recover a select_all question's key by regenerating it server-side."""
    value, start, stop, step = _slice_of(question)
    p = _payload(question)
    seeded = random.Random(p["n"])
    name = p.get("nm", "word")
    if question["kind"] == engine.KIND_ERROR:
        return engine._build_error_options(value, name, seeded)[1]
    if question["kind"] == engine.KIND_IDENTIFY:
        return engine._build_select_all(value, name, start, stop, step, seeded)[1]
    return engine._build_equivalence(value, name, start, stop, step, seeded)[1]


# ─── corpus ─────────────────────────────────────────────────────────────────

def test_corpus_ships_a_usable_word_pool_without_any_network():
    words = corpus.load_words()
    assert len(words) >= 100
    assert len(set(words)) == len(words), "duplicate words in the pool"
    for word in words:
        assert corpus._is_usable_word(word), f"unusable word in pool: {word!r}"


def test_corpus_structured_strings_carry_meaningful_fields():
    rng = random.Random(3)
    for kind in corpus.STRUCTURED_KINDS:
        entry = corpus.structured_entry(rng, kind)
        assert entry.kind == kind
        assert entry.name and entry.name != "word", f"{kind} should name its variable"
        assert entry.fields, f"{kind} declares no fields"
        for label, (start, stop, step) in entry.fields.items():
            extracted = entry.value[start:stop:step]
            assert extracted, f"{kind}: {label} extracts nothing from {entry.value!r}"
            assert extracted != entry.value, f"{kind}: {label} is the whole string"


def test_corpus_sample_respects_the_word_length_window():
    rng = random.Random(11)
    for _ in range(200):
        entry = corpus.sample(rng, kinds=[corpus.KIND_WORD], min_len=8, max_len=10)
        assert 8 <= len(entry.value) <= 10


def test_corpus_falls_back_to_words_when_no_structured_kind_fits():
    rng = random.Random(5)
    # Nothing structured is 40 characters, so this must degrade to a word
    # rather than returning something too short or raising.
    entry = corpus.sample(rng, kinds=corpus.STRUCTURED_KINDS, min_len=40, max_len=60)
    assert entry.kind == corpus.KIND_WORD


# ─── template registry ──────────────────────────────────────────────────────

def test_every_band_has_templates_and_every_template_has_a_known_band():
    for band in tpl.BANDS:
        assert tpl.for_band(band), f"band {band} has no templates"
    for template in tpl.TEMPLATES:
        assert template.band in tpl.BANDS
        assert template.id
    assert len({t.id for t in tpl.TEMPLATES}) == len(tpl.TEMPLATES), "duplicate template ids"


def test_tier_band_windows_cover_every_band_and_widen_with_tier():
    covered = set()
    for tier in range(1, engine.MAX_TIER + 1):
        covered |= set(tpl.TIER_BANDS[tier])
        assert tpl.for_tier(tier), f"tier {tier} has no templates"
    assert covered == set(tpl.BANDS), f"bands never reachable: {set(tpl.BANDS) - covered}"
    assert tpl.TIER_BANDS[1] == (tpl.BAND_EASY,)
    assert tpl.BAND_VERY_HARD in tpl.TIER_BANDS[engine.MAX_TIER]


def test_every_template_produces_a_usable_slice_for_a_string_it_accepts():
    rng = random.Random(29)
    for template in tpl.TEMPLATES:
        produced = 0
        for _ in range(60):
            entry = corpus.sample(
                rng, kinds=engine._kinds_for_template(template),
                min_len=template.min_len, max_len=14,
            )
            if not template.accepts(entry):
                continue
            built = template.build(entry, rng)
            if built is None:
                continue
            start, stop, step = built
            assert step != 0, f"{template.id} built a zero step"
            entry.value[start:stop:step]  # must not raise
            produced += 1
        assert produced, f"{template.id} never produced a slice"


def test_code_tasks_are_banded_and_reachable():
    for key, task in tpl.CODE_TASKS.items():
        assert task["band"] in tpl.BANDS, f"{key} has an unknown band"
        assert "{n}" in task["statement"] or not task["needs_n"]
    reachable = set()
    for tier in range(1, engine.MAX_TIER + 1):
        reachable |= set(tpl.code_tasks_for_tier(tier))
    assert reachable == set(tpl.CODE_TASKS), f"unreachable: {set(tpl.CODE_TASKS) - reachable}"
    # Coding tasks should not greet a tier-1 beginner.
    assert not tpl.code_tasks_for_tier(1)


# ─── generation across the pool ─────────────────────────────────────────────

def test_generation_reaches_every_kind_format_band_and_template():
    kinds, formats, bands, templates = set(), set(), set(), set()
    for tier in range(1, engine.MAX_TIER + 1):
        for seed in range(300):
            question = engine.generate(tier=tier, seed=seed)
            kinds.add(question["kind"])
            formats.add(question["type"])
            bands.add(question["band"])
            templates.add(question["template"])

    assert kinds == set(engine._KIND_FORMATS), f"unreached kinds: {set(engine._KIND_FORMATS) - kinds}"
    assert formats == {
        engine.FORMAT_MCQ, engine.FORMAT_FILL_BLANK, engine.FORMAT_BUILD_SLICE,
        engine.FORMAT_SELECT_ALL, engine.FORMAT_WRITE_CODE,
    }
    assert bands == set(tpl.BANDS), f"unreached bands: {set(tpl.BANDS) - bands}"
    every_template = {t.id for t in tpl.TEMPLATES} | set(tpl.CODE_TASKS)
    assert templates == every_template, f"unreached templates: {every_template - templates}"


def test_each_tier_only_draws_from_its_own_bands():
    for tier in range(1, engine.MAX_TIER + 1):
        allowed = set(tpl.TIER_BANDS[tier])
        for seed in range(200):
            question = engine.generate(tier=tier, seed=seed)
            if question["kind"] == engine.KIND_CODE:
                continue  # coding tasks carry their own band mapping
            assert question["band"] in allowed, (
                f"tier {tier} drew a {question['band']} template"
            )


def test_each_tier_only_asks_the_kinds_it_declares():
    for tier in range(1, engine.MAX_TIER + 1):
        allowed = set(engine._TIER_KINDS[tier]) | {engine.KIND_EVALUATE}
        seen = {engine.generate(tier=tier, seed=s)["kind"] for s in range(200)}
        assert seen <= allowed, f"tier {tier} asked {seen - allowed}"


def test_hard_tiers_never_offer_multiple_choice():
    # The point of the format axis: by tier 4 there is nothing left to answer
    # by elimination.
    for tier in range(engine._MAX_MCQ_TIER + 1, engine.MAX_TIER + 1):
        for seed in range(300):
            question = engine.generate(tier=tier, seed=seed)
            assert question["type"] != engine.FORMAT_MCQ, (
                f"tier {tier} offered mcq for a {question['kind']} question"
            )


def test_the_same_template_yields_visibly_different_questions():
    # The whole reason templates are shapes rather than questions: one
    # template must not keep producing the same string and bounds.
    seen = set()
    for seed in range(400):
        question = engine.generate(tier=2, seed=seed)
        if question["template"] != "short_span":
            continue
        seen.add(question["prompt"])
    assert len(seen) >= 20, f"short_span only produced {len(seen)} distinct prompts"


def test_no_question_answers_with_the_whole_string():
    for tier in range(1, engine.MAX_TIER + 1):
        for seed in range(200):
            question = engine.generate(tier=tier, seed=seed)
            value, start, stop, step = _slice_of(question)
            if not value or question["kind"] in (engine.KIND_CODE, engine.KIND_ERROR):
                continue
            assert value[start:stop:step] != value, (
                f"{question['kind']}/{question['template']} answers with the whole string"
            )


def test_generate_clamps_tier_to_valid_range():
    assert engine.generate(tier=0, seed=1)["tier"] == 1
    assert engine.generate(tier=99, seed=1)["tier"] == engine.MAX_TIER


def test_difficulty_scales_string_length_by_tier():
    def mean_length(tier):
        lengths = [len(_slice_of(engine.generate(tier=tier, seed=s))[0]) for s in range(120)]
        lengths = [n for n in lengths if n]
        return sum(lengths) / len(lengths)

    assert mean_length(1) < mean_length(5)


def test_structured_strings_reach_practice_and_keep_their_variable_name():
    names = set()
    for tier in (3, 4, 5):
        for seed in range(300):
            question = engine.generate(tier=tier, seed=seed)
            name = _payload(question).get("nm")
            if name:
                names.add(name)
    assert "word" in names
    assert len(names) >= 4, f"structured strings barely appear: {names}"
    # A date's variable is called `date`, and the prompt says so.
    for tier in (3, 4, 5):
        for seed in range(400):
            question = engine.generate(tier=tier, seed=seed)
            if _payload(question).get("nm") == "date":
                assert "date = " in question["prompt"]
                return
    raise AssertionError("no date-based question generated")


# ─── adaptive selection ─────────────────────────────────────────────────────

def test_weak_concepts_bias_selection_without_monopolising_it():
    target = tpl.C_NEGATIVE_STEP

    def share(weak):
        hits = total = 0
        for seed in range(1500):
            question = engine.generate(tier=4, seed=seed, weak=weak)
            template = tpl.BY_ID.get(question["template"])
            if template is None:
                continue
            total += 1
            hits += template.concept == target
        return hits / total

    uniform = share(None)
    tuned = share({target})
    assert tuned > uniform * 1.5, f"weighting had no effect: {uniform:.2f} -> {tuned:.2f}"
    assert tuned < 0.95, "weighting starved every other concept"


def test_parse_weak_concepts_accepts_both_shapes_and_drops_unknown_ids():
    assert engine.parse_weak_concepts("") == set()
    assert engine.parse_weak_concepts(None) == set()
    assert engine.parse_weak_concepts("not_a_real_concept") == set()
    assert engine.parse_weak_concepts(f" {tpl.C_NEGATIVE_STEP} ,junk,") == {tpl.C_NEGATIVE_STEP}
    assert engine.parse_weak_concepts([tpl.C_STEP, 5, None]) == {tpl.C_STEP}


def test_weak_concepts_never_unlock_a_harder_band():
    # Adaptive selection nudges; it must not smuggle a very_hard template
    # into tier 1 because the student is struggling.
    for seed in range(200):
        question = engine.generate(tier=1, seed=seed, weak={tpl.C_NEGATIVE_STEP})
        assert question["band"] in tpl.TIER_BANDS[1]


# ─── grading: evaluate ──────────────────────────────────────────────────────

def test_mcq_offers_four_unique_options_with_exactly_one_correct():
    for tier in range(1, engine._MAX_MCQ_TIER + 1):
        for seed in range(200):
            question = engine.generate(tier=tier, seed=seed)
            if question["type"] != engine.FORMAT_MCQ:
                continue
            options = question["options"]
            assert len(options) == 4
            assert len(set(options)) == 4, f"duplicate options: {options}"
            # No two options may differ only in whitespace — on a button they
            # would be the same picture.
            assert len({o.strip() for o in options}) == 4, f"visually equal options: {options}"
            right = [o for o in options if engine.grade(question["token"], {"answer": o})["correct"]]
            assert len(right) == 1, f"{len(right)} correct options in {options}"


def test_evaluate_typed_accepts_the_exact_value_and_its_quoted_forms():
    question = _first(2, kind=engine.KIND_EVALUATE, fmt=engine.FORMAT_FILL_BLANK)
    value, start, stop, step = _slice_of(question)
    correct = value[start:stop:step]
    for typed in (correct, f'"{correct}"', f"'{correct}'", f"  {correct}  "):
        assert engine.grade(question["token"], {"answer": typed})["correct"], f"rejected {typed!r}"


def test_evaluate_typed_is_case_sensitive_and_rejects_near_misses():
    question = _first(2, kind=engine.KIND_EVALUATE, fmt=engine.FORMAT_FILL_BLANK)
    value, start, stop, step = _slice_of(question)
    correct = value[start:stop:step]
    assert not engine.grade(question["token"], {"answer": correct + "x"})["correct"]
    if correct != correct.upper():
        assert not engine.grade(question["token"], {"answer": correct.upper()})["correct"]


def test_evaluate_advertises_the_expression_it_grades():
    question = _first(3, kind=engine.KIND_EVALUATE, fmt=engine.FORMAT_FILL_BLANK)
    value, start, stop, step = _slice_of(question)
    name = _payload(question).get("nm", "word")
    assert question["expression"] == engine._expr(name, start, stop, step)


def test_typed_questions_never_ask_for_an_answer_with_an_edge_space():
    # The corpus has phone numbers, so phone[3:9] really can be " 299 1" —
    # unfair to type, and invisible on a button.
    for tier in range(1, engine.MAX_TIER + 1):
        for seed in range(250):
            question = engine.generate(tier=tier, seed=seed)
            if question["kind"] not in (engine.KIND_EVALUATE, engine.KIND_TRACE):
                continue
            value, start, stop, step = _slice_of(question)
            answer = value[start:stop:step]
            if question["kind"] == engine.KIND_TRACE:
                answer = answer[slice(*_payload(question)["s2"])]
            assert answer == answer.strip(), f"{question['prompt']!r} -> {answer!r}"


def test_grade_wrong_answer_names_the_misconception_it_matches():
    for seed in range(600):
        question = engine.generate(tier=1, seed=seed)
        value, start, stop, step = _slice_of(question)
        if step not in (None, 1) or stop is None:
            continue
        distractor = value[start:stop + 1:step]
        if distractor == value[start:stop:step]:
            continue
        if question["type"] == engine.FORMAT_MCQ and distractor not in question["options"]:
            continue
        result = engine.grade(question["token"], {"answer": distractor})
        assert result["correct"] is False
        assert result["misconception_id"] == "slice_stop_inclusive"
        return
    raise AssertionError("no tier-1 sample produced a stop_inclusive near miss")


def test_grade_falls_back_to_the_template_concept_when_nothing_else_matches():
    question = _first(4, kind=engine.KIND_EVALUATE)
    result = engine.grade(question["token"], {"answer": "definitely-not-a-slice"})
    assert result["correct"] is False
    assert result["concept"], "grading lost the template's concept"
    assert result["misconception_id"] == result["concept"]


def test_grade_accepts_a_bare_string_as_shorthand_for_answer():
    question = _first(1, kind=engine.KIND_EVALUATE)
    value, start, stop, step = _slice_of(question)
    assert engine.grade(question["token"], value[start:stop:step])["correct"]


def test_grade_is_deterministic_regardless_of_generation_order():
    question = _first(3, fmt=engine.FORMAT_MCQ)
    value, start, stop, step = _slice_of(question)
    correct = value[start:stop:step]
    wrong = next(o for o in question["options"] if o != correct)
    first = engine.grade(question["token"], {"answer": wrong})
    second = engine.grade(question["token"], {"answer": wrong})
    assert first["misconception_id"] == second["misconception_id"]


# ─── grading: construct ─────────────────────────────────────────────────────

def test_construct_target_is_never_degenerate():
    for tier in range(2, engine.MAX_TIER + 1):
        for seed in range(200):
            question = engine.generate(tier=tier, seed=seed)
            if question["kind"] != engine.KIND_CONSTRUCT:
                continue
            assert question["target"]
            assert question["target"] != question["word"]


def test_construct_accepts_any_slice_that_produces_the_target():
    for tier in (2, 3, 4, 5):
        question = _first(tier, kind=engine.KIND_CONSTRUCT)
        found = _find_slice_producing(
            question["word"], question["target"], question["allow_step"],
        )
        assert found is not None, (
            f"tier {tier}: no slice reaches {question['target']!r} "
            f"in {question['word']!r} (allow_step={question['allow_step']})"
        )
        start, stop, step = found
        result = engine.grade(question["token"], {"slice": {
            "start": "" if start is None else str(start),
            "stop": "" if stop is None else str(stop),
            "step": "" if step is None else str(step),
        }})
        assert result["correct"] is True
        assert result["stars_awarded"] == tier


def test_construct_is_always_answerable_with_the_boxes_on_offer():
    # A tier without a step box must not ask for a slice that needs one.
    for tier in range(2, engine.MAX_TIER + 1):
        for seed in range(300):
            question = engine.generate(tier=tier, seed=seed)
            if question["kind"] != engine.KIND_CONSTRUCT:
                continue
            assert question["allow_step"] is (tier >= 4)
            if not question["allow_step"]:
                _, _, _, step = _slice_of(question)
                assert step in (None, 1), f"tier {tier} needs a step box it doesn't offer"


def test_construct_reports_typos_rather_than_calling_them_wrong_answers():
    question = _first(2, kind=engine.KIND_CONSTRUCT)
    result = engine.grade(question["token"], {"slice": {"start": "two", "stop": "", "step": ""}})
    assert result["correct"] is False
    assert "whole numbers" in result["detail"]


def test_construct_catches_a_zero_step_instead_of_raising():
    question = _first(4, kind=engine.KIND_CONSTRUCT)
    result = engine.grade(question["token"], {"slice": {"start": "", "stop": "", "step": "0"}})
    assert result["correct"] is False
    assert "step of 0" in result["detail"]


def test_construct_on_a_structured_string_asks_for_a_named_field():
    for tier in (3, 4, 5):
        for seed in range(500):
            question = engine.generate(tier=tier, seed=seed)
            if question["kind"] != engine.KIND_CONSTRUCT:
                continue
            if _payload(question).get("lbl"):
                assert "the " in question["prompt"], question["prompt"]
                return
    raise AssertionError("no field-labelled construct question generated")


# ─── grading: select_all family ─────────────────────────────────────────────

def test_select_all_questions_always_discriminate():
    for tier in range(3, engine.MAX_TIER + 1):
        for seed in range(250):
            question = engine.generate(tier=tier, seed=seed)
            if question["type"] != engine.FORMAT_SELECT_ALL:
                continue
            options = question["options"]
            assert len(set(options)) == len(options)
            key = _answer_key(question)
            assert key, f"{question['kind']}: nothing to select"
            assert len(options) - len(key) >= 2, (
                f"{question['kind']}: only {len(options) - len(key)} wrong options"
            )


def test_select_all_requires_the_exact_set():
    for kind in (engine.KIND_IDENTIFY, engine.KIND_ERROR, engine.KIND_EQUIVALENCE):
        question = _first(5, kind=kind)
        key = _answer_key(question)
        assert engine.grade(question["token"], {"answers": list(key)})["correct"] is True
        assert engine.grade(question["token"], {"answers": []})["correct"] is False
        wrong = next(o for o in question["options"] if o not in key)
        assert not engine.grade(question["token"], {"answers": list(key) + [wrong]})["correct"]
        if len(key) > 1:
            assert not engine.grade(question["token"], {"answers": key[:1]})["correct"]


def test_select_all_ignores_options_it_never_offered():
    question = _first(3, kind=engine.KIND_IDENTIFY)
    key = _answer_key(question)
    smuggled = engine.grade(question["token"], {"answers": list(key) + ["word[99:99]"]})
    assert smuggled["correct"] is True


def test_identify_key_really_evaluates_to_the_target():
    question = _first(3, kind=engine.KIND_IDENTIFY)
    value, start, stop, step = _slice_of(question)
    name = _payload(question).get("nm", "word")
    built = engine._build_select_all(
        value, name, start, stop, step, random.Random(_payload(question)["n"]),
    )
    target = value[start:stop:step]
    for text in built[1]:
        assert value[slice(*built[2][text])] == target


def test_equivalence_rejects_expressions_that_only_match_this_string():
    # The distinction the kind exists for: "equal here" is not "equivalent".
    question = _first(5, kind=engine.KIND_EQUIVALENCE)
    value, start, stop, step = _slice_of(question)
    name = _payload(question).get("nm", "word")
    built = engine._build_equivalence(
        value, name, start, stop, step, random.Random(_payload(question)["n"]),
    )
    options, key, triples = built
    for text in options:
        holds_everywhere = all(
            probe[slice(*triples[text])] == probe[start:stop:step]
            for probe in engine._EQUIV_PROBES
        )
        assert (text in key) == holds_everywhere, f"{text} keyed wrong"


def test_error_questions_name_expressions_that_really_raise():
    question = _first(4, kind=engine.KIND_ERROR)
    value = _payload(question)["w"]
    name = _payload(question).get("nm", "word")
    options, culprits = engine._build_error_options(
        value, name, random.Random(_payload(question)["n"]),
    )
    assert culprits and len(culprits) < len(options)
    # Every option's verdict is checked by actually attempting it.
    for text in options:
        raises = False
        try:
            expr = text[len(name):]
            body = expr[1:-1]
            if ":" in body:
                parts = [None if p == "" else int(p) for p in body.split(":")]
                value[slice(*(parts + [None] * (3 - len(parts))))]
            else:
                value[int(body)]
        except (IndexError, ValueError, TypeError):
            raises = True
        assert (text in culprits) == raises, f"{text} keyed wrong (raises={raises})"


# ─── grading: length and trace ──────────────────────────────────────────────

def test_length_questions_grade_the_character_count():
    for fmt in (engine.FORMAT_MCQ, engine.FORMAT_FILL_BLANK):
        question = _first(3, kind=engine.KIND_LENGTH, fmt=fmt)
        value, start, stop, step = _slice_of(question)
        answer = str(len(value[start:stop:step]))
        assert engine.grade(question["token"], {"answer": answer})["correct"] is True
        assert not engine.grade(question["token"], {"answer": str(int(answer) + 1)})["correct"]
        if fmt == engine.FORMAT_MCQ:
            assert answer in question["options"]
            assert len(question["options"]) == 4
        else:
            assert question["expression"].startswith("len(")


def test_trace_questions_grade_the_printed_output():
    # mcq is only offered up to _MAX_MCQ_TIER, so each format is sought at a
    # tier that actually offers it.
    for tier, fmt in ((3, engine.FORMAT_MCQ), (4, engine.FORMAT_FILL_BLANK)):
        question = _first(tier, kind=engine.KIND_TRACE, fmt=fmt)
        value, start, stop, step = _slice_of(question)
        answer = value[start:stop:step][slice(*_payload(question)["s2"])]
        assert engine.grade(question["token"], {"answer": answer})["correct"] is True
        assert not engine.grade(question["token"], {"answer": answer + "zz"})["correct"]
        # The snippet the student reads must be three real lines of Python.
        assert len(question["prompt"].splitlines()) == 4  # title + 3 code lines


# ─── grading: write_code ────────────────────────────────────────────────────

_SOLUTIONS = {
    "first_n": "print(word[:{n}])",
    "last_n": "print(word[-{n}:])",
    "skip_first_n": "print(word[{n}:])",
    "drop_last_n": "print(word[:-{n}])",
    "drop_ends": "print(word[1:-1])",
    "every_other": "print(word[::2])",
    "reverse": "print(word[::-1])",
    "second_half": "print(word[len(word) // 2:])",
    "reverse_every_other": "print(word[::-2])",
    "reverse_without_ends": "print(word[1:-1][::-1])",
}


def test_every_code_task_accepts_its_canonical_solution():
    assert set(_SOLUTIONS) == set(tpl.CODE_TASKS), "solution table drifted from the task table"
    seen = set()
    for tier in (4, 5):
        for seed in range(400):
            question = engine.generate(tier=tier, seed=seed)
            if question["kind"] != engine.KIND_CODE:
                continue
            payload = _payload(question)
            key, n = payload["k"], payload["p"]
            if key in seen:
                continue
            seen.add(key)
            code = _SOLUTIONS[key].format(n=n)
            result = engine.grade(question["token"], {"code": code})
            assert result["correct"] is True, f"{key}: {result['detail']}"
    assert seen == set(tpl.CODE_TASKS), f"never generated: {set(tpl.CODE_TASKS) - seen}"


def test_write_code_examples_match_what_grading_expects():
    question = _first(4, kind=engine.KIND_CODE)
    payload = _payload(question)
    task = tpl.CODE_TASKS[payload["k"]]
    assert question["starter_code"]
    assert question["examples"]
    for example in question["examples"]:
        assert example["output"] == task["spec"](example["word"], payload["p"])


def test_write_code_rejects_an_answer_hardcoded_for_one_word():
    question = _first(4, kind=engine.KIND_CODE)
    hardcoded = f'print({question["examples"][0]["output"]!r})'
    result = engine.grade(question["token"], {"code": hardcoded})
    assert result["correct"] is False
    assert "should print" in result["detail"]


def test_write_code_cannot_be_beaten_by_redefining_word():
    question = _first(4, kind=engine.KIND_CODE)
    sample = question["examples"][0]
    cheat = f'word = {sample["word"]!r}\nprint({sample["output"]!r})'
    assert engine.grade(question["token"], {"code": cheat})["correct"] is False


def test_write_code_reports_errors_and_empty_submissions():
    question = _first(4, kind=engine.KIND_CODE)
    broken = engine.grade(question["token"], {"code": "print(word[)"})
    assert broken["correct"] is False and "error" in broken["detail"].lower()
    blank = engine.grade(question["token"], {"code": "   "})
    assert blank["correct"] is False and blank["detail"]


# ─── tokens ─────────────────────────────────────────────────────────────────

def test_grade_rejects_tampered_token():
    question = engine.generate(tier=1, seed=1)
    body, sig = question["token"].split(".", 1)
    result = engine.grade(f"{body}x.{sig}", "anything")
    assert result["ok"] is False and "error" in result


def test_grade_rejects_expired_token():
    question = engine.generate(tier=1, seed=1)
    payload = engine._verify(question["token"])
    payload["ts"] -= engine.TOKEN_TTL_SECONDS + 60
    result = engine.grade(engine._sign(payload), "anything")
    assert result["ok"] is False and result["error"] == "expired"


def test_token_kind_cannot_be_downgraded_without_resigning():
    # Swapping a construct question for an evaluate one would let a client
    # answer a hard kind in an easy one; the signature has to prevent it.
    question = _first(4, kind=engine.KIND_CONSTRUCT)
    payload = engine._verify(question["token"])
    payload["q"] = engine.KIND_EVALUATE
    body = engine._sign(payload).split(".", 1)[0]
    forged = f"{body}.{question['token'].split('.', 1)[1]}"
    assert engine.grade(forged, {"answer": "x"})["ok"] is False


def test_grade_reports_the_kind_and_format_it_graded():
    question = _first(3, kind=engine.KIND_IDENTIFY)
    result = engine.grade(question["token"], {"answers": []})
    assert result["kind"] == engine.KIND_IDENTIFY
    assert result["format"] == engine.FORMAT_SELECT_ALL


def test_every_code_task_is_reachable_from_its_own_band():
    """A code task banded below the lowest tier that ever offers
    KIND_CODE is unreachable by construction -- caught for real in
    looping_engine.py's own equivalent task during development, so every
    sibling engine carries the same check."""
    code_capable_tiers = [t for t, kinds in engine._TIER_KINDS.items() if engine.KIND_CODE in kinds]
    seen = set()
    for tier in code_capable_tiers:
        for seed in range(600):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] == engine.KIND_CODE:
                seen.add(q["template"])
    assert seen == set(tpl.CODE_TASKS), f"unreachable: {set(tpl.CODE_TASKS) - seen}"


def test_every_declared_kind_actually_generates_at_every_tier_it_names():
    """The kind-level version of the same check: a kind can be declared
    reachable at a tier while silently never succeeding there if nothing
    in that tier's band window can satisfy it -- see comparison_engine's
    own version of this test for the real instance this caught."""
    for tier, kinds in engine._TIER_KINDS.items():
        seen = set()
        for seed in range(400):
            seen.add(engine.generate(tier=tier, seed=seed)["kind"])
        for kind in kinds:
            if kind == engine.KIND_CODE and not tpl.code_tasks_for_tier(tier):
                continue
            assert kind in seen, f"tier {tier} declares {kind} but it never generated in 400 tries"
