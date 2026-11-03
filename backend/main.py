import json
from typing import Optional
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
from backend.rag import RAGAssistant, KNOWLEDGE_DOCS
from backend.schemas import IncidentCreate, Reading, SimulatedReply, ExplanationRequest, ReplayRequest
from backend.prediction import Predictor
from backend.explanation import ModelExplainer
from backend.guidance import retrieve

ROOT = Path(__file__).resolve().parents[1]

def update_env_file(updates: dict):
    env_path = ROOT / '.env'
    lines = []
    keys_written = set()
    if env_path.exists():
        for line in env_path.read_text(encoding='utf-8').splitlines():
            line_str = line.strip()
            if line_str and not line_str.startswith('#') and '=' in line_str:
                k, _ = line_str.split('=', 1)
                k = k.strip()
                if k in updates:
                    lines.append(f"{k}={updates[k]}")
                    keys_written.add(k)
                    continue
            lines.append(line)
    for k, v in updates.items():
        if k not in keys_written:
            lines.append(f"{k}={v}")
    env_path.write_text('\n'.join(lines) + '\n', encoding='utf-8')



def create_app(db_path=None):
    path = Path(db_path or os.environ.get("FACTORY_DB_PATH", ROOT / "runtime/factory.db"))
    def get_settings():
        return messaging.config()

    settings = get_settings()
    predictor = Predictor(os.environ.get('FACTORY_MODEL_DIR', ROOT / 'ml/artifacts'))
    explainer = ModelExplainer(predictor)
    fleet = IndustrialFleet()
    rag = RAGAssistant()

    def evidence(reading, scope='benchmark_reference'):
        result = predictor.assess(reading)
        result['explanation'] = explainer.explain(reading)
        result['model_evidence'] = result['explanation'].get('top_factors', [])
        result['guidance'] = retrieve(result['explanation'], scope, reading.profile_id)
        return result

    def operator(request: Request):
        if request.method == "OPTIONS":
            return
        key = get_settings()['FACTORY_API_KEY']
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
            fleet.tick_all(predictor, explainer, str(path), get_settings())
        return fleet.get_snapshot()

    @app.post('/fleet/tick', dependencies=[Depends(operator)])
    def tick_fleet():
        if not predictor.bundle:
            raise HTTPException(503, 'Model not trained.')
        return fleet.tick_all(predictor, explainer, str(path), get_settings())

    @app.post('/fleet/machines/{machine_id}/inject-fault', dependencies=[Depends(operator)])
    def inject_fault(machine_id: str, request: Request):
        mode = request.query_params.get('mode')
        fleet.inject_fault(machine_id, mode)
        return {'machine_id': machine_id, 'mode': mode}

    @app.post('/fleet/machines/{machine_id}/replace-tool', dependencies=[Depends(operator)])
    def replace_tool(machine_id: str):
        fleet.replace_tool(machine_id)
        return {'machine_id': machine_id, 'status': 'tool_replaced'}

    @app.post('/fleet/machines/{machine_id}/rearm', dependencies=[Depends(operator)])
    def rearm_machine(machine_id: str):
        fleet.rearm_machine(machine_id)
        return {'machine_id': machine_id, 'status': 'rearmed'}

    @app.get('/fleet/auto-trip-policy', dependencies=[Depends(operator)])
    def get_auto_trip_policy():
        return {'auto_trip_threshold': fleet.auto_trip_threshold, 'auto_trip_enabled': fleet.auto_trip_enabled}

    @app.post('/fleet/auto-trip-policy', dependencies=[Depends(operator)])
    async def set_auto_trip_policy(request: Request, enabled: Optional[bool] = None, threshold: Optional[float] = None):
        try:
            body = await request.json()
        except Exception:
            body = {}
        t = threshold if threshold is not None else float(body.get('threshold', 0.60))
        e = enabled if enabled is not None else bool(body.get('enabled', True))
        fleet.set_auto_trip_policy(t, e)
        return {'auto_trip_threshold': fleet.auto_trip_threshold, 'auto_trip_enabled': fleet.auto_trip_enabled}

    @app.post('/rag/chat', dependencies=[Depends(operator)])
    async def rag_chat(request: Request):
        body = await request.json()
        message = body.get('message', '').strip()
        if not message:
            raise HTTPException(400, 'Message cannot be empty.')
        machine_id = body.get('machine_id')
        api_key = body.get('api_key') or request.headers.get('x-gemini-api-key')
        machine_ctx = None
        if machine_id and machine_id in fleet.machines:
            m = fleet.machines[machine_id]
            machine_ctx = {
                'machine_id': m.machine_id,
                'name': m.name,
                'status': 'critical' if (m.last_assessment and m.last_assessment.get('probability', 0) >= 0.21) else ('warning' if m.tool_wear_min >= 190 else 'nominal'),
                'reading': m.current_reading().model_dump(),
                'tool_wear_min': m.tool_wear_min,
                'assessment': m.last_assessment,
                'active_incident_id': m.active_incident_id
            }
        fleet_ctx = fleet.get_snapshot()
        return rag.answer(message, machine_ctx, fleet_ctx, api_key=api_key)

    @app.get('/rag/config', dependencies=[Depends(operator)])
    def get_rag_config():
        configured_key = rag.get_configured_key()
        masked = (configured_key[:6] + '...' + configured_key[-4:]) if len(configured_key) > 10 else ('***' if configured_key else '')
        return {
            'has_api_key': bool(configured_key),
            'masked_key': masked,
            'mode': 'gemini_llm' if configured_key else 'offline_rag'
        }

    @app.post('/rag/config', dependencies=[Depends(operator)])
    async def set_rag_config(request: Request):
        body = await request.json()
        new_key = body.get('api_key', '').strip()
        update_env_file({'GEMINI_API_KEY': new_key})
        os.environ['GEMINI_API_KEY'] = new_key
        return get_rag_config()

    @app.get('/rag/knowledge', dependencies=[Depends(operator)])
    def get_knowledge():
        return KNOWLEDGE_DOCS

    @app.get("/health")
    def health():
        return {"status": "ok", "stage": 5, "model_ready": predictor.bundle is not None,
                "messaging": "configured" if messaging.ready(get_settings()) else "disabled"}

    @app.get("/profile", dependencies=[Depends(operator)])
    def profile():
        result = json.loads((ROOT / "config/demo_machine.json").read_text(encoding="utf-8"))
        if predictor.bundle:
            result.update(model_id=predictor.bundle['version'], alert_threshold=predictor.bundle['threshold'],
                          dataset='AI4I 2020 public mirror; synthetic benchmark')
        result.update(messaging_mode='configured' if messaging.ready(get_settings()) else 'disabled',
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

    @app.get('/whatsapp/status', dependencies=[Depends(operator)])
    def whatsapp_status():
        s = get_settings()
        is_ready = messaging.ready(s)
        missing = [k for k, v in s.items() if not v]
        return {
            'ready': is_ready,
            'account_sid': (s['TWILIO_ACCOUNT_SID'][:6] + '...') if s['TWILIO_ACCOUNT_SID'] else '',
            'auth_token_set': bool(s['TWILIO_AUTH_TOKEN']),
            'from_number': s['TWILIO_WHATSAPP_FROM'],
            'to_number': s['DEMO_WHATSAPP_TO'],
            'webhook_url': s['TWILIO_WEBHOOK_URL'],
            'factory_api_key_set': bool(s['FACTORY_API_KEY']),
            'missing': missing
        }

    @app.post('/whatsapp/config', dependencies=[Depends(operator)])
    async def save_whatsapp_config(request: Request):
        body = await request.json()
        env_path = ROOT / '.env'
        current = get_settings()
        if body.get('account_sid'): current['TWILIO_ACCOUNT_SID'] = body['account_sid'].strip()
        if body.get('auth_token'): current['TWILIO_AUTH_TOKEN'] = body['auth_token'].strip()
        if body.get('from_number'): current['TWILIO_WHATSAPP_FROM'] = body['from_number'].strip()
        if body.get('to_number'): current['DEMO_WHATSAPP_TO'] = body['to_number'].strip()
        if body.get('webhook_url'): current['TWILIO_WEBHOOK_URL'] = body['webhook_url'].strip()
        if body.get('api_key'): current['FACTORY_API_KEY'] = body['api_key'].strip()

        update_env_file({
            'TWILIO_ACCOUNT_SID': current['TWILIO_ACCOUNT_SID'],
            'TWILIO_AUTH_TOKEN': current['TWILIO_AUTH_TOKEN'],
            'TWILIO_WHATSAPP_FROM': current['TWILIO_WHATSAPP_FROM'],
            'DEMO_WHATSAPP_TO': current['DEMO_WHATSAPP_TO'],
            'TWILIO_WEBHOOK_URL': current['TWILIO_WEBHOOK_URL'],
            'FACTORY_API_KEY': current['FACTORY_API_KEY'],
        })
        return whatsapp_status()

    @app.post('/whatsapp/test-send', dependencies=[Depends(operator)])
    def test_whatsapp_send():
        s = get_settings()
        if not messaging.ready(s):
            raise HTTPException(400, 'WhatsApp is not fully configured yet. Please check all fields.')
        try:
            return messaging.test_send(s)
        except Exception as error:
            raise HTTPException(502, f'Twilio test send failed: {str(error)}')

    @app.post('/incidents/{incident_id}/notify', dependencies=[Depends(operator)])
    def notify(incident_id: str):
        try:
            return messaging.send(path, incident_id, get_settings())
        except LookupError as error:
            raise HTTPException(404, str(error)) from error
        except ValueError as error:
            raise HTTPException(409, str(error)) from error
        except (RuntimeError, ImportError) as error:
            raise HTTPException(503, str(error)) from error

    @app.post('/incidents/{incident_id}/refresh-delivery', dependencies=[Depends(operator)])
    def refresh_delivery(incident_id: str):
        try:
            return messaging.refresh_delivery(path, incident_id, get_settings())
        except ValueError as error:
            raise HTTPException(409, str(error)) from error
        except (RuntimeError, ImportError) as error:
            raise HTTPException(503, str(error)) from error

    @app.post('/webhooks/whatsapp')
    async def whatsapp(request: Request):
        s = get_settings()
        if not messaging.ready(s):
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
        if not RequestValidator(s['TWILIO_AUTH_TOKEN']).validate(
                s['TWILIO_WEBHOOK_URL'], params, request.headers.get('X-Twilio-Signature', '')):
            raise HTTPException(403, 'Invalid webhook signature.')
        if params.get('From') != s['DEMO_WHATSAPP_TO'] or params.get('To') != s['TWILIO_WHATSAPP_FROM'] or params.get('AccountSid') != s['TWILIO_ACCOUNT_SID']:
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
