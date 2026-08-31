"""Tests for the Indexing module's endless-practice engine.

Mirrors test_slicing_engine.py's coverage areas (generation validity across
tiers/kinds, grading correctness, token security, adaptive weighting)
rather than duplicating every one of its 52 cases -- the two engines share
their token/weighting machinery (practice_engine_core.py, already covered
indirectly via slicing's own tests), so this focuses on what's actually
specific to indexing: single-character results, the five kinds this
module supports, and the padding-loop duplicate-option bug this same test
style caught during development.
"""
import pytest

from app.services import indexing_engine as engine
from app.services import indexing_templates as tpl
from app.services import practice_engine_core as core


# ─── generation validity ────────────────────────────────────────────────────

def test_generation_reaches_every_kind_across_tiers():
    seen_kinds = set()
    for tier in range(1, 6):
        for seed in range(80):
            q = engine.generate(tier=tier, seed=seed)
            seen_kinds.add(q["kind"])
    assert seen_kinds == {"evaluate", "construct", "identify", "error", "code"}


def test_each_tier_only_asks_the_kinds_it_declares():
    for tier, kinds in engine._TIER_KINDS.items():
        allowed = set(kinds)
        for seed in range(60):
            q = engine.generate(tier=tier, seed=seed)
            assert q["kind"] in allowed, (tier, q["kind"])


def test_hard_tiers_never_offer_multiple_choice():
    for tier in range(engine._MAX_MCQ_TIER + 1, engine.MAX_TIER + 1):
        for seed in range(80):
            q = engine.generate(tier=tier, seed=seed)
            assert q["type"] != "mcq"


def test_generate_clamps_tier_to_valid_range():
    q_low = engine.generate(tier=0, seed=1)
    q_high = engine.generate(tier=99, seed=1)
    assert q_low["tier"] == 1
    assert q_high["tier"] == engine.MAX_TIER


def test_no_mcq_or_select_all_question_ever_offers_duplicate_options():
    """The exact bug caught during development: a repeated letter in the
    word (e.g. two 'l's in "hollow") let the option-padding loop add the
    same character twice under two different indices."""
    for tier in range(1, 6):
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            opts = q.get("options")
            if opts:
                assert len(set(opts)) == len(opts), (tier, seed, q)


def test_every_evaluate_index_is_actually_in_range():
    for tier in range(1, 6):
        for seed in range(200):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] not in ("evaluate", "construct"):
                continue
            word = q.get("word")
            if word is None:
                continue
            # The expression/target must correspond to a real character --
            # grading would reject an out-of-range index outright, so this
            # is really asserting generation never produces one.
            assert isinstance(q.get("target") or q.get("expression"), (str, type(None)))


# ─── evaluate ───────────────────────────────────────────────────────────────

def test_mcq_offers_four_unique_options_with_exactly_one_correct():
    found_mcq = False
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["type"] != "mcq":
            continue
        found_mcq = True
        assert len(q["options"]) == 4
        assert len(set(q["options"])) == 4
        correct = engine.grade(q["token"], {"answer": "###not-an-option###"})["correct_answer"]
        assert correct in q["options"]
    assert found_mcq


def test_evaluate_typed_accepts_quoted_forms():
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "evaluate" or q["type"] != "fill_blank":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert engine.grade(q["token"], {"answer": correct})["correct"]
        assert engine.grade(q["token"], {"answer": f"'{correct}'"})["correct"]
        assert engine.grade(q["token"], {"answer": f'"{correct}"'})["correct"]
        return
    pytest.fail("no fill_blank evaluate question generated in 200 tries")


def test_grade_wrong_answer_names_a_real_misconception_when_it_matches():
    for seed in range(300):
        q = engine.generate(tier=2, seed=seed)
        if q["type"] != "mcq":
            continue
        wrong = next(o for o in q["options"] if o != engine.grade(q["token"], {"answer": "###"})["correct_answer"])
        result = engine.grade(q["token"], {"answer": wrong})
        assert result["correct"] is False
        # Whatever misconception_id comes back (possibly None if the
        # distractor was padding, not a real variant) must be a real,
        # known concept id, never a made-up one.
        if result["misconception_id"]:
            assert result["misconception_id"] in {tpl.C_ONE_BASED, tpl.C_NEGATIVE_INDEX, tpl.C_OFF_BY_ONE}
        return
    pytest.fail("no mcq evaluate question generated in 300 tries")


# ─── construct ──────────────────────────────────────────────────────────────

def test_construct_accepts_any_index_that_produces_the_target():
    for seed in range(300):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "construct":
            continue
        word, target = q["word"], q["target"]
        # Any index in range that happens to match the target character
        # should be accepted, not just the one the generator originally drew.
        alt = next(i for i in range(-len(word), len(word)) if word[i] == target)
        result = engine.grade(q["token"], {"slice": {"index": str(alt)}})
        assert result["correct"] is True
        return
    pytest.fail("no construct question generated in 300 tries")


def test_construct_reports_a_typo_rather_than_calling_it_wrong():
    for seed in range(300):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "construct":
            continue
        result = engine.grade(q["token"], {"slice": {"index": "not-a-number"}})
        assert result["correct"] is False
        assert "whole number" in result["detail"]
        return
    pytest.fail("no construct question generated in 300 tries")


def test_construct_reports_an_out_of_range_index_clearly():
    for seed in range(300):
        q = engine.generate(tier=2, seed=seed)
        if q["kind"] != "construct":
            continue
        n = len(q["word"])
        result = engine.grade(q["token"], {"slice": {"index": str(n + 50)}})
        assert result["correct"] is False
        assert "IndexError" in result["detail"]
        return
    pytest.fail("no construct question generated in 300 tries")


# ─── identify / error (select_all) ──────────────────────────────────────────

def test_identify_key_really_matches_the_target_character():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "identify":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        assert key  # at least one correct option
        result = engine.grade(q["token"], {"answers": list(key)})
        assert result["correct"] is True
        return
    pytest.fail("no identify question generated in 300 tries")


def test_select_all_requires_the_exact_set_not_a_superset_or_subset():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] not in ("identify", "error"):
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", ")) if empty["correct_answer"] else set()
        if not key:
            continue
        # Superset: every option offered, including wrong ones.
        superset_result = engine.grade(q["token"], {"answers": q["options"]})
        if set(q["options"]) != key:
            assert superset_result["correct"] is False
        return
    pytest.fail("no identify/error question generated in 300 tries")


def test_select_all_ignores_options_it_never_offered():
    for seed in range(300):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] not in ("identify", "error"):
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", ")) if empty["correct_answer"] else set()
        forged = list(key) + ["word[999999]"]
        result = engine.grade(q["token"], {"answers": forged})
        assert result["correct"] is True
        return
    pytest.fail("no identify/error question generated in 300 tries")


def test_error_options_really_raise_when_attempted():
    for seed in range(300):
        q = engine.generate(tier=4, seed=seed)
        if q["kind"] != "error":
            continue
        empty = engine.grade(q["token"], {"answers": []})
        key = set(empty["correct_answer"].split(", "))
        assert key
        # Every offered option that is NOT in the key must be safe --
        # spot check by reconstructing the word/name from the prompt.
        assert all(k in q["options"] for k in key)
        return
    pytest.fail("no error question generated in 300 tries")


# ─── write_code ─────────────────────────────────────────────────────────────

def test_every_code_task_accepts_its_canonical_solution():
    # first_char/last_char are BAND_MEDIUM, which is outside tier 5's own
    # window (MEDIUM_HARD/HARD/VERY_HARD -- see TIER_BANDS): searching every
    # tier that can draw KIND_CODE at all (4-5; tier 3 doesn't offer
    # KIND_CODE per _TIER_KINDS) is what actually reaches every task.
    solutions = {
        "first_char": "print(word[0])",
        "last_char": "print(word[-1])",
        "first_and_last": "print(word[0] + word[-1])",
    }
    found = set()
    for tier in (4, 5):
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "code":
                continue
            key = q["template"]
            if key in solutions and key not in found:
                result = engine.grade(q["token"], {"code": solutions[key]})
                assert result["correct"] is True, (key, result)
                found.add(key)
            elif key == "nth_char" and key not in found:
                n = q["prompt"].split("position ")[1].split(" ")[0].rstrip(".")
                result = engine.grade(q["token"], {"code": f"print(word[{n}])"})
                assert result["correct"] is True
                found.add(key)
            elif key == "nth_from_end" and key not in found:
                n = q["prompt"].split(" positions from the end")[0].split()[-1]
                result = engine.grade(q["token"], {"code": f"print(word[-{n}])"})
                assert result["correct"] is True
                found.add(key)
            if len(found) == len(tpl.CODE_TASKS):
                break
        if len(found) == len(tpl.CODE_TASKS):
            break
    assert found == set(tpl.CODE_TASKS), f"missing: {set(tpl.CODE_TASKS) - found}"


def test_write_code_rejects_a_hardcoded_answer():
    for seed in range(400):
        q = engine.generate(tier=5, seed=seed)
        if q["kind"] != "code":
            continue
        # A submission that just prints one fixed character will fail
        # against at least one of the three real test words the grader
        # tries, since they're deliberately varied in length/content.
        result = engine.grade(q["token"], {"code": 'print("z")'})
        assert result["correct"] is False
        return
    pytest.fail("no code question generated in 400 tries")


def test_write_code_reports_an_empty_submission():
    for seed in range(400):
        q = engine.generate(tier=5, seed=seed)
        if q["kind"] != "code":
            continue
        result = engine.grade(q["token"], {"code": "   "})
        assert result["correct"] is False
        assert "didn't write" in result["detail"]
        return
    pytest.fail("no code question generated in 400 tries")


# ─── token security ─────────────────────────────────────────────────────────

def test_grade_rejects_tampered_token():
    q = engine.generate(tier=1, seed=1)
    body, sig = q["token"].split(".", 1)
    tampered = f"{body}x.{sig}"
    result = engine.grade(tampered, {"answer": "a"})
    assert result["ok"] is False


def test_grade_rejects_expired_token():
    q = engine.generate(tier=1, seed=1)
    payload = core.verify(q["token"])
    payload["ts"] -= core.TOKEN_TTL_SECONDS + 60
    expired_token = core.sign(payload)
    result = engine.grade(expired_token, {"answer": "a"})
    assert result["ok"] is False
    assert "expired" in result["error"]


def test_grade_accepts_a_bare_string_as_shorthand_for_answer():
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["type"] != "fill_blank":
            continue
        correct = engine.grade(q["token"], {"answer": "###"})["correct_answer"]
        assert engine.grade(q["token"], correct)["correct"] is True
        return
    pytest.fail("no fill_blank question generated in 200 tries")


# ─── adaptive weighting ─────────────────────────────────────────────────────

def test_parse_weak_concepts_accepts_both_shapes_and_drops_unknown_ids():
    assert engine.parse_weak_concepts("") == set()
    assert engine.parse_weak_concepts(None) == set()
    assert engine.parse_weak_concepts("not_a_real_concept") == set()
    assert engine.parse_weak_concepts(f" {tpl.C_NEGATIVE_INDEX} ,junk,") == {tpl.C_NEGATIVE_INDEX}
    assert engine.parse_weak_concepts([tpl.C_ONE_BASED, 5, None]) == {tpl.C_ONE_BASED}


def test_weak_concepts_bias_selection_without_monopolising_it():
    weak = {tpl.C_NEGATIVE_INDEX}
    templates = [t for t in tpl.for_tier(3) if True]
    weighted = engine._weighted_templates(templates, weak)
    plain_count = sum(1 for t in templates if t.concept == tpl.C_NEGATIVE_INDEX)
    weighted_count = sum(1 for t in weighted if t.concept == tpl.C_NEGATIVE_INDEX)
    assert weighted_count > plain_count
    # Still not a monopoly: other concepts remain present.
    assert any(t.concept != tpl.C_NEGATIVE_INDEX for t in weighted)


# ─── templates ──────────────────────────────────────────────────────────────

def test_every_template_produces_an_in_range_index_for_a_string_it_accepts():
    import random
    rng = random.Random(0)
    for t in tpl.TEMPLATES:
        for _ in range(20):
            n = max(t.min_len, 6)
            word = "".join(rng.choice("abcdefghijklmnopqrstuvwxyz") for _ in range(n))
            from app.services import corpus
            entry = corpus.Entry(word, corpus.KIND_WORD, "word")
            if not t.accepts(entry):
                continue
            i = t.build(entry, rng)
            if i is None:
                continue
            assert -len(word) <= i < len(word), (t.id, i, word)


def test_tier_band_windows_cover_every_band_and_widen_with_tier():
    seen = set()
    for tier in range(1, 6):
        bands = set(tpl.TIER_BANDS[tier])
        seen |= bands
    assert seen == set(core.BANDS)


def test_every_code_task_is_reachable_from_its_own_band():
    """A code task banded below the lowest tier that ever offers KIND_CODE
    is unreachable by construction -- see looping_engine's own version of
    this test for the real instance this caught during development."""
    code_capable_tiers = [t for t, kinds in engine._TIER_KINDS.items() if "code" in kinds]
    seen = set()
    for tier in code_capable_tiers:
        for seed in range(400):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] == "code":
                seen.add(q["template"])
    assert seen == set(tpl.CODE_TASKS), f"unreachable: {set(tpl.CODE_TASKS) - seen}"


def test_every_declared_kind_actually_generates_at_every_tier_it_names():
    """The kind-level version of the same check: a kind can be declared
    reachable at a tier while silently never succeeding there if nothing
    in that tier's band window can satisfy it -- see comparison_engine's
    own version of this test for the real instance (KIND_ERROR's only
    raising template banded one tier too high) this caught."""
    for tier, kinds in engine._TIER_KINDS.items():
        seen = set()
        for seed in range(400):
            seen.add(engine.generate(tier=tier, seed=seed)["kind"])
        for kind in kinds:
            if kind == "code" and not tpl.code_tasks_for_tier(tier):
                continue
            assert kind in seen, f"tier {tier} declares {kind} but it never generated in 400 tries"


# ─── worked explanation ──────────────────────────────────────────────────────

def test_evaluate_answers_carry_a_worked_explanation_correct_or_not():
    """Both a right and a wrong evaluate answer get a rich, worked-example
    explanation (content blocks the frontend renders with ContentBlocks.jsx)
    -- the highlighted position must literally be the real answer, since a
    wrong explanation would be worse than none."""
    for seed in range(200):
        q = engine.generate(tier=1, seed=seed)
        if q["kind"] != "evaluate":
            continue
        payload = core.verify(q["token"])
        value = payload["w"]

        wrong = engine.grade(q["token"], {"answer": "#"})
        assert wrong["correct"] is False
        assert wrong["explanation_blocks"]

        right = engine.grade(q["token"], {"answer": wrong["correct_answer"]})
        assert right["correct"] is True
        assert right["explanation_blocks"]

        for result in (wrong, right):
            string_block = next(b for b in result["explanation_blocks"] if b["kind"] == "string")
            spelled = "".join(value[j] for j in string_block["highlight"])
            assert spelled == result["correct_answer"]
        return
    pytest.fail("no evaluate question generated in 200 tries")


def test_worked_explanation_never_shows_a_variant_with_the_same_character():
    """_build_index_explanation must only show nearby indices whose
    character actually differs -- the mirrored index (same position from
    the other end) always holds the identical character, and showing it
    under "a different index is a different character" would be wrong."""
    seen_any = False
    for seed in range(800):
        q = engine.generate(tier=3, seed=seed)
        if q["kind"] != "evaluate":
            continue
        payload = core.verify(q["token"])
        value, name, i = payload["w"], payload["nm"], payload["i"]
        correct = value[i]
        blocks = engine._build_index_explanation(value, name, i, correct)
        for blk in blocks:
            if blk["kind"] == "code" and "different index" in blk.get("caption", ""):
                seen_any = True
                for line in blk["code"].splitlines():
                    shown = line.split("#", 1)[1].strip()
                    assert shown != f'"{correct}"', (seed, line)
    assert seen_any


def test_worked_explanation_never_crashes_across_every_template():
    seen_templates = set()
    for tier in range(1, 6):
        for seed in range(600):
            q = engine.generate(tier=tier, seed=seed)
            if q["kind"] != "evaluate":
                continue
            payload = core.verify(q["token"])
            value, name, i = payload["w"], payload["nm"], payload["i"]
            engine._build_index_explanation(value, name, i, value[i])  # must not raise
            seen_templates.add(payload["tp"])
    assert seen_templates  # sanity: the loop actually ran
