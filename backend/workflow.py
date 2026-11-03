"""Transactional lifecycle shared by simulated and authenticated provider replies."""
from datetime import datetime, timezone
from backend.database import connect, serialize


def initialize(path):
    with connect(path) as db:
        db.execute('''CREATE TABLE IF NOT EXISTS replies (
            event_key TEXT PRIMARY KEY, incident_id TEXT NOT NULL,
            command INTEGER NOT NULL, source TEXT NOT NULL, created_at TEXT NOT NULL,
            resulting_status TEXT NOT NULL, finding TEXT)''')
        db.execute('''CREATE TABLE IF NOT EXISTS notifications (
            incident_id TEXT PRIMARY KEY, state TEXT NOT NULL,
            provider_sid TEXT, created_at TEXT NOT NULL)''')


def reply(path, incident_id, command, event_key, source):
    if command not in range(1, 6):
        raise ValueError('Command must be 1 through 5.')
    key = source + ':' + event_key
    with connect(path) as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM incidents WHERE id=?', (incident_id,)).fetchone()
        if row is None:
            raise LookupError('Incident not found.')
        previous = db.execute('SELECT * FROM replies WHERE event_key=?', (key,)).fetchone()
        if previous:
            if previous['incident_id'] != incident_id or previous['command'] != command:
                raise ValueError('Reply identifier already used for another action.')
            return serialize(row)
        status, finding = row['status'], row['finding']
        if command == 1 and status == 'open':
            status = 'acknowledged'
        elif command in (2, 3, 4) and status == 'acknowledged':
            status = 'inspected'
            finding = {2: 'issue_confirmed', 3: 'no_issue_found', 4: 'inconclusive'}[command]
        elif command == 5 and status == 'inspected':
            status = 'resolved'
        else:
            raise ValueError('Action not allowed. Acknowledge, record an inspection, then resolve.')
        db.execute('UPDATE incidents SET status=?, finding=? WHERE id=?', (status, finding, incident_id))
        db.execute('INSERT INTO replies VALUES (?,?,?,?,?,?,?)',
                   (key, incident_id, command, source, datetime.now(timezone.utc).isoformat(), status, finding))
        return serialize(db.execute('SELECT * FROM incidents WHERE id=?', (incident_id,)).fetchone())


def history(path, incident_id):
    with connect(path) as db:
        if not db.execute('SELECT 1 FROM incidents WHERE id=?', (incident_id,)).fetchone():
            raise LookupError('Incident not found.')
        return [dict(row) for row in db.execute(
            'SELECT command,source,created_at,resulting_status,finding FROM replies WHERE incident_id=? ORDER BY created_at',
            (incident_id,))]


def reserve_notification(path, incident_id):
    with connect(path) as db:
        db.execute('BEGIN IMMEDIATE')
        row = db.execute('SELECT * FROM incidents WHERE id=?', (incident_id,)).fetchone()
        if not row:
            raise LookupError('Incident not found.')
        existing = db.execute('SELECT state FROM notifications WHERE incident_id=?', (incident_id,)).fetchone()
        if existing:
            return False, serialize(row)
        if row['status'] == 'resolved':
            raise ValueError('Cannot notify a resolved incident.')
        db.execute('INSERT INTO notifications VALUES (?,?,?,?)',
                   (incident_id, 'sending', None, datetime.now(timezone.utc).isoformat()))
        db.execute("UPDATE incidents SET delivery_status='sending' WHERE id=?", (incident_id,))
        return True, serialize(row)


def finish_notification(path, incident_id, state, sid=None):
    with connect(path) as db:
        db.execute('UPDATE notifications SET state=?, provider_sid=? WHERE incident_id=?', (state, sid, incident_id))
        db.execute('UPDATE incidents SET delivery_status=? WHERE id=?', (state, incident_id))
