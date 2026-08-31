# app/services/error_translation.py
#
# isiXhosa error translation -- template-based, no runtime ML dependency.
#
# The idea for this feature is adapted from IsiPython (Lutho Mngqibisa &
# Buhle Mlandu, UCT SIT Honours 2025,
# https://github.com/LuthoYRN/IsiPython-dev), which calls an LLM (Claude) at
# request time to explain a Python traceback in isiXhosa. An earlier version
# of this module did the same -- a live Claude call with a hand-written
# system prompt -- but that needs a paid, metered Anthropic API key, which
# this project does not have configured. Rather than ship a feature that
# only works with a key nobody here holds, this module reaches the same end
# (a short isiXhosa explanation of what went wrong, with a line number) the
# way this codebase already does every other piece of isiXhosa translation:
# scripts/translate_content_nllb.py translates content OFFLINE, once, via
# the NLLB-200 model already used elsewhere in this repo, and ships the
# result as static text -- "the app never calls a translation model at
# runtime" is that script's own stated rule. This module follows the same
# rule: the handful of English error templates below were translated once
# with that same model (see scripts/gen_error_templates_nllb.py) and the
# isiXhosa results are hardcoded in _TEMPLATES_XH. At request time, a raw
# stderr traceback is classified into one of these templates by exception
# type, and the real line number is substituted into the pre-translated
# isiXhosa sentence -- no network call, no API key, no torch/transformers
# dependency added to the Flask app itself.
#
# This trades per-error specificity for something a live LLM call could
# offer instead: it works completely offline, costs nothing per call, and
# needs no third-party account, at the cost of only ever describing the
# *category* of error (e.g. "you used a name that isn't defined yet") built
# from the exception type, not the exact identifier or value involved. If a
# stderr doesn't match a recognised exception type at all, translate_error
# returns None and the caller falls back to the raw English text, the same
# graceful-degradation contract this module always had.

import re
from typing import Optional

# ─── English templates, translated to isiXhosa via NLLB-200 ─────────────────
#
# Generated once by scripts/gen_error_templates_nllb.py (a standalone,
# non-runtime script -- see its header for how to regenerate this table if
# the English wording below ever changes). XX0XX in each English template
# stands in for a line number, using translate_content_nllb.py's own
# PLACEHOLDER token scheme -- a bare digit doesn't survive NLLB translation
# unchanged (a bare "5" came back spelled out as the isiXhosa ordinal word
# "wesihlanu"), but this alphabetic token does.

_TEMPLATES_EN: dict[str, str] = {
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

# Real NLLB-200 output (facebook/nllb-200-distilled-600M, eng_Latn ->
# xho_Latn, greedy beam search width 5) for _TEMPLATES_EN above, generated
# by the standalone script described in the module docstring. XX0XX is the
# placeholder from translate_content_nllb.py's own PLACEHOLDER scheme,
# proven in that script to survive NLLB translation as a copied-through
# token where a bare digit does not (a bare "5" came back spelled out as
# the isiXhosa ordinal word "wesihlanu", not the digit) -- confirmed intact
# in every one of the 15 templates below, so _fill() below just substitutes
# the real line number for it.
_TEMPLATES_XH: dict[str, str] = {
    "index": "Kukho impazamo kumgca XX0XX: uzamile ukufikelela kwindawo engekhoyo kumbhalo. Jonga ukuba isalathiso sakho sikumgama wombhalo.",
    "type": "Kukho impazamo kumgca XX0XX: uzamile ukudibanisa iindidi ezimbini ezahlukeneyo zamaxabiso angasebenzi kakuhle kunye, njengenombolo kunye nesiqwenga sombhalo. Jonga iindidi zamaxabiso owasebenzisayo.",
    "value": "Kukho impazamo kumgca XX0XX: elinye lamaxabiso akho alivumelekanga kulo msebenzi.",
    "name": "Kukho impazamo kumgca XX0XX: usebenzise igama elingachazwanga okwamanje. Qinisekisa ukuba ulichazile ngokuchanekileyo kwaye ulichazile ngaphambi kwalo mgca.",
    "zerodiv": "Kukho impazamo kumgca XX0XX: uzame ukwahlula inani nge-zero, engavumelekanga. Jonga ixabiso owahlula ngalo.",
    "key": "Kukho impazamo kumgca XX0XX: uzamile ukufikelela kwisitshixo esingekhoyo. Qinisekisa ukuba isitshixo sikhona ngaphambi kokuba usisebenzise.",
    "attribute": "Kukho impazamo kumgca XX0XX: uzamile ukusebenzisa indlela okanye impawu engekhoyo kweli xabiso. Jonga uhlobo lwexabiso kunye negama lenkqubo.",
    "syntax": "Kukho impazamo ye-syntax kumgca XX0XX: ikhowudi yakho ayibhalwanga ngendlela eqondwa yiPython. Jonga ukuba kukho i-colon, i-bracket, okanye uphawu lokucaphula olukhoyo.",
    "recursion": "Kukho impazamo kumgca XX0XX: inkqubo yakho yazibiza izihlandlo ezininzi kakhulu ngaphandle kokumisa. Jonga ukuba umsebenzi wakho unemeko ekugqibeleni iyayeka ukuzibiza kwakhona.",
    "overflow": "Kukho impazamo kumgca XX0XX: inani ekubalweni kwakho liye laba likhulu kakhulu. Jonga ukubalulwa kwakho ukuze ufumane ixabiso eliqhubeka likhula.",
    "assertion": "Kukho impazamo kumgca XX0XX: isitatimende sokuvakalisa kwikhowudi yakho asiphumelelanga, nto leyo ethetha ukuba into obulindele ukuba ibe yinyani ayinyani. Jonga imeko kwisitatimende sakho sokuvakalisa.",
    "unicode": "Kukho impazamo kumgca XX0XX: kwakukho ingxaki ngendlela isicatshulwa esithile esikhutshwe ngayo okanye esikhutshwe ngayo. Khangela iimpawu ezingaqhelekanga kwisicatshulwa sakho.",
    "import": "Kukho impazamo kumgca XX0XX: uzamile ukungenisa into engavumelekanga kwesi sixhobo. Zama ukusombulula lo msebenzi usebenzisa kuphela izixhobo ezisisiseko esele zikho.",
    "generic": "Kukho impazamo kumgca XX0XX. Jonga loo mgca ngononophelo ukuba kukho impazamo kwikhowudi yakho.",
    "timeout": "Inkqubo yakho ayizange igqitywe kwimizuzwana emi-5. Oku kudla ngokuthetha ukuba i-loop isebenza ngonaphakade. Jonga ukuba imeko ye-loop yakho ekugqibeleni iya kuba yimpazamo, okanye ukuba i-counter variable iyatshintsha ngaphakathi kwe-loop.",
}

# _TEMPLATES_XH needs a human isiXhosa speaker's read before this ships to
# real learners -- machine-translated, not reviewed, exactly like every
# other NLLB overlay in this repo (see translate_content_nllb.py's own
# "Needs a human read before students see it" header on module overlays).

# ─── classification ──────────────────────────────────────────────────────────

# Exception class name -> template key. Anything not listed here (or not a
# recognised Python exception at all) falls through to "generic". Keys
# match what execute_code's restricted-builtins subprocess can actually
# raise (sandbox.py's _builtins) plus the handful of exception types Python
# itself can raise before or outside that whitelist (SyntaxError /
# IndentationError from compile(), RecursionError, ImportError from the
# blocked-import shim).
_EXCEPTION_TEMPLATE = {
    "IndexError": "index",
    "TypeError": "type",
    "ValueError": "value",
    "NameError": "name",
    "ZeroDivisionError": "zerodiv",
    "KeyError": "key",
    "AttributeError": "attribute",
    "SyntaxError": "syntax",
    "IndentationError": "syntax",
    "TabError": "syntax",
    "RecursionError": "recursion",
    "OverflowError": "overflow",
    "AssertionError": "assertion",
    "UnicodeError": "unicode",
    "UnicodeDecodeError": "unicode",
    "UnicodeEncodeError": "unicode",
    "ImportError": "import",
    "ModuleNotFoundError": "import",
}

_LAST_EXCEPTION_LINE = re.compile(r"^(\w+(?:Error|Exception)):\s?(.*)$", re.MULTILINE)
_LEARNER_CODE_LINE = re.compile(r'File "<learner_code>", line (\d+)')


def _classify(stderr: str) -> tuple[Optional[str], Optional[int]]:
    """Return (template_key, line_number) for a raw stderr traceback, or
    (None, None) if nothing recognisable was found at all."""
    matches = list(_LAST_EXCEPTION_LINE.finditer(stderr))
    if not matches:
        return None, None
    exc_name = matches[-1].group(1)
    key = _EXCEPTION_TEMPLATE.get(exc_name, "generic")

    # The deepest "<learner_code>" frame is the line closest to where
    # execution actually stopped -- for a plain error that's the line that
    # raised; for an uncaught exception inside nested calls (e.g. unbounded
    # recursion) it's the innermost repeated frame, which is still the most
    # useful single line to point a beginner at.
    line_matches = _LEARNER_CODE_LINE.findall(stderr)
    line = int(line_matches[-1]) if line_matches else None
    return key, line


def _fill(template_key: str, line: Optional[int]) -> str:
    text = _TEMPLATES_XH[template_key]
    if line is None:
        # Every non-timeout template contains XX0XX (there's always a real
        # line number in a traceback), so this branch is a defensive
        # fallback, not an expected path -- leave the placeholder rather
        # than show a wrong line number.
        return text.replace("XX0XX", "?")
    return text.replace("XX0XX", str(line))


# ─── public API (same signatures as the previous LLM-based version) ─────────


def translate_error(stderr: str) -> Optional[str]:
    """Return a short isiXhosa explanation of `stderr`, or None if nothing
    in it was recognised. Never raises -- callers always have the raw
    English stderr as a fallback regardless of what this returns."""
    if not stderr or not stderr.strip():
        return None
    key, line = _classify(stderr)
    if key is None:
        return None
    return _fill(key, line)


def translate_timeout(code: str) -> Optional[str]:
    """Return the isiXhosa timeout explanation. `code` is accepted for
    interface compatibility with callers (and in case a future revision
    wants to distinguish "no loop at all" from "loop never terminates"),
    but the current template is a single general explanation -- unlike a
    live LLM call, a fixed template can't read the learner's own code."""
    return _TEMPLATES_XH["timeout"]
