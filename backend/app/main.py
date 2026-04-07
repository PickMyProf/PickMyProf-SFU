from fastapi import FastAPI, BackgroundTasks, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from app.database import get_connection

app = FastAPI(title="PickMyProf API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_seed_running = False
_external_seed_running = False


@app.get("/")
def root():
    return {"message": "PickMyProf backend is running on port 8000"}


@app.get("/health/db")
def health_db():
    try:
        conn = get_connection()
        conn.close()
        return {"status": "ok", "db": "connected"}
    except Exception as exc:
        raise HTTPException(status_code=500, detail=str(exc))


@app.post("/admin/seed")
def seed_database(background_tasks: BackgroundTasks):
    global _seed_running

    if _seed_running:
        raise HTTPException(status_code=409, detail="Official seed already in progress.")

    def _run():
        global _seed_running
        _seed_running = True
        try:
            from app.seed import run_seed
            run_seed()
        finally:
            _seed_running = False

    background_tasks.add_task(_run)
    return {"message": "Official SFU seed started."}


@app.post("/admin/seed/external")
def seed_external(background_tasks: BackgroundTasks):
    global _external_seed_running

    if _external_seed_running:
        raise HTTPException(status_code=409, detail="External seed already in progress.")

    def _run():
        global _external_seed_running
        _external_seed_running = True
        try:
            from app.seed_external import run_external_seed
            run_external_seed()
        finally:
            _external_seed_running = False

    background_tasks.add_task(_run)
    return {"message": "External scraped-data seed started."}
