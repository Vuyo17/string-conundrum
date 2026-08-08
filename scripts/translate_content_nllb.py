#!/usr/bin/env python3
"""Generate isiXhosa translations for lesson and exercise content using NLLB-200.

A local-model counterpart to `translate_content.py`, which does the same job via
the Claude API. Same CLI, same output fields, same hard rule: **code stays
English.** Runs ONCE, offline, and writes files that get committed — the app
never calls a translation model at runtime.

Usage:
    pip install torch transformers sentencepiece
    python scripts/translate_content_nllb.py exercises      # backend exercise bank
    python scripts/translate_content_nllb.py modules        # lesson content stubs
    python scripts/translate_content_nllb.py exercises --limit 20 --dry-run

Scope: prose only — prompts, hints and lesson text. Python source is never
translated, in any direction. (An isiXhosa/Python keyword transpiler is separate
work and no concern of this script.)

Why this is more defensive than the Claude version
--------------------------------------------------
Claude understands that a Python line is a Python line and leaves it alone. NLLB
is a pure translation model with no concept of syntax — hand it
`print(word[0:4])` and it returns isiXhosa-flavoured nonsense that does not run.
123 of the 270 exercise prompts mix raw Python into the prose with no backticks
or fencing to mark it:

    What does the following code print?
    word = "cat" + "fish"
    print(word)

So the model is never shown code at all. Each text is split into lines; a line
that is *entirely* Python is held back untouched, and any code fragment embedded
in a prose line is masked behind a placeholder. Only prose reaches NLLB.
Afterwards `verify_spans` re-checks the result and rejects it if any protected
fragment changed, so a bad translation fails loudly instead of shipping syntax
that does not run.

Both stages err toward "this is code". A code fragment wrongly left in English
is a cosmetic loss; a code fragment fed to NLLB is broken teaching material.
"""

from __future__ import annotations

import argparse
import ast
import json
import re
import sys
from pathlib import Path

try:
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
except ImportError:
    sys.exit("pip install torch transformers sentencepiece")

MODEL = "facebook/nllb-200-distilled-600M"
SRC_LANG = "eng_Latn"
TGT_LANG = "xho_Latn"

ROOT = Path(__file__).resolve().parent.parent
EXERCISES = ROOT / "backend" / "app" / "data" / "exercises.json"


# ---------------------------------------------------------------------------
# What counts as code
# ---------------------------------------------------------------------------

# Inherited verbatim from translate_content.py: backticks, or something that
# looks like an identifier call / subscript.
CODE_SPAN = re.compile(r"`[^`]*`|\b\w+\(\)|\b\w+\[[^\]]*\]")

# NLLB needs more protection than Claude does, so the inline mask extends
# CODE_SPAN with two more shapes that appear unfenced inside prose lines here:
#
#   assignment      "...storing the word as w = \"banana\"."
#                   "...runs the line: flag = hello (with no quotes...)"
#   quoted literal  "Select all slicing expressions below that produce \"ana\"."
#                   "...produces the exact text: Name: Hlomla"
#
# Quoted literals matter as much as syntax: they are the exact values the
# student must reproduce and the grader compares against, so a translated "ana"
# silently breaks the exercise. Claude leaves these alone unprompted; NLLB will
# not. Order matters — assignment comes before the bare-literal alternative so
# `w = "banana"` is captured whole rather than just the `"banana"`.
INLINE_SPAN = re.compile(
    r"""
      `[^`]*`                                   # `backticked`
    | \b\w+ (?:\.\w+)* \s* (?<![=!<>]) = (?!=)  # assignment target and operator
      \s* (?: "[^"]*" | '[^']*' | [^\s.,;]+ )   # ...and its right-hand side
    | \b\w+ (?:\.\w+)* \([^)]*\)                # call, with or without args
    | \b\w+ \[[^\]]*\]                          # subscript or slice
    | "[^"]*"                                   # bare double-quoted literal
    | (?<![A-Za-z]) '[^']*' (?![A-Za-z])        # bare single-quoted literal
    """,
    re.VERBOSE,
)

# Fragments that only make sense as part of a block, so they never parse alone.
DANGLING_BLOCK = re.compile(r"^\s*(?:else|elif\b.*|except\b.*|finally)\s*:\s*$")

# Cheap gate in front of the parser: a line with none of these has no code in it
# worth parsing. It exists to stop a bare English word — which happens to be a
# syntactically valid Python expression — from being taken for code. Kept
# case-sensitive on purpose: a prose line opening with "If" or "For" is a
# sentence, while a lowercase `for ch in "dog":` is a loop header.
CODE_SIGNAL = re.compile(
    r"""[=()\[\]]
      | ^\s*(?:for|if|elif|else|while|def|class|with|try|except|finally|lambda
             |async|await|break|continue|pass|return|import|from|del|raise
             |assert|global|nonlocal|yield)\b""",
    re.VERBOSE,
)

# Prose label prefixing a code line in some prompts: `Line 2: word.upper()`.
# The label stays English — splitting the line to translate two words is not
# worth the risk, and "Line 2:" is not what the exercise is testing.
LABEL_PREFIX = re.compile(r"^\s*(?:Line|Step|Row)\s+\d+\s*:\s*")

# Placeholder standing in for a masked fragment. The form was chosen by
# measurement, not taste — both obvious candidates lose fragments silently:
#
#   -style private-use chars   0/3 survived — SentencePiece maps every PUA
#                                    codepoint to <unk> and drops it, so nothing
#                                    comes back and every item fails.
#   [[0]] punctuation token          2/3 survived — survives tokenisation, but
#                                    generation drops it often enough to lose
#                                    roughly a third of the batch.
#   XX0XX alphabetic token           3/3 survived — NLLB treats it as an
#                                    ordinary word and copies it through.
#
# Symmetric delimiters keep the restore regex unambiguous. Collisions are not
# merely unlikely: `mask_spans` refuses to run if the source already contains
# something placeholder-shaped, so one would fail loudly rather than silently.
PLACEHOLDER = "XX{}XX"
PLACEHOLDER_RE = re.compile(r"XX(\d+)XX")


def parses_as_python(src: str) -> bool:
    """True if `src` is a syntactically complete line of Python.

    Python's own parser is the arbiter rather than a pile of regexes: it accepts
    `word = "cat" + "fish"` and rejects `mL = "kitten" (length 6). Select all of
    the indices below...`, which starts like an assignment but runs on into an
    English sentence. Those mixed lines have to reach NLLB as prose, with only
    the code fragment masked out.
    """
    for candidate in (src, f"{src}\n    pass"):  # second form allows block headers
        try:
            ast.parse(candidate)
            return True
        except SyntaxError:
            continue
    return False


def is_code_line(line: str) -> bool:
    """True if the whole line is Python and should never reach the model."""
    if not line.strip():
        return False

    # Prose in this content is never indented, so an indented line is a
    # continuation of a code block above it.
    if line[:1] in " \t":
        return True

    body = LABEL_PREFIX.sub("", line).strip()

    if body.startswith("#"):
        return True
    if DANGLING_BLOCK.match(body):
        return True
    if not CODE_SIGNAL.search(body):
        # No assignment, call, subscript or statement keyword: it is a sentence.
        return False
    return parses_as_python(body)


def mask_spans(text: str) -> tuple[str, list[str]]:
    """Replace inline code fragments with placeholders. Returns (masked, spans)."""
    if PLACEHOLDER_RE.search(text):
        # Real content already looks like a placeholder, so restoring would be
        # ambiguous. Refuse rather than guess.
        raise ValueError("text already contains a placeholder-shaped token")

    spans: list[str] = []

    def take(match: re.Match[str]) -> str:
        spans.append(match.group(0))
        return PLACEHOLDER.format(len(spans) - 1)

    return INLINE_SPAN.sub(take, text), spans


def unmask_spans(text: str, spans: list[str]) -> str:
    """Put the original fragments back, verbatim."""

    def give(match: re.Match[str]) -> str:
        index = int(match.group(1))
        return spans[index] if index < len(spans) else match.group(0)

    return PLACEHOLDER_RE.sub(give, text)


def protected_spans(text: str) -> list[str]:
    """Every fragment of `text` that must survive translation byte-identical."""
    spans = []
    for line in (text or "").split("\n"):
        if is_code_line(line):
            spans.append(line)
        else:
            spans.extend(INLINE_SPAN.findall(line))
    return spans


def verify_spans(source: str, translated: str) -> list[str]:
    """Return the protected fragments the translation dropped or altered."""
    return [span for span in protected_spans(source) if span not in translated]


# ---------------------------------------------------------------------------
# Translation
# ---------------------------------------------------------------------------


class Translator:
    """Wraps NLLB-200. The model is loaded once and reused for every call."""

    def __init__(self) -> None:
        print(f"loading {MODEL} (first run downloads ~2.5GB)", file=sys.stderr)
        self.tokenizer = AutoTokenizer.from_pretrained(MODEL, src_lang=SRC_LANG)
        self.model = AutoModelForSeq2SeqLM.from_pretrained(MODEL)
        self.model.eval()
        self.bos = self.tokenizer.convert_tokens_to_ids(TGT_LANG)

    def _generate(self, text: str) -> str:
        encoded = self.tokenizer(
            text, return_tensors="pt", truncation=True, max_length=512
        )
        tokens = self.model.generate(
            **encoded,
            forced_bos_token_id=self.bos,
            max_new_tokens=512,
            num_beams=4,
        )
        return self.tokenizer.batch_decode(tokens, skip_special_tokens=True)[0].strip()

    def _translate_prose_line(self, line: str) -> str:
        masked, spans = mask_spans(line)
        if not re.search(r"[A-Za-z]", PLACEHOLDER_RE.sub("", masked)):
            # Placeholders and punctuation only — no prose left to translate.
            return line
        return unmask_spans(self._generate(masked), spans)

    def translate(self, text: str) -> str:
        """Translate a text, holding every code line back from the model."""
        return "\n".join(
            line if is_code_line(line) else self._translate_prose_line(line)
            for line in text.split("\n")
        )


def translate_checked(translator: Translator, text: str, label: str) -> str | None:
    """Translate, then reject the result if any protected fragment changed."""
    try:
        out = translator.translate(text)
    except ValueError as exc:
        print(f"  ! {label}: {exc} — skipped", file=sys.stderr)
        return None

    broken = verify_spans(text, out)
    if broken:
        print(f"  ! {label}: code altered {broken} — skipped", file=sys.stderr)
        return None
    return out


# ---------------------------------------------------------------------------
# Targets
# ---------------------------------------------------------------------------


def do_exercises(translator, limit: int | None, dry_run: bool) -> None:
    bank = json.loads(EXERCISES.read_text(encoding="utf-8"))
    todo = [e for e in bank if "prompt_xh" not in e][:limit]
    print(f"{len(todo)} of {len(bank)} exercises need translating")

    for i, ex in enumerate(todo, 1):
        label = ex.get("question_id", f"#{i}")
        print(f"\n[{i}/{len(todo)}] {label}")

        if dry_run:
            # Show the split the model would see, so a misclassified line is
            # caught before spending a batch on it.
            for line in ex["prompt"].split("\n"):
                if is_code_line(line):
                    print(f"    CODE   {line}")
                else:
                    masked, _ = mask_spans(line)
                    print(f"    PROSE  {masked}")
            continue

        prompt_xh = translate_checked(translator, ex["prompt"], f"{label}.prompt")
        if prompt_xh:
            ex["prompt_xh"] = prompt_xh
            for line in prompt_xh.split("\n"):
                print(f"    {line}")

        # Options are answer values the grader compares against, so they are
        # deliberately NOT translated — a translated option would never match
        # the stored answer. Only the hint travels with the prompt.
        if ex.get("hint"):
            hint_xh = translate_checked(translator, ex["hint"], f"{label}.hint")
            if hint_xh:
                ex["hint_xh"] = hint_xh

    if not dry_run:
        EXERCISES.write_text(
            json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"\nwrote {EXERCISES}")


def do_modules(translator, limit: int | None, dry_run: bool) -> None:
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
            out = translate_checked(translator, value, f"{path.name}:{key}")
            if out:
                print(f"{key}: {out}")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("target", choices=["exercises", "modules"])
    parser.add_argument("--limit", type=int, help="only process the first N items")
    parser.add_argument(
        "--dry-run", action="store_true", help="show the code/prose split, load nothing"
    )
    args = parser.parse_args()

    translator = None if args.dry_run else Translator()
    runner = do_exercises if args.target == "exercises" else do_modules
    runner(translator, args.limit, args.dry_run)


if __name__ == "__main__":
    main()
