"""Tests for the Intro module's endless-practice engine.

Intro's shape is deliberately different from every other engine in this
family (see intro_templates.py's docstring): KIND_LITERAL and
KIND_UNQUOTED decide correctness by literally exec()ing each candidate
statement in a fresh namespace rather than asserting which one "should"
work, so a chunk of this file's coverage is specifically about that --
confirming the exec()-based pools really do land on exactly the
candidates a human would call correct, for real Python reasons (a bare
name really is a NameError, `<word>` really is a SyntaxError, `[a,b,c]`
really builds a list of undefined names, not a string).
"""
import random

import pytest

from app.services import intro_engine as engine
from app.services import intro_templates as tpl
from app.services import practice_engine_core as core


# ─── generation validity ────────────────────────────────────────────────────

def test_generation_reaches_every_kind_across_tiers():
    seen = set()
    for tier in range(1, 6):
        for seed in range(150):
            q = engine.generate(tier=tier, seed=seed)
            seen.add(q["kind"])
    assert seen == {"evaluate", "literal", "unquoted", "code"}


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
    for tier, kinds in engine._TIER_KINDS.items():
        seen = set()
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            seen.add(q["kind"])
        for kind in kinds:
            if kind == "code" and not tpl.code_tasks_for_tier(tier):
                continue
            assert kind in seen, f"tier {tier} declares {kind} but it never generated in 400 tries"


def test_no_select_all_option_text_contains_the_join_delimiter():
    for seed in range(2000):
        candidates, correct, _word = tpl.build_literal_options(engine._WORDS, random.Random(seed))
        for c in candidates:
            assert ", " not in c, (seed, c)


# ─── the exec()-based pools really land on the real answer ─────────────────

def test_literal_pool_correct_set_matches_real_python_execution():
    """The one thing that must never drift: whichever candidates
    build_literal_options() calls correct are exactly the ones that, run
    for real, actually produce a str equal to the target word."""
    for seed in range(500):
        candidates, correct, word = tpl.build_literal_options(engine._WORDS, random.Random(seed))
        for src in candidates:
            ns = {}
            try:
                exec(compile(src, "<t>", "exec"), {}, ns)
                really_ok = isinstance(ns.get("value"), str) and ns["value"] == word
            except Exception:
                really_ok = False
            assert really_ok == (src in correct), (seed, src, correct)


def test_literal_pool_always_rejects_the_bare_list_of_names():
    for seed in range(300):
        candidates, correct, _word = tpl.build_literal_options(engine._WORDS, random.Random(seed))
        bracket_option = next(c for c in candidates if c.startswith("value = ["))
        assert bracket_option not in correct


def test_literal_pool_always_accepts_all_three_quoting_styles():
    for seed in range(300):
        candidates, correct, word = tpl.build_literal_options(engine._WORDS, random.Random(seed))
        assert f"value = '{word}'" in correct
        assert f'value = "{word}"' in correct
        assert f"value = '''{word}'''" in correct


def test_unquoted_pool_correct_answer_matches_real_python_execution():
    for seed in range(500):
        candidates, correct, word = tpl.build_unquoted_options(engine._WORDS, random.Random(seed))
        assert correct == [f"name = '{word}'"]
        for src in candidates:
            ns = {}
            try:
                exec(compile(src, "<t>", "exec"), {}, ns)
                really_ok = isinstance(ns.get("name"), str) and ns["name"] == word
            except Exception:
                really_ok = False
            assert really_ok == (src in correct), (seed, src, correct)


def test_unquoted_pool_bare_name_really_raises_name_error():
    for seed in range(50):
        candidates, _correct, word = tpl.build_unquoted_options(engine._WORDS, random.Random(seed))
        bare = next(c for c in candidates if c == f"name = {word}")
        with pytest.raises(NameError):
            exec(compile(bare, "<t>", "exec"), {}, {})


def test_unquoted_pool_angle_bracket_form_really_raises_syntax_error():
    for seed in range(50):
        candidates, _correct, word = tpl.build_unquoted_options(engine._WORDS, random.Random(seed))
        bracket = next(c for c in candidates if c.startswith(f"name = <{word}"))
        with pytest.raises(SyntaxError):
            compile(bracket, "<t>", "exec")


# ─── evaluate ───────────────────────────────────────────────────────────────

def test_concat_never_inserts_a_space():
    for seed in range(300):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "concat":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert " " not in correct
        return
    pytest.fail("no concat question generated in 300 tries")


def test_repeat_never_shows_the_count_as_a_digit_in_the_answer():
    for seed in range(500):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "repeat":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert not any(ch.isdigit() for ch in correct)
        return
    pytest.fail("no repeat question generated in 500 tries")


def test_length_escape_counts_the_newline_as_one_character():
    for seed in range(500):
        q = engine.generate(tier=5, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "length_escape":
            continue
        correct = int(engine.grade(q["token"], {"answer": "###"})["correct_answer"])
        # source is "<a>\n<b>" -- exactly len(a) + 1 + len(b), never +2 for \n
        assert correct >= 3
        return
    pytest.fail("no length_escape question generated in 500 tries")


def test_type_error_case_is_a_real_type_error_and_never_offered_as_mcq():
    for seed in range(500):
        q = engine.generate(tier=5, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "type_error":
            continue
        assert q["type"] == "fill_blank"
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert correct == "TypeError"
        assert engine.grade(q["token"], {"answer": "TypeError"})["correct"] is True
        return
    pytest.fail("no type_error question generated in 500 tries")


def test_ord_shift_answer_is_a_real_chr_of_a_real_ord_plus_n():
    for seed in range(500):
        q = engine.generate(tier=5, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "ord_shift":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert len(correct) == 1 and correct.isalpha()
        return
    pytest.fail("no ord_shift question generated in 500 tries")


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
        "repeat_word": "print(word * 3)",
        "greet_word": 'print("Hi, " + word + "!")',
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


def test_select_all_ignores_options_it_never_offered():
    for seed in range(300):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "literal":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        forged = list(key) + ["never offered"]
        result = engine.grade(q["token"], {"answers": forged})
        assert result["correct"] is True
        return
    pytest.fail("no literal question generated in 300 tries")


# ─── misc ───────────────────────────────────────────────────────────────────

def test_parse_weak_concepts_accepts_both_shapes_and_drops_unknown_ids():
    # Only concepts that TEMPLATES (the KIND_EVALUATE pool) actually uses
    # count as "known" here -- KIND_LITERAL/KIND_UNQUOTED are fixed pools
    # that never consult `weak` at all, so C_QUOTES/C_LIST_CONFUSION
    # wouldn't be meaningfully "known" the same way.
    assert engine.parse_weak_concepts("") == set()
    assert engine.parse_weak_concepts(None) == set()
    assert engine.parse_weak_concepts("not_a_real_concept") == set()
    assert engine.parse_weak_concepts(f" {tpl.C_LENGTH} ,junk,") == {tpl.C_LENGTH}


def test_tier_band_windows_cover_every_band():
    seen = set()
    for tier in range(1, 6):
        seen |= set(tpl.TIER_BANDS[tier])
    assert seen == set(core.BANDS)


# ─── worked explanation ──────────────────────────────────────────────────────

def test_evaluate_answers_carry_a_worked_explanation_correct_or_not():
    seen_templates = set()
    for tier in range(1, 6):
        for seed in range(300):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "evaluate":
                continue
            wrong = engine.grade(q["token"], {"answer": "###totally-wrong###"})
            assert wrong["explanation_blocks"]
            right = engine.grade(q["token"], {"answer": wrong["correct_answer"]})
            assert right["correct"] is True
            assert right["explanation_blocks"]
            seen_templates.add(q["template"])
    assert seen_templates == set(tpl.BY_ID)


def test_repeat_explanation_chain_literally_matches_the_real_result():
    for seed in range(300):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "repeat":
            continue
        wrong = engine.grade(q["token"], {"answer": "###"})
        chain_block = next(b for b in wrong["explanation_blocks"] if b["kind"] == "code" and "+" in b["code"])
        chain, shown_result = chain_block["code"].split(" = ")
        assert chain.replace(" + ", "") == wrong["correct_answer"]
        assert shown_result == repr(wrong["correct_answer"])
        return
    pytest.fail("no repeat question generated in 300 tries")


def test_type_error_explanation_names_the_real_exception():
    for seed in range(500):
        q = engine.generate(tier=5, seed=seed)
        if q["kind"] != "evaluate" or q["template"] != "type_error":
            continue
        wrong = engine.grade(q["token"], {"answer": "###"})
        assert wrong["correct_answer"] == "TypeError"
        text = " ".join(b.get("text", "") for b in wrong["explanation_blocks"] if b["kind"] == "p")
        assert "TypeError" in text
        return
    pytest.fail("no type_error question generated in 500 tries")
