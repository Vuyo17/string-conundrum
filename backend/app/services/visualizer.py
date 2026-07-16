import ast

_SAFE_BUILTINS = {'len': len, 'range': range, 'str': str, 'int': int}


def build_visual_state(expression: str, context: dict) -> dict:
    """Build render-ready visual state by evaluating a string expression."""
    # Pick the first string value in context as the source
    source_value = ''
    var_name = 'word'
    for key, val in context.items():
        if isinstance(val, str):
            source_value = val
            var_name = key
            break
    if not source_value:
        source_value = str(context.get('word', 'python'))

    result_value = ''
    highlighted_indices: list[int] = []
    operation = 'noop'

    try:
        local_ns = {k: v for k, v in context.items() if isinstance(v, (str, int, float, bool))}
        evaled = eval(expression, {'__builtins__': _SAFE_BUILTINS}, local_ns)
        result_value = evaled if isinstance(evaled, str) else repr(evaled)

        tree = ast.parse(expression, mode='eval')
        body = tree.body
        n = len(source_value)

        if isinstance(body, ast.Subscript):
            slice_node = body.slice
            if isinstance(slice_node, ast.Slice):
                operation = 'slice'
                lower_val = (
                    eval(ast.unparse(slice_node.lower), {'__builtins__': _SAFE_BUILTINS}, local_ns)
                    if slice_node.lower else 0
                )
                upper_val = (
                    eval(ast.unparse(slice_node.upper), {'__builtins__': _SAFE_BUILTINS}, local_ns)
                    if slice_node.upper else n
                )
                if lower_val < 0:
                    lower_val = max(0, n + lower_val)
                if upper_val < 0:
                    upper_val = max(0, n + upper_val)
                lower_val = max(0, min(lower_val, n))
                upper_val = max(0, min(upper_val, n))
                highlighted_indices = list(range(lower_val, upper_val))
            else:
                operation = 'index'
                idx_val = eval(ast.unparse(slice_node), {'__builtins__': _SAFE_BUILTINS}, local_ns)
                if isinstance(idx_val, int):
                    norm = idx_val if idx_val >= 0 else n + idx_val
                    if 0 <= norm < n:
                        highlighted_indices = [norm]
        elif isinstance(body, ast.Call):
            operation = 'method'
            highlighted_indices = list(range(n))
        else:
            operation = 'noop'

    except Exception:
        operation = 'error'

    return {
        'source': {
            'value': source_value,
            'cells': [{'char': ch, 'index': idx} for idx, ch in enumerate(source_value)],
        },
        'result': {
            'value': result_value,
            'cells': [{'char': ch, 'index': idx} for idx, ch in enumerate(result_value)],
        },
        'highlighted_indices': highlighted_indices,
        'operation': operation,
        'expression': expression,
    }
