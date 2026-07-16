import ast
import subprocess
import sys
from typing import Any

# ─── safe execution ──────────────────────────────────────────────────────────


def execute_code(code: str, stdin: str | None = None) -> dict:
    """Execute Python code in a subprocess with a 5-second timeout.

    If stdin is given, it is piped to the process so the code can use
    input() calls (used when grading write_code exercises against
    test cases).
    """
    try:
        result = subprocess.run(
            [sys.executable, "-c", code],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=5,
        )
        stdout = result.stdout
        stderr = result.stderr
        timed_out = False
    except subprocess.TimeoutExpired:
        stdout = ""
        stderr = "Execution timed out (5 second limit)."
        timed_out = True
    except Exception as e:
        stdout = ""
        stderr = str(e)
        timed_out = False

    steps = trace_steps(code)

    return {
        "stdout": stdout,
        "stderr": stderr,
        "timed_out": timed_out,
        "steps": steps,
    }


# ─── step tracer ─────────────────────────────────────────────────────────────

_SAFE_BUILTINS: dict[str, Any] = {
    "len": len,
    "range": range,
    "str": str,
    "int": int,
    "print": print,
    "enumerate": enumerate,
    "list": list,
    "upper": str.upper,
    "lower": str.lower,
}

_MAX_STEPS = 200  # guard against infinite loops in the tracer


def trace_steps(code: str) -> list[dict]:
    """
    Walk the user's code statement-by-statement and produce one debugger step
    per meaningful event:
      • assignment
      • for-loop iteration (one step per body execution)
      • while-loop condition check + body execution
      • if/elif/else branch taken
      • print() call
      • string index / slice access
    Each step carries: line, event, variables, highlight, output, description.
    """
    try:
        tree = ast.parse(code)
    except SyntaxError as exc:
        return [
            {
                "line": exc.lineno or 1,
                "event": "error",
                "variables": {},
                "highlight": [],
                "output": str(exc),
                "description": f"Syntax error: {exc}",
            }
        ]

    env: dict[str, Any] = {}
    steps: list[dict] = []

    def snapshot(env: dict) -> dict:
        """Return a JSON-serialisable copy of the environment."""
        safe: dict = {}
        for k, v in env.items():
            if isinstance(v, (str, int, float, bool, type(None))):
                safe[k] = v
            elif isinstance(v, (list, tuple)):
                safe[k] = [
                    x for x in v if isinstance(x, (str, int, float, bool, type(None)))
                ]
        return safe

    def add(
        line: int,
        event: str,
        desc: str,
        highlight: list[int],
        out: str = "",
        extra: dict | None = None,
    ) -> None:
        if len(steps) >= _MAX_STEPS:
            return
        step: dict = {
            "line": line,
            "event": event,
            "variables": snapshot(env),
            "highlight": highlight,
            "output": out,
            "description": desc,
        }
        if extra:
            step.update(extra)
        steps.append(step)

    def highlight_for_subscript(node: ast.Subscript, local_env: dict) -> list[int]:
        """Return highlighted char indices for an index/slice on a known string var."""
        if not isinstance(node.value, ast.Name):
            return []
        val = local_env.get(node.value.id)
        if not isinstance(val, str):
            return []
        n = len(val)
        sl = node.slice
        try:
            if isinstance(sl, ast.Slice):
                lo = (
                    eval(ast.unparse(sl.lower), {"__builtins__": {}}, local_env)
                    if sl.lower
                    else 0
                )
                hi = (
                    eval(ast.unparse(sl.upper), {"__builtins__": {}}, local_env)
                    if sl.upper
                    else n
                )
                lo = lo if lo >= 0 else max(0, n + lo)
                hi = hi if hi >= 0 else max(0, n + hi)
                return list(range(max(0, lo), min(n, hi)))
            else:
                idx = eval(ast.unparse(sl), {"__builtins__": {}}, local_env)
                if isinstance(idx, int):
                    norm = idx if idx >= 0 else n + idx
                    return [norm] if 0 <= norm < n else []
        except Exception:
            pass
        return []

    def string_vars_in_env() -> dict[str, str]:
        return {k: v for k, v in env.items() if isinstance(v, str)}

    def eval_expr(node: ast.expr) -> Any:
        try:
            src = ast.unparse(node)
            return eval(src, {"__builtins__": _SAFE_BUILTINS}, env)
        except Exception:
            return None

    def exec_stmt(stmt: ast.stmt) -> None:
        """Recursively execute a statement and record steps."""
        if len(steps) >= _MAX_STEPS:
            return

        line = getattr(stmt, "lineno", 1)

        # ── assignment ────────────────────────────────────────────────────
        if isinstance(stmt, ast.Assign):
            val = eval_expr(stmt.value)
            for target in stmt.targets:
                if isinstance(target, ast.Name):
                    env[target.id] = val
            src = ast.unparse(stmt)
            hl: list[int] = []
            # if rhs is a subscript on a string var, highlight chars
            if isinstance(stmt.value, ast.Subscript):
                hl = highlight_for_subscript(stmt.value, env)
            add(line, "assign", f"{src}  →  {repr(val)}", hl)

        elif isinstance(stmt, ast.AugAssign):
            val = eval_expr(stmt.value)
            tgt_name = stmt.target.id if isinstance(stmt.target, ast.Name) else "?"
            old = env.get(tgt_name, 0)
            full_src = ast.unparse(stmt)
            try:
                new_val = eval_expr(
                    ast.Expression(
                        body=ast.BinOp(left=stmt.target, op=stmt.op, right=stmt.value)
                    )
                )
            except Exception:
                new_val = val
            env[tgt_name] = new_val
            add(line, "assign", f"{full_src}  →  {tgt_name} = {repr(new_val)}", [])

        # ── print call ────────────────────────────────────────────────────
        elif isinstance(stmt, ast.Expr) and isinstance(stmt.value, ast.Call):
            call = stmt.value
            func_name = ""
            if isinstance(call.func, ast.Name):
                func_name = call.func.id
            elif isinstance(call.func, ast.Attribute):
                func_name = call.func.attr

            if func_name == "print":
                parts = [eval_expr(a) for a in call.args]
                out_str = " ".join(str(p) for p in parts if p is not None)
                hl = []
                if call.args and isinstance(call.args[0], ast.Subscript):
                    hl = highlight_for_subscript(call.args[0], env)
                elif call.args and isinstance(call.args[0], ast.Call):
                    # e.g. print(text.upper())
                    inner = call.args[0]
                    if isinstance(inner.func, ast.Attribute) and isinstance(
                        inner.func.value, ast.Name
                    ):
                        s_val = env.get(inner.func.value.id)
                        if isinstance(s_val, str):
                            hl = list(range(len(s_val)))
                add(
                    line,
                    "print",
                    f'print({", ".join(repr(p) for p in parts)}) → "{out_str}"',
                    hl,
                    out=out_str,
                )
            else:
                # Other expression statement — string method call on a variable
                val = eval_expr(stmt.value)
                src = ast.unparse(stmt.value)
                hl = []
                if isinstance(call.func, ast.Attribute) and isinstance(
                    call.func.value, ast.Name
                ):
                    s_val = env.get(call.func.value.id)
                    if isinstance(s_val, str):
                        hl = list(range(len(s_val)))
                add(line, "call", f"{src}  →  {repr(val)}", hl)

        # ── for loop ──────────────────────────────────────────────────────
        elif isinstance(stmt, ast.For):
            iter_val = eval_expr(stmt.iter)
            iter_name = stmt.target.id if isinstance(stmt.target, ast.Name) else "?"
            if iter_val is None:
                return
            items = list(iter_val)[:_MAX_STEPS]  # clamp
            for i, item in enumerate(items):
                if len(steps) >= _MAX_STEPS:
                    break
                env[iter_name] = item
                # record the loop iteration header step
                hl = []
                # if iterating over a string variable, highlight current char
                if isinstance(stmt.iter, ast.Name) and isinstance(
                    env.get(stmt.iter.id), str
                ):
                    s = env[stmt.iter.id]
                    norm = i if i >= 0 else len(s) + i
                    if 0 <= norm < len(s):
                        hl = [norm]
                elif isinstance(stmt.iter, ast.Call):
                    # range() call — nothing to highlight on a string directly
                    pass

                add(
                    line,
                    "for",
                    f"for {iter_name} in ...:  iteration {i + 1} of {len(items)}"
                    f"  →  {iter_name} = {repr(item)}",
                    hl,
                    extra={
                        "iteration": i + 1,
                        "total": len(items),
                        "iter_var": iter_name,
                        "iter_val": repr(item),
                    },
                )

                for body_stmt in stmt.body:
                    exec_stmt(body_stmt)

            # orelse (for-else)
            if not items or len(items) < _MAX_STEPS:
                for s in stmt.orelse:
                    exec_stmt(s)

        # ── while loop ────────────────────────────────────────────────────
        elif isinstance(stmt, ast.While):
            iteration = 0
            while True:
                if len(steps) >= _MAX_STEPS:
                    break
                cond_val = eval_expr(stmt.test)
                cond_src = ast.unparse(stmt.test)
                add(
                    line,
                    "while",
                    f"while {cond_src}:  condition = {repr(cond_val)}",
                    [],
                    extra={
                        "condition": cond_src,
                        "condition_result": bool(cond_val),
                        "iteration": iteration + 1,
                    },
                )

                if not cond_val:
                    break
                iteration += 1
                if iteration > _MAX_STEPS:
                    break

                for body_stmt in stmt.body:
                    exec_stmt(body_stmt)

        # ── if / elif / else ──────────────────────────────────────────────
        elif isinstance(stmt, ast.If):
            cond_val = eval_expr(stmt.test)
            cond_src = ast.unparse(stmt.test)
            branch = "if (True)" if cond_val else "if (False) → else"
            add(
                line,
                "if",
                f"if {cond_src}:  →  {branch}",
                [],
                extra={"condition": cond_src, "condition_result": bool(cond_val)},
            )
            if cond_val:
                for s in stmt.body:
                    exec_stmt(s)
            else:
                for s in stmt.orelse:
                    exec_stmt(s)

        # ── pass / other ──────────────────────────────────────────────────
        else:
            try:
                val = eval_expr(stmt) if isinstance(stmt, ast.Expr) else None
            except Exception:
                val = None
            src = ast.unparse(stmt)
            if src.strip() not in ("pass", ""):
                add(line, "stmt", src, [])

    for node in ast.iter_child_nodes(tree):
        if isinstance(node, ast.stmt):
            exec_stmt(node)

    return steps


# ─── grading runner (no debugger trace) ──────────────────────────────────────


def run_for_grading(code: str, stdin: str | None = None) -> dict:
    """Run code for exercise grading only. Skips trace_steps since grading
    doesn't need a debugger trace and some submissions (e.g. those using
    input()) aren't safe to re-run through the AST-walking tracer.
    """
    try:
        result = subprocess.run(
            [sys.executable, "-c", code],
            input=stdin,
            capture_output=True,
            text=True,
            timeout=5,
        )
        return {"stdout": result.stdout, "stderr": result.stderr, "timed_out": False}
    except subprocess.TimeoutExpired:
        return {"stdout": "", "stderr": "Execution timed out (5 second limit).", "timed_out": True}
    except Exception as e:
        return {"stdout": "", "stderr": str(e), "timed_out": False}
