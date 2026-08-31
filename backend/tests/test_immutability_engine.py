"""Tests for the Immutability module's endless-practice engine.

Same coverage philosophy as the other engines' test files, plus a
regression test for the real bug this one caught: an option's own text
containing a literal ", " sequence (`"word".replace('a', 'b')`, from the
two-argument call) collided with the "join the correct-answer set with
', '" scheme every select_all kind in this engine family uses to
serialise it, corrupting how the client parses the correct set back out
after grading. Also verifies the __setitem__-vs-real-syntax distinction
directly: string objects don't define __setitem__ at all, so calling it
raises AttributeError, a different exception from what `s[i] = x` raises
through the interpreter's own protocol (TypeError) -- the templates here
have to run the real statement, not a stand-in for it, to report the
exception a learner would actually see.
"""
import pytest

from app.services import immutability_engine as engine
from app.services import immutability_templates as tpl
from app.services import practice_engine_core as core


# ─── generation validity ────────────────────────────────────────────────────

def test_generation_reaches_every_kind_across_tiers():
    seen = set()
    for tier in range(1, 6):
        for seed in range(150):
            q = engine.generate(tier=tier, seed=seed)
            seen.add(q["kind"])
    assert seen == {"predict", "fix", "identify", "code"}


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


# ─── the delimiter-collision regression itself ──────────────────────────────

def test_correct_answer_string_parses_back_to_the_real_correct_set():
    """The exact bug: `"word".replace('a', 'b')`'s own internal ", "
    corrupted `", ".join(sorted(key))` when parsed back with `.split(", ")`
    the way the client does. Checked by doing exactly that round trip and
    confirming what comes out is what was actually graded correct --- not
    just that grading itself passes, which used a real list, not the
    string, and would not have caught this on its own."""
    for tier in range(1, 6):
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "identify":
                continue
            empty = engine.grade(q["token"], {"answers": []})
            parsed_back = set(empty["correct_answer"].split(", ")) if empty["correct_answer"] else set()
            assert parsed_back <= set(q["options"]), (tier, seed, q, empty)
            result = engine.grade(q["token"], {"answers": list(parsed_back)})
            assert result["correct"] is True, (tier, seed, q, empty, result)
            return
    pytest.fail("no identify question generated")


def test_no_select_all_option_text_contains_the_join_delimiter():
    """Belt and braces, for select_all questions specifically: only that
    format's correct-answer set is ever serialised with ", ".join() and
    parsed back with .split(", ") (an mcq's single correct_answer is
    compared as one whole value, never split, so it's exempt from this
    particular failure mode even though it may itself contain a comma --
    see e.g. "It changes word as shown, in place.")."""
    for tier in range(1, 6):
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            if q["type"] != "select_all":
                continue
            for opt in q.get("options") or []:
                assert ", " not in opt, (tier, seed, q, opt)


# ─── predict ─────────────────────────────────────────────────────────────────

def test_item_assignment_really_raises_type_error_not_attribute_error():
    """str has no __setitem__ at all, so a naive `s.__setitem__(i, x)`
    stand-in raises AttributeError -- a different exception from what the
    real `s[i] = x` syntax raises (TypeError) through the interpreter's
    own item-assignment protocol. The template has to use the real
    syntax, not the dunder call, to report what a learner would see."""
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "predict" or q["template"] != "item_assign":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert "TypeError" in correct
        assert "AttributeError" not in correct
        return
    pytest.fail("no item_assign predict question generated in 200 tries")


def test_predict_answer_matches_a_real_outcome():
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "predict":
            continue
        wrong = engine.grade(q["token"], {"answer": "###"})
        correct = wrong["correct_answer"]
        assert engine.grade(q["token"], {"answer": correct})["correct"] is True
        return
    pytest.fail("no predict question generated in 200 tries")


def test_method_not_reassigned_prints_the_original_unchanged():
    for seed in range(300):
        # method_not_reassigned is BAND_MEDIUM, which first appears in
        # tier 3's window -- tier 2 (EASY/EASY_MEDIUM only) never draws it.
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "predict" or q["template"] != "method_not_reassigned":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert "never stored" in correct or "unchanged" in correct
        return
    pytest.fail("no method_not_reassigned predict question generated in 300 tries")


# ─── fix ─────────────────────────────────────────────────────────────────────

def test_fix_answer_is_a_real_reassignment_that_actually_works():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "fix":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert correct.startswith("word = word.")
        # Run for real: the fix must not raise, and must genuinely change
        # a starting value rather than being a no-op disguised as one.
        # "  ZeBrA  " has padding AND mixed case, so it changes under
        # every method this engine ever fixes (upper/lower/strip, or the
        # chained upper().strip()) -- a plain lowercase seed would be a
        # false-negative fixed point for .lower() specifically.
        start = "  ZeBrA  "
        ns = {"word": start}
        exec(correct, ns)
        assert ns["word"] != start
        assert engine.grade(q["token"], {"answer": correct})["correct"] is True
        return
    pytest.fail("no fix question generated in 300 tries")


# ─── write_code ─────────────────────────────────────────────────────────────

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


# ─── adaptive weighting ─────────────────────────────────────────────────────

def test_parse_weak_concepts_accepts_both_shapes_and_drops_unknown_ids():
    assert engine.parse_weak_concepts("") == set()
    assert engine.parse_weak_concepts(None) == set()
    assert engine.parse_weak_concepts("not_a_real_concept") == set()
    assert engine.parse_weak_concepts(f" {tpl.C_IN_PLACE} ,junk,") == {tpl.C_IN_PLACE}


def test_tier_band_windows_cover_every_band():
    seen = set()
    for tier in range(1, 6):
        seen |= set(tpl.TIER_BANDS[tier])
    assert seen == set(core.BANDS)
