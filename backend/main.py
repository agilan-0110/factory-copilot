import json
import os
import hmac
import re
from urllib.parse import parse_qs
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, Depends, Response
from backend import database, workflow, messaging
from backend.schemas import IncidentCreate, Reading, SimulatedReply

ROOT = Path(__file__).resolve().parents[1]


def create_app(db_path=None):
    path = Path(db_path or os.environ.get("FACTORY_DB_PATH", ROOT / "runtime/factory.db"))
    settings = messaging.config()

    def operator(request: Request):
        key = settings['FACTORY_API_KEY']
        if key:
            if not hmac.compare_digest(request.headers.get('X-API-Key', ''), key):
                raise HTTPException(401, 'Operator API key required.')
        elif request.client is None or request.client.host not in ('127.0.0.1', '::1', 'testclient'):
            raise HTTPException(403, 'Without an API key, operator access is local only.')

    @asynccontextmanager
    async def lifespan(app):
        database.initialize(path)
        workflow.initialize(path)
        yield

    app = FastAPI(title="Factory Copilot", version="0.2.0", lifespan=lifespan)

    @app.get("/health")
    def health():
        return {"status": "ok", "stage": 2, "model_ready": False,
                "messaging": "configured" if messaging.ready(settings) else "disabled"}

    @app.get("/profile", dependencies=[Depends(operator)])
    def profile():
        return json.loads((ROOT / "config/demo_machine.json").read_text(encoding="utf-8"))

    @app.post("/readings/validate", dependencies=[Depends(operator)])
    def validate(reading: Reading):
        return {"valid": True, "reading": reading.model_dump(), "probability": None,
                "assessment_status": "Model not trained; input validation only"}

    @app.get("/incidents", dependencies=[Depends(operator)])
    def incidents():
        return database.list_incidents(path)

    @app.post("/incidents", dependencies=[Depends(operator)])
    def create_incident(request: IncidentCreate):
        try:
            return database.create(path, request)
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.get('/incidents/{incident_id}/history', dependencies=[Depends(operator)])
    def history(incident_id: str):
        try:
            return workflow.history(path, incident_id)
        except LookupError as error:
            raise HTTPException(404, str(error)) from error

    @app.post('/incidents/{incident_id}/simulate-reply', dependencies=[Depends(operator)])
    def simulate(incident_id: str, body: SimulatedReply):
        try:
            return workflow.reply(path, incident_id, body.command, body.event_id, 'simulated')
        except LookupError as error:
            raise HTTPException(404, str(error)) from error
        except ValueError as error:
            raise HTTPException(409, str(error)) from error

    @app.post('/incidents/{incident_id}/notify', dependencies=[Depends(operator)])
    def notify(incident_id: str):
        try:
            return messaging.send(path, incident_id, settings)
        except LookupError as error:
            raise HTTPException(404, str(error)) from error
        except ValueError as error:
            raise HTTPException(409, str(error)) from error
        except (RuntimeError, ImportError) as error:
            raise HTTPException(503, str(error)) from error

    @app.post('/webhooks/whatsapp')
    async def whatsapp(request: Request):
        if not messaging.ready(settings):
            raise HTTPException(503, 'WhatsApp disabled.')
        if request.headers.get('content-type', '').split(';')[0] != 'application/x-www-form-urlencoded':
            raise HTTPException(415, 'Expected form encoded webhook.')
        data = bytearray()
        async for chunk in request.stream():
            data.extend(chunk)
            if len(data) > 16384:
                raise HTTPException(413, 'Webhook too large.')
        try:
            values = parse_qs(data.decode('utf-8'), keep_blank_values=True, max_num_fields=100)
        except (ValueError, UnicodeDecodeError):
            raise HTTPException(400, 'Malformed form.')
        if any(len(v) != 1 for v in values.values()):
            raise HTTPException(400, 'Repeated form fields are unsupported.')
        params = {k: v[0] for k, v in values.items()}
        from twilio.request_validator import RequestValidator
        if not RequestValidator(settings['TWILIO_AUTH_TOKEN']).validate(
                settings['TWILIO_WEBHOOK_URL'], params, request.headers.get('X-Twilio-Signature', '')):
            raise HTTPException(403, 'Invalid webhook signature.')
        if params.get('From') != settings['DEMO_WHATSAPP_TO'] or params.get('To') != settings['TWILIO_WHATSAPP_FROM'] or params.get('AccountSid') != settings['TWILIO_ACCOUNT_SID']:
            raise HTTPException(403, 'Unapproved sender, destination or account.')
        match = re.fullmatch(r'(A[0-9A-F]{12})\s+([1-5])', params.get('Body', '').strip())
        sid = params.get('MessageSid', '')
        if not match or not re.fullmatch(r'SM[0-9a-fA-F]{32}', sid):
            return Response('<Response/>', media_type='application/xml')
        try:
            workflow.reply(path, match[1], int(match[2]), sid, 'whatsapp')
        except (LookupError, ValueError):
            # Acknowledge invalid user commands without provoking provider retries.
            return Response('<Response/>', media_type='application/xml')
        return Response('<Response/>', media_type='application/xml')

    return app


app = create_app()
