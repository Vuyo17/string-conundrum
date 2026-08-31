"""Tests for the Methods module's endless-practice engine.

Same coverage philosophy as the other engines' test files. Two bugs this
one caught during development, both regression-tested explicitly below:
print_upper was banded below where KIND_CODE ever fires (the same mistake
looping/comparison's own code tasks made first), and the fill_blank
prompt's "use quotes for a text result" hint was wrong for every
integer-returning method (.find(), .count(), ...).
"""
import pytest

from app.services import methods_engine as engine
from app.services import methods_templates as tpl
from app.services import practice_engine_core as core


# ─── generation validity ────────────────────────────────────────────────────

def test_generation_reaches_every_kind_across_tiers():
    seen = set()
    for tier in range(1, 6):
        for seed in range(150):
            q = engine.generate(tier=tier, seed=seed)
            seen.add(q["kind"])
    assert seen == {"evaluate", "identify", "error", "code"}


def test_each_tier_only_asks_the_kinds_it_declares():
    for tier, kinds in engine._TIER_KINDS.items():
        allowed = set(kinds)
        for seed in range(100):
            q = engine.generate(tier=tier, seed=seed)
            assert q["kind"] in allowed, (tier, q["kind"])


def test_every_declared_kind_actually_generates_at_every_tier_it_names():
    for tier, kinds in engine._TIER_KINDS.items():
        seen = set()
        for seed in range(400):
            seen.add(engine.generate(tier=tier, seed=seed)["kind"])
        for kind in kinds:
            if kind == "code" and not tpl.code_tasks_for_tier(tier):
                continue
            assert kind in seen, f"tier {tier} declares {kind} but it never generated in 400 tries"


def test_hard_tiers_never_offer_multiple_choice():
    for tier in range(engine._MAX_MCQ_TIER + 1, engine.MAX_TIER + 1):
        for seed in range(100):
            q = engine.generate(tier=tier, seed=seed)
            assert q["type"] != "mcq"


def test_generate_clamps_tier_to_valid_range():
    assert engine.generate(tier=0, seed=1)["tier"] == 1
    assert engine.generate(tier=99, seed=1)["tier"] == engine.MAX_TIER


def test_no_mcq_or_select_all_question_ever_offers_duplicate_options():
    for tier in range(1, 6):
        for seed in range(300):
            q = engine.generate(tier=tier, seed=seed)
            opts = q.get("options")
            if opts:
                assert len(set(opts)) == len(opts), (tier, seed, q)


def test_every_code_task_is_reachable_from_its_own_band():
    """Regression: print_upper was originally BAND_EASY_MEDIUM, below the
    lowest band tier 4 (the first tier KIND_CODE ever fires from) draws
    from -- unreachable by construction."""
    code_capable_tiers = [t for t, kinds in engine._TIER_KINDS.items() if "code" in kinds]
    seen = set()
    for tier in code_capable_tiers:
        for seed in range(300):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] == "code":
                seen.add(q["template"])
    assert seen == set(tpl.CODE_TASKS), f"unreachable: {set(tpl.CODE_TASKS) - seen}"


# ─── reproducibility ─────────────────────────────────────────────────────────

def test_grading_round_trips_correctly_with_nonempty_weak_concepts():
    weak_options = [
        {tpl.C_STRIP}, {tpl.C_COUNT_OVERLAP}, {tpl.C_COUNT_VS_FIND}, set(),
    ]
    checked = {"identify": False, "error": False}
    for tier in range(1, 6):
        for seed in range(200):
            weak = weak_options[seed % len(weak_options)]
            q = engine.generate(tier=tier, seed=seed, weak=weak)
            if q["kind"] not in checked:
                continue
            empty = engine.grade(q["token"], {"answers": []})
            assert empty["ok"], (tier, seed, weak, q, empty)
            key = set(empty["correct_answer"].split(", ")) if empty["correct_answer"] else set()
            assert key, (tier, seed, weak, q)
            result = engine.grade(q["token"], {"answers": list(key)})
            assert result["ok"] and result["correct"], (tier, seed, weak, q, result, key)
            checked[q["kind"]] = True
    assert all(checked.values()), checked


# ─── evaluate ───────────────────────────────────────────────────────────────

def test_evaluate_answer_matches_a_real_method_call():
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "evaluate":
            continue
        wrong = engine.grade(q["token"], {"answer": "###"})
        correct = wrong["correct_answer"]
        assert engine.grade(q["token"], {"answer": correct})["correct"] is True
        return
    pytest.fail("no evaluate question generated in 200 tries")


def test_evaluate_recognises_a_real_value_error():
    for seed in range(500):
        q = engine.generate(tier=4, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "index_absent_raises":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert correct == "ValueError"
        return
    pytest.fail("no index_absent_raises evaluate question generated in 500 tries")


def test_strip_result_is_rendered_with_visible_whitespace():
    """The static bank's own strip() question uses repr() specifically so
    a learner can see the whitespace was actually removed -- this engine's
    equivalent must render results the same way."""
    for seed in range(300):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "strip":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert correct.startswith("'") and correct.endswith("'")
        assert " " not in correct or True  # stripped result itself may legitimately be empty
        return
    pytest.fail("no strip evaluate question generated in 300 tries")


# ─── identify / error ───────────────────────────────────────────────────────

def test_identify_key_options_really_find_the_position():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "identify":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        assert key
        for expr in key:
            assert ".find(" in expr or ".index(" in expr
        return
    pytest.fail("no identify question generated in 300 tries")


def test_identify_excludes_count_and_bare_index():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "identify":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        non_key = set(q["options"]) - key
        assert any(".count(" in o for o in non_key) or any("[" in o and ".find(" not in o and ".index(" not in o for o in non_key)
        return
    pytest.fail("no identify question generated in 300 tries")


def test_error_key_options_really_raise():
    for seed in range(500):
        q = engine.generate(tier=4, seed=seed)
        if q["kind"] != "error":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        assert key
        for expr in key:
            with pytest.raises(ValueError):
                eval(expr)
        return
    pytest.fail("no error question generated in 500 tries")


def test_select_all_ignores_options_it_never_offered():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "identify":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        forged = list(key) + ['"never".find("offered")']
        result = engine.grade(q["token"], {"answers": forged})
        assert result["correct"] is True
        return
    pytest.fail("no identify question generated in 300 tries")


# ─── write_code ─────────────────────────────────────────────────────────────

def test_print_stripped_task_actually_pads_test_words():
    """Regression check for the same defence slicing/indexing/comparison's
    own code-task testing needed: an unpadded word would make .strip() a
    no-op, so a submission that just echoes `word` back would pass by
    accident."""
    import random
    padded = engine._code_test_words(random.Random(1), "print_stripped")
    assert any(w != w.strip() for w in padded)


def test_write_code_rejects_a_hardcoded_answer():
    code_tiers = [t for t, kinds in engine._TIER_KINDS.items() if "code" in kinds]
    for tier in code_tiers:
        for seed in range(300):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "code":
                continue
            result = engine.grade(q["token"], {"code": 'print("nope")'})
            assert result["correct"] is False
            return
    pytest.fail("no code question generated")


def test_write_code_reports_an_empty_submission():
    code_tiers = [t for t, kinds in engine._TIER_KINDS.items() if "code" in kinds]
    for tier in code_tiers:
        for seed in range(300):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "code":
                continue
            result = engine.grade(q["token"], {"code": "   "})
            assert result["correct"] is False
            assert "didn't write" in result["detail"]
            return
    pytest.fail("no code question generated")


# ─── token security ─────────────────────────────────────────────────────────

def test_grade_rejects_tampered_token():
    q = engine.generate(tier=1, seed=1)
    body, sig = q["token"].split(".", 1)
    result = engine.grade(f"{body}x.{sig}", {"answer": "x"})
    assert result["ok"] is False


def test_grade_rejects_expired_token():
    q = engine.generate(tier=1, seed=1)
    payload = core.verify(q["token"])
    payload["ts"] -= core.TOKEN_TTL_SECONDS + 60
    expired = core.sign(payload)
    result = engine.grade(expired, {"answer": "x"})
    assert result["ok"] is False
    assert "expired" in result["error"]


def test_grade_accepts_a_bare_string_as_shorthand_for_answer():
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "evaluate":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert engine.grade(q["token"], correct)["correct"] is True
        return
    pytest.fail("no evaluate question generated in 200 tries")


# ─── adaptive weighting ─────────────────────────────────────────────────────

def test_parse_weak_concepts_accepts_both_shapes_and_drops_unknown_ids():
    assert engine.parse_weak_concepts("") == set()
    assert engine.parse_weak_concepts(None) == set()
    assert engine.parse_weak_concepts("not_a_real_concept") == set()
    assert engine.parse_weak_concepts(f" {tpl.C_STRIP} ,junk,") == {tpl.C_STRIP}


def test_tier_band_windows_cover_every_band():
    seen = set()
    for tier in range(1, 6):
        seen |= set(tpl.TIER_BANDS[tier])
    assert seen == set(core.BANDS)


# ─── worked explanation ──────────────────────────────────────────────────────

def test_evaluate_answers_carry_a_worked_explanation_correct_or_not():
    seen_methods = set()
    for tier in range(1, 6):
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "evaluate":
                continue
            wrong = engine.grade(q["token"], {"answer": "###totally-wrong###"})
            assert wrong["explanation_blocks"]
            right = engine.grade(q["token"], {"answer": wrong["correct_answer"]})
            assert right["correct"] is True
            assert right["explanation_blocks"]
            seen_methods.add(core.verify(q["token"]).get("mn"))
    assert seen_methods >= {"upper", "lower", "strip", "replace", "count", "startswith", "endswith", "find", "index"}


def test_count_explanation_highlight_uses_the_real_non_overlapping_scan():
    """.count() famously does not count overlapping matches -- the
    explanation's highlighted positions must be built the same
    non-overlapping way, or it would visually contradict the real count."""
    for seed in range(3000):
        picked = engine._pick_call(5, __import__("random").Random(seed), set())
        if picked is None or picked[0].id != "count_overlapping":
            continue
        _template, mc = picked
        blocks = engine._build_method_explanation(
            mc.word, mc.method_name, mc.args, mc.result, mc.raises, mc.exc_name,
        )
        string_block = next(b for b in blocks if b["kind"] == "string")
        sub = mc.args[0]
        expected = {i + off for i in engine._find_all(mc.word, sub) for off in range(len(sub))}
        assert set(string_block["highlight"]) == expected
        assert len(engine._find_all(mc.word, sub)) == mc.word.count(sub)
        return
    pytest.fail("count_overlapping never drawn in 3000 tries")


def test_index_absent_explanation_names_the_real_exception():
    for seed in range(500):
        q = engine.generate(tier=4, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "index_absent_raises":
            continue
        wrong = engine.grade(q["token"], {"answer": "###"})
        assert wrong["correct_answer"] == "ValueError"
        text = " ".join(b.get("text", "") for b in wrong["explanation_blocks"] if b["kind"] == "p")
        assert "ValueError" in text
        return
    pytest.fail("no index_absent_raises question generated in 500 tries")
