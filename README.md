# String Conundrum Template

This folder is a starter template for the String Conundrum project described in the proposal.

It includes:
- React frontend (View)
- Flask backend (Controller)
- Firebase-ready placeholders (Model for auth/progress)
- Frozen API contract docs
- CI workflow scaffold

## Production Deployment

Both halves run on the same UCT server, `string-1.cs.uct.ac.za` (137.158.61.235,
Ubuntu with Nginx + Gunicorn): Nginx serves the built React frontend and proxies
`/api` through to Flask, so the app is same-origin end to end.

✓ **Frontend:** http://string-1.cs.uct.ac.za (React + Vite, built to `frontend/dist`)
✓ **Backend:** Flask + Gunicorn behind Nginx on the same host

## Project Structure

```text
string-conundrum-template/
  .github/workflows/ci.yml
  backend/
  docs/
  frontend/
  shared/
  .env.example
  .gitignore
```

## Quick Start

### 1) Frontend

```bash
cd frontend
npm install
npm run dev
```

### 2) Backend

```bash
cd backend
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

### 3) API Integration

Set the frontend API base URL in `frontend/.env`:

```env
VITE_API_BASE_URL=http://127.0.0.1:5000
```

## Notes

- This is a scaffold, not the final production implementation.
- The backend includes stub endpoints so frontend-backend wiring can start immediately (Phase 1 goal).
- See `docs/api-contract.md` for the frozen request/response shape to guide parallel development.
