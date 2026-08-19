from unittest.mock import patch

from app import create_app

AUTH_HEADERS = {'Authorization': 'Bearer testtoken'}


def mock_verified_token(uid='demo-user'):
    return patch('app.auth.firebase_auth.verify_id_token', return_value={'uid': uid, 'email': 'test@example.com'})


def test_engine_next_returns_a_question_without_auth():
    app = create_app()
    client = app.test_client()

    response = client.get('/api/exercises/slicing/engine/next?tier=1')
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['ok'] is True
    assert payload['type'] == 'mcq'
    assert len(payload['options']) == 4
    assert payload['tier'] == 1
    assert 'token' in payload


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

    next_response = client.get('/api/exercises/slicing/engine/next?tier=2')
    question = next_response.get_json()

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
    assert 'feedback' in payload


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
