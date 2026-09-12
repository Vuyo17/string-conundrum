"""Tests for the lecturer dashboard: role gating, recording, and the views.

The access-control tests matter more than the arithmetic ones. An analytics
number that is slightly off is a bug a lecturer will notice and report; a
missing require_admin is a student reading the whole cohort's marks, and
nobody reports that.
"""

import os
import tempfile
import uuid
from pathlib import Path
from unittest.mock import patch
from urllib.parse import urlparse

import pytest

from app import create_app
from app.services import analytics, progress

AUTH_HEADERS = {'Authorization': 'Bearer testtoken'}


def mock_verified_token(uid='demo-user', email='test@example.com'):
    return patch(
        'app.auth.firebase_auth.verify_id_token',
        return_value={'uid': uid, 'email': email},
    )


def _is_disposable_test_database() -> bool:
    """True only for a database whose name marks it as throwaway.

    These tests assert on whole-cohort figures -- "the class average", "40
    students" -- so each one needs the user, attempt and module tables empty
    to start with, and empties them again afterwards. That is correct against
    CI's dedicated `string_conundrum_test` database and destructive against
    anything else, so the name gate is the safety catch: point the suite at a
    real database and these tests skip rather than delete a class's marks.
    """
    dsn = os.environ.get('DATABASE_URL', '')
    if not dsn:
        return False
    database = urlparse(dsn).path.lstrip('/').lower()
    return 'test' in database


# Content (exercises, challenges) is NOT cleared: it is seeded once by
# migrate_json_to_db.py and every other test in the suite reads it.
_VOLATILE_TABLES = (
    'attempts',
    'exam_attempts',
    'exercise_completions',
    'challenge_completions',
    'module_section_completions',
    'modules',
    'users',
)


def _truncate_volatile_tables():
    from app.db import get_cursor

    with get_cursor() as cur:
        for table in _VOLATILE_TABLES:
            cur.execute('DELETE FROM %s' % table)


@pytest.fixture
def client(tmp_path, monkeypatch):
    """A client over an empty database, whichever backend is configured.

    Under LOCAL_DB_FALLBACK each test gets its own state file. Under a
    disposable Postgres the volatile tables are emptied either side of the
    test. Either way, attempt counts, roles and module edits from one test can
    never leak into another's assertions -- which matters more here than
    elsewhere in the suite, because almost every assertion below is an
    aggregate over "every student".
    """
    monkeypatch.delenv('ADMIN_EMAILS', raising=False)

    if os.environ.get('DATABASE_URL'):
        if not _is_disposable_test_database():
            pytest.skip(
                'DATABASE_URL does not look like a disposable test database; '
                'these tests clear the users, attempts and modules tables'
            )
        _truncate_volatile_tables()
        yield create_app().test_client()
        _truncate_volatile_tables()
        return

    monkeypatch.setenv('LOCAL_DB_STATE_PATH', str(tmp_path / 'state.json'))
    yield create_app().test_client()


def sign_in(client, uid, email='student@example.com'):
    """Touch an authenticated endpoint so the user row exists."""
    with mock_verified_token(uid, email):
        client.get('/api/me', headers=AUTH_HEADERS)


def make_admin(client, uid, email='lecturer@example.com'):
    sign_in(client, uid, email)
    progress.set_role(uid, progress.ROLE_ADMIN)


# --- access control --------------------------------------------------------

@pytest.mark.parametrize('path', [
    '/api/admin/overview',
    '/api/admin/students',
    '/api/admin/marks',
    '/api/admin/misconceptions',
    '/api/admin/modules',
    '/api/admin/questions',
])
def test_admin_routes_reject_anonymous_callers(client, path):
    assert client.get(path).status_code == 401


@pytest.mark.parametrize('path', [
    '/api/admin/overview',
    '/api/admin/students',
    '/api/admin/marks',
    '/api/admin/marks.csv',
    '/api/admin/modules',
])
def test_admin_routes_reject_signed_in_students(client, path):
    sign_in(client, 'student-1')
    with mock_verified_token('student-1'):
        assert client.get(path, headers=AUTH_HEADERS).status_code == 403


def test_admin_routes_allow_an_admin(client):
    make_admin(client, 'lecturer-1')
    with mock_verified_token('lecturer-1', 'lecturer@example.com'):
        response = client.get('/api/admin/overview', headers=AUTH_HEADERS)
    assert response.status_code == 200
    assert response.get_json()['ok'] is True


def test_admin_emails_env_promotes_on_sign_in(client, monkeypatch):
    monkeypatch.setenv('ADMIN_EMAILS', 'head@uct.ac.za, lecturer@uct.ac.za')
    with mock_verified_token('lecturer-2', 'Lecturer@UCT.ac.za'):
        payload = client.get('/api/me', headers=AUTH_HEADERS).get_json()
    # Case-insensitive: the allowlist is typed by a human into an env var.
    assert payload['role'] == 'admin'
    assert payload['is_admin'] is True


def test_non_allowlisted_email_stays_a_student(client, monkeypatch):
    monkeypatch.setenv('ADMIN_EMAILS', 'head@uct.ac.za')
    with mock_verified_token('student-2', 'student@uct.ac.za'):
        payload = client.get('/api/me', headers=AUTH_HEADERS).get_json()
    assert payload['role'] == 'student'


def test_admin_cannot_demote_themselves(client):
    make_admin(client, 'lecturer-3')
    with mock_verified_token('lecturer-3', 'lecturer@example.com'):
        response = client.patch(
            '/api/admin/users/lecturer-3/role',
            json={'role': 'student'},
            headers=AUTH_HEADERS,
        )
    assert response.status_code == 400
    assert progress.get_role('lecturer-3') == 'admin'


def test_admin_can_promote_someone_else(client):
    make_admin(client, 'lecturer-4')
    sign_in(client, 'tutor-1', 'tutor@example.com')
    with mock_verified_token('lecturer-4', 'lecturer@example.com'):
        response = client.patch(
            '/api/admin/users/tutor-1/role',
            json={'role': 'admin'},
            headers=AUTH_HEADERS,
        )
    assert response.status_code == 200
    assert progress.get_role('tutor-1') == 'admin'


# --- recording -------------------------------------------------------------

def test_wrong_answers_are_recorded_with_their_misconception(client):
    sign_in(client, 'student-3')
    with mock_verified_token('student-3'):
        client.post(
            '/api/exercises/submit',
            json={'module_id': 'intro', 'question_id': 'intro-01', 'answer': 'name = Hlomla'},
            headers=AUTH_HEADERS,
        )

    rows = analytics._all_attempts()
    assert len(rows) == 1
    assert rows[0]['correct'] is False
    # The whole point of the attempts table: exercise_completions would have
    # recorded nothing at all here.
    assert rows[0]['misconception_id'] == 'strings_need_quotes'
    assert rows[0]['answer_given'] == 'name = Hlomla'


def test_correct_answers_do_not_store_the_submitted_text(client):
    sign_in(client, 'student-4')
    with mock_verified_token('student-4'):
        client.post(
            '/api/exercises/submit',
            json={'module_id': 'intro', 'question_id': 'intro-01', 'answer': "name = 'Hlomla'"},
            headers=AUTH_HEADERS,
        )

    rows = analytics._all_attempts()
    assert rows[0]['correct'] is True
    assert rows[0]['answer_given'] is None


def test_exam_submit_derives_the_percentage_server_side(client):
    sign_in(client, 'student-5')
    with mock_verified_token('student-5'):
        response = client.post(
            '/api/exams/submit',
            json={
                'module_id': 'intro',
                'correct_count': 9,
                'total_count': 10,
                # Deliberately absurd: the client does not get to choose.
                'percent': 100,
                'passed': True,
            },
            headers=AUTH_HEADERS,
        )

    assert response.get_json()['percent'] == 90
    stored = analytics._all_exam_attempts()
    assert stored[0]['percent'] == 90
    assert stored[0]['passed'] is True


def test_exam_submit_rejects_an_empty_paper(client):
    sign_in(client, 'student-6')
    with mock_verified_token('student-6'):
        response = client.post(
            '/api/exams/submit',
            json={'module_id': 'intro', 'correct_count': 0, 'total_count': 0},
            headers=AUTH_HEADERS,
        )
    assert response.status_code == 400


def test_exam_below_threshold_is_recorded_as_failed(client):
    sign_in(client, 'student-7')
    with mock_verified_token('student-7'):
        client.post(
            '/api/exams/submit',
            json={'module_id': 'intro', 'correct_count': 7, 'total_count': 10},
            headers=AUTH_HEADERS,
        )
    stored = analytics._all_exam_attempts()[0]
    assert stored['percent'] == 70
    assert stored['passed'] is False


def test_a_failed_attempt_insert_never_breaks_grading(client):
    """A student must not lose a correct answer because analytics fell over."""
    sign_in(client, 'student-8')
    with mock_verified_token('student-8'):
        with patch('app.services.progress.get_cursor', side_effect=RuntimeError('db down')):
            progress.record_attempt('student-8', 'intro', 'intro-01', True)
    # No exception escaped; that is the assertion.


# --- views -----------------------------------------------------------------

def test_overview_reports_no_average_rather_than_zero_for_an_untouched_cohort(client):
    make_admin(client, 'lecturer-5')
    with mock_verified_token('lecturer-5', 'lecturer@example.com'):
        payload = client.get('/api/admin/overview', headers=AUTH_HEADERS).get_json()

    # "Nobody has sat an exam" must not render as "the class averages 0%".
    assert payload['averages']['exam'] is None
    assert payload['hardest_module'] is None


def test_guests_are_excluded_from_the_roster_by_default(client):
    make_admin(client, 'lecturer-6')
    sign_in(client, 'guest-abc123', None)
    sign_in(client, 'student-9', 'real@example.com')

    with mock_verified_token('lecturer-6', 'lecturer@example.com'):
        default = client.get('/api/admin/students', headers=AUTH_HEADERS).get_json()
        with_guests = client.get(
            '/api/admin/students?include_guests=1', headers=AUTH_HEADERS
        ).get_json()

    assert {r['uid'] for r in default['students']} == {'lecturer-6', 'student-9'}
    assert 'guest-abc123' in {r['uid'] for r in with_guests['students']}


def test_student_detail_surfaces_misconceptions(client):
    make_admin(client, 'lecturer-7')
    sign_in(client, 'student-10')
    with mock_verified_token('student-10'):
        for _ in range(3):
            client.post(
                '/api/exercises/submit',
                json={'module_id': 'intro', 'question_id': 'intro-01', 'answer': 'name = Hlomla'},
                headers=AUTH_HEADERS,
            )

    with mock_verified_token('lecturer-7', 'lecturer@example.com'):
        payload = client.get('/api/admin/students/student-10', headers=AUTH_HEADERS).get_json()

    assert payload['student']['attempts'] == 3
    assert payload['misconceptions'][0]['id'] == 'strings_need_quotes'
    assert payload['misconceptions'][0]['count'] == 3


def test_student_detail_404s_for_an_unknown_uid(client):
    make_admin(client, 'lecturer-8')
    with mock_verified_token('lecturer-8', 'lecturer@example.com'):
        response = client.get('/api/admin/students/nobody', headers=AUTH_HEADERS)
    assert response.status_code == 404


def test_marks_csv_has_a_row_per_student(client):
    make_admin(client, 'lecturer-9')
    sign_in(client, 'student-11', 'ann@example.com')
    # Same email on both calls: upsert_user writes the token's email on every
    # authenticated request, so signing in again as test@example.com would
    # quietly rename the student mid-test.
    with mock_verified_token('student-11', 'ann@example.com'):
        client.post(
            '/api/exams/submit',
            json={'module_id': 'intro', 'correct_count': 8, 'total_count': 10},
            headers=AUTH_HEADERS,
        )

    with mock_verified_token('lecturer-9', 'lecturer@example.com'):
        response = client.get('/api/admin/marks.csv', headers=AUTH_HEADERS)

    assert response.status_code == 200
    assert response.mimetype == 'text/csv'
    lines = response.get_data(as_text=True).strip().splitlines()
    assert lines[0].startswith('Student,Email,Progress %')
    assert any('ann@example.com' in line and '80' in line for line in lines[1:])


def test_best_sitting_counts_not_the_latest(client):
    """Retaking an exam and doing worse must not erase the better mark."""
    make_admin(client, 'lecturer-10')
    sign_in(client, 'student-12')
    with mock_verified_token('student-12'):
        for correct in (9, 4):
            client.post(
                '/api/exams/submit',
                json={'module_id': 'intro', 'correct_count': correct, 'total_count': 10},
                headers=AUTH_HEADERS,
            )

    with mock_verified_token('lecturer-10', 'lecturer@example.com'):
        payload = client.get('/api/admin/marks', headers=AUTH_HEADERS).get_json()

    row = next(r for r in payload['students'] if r['uid'] == 'student-12')
    assert row['per_module']['intro'] == 90
    assert row['exam'] == 90


# --- module management -----------------------------------------------------

def test_modules_list_falls_back_to_the_shipped_eight(client):
    make_admin(client, 'lecturer-11')
    with mock_verified_token('lecturer-11', 'lecturer@example.com'):
        payload = client.get('/api/admin/modules', headers=AUTH_HEADERS).get_json()

    ids = [m['id'] for m in payload['modules']]
    assert ids[:3] == ['intro', 'indexing', 'slicing']
    assert len(ids) == 8


def test_creating_a_module_keeps_the_existing_eight(client):
    """The first write must seed the table, not replace the catalogue with one row."""
    make_admin(client, 'lecturer-12')
    with mock_verified_token('lecturer-12', 'lecturer@example.com'):
        created = client.post(
            '/api/admin/modules',
            json={'id': 'regex', 'title': 'Regular Expressions', 'minutes': 40},
            headers=AUTH_HEADERS,
        )
        listed = client.get('/api/admin/modules', headers=AUTH_HEADERS).get_json()

    assert created.status_code == 201
    ids = [m['id'] for m in listed['modules']]
    assert len(ids) == 9
    assert ids[-1] == 'regex'
    # New modules start hidden so students never see an empty one.
    assert listed['modules'][-1]['published'] is False


def test_duplicate_module_id_is_rejected(client):
    make_admin(client, 'lecturer-13')
    with mock_verified_token('lecturer-13', 'lecturer@example.com'):
        response = client.post(
            '/api/admin/modules',
            json={'id': 'intro', 'title': 'Another Intro'},
            headers=AUTH_HEADERS,
        )
    assert response.status_code == 400


def test_publishing_and_reordering_a_module(client):
    make_admin(client, 'lecturer-14')
    with mock_verified_token('lecturer-14', 'lecturer@example.com'):
        client.post('/api/admin/modules', json={'id': 'regex', 'title': 'Regex'},
                    headers=AUTH_HEADERS)
        client.patch('/api/admin/modules/regex', json={'published': True},
                     headers=AUTH_HEADERS)
        client.post('/api/admin/modules/reorder',
                    json={'order': ['regex', 'intro', 'indexing']},
                    headers=AUTH_HEADERS)
        listed = client.get('/api/admin/modules', headers=AUTH_HEADERS).get_json()

    assert listed['modules'][0]['id'] == 'regex'
    assert listed['modules'][0]['published'] is True


def test_deleting_a_module_archives_rather_than_destroys(client):
    make_admin(client, 'lecturer-15')
    with mock_verified_token('lecturer-15', 'lecturer@example.com'):
        client.delete('/api/admin/modules/formatting', headers=AUTH_HEADERS)
        listed = client.get('/api/admin/modules', headers=AUTH_HEADERS).get_json()

    assert 'formatting' not in [m['id'] for m in listed['modules']]


# --- exercise management ---------------------------------------------------

@pytest.fixture
def scratch_bank(monkeypatch):
    """Isolate the exercise bank so a test's writes never survive it.

    Under LOCAL_DB_FALLBACK that means pointing the service at a COPY of
    app/data/exercises.json -- otherwise running the suite would rewrite the
    repository's own content file. Under Postgres the bank is a table shared
    with every other test in the suite, so instead the rows this test adds are
    deleted afterwards.
    """
    from app.services import admin_content

    if os.environ.get('DATABASE_URL'):
        added = []
        yield added
        from app.db import get_cursor

        with get_cursor() as cur:
            for module_id, question_id in added:
                cur.execute(
                    'DELETE FROM exercises WHERE module_id = %s AND question_id = %s',
                    (module_id, question_id),
                )
        return

    scratch = Path(tempfile.gettempdir()) / ('bank-%s.json' % uuid.uuid4().hex)
    scratch.write_text(admin_content._EXERCISES_PATH.read_text(encoding='utf-8'), encoding='utf-8')
    monkeypatch.setattr(admin_content, '_EXERCISES_PATH', scratch)
    yield []
    scratch.unlink(missing_ok=True)


def test_saving_an_exercise_round_trips(client, scratch_bank):
    scratch_bank.append(('intro', 'intro-new'))
    make_admin(client, 'lecturer-16')
    with mock_verified_token('lecturer-16', 'lecturer@example.com'):
        saved = client.put(
            '/api/admin/modules/intro/exercises/intro-new',
            json={
                'type': 'mcq',
                'prompt': 'Which is a string?',
                'options': ["'hi'", 'hi'],
                'answer': "'hi'",
                'xp': 10,
            },
            headers=AUTH_HEADERS,
        )
        listed = client.get('/api/admin/modules/intro/exercises', headers=AUTH_HEADERS).get_json()

    assert saved.status_code == 200
    assert any(e['question_id'] == 'intro-new' for e in listed['exercises'])


def test_an_mcq_whose_answer_is_not_an_option_is_rejected(client):
    """Otherwise the question is unanswerable and every student is marked wrong."""
    make_admin(client, 'lecturer-17')
    with mock_verified_token('lecturer-17', 'lecturer@example.com'):
        response = client.put(
            '/api/admin/modules/intro/exercises/intro-bad',
            json={
                'type': 'mcq',
                'prompt': 'Pick one',
                'options': ['a', 'b'],
                'answer': 'c',
            },
            headers=AUTH_HEADERS,
        )
    assert response.status_code == 400
    assert 'must be one of the options' in response.get_json()['error']


@pytest.mark.skipif(
    bool(os.environ.get('DATABASE_URL')),
    reason=(
        'specific to the JSON bank, where an edit rewrites the whole record and '
        'could drop the _xh fields. On Postgres the translations live in their '
        'own columns that the UPDATE never names, so there is nothing to lose.'
    ),
)
def test_editing_an_exercise_keeps_its_isixhosa_translation(client, scratch_bank):
    from app.services import admin_content

    make_admin(client, 'lecturer-18')
    before = next(e for e in admin_content.list_exercises('intro') if e['question_id'] == 'intro-01')
    assert before.get('prompt_xh')

    with mock_verified_token('lecturer-18', 'lecturer@example.com'):
        client.put(
            '/api/admin/modules/intro/exercises/intro-01',
            json={
                'type': 'mcq',
                'prompt': 'Reworded prompt',
                'options': before['options'],
                'answer': before['answer'],
            },
            headers=AUTH_HEADERS,
        )

    after = next(e for e in admin_content.list_exercises('intro') if e['question_id'] == 'intro-01')
    assert after['prompt'] == 'Reworded prompt'
    assert after['prompt_xh'] == before['prompt_xh']
