import json
from pathlib import Path

from .sandbox import run_for_grading

_DATA_PATH = Path(__file__).resolve().parent.parent / "data" / "exercises.json"

MISCONCEPTION_FEEDBACK = {
    "immutability_in_place": "Strings are immutable. String operations return new strings rather than changing existing ones in place.",
    "indexing_from_one": "Python indexing starts at 0, not 1. The first character is at index 0.",
    "negative_index_confusion": "Negative indices count backwards from the end, starting at -1 for the last character.",
    "off_by_one_length": "The valid indices for a string run from 0 to len(string) - 1. len(string) itself is one past the end.",
    "slice_stop_inclusive": "The stop index in a slice is exclusive. word[0:5] stops before index 5, not at it.",
    "negative_step_unfamiliar": "A negative step walks the string backwards, so word[::-1] reverses it instead of erroring.",
    "method_mutates_target": "String methods like upper() and lower() return a new string. The original variable is unchanged unless you reassign it.",
    "comparison_ignores_case": "String comparison in Python is case-sensitive, so 'Cat' and 'cat' are not equal.",
    "strings_not_orderable_myth": "Strings can be compared with < and > using dictionary (lexicographic) order.",
    "string_number_equality_myth": "A string and an int are never equal in Python, even if they look the same, e.g. '10' != 10.",
    "strip_only_removes_one_char": "strip() removes all leading and trailing whitespace characters, not just one.",
    "count_overlap_confusion": "count() counts non-overlapping occurrences from left to right.",
    "count_vs_find_confusion": "count() returns how many times something appears, not where it is. Use find() or index() for position.",
    "fstring_missing_prefix_effect": "Without the f prefix, {name} is treated as literal text rather than being substituted.",
    "escape_sequence_literal_confusion": "\\n inside a string is a single newline character, not the two characters backslash and n.",
    "strings_need_quotes": "Text values must be wrapped in quotes, otherwise Python looks for a variable with that name.",
    "string_vs_list_confusion": "A sequence of unquoted characters in brackets is a list of names, not a string.",
    "concatenation_adds_space": "The + operator joins strings exactly as they are, with no added space.",
    "concatenation_requires_same_type_fear": "Two strings can always be joined with +, regardless of what they contain.",
    "repetition_confused_with_multiplication": "The * operator repeats a string instead of doing arithmetic, so \"ab\" * 3 builds \"ababab\". The number never appears in the result.",
}

# The rule each module teaches. Used to explain *why* an answer is what it is
# when a question carries no more specific concept of its own.
MODULE_EXPLANATIONS = {
    "intro": "A string is a sequence of characters written inside quotes. The quotes mark where the text starts and ends; they are not part of the value itself.",
    "indexing": "Indexing reads a single character by its position. Python counts from 0, so the first character is at index 0 and the last is at index len(text) - 1. Negative indices count backwards from -1 at the end.",
    "slicing": "A slice text[start:stop:step] copies a section of a string. It begins at start, stops just before stop, and hands back a brand new string, leaving the original untouched.",
    "immutability": "Strings are immutable: once one exists, its characters cannot be changed. Anything that looks like a change actually builds a new string, so the result must be reassigned to be kept.",
    "comparison": "Comparing strings with == matches the characters exactly, including case. The < and > operators compare in dictionary (lexicographic) order, character by character.",
    "looping": "A for loop over a string visits one character at a time, left to right. Looping over range(len(text)) instead gives you the positions, which you need when the index itself matters.",
    "methods": "String methods such as upper(), strip() and replace() never modify the original string. Each one returns a new string, so the result has to be stored or used straight away.",
    "formatting": "Formatting builds a string out of values. An f-string needs the f prefix before the opening quote for {} placeholders to be filled in; without it the braces stay as literal text.",
    "challenge": "Work through the code one step at a time, tracking what each string operation returns, and remember that string operations produce new strings rather than changing the original.",
}


def _explanation_for(exercise: dict, misconception_id: "str | None" = None) -> str:
    """Explain the rule behind an answer, most specific source first.

    Order: an explanation authored on the exercise, then the concept the
    question's distractors probe, then the module's rule. When the learner
    already got targeted misconception feedback we deliberately fall back to
    the module rule so the same sentence is not shown twice.
    """
    authored = exercise.get("explanation")
    if authored:
        return authored

    module_rule = MODULE_EXPLANATIONS.get(exercise.get("module_id", ""), "")

    if misconception_id and misconception_id in MISCONCEPTION_FEEDBACK:
        return module_rule

    # A question can probe more than one concept, one per distractor. Cover each
    # of them rather than arbitrarily picking whichever happens to come first.
    concepts = [
        MISCONCEPTION_FEEDBACK[mid]
        for mid in dict.fromkeys((exercise.get("misconception_map") or {}).values())
        if mid in MISCONCEPTION_FEEDBACK
    ]
    if concepts:
        return " ".join(concepts)

    return module_rule


def _load_exercises() -> list[dict]:
    with open(_DATA_PATH, "r", encoding="utf-8") as f:
        return json.load(f)


def _find_exercise(module_id: str, question_id: str) -> dict | None:
    for exercise in _load_exercises():
        if exercise["module_id"] == module_id and exercise["question_id"] == question_id:
            return exercise
    return None


def _grade_mcq(exercise: dict, answer: str) -> dict:
    is_correct = answer.strip() == exercise["answer"]
    if is_correct:
        return {
            "correct": True,
            "misconception_id": None,
            "feedback": f"Correct. The answer is {exercise['answer']}.",
            "explanation": _explanation_for(exercise),
        }

    misconception_id = exercise.get("misconception_map", {}).get(answer.strip())
    correction = f"Not quite. The correct answer is: {exercise['answer']}"
    specific = MISCONCEPTION_FEEDBACK.get(misconception_id)
    feedback = f"{correction} — {specific}" if specific else correction
    return {
        "correct": False,
        "misconception_id": misconception_id,
        "feedback": feedback,
        "explanation": _explanation_for(exercise, misconception_id),
    }


def _grade_fill_blank(exercise: dict, answer: str) -> dict:
    normalized = answer.strip().lower()
    correct_normalized = exercise["answer"].strip().lower()
    is_correct = normalized == correct_normalized

    if is_correct:
        return {
            "correct": True,
            "misconception_id": None,
            "feedback": f"Correct. The answer is {exercise['answer']}.",
            "explanation": _explanation_for(exercise),
        }

    misconception_id = exercise.get("misconception_map", {}).get(answer.strip())
    correction = f"Not quite. The correct answer is: {exercise['answer']}"
    specific = MISCONCEPTION_FEEDBACK.get(misconception_id)
    feedback = f"{correction} — {specific}" if specific else correction
    return {
        "correct": False,
        "misconception_id": misconception_id,
        "feedback": feedback,
        "explanation": _explanation_for(exercise, misconception_id),
    }


def _grade_select_all(exercise: dict, answers: list[str]) -> dict:
    submitted = set(a.strip() for a in answers)
    correct_set = set(exercise["answers"])
    is_correct = submitted == correct_set

    if is_correct:
        return {
            "correct": True,
            "misconception_id": None,
            "feedback": "Correct. You picked exactly the right set.",
            "explanation": _explanation_for(exercise),
        }

    misconception_id = None
    for option, mid in exercise.get("misconception_map", {}).items():
        if (option in submitted) != (option in correct_set):
            misconception_id = mid
            break

    correction = f"Not quite. The correct selection is: {', '.join(sorted(correct_set))}"
    specific = MISCONCEPTION_FEEDBACK.get(misconception_id)
    feedback = f"{correction} — {specific}" if specific else correction
    return {
        "correct": False,
        "misconception_id": misconception_id,
        "feedback": feedback,
        "explanation": _explanation_for(exercise, misconception_id),
    }


def _grade_write_code(exercise: dict, code: str) -> dict:
    test_cases = exercise.get("test_cases", [])
    failures = []

    for i, case in enumerate(test_cases):
        result = run_for_grading(code, stdin=case.get("input"))
        actual = result["stdout"].rstrip("\n")
        expected = case["expected_output"].rstrip("\n")

        if result["stderr"]:
            failures.append(
                f"Test case {i + 1} raised an error: {result['stderr'].strip().splitlines()[-1]}"
            )
        elif actual != expected:
            failures.append(
                f"Test case {i + 1} expected \"{expected}\" but got \"{actual}\""
            )

    if not failures:
        return {
            "correct": True,
            "misconception_id": None,
            "feedback": "All test cases passed.",
            "explanation": _explanation_for(exercise),
        }

    return {
        "correct": False,
        "misconception_id": None,
        "feedback": " | ".join(failures),
        "explanation": _explanation_for(exercise),
    }


def evaluate_answer(
    module_id: str,
    question_id: str,
    answer: str = "",
    answers: "list[str] | None" = None,
    code: "str | None" = None,
) -> dict:
    """Evaluate a learner's submission against the exercise bank.

    Dispatches on the exercise's declared type:
      - mcq / fill_blank: compares `answer` against the stored answer
      - select_all: compares `answers` against the stored answer set
      - write_code: runs `code` against the exercise's test_cases
    """
    exercise = _find_exercise(module_id, question_id)

    if exercise is None:
        return {
            "correct": False,
            "misconception_id": None,
            "feedback": f"No exercise found for module '{module_id}', question '{question_id}'.",
        }

    ex_type = exercise["type"]

    if ex_type == "mcq":
        return _grade_mcq(exercise, answer)
    if ex_type == "fill_blank":
        return _grade_fill_blank(exercise, answer)
    if ex_type == "select_all":
        return _grade_select_all(exercise, answers or [])
    if ex_type == "write_code":
        return _grade_write_code(exercise, code or "")

    return {
        "correct": False,
        "misconception_id": None,
        "feedback": f"Unknown exercise type '{ex_type}'.",
    }


def get_exercise(module_id: str, question_id: str) -> dict | None:
    """Return the exercise definition, e.g. for rendering the question UI."""
    return _find_exercise(module_id, question_id)


def get_module_exercises(module_id: str) -> list[dict]:
    """Return all exercises for a given module, in bank order."""
    return [e for e in _load_exercises() if e["module_id"] == module_id]
