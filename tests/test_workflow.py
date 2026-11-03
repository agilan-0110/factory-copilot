import tempfile
import unittest
from pathlib import Path
from types import SimpleNamespace
from unittest.mock import Mock
from backend import database, workflow, messaging
from backend.schemas import IncidentCreate, Reading


class WorkflowTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / 'test.db'
        database.initialize(self.path)
        workflow.initialize(self.path)
        reading = Reading(air_temperature_k=298, process_temperature_k=308,
            rotational_speed_rpm=1500, torque_nm=40, tool_wear_min=1, product_type='L')
        self.incident = database.create(self.path, IncidentCreate(event_id='one', reading=reading))
        self.other = database.create(self.path, IncidentCreate(event_id='two', reading=reading))
        self.settings = dict(TWILIO_ACCOUNT_SID='ACtest', TWILIO_AUTH_TOKEN='test',
            TWILIO_WHATSAPP_FROM='whatsapp:+15005550006', DEMO_WHATSAPP_TO='whatsapp:+15005550007',
            TWILIO_WEBHOOK_URL='https://example.com/webhooks/whatsapp', FACTORY_API_KEY='test')

    def tearDown(self):
        self.temp.cleanup()

    def act(self, command, event=None):
        return workflow.reply(self.path, self.incident['id'], command, event or str(command), 'simulated')

    def test_lifecycle_keeps_finding_separate(self):
        self.assertEqual(self.act(1)['status'], 'acknowledged')
        self.assertEqual(self.act(3)['finding'], 'no_issue_found')
        final = self.act(5)
        self.assertEqual((final['status'], final['finding']), ('resolved', 'no_issue_found'))
        self.assertEqual(len(workflow.history(self.path, final['id'])), 3)
        self.assertEqual(workflow.history(self.path, self.other['id']), [])

    def test_invalid_order_does_not_mutate(self):
        for command in (2, 3, 4, 5):
            with self.assertRaises(ValueError): self.act(command)
        self.assertEqual(workflow.history(self.path, self.incident['id']), [])

    def test_duplicate_and_collision(self):
        self.act(1, 'repeat')
        self.act(1, 'repeat')
        with self.assertRaises(ValueError): self.act(2, 'repeat')
        with self.assertRaises(ValueError):
            workflow.reply(self.path, self.other['id'], 1, 'repeat', 'simulated')
        self.assertEqual(len(workflow.history(self.path, self.incident['id'])), 1)

    def test_unknown_incident(self):
        with self.assertRaises(LookupError):
            workflow.reply(self.path, 'missing', 1, 'one', 'simulated')

    def test_provider_send_is_once_and_not_claimed_delivered(self):
        client = Mock()
        client.messages.create.return_value = SimpleNamespace(sid='SMtest')
        result = messaging.send(self.path, self.incident['id'], self.settings, client)
        self.assertEqual(result['status'], 'provider_accepted')
        self.assertTrue(messaging.send(self.path, self.incident['id'], self.settings, client)['duplicate'])
        client.messages.create.assert_called_once()
        self.assertEqual(client.messages.create.call_args.kwargs['to'], self.settings['DEMO_WHATSAPP_TO'])

    def test_timeout_never_auto_resends(self):
        client = Mock()
        client.messages.create.side_effect = TimeoutError()
        with self.assertRaises(RuntimeError):
            messaging.send(self.path, self.incident['id'], self.settings, client)
        self.assertEqual(messaging.send(self.path, self.incident['id'], self.settings, client)['status'], 'unknown')
        client.messages.create.assert_called_once()

    def test_missing_credentials_does_not_reserve(self):
        client = Mock()
        with self.assertRaises(RuntimeError):
            messaging.send(self.path, self.incident['id'], {k: '' for k in self.settings}, client)
        client.messages.create.assert_not_called()
        with database.connect(self.path) as db:
            self.assertEqual(db.execute('SELECT COUNT(*) FROM notifications').fetchone()[0], 0)


if __name__ == '__main__':
    unittest.main()
