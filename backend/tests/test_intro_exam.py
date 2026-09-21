"""Check the new Introduction questions through the real answer grader."""
import pytest
from app.services import feedback


@pytest.fixture(autouse=True)
def use_authored_bank(monkeypatch):
    monkeypatch.setattr(feedback, '_load_exercises', feedback._load_json_exercises)


@pytest.mark.parametrize('qid,correct,wrong', [
    ('intro-31', {'answer': '3'}, {'answer': '4'}),
    ('intro-32', {'answer': 'E'}, {'answer': 'D'}),
    ('intro-33', {'answers': ['"it\'s OK"', "'it\\'s OK'"]}, {'answers': ['"it\'s OK"']}),
    ('intro-34', {'answer': '6'}, {'answer': '7'}),
    ('intro-35', {'answer': '2224'}, {'answer': '10'}),
    ('intro-36', {'answers': ['len("hello")', 'int("2") + 3']}, {'answers': ['len("hello")', 'int("2") + 3', 'str(5)']}),
    ('intro-37', {'code': 'count = 5\nprint("Count: " + str(count))'}, {'code': 'count = 5\nprint("Count: " + count)'}),
])
@pytest.mark.parametrize('lang', ['en', 'xh'])
def test_new_intro_answers(qid, correct, wrong, lang):
    assert feedback.evaluate_answer('intro', qid, lang=lang, **correct)['correct']
    assert not feedback.evaluate_answer('intro', qid, lang=lang, **wrong)['correct']
