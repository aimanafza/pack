# PACK Backend

FastAPI + Beanie + MongoDB Atlas

## Setup

```bash
python -m venv venv
source venv/bin/activate
pip install -r requirements.txt
```

Create `backend/.env` with all required variables (see PACK_SPEC.md section 3).

## Run

```bash
uvicorn app.main:app --reload --port 8000
```

API runs at http://localhost:8000
