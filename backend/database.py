import json
import sqlite3
from contextlib import contextmanager
from datetime import datetime, timezone
from pathlib import Path
from uuid import uuid4


@contextmanager
def connect(path):
    connection = sqlite3.connect(path, timeout=15)
    connection.row_factory = sqlite3.Row
    try:
        with connection:
            yield connection
    finally:
        connection.close()


def initialize(path):
    Path(path).parent.mkdir(parents=True, exist_ok=True)
    with connect(path) as db:
        db.execute("""CREATE TABLE IF NOT EXISTS incidents (
            id TEXT PRIMARY KEY, event_id TEXT UNIQUE NOT NULL,
            reading TEXT NOT NULL, created_at TEXT NOT NULL,
            status TEXT NOT NULL DEFAULT 'open', finding TEXT,
            delivery_status TEXT NOT NULL DEFAULT 'not_sent'
        )""")
        if 'assessment' not in {row['name'] for row in db.execute('PRAGMA table_info(incidents)')}:
            db.execute('ALTER TABLE incidents ADD COLUMN assessment TEXT')


def serialize(row):
    item = dict(row)
    item["reading"] = json.loads(item["reading"])
    assessment = json.loads(item.pop('assessment') or '{}')
    item.update(origin="manual_benchmark_demo", probability=None, model_version=None,
                model_evidence=[], guidance=None)
    item.update(assessment)
    return item


def create(path, request, assessment=None):
    snapshot = request.reading.model_dump()
    with connect(path) as db:
        db.execute("INSERT OR IGNORE INTO incidents (id,event_id,reading,created_at,assessment) VALUES (?,?,?,?,?)",
                   ("A" + uuid4().hex[:12].upper(), request.event_id,
                    json.dumps(snapshot, sort_keys=True), datetime.now(timezone.utc).isoformat(),
                    json.dumps(assessment) if assessment else None))
        row = db.execute("SELECT * FROM incidents WHERE event_id=?", (request.event_id,)).fetchone()
        if json.loads(row["reading"]) != snapshot:
            raise ValueError("This event ID already belongs to different readings. Start a new event.")
        return serialize(row)


def list_incidents(path):
    with connect(path) as db:
        return [serialize(row) for row in db.execute("SELECT * FROM incidents ORDER BY created_at DESC")]
