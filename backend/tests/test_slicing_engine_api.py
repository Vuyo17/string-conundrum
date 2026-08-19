from unittest.mock import patch

from app import create_app

AUTH_HEADERS = {'Authorization': 'Bearer testtoken'}


def mock_verified_token(uid='demo-user'):
    return patch('app.auth.firebase_auth.verify_id_token', return_value={'uid': uid, 'email': 'test@example.com'})


FORMATS = {'mcq', 'fill_blank', 'build_slice', 'select_all', 'write_code'}


def next_question(client, tier, fmt=None, limit=200):
    """Fetch a question, optionally retrying until one of `fmt` comes back.

    The format is drawn at random from the tier's roster, so a test that
    needs a particular one has to ask more than once.
    """
    for _ in range(limit):
        payload = client.get(f'/api/exercises/slicing/engine/next?tier={tier}').get_json()
        if fmt is None or payload['type'] == fmt:
            return payload
    raise AssertionError(f'no {fmt} question at tier {tier} after {limit} tries')


def test_engine_next_returns_a_question_without_auth():
    app = create_app()
    client = app.test_client()

    response = client.get('/api/exercises/slicing/engine/next?tier=1')
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['ok'] is True
    assert payload['type'] in FORMATS
    assert payload['tier'] == 1
    assert 'token' in payload


def test_engine_next_carries_the_fields_each_format_needs():
    app = create_app()
    client = app.test_client()

    mcq = next_question(client, 1, 'mcq')
    assert len(mcq['options']) == 4

    # fill_blank serves several kinds: an `evaluate` or `length` question
    # carries the expression to show beside the box, a `trace` question
    # carries a label instead because there is nothing to put an "=" after.
    blank = next_question(client, 2, 'fill_blank')
    assert blank.get('expression') or blank.get('answer_label')

    builder = next_question(client, 4, 'build_slice')
    assert builder['target'] and builder['word'] and builder['allow_step'] is True

    select = next_question(client, 3, 'select_all')
    assert len(select['options']) >= 3

    code = next_question(client, 5, 'write_code')
    assert code['starter_code'] and code['examples']


def test_engine_next_accepts_weak_concepts_and_ignores_junk():
    app = create_app()
    client = app.test_client()

    ok = client.get('/api/exercises/slicing/engine/next?tier=4&weak=negative_step_unfamiliar')
    assert ok.status_code == 200 and ok.get_json()['ok'] is True

    junk = client.get('/api/exercises/slicing/engine/next?tier=4&weak=%3Cscript%3E,nonsense')
    assert junk.status_code == 200 and junk.get_json()['ok'] is True


def test_engine_next_clamps_out_of_range_tier():
    app = create_app()
    client = app.test_client()

    response = client.get('/api/exercises/slicing/engine/next?tier=999')
    assert response.get_json()['tier'] == 5


def test_engine_answer_requires_auth():
    app = create_app()
    client = app.test_client()

    next_response = client.get('/api/exercises/slicing/engine/next?tier=1')
    token = next_response.get_json()['token']

    response = client.post(
        '/api/exercises/slicing/engine/answer',
        json={'token': token, 'answer': 'x'},
    )
    assert response.status_code == 401


def test_engine_answer_grades_correctly_and_awards_stars():
    app = create_app()
    client = app.test_client()

    question = next_question(client, 2, 'mcq')

    # Recover the correct answer the same way slicing_engine.grade() would,
    # by trying each option until one is graded correct.
    correct = None
    with mock_verified_token():
        for option in question['options']:
            probe = client.post(
                '/api/exercises/slicing/engine/answer',
                json={'token': question['token'], 'answer': option},
                headers=AUTH_HEADERS,
            )
            if probe.get_json()['correct']:
                correct = option
                break

    assert correct is not None, "no option graded correct"

    with mock_verified_token():
        response = client.post(
            '/api/exercises/slicing/engine/answer',
            json={'token': question['token'], 'answer': correct},
            headers=AUTH_HEADERS,
        )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['correct'] is True
    assert payload['stars_awarded'] == 2
    assert payload['format'] == 'mcq'
    assert 'feedback' in payload


def test_engine_answer_runs_submitted_code_for_write_code_questions():
    app = create_app()
    client = app.test_client()

    question = next_question(client, 5, 'write_code')

    with mock_verified_token():
        response = client.post(
            '/api/exercises/slicing/engine/answer',
            json={'token': question['token'], 'code': 'print("definitely wrong")'},
            headers=AUTH_HEADERS,
        )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['correct'] is False
    assert payload['stars_awarded'] == 0
    # write_code feedback is the run itself, not "the answer is X" — there is
    # no single right answer to name.
    assert 'should print' in payload['feedback']


def test_engine_answer_grades_a_build_slice_submission():
    app = create_app()
    client = app.test_client()

    question = next_question(client, 2, 'build_slice')
    word, target = question['word'], question['target']

    found = None
    for start in list(range(-len(word) - 1, len(word) + 2)) + [None]:
        for stop in list(range(-len(word) - 1, len(word) + 2)) + [None]:
            if word[start:stop] == target:
                found = (start, stop)
                break
        if found:
            break
    assert found is not None

    with mock_verified_token():
        response = client.post(
            '/api/exercises/slicing/engine/answer',
            json={'token': question['token'], 'slice': {
                'start': '' if found[0] is None else str(found[0]),
                'stop': '' if found[1] is None else str(found[1]),
                'step': '',
            }},
            headers=AUTH_HEADERS,
        )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['correct'] is True
    assert payload['stars_awarded'] == 2


def test_engine_answer_rejects_bad_token():
    app = create_app()
    client = app.test_client()

    with mock_verified_token():
        response = client.post(
            '/api/exercises/slicing/engine/answer',
            json={'token': 'not-a-real-token', 'answer': 'x'},
            headers=AUTH_HEADERS,
        )

    assert response.status_code == 400
    assert response.get_json()['ok'] is False
