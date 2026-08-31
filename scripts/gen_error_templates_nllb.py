#!/usr/bin/env python3
"""Generate isiXhosa translations for the sandbox's error-message templates.

A companion to translate_content_nllb.py in this same directory, using the
same model and the same one-off-offline convention that script documents:
"the app never calls a translation model at runtime". This script translates
the handful of English error templates in
backend/app/services/error_translation.py's _TEMPLATES_EN, and its output is
meant to be pasted into that module's _TEMPLATES_XH by hand -- it does not
write to the backend itself, since the backend module also carries
hand-written classification logic around the translated text that a
generated file would just as easily clobber.

Usage:
    pip install torch transformers sentencepiece
    python scripts/gen_error_templates_nllb.py

If huggingface_hub's own downloader stalls or truncates the weights file
(observed on at least one Windows machine, consistently around 67MB, while a
plain `curl` of the same https://huggingface.co/<repo>/resolve/main/<file>
URLs completed cleanly) -- download the files manually into a local folder
and point MODEL below at that folder instead of the hub repo id.
"""

from __future__ import annotations

import re
import sys

try:
    import torch
    from transformers import AutoModelForSeq2SeqLM, AutoTokenizer
except ImportError:
    sys.exit("pip install torch transformers sentencepiece")

MODEL = "facebook/nllb-200-distilled-600M"
SRC_LANG = "eng_Latn"
TGT_LANG = "xho_Latn"

# Mirrors backend/app/services/error_translation.py's _TEMPLATES_EN exactly
# -- keep the two in sync by hand if the English wording ever changes.
# XX0XX is translate_content_nllb.py's own PLACEHOLDER token, standing in
# for a line number: a bare digit does not survive NLLB translation intact
# (a bare "5" came back spelled out as the isiXhosa ordinal word
# "wesihlanu"), but this alphabetic token does.
TEMPLATES = {
    "index": "There is an error on line XX0XX: you tried to access a position in the text that does not exist. Check that your index is within the length of the text.",
    "type": "There is an error on line XX0XX: you tried to combine two different types of values that do not work well together, like a number and a piece of text. Check the types of the values you are using.",
    "value": "There is an error on line XX0XX: one of your values is not valid for this operation. Check the value you are passing in.",
    "name": "There is an error on line XX0XX: you used a name that has not been defined yet. Check that you spelled it correctly and defined it before this line.",
    "zerodiv": "There is an error on line XX0XX: you tried to divide a number by zero, which is not allowed. Check the value you are dividing by.",
    "key": "There is an error on line XX0XX: you tried to access a key that does not exist. Check that the key exists before you use it.",
    "attribute": "There is an error on line XX0XX: you tried to use a method or property that does not exist on this value. Check the type of the value and the method name.",
    "syntax": "There is a syntax error on line XX0XX: your code is not written in a way Python can understand. Check for a missing colon, bracket, or quotation mark.",
    "recursion": "There is an error on line XX0XX: your program called itself too many times without stopping. Check that your function has a condition that eventually stops it from calling itself again.",
    "overflow": "There is an error on line XX0XX: a number in your calculation became too large. Check your calculation for a value that keeps growing.",
    "assertion": "There is an error on line XX0XX: an assert statement in your code failed, meaning something you expected to be true was not true. Check the condition in your assert statement.",
    "unicode": "There is an error on line XX0XX: there was a problem with how some text was encoded or decoded. Check for unusual characters in your text.",
    "import": "There is an error on line XX0XX: you tried to import something that this tool does not allow. Try solving the exercise using only the basic tools already available.",
    "generic": "There is an error on line XX0XX. Check that line carefully for a mistake in your code.",
    "timeout": "Your program did not finish within 5 seconds. This usually means a loop is running forever. Check that your loop's condition will eventually become false, or that a counter variable is actually changing inside the loop.",
}


def degenerate(source: str, out: str) -> str | None:
    """Same check translate_content_nllb.py uses: a short chunk repeated
    back-to-back is the classic decoder loop; isiXhosa runs longer than
    English but not several times longer."""
    for size in range(3, 13):
        match = re.search(rf"(.{{{size}}})\1{{3,}}", out)
        if match:
            return f"repetition loop {match.group(1)!r}"
    if len(out) > max(60, len(source) * 2.5):
        return f"length blowout {len(source)}->{len(out)} chars"
    return None


def main() -> None:
    print(f"loading {MODEL} (first run downloads ~2.5GB)", file=sys.stderr)
    tokenizer = AutoTokenizer.from_pretrained(MODEL, src_lang=SRC_LANG, use_fast=False)
    model = AutoModelForSeq2SeqLM.from_pretrained(MODEL, low_cpu_mem_usage=True)
    model.eval()
    bos = tokenizer.convert_tokens_to_ids(TGT_LANG)

    def translate(text: str) -> str:
        encoded = tokenizer(text, return_tensors="pt", truncation=True, max_length=512)
        with torch.inference_mode():
            tokens = model.generate(
                **encoded, forced_bos_token_id=bos, max_new_tokens=128,
                num_beams=5, do_sample=False,
            )
        return tokenizer.batch_decode(tokens, skip_special_tokens=True)[0].strip()

    print("_TEMPLATES_XH: dict[str, str] = {")
    for key, text in TEMPLATES.items():
        out = translate(text)
        damage = degenerate(text, out)
        flag = ""
        if damage:
            flag = f"  # WARNING: {damage}"
        elif "XX0XX" in text and "XX0XX" not in out:
            flag = "  # WARNING: placeholder did not survive -- do not use as-is"
        print(f"    {key!r}: {out!r},{flag}")
        print(f"# EN: {text}", file=sys.stderr)
        print(f"# XH: {out}{flag}", file=sys.stderr)
        print(file=sys.stderr)
    print("}")


if __name__ == "__main__":
    main()
