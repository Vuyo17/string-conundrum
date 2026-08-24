#!/usr/bin/env python3
"""Generate isiXhosa translations for lesson and exercise content using NLLB-200.

A local-model counterpart to `translate_content.py`, which does the same job via
the Claude API. Same CLI, same output fields, same hard rule: **code stays
English.** Runs ONCE, offline, and writes files that get committed — the app
never calls a translation model at runtime.

Usage:
    pip install torch transformers sentencepiece
    python scripts/translate_content_nllb.py exercises      # backend exercise bank
    python scripts/translate_content_nllb.py options        # mcq/select_all option text
    python scripts/translate_content_nllb.py modules        # lesson content stubs
    python scripts/translate_content_nllb.py challenges     # coding-challenge bank
    python scripts/translate_content_nllb.py locales        # frontend UI strings (xh.json)
    python scripts/translate_content_nllb.py exercises --limit 20 --dry-run

This is the only one of the two translation scripts that covers every piece of
translatable content in the repo — `translate_content.py` (the Claude-API
counterpart) only implements `exercises` and `modules`, and does not touch
`options`, `challenges`, or the locale file at all.

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
import subprocess
import sys
import tempfile
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
CHALLENGES = ROOT / "backend" / "app" / "data" / "challenges.json"
LOCALES_EN = ROOT / "frontend" / "src" / "locales" / "en.json"
LOCALES_XH = ROOT / "frontend" / "src" / "locales" / "xh.json"


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

# Terms that must reach the student in English, masked so NLLB never sees them.
#
# The first group is this project's documented convention, quoted from
# translate_content.py: the lecturer, textbook and exam all use these English
# terms, so inventing isiXhosa equivalents would disadvantage students at
# assessment time. NLLB has no system prompt and will not honour that on its
# own — left unmasked it rendered "string variable" as "umlinganiswa womtya"
# ("cord character") in two of five sample prompts while keeping "i-string
# variable" in the other three, i.e. inconsistently within one exercise set.
#
# The second group is proper nouns and error names, which a translation model
# will happily "correct" into something else — it turned Firebase into
# "Fireebase". Nothing else in the pipeline catches that: a bare capitalised
# word in prose is not a code span, so verification cannot see the damage.
# Matched case-insensitively, because these appear capitalised in headings as
# well as mid-sentence — "String Comparison" is the same term as "strings", and
# missing the capitalised form rendered a module title as "Ukuthelekisa
# Iintambo", i.e. comparison of physical ropes. The matched text is masked and
# restored verbatim, so the original capitalisation survives either way.
GLOSSARY_CI = re.compile(
    r"""\b(?:
        escape\ sequences? | f-strings? | strings?
      # gerunds too: these are module titles ("String Indexing"), and asking
      # the model to translate one bare word with no context is what triggered
      # the repetition loop the `degenerate` check now catches.
      | index(?:es|ing)? | slic(?:es?|ing) | loop(?:s|ing)? | iterat\w+
      | variables? | methods? | lists? | Unicode | concatenat\w+
      | Python | Firebase | ASCII | Cape\ Town | Joburg | Hlomla | isiXhosa
      | Xhosa | Ada | [A-Za-z]+Error
      # Names for string SYNTAX, which the student has to reproduce exactly.
      # Unprotected, NLLB rendered the option "The characters backslash-quote"
      # as "Abalingiswa backslash-caption" — "quote" became the unrelated
      # sense "caption", naming the wrong character entirely.
      | backslash(?:es)? | quotations? | quotes? | apostrophes?
    )\b""",
    re.VERBOSE | re.IGNORECASE,
)

# An OPTION that names Python keywords as bare words, e.g. the distractor
# "while should be for". These are not code spans (no call, subscript or
# assignment syntax for INLINE_SPAN to catch) and not glossary terms, so they
# reached NLLB fully exposed — and it dropped "for" entirely, turning the
# option into "ngelixa kufuneka ukuba", which no longer names the keyword the
# exercise is asking the student to swap in.
#
# Used ONLY as a do_options "leave this untranslated" guard, never as a mask:
# masking these inside general prose would wreck ordinary sentences, since a
# lesson paragraph says "for" and "while" in their English senses constantly.
# Kept to control-flow/definition keywords rather than every keyword for the
# same reason — `in`, `is`, `and`, `not` and `as` are ordinary English words
# far more often than they are Python here.
#
# Case-SENSITIVE on purpose, matching GLOSSARY_CS's rationale: a capitalised
# "For"/"While" opens a normal sentence, a lowercase one names the keyword.
PY_KEYWORD_OPTION = re.compile(
    r"\b(?:for|while|elif|def|lambda|import|global|nonlocal|yield"
    r"|assert|del|raise|except|finally)\b"
)

# Case-SENSITIVE on purpose: these are Python literals, and matching them
# case-insensitively would freeze ordinary English words — "None of the
# following" and "true for every string" would be left untranslated.
GLOSSARY_CS = re.compile(r"\b(?:True|False|None)\b")

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

# A bare (unquoted) multi-word assignment RHS, e.g. `name = Cape Town` — one
# of the "this needs quotes" distractor options. INLINE_SPAN's assignment
# alternative stops at the first space (`[^\s.,;]+`), so on a line like this
# it masks only `name = Cape`, leaving `Town` exposed as ordinary prose — and
# `Cape Town` is a protected glossary phrase, so the second word gets sent to
# NLLB out of context instead of being protected as a unit. Rather than widen
# the shared assignment regex (risking every already-verified prompt/module
# translation), exercises this narrow are left untranslated: the option is
# still invalid-Python-that-needs-quotes either way, so showing it in English
# teaches the same lesson.
BARE_MULTIWORD_ASSIGNMENT = re.compile(r"^\w+\s*=\s*[\(<]?[A-Za-z]+\s+[A-Za-z]+[\)>]?$")

# Words that mark an option as a DESCRIPTION of behaviour ("It prints "cat",
# slice bounds are clamped...") rather than a bare LITERAL VALUE ("cat",
# "l", "World"). This distinction is the whole ballgame for exercises that
# ask "what does this print": a description is safe prose to translate, but
# a literal value is the exact string/character Python would produce, and
# translating it — turning the character 'l' into "Ndinguye" ("I am..."),
# or the slice result "World" into "Ihlabathi" (the Xhosa word for the
# planet) — breaks the exercise outright, the same way translating a
# challenge's expected `output` would. NLLB has no way to tell these apart
# on its own: handed a bare "l" with zero sentence context it hallucinates
# rather than declining, and neither verify_spans nor degenerate() catches
# it, because there's no protected span to check and the output isn't
# malformed — it's just confidently wrong. So this filter runs BEFORE the
# model ever sees the option, on the English source alone.
SENTENCE_SIGNAL = re.compile(
    r"""\b(?:is|are|the|it|because|raises?|returns?|prints?|error|none|
        true|false|would|does|clamped|inclusive|exclusive|instead|rather|
        matter|happens?|produces?|creates?|changes?
    )\b""",
    re.VERBOSE | re.IGNORECASE,
)


def looks_like_literal_value(option: str) -> bool:
    """True if `option` reads as a bare value rather than a description.

    Deliberately conservative in the unsafe direction: a short, plain
    fragment with none of the connective/explanatory words above is treated
    as a literal value and left untranslated, even where it might actually
    be safe prose (a lone "Nothing" meaning "prints nothing", say). Missing
    a translation is a cosmetic loss; mistranslating a literal answer is a
    broken exercise.
    """
    text = option.strip()
    if not text:
        return False
    if SENTENCE_SIGNAL.search(text):
        return False
    return len(text.split()) < 4

# An unbacktricked augmented-assignment or comparison operator touching an
# identifier, e.g. `i += 1 is missing from inside the loop body` — INLINE_SPAN
# only recognises a bare `=`, not `+=`/`<=`/`==`/etc., so these slip through
# as ordinary prose with the operator and its operand fully exposed. Same
# rationale as BARE_MULTIWORD_ASSIGNMENT: narrow, known instances, left
# untranslated rather than risking the shared regex everywhere else.
BARE_OPERATOR_CODE = re.compile(r"\b[a-zA-Z_]\w*\s*(?:[+\-*/%]=|<=|>=|==|!=)\s*\S")

# An unresolved f-string placeholder surviving in the option text itself, e.g.
# "{name} is {age}" (formatting-01..04's "forgot the f-prefix" distractor —
# the literal string Python prints when the `f` is left off). No mask in this
# file protects bare `{...}` — CODE_SPAN/INLINE_SPAN were written for Python
# syntax, not f-string braces — so unlike a real code span this reaches the
# model fully exposed. It also slips past `looks_like_literal_value`, because
# these read as three words and one of them ("is") is a SENTENCE_SIGNAL word
# that the description/literal split treats as a description marker. But the
# braces are exactly what the exercise is testing, and there's nothing
# describing behaviour here — it's the literal output. Same rationale as
# BARE_MULTIWORD_ASSIGNMENT and BARE_OPERATOR_CODE: narrow, known instance,
# left untranslated rather than risking the shared regex everywhere else.
BARE_PLACEHOLDER_LITERAL = re.compile(r"\{\w+\}")

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
    """Replace code fragments and glossary terms with placeholders.

    Returns (masked, spans). Code is masked first so a term inside a code
    fragment — the `string` in `word = "a string"` — is protected by the
    surrounding span rather than masked twice.
    """
    if PLACEHOLDER_RE.search(text):
        # Real content already looks like a placeholder, so restoring would be
        # ambiguous. Refuse rather than guess.
        raise ValueError("text already contains a placeholder-shaped token")

    spans: list[str] = []

    def take(match: re.Match[str]) -> str:
        spans.append(match.group(0))
        return PLACEHOLDER.format(len(spans) - 1)

    masked = INLINE_SPAN.sub(take, text)
    masked = GLOSSARY_CI.sub(take, masked)
    return GLOSSARY_CS.sub(take, masked), spans


def unmask_spans(text: str, spans: list[str]) -> str:
    """Put the original fragments back, verbatim."""

    def give(match: re.Match[str]) -> str:
        index = int(match.group(1))
        return spans[index] if index < len(spans) else match.group(0)

    return PLACEHOLDER_RE.sub(give, text)


def protected_spans(text: str) -> list[str]:
    """Every fragment of `text` that must survive translation byte-identical.

    Derived from `mask_spans` itself so verification can never check a narrower
    set than the masker protects.
    """
    spans = []
    for line in (text or "").split("\n"):
        if is_code_line(line):
            spans.append(line)
        else:
            spans.extend(mask_spans(line)[1])
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


def degenerate(source: str, out: str) -> str | None:
    """Describe how `out` is malformed, or None if it looks sane.

    Span verification only proves the protected fragments came back; it says
    nothing about the prose around them. Asked to translate the single word
    "Indexing" — no sentence context to anchor on — NLLB emitted
    "Ukwahlulahlulahlulahlula..." for 200 characters. That passes every other
    check in this file, and would have shipped as a lesson heading.
    """
    # A short chunk repeated back-to-back is the classic decoder loop.
    for size in range(3, 13):
        match = re.search(rf"(.{{{size}}})\1{{3,}}", out)
        if match:
            return f"repetition loop {match.group(1)!r}"
    # isiXhosa runs longer than English, but not several times longer.
    if len(out) > max(60, len(source) * 2.5):
        return f"length blowout {len(source)}→{len(out)} chars"
    return None


def translate_checked(translator: Translator, text: str, label: str) -> str | None:
    """Translate, then reject the result if it is damaged in any way."""
    try:
        out = translator.translate(text)
    except ValueError as exc:
        print(f"  ! {label}: {exc} — skipped", file=sys.stderr)
        return None

    broken = verify_spans(text, out)
    if broken:
        print(f"  ! {label}: code altered {broken} — skipped", file=sys.stderr)
        return None

    damage = degenerate(text, out)
    if damage:
        print(f"  ! {label}: {damage} — skipped", file=sys.stderr)
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

        # Options are handled by `do_options` (target "options"), not here:
        # grading compares raw English values, so translating them safely
        # needs the answer/answers derivation that function does alongside it.
        if ex.get("hint"):
            hint_xh = translate_checked(translator, ex["hint"], f"{label}.hint")
            if hint_xh:
                ex["hint_xh"] = hint_xh

    if not dry_run:
        EXERCISES.write_text(
            json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"\nwrote {EXERCISES}")


def do_options(translator, limit: int | None, dry_run: bool) -> None:
    """Translate `options` for mcq/select_all exercises, for DISPLAY ONLY.

    Grading always compares the raw English `answer`/`answers` against what
    the frontend submits, which is always `options[i]` (English) regardless
    of what's shown on screen — see feedback.py's `_localise` and
    `_display_answer`. So this never touches `answer`/`answers` directly;
    it derives `answer_xh`/`answers_xh` by finding each correct value's
    position in `options` and reading the same position out of `options_xh`,
    guaranteeing the displayed "correct answer" text is drawn from the exact
    same translation as the option the student saw, not a second independent
    translation of the same English string that might come out differently.

    An exercise's `options_xh` is only written when every option in it
    translated cleanly — a partial array is worse than none, since the
    frontend falls back to all-English the moment lengths don't match.
    """
    bank = json.loads(EXERCISES.read_text(encoding="utf-8"))
    todo = [
        e for e in bank
        if e.get("type") in ("mcq", "select_all") and "options_xh" not in e
    ][:limit]
    print(f"{len(todo)} of {len(bank)} option-bearing exercises need translating")

    for i, ex in enumerate(todo, 1):
        label = ex.get("question_id", f"#{i}")
        print(f"\n[{i}/{len(todo)}] {label}")

        if dry_run:
            for opt in ex["options"]:
                if is_code_line(opt):
                    print(f"    CODE   {opt}")
                else:
                    masked, _ = mask_spans(opt)
                    print(f"    PROSE  {masked}")
            continue

        translated = [
            opt if (
                BARE_MULTIWORD_ASSIGNMENT.match(opt.strip())
                or BARE_OPERATOR_CODE.search(opt)
                or BARE_PLACEHOLDER_LITERAL.search(opt)
                or PY_KEYWORD_OPTION.search(opt)
                or looks_like_literal_value(opt)
            )
            else translate_checked(translator, opt, f"{label}.options[{j}]")
            for j, opt in enumerate(ex["options"])
        ]
        if any(t is None for t in translated):
            print(f"  ! {label}: not every option translated cleanly — skipped")
            continue

        ex["options_xh"] = translated
        for opt in translated:
            print(f"    {opt}")

        lookup = dict(zip(ex["options"], translated))
        if ex.get("type") == "mcq" and ex.get("answer") in lookup:
            ex["answer_xh"] = lookup[ex["answer"]]
        elif ex.get("type") == "select_all" and ex.get("answers"):
            ex["answers_xh"] = [lookup[a] for a in ex["answers"] if a in lookup]

    if not dry_run:
        EXERCISES.write_text(
            json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"\nwrote {EXERCISES}")


def do_challenges(translator, limit: int | None, dry_run: bool) -> None:
    """Translate the coding-challenge bank in place.

    `starter_code`, `solution` and `tests` are never translated: the first two
    are Python the student runs, and test inputs/expected values are compared
    literally against program output. Only the prose a reader sees is touched.
    """
    bank = json.loads(CHALLENGES.read_text(encoding="utf-8"))
    todo = [c for c in bank if "title_xh" not in c][:limit]
    print(f"{len(todo)} of {len(bank)} challenges need translating")

    for i, ch in enumerate(todo, 1):
        label = ch.get("id", f"#{i}")
        print(f"\n[{i}/{len(todo)}] {label}")
        if dry_run:
            for field in ("title", "description", "hint"):
                if ch.get(field):
                    print(f"    {field}: {mask_spans(ch[field])[0]}")
            continue

        for field in ("title", "description", "hint"):
            if not ch.get(field):
                continue
            done = translate_checked(translator, ch[field], f"{label}.{field}")
            if done:
                ch[f"{field}_xh"] = done
                print(f"    {field}: {done}")

        # `io` describes the input/output contract in prose, so it travels too.
        io = ch.get("io") or {}
        io_xh = {}
        for key, value in io.items():
            done = translate_checked(translator, value, f"{label}.io.{key}")
            if done:
                io_xh[key] = done
        if io_xh:
            ch["io_xh"] = io_xh

    if not dry_run:
        CHALLENGES.write_text(
            json.dumps(bank, ensure_ascii=False, indent=2) + "\n", encoding="utf-8"
        )
        print(f"\nwrote {CHALLENGES}")


# ---------------------------------------------------------------------------
# UI locale strings (frontend/src/locales/{en,xh}.json)
# ---------------------------------------------------------------------------

# i18next-style interpolation, e.g. "{filled} of {total} tiers cleared". These
# are substituted at render time, so the token itself must survive untouched
# the same way a code span must — NLLB has no idea `{filled}` is not a word
# and will happily "translate" the braces away or reorder the token.
LOCALE_PLACEHOLDER = re.compile(r"\{[^}]*\}")

# NLLB silently drops a bare em dash used as a sentence-break punctuation mark
# (confirmed by running it: "bar — that's mastery-level" came back "bar  that's
# mastery-level" — the surrounding spaces survive but the dash itself
# vanishes, leaving a double space with no visible sign anything is wrong).
# Masked the same way as a placeholder so it survives verbatim like one.
EM_DASH = re.compile(r"—")


def mask_locale(text: str) -> tuple[str, list[str]]:
    """Like `mask_spans`, but for UI copy: no code spans, just placeholders,
    em dashes, and glossary terms (a locale string can still say "Python" or
    "isiXhosa").
    """
    if PLACEHOLDER_RE.search(text):
        raise ValueError("text already contains a placeholder-shaped token")

    spans: list[str] = []

    def take(match: re.Match[str]) -> str:
        spans.append(match.group(0))
        return PLACEHOLDER.format(len(spans) - 1)

    masked = LOCALE_PLACEHOLDER.sub(take, text)
    masked = EM_DASH.sub(take, masked)
    masked = GLOSSARY_CI.sub(take, masked)
    return GLOSSARY_CS.sub(take, masked), spans


def protected_locale_spans(text: str) -> list[str]:
    return mask_locale(text)[1]


def verify_locale_spans(source: str, translated: str) -> list[str]:
    return [span for span in protected_locale_spans(source) if span not in translated]


def translate_locale_string(translator: "Translator", text: str, label: str) -> str | None:
    """Translate one UI string, masking placeholders/glossary terms first."""
    try:
        masked, spans = mask_locale(text)
    except ValueError as exc:
        print(f"  ! {label}: {exc} — skipped", file=sys.stderr)
        return None

    if not re.search(r"[A-Za-z]", PLACEHOLDER_RE.sub("", masked)):
        out = text  # nothing but placeholders/punctuation — no prose to translate
    else:
        out = unmask_spans(translator._generate(masked), spans)

    broken = verify_locale_spans(text, out)
    if broken:
        print(f"  ! {label}: placeholder/glossary altered {broken} — skipped", file=sys.stderr)
        return None
    damage = degenerate(text, out)
    if damage:
        print(f"  ! {label}: {damage} — skipped", file=sys.stderr)
        return None
    return out


def _flatten(node: dict, prefix: str = "") -> dict[str, str]:
    out = {}
    for key, value in node.items():
        full = f"{prefix}.{key}" if prefix else key
        if isinstance(value, dict):
            out.update(_flatten(value, full))
        else:
            out[full] = value
    return out


def _set_path(root: dict, dotted: str, value: str) -> None:
    parts = dotted.split(".")
    node = root
    for part in parts[:-1]:
        node = node.setdefault(part, {})
    node[parts[-1]] = value


def do_locales(translator, limit: int | None, dry_run: bool) -> None:
    """Fill in whatever keys `xh.json` is missing relative to `en.json`.

    Purely additive, same as every other target here: an xh.json key that
    already exists (hand-translated or from a previous run) is left alone.
    """
    en = json.loads(LOCALES_EN.read_text(encoding="utf-8"))
    xh = json.loads(LOCALES_XH.read_text(encoding="utf-8")) if LOCALES_XH.exists() else {}

    en_flat = _flatten(en)
    xh_flat = _flatten(xh)
    todo = [k for k in en_flat if k not in xh_flat][:limit]
    print(f"{len(todo)} of {len(en_flat)} locale keys need translating")

    for i, key in enumerate(todo, 1):
        value = en_flat[key]
        print(f"[{i}/{len(todo)}] {key}")
        if dry_run:
            masked, _ = mask_locale(value)
            print(f"    {masked}")
            continue

        out = translate_locale_string(translator, value, key)
        if out:
            _set_path(xh, key, out)
            print(f"    {out}")

    if not dry_run:
        # xh.json ships with CRLF line endings. write_text's own newline
        # translation would double an already-inserted \r\n into \r\r\n, so
        # this bypasses it (newline="") and does the substitution itself.
        text = json.dumps(xh, ensure_ascii=False, indent=2) + "\n"
        with open(LOCALES_XH, "w", encoding="utf-8", newline="") as f:
            f.write(text.replace("\n", "\r\n"))
        print(f"wrote {LOCALES_XH}")


MODULE_DIR = ROOT / "frontend" / "src" / "data" / "moduleContent"

# Fields holding prose. Everything absent here is left in English by omission,
# which `getModuleContent`'s deep-merge handles for free.
TRANSLATABLE = {"text", "title", "intro", "caption", "description", "prompt"}
TRANSLATABLE_LISTS = {"outcomes", "items", "head"}

# Never translated, and listed explicitly so the reason survives: `code`, `value`
# and `string` are Python the student retypes; `output` is what the interpreter
# actually prints; `id`, `kind`, `tone`, `state` and `apiModuleId` are wiring.
# `rows` (table cells) IS translated, cell by cell — see the dedicated branch
# in translate_tree — but position-for-position, same as every other array
# here, so a partial row still can't get shuffled out of alignment.

# Fixed vocabulary, translated by hand: NLLB renders these inconsistently and
# there are only a few, so a lookup beats a model call.
LEVELS = {
    "Beginner": "Osaqalayo",
    "Intermediate": "Ophakathi",
    "Advanced": "Ophezulu",
}


def dump_modules_json(dest: Path) -> dict[str, Path]:
    """Evaluate the module files with node and dump each object as JSON.

    The content is JS, not data, so it cannot be parsed reliably with a regex —
    the previous approach could only scrape flat `key: 'value'` pairs and had no
    idea of the surrounding structure. Importing it under node gives the real
    object, which is what an overlay has to mirror position for position.
    """
    dest.mkdir(parents=True, exist_ok=True)
    script = dest / "_dump.mjs"
    script.write_text(
        """
import { readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const [src, out] = process.argv.slice(2);
for (const file of (await readdir(src)).filter((f) => f.endsWith('.js') && f !== 'index.js')) {
  const mod = await import(pathToFileURL(path.join(src, file)).href);
  const key = Object.keys(mod).find((k) => k.endsWith('Module'));
  if (!key) continue;
  await writeFile(path.join(out, file.replace(/\\.js$/, '.json')),
    JSON.stringify(mod[key], null, 2), 'utf-8');
}
""",
        encoding="utf-8",
    )
    subprocess.run(
        ["node", str(script), str(MODULE_DIR), str(dest)],
        check=True,
        capture_output=True,
    )
    return {p.stem: p for p in sorted(dest.glob("*.json")) if p.stem != "_dump"}


def translate_tree(translator, node, label: str, stats: dict[str, int], existing=None):
    """Build a partial overlay mirroring `node`, translating only prose fields.

    `existing` is the corresponding subtree of an already-written overlay, if
    one exists — a field already present there is carried through UNCHANGED
    rather than re-translated, so re-running this on a module that already
    has a partial (or hand-written) overlay only fills the gaps, never
    replaces a translation someone already reviewed or wrote by hand.

    Returns None when a subtree yields nothing, so the caller can drop it and
    let the English original show through.
    """
    if isinstance(node, dict):
        out = {}
        existing_dict = existing if isinstance(existing, dict) else {}
        for key, value in node.items():
            prior = existing_dict.get(key)
            if isinstance(value, str):
                if key == "level":
                    if value in LEVELS:
                        out[key] = LEVELS[value]
                    continue
                if key not in TRANSLATABLE:
                    continue
                if isinstance(prior, str) and prior.strip():
                    out[key] = prior
                    stats["kept"] += 1
                    continue
                done = translate_checked(translator, value, f"{label}.{key}")
                stats["total"] += 1
                if done:
                    out[key] = done
                else:
                    stats["skipped"] += 1
            elif isinstance(value, list) and all(isinstance(x, str) for x in value):
                if key not in TRANSLATABLE_LISTS:
                    continue
                prior_list = prior if isinstance(prior, list) else []
                items = []
                for i, item in enumerate(value):
                    prior_item = prior_list[i] if i < len(prior_list) else None
                    if isinstance(prior_item, str) and prior_item.strip():
                        items.append(prior_item)
                        stats["kept"] += 1
                        continue
                    done = translate_checked(translator, item, f"{label}.{key}[{i}]")
                    stats["total"] += 1
                    if not done:
                        stats["skipped"] += 1
                    items.append(done if done else item)
                if items:
                    out[key] = items
            elif (
                key == "rows"
                and isinstance(value, list)
                and all(isinstance(row, list) and all(isinstance(c, str) for c in row) for row in value)
            ):
                # A table row. No per-column special-casing needed: a cell that
                # is pure code (`ord("A")`) is caught by is_code_line and never
                # touched; a cell that is a bare literal (`'n'`, `IndexError`,
                # `False`) gets fully masked by mask_spans/GLOSSARY and the
                # "nothing left to translate" guard in _translate_prose_line
                # returns it unchanged; only genuine prose — a label like
                # "First character" or an explanation — actually reaches the
                # model. Same verify_spans/degenerate rejection as everywhere
                # else, so a cell that would corrupt still just stays English.
                prior_rows = prior if isinstance(prior, list) else []
                rows_out = []
                for i, row in enumerate(value):
                    prior_row = prior_rows[i] if i < len(prior_rows) else None
                    prior_row = prior_row if isinstance(prior_row, list) else []
                    row_out = []
                    for j, cell in enumerate(row):
                        prior_cell = prior_row[j] if j < len(prior_row) else None
                        if isinstance(prior_cell, str) and prior_cell.strip():
                            row_out.append(prior_cell)
                            stats["kept"] += 1
                            continue
                        done = translate_checked(translator, cell, f"{label}.{key}[{i}][{j}]")
                        stats["total"] += 1
                        if not done:
                            stats["skipped"] += 1
                        row_out.append(done if done else cell)
                    rows_out.append(row_out)
                if rows_out:
                    out[key] = rows_out
            else:
                child = translate_tree(translator, value, f"{label}.{key}", stats, prior)
                if child is not None:
                    out[key] = child
        return out or None

    if isinstance(node, list):
        # Arrays deep-merge by position, so every slot must be held — `null`
        # tells the merge to keep the English entry untouched.
        existing_list = existing if isinstance(existing, list) else []
        items = [
            translate_tree(
                translator, item, label, stats,
                existing_list[i] if i < len(existing_list) else None,
            )
            for i, item in enumerate(node)
        ]
        return items if any(i is not None for i in items) else None

    return None


def dump_existing_xh(out_dir: Path, dest: Path) -> dict[str, dict]:
    """Evaluate `xh/*.js` overlays already on disk and return each as a dict.

    Same node-import trick as `dump_modules_json`, over whatever overlay files
    already exist. A module with no overlay yet is simply absent from the
    result, which `do_modules` treats as "nothing to preserve".
    """
    if not out_dir.exists() or not any(out_dir.glob("*.js")):
        return {}
    dest.mkdir(parents=True, exist_ok=True)
    script = dest / "_dump_existing.mjs"
    script.write_text(
        """
import { readdir, writeFile } from 'node:fs/promises';
import { pathToFileURL } from 'node:url';
import path from 'node:path';
const [src, out] = process.argv.slice(2);
for (const file of (await readdir(src)).filter((f) => f.endsWith('.js'))) {
  const mod = await import(pathToFileURL(path.join(src, file)).href);
  const key = Object.keys(mod).find((k) => k.endsWith('Xh'));
  if (!key) continue;
  await writeFile(path.join(out, file.replace(/\\.js$/, '.json')),
    JSON.stringify(mod[key], null, 2), 'utf-8');
}
""",
        encoding="utf-8",
    )
    subprocess.run(
        ["node", str(script), str(out_dir), str(dest)],
        check=True,
        capture_output=True,
    )
    return {
        p.stem: json.loads(p.read_text(encoding="utf-8"))
        for p in sorted(dest.glob("*.json"))
        if p.stem != "_dump_existing"
    }


def do_modules(translator, limit: int | None, dry_run: bool) -> None:
    """Write/update `moduleContent/xh/<id>.js` overlays for every module.

    Overlays are partial by design: `getModuleContent` deep-merges them over the
    English base, so anything omitted keeps its original value. `xh/intro.js` is
    the hand-written reference for the shape and tone.

    Re-running this on a module that already has an overlay does NOT start
    over: `translate_tree` is handed that overlay as `existing` and carries
    every field already present through unchanged (including hand-written
    ones), only translating what's still missing. That's what makes this safe
    to run again after `xh/intro.js` — or any module — picks up more manual
    edits later: nothing already there gets clobbered.
    """
    out_dir = MODULE_DIR / "xh"
    if dry_run:
        for path in sorted(MODULE_DIR.glob("*.js")):
            if path.name == "index.js":
                continue
            state = "exists" if (out_dir / path.name).exists() else "would write"
            print(f"{state:12} {out_dir.name}/{path.name}")
        return

    scratch = Path(tempfile.mkdtemp(prefix="modulecontent-"))
    dumped = dump_modules_json(scratch)
    existing_by_stem = dump_existing_xh(out_dir, scratch / "existing")
    out_dir.mkdir(parents=True, exist_ok=True)

    for stem, json_path in dumped.items():
        target = out_dir / f"{stem}.js"
        existing = existing_by_stem.get(stem)

        print(f"\n===== {stem} =====" + (" (topping up existing overlay)" if existing else ""))
        base = json.loads(json_path.read_text(encoding="utf-8"))
        stats = {"total": 0, "skipped": 0, "kept": 0}
        overlay = translate_tree(translator, base, stem, stats, existing) or {}

        if stats["total"] == 0 and existing:
            print(f"-- {stem}: overlay already covers everything this run would touch")
            continue

        # A file that already exists carries its own header (hand-written for
        # intro.js, the standard machine-translated one for the rest) —
        # preserved verbatim rather than overwritten, since only the object
        # literal below it changed.
        if target.exists():
            old_text = target.read_text(encoding="utf-8")
            marker = old_text.index("export const")
            header = old_text[:marker]
        else:
            header = (
                f"// isiXhosa translation of the {base.get('title', stem)!r} module.\n"
                "//\n"
                "// Machine-translated with NLLB-200 by scripts/translate_content_nllb.py,\n"
                "// then merged over the English base by `getModuleContent`. Partial by\n"
                "// design: `code`, `output` and `value` are omitted so they keep their\n"
                "// English/original value, and `null` holds an array slot open.\n"
                "//\n"
                "// Needs a human read before students see it.\n\n"
            )

        name = f"{stem}Module Xh".replace(" ", "")
        body = json.dumps(overlay, ensure_ascii=False, indent=2)
        target.write_text(f"{header}export const {name} = {body};\n", encoding="utf-8")
        kept, total = stats["kept"], stats["total"]
        translated = total - stats["skipped"]
        print(f"wrote {target}  ({translated}/{total} new fields translated, {kept} already present)")


def main() -> None:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument(
        "target", choices=["exercises", "options", "modules", "challenges", "locales"]
    )
    parser.add_argument("--limit", type=int, help="only process the first N items")
    parser.add_argument(
        "--dry-run", action="store_true", help="show the code/prose split, load nothing"
    )
    args = parser.parse_args()

    translator = None if args.dry_run else Translator()
    runner = {
        "exercises": do_exercises,
        "options": do_options,
        "modules": do_modules,
        "challenges": do_challenges,
        "locales": do_locales,
    }[args.target]
    runner(translator, args.limit, args.dry_run)


if __name__ == "__main__":
    main()
