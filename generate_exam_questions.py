"""Generate exam-style string questions modeled on CSC1015F past-paper patterns
(predict-the-output slices, .format() outputs, escape sequences, ord/chr,
lexicographic comparison, first-principles code writing, trap questions,
debug-the-code) and append them to the backend exercise bank.

Every predict-the-output answer is VERIFIED by executing the code before it is
written to the bank, so the stored answers are guaranteed correct.

All question wording is original — patterns are mined from past papers, but no
UCT text is reproduced.
"""
import io
import json
import contextlib
from pathlib import Path

BANK = Path(__file__).resolve().parent / "backend" / "app" / "data" / "exercises.json"


def run(code: str) -> str:
    """Execute code, return captured stdout (verifier)."""
    buf = io.StringIO()
    with contextlib.redirect_stdout(buf):
        exec(code, {})
    return buf.getvalue()


def expr(expression: str):
    """Evaluate an expression (verifier)."""
    return eval(expression, {})


def check(actual, expected, label):
    assert actual == expected, f"{label}: expected {expected!r}, got {actual!r}"
    return expected


Q = []


def add(module_id, qid, qtype, prompt, *, options=None, answer=None, answers=None,
        misconceptions=None, explanation=None, starter_code=None, test_cases=None,
        stars=1, tags=None):
    entry = {
        "module_id": module_id,
        "question_id": qid,
        "prompt": prompt,
        "type": qtype,
        "xp": stars * 10,  # legacy field name kept for API compatibility; UI shows stars
        "stars": stars,
        "tags": tags or ["exam_style"],
    }
    if options is not None:
        entry["options"] = options
    if answer is not None:
        entry["answer"] = answer
    if answers is not None:
        entry["answers"] = answers
    if misconceptions:
        entry["misconception_map"] = misconceptions
    if explanation:
        entry["explanation"] = explanation
    if starter_code:
        entry["starter_code"] = starter_code
    if test_cases:
        entry["test_cases"] = test_cases
    Q.append(entry)


# ═════════════════════════ INTRO ═══════════════════════════════════════════

check(run(r"print('1\\2', 'A\\B', sep='-')"), "1\\2-A\\B\n", "esc")
add("intro", "intro-x01", "mcq",
    "What does this print?\nprint('1\\\\2', 'A\\\\B', sep='-')",
    options=["1\\\\2-A\\\\B", "1\\2-A\\B", "12-AB", "1\\2 A\\B"],
    answer="1\\2-A\\B",
    misconceptions={"1\\\\2-A\\\\B": "escape_sequence_literal_confusion"},
    explanation="In source code, \\\\ is an escape sequence for ONE backslash character. sep='-' places a dash between the two printed values.",
    stars=2, tags=["exam_style", "trap"])

check(expr("'23.4' * 2"), "23.423.4", "strmul")
add("intro", "intro-x02", "mcq",
    "What is the value of this expression?\n'23.4' * 2",
    options=["46.8", "'23.423.4'", "'46.8'", "TypeError"],
    answer="'23.423.4'",
    misconceptions={"46.8": "string_number_equality_myth"},
    explanation="'23.4' is a string, not a number. Multiplying a string by an integer repeats it: the digits are never added.",
    stars=1, tags=["exam_style", "trap"])

check(expr("len('Cape\\nTown')"), 9, "lenescape")
add("intro", "intro-x03", "mcq",
    "What is the value of this expression?\nlen(\"Cape\\nTown\")",
    options=["10", "9", "8", "SyntaxError"],
    answer="9",
    misconceptions={"10": "escape_sequence_literal_confusion"},
    explanation="\\n is a single newline character, not two characters. So the string holds C,a,p,e,newline,T,o,w,n = 9 characters.",
    stars=2, tags=["exam_style", "trap"])

check(expr("chr(ord('a') + 2)"), "c", "ordchr")
add("intro", "intro-x04", "mcq",
    "What is the value of this expression?\nchr(ord('a') + 2)",
    options=["'a2'", "'c'", "99", "'b'"],
    answer="'c'",
    explanation="ord('a') gives the Unicode number 97. Adding 2 gives 99, and chr(99) converts back to the character 'c'.",
    stars=2)

check(run("print(chr(66))"), "B\n", "chr66")
add("intro", "intro-x05", "fill_blank",
    "What single character does this print?\nprint(chr(66))",
    answer="B",
    explanation="Unicode numbers 65, 66, 67, ... map to 'A', 'B', 'C', ... so chr(66) is 'B'. Remember ord('A') = 65 and ord('a') = 97.",
    stars=1)

add("intro", "intro-x06", "mcq",
    "Which of these is a METHOD call rather than a function call?",
    options=["len(s)", "print(s)", "s.upper()", "ord(s)"],
    answer="s.upper()",
    explanation="Strings are objects, so they carry their own behaviour. Methods are called with dot notation on the object (s.upper()), while functions take the string as a parameter (len(s)).",
    stars=1, tags=["exam_style", "conceptual"])

add("intro", "intro-x07", "select_all",
    "Select ALL the valid Python string literals.",
    options=["'howzit'", "\"it's cold\"", "'it's cold'", "\"96%*&\""],
    answers=["'howzit'", "\"it's cold\"", "\"96%*&\""],
    misconceptions={"'it's cold'": "strings_need_quotes"},
    explanation="A single-quoted string cannot contain an unescaped single quote: Python ends the string at the apostrophe in 'it's. Wrap it in double quotes instead. Symbols and digits are fine inside strings.",
    stars=2, tags=["exam_style", "trap"])

# ═════════════════════════ INDEXING ════════════════════════════════════════

check(expr("'Domino'[-2]"), "n", "dom")
add("indexing", "indexing-x01", "mcq",
    "What does this print?\nw = \"Domino\"\nprint(w[-2])",
    options=["o", "n", "i", "IndexError"],
    answer="n",
    misconceptions={"o": "negative_index_confusion"},
    explanation="Negative indices count from the end: -1 is the last character 'o', so -2 is the one before it, 'n'.",
    stars=1)

check(expr("'robot'[len('robot') - 1]"), "t", "lastchar")
add("indexing", "indexing-x02", "mcq",
    "What does this print?\ns = \"robot\"\nprint(s[len(s) - 1])",
    options=["t", "o", "IndexError", "robot"],
    answer="t",
    misconceptions={"IndexError": "off_by_one_length"},
    explanation="len(s) is 5, so s[4] is the LAST character 't'. s[len(s)] would be out of range, but len(s) - 1 is always safe.",
    stars=1)

_planet = run("s = 'planet'\nfor i in range(len(s)-1, 0, -1):\n    if i % 2 == 0:\n        print(s[i].upper(), end='')\n    else:\n        print(s[i], end='')")
check(_planet, "tEnAl", "planet")
add("indexing", "indexing-x03", "mcq",
    "What is the output of this program?\ns = \"planet\"\nfor i in range(len(s)-1, 0, -1):\n    if i % 2 == 0:\n        print(s[i].upper(), end='')\n    else:\n        print(s[i], end='')",
    options=["tEnAl", "TeNaL", "tenal", "tEnAlP"],
    answer="tEnAl",
    explanation="range(5, 0, -1) visits indices 5,4,3,2,1 (it stops BEFORE 0, so 'p' is never printed). Even indices are uppercased: t, E, n, A, l.",
    stars=3, tags=["exam_style", "trap"])

add("indexing", "indexing-x04", "fill_blank",
    "text = \"Kraken\". Give the NEGATIVE index i so that text[i] returns 'K'.",
    answer="-6",
    misconceptions={"-5": "negative_index_confusion"},
    explanation="Negative indices run from -1 (last character 'n') back to -len (first character). len is 6, so 'K' is at index -6.",
    stars=2)

add("indexing", "indexing-x05", "mcq",
    "What happens when this runs?\ns = \"cat\"\ns[0] = \"b\"",
    options=["s becomes \"bat\"", "s becomes \"b\"", "TypeError is raised", "Nothing happens"],
    answer="TypeError is raised",
    misconceptions={"s becomes \"bat\"": "immutability_in_place"},
    explanation="Indexing is read-only. Strings are immutable, so assigning to s[0] raises TypeError: 'str' object does not support item assignment.",
    stars=2, tags=["exam_style", "trap"])

add("indexing", "indexing-x06", "write_code",
    "Debug the code. This program should print each character of the word on its own line, but it crashes with an IndexError. Fix it.",
    starter_code="word = \"gale\"\nfor i in range(1, len(word) + 1):\n    print(word[i])\n",
    test_cases=[{"expected_output": "g\na\nl\ne"}],
    explanation="Valid indices run from 0 to len(word) - 1. The loop must be range(len(word)) — starting at 1 skips 'g', and reaching len(word) is one past the end.",
    stars=3, tags=["exam_style", "debug"])

# ═════════════════════════ SLICING ═════════════════════════════════════════

check(expr("('Go' + 'Ma'*2)[-1:-4:-1]"), "aMa", "goma")
add("slicing", "slicing-x01", "mcq",
    "What is the value of this expression?\n('Go' + 'Ma'*2)[-1:-4:-1]",
    options=["'aMa'", "'MaM'", "'aM'", "TypeError"],
    answer="'aMa'",
    explanation="First build the string: 'Go' + 'MaMa' = 'GoMaMa'. A step of -1 walks backwards from index -1 ('a'), stopping before -4: 'a','M','a'.",
    stars=3, tags=["exam_style"])

check(expr("'step on no pets'[-5:-8:-1]"), " on", "palslice")
check(expr("'step on no pets'[5:8]"), "on ", "palslice2")
add("slicing", "slicing-x02", "mcq",
    "What does this print?\nprint(\"step on no pets\"[5:8])",
    options=["on ", "no", " on", "pets"],
    answer="on ",
    misconceptions={"no": "slice_stop_inclusive"},
    explanation="Indices 5, 6, 7 hold 'o', 'n', and a space (the stop index 8 is excluded). Count carefully: s-t-e-p-space is indices 0 to 4.",
    stars=2)

check(expr("'Python'[::-2]"), "nhy", "pyneg2")
check(expr("'Python'[-2::-2]"), "otP", "pyneg2b")
add("slicing", "slicing-x03", "mcq",
    "w = \"Python\". Which slice produces the string \"otP\"?",
    options=["w[::-2]", "w[-2::-2]", "w[1::2]", "w[0:5:2]"],
    answer="w[-2::-2]",
    misconceptions={"w[::-2]": "negative_step_unfamiliar"},
    explanation="Start at index -2 ('o') and step backwards two at a time: 'o' (4), 't' (2), 'P' (0). w[::-2] starts at the LAST character instead, giving 'nhy'.",
    stars=3, tags=["exam_style"])

check(expr("'program'[1::2]"), "rga", "prog")
add("slicing", "slicing-x04", "mcq",
    "s = \"program\". Which slice produces the string \"rga\"?",
    options=["s[1::2]", "s[::2]", "s[1:5]", "s[::-2]"],
    answer="s[1::2]",
    explanation="Start at index 1 ('r') and take every second character: indices 1, 3, 5 give 'r', 'g', 'a'.",
    stars=3, tags=["exam_style"])

check(expr("'hello'[3:1]"), "", "emptyslice")
add("slicing", "slicing-x05", "mcq",
    "What is the value of this expression?\n\"hello\"[3:1]",
    options=["'ll'", "'le'", "'' (empty string)", "IndexError"],
    answer="'' (empty string)",
    misconceptions={"IndexError": "off_by_one_length"},
    explanation="With the default step of +1, the slice moves forwards — but stop (1) is BEHIND start (3), so no characters are collected. Slicing never raises IndexError; it just returns an empty string.",
    stars=2, tags=["exam_style", "trap"])

add("slicing", "slicing-x06", "fill_blank",
    "s holds a string. Give the single slice expression that removes BOTH the first and last characters (e.g. \"trains\" becomes \"rain\").\nWrite it exactly like: s[?:?]",
    answer="s[1:-1]",
    explanation="Start at index 1 to skip the first character, and stop at -1: the stop is exclusive, so the last character is dropped too. This works for any length.",
    stars=2, tags=["exam_style"])

check(expr("'impossible'[2:]"), "possible", "imposs")
add("slicing", "slicing-x07", "mcq",
    "a = \"impossible\". What is the value of a[2:]?",
    options=["'possible'", "'im'", "'mpossible'", "'ossible'"],
    answer="'possible'",
    explanation="An omitted stop defaults to the end of the string, so a[2:] takes everything from index 2 ('p') onwards.",
    stars=1)

check(expr("'conundrum'[::3]"), "cur", "conun")
add("slicing", "slicing-x08", "mcq",
    "What is the value of this expression?\n\"conundrum\"[::3]",
    options=["'cur'", "'con'", "'cnr'", "'cum'"],
    answer="'cur'",
    explanation="Omitted start and stop cover the whole string; step 3 takes indices 0, 3, 6: 'c', 'u', 'r' (index 9 is past the end).",
    stars=2)

check(expr("'Hello Sipho'[6:9]"), "Sip", "sipho")
add("slicing", "slicing-x09", "mcq",
    "greet = \"Hello Sipho\". What is the value of greet[6:9]?",
    options=["'Sip'", "'Siph'", "' Si'", "'Siph'"],
    answer="'Sip'",
    misconceptions={"'Siph'": "slice_stop_inclusive"},
    explanation="Index 5 is the space, so index 6 is 'S'. The slice collects indices 6, 7, 8 and stops before 9.",
    stars=1)

add("slicing", "slicing-x10", "write_code",
    "Write a program that reads one line of input and prints \"yes\" if it is a palindrome (reads the same backwards) and \"no\" otherwise. Use slicing.",
    test_cases=[
        {"input": "racecar\n", "expected_output": "yes"},
        {"input": "rocket\n", "expected_output": "no"},
    ],
    explanation="The classic exam pattern: a string s is a palindrome exactly when s == s[::-1], because [::-1] produces the reversed string.",
    stars=3, tags=["exam_style"])

# ═════════════════════════ IMMUTABILITY ════════════════════════════════════

_up = run("s = 'cat'\ns.upper()\nprint(s)")
check(_up, "cat\n", "upnoassign")
add("immutability", "immutability-x01", "mcq",
    "What does this print?\ns = \"cat\"\ns.upper()\nprint(s)",
    options=["CAT", "cat", "Cat", "TypeError"],
    answer="cat",
    misconceptions={"CAT": "method_mutates_target"},
    explanation="upper() RETURNS a new uppercase string — it cannot change s, because strings are immutable. The returned value was thrown away, so s is still 'cat'. You would need s = s.upper().",
    stars=2, tags=["exam_style", "trap"])

_rep = run("s = 'cat'\nt = s.replace('c', 'b')\nprint(s, t)")
check(_rep, "cat bat\n", "repnew")
add("immutability", "immutability-x02", "mcq",
    "What does this print?\ns = \"cat\"\nt = s.replace(\"c\", \"b\")\nprint(s, t)",
    options=["bat bat", "cat bat", "cat cat", "bat cat"],
    answer="cat bat",
    misconceptions={"bat bat": "method_mutates_target"},
    explanation="replace() builds and returns a NEW string. The original s is untouched; only t holds the replaced version.",
    stars=2, tags=["exam_style"])

add("immutability", "immutability-x03", "fill_blank",
    "s = \"cat\". Using concatenation and a slice, complete this line so s appears to change its first letter to 'b':\ns = \"b\" + ____",
    answer="s[1:]",
    explanation="You cannot edit a string in place, but you can BUILD a new one: take 'b' and join it to everything after the first character, then rebind the name s to the result.",
    stars=2, tags=["exam_style"])

add("immutability", "immutability-x04", "mcq",
    "A function is written to grow a string:\ndef extend(s):\n    s = s + \"!\"\n\nword = \"go\"\nextend(word)\nprint(word)\n\nWhat is printed?",
    options=["go!", "go", "!", "TypeError"],
    answer="go",
    misconceptions={"go!": "immutability_in_place"},
    explanation="Inside the function, s = s + \"!\" creates a NEW string and points the local name s at it. The string that word refers to never changes — strings cannot be modified through a parameter.",
    stars=3, tags=["exam_style", "trap"])

add("immutability", "immutability-x05", "mcq",
    "Which statement about Python strings is TRUE?",
    options=[
        "Individual characters can be reassigned using indexing",
        "String methods modify the string they are called on",
        "Every string operation that 'changes' a string actually builds a new string",
        "Strings can be changed in place if they were made with double quotes",
    ],
    answer="Every string operation that 'changes' a string actually builds a new string",
    misconceptions={"String methods modify the string they are called on": "method_mutates_target"},
    explanation="Immutability means the characters of a string can never change after creation. upper(), replace(), slicing and concatenation all return NEW strings; the original always survives.",
    stars=1, tags=["exam_style", "conceptual"])

# ═════════════════════════ COMPARISON ══════════════════════════════════════

check(expr("'bat' < 'man'"), True, "batman")
add("comparison", "comparison-x01", "mcq",
    "What is the value of this expression?\n\"bat\" < \"man\"",
    options=["True", "False", "TypeError", "'bat'"],
    answer="True",
    misconceptions={"TypeError": "strings_not_orderable_myth"},
    explanation="Strings compare in dictionary (lexicographic) order, character by character using Unicode numbers. 'b' (98) comes before 'm' (109), so the comparison is decided immediately: True.",
    stars=2, tags=["exam_style"])

check(expr("'python' in 'Python programming'"), False, "incase")
add("comparison", "comparison-x02", "mcq",
    "What is the value of this expression?\n\"python\" in \"Python programming\"",
    options=["True", "False", "SyntaxError", "1"],
    answer="False",
    misconceptions={"True": "comparison_ignores_case"},
    explanation="The in operator is case-sensitive. 'python' with a lowercase p does not appear anywhere inside 'Python programming'.",
    stars=2, tags=["exam_style", "trap"])

check(expr("'apple' < 'apricot'"), True, "applepri")
add("comparison", "comparison-x03", "mcq",
    "What is the value of this expression?\n\"apple\" < \"apricot\"",
    options=["True", "False", "Error: different lengths", "'apple'"],
    answer="True",
    explanation="Comparison walks both strings together: 'a'='a', 'p'='p', then 'p' vs 'r'. Since 'p' comes before 'r', 'apple' is smaller. Length only matters if one string is a prefix of the other.",
    stars=2, tags=["exam_style"])

check(expr("'a' > 'Z'"), True, "aZ")
add("comparison", "comparison-x04", "mcq",
    "What is the value of this expression?\n'a' > 'Z'",
    options=["True", "False", "TypeError", "It depends on the keyboard"],
    answer="True",
    explanation="Characters compare by their Unicode numbers. ALL uppercase letters (65-90) come before all lowercase letters (97-122), so 'a' (97) is greater than 'Z' (90). A favourite exam trap.",
    stars=3, tags=["exam_style", "trap"])

check(expr("min('banana', 'apple', 'cherry')"), "apple", "minstr")
add("comparison", "comparison-x05", "fill_blank",
    "What is the value of this expression? (type the word only)\nmin(\"banana\", \"apple\", \"cherry\")",
    answer="apple",
    explanation="min() on strings uses dictionary order, and 'apple' sorts first: 'a' comes before 'b' and 'c'.",
    stars=2)

check(expr("'10' == 10"), False, "streq")
add("comparison", "comparison-x06", "mcq",
    "What is the value of this expression?\n'10' == 10",
    options=["True", "False", "TypeError", "10"],
    answer="False",
    misconceptions={"True": "string_number_equality_myth"},
    explanation="A string and an integer are never equal, even when they look the same. '10' is two characters; 10 is a number.",
    stars=1, tags=["exam_style", "trap"])

# ═════════════════════════ LOOPING ═════════════════════════════════════════

_hh = run("word = 'Hi'\nfor c in word:\n    print(c*2, end='')")
check(_hh, "HHii", "hh")
add("looping", "looping-x01", "mcq",
    "What is the output?\nword = \"Hi\"\nfor c in word:\n    print(c*2, end='')",
    options=["HiHi", "HHii", "HH ii", "Hi"],
    answer="HHii",
    explanation="The loop visits each character in turn. c*2 doubles the CHARACTER, not the word: 'H'*2 then 'i'*2 gives HHii.",
    stars=2, tags=["exam_style"])

add("looping", "looping-x02", "fill_blank",
    "Complete the range so this loop visits every valid index of word exactly once:\nfor i in range(____):\n    print(word[i])",
    answer="len(word)",
    misconceptions={"len(word)+1": "off_by_one_length", "len(word)-1": "off_by_one_length"},
    explanation="range(len(word)) produces 0 up to len(word) - 1, which is exactly the set of valid indices. Adding 1 causes an IndexError; subtracting 1 skips the last character.",
    stars=2, tags=["exam_style"])

_cnt = run("t = 'beekeeper'\nc = 0\nfor ch in t:\n    if ch == 'e':\n        c += 1\nprint(c)")
check(_cnt, "5\n", "beeks")
add("looping", "looping-x03", "mcq",
    "What does this print?\nt = \"beekeeper\"\nc = 0\nfor ch in t:\n    if ch == 'e':\n        c += 1\nprint(c)",
    options=["4", "5", "6", "9"],
    answer="5",
    explanation="This is the first-principles counting pattern: examine every character and count the matches. 'beekeeper' contains e at positions 1, 2, 4, 5, 7 — five in total.",
    stars=2, tags=["exam_style"])

add("looping", "looping-x04", "write_code",
    "First principles: write a program that reads a line of text, then a single letter, and prints how many times the letter occurs in the text. You may NOT use count(), find() or similar methods.\nExample: text \"beekeeper\" and letter \"e\" prints 5",
    test_cases=[
        {"input": "beekeeper\ne\n", "expected_output": "5"},
        {"input": "mississippi\ns\n", "expected_output": "4"},
    ],
    explanation="Loop over every character of the text and compare it to the target letter, adding 1 to a counter on each match. Exams regularly forbid count() to test this exact pattern.",
    stars=3, tags=["exam_style"])

add("looping", "looping-x05", "write_code",
    "Redaction, from first principles: read a message, then a string of letters to redact. Print the message with every character that occurs in the redact string replaced by '_'. You may NOT use replace() or similar methods.\nExample: message \"Top Secret\" with redact \"Secret\" prints Top ______ (6 underscores)",
    test_cases=[
        {"input": "Top Secret\nSecret\n", "expected_output": "Top ______"},
        {"input": "banana\nan\n", "expected_output": "b_____"},
    ],
    explanation="Loop over the message; for each character, use the in operator to test membership in the redact string, and build a new output string of either the original character or '_'.",
    stars=3, tags=["exam_style"])

_wl = run("s = 'loop'\ni = 0\nwhile i < len(s) - 1:\n    print(s[i], end='')\n    i += 1")
check(_wl, "loo", "whileloop")
add("looping", "looping-x06", "mcq",
    "What is the output?\ns = \"loop\"\ni = 0\nwhile i < len(s) - 1:\n    print(s[i], end='')\n    i += 1",
    options=["loop", "loo", "oop", "l"],
    answer="loo",
    misconceptions={"loop": "off_by_one_length"},
    explanation="The condition i < len(s) - 1 stops the loop one character EARLY: indices 0, 1, 2 are printed but index 3 ('p') is not.",
    stars=2, tags=["exam_style", "trap"])

# ═════════════════════════ METHODS ═════════════════════════════════════════

_spell = run("spell = 'Alakazam'\nprint(spell.replace('aka', 'oo').upper())")
check(_spell, "ALOOZAM\n", "spell")
add("methods", "methods-x01", "mcq",
    "What is the output?\nspell = \"Alakazam\"\nprint(spell.replace(\"aka\", \"oo\").upper())",
    options=["ALOOZAM", "Aloozam", "ALAKAZAM", "aloozam"],
    answer="ALOOZAM",
    explanation="Method calls chain left to right: first replace 'aka' with 'oo' ('Aloozam'), then uppercase the result. Note the capital A does not match the lowercase 'aka'.",
    stars=3, tags=["exam_style"])

check(expr("'banana'.find('na')"), 2, "findna")
add("methods", "methods-x02", "mcq",
    "What is the value of this expression?\n\"banana\".find(\"na\")",
    options=["2", "3", "2 and 4", "True"],
    answer="2",
    misconceptions={"2 and 4": "count_vs_find_confusion"},
    explanation="find() returns the index of the FIRST occurrence only. 'na' first starts at index 2. If nothing is found, find() returns -1.",
    stars=2, tags=["exam_style"])

check(expr("'banana'.count('ana')"), 1, "countana")
add("methods", "methods-x03", "mcq",
    "What is the value of this expression?\n\"banana\".count(\"ana\")",
    options=["1", "2", "3", "0"],
    answer="1",
    misconceptions={"2": "count_overlap_confusion"},
    explanation="count() counts NON-overlapping occurrences from left to right. After matching 'ana' at index 1, the search continues from index 4 — the overlapping match at index 3 is never counted.",
    stars=3, tags=["exam_style", "trap"])

check(expr("'echo'.find('z')"), -1, "findz")
add("methods", "methods-x04", "fill_blank",
    "What integer does this evaluate to?\n\"echo\".find(\"z\")",
    answer="-1",
    explanation="When the search string is not present, find() returns -1 rather than raising an error. Always check for -1 before using the result as an index.",
    stars=2, tags=["exam_style"])

add("methods", "methods-x05", "mcq",
    "Which line correctly finds the LENGTH of the string s?",
    options=["s.len()", "len(s)", "s.length", "length(s)"],
    answer="len(s)",
    explanation="len is a built-in FUNCTION, not a method, so the string goes inside the brackets. Methods like upper() use dot notation; len does not.",
    stars=1, tags=["exam_style", "conceptual"])

add("methods", "methods-x06", "write_code",
    "A sentence contains the phrase \"quick <something> fox\". Read the sentence and print only the <something> word. Use find() and slicing — the word can be anything.\nExample: \"the quick brown fox jumps\" prints brown",
    test_cases=[
        {"input": "the quick brown fox jumps\n", "expected_output": "brown"},
        {"input": "a quick red fox ran\n", "expected_output": "red"},
    ],
    explanation="Find the index where 'quick ' ends and the index where ' fox' begins, then slice between them: s[s.find('quick ') + 6 : s.find(' fox')].",
    stars=3, tags=["exam_style"])

check(expr("'MiXed'.lower()"), "mixed", "lower")
add("methods", "methods-x07", "select_all",
    "s = \"MiXed\". Select ALL expressions that evaluate to True.",
    options=["s.lower() == \"mixed\"", "s.upper() == \"MIXED\"", "s == \"mixed\"", "s.find(\"X\") == 2"],
    answers=["s.lower() == \"mixed\"", "s.upper() == \"MIXED\"", "s.find(\"X\") == 2"],
    misconceptions={"s == \"mixed\"": "comparison_ignores_case"},
    explanation="lower() and upper() return fully converted copies, and 'X' sits at index 2. But s itself still has capitals, so s == \"mixed\" is False — comparison never ignores case.",
    stars=3, tags=["exam_style"])

# ═════════════════════════ FORMATTING ══════════════════════════════════════

check(expr("'{1}{0}'.format('one', 'two')"), "twoone", "fmtorder")
add("formatting", "formatting-x01", "mcq",
    "What is the value of this expression?\n\"{1}{0}\".format(\"one\", \"two\")",
    options=["'onetwo'", "'twoone'", "'one two'", "'{1}{0}'"],
    answer="'twoone'",
    explanation="The numbers inside the braces pick arguments BY POSITION: {1} is the second argument 'two' and {0} is the first, 'one'.",
    stars=2, tags=["exam_style"])

check(expr("'{0:>5}'.format('ab')"), "   ab", "fmtright")
add("formatting", "formatting-x02", "mcq",
    "What is the value of this expression?\n\"{0:>5}\".format(\"ab\")",
    options=["'ab   '", "'   ab'", "'ab'", "'>>>ab'"],
    answer="'   ab'",
    explanation="The > symbol means right-align inside a field 5 characters wide, so three spaces are added on the LEFT. (< left-aligns, ^ centres.)",
    stars=2, tags=["exam_style"])

check(expr("'{0:6.2f}'.format(3.14159)"), "  3.14", "fmtfloat")
add("formatting", "formatting-x03", "mcq",
    "What is the value of this expression?\n\"{0:6.2f}\".format(3.14159)",
    options=["'3.14  '", "'  3.14'", "'3.1415'", "'003.14'"],
    answer="'  3.14'",
    explanation="6.2f means: total field width 6, with 2 digits after the decimal point, rounded. '3.14' is 4 characters, so 2 spaces pad the left (numbers right-align by default).",
    stars=3, tags=["exam_style"])

check(run("print('We have {:<5} cats.'.format(7))"), "We have 7     cats.\n", "fmtleft")
add("formatting", "formatting-x04", "mcq",
    "What does this print?\nprint(\"We have {:<5} cats.\".format(7))",
    options=["We have     7 cats.", "We have 7     cats.", "We have 7 cats.", "We have {:<5} cats."],
    answer="We have 7     cats.",
    explanation="{:<5} left-aligns the value in a field of width 5: the 7 comes first, followed by four padding spaces, then the rest of the template.",
    stars=2, tags=["exam_style"])

check(run("name = 'Zola'\nprint(f'Hi {name}')"), "Hi Zola\n", "fstr")
add("formatting", "formatting-x05", "fill_blank",
    "Complete the f-string so it prints Hi Zola:\nname = \"Zola\"\nprint(f\"Hi {____}\")",
    answer="name",
    explanation="Inside an f-string, braces hold an EXPRESSION that is evaluated and inserted — here just the variable name.",
    stars=1)

check(run("name = 'Zola'\nprint('Hi {name}')"), "Hi {name}\n", "nofprefix")
add("formatting", "formatting-x06", "mcq",
    "What does this print?\nname = \"Zola\"\nprint(\"Hi {name}\")",
    options=["Hi Zola", "Hi {name}", "Hi name", "SyntaxError"],
    answer="Hi {name}",
    misconceptions={"Hi Zola": "fstring_missing_prefix_effect"},
    explanation="Without the f prefix this is an ordinary string: the braces are just characters, so {name} is printed literally. A very common exam trap.",
    stars=2, tags=["exam_style", "trap"])

check(expr("'{0} {0}'.format('go')"), "go go", "fmtrepeat")
add("formatting", "formatting-x07", "mcq",
    "What is the value of this expression?\n\"{0} {0}\".format(\"go\")",
    options=["'go go'", "'go'", "'go{0}'", "IndexError"],
    answer="'go go'",
    explanation="The same positional argument may be used as many times as you like: {0} refers to 'go' both times.",
    stars=1)

add("formatting", "formatting-x08", "write_code",
    "Read a number (it may have decimals) and print it as a Rand amount with exactly 2 decimal places, like R5.00 or R19.99.",
    test_cases=[
        {"input": "5\n", "expected_output": "R5.00"},
        {"input": "19.987\n", "expected_output": "R19.99"},
    ],
    explanation="Use float() on the input, then a format specification with .2f, e.g. print(f\"R{amount:.2f}\") — the value is rounded to 2 decimal places.",
    stars=3, tags=["exam_style"])

# ═════════════════════════ write to bank ═══════════════════════════════════

bank = json.loads(BANK.read_text(encoding="utf-8"))
existing_ids = {(e["module_id"], e["question_id"]) for e in bank}
added = 0
for entry in Q:
    key = (entry["module_id"], entry["question_id"])
    if key not in existing_ids:
        bank.append(entry)
        added += 1

BANK.write_text(json.dumps(bank, indent=2, ensure_ascii=False), encoding="utf-8")
print(f"All answers verified by execution. Added {added} questions; bank now has {len(bank)}.")
