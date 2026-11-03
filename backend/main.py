import json
import os
import hmac
import re
from urllib.parse import parse_qs
from contextlib import asynccontextmanager
from pathlib import Path
from fastapi import FastAPI, HTTPException, Request, Depends, Response
from fastapi.middleware.cors import CORSMiddleware
from backend import database, workflow, messaging, replay
from backend.fleet import IndustrialFleet
from backend.schemas import IncidentCreate, Reading, SimulatedReply, ExplanationRequest, ReplayRequest
from backend.prediction import Predictor
from backend.explanation import ModelExplainer
from backend.guidance import retrieve

ROOT = Path(__file__).resolve().parents[1]


def create_app(db_path=None):
    path = Path(db_path or os.environ.get("FACTORY_DB_PATH", ROOT / "runtime/factory.db"))
    settings = messaging.config()
    predictor = Predictor(os.environ.get('FACTORY_MODEL_DIR', ROOT / 'ml/artifacts'))
    explainer = ModelExplainer(predictor)
    fleet = IndustrialFleet()

    def evidence(reading, scope='benchmark_reference'):
        result = predictor.assess(reading)
        result['explanation'] = explainer.explain(reading)
        result['model_evidence'] = result['explanation'].get('top_factors', [])
        result['guidance'] = retrieve(result['explanation'], scope, reading.profile_id)
        return result

    def operator(request: Request):
        if request.method == "OPTIONS":
            return
        key = settings['FACTORY_API_KEY']
        if key:
            if not hmac.compare_digest(request.headers.get('X-API-Key', ''), key):
                raise HTTPException(401, 'Operator API key required.')
        elif request.client is None or request.client.host not in ('127.0.0.1', '::1', 'testclient', 'localhost'):
            raise HTTPException(403, 'Without an API key, operator access is local only.')

    @asynccontextmanager
    async def lifespan(app):
        database.initialize(path)
        workflow.initialize(path)
        replay.initialize(path)
        yield

    app = FastAPI(title="Factory Copilot", version="0.5.0", lifespan=lifespan)
    app.add_middleware(
        CORSMiddleware,
        allow_origins=["*"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    @app.get('/fleet', dependencies=[Depends(operator)])
    def get_fleet():
        if predictor.bundle and not fleet.machines['M-01'].last_assessment:
            fleet.tick_all(predictor, explainer, str(path))
        return fleet.get_snapshot()

    @app.post('/fleet/tick', dependencies=[Depends(operator)])
    def tick_fleet():
        if not predictor.bundle:
            raise HTTPException(503, 'Model not trained.')
        return fleet.tick_all(predictor, explainer, str(path))

    @app.post('/fleet/machines/{machine_id}/inject-fault', dependencies=[Depends(operator)])
    def inject_fault(machine_id: str, request: Request):
        mode = request.query_params.get('mode')
        fleet.inject_fault(machine_id, mode)
        return {'machine_id': machine_id, 'mode': mode}

    @app.post('/fleet/machines/{machine_id}/replace-tool', dependencies=[Depends(operator)])
    def replace_tool(machine_id: str):
        fleet.replace_tool(machine_id)
        return {'machine_id': machine_id, 'status': 'tool_replaced'}

    @app.get("/health")
    def health():
        return {"status": "ok", "stage": 5, "model_ready": predictor.bundle is not None,
                "messaging": "configured" if messaging.ready(settings) else "disabled"}

    @app.get("/profile", dependencies=[Depends(operator)])
    def profile():
        result = json.loads((ROOT / "config/demo_machine.json").read_text(encoding="utf-8"))
        if predictor.bundle:
            result.update(model_id=predictor.bundle['version'], alert_threshold=predictor.bundle['threshold'],
                          dataset='AI4I 2020 public mirror; synthetic benchmark')
        result.update(messaging_mode='configured' if messaging.ready(settings) else 'disabled',
            replay_cooldown_seconds=300, guidance_sources=['UCI AI4I', 'Haas educational references'])
        return result

    @app.post("/readings/validate", dependencies=[Depends(operator)])
    def validate(reading: Reading):
        return {"valid": True, "reading": reading.model_dump(), "probability": None,
                "assessment_status": "Input validation only; use /predict for model assessment"}

    @app.get("/incidents", dependencies=[Depends(operator)])
    def incidents():
        return database.list_incidents(path)

    @app.post("/incidents", dependencies=[Depends(operator)])
    def create_incident(request: IncidentCreate):
        try:
            assessment = evidence(request.reading) if predictor.bundle else None
            return database.create(path, request, assessment)
        except ValueError as error:
            raise HTTPException(status_code=409, detail=str(error)) from error

    @app.post('/predict', dependencies=[Depends(operator)])
    def predict(reading: Reading):
        try:
            return predictor.assess(reading)
        except RuntimeError as error:
            raise HTTPException(503, str(error)) from error

    @app.post('/explain', dependencies=[Depends(operator)])
    def explain(body: ExplanationRequest):
        try:
            return evidence(body.reading, body.scope)
        except RuntimeError as error:
            raise HTTPException(503, str(error)) from error

    @app.get('/evaluation', dependencies=[Depends(operator)])
    def evaluation():
        try:
            return predictor.document('metrics.json')
        except RuntimeError as error:
            raise HTTPException(503, str(error)) from error

    @app.get('/samples', dependencies=[Depends(operator)])
    def samples():
        try:
            return predictor.document('samples.json')
        except RuntimeError as error:
            raise HTTPException(503, str(error)) from error

    @app.post('/replay', dependencies=[Depends(operator)])
    def replay_sample(body: ReplayRequest):
        try:
            sample = next(s for s in predictor.document('samples.json') if s['name'] == body.scenario)
            reading = Reading(**sample['reading'])
            return replay.process(path, body.event_id, body.scenario, reading, evidence(reading))
        except StopIteration as error:
            raise HTTPException(404, 'Recorded scenario unavailable.') from error
        except RuntimeError as error:
            raise HTTPException(503, str(error)) from error
        except ValueError as error:
            raise HTTPException(409, str(error)) from error

    @app.get('/replay', dependencies=[Depends(operator)])
    def replay_history():
        return replay.history(path)

    @app.get('/incidents/{incident_id}/notification-preview', dependencies=[Depends(operator)])
    def preview(incident_id: str):
        incident = next((i for i in database.list_incidents(path) if i['id'] == incident_id), None)
        if not incident:
            raise HTTPException(404, 'Incident not found.')
        return {'mode': 'preview_only', 'text': messaging.message(incident),
                'configured': messaging.ready(settings)}

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

    @app.post('/incidents/{incident_id}/refresh-delivery', dependencies=[Depends(operator)])
    def refresh_delivery(incident_id: str):
        try:
            return messaging.refresh_delivery(path, incident_id, settings)
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

    dist_path = ROOT / "frontend/dist"
    if dist_path.exists():
        from fastapi.staticfiles import StaticFiles
        app.mount("/", StaticFiles(directory=dist_path, html=True), name="static")

    return app


app = create_app()
