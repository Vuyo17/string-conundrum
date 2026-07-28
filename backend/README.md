# Backend Template (Flask)

This backend is the Controller layer for String Conundrum.

## Endpoints

- `POST /api/visualize`
- `POST /api/execute`
- `POST /api/exercises/submit` (auth required)
- `GET /api/exercises/<module_id>`
- `GET /api/challenges`
- `GET /api/challenges/<challenge_id>/solution`
- `POST /api/challenges/run` (auth required)
- `GET /api/progress/<user_id>` (auth required)
- `GET /api/leaderboard`
- `GET /health`

## Database (PostgreSQL)

Exercises, challenges, users, and progress/leaderboard data live in Postgres.
Set `DATABASE_URL` (see `.env.example`) before running the app or the
migration script, e.g.:

```
DATABASE_URL=postgresql://string_conundrum_app:PASSWORD@127.0.0.1:5432/string_conundrum
```

Set up a fresh database:

```bash
psql "$DATABASE_URL" -f db/schema.sql
python db/migrate_json_to_db.py   # seeds exercises.json/challenges.json content; safe to re-run
```

## Run

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python wsgi.py
```

## Testing

```bash
pytest
```
