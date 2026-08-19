"""Strings for the Slicing practice engine to slice.

Two sources feed the pool, and they answer different needs.

**Dictionary words** are the neutral case: they carry no structure, so a
question about them is purely about the slice. A curated built-in list
ships with the app; `refresh_cache()` can widen it from Datamuse (a free,
no-key word API) into a JSON cache on disk. The network is never on the
request path — `load_words()` reads the cache if it happens to exist and
falls back to the built-in list otherwise, so a blocked or down API costs
variety, never a question. Refreshing is an explicit operation:

    python -m app.services.corpus refresh

**Structured strings** are the point of the exercise. Real code slices
dates, filenames, emails and course codes far more often than it slices
"jabberwocky", and those strings have *fields* at known offsets — which
is what makes `date[:4]` mean something rather than being an arbitrary
span. These are generated procedurally rather than listed, so they have
effectively unlimited variety with no API at all, and each one knows the
name its variable should carry (`date`, not `word`) and where its fields
live, so a template can ask for "the year" instead of "characters 0 to 4".
"""
import json
import random
import string
from pathlib import Path

_CACHE_PATH = Path(__file__).resolve().parent.parent / "data" / "word_cache.json"

# ─── string kinds ───────────────────────────────────────────────────────────

KIND_WORD = "word"
KIND_DATE = "date"
KIND_FILENAME = "filename"
KIND_EMAIL = "email"
KIND_COURSE = "course"
KIND_TIME = "time"
KIND_PHONE = "phone"
KIND_STUDENT_ID = "student_id"

STRUCTURED_KINDS = (
    KIND_DATE, KIND_FILENAME, KIND_EMAIL,
    KIND_COURSE, KIND_TIME, KIND_PHONE, KIND_STUDENT_ID,
)
ALL_KINDS = (KIND_WORD,) + STRUCTURED_KINDS


class Entry:
    """One string to slice, plus the context a question needs about it.

    `name` is the variable name the prompt will use, and `fields` maps a
    human label ("the year") to the slice that extracts it — that is what
    lets a template ask a question with real meaning attached instead of an
    arbitrary pair of numbers.
    """

    __slots__ = ("value", "kind", "name", "fields")

    def __init__(self, value, kind, name, fields=None):
        self.value = value
        self.kind = kind
        self.name = name
        self.fields = fields or {}

    def __repr__(self):
        return f"Entry({self.value!r}, {self.kind!r})"


# ─── built-in word list ─────────────────────────────────────────────────────
# Chosen for length spread (5-14) and for being unambiguous to read aloud in
# a lecture. All lowercase ASCII: a slice of "naïve" or "co-op" would raise
# questions about characters rather than about slicing.

_BUILTIN_WORDS = [
    # 5-6
    "cable", "flute", "grape", "maple", "ocean", "piano", "robot", "solar",
    "tiger", "vault", "whale", "zebra", "anchor", "bridge", "candle", "dragon",
    "engine", "forest", "garden", "hollow", "island", "jungle", "kettle", "ladder",
    "marble", "nectar", "orbit", "pencil", "quiver", "rocket", "silver", "temple",
    # 7-8
    "amber", "balloon", "compass", "diamond", "eclipse", "falcon", "gallery",
    "harvest", "iceberg", "journey", "kingdom", "lantern", "machine", "network",
    "octagon", "package", "quarter", "rainbow", "sandbox", "teacher", "umbrella",
    "village", "weather", "yoghurt", "aquarium", "birthday", "computer", "delegate",
    "elephant", "festival", "gradient", "hospital", "industry", "keyboard", "language",
    "mountain", "notebook", "operator", "particle", "question", "resource", "sandwich",
    "template", "universe", "vacation", "workshop",
    # 9-11
    "algorithm", "butterfly", "chocolate", "developer", "essential", "framework",
    "generator", "hurricane", "important", "landscape", "migration", "newsprint",
    "orchestra", "parameter", "quicksand", "raspberry", "structure", "telescope",
    "understand", "waterfall", "xylophone", "adventurer", "background", "calculator",
    "dictionary", "everything", "foundation", "generation", "helicopter", "instrument",
    "laboratory", "manuscript", "navigation", "observable", "photograph", "quarterly",
    "repository", "successful", "typewriter", "understood", "vegetables", "wonderland",
    # 12-14
    "architecture", "biodiversity", "conversation", "distribution", "encyclopedia",
    "headquarters", "illustration", "jurisdiction", "kaleidoscope", "laboratories",
    "mathematics", "neighbourhood", "organisation", "presentation", "questionnaire",
    "relationship", "specification", "transmission", "understanding", "verification",
]

# Best-effort only. Datamuse returns dictionary words, which include terms
# nobody wants on a lecture projector; this filters the obvious ones out of
# a refresh. It is not a substitute for reviewing a refreshed cache before
# deploying it.
#
# Matching is whole-word, not substring. A substring blocklist is the
# Scunthorpe problem waiting to happen — "rape" is inside "grape", "hell"
# inside "shell", "sex" inside "sextet" — and since the corpus holds one
# word per entry there is nothing a substring match buys. Common inflections
# are listed rather than stemmed, because a stemmer is a dependency and a
# new failure mode for a list this short.
_BLOCKED_WORDS = frozenset({
    "fuck", "fucked", "fucking", "fucker",
    "shit", "shits", "shitting", "bullshit",
    "cunt", "cunts", "bitch", "bitches",
    "penis", "penises", "vagina", "vaginas",
    "rape", "raped", "raping", "rapist",
    "whore", "whores", "slut", "sluts",
    "porn", "porno", "suicide", "murder",
    "nigger", "niggers",
})


def _is_usable_word(word):
    if not (5 <= len(word) <= 14):
        return False
    if not all(c in string.ascii_lowercase for c in word):
        return False
    return word not in _BLOCKED_WORDS


def load_words():
    """Built-in words plus anything a previous refresh cached.

    Deliberately forgiving: a missing, empty or corrupt cache is not an
    error, it just means the built-in list stands alone.
    """
    words = list(_BUILTIN_WORDS)
    try:
        cached = json.loads(_CACHE_PATH.read_text(encoding="utf-8"))
        if isinstance(cached, list):
            words.extend(w for w in cached if isinstance(w, str) and _is_usable_word(w))
    except (OSError, json.JSONDecodeError, ValueError):
        pass
    # dict.fromkeys rather than set(): keeps the order stable so a given
    # seed picks the same word across processes.
    return list(dict.fromkeys(words))


def refresh_cache(per_length=400, timeout=10):
    """Top the word pool up from Datamuse and cache the result to disk.

    Never called while serving a request. Returns how many new words landed.
    """
    import requests  # local import: the request path must not need this

    collected = []
    for length in range(5, 15):
        response = requests.get(
            "https://api.datamuse.com/words",
            params={"sp": "?" * length, "max": per_length},
            timeout=timeout,
        )
        response.raise_for_status()
        collected.extend(
            item["word"] for item in response.json()
            if isinstance(item, dict) and _is_usable_word(item.get("word", ""))
        )

    existing = set(_BUILTIN_WORDS)
    fresh = [w for w in dict.fromkeys(collected) if w not in existing]

    _CACHE_PATH.parent.mkdir(parents=True, exist_ok=True)
    _CACHE_PATH.write_text(json.dumps(sorted(fresh), indent=0), encoding="utf-8")
    return len(fresh)


# ─── structured strings ─────────────────────────────────────────────────────
# Generated, not listed: a date has 10 slots and a fixed shape, so there is
# no reason to store examples of one. Each builder returns the value plus the
# field map that gives its offsets meaning.

_FILE_STEMS = [
    "report", "invoice", "backup", "lecture", "results", "summary", "dataset",
    "chapter", "budget", "minutes", "diagram", "archive", "roster", "receipt",
]
_FILE_EXTS = ["pdf", "csv", "txt", "png", "zip", "docx", "json", "md"]
_EMAIL_USERS = ["mthunzi", "nomsa", "sipho", "lerato", "thabo", "zanele", "kagiso", "ayanda"]
_EMAIL_DOMAINS = ["myuct.ac.za", "gmail.com", "outlook.com", "uct.ac.za"]
_DEPARTMENTS = ["CSC", "MAM", "STA", "PHY", "EEE", "BUS", "ECO", "INF"]


def _build_date(rng):
    year = rng.randint(1990, 2030)
    month = rng.randint(1, 12)
    day = rng.randint(1, 28)
    value = f"{year:04d}-{month:02d}-{day:02d}"
    return Entry(value, KIND_DATE, "date", {
        "the year": (0, 4, None),
        "the month": (5, 7, None),
        "the day": (8, None, None),
    })


def _build_time(rng):
    value = f"{rng.randint(0, 23):02d}:{rng.randint(0, 59):02d}:{rng.randint(0, 59):02d}"
    return Entry(value, KIND_TIME, "timestamp", {
        "the hour": (0, 2, None),
        "the minutes": (3, 5, None),
        "the seconds": (6, None, None),
    })


def _build_filename(rng):
    stem = rng.choice(_FILE_STEMS)
    ext = rng.choice(_FILE_EXTS)
    value = f"{stem}.{ext}"
    return Entry(value, KIND_FILENAME, "filename", {
        "the name without its extension": (0, len(stem), None),
        "the extension": (len(stem) + 1, None, None),
    })


def _build_email(rng):
    user = rng.choice(_EMAIL_USERS)
    domain = rng.choice(_EMAIL_DOMAINS)
    value = f"{user}@{domain}"
    return Entry(value, KIND_EMAIL, "email", {
        "the part before the @": (0, len(user), None),
        "the domain": (len(user) + 1, None, None),
    })


def _build_course(rng):
    value = f"{rng.choice(_DEPARTMENTS)}{rng.randint(1000, 3999)}{rng.choice('FSWZ')}"
    return Entry(value, KIND_COURSE, "course", {
        "the department prefix": (0, 3, None),
        "the course number": (3, 7, None),
        "the term letter": (7, None, None),
    })


def _build_phone(rng):
    value = f"0{rng.randint(60, 84)} {rng.randint(100, 999)} {rng.randint(1000, 9999)}"
    return Entry(value, KIND_PHONE, "phone", {
        "the dialling code": (0, 3, None),
        "the last four digits": (-4, None, None),
    })


def _build_student_id(rng):
    # sample, not choice: "UUU123456" reads like a placeholder rather than
    # like a real record, and repeated characters make a slice result
    # ambiguous to check by eye.
    value = f"{''.join(rng.sample(string.ascii_uppercase, 3))}{rng.randint(100000, 999999)}"
    return Entry(value, KIND_STUDENT_ID, "student_id", {
        "the initials": (0, 3, None),
        "the number": (3, None, None),
    })


_STRUCTURED_BUILDERS = {
    KIND_DATE: _build_date,
    KIND_TIME: _build_time,
    KIND_FILENAME: _build_filename,
    KIND_EMAIL: _build_email,
    KIND_COURSE: _build_course,
    KIND_PHONE: _build_phone,
    KIND_STUDENT_ID: _build_student_id,
}


# ─── sampling ───────────────────────────────────────────────────────────────

def word_entry(rng, min_len=5, max_len=14, words=None):
    pool = words if words is not None else load_words()
    candidates = [w for w in pool if min_len <= len(w) <= max_len]
    return Entry(rng.choice(candidates or pool), KIND_WORD, "word")


def structured_entry(rng, kind=None):
    kind = kind or rng.choice(STRUCTURED_KINDS)
    return _STRUCTURED_BUILDERS[kind](rng)


def sample(rng, kinds=None, min_len=5, max_len=14, words=None):
    """One entry drawn from the allowed kinds.

    The length window is applied in full only to words, where length is the
    difficulty dial — a longer random word is genuinely more to hold in your
    head. A structured string's length is a property of its shape, not of
    its difficulty: an email is nineteen characters because that is what an
    email is, and its fields stay just as findable. So structured kinds
    honour the floor (a tier asking for long strings should not get "09:15")
    and ignore the ceiling. Which kinds reach a given tier at all is decided
    by the templates, not here.
    """
    allowed = list(kinds) if kinds else list(ALL_KINDS)
    rng.shuffle(allowed)

    for kind in allowed:
        if kind == KIND_WORD:
            return word_entry(rng, min_len, max_len, words)
        entry = _STRUCTURED_BUILDERS[kind](rng)
        if len(entry.value) >= min_len:
            return entry

    # Nothing structured cleared the floor; words always can.
    return word_entry(rng, min_len, max_len, words)


if __name__ == "__main__":  # pragma: no cover
    import sys

    if len(sys.argv) > 1 and sys.argv[1] == "refresh":
        added = refresh_cache()
        print(f"cached {added} new words to {_CACHE_PATH}")
        print(f"pool is now {len(load_words())} words")
    else:
        rng = random.Random()
        print(f"{len(load_words())} words available")
        for k in ALL_KINDS:
            e = sample(rng, kinds=[k])
            print(f"  {k:12} {e.name:11} = {e.value!r}  fields={list(e.fields)}")
