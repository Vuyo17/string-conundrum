# String Conundrum

An interactive, bilingual (English / isiXhosa) web application for learning
Python string manipulation. Students work through concept modules with guided
lessons, visualisations, adaptive practice and exams; lecturers manage content
and monitor cohort progress through a role-gated dashboard.

## Architecture

The application follows a Model–View–Controller split:

- **View** — React (Vite) single-page app. See `frontend/`.
- **Controller** — Flask REST API served by Gunicorn. See `backend/`.
- **Model** — Firebase Authentication for identity; PostgreSQL for users,
  progress, attempts and lecturer-authored content.

In production, Nginx serves the built frontend and reverse-proxies `/api` to
Flask on the same origin. Further detail is in `docs/architecture.md`, and the
lecturer dashboard is documented in `docs/admin-dashboard.md`.

## Project structure

```text
string-conundrum/
  backend/            Flask API, services, database schema and tests
  frontend/           React + Vite single-page application
  docs/               Architecture and lecturer-dashboard documentation
  shared/             Cross-cutting schemas shared by both halves
  .github/workflows/  CI and deployment pipelines
  .env.example        Reference environment variables
```

## Local development

### Frontend

```bash
cd frontend
npm install
npm run dev
```

By default the app calls `/api` on its own origin. To point it at a locally
running backend, set `VITE_API_BASE_URL` in `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:5000
```

### Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
# macOS / Linux:
# source .venv/bin/activate
pip install -r requirements.txt
python run.py
```

The backend can run against PostgreSQL (set `DATABASE_URL`) or, for local
development without a database, against a JSON state file by setting
`LOCAL_DB_FALLBACK=1`. See `backend/README.md` for database setup, the endpoint
list and test instructions.

Run the backend test suite with:

```bash
cd backend
pytest
```

## Deployment

Deployment to the UCT host is automated: pushing to the `production` branch
triggers the self-hosted GitHub Actions workflow
(`.github/workflows/deploy-self-hosted.yml`), which builds the frontend, syncs
the backend, applies database migrations and restarts the service.
