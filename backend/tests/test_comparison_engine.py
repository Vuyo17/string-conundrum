"""Tests for the Comparison module's endless-practice engine.

Same coverage philosophy as the other engines' test files, plus a
dedicated regression test for the specific bug found while building this
one: _t_prefix_ordering called rng.shuffle() directly on the shared
corpus word list instead of a copy, permanently reordering it as a side
effect and breaking every later template's ability to reproduce its own
question from a token. Caught by generating the identical (tier, seed,
weak) question twice and checking the two results actually matched --
the same style of check that caught looping_engine's non-reproducible
Loop regeneration earlier.
"""
import random

import pytest

from app.services import comparison_engine as engine
from app.services import comparison_templates as tpl
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
    code_capable_tiers = [t for t, kinds in engine._TIER_KINDS.items() if "code" in kinds]
    seen = set()
    for tier in code_capable_tiers:
        for seed in range(300):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] == "code":
                seen.add(q["template"])
    assert seen == set(tpl.CODE_TASKS), f"unreachable: {set(tpl.CODE_TASKS) - seen}"


def test_every_declared_kind_actually_generates_at_every_tier_it_names():
    """A kind can be *declared* reachable at a tier (in _TIER_KINDS) while
    silently never actually succeeding there, if the band window that
    tier draws from has no template able to satisfy that kind's own
    requirements -- string_number_type_error (KIND_ERROR's only raising
    template) was originally BAND_HARD, one band above tier 4's window,
    so error-kind questions declared reachable at tier 4 could never
    actually be built there. generate()'s retry-across-kinds silently
    papers over a single failed kind by trying another, so this has to be
    checked directly rather than relying on "generate() didn't crash"."""
    for tier, kinds in engine._TIER_KINDS.items():
        seen = set()
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            seen.add(q["kind"])
        # Every kind actually named for this tier must show up at least
        # once in a large enough sample -- "code" is exempted only when
        # this tier has no code task in its band window at all.
        for kind in kinds:
            if kind == "code" and not tpl.code_tasks_for_tier(tier):
                continue
            assert kind in seen, f"tier {tier} declares {kind} but it never generated in 400 tries"


# ─── the reproducibility regression itself ──────────────────────────────────

def test_identical_seed_and_weak_reproduces_the_identical_pool():
    """The exact bug: _t_prefix_ordering mutating the shared word list via
    rng.shuffle(words) meant calling the pool-builder twice with the same
    inputs gave two different pools -- silently breaking grade()'s ability
    to regenerate the question it was actually shown."""
    for weak in ({"comparison_ignores_case"}, {"strings_not_orderable_myth"}, set()):
        for nonce in (1, 42, 999, 123456):
            p1 = engine._build_identify_options(4, random.Random(nonce), weak)
            p2 = engine._build_identify_options(4, random.Random(nonce), weak)
            assert p1 == p2, (nonce, weak)


def test_grading_round_trips_correctly_with_nonempty_weak_concepts():
    """The other half of the same bug class: grade() must reconstruct the
    exact pool generate() built, including when weak concepts (which
    change which templates get drawn) were non-empty -- not just the
    empty-weak default every other quick check happens to exercise."""
    weak_options = [
        {"comparison_ignores_case"}, {"strings_not_orderable_myth"},
        {"string_number_equality_myth"}, set(),
    ]
    checked_identify = checked_error = False
    for tier in range(1, 6):
        for seed in range(200):
            weak = weak_options[seed % len(weak_options)]
            q = engine.generate(tier=tier, seed=seed, weak=weak)
            if q["kind"] not in ("identify", "error"):
                continue
            empty = engine.grade(q["token"], {"answers": []})
            assert empty["ok"], (tier, seed, weak, q, empty)
            key = set(empty["correct_answer"].split(", ")) if empty["correct_answer"] else set()
            assert key, (tier, seed, weak, q)
            result = engine.grade(q["token"], {"answers": list(key)})
            assert result["ok"] and result["correct"], (tier, seed, weak, q, result, key)
            if q["kind"] == "identify":
                checked_identify = True
            else:
                checked_error = True
    assert checked_identify and checked_error


# ─── evaluate ───────────────────────────────────────────────────────────────

def test_evaluate_answer_matches_a_real_python_comparison():
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "evaluate":
            continue
        wrong = engine.grade(q["token"], {"answer": "###"})
        correct = wrong["correct_answer"]
        assert correct in ("True", "False", "TypeError")
        assert engine.grade(q["token"], {"answer": correct})["correct"] is True
        return
    pytest.fail("no evaluate question generated in 200 tries")


def test_evaluate_recognises_a_real_type_error():
    for seed in range(500):
        q = engine.generate(tier=4, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "string_number_type_error":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert correct == "TypeError"
        return
    pytest.fail("no string_number_type_error evaluate question generated in 500 tries")


def test_mcq_offers_the_myth_distractor_for_orderable_operators():
    for seed in range(300):
        # lexicographic_lt/gt are BAND_MEDIUM, which first appears in
        # tier 3's window -- tier 1 (BAND_EASY only) never draws them.
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "evaluate" or q["type"] != "mcq":
            continue
        if q["template"] not in ("lexicographic_lt", "lexicographic_gt"):
            continue
        assert any("Cannot compare" in o for o in q["options"])
        return
    pytest.fail("no lexicographic mcq question generated in 300 tries")


# ─── identify / error ───────────────────────────────────────────────────────

def test_identify_key_options_all_really_evaluate_to_true():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "identify":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        assert key
        for expr in key:
            assert eval(expr) is True  # authored, server-side expression text -- safe to eval directly
        return
    pytest.fail("no identify question generated in 300 tries")


def test_error_key_options_all_really_raise_type_error():
    for seed in range(500):
        q = engine.generate(tier=4, seed=seed)
        if q["kind"] != "error":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        assert key
        for expr in key:
            with pytest.raises(TypeError):
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
        forged = list(key) + ['"never" == "offered"']
        result = engine.grade(q["token"], {"answers": forged})
        assert result["correct"] is True
        return
    pytest.fail("no identify question generated in 300 tries")


# ─── write_code ─────────────────────────────────────────────────────────────

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


def test_write_code_rejects_a_hardcoded_answer():
    code_tiers = [t for t, kinds in engine._TIER_KINDS.items() if "code" in kinds]
    for tier in code_tiers:
        for seed in range(300):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "code":
                continue
            result = engine.grade(q["token"], {"code": 'print("banana")'})
            assert result["correct"] is False
            return
    pytest.fail("no code question generated")


# ─── token security ─────────────────────────────────────────────────────────

def test_grade_rejects_tampered_token():
    q = engine.generate(tier=1, seed=1)
    body, sig = q["token"].split(".", 1)
    result = engine.grade(f"{body}x.{sig}", {"answer": "True"})
    assert result["ok"] is False


def test_grade_rejects_expired_token():
    q = engine.generate(tier=1, seed=1)
    payload = core.verify(q["token"])
    payload["ts"] -= core.TOKEN_TTL_SECONDS + 60
    expired = core.sign(payload)
    result = engine.grade(expired, {"answer": "True"})
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
    assert engine.parse_weak_concepts(f" {tpl.C_CASE} ,junk,") == {tpl.C_CASE}


def test_tier_band_windows_cover_every_band():
    seen = set()
    for tier in range(1, 6):
        seen |= set(tpl.TIER_BANDS[tier])
    assert seen == set(core.BANDS)
