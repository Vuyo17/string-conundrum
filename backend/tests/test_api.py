from unittest.mock import patch

from app import create_app

AUTH_HEADERS = {'Authorization': 'Bearer testtoken'}


def mock_verified_token(uid='demo-user'):
    return patch('app.auth.firebase_auth.verify_id_token', return_value={'uid': uid, 'email': 'test@example.com'})


def test_health_endpoint():
    app = create_app()
    client = app.test_client()

    response = client.get('/health')

    assert response.status_code == 200
    assert response.get_json()['status'] == 'ok'


def test_visualize_stub_response_shape():
    app = create_app()
    client = app.test_client()

    response = client.post('/api/visualize', json={'expression': 'word[1]', 'context': {'word': 'python'}})
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['ok'] is True
    assert 'visual_state' in payload


def test_execute_stub_response_shape():
    app = create_app()
    client = app.test_client()

    response = client.post('/api/execute', json={'code': "print('hello')"})
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['ok'] is True
    assert 'stdout' in payload
    assert payload['stderr_xhosa'] is None


def test_execute_lang_xh_returns_isixhosa_translation():
    # Translation is a local, offline template match (see
    # error_translation.py) -- no API key or network needed, so a
    # recognised error type comes back translated.
    app = create_app()
    client = app.test_client()

    response = client.post('/api/execute', json={'code': "word = 'hi'\nprint(word[5])", 'lang': 'xh'})
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['ok'] is True
    assert payload['stderr']  # real IndexError from the sandbox
    assert payload['stderr_xhosa']
    assert 'IndexError' not in payload['stderr_xhosa']  # translated, not raw


def test_submit_exercise_stub_response_shape():
    app = create_app()
    client = app.test_client()

    with mock_verified_token():
        response = client.post(
            '/api/exercises/submit',
            json={
                'module_id': 'immutability',
                'question_id': 'immut-01',
                'answer': 'changes in place',
            },
            headers=AUTH_HEADERS,
        )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['ok'] is True
    assert 'correct' in payload
    assert 'feedback' in payload


def test_submit_exercise_requires_auth():
    app = create_app()
    client = app.test_client()

    response = client.post(
        '/api/exercises/submit',
        json={'module_id': 'immutability', 'question_id': 'immut-01', 'answer': 'x'},
    )

    assert response.status_code == 401


def test_list_module_exercises():
    app = create_app()
    client = app.test_client()

    response = client.get('/api/exercises/indexing')
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['ok'] is True
    assert payload['module_id'] == 'indexing'
    assert len(payload['exercises']) > 0


def test_submit_select_all_exercise():
    app = create_app()
    client = app.test_client()

    with mock_verified_token():
        response = client.post(
            '/api/exercises/submit',
            json={
                'module_id': 'indexing',
                'question_id': 'indexing-17',
                'answers': ['mL[11]', 'mL[-12]'],
            },
            headers=AUTH_HEADERS,
        )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['correct'] is True


def test_submit_write_code_exercise():
    app = create_app()
    client = app.test_client()

    with mock_verified_token():
        response = client.post(
            '/api/exercises/submit',
            json={
                'module_id': 'challenge',
                'question_id': 'challenge-07',
                'code': 'w = input()\nprint(w[::-1])',
            },
            headers=AUTH_HEADERS,
        )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['correct'] is True


def test_progress_endpoint_response_shape():
    app = create_app()
    client = app.test_client()

    with mock_verified_token('demo-user'):
        response = client.get('/api/progress/demo-user', headers=AUTH_HEADERS)
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['ok'] is True
    assert payload['user_id'] == 'demo-user'
    assert isinstance(payload['modules'], list)


def test_progress_endpoint_requires_auth():
    app = create_app()
    client = app.test_client()

    response = client.get('/api/progress/demo-user')

    assert response.status_code == 401


def test_progress_endpoint_forbids_other_users():
    app = create_app()
    client = app.test_client()

    with mock_verified_token('someone-else'):
        response = client.get('/api/progress/demo-user', headers=AUTH_HEADERS)

    assert response.status_code == 403
