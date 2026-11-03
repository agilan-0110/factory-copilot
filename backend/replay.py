"""Idempotent benchmark replay; sequence order is not machine history."""
import json
from datetime import datetime, timezone
from uuid import uuid4
from backend.database import connect, serialize


def initialize(path):
    with connect(path) as db:
        db.execute('''CREATE TABLE IF NOT EXISTS replay_events (
            event_id TEXT PRIMARY KEY, scenario TEXT NOT NULL,
            result TEXT NOT NULL, created_at TEXT NOT NULL)''')


def process(path, event_id, scenario, reading, assessment, cooldown_seconds=300, now=None):
    now = now or datetime.now(timezone.utc)
    snapshot = reading.model_dump()
    with connect(path) as db:
        db.execute('BEGIN IMMEDIATE')
        previous = db.execute('SELECT * FROM replay_events WHERE event_id=?', (event_id,)).fetchone()
        if previous:
            saved = json.loads(previous['result'])
            if previous['scenario'] != scenario or saved['reading'] != snapshot:
                raise ValueError('Replay event ID already belongs to a different sample.')
            return saved | {'duplicate': True}
        result = dict(event_id=event_id, scenario=scenario, reading=snapshot,
            assessment=assessment, incident_id=None, action='no_alert', duplicate=False)
        if assessment['flagged']:
            rows = db.execute('SELECT * FROM incidents ORDER BY created_at DESC').fetchall()
            same_profile = [r for r in rows if json.loads(r['reading']).get('profile_id') == reading.profile_id]
            open_incident = next((r for r in same_profile if r['status'] != 'resolved'), None)
            latest = same_profile[0] if same_profile else None
            if open_incident:
                result.update(action='existing_open_incident', incident_id=open_incident['id'])
            elif latest and (now-datetime.fromisoformat(latest['created_at'])).total_seconds() < cooldown_seconds:
                result.update(action='cooldown', incident_id=latest['id'])
            else:
                incident_id = 'A'+uuid4().hex[:12].upper()
                saved_assessment = assessment | {'origin': 'synthetic_replay'}
                db.execute('INSERT INTO incidents (id,event_id,reading,created_at,assessment) VALUES (?,?,?,?,?)',
                    (incident_id, 'replay-'+event_id, json.dumps(snapshot), now.isoformat(), json.dumps(saved_assessment)))
                result.update(action='incident_created', incident_id=incident_id)
        db.execute('INSERT INTO replay_events VALUES (?,?,?,?)',
            (event_id, scenario, json.dumps(result), now.isoformat()))
        return result


def history(path):
    with connect(path) as db:
        rows = db.execute('SELECT result,created_at FROM replay_events ORDER BY created_at DESC LIMIT 50').fetchall()
        return [json.loads(row['result']) | {'created_at': row['created_at']} for row in rows]
