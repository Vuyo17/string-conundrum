#!/usr/bin/env python3
"""Generate isiXhosa translations for the lesson and exercise content.

Runs ONCE, offline, and writes files that get committed — the app never calls a
translation API at runtime. That keeps lessons instant, free and available
offline, and makes every translation reviewable in a pull request.

Usage:
    pip install anthropic
    export ANTHROPIC_API_KEY=sk-ant-...          # or: ant auth login
    python scripts/translate_content.py exercises      # backend exercise bank
    python scripts/translate_content.py modules        # lesson content stubs
    python scripts/translate_content.py exercises --limit 20 --dry-run

The hard rule this enforces: **code stays English.** Python keywords, method
names, and anything in backticks or a code block must survive byte-identical.
`verify_code_spans` re-checks every translation and rejects any that altered a
code span, so a bad translation fails loudly instead of teaching syntax that
does not run.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

try:
    import anthropic
except ImportError:
    sys.exit("pip install anthropic")

MODEL = "claude-opus-5"
ROOT = Path(__file__).resolve().parent.parent
EXERCISES = ROOT / "backend" / "app" / "data" / "exercises.json"

# Anything in backticks, or that looks like an identifier call / subscript.
CODE_SPAN = re.compile(r"`[^`]*`|\b\w+\(\)|\b\w+\[[^\]]*\]")

SYSTEM = """You translate Python teaching material from English into isiXhosa \
for first-year University of Cape Town students.

Rules, in priority order:

1. NEVER translate code. Python keywords (for, while, if, in, len, print, def,
   return, True, False, None), method names (upper, lower, strip, replace,
   count, find, split, join), variable names, and anything inside backticks or
   a code block must be reproduced EXACTLY, character for character.
2. Keep established programming terms in English: string, index, slice, loop,
   variable, method, list, escape sequence, f-string, Unicode. The student's
   lecturer, textbook and exam use these English terms — inventing isiXhosa
   equivalents would disadvantage them at assessment time. You may add a short
   isiXhosa gloss in parentheses on first use within a passage.
3. Translate the surrounding explanatory prose into natural, clear isiXhosa
   pitched at a first-year student. Prefer plain phrasing over literal
   word-for-word rendering.
4. Preserve all markup exactly: **bold**, `backticks`, \\n escapes, {braces}.
5. Return ONLY the translated text. No preamble, no quotes around it, no notes.
"""


def code_spans(text: str) -> list[str]:
    return CODE_SPAN.findall(text or "")


def verify_code_spans(source: str, translated: str) -> list[str]:
    """Return the code spans that the translation dropped or altered."""
    missing = []
    for span in code_spans(source):
        if span not in translated:
            missing.append(span)
    return missing


def translate(client: anthropic.Anthropic, text: str) -> str:
    response = client.messages.create(
        model=MODEL,
        max_tokens=4096,
        system=SYSTEM,
        messages=[{"role": "user", "content": text}],
    )
    if response.stop_reason == "refusal":
        raise RuntimeError("request declined by safety classifiers")
    return next(b.text for b in response.content if b.type == "text").strip()


def translate_checked(client: anthropic.Anthropic, text: str, label: str) -> str | None:
    """Translate, then reject the result if any code span changed."""
    out = translate(client, text)
    broken = verify_code_spans(text, out)
    if broken:
        print(f"  ! {label}: code spans altered {broken} — skipped", file=sys.stderr)
        return None
    return out


def do_exercises(client, limit: int | None, dry_run: bool) -> None:
    bank = json.loads(EXERCISES.read_text(encoding="utf-8"))
    todo = [e for e in bank if "prompt_xh" not in e][:limit]
    print(f"{len(todo)} of {len(bank)} exercises need translating")

    for i, ex in enumerate(todo, 1):
        label = ex.get("question_id", f"#{i}")
        print(f"[{i}/{len(todo)}] {label}")
        if dry_run:
            continue

        prompt_xh = translate_checked(client, ex["prompt"], f"{label}.prompt")
        if prompt_xh:
            ex["prompt_xh"] = prompt_xh

        # Options are answer values the grader compares against, so they are
        # deliberately NOT translated — a translated option would never match
        # the stored answer. Only the hint travels with the prompt.
        if ex.get("hint"):
            hint_xh = translate_checked(client, ex["hint"], f"{label}.hint")
            if hint_xh:
                ex["hint_xh"] = hint_xh

    if not dry_run:
        EXERCISES.write_text(
            json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"wrote {EXERCISES}")


def do_modules(client, limit: int | None, dry_run: bool) -> None:
    """Print translated prose for the lesson files.

    Module content is JS, not data, so this prints translations for a human to
    paste into `frontend/src/data/moduleContent/xh/<id>.js` rather than
    rewriting source automatically. `xh/intro.js` is the worked reference for
    the shape and tone.
    """
    src_dir = ROOT / "frontend" / "src" / "data" / "moduleContent"
    field = re.compile(r"(text|title|intro|caption):\s*'((?:[^'\\]|\\.)*)'")

    for path in sorted(src_dir.glob("*.js")):
        if path.name == "index.js":
            continue
        if (src_dir / "xh" / path.name).exists():
            print(f"-- {path.name}: already translated, skipping")
            continue

        print(f"\n===== {path.name} =====")
        matches = field.findall(path.read_text(encoding="utf-8"))[:limit]
        for key, value in matches:
            if dry_run:
                print(f"{key}: {value[:70]}")
                continue
            out = translate_checked(client, value, f"{path.name}:{key}")
            if out:
                print(f"{key}: {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", choices=["exercises", "modules"])
    parser.add_argument("--limit", type=int, help="only process the first N items")
    parser.add_argument("--dry-run", action="store_true", help="list work, call nothing")
    args = parser.parse_args()

    client = None if args.dry_run else anthropic.Anthropic()
    runner = do_exercises if args.target == "exercises" else do_modules
    runner(client, args.limit, args.dry_run)


if __name__ == "__main__":
    main()
