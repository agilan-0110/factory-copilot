import json
import os
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException
from backend import database
from backend.schemas import IncidentCreate, Reading

ROOT = Path(__file__).resolve().parents[1]


def create_app(db_path=None):
    path = Path(db_path or os.environ.get("FACTORY_DB_PATH", ROOT / "runtime/factory.db"))

    @asynccontextmanager
    async def lifespan(app):
        database.initialize(path)
        yield

    app = FastAPI(title="Factory Copilot", version="0.1.0", lifespan=lifespan)

    @app.get("/health")
    def health():
        return {"status": "ok", "stage": 1, "model_ready": False, "messaging": "disabled"}

    @app.get("/profile")
    def profile():
        return json.loads((ROOT / "config/demo_machine.json").read_text(encoding="utf-8"))

    @app.post("/readings/validate")
    def validate(reading: Reading):
        return {"valid": True, "reading": reading.model_dump(), "probability": None,
                "assessment_status": "Model not trained; input validation only"}

    @app.get("/incidents")
    def incidents():
        return database.list_incidents(path)

    @app.post("/incidents")
    def create_incident(request: IncidentCreate):
        try:
            return database.create(path, request)
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    return app


app = create_app()
