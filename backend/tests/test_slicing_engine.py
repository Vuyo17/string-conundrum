from app.services import slicing_engine as engine


def test_generate_returns_correct_answer_among_four_unique_options():
    for tier in range(1, engine.MAX_TIER + 1):
        for seed in range(50):
            question = engine.generate(tier=tier, seed=seed)
            options = question["options"]

            assert len(options) == 4
            assert len(set(options)) == 4, f"tier {tier} seed {seed}: duplicate options {options}"

            # The token embeds the real slice params; grading with the
            # correct answer must always come back correct.
            payload = engine._verify(question["token"])
            correct = engine._slice_str(payload["w"], payload["a"], payload["b"], payload["c"])
            assert correct in options
            result = engine.grade(question["token"], correct)
            assert result["correct"] is True
            assert result["stars_awarded"] == tier


def test_generate_clamps_tier_to_valid_range():
    assert engine.generate(tier=0, seed=1)["tier"] == 1
    assert engine.generate(tier=99, seed=1)["tier"] == engine.MAX_TIER


def test_generate_difficulty_scales_word_length_by_tier():
    # Not a strict guarantee for any single sample, but the ranges are
    # disjoint enough that this holds over many draws.
    tier1_lengths = [len(engine.generate(tier=1, seed=s)["prompt"].splitlines()[1]) for s in range(30)]
    tier5_lengths = [len(engine.generate(tier=5, seed=s)["prompt"].splitlines()[1]) for s in range(30)]
    assert sum(tier1_lengths) / len(tier1_lengths) < sum(tier5_lengths) / len(tier5_lengths)


def test_grade_wrong_answer_reports_a_misconception_when_it_matches_a_distractor():
    # word = "labyrinth" style questions aren't guaranteed by seed alone, so
    # search a handful of seeds for one with a stop_inclusive-tagged
    # distractor and confirm grading attributes it correctly.
    found = False
    for seed in range(200):
        question = engine.generate(tier=1, seed=seed)
        payload = engine._verify(question["token"])
        word, start, stop, step = payload["w"], payload["a"], payload["b"], payload["c"]
        if step not in (None, 1) or stop is None:
            continue
        distractor = word[start:stop + 1:step]
        correct = word[start:stop:step]
        if distractor == correct or distractor not in question["options"]:
            continue
        result = engine.grade(question["token"], distractor)
        assert result["correct"] is False
        assert result["misconception_id"] == "slice_stop_inclusive"
        found = True
        break
    assert found, "no tier-1 sample produced a stop_inclusive distractor to test against"


def test_grade_rejects_tampered_token():
    question = engine.generate(tier=1, seed=1)
    body, sig = question["token"].split(".", 1)
    tampered = f"{body}x.{sig}"
    result = engine.grade(tampered, "anything")
    assert result["ok"] is False
    assert "error" in result


def test_grade_rejects_expired_token():
    question = engine.generate(tier=1, seed=1)
    payload = engine._verify(question["token"])
    payload["ts"] -= engine.TOKEN_TTL_SECONDS + 60
    stale_token = engine._sign(payload)
    result = engine.grade(stale_token, "anything")
    assert result["ok"] is False
    assert result["error"] == "expired"


def test_grade_is_deterministic_regardless_of_generation_order():
    # grade() must reconstruct the exact same distractor set generate() drew,
    # not a freshly-shuffled one — otherwise a wrong answer could grade
    # differently on retries with the same token.
    question = engine.generate(tier=3, seed=7)
    wrong_option = next(o for o in question["options"] if o != engine._verify(question["token"])["w"])
    payload = engine._verify(question["token"])
    correct = engine._slice_str(payload["w"], payload["a"], payload["b"], payload["c"])
    wrong_option = next(o for o in question["options"] if o != correct)

    first = engine.grade(question["token"], wrong_option)
    second = engine.grade(question["token"], wrong_option)
    assert first["misconception_id"] == second["misconception_id"]
