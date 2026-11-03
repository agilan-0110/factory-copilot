import os
import re
from backend import workflow


def config():
    return {key: os.environ.get(key, '') for key in (
        'TWILIO_ACCOUNT_SID', 'TWILIO_AUTH_TOKEN', 'TWILIO_WHATSAPP_FROM',
        'DEMO_WHATSAPP_TO', 'TWILIO_WEBHOOK_URL', 'FACTORY_API_KEY')}


def ready(settings):
    return all(settings.values()) and all(re.fullmatch(r'whatsapp:\+[1-9][0-9]{7,14}', settings[k])
        for k in ('TWILIO_WHATSAPP_FROM', 'DEMO_WHATSAPP_TO')) and settings['TWILIO_WEBHOOK_URL'].startswith('https://')


def message(incident):
    alert = incident['id']
    return (f'Factory Copilot DEMO | {alert}\nProfile: ai4i-demo-v1\n'
            'Manual test incident. No trained model or failure probability.\n'
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
