"""Tests for the Looping module's endless-practice engine.

Same coverage philosophy as test_indexing_engine.py: generation validity
across tiers/kinds, grading correctness, token security -- plus a
regression test for the specific "code task banded below where KIND_CODE
ever fires" bug found while building this file (print_each_char was tagged
BAND_EASY_MEDIUM, but KIND_CODE only appears in _TIER_KINDS from tier 4,
whose band window starts at MEDIUM -- an unreachable-by-construction task
that generating a few hundred questions and checking coverage caught
immediately).
"""
import pytest

from app.services import looping_engine as engine
from app.services import looping_templates as tpl
from app.services import practice_engine_core as core


# ─── generation validity ────────────────────────────────────────────────────

def test_generation_reaches_every_kind_across_tiers():
    seen = set()
    for tier in range(1, 6):
        for seed in range(150):
            q = engine.generate(tier=tier, seed=seed)
            seen.add(q["kind"])
    assert seen == {"count", "trace", "error", "code"}


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
    """Every CODE_TASKS entry must actually get drawn within some tier
    KIND_CODE can fire in -- a band placed below the lowest tier that
    offers KIND_CODE at all is unreachable by construction. Generating a
    generous sample from every tier and checking full coverage is the
    same check that caught print_each_char's original mistagging."""
    code_capable_tiers = [t for t, kinds in engine._TIER_KINDS.items() if "code" in kinds]
    seen_templates = set()
    for tier in code_capable_tiers:
        for seed in range(300):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] == "code":
                seen_templates.add(q["template"])
    assert seen_templates == set(tpl.CODE_TASKS), (
        f"unreachable code tasks: {set(tpl.CODE_TASKS) - seen_templates}"
    )


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
            if kind == "code" and not tpl.code_tasks_for_tier(tier):
                continue
            assert kind in seen, f"tier {tier} declares {kind} but it never generated in 400 tries"


# ─── count ───────────────────────────────────────────────────────────────────

def test_count_answer_matches_the_real_number_of_printed_lines():
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "count":
            continue
        wrong = engine.grade(q["token"], {"answer": "###"})
        correct = wrong["correct_answer"]
        assert correct.isdigit()
        assert engine.grade(q["token"], {"answer": correct})["correct"] is True
        # off by one in either direction must be wrong
        assert engine.grade(q["token"], {"answer": str(int(correct) + 1)})["correct"] is False
        assert engine.grade(q["token"], {"answer": str(max(0, int(correct) - 1))})["correct"] is False
        return
    pytest.fail("no count question generated in 200 tries")


def test_count_mcq_offers_the_off_by_one_shape():
    for seed in range(300):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "count" or q["type"] != "mcq":
            continue
        assert len(q["options"]) >= 2
        assert len(set(q["options"])) == len(q["options"])
        return
    pytest.fail("no mcq count question generated in 300 tries")


# ─── trace ───────────────────────────────────────────────────────────────────

def test_trace_answer_matches_the_real_printed_output():
    for seed in range(200):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "trace":
            continue
        wrong = engine.grade(q["token"], {"answer": "###"})
        correct = wrong["correct_answer"]
        assert engine.grade(q["token"], {"answer": correct})["correct"] is True
        return
    pytest.fail("no trace question generated in 200 tries")


def test_multiline_flag_is_set_exactly_when_the_trace_spans_more_than_one_line():
    """A single-line <input> has nowhere for Enter to put a newline, so
    the frontend switches to a <textarea> whenever question["multiline"]
    is set -- a trace question whose loop prints more than once needs it
    set, or its own correct answer is unanswerable through the UI. Every
    loop template here iterates at least twice, so in practice this
    always lands on the multiline branch -- checked directly instead of
    just asserted, so the test still means something if that ever
    changes."""
    checked = False
    for tier in range(1, 6):
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "trace" or q["type"] != "fill_blank":
                continue
            correct_answer = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
            assert q.get("multiline") is bool("\n" in correct_answer), q
            checked = True
    assert checked


def test_trace_never_asks_about_a_loop_that_raises():
    for seed in range(300):
        q = engine.generate(tier=4, seed=seed)
        if q["kind"] != "trace":
            continue
        # A loop that raises produces no reliable "what does it print in
        # full" answer -- _pick_loop(allow_raise=False) must have excluded
        # it. Indirect check: the correct answer is never empty (a raising
        # while_off_by_one_over with n=0 would be, but words have a
        # length floor well above zero).
        wrong = engine.grade(q["token"], {"answer": "###"})
        assert wrong["correct_answer"] != ""


# ─── error ──────────────────────────────────────────────────────────────────

def test_error_key_headers_really_raise_when_attempted():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "error":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        assert key
        assert key.issubset(set(q["options"]))
        result = engine.grade(q["token"], {"answers": list(key)})
        assert result["correct"] is True
        return
    pytest.fail("no error question generated in 300 tries")


def test_error_options_include_both_a_raising_and_a_safe_header():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "error":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        assert 0 < len(key) < len(q["options"])
        return
    pytest.fail("no error question generated in 300 tries")


def test_select_all_ignores_options_it_never_offered():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "error":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        forged = list(key) + ["while i < 99999999:"]
        result = engine.grade(q["token"], {"answers": forged})
        assert result["correct"] is True
        return
    pytest.fail("no error question generated in 300 tries")


# ─── write_code ─────────────────────────────────────────────────────────────

def test_write_code_rejects_a_hardcoded_answer():
    for tier in (4, 5):
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "code":
                continue
            result = engine.grade(q["token"], {"code": 'print("nope")'})
            assert result["correct"] is False
            return
    pytest.fail("no code question generated")


def test_write_code_reports_an_empty_submission():
    for tier in (4, 5):
        for seed in range(400):
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
    result = engine.grade(f"{body}x.{sig}", {"answer": "1"})
    assert result["ok"] is False


def test_grade_rejects_expired_token():
    q = engine.generate(tier=1, seed=1)
    payload = core.verify(q["token"])
    payload["ts"] -= core.TOKEN_TTL_SECONDS + 60
    expired = core.sign(payload)
    result = engine.grade(expired, {"answer": "1"})
    assert result["ok"] is False
    assert "expired" in result["error"]


def test_grade_accepts_a_bare_string_as_shorthand_for_answer():
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "count":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert engine.grade(q["token"], correct)["correct"] is True
        return
    pytest.fail("no count question generated in 200 tries")


# ─── adaptive weighting ─────────────────────────────────────────────────────

def test_parse_weak_concepts_accepts_both_shapes_and_drops_unknown_ids():
    assert engine.parse_weak_concepts("") == set()
    assert engine.parse_weak_concepts(None) == set()
    assert engine.parse_weak_concepts("not_a_real_concept") == set()
    assert engine.parse_weak_concepts(f" {tpl.C_OFF_BY_ONE} ,junk,") == {tpl.C_OFF_BY_ONE}


def test_tier_band_windows_cover_every_band():
    seen = set()
    for tier in range(1, 6):
        seen |= set(tpl.TIER_BANDS[tier])
    assert seen == set(core.BANDS)


# ─── worked explanation ──────────────────────────────────────────────────────

def test_count_and_trace_answers_carry_a_worked_explanation_correct_or_not():
    seen_kinds = set()
    for tier in range(1, 6):
        for seed in range(300):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] not in ("count", "trace"):
                continue
            wrong = engine.grade(q["token"], {"answer": "###"})
            assert wrong["correct"] is False
            assert wrong["explanation_blocks"]
            right = engine.grade(q["token"], {"answer": wrong["correct_answer"]})
            assert right["correct"] is True
            assert right["explanation_blocks"]
            seen_kinds.add(q["kind"])
    assert seen_kinds == {"count", "trace"}


def test_worked_explanation_table_matches_the_real_printed_lines():
    """Every row the explanation table shows must be exactly one of the
    loop's own real, directly-computed lines -- never a re-derived or
    hand-simulated stand-in."""
    for seed in range(200):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] not in ("count", "trace"):
            continue
        payload = core.verify(q["token"])
        lines = payload["lines"]
        blocks = engine._build_loop_explanation(lines, q["kind"])
        if not lines:
            continue
        table = next(b for b in blocks if b["kind"] == "table")
        shown = [row[1] for row in table["rows"]]
        assert shown == [engine._loop_quoted(line) for line in lines]
        return
    pytest.fail("no count/trace question generated in 200 tries")
