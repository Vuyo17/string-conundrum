# Backend Template (Flask)

This backend is the Controller layer for String Conundrum.

## Endpoints

- `POST /api/visualize`
- `POST /api/execute`
- `POST /api/exercises/submit`
- `GET /api/progress/<user_id>`
- `GET /health`

## Run

```bash
python -m venv .venv
# Windows PowerShell:
.venv\Scripts\Activate.ps1
pip install -r requirements.txt
python run.py
```

## Testing

```bash
pytest
```
