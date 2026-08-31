from app.services import error_translation


def test_translate_error_returns_none_for_empty_stderr():
    assert error_translation.translate_error("") is None
    assert error_translation.translate_error("   ") is None


def test_translate_error_returns_none_for_unrecognisable_text():
    # No "SomethingError: ..." line at all -- nothing to classify.
    assert error_translation.translate_error("not a traceback") is None


def test_translate_error_classifies_index_error_with_line_number():
    stderr = (
        'Traceback (most recent call last):\n'
        '  File "<string>", line 34, in <module>\n'
        '  File "<learner_code>", line 5, in <module>\n'
        'IndexError: string index out of range\n'
    )
    result = error_translation.translate_error(stderr)
    assert result is not None
    assert "5" in result
    assert "XX0XX" not in result  # placeholder must always be substituted


def test_translate_error_uses_deepest_learner_code_frame():
    # Nested frames (e.g. unbounded recursion): the line closest to where
    # execution actually stopped is the last "<learner_code>" frame, not
    # the first.
    stderr = (
        'Traceback (most recent call last):\n'
        '  File "<string>", line 34, in <module>\n'
        '  File "<learner_code>", line 3, in <module>\n'
        '  File "<learner_code>", line 2, in f\n'
        '  File "<learner_code>", line 2, in f\n'
        '  [Previous line repeated 995 more times]\n'
        'RecursionError: maximum recursion depth exceeded\n'
    )
    result = error_translation.translate_error(stderr)
    assert result is not None
    assert "2" in result


def test_translate_error_unrecognised_exception_falls_back_to_generic():
    stderr = (
        'Traceback (most recent call last):\n'
        '  File "<learner_code>", line 7, in <module>\n'
        'SomeExoticError: never seen before\n'
    )
    result = error_translation.translate_error(stderr)
    assert result is not None
    assert "7" in result
    # generic template, not the exotic exception's own wording
    assert "impazamo" in result


def test_translate_error_maps_common_exception_types():
    cases = {
        "TypeError": "type",
        "ValueError": "value",
        "NameError": "name",
        "ZeroDivisionError": "zerodiv",
        "KeyError": "key",
        "AttributeError": "attribute",
        "SyntaxError": "syntax",
        "RecursionError": "recursion",
        "ImportError": "import",
        "ModuleNotFoundError": "import",
    }
    for exc_name, template_key in cases.items():
        stderr = f'File "<learner_code>", line 1\n{exc_name}: some message\n'
        result = error_translation.translate_error(stderr)
        assert result == error_translation._fill(template_key, 1), exc_name


def test_translate_timeout_returns_fixed_template():
    result = error_translation.translate_timeout("while True:\n    pass\n")
    assert result == error_translation._TEMPLATES_XH["timeout"]
    assert "XX0XX" not in result


def test_all_templates_have_no_leftover_placeholder_after_fill():
    for key in error_translation._TEMPLATES_XH:
        if key == "timeout":
            continue
        filled = error_translation._fill(key, 42)
        assert "XX0XX" not in filled
        assert "42" in filled
