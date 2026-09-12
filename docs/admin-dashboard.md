# Lecturer dashboard

A role-gated area of the same React app where a lecturer manages modules and
exercises and follows how the class is doing. Reached from the sidebar, which
shows a **Dashboard** item only for accounts with `role = 'admin'`.

---

## Getting access

A lecturer account is a `users` row with `role = 'admin'`. There are two ways
to get one, and the first exists to bootstrap the second.

**1. The `ADMIN_EMAILS` allowlist.** Set it in the backend's environment:

```
ADMIN_EMAILS=lecturer@uct.ac.za,tutor@uct.ac.za
```

Any account signing in with one of those addresses is promoted on its next
authenticated request. Matching is case-insensitive.

**2. From the dashboard.** Once one lecturer exists, they can promote anyone
else via `PATCH /api/admin/users/<uid>/role`. An admin cannot remove their own
admin access — otherwise the last lecturer could lock everyone out with no way
back short of editing the database.

Roles are a database column rather than a Firebase custom claim on purpose.
Claims only reach the backend when the client refreshes its ID token (up to an
hour later), and they do not exist at all under `LOCAL_DB_FALLBACK`, where the
point is running with no Firebase console access.

---

## What the dashboard shows

| Tab | Contents |
|---|---|
| **Overview** | Cohort headline figures, per-module completion and exam averages, the most common misconceptions, and a live activity feed. |
| **Students** | Searchable roster with progress, overall mark and an "at risk" flag. Click a name for a full per-module breakdown, exam history and that student's misconceptions. |
| **Marks** | One row per student, one column per module, plus practice, exam and overall columns. Exports to CSV. |
| **Analytics** | Misconceptions ranked by how often they actually fired, and the hardest questions in the bank. |
| **Modules** | Create, rename, reorder, publish/hide and archive modules. |
| **Content** | Create, edit and delete exercises in any module. |

The dashboard is English-only, unlike the student app. That is deliberate: the
student experience is bilingual because the bilingual experience *is* the
research question, while the lecturer surface is an admin tool whose
terminology ("misconception", "practice accuracy") has no settled isiXhosa
rendering to machine-translate into.

---

## What a lecturer can and cannot edit

| | Where it lives | Editable in the dashboard? |
|---|---|---|
| Module title, description, order, visibility | `modules` table | **Yes** |
| Exercises (prompt, options, answers, explanations, test cases) | `exercises` table (or `app/data/exercises.json` under the fallback) | **Yes** |
| Lesson prose: learn sections, callouts, worked examples, visualisers | `frontend/src/data/moduleContent/*.js`, compiled into the app bundle | **No** |
| isiXhosa translations of exercises | `*_xh` columns | **No** — but edits never destroy them |

Lesson content was scoped out rather than forgotten. Moving it into the
database means a block-structured editor, a migration of eight modules of
hand-authored content, and reworking the isiXhosa overlay merge in
`moduleContent/index.js` and the client-side search index — a change to the
working student experience far larger than the dashboard itself. A module
created in the dashboard therefore appears to students with its description
and its exercises, but no lesson pages until content is written for it in code.

The exercise editor is careful about two things that are easy to get wrong:

- **Renaming an option carries the answer with it.** Answers are stored as the
  option's text, not its position, so editing the option a question's answer
  points at would otherwise orphan the answer and make the question
  unanswerable.
- **Editing a question keeps its translation.** On the JSON bank the save
  merges rather than replaces, so fixing an English typo cannot delete the
  isiXhosa fields. On Postgres the `*_xh` columns are simply never named by the
  update.

An MCQ whose answer is not one of its own options is rejected on save. Nothing
downstream would catch that — the grader would just mark every student wrong.

---

## Where the numbers come from

Two tables were added because the data the dashboard reports did not exist
anywhere before it.

**`attempts`** — every graded answer, right or wrong, with the misconception id
where the grader resolved one. The pre-existing `exercise_completions` records
only the *first correct* answer per question, which is all the star economy
needs and useless for "which questions are students getting wrong". Writes
here never raise: a student must never lose a correct answer, a star or a
module unlock because an analytics insert failed.

**`exam_attempts`** — one row per completed exam paper. `ExamMode` used to
compute the percentage in the browser, show it once, and lose it on
navigation, so "what did this student score?" had no answer in the system.
Every sitting is kept, including retakes.

Both are populated from the moment this build is deployed. **Activity from
before then was never recorded and cannot be backfilled** — the dashboard will
be empty until students use the new build.

### How marks are calculated

- A module's mark is the student's **best** exam sitting. Retaking and doing
  worse never lowers a mark.
- A student's exam average is the mean across modules they have sat, not
  across every sitting — otherwise practising the exam more would drag their
  own average down.
- The overall mark weighs exams at 60% and practice accuracy at 40%
  (`EXAM_WEIGHT` / `PRACTICE_WEIGHT` in `services/analytics.py`), because
  practice is untimed, retryable and hint-assisted.
- A dash means *nothing recorded*, never zero. "No student has sat this exam"
  and "everyone scored zero" are different facts, and the dashboard never
  conflates them.

### At-risk flagging

A student is flagged on any one of: exam average below 50%, under 50% accuracy
across 10 or more answers, or no activity for 14 days with the course
unfinished. The thresholds are constants in `services/analytics.py`. They are
blunt on purpose — a prompt for a lecturer to go and look, not a
classification to act on automatically.

### Who counts as a student

Guest sessions (uids prefixed `guest-`) are excluded from every roster and
average by default; counting throwaway sessions would inflate enrolment and
drag the class average toward whatever a passer-by clicked. Add
`?include_guests=1` to any read endpoint to see them.

---

## Demo data

The dashboard is empty on a fresh deployment. To populate it with a plausible
cohort — a spread of strong, middling and struggling students, realistic
misconception patterns, and six weeks of activity:

```bash
cd backend
python -m db.seed_demo_data --students 40      # write
python -m db.seed_demo_data --clear            # remove it all again
```

The data is fake and labelled as such: every account is prefixed `demo-` and
named "(demo)", so nothing it writes can be mistaken for a real student's mark
in a screenshot or an export. The random seed is fixed, so re-running produces
the same cohort.

**Clear it before the system carries real student data.** Demo rows are
counted in every class average.

---

## API

Every route below is behind `require_admin`, which authenticates the caller and
then refuses any account whose role is not `admin`. Hiding the nav item from
students is a convenience, not the access control.

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/me` | Caller's uid, email and role (not admin-gated) |
| GET | `/api/admin/overview` | Cohort headline figures |
| GET | `/api/admin/students` | Roster (`?q=`, `?at_risk=1`) |
| GET | `/api/admin/students/<uid>` | One student in full |
| GET | `/api/admin/marks` | Marks table |
| GET | `/api/admin/marks.csv` | CSV export |
| GET | `/api/admin/misconceptions` | Misconception frequency |
| GET | `/api/admin/questions` | Per-question difficulty (`?module_id=`) |
| GET/POST | `/api/admin/modules` | List / create |
| PATCH/DELETE | `/api/admin/modules/<id>` | Update / archive |
| POST | `/api/admin/modules/reorder` | Reorder |
| GET | `/api/admin/modules/<id>/exercises` | List, **including answers** |
| PUT/DELETE | `/api/admin/modules/<id>/exercises/<qid>` | Save / delete |
| PATCH | `/api/admin/users/<uid>/role` | Promote or demote |

Deleting a module **archives** it. A hard delete would orphan every attempt,
completion and exam row referencing that module id — the lecturer's own
historical data, unrecoverable from a mis-click.

---

## Implementation notes

**Analytics aggregate in Python, not SQL.** `services/analytics.py` fetches
whole rows and reduces them in memory rather than issuing `GROUP BY` queries.
That costs more than SQL would at warehouse scale and is not measurable at
class scale, and it buys one code path that works identically against Postgres
and against the `LOCAL_DB_FALLBACK` JSON file — whose `_LocalCursor` is a
substring-dispatch stub that cannot execute an aggregate query. Without it the
dashboard would be undemonstrable on a laptop without Postgres. If the cohort
ever outgrows this, `analytics.py` is the only file that needs to change.

**The `modules` table seeds itself on first write.** Before a lecturer has
touched the dashboard the table is empty and `list_modules()` falls back to the
eight modules the app has always shipped. The first write of any kind seeds the
table from that default first — otherwise a lecturer renaming one module would
leave a table containing exactly one row, and the student app with one module.

**One long-lived connection in the seeder.** `get_cursor()` opens and closes a
connection per statement, which is right for a web request and catastrophic for
a seeder issuing thousands: 40 students took five and a half minutes before
batching and twenty-five seconds after.
