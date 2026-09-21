import json
import os
import re
import time

from app.services import (
    comparison_engine,
    formatting_engine,
    immutability_engine,
    indexing_engine,
    intro_engine,
    looping_engine,
    methods_engine,
    slicing_engine,
)

ENGINES = {
    "intro": (intro_engine.generate, intro_engine.grade),
    "indexing": (indexing_engine.generate, indexing_engine.grade),
    "slicing": (slicing_engine.generate, slicing_engine.grade),
    "looping": (looping_engine.generate, looping_engine.grade),
    "comparison": (comparison_engine.generate, comparison_engine.grade),
    "methods": (methods_engine.generate, methods_engine.grade),
    "immutability": (immutability_engine.generate, immutability_engine.grade),
    "formatting": (formatting_engine.generate, formatting_engine.grade),
}

QUESTIONS_PER_MODULE = int(os.getenv("R5_QPM", "3000"))


def parse_correct_answer_list(answer_text):
    if not answer_text:
        return []
    text = str(answer_text)
    # Engines serialize select-all answers with ", " delimiter. Splitting on plain
    # comma corrupts options that contain internal commas (e.g. replace('a','b')).
    delimiter = ", " if ", " in text else ","
    return [part.strip() for part in text.split(delimiter) if part.strip()]


def parse_index_from_expr(expr):
    m = re.search(r"\[\s*(-?\d+)\s*\]$", str(expr or ""))
    return int(m.group(1)) if m else None


def parse_slice_from_expr(expr):
    text = str(expr or "")
    if "[" not in text or "]" not in text:
        return None
    inner = text[text.index("[") + 1:text.rindex("]")]
    parts = [p.strip() for p in inner.split(":")]
    if len(parts) == 2:
        parts.append("")
    if len(parts) != 3:
        return None
    return {
        "start": parts[0],
        "stop": parts[1],
        "step": parts[2],
    }


def tampered_token_rejected(question, grade):
    token = question.get("token")
    if not token:
        return False
    bad = token[:-1] + ("A" if token[-1] != "A" else "B")
    result = grade(bad, {"answer": "x"})
    return result.get("ok") is False


def evaluate_question(question, grade):
    qtype = question.get("type")
    metrics = {
        "has_token": bool(question.get("token")),
        "duplicate_options": False,
        "tamper_rejected": tampered_token_rejected(question, grade),
        "recoverable": None,
        "select_all_unique": None,
    }

    options = question.get("options") or []
    if qtype in ("mcq", "select_all"):
        metrics["duplicate_options"] = len(set(options)) != len(options)

    if qtype in ("mcq", "fill_blank"):
        wrong_probe = grade(question["token"], {"answer": "__definitely_wrong__"})
        if wrong_probe.get("ok") is not True or "correct_answer" not in wrong_probe:
            metrics["recoverable"] = False
            return metrics
        correct_answer = wrong_probe.get("correct_answer")
        correct_probe = grade(question["token"], {"answer": correct_answer})
        metrics["recoverable"] = bool(correct_probe.get("ok") and correct_probe.get("correct"))
        return metrics

    if qtype == "select_all":
        if not options:
            metrics["recoverable"] = False
            metrics["select_all_unique"] = False
            return metrics
        wrong_probe = grade(question["token"], {"answers": []})
        parsed = parse_correct_answer_list(wrong_probe.get("correct_answer", ""))
        correct_probe = grade(question["token"], {"answers": parsed})
        metrics["recoverable"] = bool(correct_probe.get("ok") and correct_probe.get("correct"))
        metrics["select_all_unique"] = None
        return metrics

    if qtype == "build_index":
        wrong_probe = grade(question["token"], {"index": "0"})
        idx = parse_index_from_expr(wrong_probe.get("correct_answer"))
        if idx is None:
            metrics["recoverable"] = False
            return metrics
        correct_probe = grade(question["token"], {"index": str(idx)})
        metrics["recoverable"] = bool(correct_probe.get("ok") and correct_probe.get("correct"))
        return metrics

    if qtype == "build_slice":
        wrong_probe = grade(question["token"], {"slice": {"start": "", "stop": "", "step": ""}})
        parsed = parse_slice_from_expr(wrong_probe.get("correct_answer"))
        if parsed is None:
            metrics["recoverable"] = False
            return metrics
        correct_probe = grade(question["token"], {"slice": parsed})
        metrics["recoverable"] = bool(correct_probe.get("ok") and correct_probe.get("correct"))
        return metrics

    if qtype == "write_code":
        probe = grade(question["token"], {"code": "print('x')"})
        metrics["recoverable"] = bool(probe.get("ok") is True and "correct" in probe)
        return metrics

    metrics["recoverable"] = False
    return metrics


def run_module(name, generate, grade):
    out = {
        "generated": 0,
        "by_type": {},
        "duplicate_option_questions": 0,
        "tamper_rejected": 0,
        "recoverable": 0,
        "select_all_unique": 0,
        "select_all_total": 0,
    }

    started = time.perf_counter()
    print(f"[r5] module={name} start qpm={QUESTIONS_PER_MODULE}", flush=True)
    for i in range(QUESTIONS_PER_MODULE):
        tier = (i % 5) + 1
        q = generate(tier=tier)
        out["generated"] += 1
        qtype = q.get("type", "unknown")
        out["by_type"][qtype] = out["by_type"].get(qtype, 0) + 1

        metrics = evaluate_question(q, grade)
        if metrics["duplicate_options"]:
            out["duplicate_option_questions"] += 1
        if metrics["tamper_rejected"]:
            out["tamper_rejected"] += 1
        if metrics["recoverable"]:
            out["recoverable"] += 1
        if qtype == "select_all":
            out["select_all_total"] += 1
            if metrics["select_all_unique"]:
                out["select_all_unique"] += 1

        if (i + 1) % 500 == 0:
            print(f"[r5] module={name} progress={i + 1}", flush=True)

    out["seconds"] = round(time.perf_counter() - started, 2)
    out["tamper_rejected_pct"] = round(100 * out["tamper_rejected"] / out["generated"], 2)
    out["recoverable_pct"] = round(100 * out["recoverable"] / out["generated"], 2)
    out["duplicate_option_pct"] = round(100 * out["duplicate_option_questions"] / out["generated"], 4)
    out["select_all_unique_pct"] = None
    return out


def main():
    summary = {
        "questions_per_module": QUESTIONS_PER_MODULE,
        "modules": {},
        "totals": {
            "generated": 0,
            "duplicate_option_questions": 0,
            "tamper_rejected": 0,
            "recoverable": 0,
            "select_all_unique": 0,
            "select_all_total": 0,
        },
    }

    for name, (generate, grade) in ENGINES.items():
        result = run_module(name, generate, grade)
        summary["modules"][name] = result
        summary["totals"]["generated"] += result["generated"]
        summary["totals"]["duplicate_option_questions"] += result["duplicate_option_questions"]
        summary["totals"]["tamper_rejected"] += result["tamper_rejected"]
        summary["totals"]["recoverable"] += result["recoverable"]
        summary["totals"]["select_all_unique"] += result["select_all_unique"]
        summary["totals"]["select_all_total"] += result["select_all_total"]
        print(f"[r5] module={name} done seconds={result['seconds']}", flush=True)

    t = summary["totals"]
    t["tamper_rejected_pct"] = round(100 * t["tamper_rejected"] / t["generated"], 2)
    t["recoverable_pct"] = round(100 * t["recoverable"] / t["generated"], 2)
    t["duplicate_option_pct"] = round(100 * t["duplicate_option_questions"] / t["generated"], 4)
    t["select_all_unique_pct"] = None

    print(json.dumps(summary, indent=2, sort_keys=True))


if __name__ == "__main__":
    main()
