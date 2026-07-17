from app import create_app


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


def test_submit_exercise_stub_response_shape():
    app = create_app()
    client = app.test_client()

    response = client.post(
        '/api/exercises/submit',
        json={
            'module_id': 'immutability',
            'question_id': 'immut-01',
            'answer': 'changes in place',
        },
    )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['ok'] is True
    assert 'correct' in payload
    assert 'feedback' in payload


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

    response = client.post(
        '/api/exercises/submit',
        json={
            'module_id': 'indexing',
            'question_id': 'indexing-17',
            'answers': ['mL[11]', 'mL[-12]'],
        },
    )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['correct'] is True


def test_submit_write_code_exercise():
    app = create_app()
    client = app.test_client()

    response = client.post(
        '/api/exercises/submit',
        json={
            'module_id': 'challenge',
            'question_id': 'challenge-07',
            'code': 'w = input()\nprint(w[::-1])',
        },
    )
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['correct'] is True


def test_progress_endpoint_response_shape():
    app = create_app()
    client = app.test_client()

    response = client.get('/api/progress/demo-user')
    payload = response.get_json()

    assert response.status_code == 200
    assert payload['ok'] is True
    assert payload['user_id'] == 'demo-user'
    assert isinstance(payload['modules'], list)
