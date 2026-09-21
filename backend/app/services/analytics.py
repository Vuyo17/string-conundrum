"""Read-only analytics behind the lecturer dashboard.

Every function here fetches whole rows and aggregates in Python rather than
pushing GROUP BY / window functions into Postgres. That is a deliberate
trade:

  * It costs more than SQL would at warehouse scale. At the scale this system
    actually runs -- one class, a few hundred students, a few hundred thousand
    attempts at the very outside -- the difference is not measurable next to
    the request's own overhead.
  * It buys ONE code path that works identically against Postgres and against
    the LOCAL_DB_FALLBACK JSON file. The fallback's _LocalCursor is a
    substring-dispatch stub that cannot execute an aggregate query, so the SQL
    approach would have left the whole dashboard undemonstrable on a laptop
    without Postgres -- which is exactly the configuration this project
    documents for Windows.

If the cohort ever outgrows this, the place to change it is here alone: the
routes and the frontend only ever see the shapes these functions return.
"""

from collections import defaultdict
from datetime import datetime, timedelta, timezone

from ..db import get_cursor
from . import admin_content

# Completion requirements come from the same catalogue as the student app.

# How the overall mark is composed. Exams weigh more than practice because
# practice is untimed, retryable and hint-assisted, so its accuracy is a
# measure of effort as much as of mastery. Stated as constants rather than
# buried in an expression so a lecturer can be told exactly what the number
# means -- and argue with it.
EXAM_WEIGHT = 0.6
PRACTICE_WEIGHT = 0.4

# A student is flagged at risk on any one of these. Thresholds are explicit
# and blunt on purpose: this is a prompt for a lecturer to go and look, not a
# classification anyone should act on automatically.
AT_RISK_EXAM_BELOW = 50
AT_RISK_ACCURACY_BELOW = 0.5
AT_RISK_MIN_ATTEMPTS = 10
AT_RISK_IDLE_DAYS = 14
ACTIVE_WINDOW_DAYS = 7


# --- row fetching ----------------------------------------------------------

def _rows(query: str, params=None) -> list:
    with get_cursor() as cur:
        cur.execute(query, params)
        return [dict(row) for row in cur.fetchall()]


def _all_users() -> list:
    return _rows("SELECT uid, email, display_name, role, created_at FROM users")


def _all_attempts() -> list:
    return _rows(
        "SELECT user_id, module_id, question_id, source, correct, "
        "misconception_id, answer_given, tier, created_at FROM attempts"
    )


def _all_exam_attempts() -> list:
    return _rows(
        "SELECT user_id, module_id, correct_count, total_count, percent, "
        "passed, stars_awarded, created_at FROM exam_attempts"
    )


def _all_exercise_completions() -> list:
    return _rows(
        "SELECT user_id, module_id, question_id, stars_awarded, completed_at "
        "FROM exercise_completions"
    )


def _all_challenge_completions() -> list:
    return _rows(
        "SELECT user_id, challenge_id, stars_awarded, completed_at "
        "FROM challenge_completions"
    )


def _all_section_completions() -> list:
    return _rows(
        "SELECT user_id, module_id, section_id, completed_at "
        "FROM module_section_completions"
    )


# --- small helpers ---------------------------------------------------------

def _now() -> datetime:
    return datetime.now(timezone.utc)


def _to_dt(value):
    """Normalise a timestamp from either backend to an aware datetime, or None.

    Postgres hands back a datetime; the JSON fallback hands back the ISO
    string it wrote. Naive datetimes are assumed UTC rather than dropped, so a
    database configured without timezones still sorts and compares correctly.
    """
    if value is None:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
    except (TypeError, ValueError):
        return None
    return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)


def _iso(value):
    dt = _to_dt(value)
    return dt.isoformat() if dt else None


def _pct(numerator, denominator) -> int:
    if not denominator:
        return 0
    return round(100 * numerator / denominator)


def _avg(values):
    """Mean of a list, or None for an empty one.

    None rather than 0 throughout: "no student has sat this exam yet" and
    "every student scored zero" are completely different things for a
    lecturer, and collapsing them into 0% would misreport a brand-new module
    as a catastrophic one.
    """
    values = [v for v in values if v is not None]
    if not values:
        return None
    return round(sum(values) / len(values), 1)


def _display_name(user: dict) -> str:
    name = user.get("display_name")
    if name:
        return name
    email = user.get("email")
    if email:
        return email.split("@")[0]
    return "Student " + str(user.get("uid", ""))[-6:]


def is_guest(uid: str) -> bool:
    return str(uid or "").startswith("guest-")


class _Snapshot:
    """One consistent read of every table the dashboard needs.

    Built once per request and threaded through the view functions, so a page
    showing six panels issues six SELECTs rather than six per panel -- and so
    every panel on it describes the same moment.
    """

    def __init__(self, include_guests: bool = False):
        users = _all_users()
        if not include_guests:
            users = [u for u in users if not is_guest(u["uid"])]
        self.users = sorted(users, key=_display_name)
        self.user_ids = {u["uid"] for u in self.users}
        self.users_by_id = {u["uid"]: u for u in self.users}

        keep = self.user_ids.__contains__
        self.attempts = [a for a in _all_attempts() if keep(a["user_id"])]
        self.exams = [e for e in _all_exam_attempts() if keep(e["user_id"])]
        self.completions = [c for c in _all_exercise_completions() if keep(c["user_id"])]
        self.challenges = [c for c in _all_challenge_completions() if keep(c["user_id"])]
        self.sections = [s for s in _all_section_completions() if keep(s["user_id"])]

        # Without these, every per-student figure would re-scan the whole
        # event log -- O(students x attempts), which on a full class is tens
        # of millions of comparisons to render one page. Bucketing once here
        # makes the same page linear in the number of events.
        self.attempts_by_user = self._bucket(self.attempts, "user_id")
        self.exams_by_user = self._bucket(self.exams, "user_id")
        self.completions_by_user = self._bucket(self.completions, "user_id")
        self.challenges_by_user = self._bucket(self.challenges, "user_id")
        self.sections_by_user = self._bucket(self.sections, "user_id")
        self.attempts_by_module = self._bucket(self.attempts, "module_id")
        self.exams_by_module = self._bucket(self.exams, "module_id")
        self.sections_by_module = self._bucket(self.sections, "module_id")

        self.modules = admin_content.list_modules()
        self.module_titles = {m["id"]: m["title"] for m in self.modules}
        self.module_order = [m["id"] for m in self.modules]

    @staticmethod
    def _bucket(rows: list, key: str) -> dict:
        out = defaultdict(list)
        for row in rows:
            out[row[key]].append(row)
        return out

    def title(self, module_id: str) -> str:
        return self.module_titles.get(module_id, module_id)

    def last_active(self, uid: str):
        stamps = [_to_dt(a.get("created_at")) for a in self.attempts_by_user.get(uid, ())]
        stamps += [_to_dt(s.get("completed_at")) for s in self.sections_by_user.get(uid, ())]
        stamps = [s for s in stamps if s]
        return max(stamps) if stamps else None


# --- per-student aggregation ----------------------------------------------

def _student_row(snap: _Snapshot, user: dict) -> dict:
    uid = user["uid"]
    attempts = snap.attempts_by_user.get(uid, [])
    exams = snap.exams_by_user.get(uid, [])
    sections = snap.sections_by_user.get(uid, [])
    completions = snap.completions_by_user.get(uid, [])
    challenges = snap.challenges_by_user.get(uid, [])

    required = {mid: set(admin_content.gating_sections(mid)) for mid in snap.module_order}
    total_sections = sum(len(ids) for ids in required.values())
    done_sections = len({
        (s["module_id"], s["section_id"]) for s in sections
        if s["section_id"] in required.get(s["module_id"], ())
    })

    by_module = defaultdict(set)
    for s in sections:
        if s["section_id"] in required.get(s["module_id"], ()):
            by_module[s["module_id"]].add(s["section_id"])
    modules_completed = sum(
        1 for module_id in snap.module_order
        if required[module_id].issubset(by_module.get(module_id, set()))
    )

    # Best sitting per module, then the mean across modules attempted -- not
    # the mean across every sitting, which would let a student drag their own
    # average down simply by practising the exam more often.
    best_by_module = {}
    for exam in exams:
        module_id = exam["module_id"]
        best_by_module[module_id] = max(best_by_module.get(module_id, 0), exam["percent"])
    exam_avg = _avg(list(best_by_module.values()))

    graded = [a for a in attempts if a["source"] in ("bank", "engine", "exam")]
    accuracy = (sum(1 for a in graded if a["correct"]) / len(graded)) if graded else None
    practice_percent = round(accuracy * 100, 1) if accuracy is not None else None

    if exam_avg is None and practice_percent is None:
        overall = None
    elif exam_avg is None:
        overall = practice_percent
    elif practice_percent is None:
        overall = exam_avg
    else:
        overall = round(EXAM_WEIGHT * exam_avg + PRACTICE_WEIGHT * practice_percent, 1)

    stars = (sum(c["stars_awarded"] or 0 for c in completions)
             + sum(c["stars_awarded"] or 0 for c in challenges))
    last = snap.last_active(uid)
    idle_days = (_now() - last).days if last else None
    progress_percent = _pct(done_sections, total_sections)

    reasons = []
    if exam_avg is not None and exam_avg < AT_RISK_EXAM_BELOW:
        reasons.append("exam average below %d%%" % AT_RISK_EXAM_BELOW)
    if accuracy is not None and len(graded) >= AT_RISK_MIN_ATTEMPTS and accuracy < AT_RISK_ACCURACY_BELOW:
        reasons.append("under %d%% accuracy over %d+ answers"
                       % (round(AT_RISK_ACCURACY_BELOW * 100), AT_RISK_MIN_ATTEMPTS))
    if idle_days is not None and idle_days >= AT_RISK_IDLE_DAYS and progress_percent < 100:
        reasons.append("no activity for %d days" % idle_days)

    return {
        "uid": uid,
        "name": _display_name(user),
        "email": user.get("email"),
        "role": user.get("role") or "student",
        "progress_percent": progress_percent,
        "modules_completed": modules_completed,
        "modules_total": len(snap.module_order),
        "exam_avg": exam_avg,
        "practice_percent": practice_percent,
        "overall": overall,
        "stars": stars,
        "attempts": len(graded),
        "exercises_completed": len(completions),
        "challenges_completed": len(challenges),
        "exam_sittings": len(exams),
        "last_active": _iso(last),
        "idle_days": idle_days,
        "at_risk": bool(reasons),
        "risk_reasons": reasons,
    }


def student_rows(include_guests: bool = False) -> list:
    snap = _Snapshot(include_guests)
    return [_student_row(snap, user) for user in snap.users]


# --- dashboard views -------------------------------------------------------

def overview(include_guests: bool = False) -> dict:
    snap = _Snapshot(include_guests)
    rows = [_student_row(snap, user) for user in snap.users]
    active_cutoff = _now() - timedelta(days=ACTIVE_WINDOW_DAYS)

    def active(row):
        last = _to_dt(row["last_active"])
        return bool(last and last >= active_cutoff)

    module_stats = []
    for module_id in snap.module_order:
        m_attempts = snap.attempts_by_module.get(module_id, [])
        m_exams = snap.exams_by_module.get(module_id, [])
        m_sections = snap.sections_by_module.get(module_id, [])
        started = {a["user_id"] for a in m_attempts} | {s["user_id"] for s in m_sections}
        required = set(admin_content.gating_sections(module_id))
        gating_by_user = defaultdict(set)
        for s in m_sections:
            if s["section_id"] in required:
                gating_by_user[s["user_id"]].add(s["section_id"])
        completed = {
            uid for uid, done in gating_by_user.items()
            if required.issubset(done)
        }
        graded = [a for a in m_attempts if a["source"] in ("bank", "engine", "exam")]
        best_by_student = {}
        for exam in m_exams:
            uid = exam["user_id"]
            best_by_student[uid] = max(best_by_student.get(uid, 0), exam["percent"])

        module_stats.append({
            "module_id": module_id,
            "title": snap.title(module_id),
            "students_started": len(started),
            "students_completed": len(completed),
            "completion_rate": _pct(len(completed), len(snap.users)),
            "exam_avg": _avg(list(best_by_student.values())),
            "accuracy": _pct(sum(1 for a in graded if a["correct"]), len(graded)) if graded else None,
            "attempts": len(graded),
        })

    # "Hardest" means lowest exam average among modules anyone has actually
    # sat. A module with no sittings is not hard, it is untouched, and
    # reporting it as the hardest topic would be the dashboard's most
    # confidently wrong statement.
    sat = [m for m in module_stats if m["exam_avg"] is not None]
    hardest = min(sat, key=lambda m: m["exam_avg"]) if sat else None

    return {
        "students": {
            "total": len(rows),
            "active": sum(1 for r in rows if active(r)),
            "at_risk": sum(1 for r in rows if r["at_risk"]),
            "completed_all": sum(1 for r in rows if r["modules_completed"] == r["modules_total"]
                                 and r["modules_total"] > 0),
        },
        "averages": {
            "overall": _avg([r["overall"] for r in rows]),
            "exam": _avg([r["exam_avg"] for r in rows]),
            "practice": _avg([r["practice_percent"] for r in rows]),
            "progress": _avg([r["progress_percent"] for r in rows]),
        },
        "totals": {
            "attempts": len(snap.attempts),
            "exercises_completed": len(snap.completions),
            "challenges_completed": len(snap.challenges),
            "exam_sittings": len(snap.exams),
            "stars": sum(r["stars"] for r in rows),
        },
        "modules": module_stats,
        "activity": activity_series(snap),
        "mark_distribution": mark_distribution(rows),
        "hardest_module": hardest,
        "misconceptions": _misconception_items(snap, limit=5),
        "recent_activity": recent_activity(snap, limit=15),
    }


# How far back the activity chart looks. Six weeks covers a term's worth of a
# course running weekly, which is the window a lecturer asks "is engagement
# holding up?" over.
ACTIVITY_WINDOW_DAYS = 42


def activity_series(snap: _Snapshot, days: int = ACTIVITY_WINDOW_DAYS) -> list:
    """Answers given per day, as a dense daily series.

    Dense, not sparse: a day on which nobody answered anything is returned as
    a zero rather than omitted. A chart built from only the days that have
    data draws a continuous line straight over a quiet week, which reads as
    steady engagement when the truth is the opposite.

    Only answers are counted, not exam sittings. Both could be drawn on one
    chart, but ~70 answers a day against ~5 sittings a day on a shared axis
    renders the sittings as a flat line on the floor, and giving them their
    own axis would put two different scales in one frame -- the single most
    misread thing a chart can do. Sittings are reported separately.
    """
    today = _now().date()
    start = today - timedelta(days=days - 1)

    counts = {start + timedelta(days=offset): 0 for offset in range(days)}
    for attempt in snap.attempts:
        when = _to_dt(attempt.get("created_at"))
        if when is None:
            continue
        day = when.date()
        if day in counts:
            counts[day] += 1

    return [
        {"date": day.isoformat(), "answers": count}
        for day, count in sorted(counts.items())
    ]


# Ten-point bands, the way a mark sheet is usually read. The top band is
# inclusive of 100, so a perfect mark has somewhere to go.
_MARK_BINS = [(0, 9), (10, 19), (20, 29), (30, 39), (40, 49),
              (50, 59), (60, 69), (70, 79), (80, 89), (90, 100)]


def mark_distribution(rows: list) -> list:
    """How the class's overall marks are spread, in ten-point bands.

    A class average alone hides its own shape: 60% means something very
    different for a cohort clustered at 60 than for one split between 30 and
    90, and only the second is a reason to change how a topic is taught.

    Students with no recorded mark are excluded rather than binned at zero --
    "has not been assessed" is not a score of nought.
    """
    marks = [row["overall"] for row in rows if row["overall"] is not None]
    return [
        {
            "label": f"{low}-{high}",
            "low": low,
            "high": high,
            "students": sum(1 for mark in marks if low <= mark <= high),
        }
        for low, high in _MARK_BINS
    ]


def recent_activity(snap: _Snapshot, limit: int = 15) -> list:
    events = []
    for a in snap.attempts:
        events.append({
            "at": _to_dt(a.get("created_at")),
            "user_id": a["user_id"],
            "kind": "answer",
            "detail": "%s %s in %s" % (
                "Correct" if a["correct"] else "Incorrect",
                a.get("question_id") or "practice question",
                snap.title(a["module_id"]),
            ),
        })
    for e in snap.exams:
        events.append({
            "at": _to_dt(e.get("created_at")),
            "user_id": e["user_id"],
            "kind": "exam",
            "detail": "Scored %d%% on the %s exam" % (e["percent"], snap.title(e["module_id"])),
        })
    for s in snap.sections:
        events.append({
            "at": _to_dt(s.get("completed_at")),
            "user_id": s["user_id"],
            "kind": "section",
            "detail": "Reached %s in %s" % (s["section_id"], snap.title(s["module_id"])),
        })

    events = [e for e in events if e["at"]]
    events.sort(key=lambda e: e["at"], reverse=True)
    return [
        {
            "at": e["at"].isoformat(),
            "name": _display_name(snap.users_by_id.get(e["user_id"], {"uid": e["user_id"]})),
            "uid": e["user_id"],
            "kind": e["kind"],
            "detail": e["detail"],
        }
        for e in events[:limit]
    ]


def student_detail(uid: str, include_guests: bool = True) -> dict:
    snap = _Snapshot(include_guests)
    user = snap.users_by_id.get(uid)
    if user is None:
        raise LookupError(uid)

    summary = _student_row(snap, user)
    attempts = snap.attempts_by_user.get(uid, [])
    exams = snap.exams_by_user.get(uid, [])

    modules = []
    for module_id in snap.module_order:
        sections = {
            s["section_id"] for s in snap.sections_by_user.get(uid, ())
            if s["module_id"] == module_id
        }
        required = set(admin_content.gating_sections(module_id))
        gating_done = sections & required
        m_attempts = [a for a in attempts if a["module_id"] == module_id]
        graded = [a for a in m_attempts if a["source"] in ("bank", "engine", "exam")]
        m_exams = [e for e in exams if e["module_id"] == module_id]
        best = max((e["percent"] for e in m_exams), default=None)
        latest = max(m_exams, key=lambda e: _to_dt(e.get("created_at")) or _now(), default=None)

        modules.append({
            "module_id": module_id,
            "title": snap.title(module_id),
            "sections_completed": sorted(sections),
            "progress_percent": _pct(len(gating_done), len(required)),
            "completed": required.issubset(gating_done),
            "attempts": len(graded),
            "accuracy": _pct(sum(1 for a in graded if a["correct"]), len(graded)) if graded else None,
            "exercises_completed": sum(
                1 for c in snap.completions_by_user.get(uid, ())
                if c["module_id"] == module_id
            ),
            "best_exam": best,
            "last_exam": latest["percent"] if latest else None,
            "exam_sittings": len(m_exams),
        })

    # Weak topics: modules this student has genuinely engaged with and is
    # still getting wrong. The attempt floor keeps a single unlucky answer in
    # a module they have barely opened out of the list.
    weak = sorted(
        [m for m in modules if m["accuracy"] is not None and m["attempts"] >= 5 and m["accuracy"] < 70],
        key=lambda m: m["accuracy"],
    )

    counts = defaultdict(lambda: {"count": 0, "modules": set(), "questions": set()})
    for a in attempts:
        if a["correct"] or not a.get("misconception_id"):
            continue
        entry = counts[a["misconception_id"]]
        entry["count"] += 1
        entry["modules"].add(snap.title(a["module_id"]))
        if a.get("question_id"):
            entry["questions"].add(a["question_id"])

    student_misconceptions = sorted(
        (
            {
                "id": key,
                "count": value["count"],
                "modules": sorted(value["modules"]),
                "questions": sorted(value["questions"])[:8],
            }
            for key, value in counts.items()
        ),
        key=lambda item: item["count"],
        reverse=True,
    )

    return {
        "student": summary,
        "modules": modules,
        "weak_topics": weak[:5],
        "misconceptions": student_misconceptions[:10],
        "exams": sorted(
            (
                {
                    "module_id": e["module_id"],
                    "title": snap.title(e["module_id"]),
                    "percent": e["percent"],
                    "correct_count": e["correct_count"],
                    "total_count": e["total_count"],
                    "passed": e["passed"],
                    "at": _iso(e.get("created_at")),
                }
                for e in exams
            ),
            key=lambda e: e["at"] or "",
            reverse=True,
        ),
        "recent": [
            e for e in recent_activity(snap, limit=200) if e["uid"] == uid
        ][:20],
    }


def marks(include_guests: bool = False) -> dict:
    """The marks table: one row per student, one column per module, plus totals."""
    snap = _Snapshot(include_guests)
    rows = []
    for user in snap.users:
        uid = user["uid"]
        summary = _student_row(snap, user)
        per_module = {}
        for module_id in snap.module_order:
            sittings = [e for e in snap.exams_by_user.get(uid, ()) if e["module_id"] == module_id]
            per_module[module_id] = max((e["percent"] for e in sittings), default=None)
        rows.append({
            "uid": uid,
            "name": summary["name"],
            "email": summary["email"],
            "per_module": per_module,
            "practice": summary["practice_percent"],
            "exam": summary["exam_avg"],
            "overall": summary["overall"],
            "progress_percent": summary["progress_percent"],
        })

    module_averages = {
        module_id: _avg([r["per_module"][module_id] for r in rows])
        for module_id in snap.module_order
    }

    return {
        "modules": [{"id": m, "title": snap.title(m)} for m in snap.module_order],
        "students": rows,
        "module_averages": module_averages,
        "class_average": _avg([r["overall"] for r in rows]),
        "weights": {"exam": EXAM_WEIGHT, "practice": PRACTICE_WEIGHT},
    }


def marks_csv(include_guests: bool = False) -> str:
    import csv
    import io

    data = marks(include_guests)
    buffer = io.StringIO()
    writer = csv.writer(buffer)
    module_ids = [m["id"] for m in data["modules"]]
    writer.writerow(
        ["Student", "Email", "Progress %"]
        + [m["title"] + " exam %" for m in data["modules"]]
        + ["Practice %", "Exam average %", "Overall %"]
    )
    for row in data["students"]:
        writer.writerow(
            [row["name"], row["email"] or "", row["progress_percent"]]
            + [row["per_module"].get(m) if row["per_module"].get(m) is not None else ""
               for m in module_ids]
            + [
                row["practice"] if row["practice"] is not None else "",
                row["exam"] if row["exam"] is not None else "",
                row["overall"] if row["overall"] is not None else "",
            ]
        )
    return buffer.getvalue()


def misconceptions(include_guests: bool = False, limit: int = 20) -> dict:
    """How often each catalogued misconception actually fires, and for whom.

    This is the view the misconception catalogue was always implying but could
    not support: `misconception_map` has been on every exercise from the
    start, and the grader has been resolving an id on every wrong answer, but
    nothing wrote that id down. It only produces numbers for answers given
    after the attempts table was deployed.
    """
    snap = _Snapshot(include_guests)
    return {"misconceptions": _misconception_items(snap, limit), "total_students": len(snap.users)}


def _misconception_items(snap: _Snapshot, limit: int) -> list:
    counts = defaultdict(lambda: {"count": 0, "students": set(), "modules": set(), "questions": set()})

    for a in snap.attempts:
        if a["correct"] or not a.get("misconception_id"):
            continue
        entry = counts[a["misconception_id"]]
        entry["count"] += 1
        entry["students"].add(a["user_id"])
        entry["modules"].add(a["module_id"])
        if a.get("question_id"):
            entry["questions"].add(a["question_id"])

    total_students = len(snap.users) or 1
    items = [
        {
            "id": key,
            "count": value["count"],
            "students_affected": len(value["students"]),
            "students_percent": _pct(len(value["students"]), total_students),
            "modules": sorted(snap.title(m) for m in value["modules"]),
            "questions": sorted(value["questions"])[:10],
        }
        for key, value in counts.items()
    ]
    items.sort(key=lambda item: (item["count"], item["students_affected"]), reverse=True)
    return items[:limit]


def question_analytics(module_id=None, include_guests: bool = False, limit: int = 25) -> dict:
    """Per-question difficulty, so a lecturer can find questions worth rewriting.

    Only the static bank appears here. Engine questions are generated fresh
    per attempt with a synthetic id, so there is no stable question to rank --
    they roll up into the module accuracy figures instead.
    """
    snap = _Snapshot(include_guests)
    stats = defaultdict(lambda: {"attempts": 0, "correct": 0, "students": set(),
                                 "misconceptions": defaultdict(int)})

    for a in snap.attempts:
        if a["source"] not in ("bank", "exam") or not a.get("question_id"):
            continue
        if module_id and a["module_id"] != module_id:
            continue
        entry = stats[(a["module_id"], a["question_id"])]
        entry["attempts"] += 1
        entry["correct"] += 1 if a["correct"] else 0
        entry["students"].add(a["user_id"])
        if not a["correct"] and a.get("misconception_id"):
            entry["misconceptions"][a["misconception_id"]] += 1

    items = []
    for (mod, question_id), entry in stats.items():
        top = sorted(entry["misconceptions"].items(), key=lambda kv: kv[1], reverse=True)
        items.append({
            "module_id": mod,
            "module_title": snap.title(mod),
            "question_id": question_id,
            "attempts": entry["attempts"],
            "correct_rate": _pct(entry["correct"], entry["attempts"]),
            "students": len(entry["students"]),
            "top_misconception": top[0][0] if top else None,
        })

    # Hardest first, but only where enough students have tried it for the rate
    # to mean anything; the rest follow so nothing is hidden outright.
    items.sort(key=lambda i: (i["attempts"] < 5, i["correct_rate"]))
    return {"questions": items[:limit]}
