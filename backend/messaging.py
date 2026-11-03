import os
import re
from pathlib import Path
from backend import workflow


def config():
    env_file = Path('.env')
    loaded = {}
    if env_file.exists():
        try:
            for line in env_file.read_text(encoding='utf-8').splitlines():
                line = line.strip()
                if line and not line.startswith('#') and '=' in line:
                    k, v = line.split('=', 1)
                    loaded[k.strip()] = v.strip().strip("'\"")
        except Exception:
            pass
    res = {}
    for key in ('TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM',
                'DEMO_WHATSAPP_TO', 'TWILIO_WEBHOOK_URL', 'FACTORY_API_KEY'):
        if key in os.environ:
            res[key] = os.environ[key]
        else:
            res[key] = loaded.get(key, '')
    return res


def ready(settings):
    return all(settings.values()) and all(re.fullmatch(r'whatsapp:\+[1-9][0-9]{7,14}', settings[k])
        for k in ('TWILIO_WHATSAPP_FROM', 'DEMO_WHATSAPP_TO')) and settings['TWILIO_WEBHOOK_URL'].startswith('https://')


def message(incident):
    alert = incident['id']
    score = incident.get('probability')
    assessment = ('No trained model or failure probability.' if score is None else
        f"Benchmark failure-label probability: {score:.1%}. Threshold: {incident['threshold']:.1%}. Not a future failure forecast.")
    factors = incident.get('model_evidence') or []
    factor_text = ', '.join(item['feature'] for item in factors[:3]) or 'Unavailable'
    return (f'Factory Copilot DEMO | {alert}\nProfile: ai4i-demo-v1\n'
            f'Synthetic benchmark demo incident. {assessment}\n'
            f'Top model factors (not causes): {factor_text}\n'
            'No equipment-specific procedure validated. Review source evidence in the dashboard.\n'
            'Technician assessment required.\nReply with alert ID and command:\n'
            f'{alert} 1 = acknowledge\n{alert} 2 = issue confirmed\n'
            f'{alert} 3 = no issue found\n{alert} 4 = inconclusive\n'
            f'{alert} 5 = resolve after inspection')


def send(path, incident_id, settings, client=None):
    if not ready(settings):
        raise RuntimeError('WhatsApp is not configured. Use the labelled response simulator.')
    if client is None:
        from twilio.rest import Client
        from twilio.http.http_client import TwilioHttpClient
        client = Client(settings['TWILIO_ACCOUNT_SID'], settings['TWILIO_AUTH_TOKEN'],
                        http_client=TwilioHttpClient(timeout=10, max_retries=0))
    reserved, incident = workflow.reserve_notification(path, incident_id)
    if not reserved:
        return {'status': incident['delivery_status'], 'duplicate': True}
    try:
        response = client.messages.create(from_=settings['TWILIO_WHATSAPP_FROM'],
            to=settings['DEMO_WHATSAPP_TO'], body=message(incident))
    except Exception:
        # A timeout can occur after provider acceptance. Never retry automatically.
        workflow.finish_notification(path, incident_id, 'unknown')
        raise RuntimeError('Provider outcome unknown. Check Twilio logs; automatic resend is blocked.') from None
    workflow.finish_notification(path, incident_id, 'provider_accepted', response.sid)
    return {'status': 'provider_accepted', 'duplicate': False}


def refresh_delivery(path, incident_id, settings, client=None):
    from backend.database import connect
    if not ready(settings):
        raise RuntimeError('WhatsApp is not configured.')
    with connect(path) as db:
        row = db.execute('SELECT provider_sid FROM notifications WHERE incident_id=?', (incident_id,)).fetchone()
    if not row or not row['provider_sid']:
        raise ValueError('No provider message ID is available. Check Twilio logs for uncertain attempts.')
    if client is None:
        from twilio.rest import Client
        from twilio.http.http_client import TwilioHttpClient
        client = Client(settings['TWILIO_ACCOUNT_SID'], settings['TWILIO_AUTH_TOKEN'],
            http_client=TwilioHttpClient(timeout=10, max_retries=0))
    try:
        state = client.messages(row['provider_sid']).fetch().status
    except Exception:
        raise RuntimeError('Unable to refresh provider status; existing state preserved.') from None
    allowed = {'queued', 'sending', 'sent', 'delivered', 'read', 'failed', 'undelivered', 'canceled'}
    if state not in allowed:
        raise RuntimeError('Provider returned an unsupported status; existing state preserved.')
    workflow.finish_notification(path, incident_id, state, row['provider_sid'])
    return {'status': state, 'source': 'twilio_status_lookup'}


def test_send(settings, client=None):
    if not ready(settings):
        raise RuntimeError('WhatsApp is not fully configured.')
    if client is None:
        from twilio.rest import Client
        from twilio.http.http_client import TwilioHttpClient
        client = Client(settings['TWILIO_ACCOUNT_SID'], settings['TWILIO_AUTH_TOKEN'],
                        http_client=TwilioHttpClient(timeout=10, max_retries=0))
    test_body = (
        "🤖 Factory Copilot DEMO | WhatsApp Alert\n"
        "WhatsApp channel verified!\n"
        "10-Machine plant telemetry alerts and technician lifecycle commands (1-5) are active."
    )
    response = client.messages.create(
        from_=settings['TWILIO_WHATSAPP_FROM'],
        to=settings['DEMO_WHATSAPP_TO'],
        body=test_body
    )
    return {'status': 'provider_accepted', 'sid': response.sid}
