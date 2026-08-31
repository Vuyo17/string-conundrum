"""Tests for the Formatting module's endless-practice engine.

Same coverage philosophy as the other engines' test files. Formatting's
own regression here: KIND_COUNT's predicate (a "\\n" in the printed
output) is only ever satisfied by newline_count/tab_and_newline, both
BAND_MEDIUM_HARD -- one band above tier 3's window -- so KIND_COUNT
could not actually be declared reachable until tier 4, the same
unreachable-kind bug class caught in every other lightweight-template
engine (see test_every_declared_kind_actually_generates_at_every_tier_it_names).
"""
import random

import pytest

from app.services import formatting_engine as engine
from app.services import formatting_templates as tpl
from app.services import practice_engine_core as core


# ─── generation validity ────────────────────────────────────────────────────

def test_generation_reaches_every_kind_across_tiers():
    seen = set()
    for tier in range(1, 6):
        for seed in range(150):
            q = engine.generate(tier=tier, seed=seed)
            seen.add(q["kind"])
    assert seen == {"evaluate", "count", "identify", "code"}


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
    requirements. generate()'s retry-across-kinds silently papers over a
    single failed kind by trying another, so this has to be checked
    directly rather than relying on "generate() didn't crash"."""
    for tier, kinds in engine._TIER_KINDS.items():
        seen = set()
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            seen.add(q["kind"])
        for kind in kinds:
            if kind == "code" and not tpl.code_tasks_for_tier(tier):
                continue
            assert kind in seen, f"tier {tier} declares {kind} but it never generated in 400 tries"


# ─── delimiter-collision defense ────────────────────────────────────────────

def test_no_select_all_option_text_contains_the_join_delimiter():
    """Every select_all kind serializes its correct-answer set with
    ", ".join(...) and the frontend parses it back with .split(", ") --
    an option whose own text contains a literal ", " corrupts that
    round-trip (a display bug, since actual grading compares real sets,
    not the joined string; still worth guarding against directly, as
    every other lightweight-template engine ended up needing this fix)."""
    for seed in range(2000):
        texts, correct, *_ = engine._build_identify_options(random.Random(seed))
        for t in texts:
            assert ", " not in t, (seed, t)


# ─── evaluate ───────────────────────────────────────────────────────────────

def test_evaluate_answer_matches_the_real_printed_output():
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "evaluate":
            continue
        wrong = engine.grade(q["token"], {"answer": "###"})
        correct = wrong["correct_answer"]
        assert correct  # real printed text, never empty for this family
        assert engine.grade(q["token"], {"answer": correct})["correct"] is True
        return
    pytest.fail("no evaluate question generated in 200 tries")


def test_missing_fstring_prefix_prints_the_literal_braces():
    for seed in range(500):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "fstring_missing_prefix":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert "{" in correct and "}" in correct
        return
    pytest.fail("no fstring_missing_prefix question generated in 500 tries")


def test_evaluate_fill_blank_handles_multiline_printed_output():
    for seed in range(500):
        q = engine.generate(tier=5, seed=seed)
        if q["kind"] != "evaluate" or q["type"] != "fill_blank":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        if "\n" not in correct:
            continue
        assert engine.grade(q["token"], {"answer": correct})["correct"] is True
        assert engine.grade(q["token"], {"answer": f"  {correct}  "})["correct"] is True
        return
    pytest.fail("no multiline evaluate question generated in 500 tries")


def test_multiline_flag_is_set_exactly_when_the_printed_output_has_a_newline():
    """A single-line <input> has nowhere for Enter to put a newline, so
    the frontend switches to a <textarea> whenever question["multiline"]
    is set -- it must be set on every fill_blank evaluate question whose
    correct answer actually spans more than one line, and never
    otherwise (an unnecessary textarea for a one-line answer is a UX
    regression too)."""
    checked_multiline = checked_single_line = False
    for tier in range(1, 6):
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "evaluate" or q["type"] != "fill_blank":
                continue
            correct_answer = engine.core.verify(q["token"])["result"]
            if "\n" in correct_answer:
                assert q.get("multiline") is True, q
                checked_multiline = True
            else:
                assert not q.get("multiline"), q
                checked_single_line = True
    assert checked_multiline and checked_single_line


# ─── count ──────────────────────────────────────────────────────────────────

def test_count_answer_matches_the_real_line_count():
    for seed in range(500):
        q = engine.generate(tier=4, seed=seed)
        if q["kind"] != "count":
            continue
        correct = engine.grade(q["token"], {"answer": "0"})["correct_answer"]
        assert int(correct) >= 1
        assert engine.grade(q["token"], {"answer": correct})["correct"] is True
        return
    pytest.fail("no count question generated in 500 tries")


def test_count_is_always_fill_blank_never_mcq():
    """KIND_COUNT is never declared reachable before tier 4 (its templates
    start at BAND_MEDIUM_HARD), and tier > _MAX_MCQ_TIER already disables
    mcq -- so offering FORMAT_MCQ for count would be a format that can
    never actually be picked, the same unreachable-declaration bug class
    as an unreachable band, just one layer up. _KIND_FORMATS deliberately
    omits it; this locks that down."""
    seen = False
    for seed in range(500):
        q = engine.generate(tier=4, seed=seed)
        if q["kind"] != "count":
            continue
        assert q["type"] == "fill_blank"
        seen = True
    assert seen, "no count question generated in 500 tries"


# ─── identify ───────────────────────────────────────────────────────────────

def test_identify_correct_options_all_really_print_the_target():
    for seed in range(300):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "identify":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        assert key
        assert len(q["options"]) == 4
        return
    pytest.fail("no identify question generated in 300 tries")


def test_identify_pool_always_includes_the_missing_prefix_trap():
    for seed in range(300):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "identify":
            continue
        assert any(o.startswith('"') and not o.startswith('f"') for o in q["options"])
        return
    pytest.fail("no identify question generated in 300 tries")


def test_select_all_ignores_options_it_never_offered():
    for seed in range(300):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "identify":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        forged = list(key) + ["never offered"]
        result = engine.grade(q["token"], {"answers": forged})
        assert result["correct"] is True
        return
    pytest.fail("no identify question generated in 300 tries")


def test_identical_seed_reproduces_the_identical_identify_pool():
    for seed in (1, 42, 999, 123456):
        p1 = engine._build_identify_options(random.Random(seed))
        p2 = engine._build_identify_options(random.Random(seed))
        assert p1 == p2, seed


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


def test_write_code_accepts_the_real_solution_for_each_task():
    solutions = {
        "fstring_greeting": 'print(f"Hello, {word}!")',
        "format_positions": 'print("{} {}".format(word[::-1], word))',
    }
    seen = set()
    for tier in (4, 5):
        for seed in range(300):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "code" or q["template"] in seen:
                continue
            result = engine.grade(q["token"], {"code": solutions[q["template"]]})
            assert result["correct"] is True, (q["template"], result)
            seen.add(q["template"])
    assert seen == set(solutions)


# ─── token security ─────────────────────────────────────────────────────────

def test_grade_rejects_tampered_token():
    q = engine.generate(tier=1, seed=1)
    body, sig = q["token"].split(".", 1)
    result = engine.grade(f"{body}x.{sig}", {"answer": "###"})
    assert result["ok"] is False


def test_grade_rejects_expired_token():
    q = engine.generate(tier=1, seed=1)
    payload = core.verify(q["token"])
    payload["ts"] -= core.TOKEN_TTL_SECONDS + 60
    expired = core.sign(payload)
    result = engine.grade(expired, {"answer": "###"})
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


# ─── misc ───────────────────────────────────────────────────────────────────

def test_parse_weak_concepts_accepts_both_shapes_and_drops_unknown_ids():
    assert engine.parse_weak_concepts("") == set()
    assert engine.parse_weak_concepts(None) == set()
    assert engine.parse_weak_concepts("not_a_real_concept") == set()
    assert engine.parse_weak_concepts(f" {tpl.C_FSTRING_PREFIX} ,junk,") == {tpl.C_FSTRING_PREFIX}


def test_tier_band_windows_cover_every_band():
    seen = set()
    for tier in range(1, 6):
        seen |= set(tpl.TIER_BANDS[tier])
    assert seen == set(core.BANDS)
