import os
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.main import create_app
from test_stage1 import READING


class StageTwoApiTests(unittest.TestCase):
    def test_operator_auth_and_simulated_lifecycle(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {'FACTORY_API_KEY': 'test-key'}):
            with TestClient(create_app(Path(folder) / 'test.db')) as client:
                self.assertEqual(client.get('/incidents').status_code, 401)
                client.headers['X-API-Key'] = 'test-key'
                created = client.post('/incidents', json={'event_id': 'sample', 'reading': READING})
                self.assertEqual(created.status_code, 200)
                alert = created.json()['id']
                url = f'/incidents/{alert}/simulate-reply'
                self.assertEqual(client.post(url, json={'command': 5, 'event_id': 'early'}).status_code, 409)
                for command in (1, 4, 5):
                    response = client.post(url, json={'command': command, 'event_id': str(command)})
                    self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['finding'], 'inconclusive')
                self.assertEqual(response.json()['status'], 'resolved')
                self.assertEqual(len(client.get(f'/incidents/{alert}/history').json()), 3)

    def test_missing_services(self):
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, {
                'FACTORY_API_KEY': '', 'TWILIO_AUTH_TOKEN': ''}):
            with TestClient(create_app(Path(folder) / 'test.db')) as client:
                self.assertEqual(client.post('/webhooks/whatsapp').status_code, 503)
                self.assertEqual(client.post('/incidents/anything/notify').status_code, 503)

    def test_signed_webhook_sender_and_replay(self):
        try:
            from twilio.request_validator import RequestValidator
        except ImportError:
            self.skipTest('Twilio SDK not installed')
        settings = dict(FACTORY_API_KEY='test-key', TWILIO_AUTH_TOKEN='test-token',
            TWILIO_ACCOUNT_SID='AC' + 'a' * 32, TWILIO_WHATSAPP_FROM='whatsapp:+15005550006',
            DEMO_WHATSAPP_TO='whatsapp:+15005550007', TWILIO_WEBHOOK_URL='https://example.com/webhooks/whatsapp')
        with tempfile.TemporaryDirectory() as folder, patch.dict(os.environ, settings):
            with TestClient(create_app(Path(folder) / 'test.db')) as client:
                alert = client.post('/incidents', headers={'X-API-Key': 'test-key'},
                    json={'event_id': 'sample', 'reading': READING}).json()['id']
                form = dict(From=settings['DEMO_WHATSAPP_TO'], To=settings['TWILIO_WHATSAPP_FROM'],
                    AccountSid=settings['TWILIO_ACCOUNT_SID'], MessageSid='SM' + 'b' * 32, Body=alert + ' 1')
                self.assertEqual(client.post('/webhooks/whatsapp', data=form).status_code, 403)
                def post(payload):
                    signature = RequestValidator('test-token').compute_signature(settings['TWILIO_WEBHOOK_URL'], payload)
                    return client.post('/webhooks/whatsapp', data=payload, headers={'X-Twilio-Signature': signature})
                self.assertEqual(post(form | {'From': 'whatsapp:+15005550008'}).status_code, 403)
                self.assertEqual(post(form).status_code, 200)
                self.assertEqual(post(form).status_code, 200)
                trail = client.get(f'/incidents/{alert}/history', headers={'X-API-Key': 'test-key'}).json()
                self.assertEqual(len(trail), 1)
                self.assertEqual(trail[0]['source'], 'whatsapp')
