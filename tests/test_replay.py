import tempfile
import unittest
from datetime import datetime, timezone, timedelta
from pathlib import Path
from backend import database, replay, workflow
from backend.schemas import Reading


class ReplayTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name)/'test.db'
        database.initialize(self.path)
        workflow.initialize(self.path)
        replay.initialize(self.path)
        self.reading = Reading(air_temperature_k=298, process_temperature_k=308,
            rotational_speed_rpm=1500, torque_nm=40, tool_wear_min=1, product_type='L')
        self.now = datetime.now(timezone.utc)

    def tearDown(self):
        self.temp.cleanup()

    def event(self, key, flagged=True, now=None):
        return replay.process(self.path, key, 'high_score' if flagged else 'low_score', self.reading,
            {'flagged': flagged, 'probability': .9 if flagged else .01, 'model_version': 'test', 'threshold': .21}, now=now or self.now)

    def test_normal_has_no_incident(self):
        self.assertEqual(self.event('normal', False)['action'], 'no_alert')
        self.assertEqual(database.list_incidents(self.path), [])

    def test_flagged_is_idempotent_and_links_open(self):
        first = self.event('first')
        self.assertEqual(first['action'], 'incident_created')
        self.assertTrue(self.event('first')['duplicate'])
        second = self.event('second')
        self.assertEqual(second['action'], 'existing_open_incident')
        self.assertEqual(first['incident_id'], second['incident_id'])
        self.assertEqual(len(database.list_incidents(self.path)), 1)
        self.assertEqual(database.list_incidents(self.path)[0]['delivery_status'], 'not_sent')

    def test_conflicting_event_rejected(self):
        self.event('repeat')
        with self.assertRaises(ValueError): self.event('repeat', False)

    def test_resolved_cooldown_then_new_incident(self):
        first = self.event('first')
        for command in (1, 4, 5):
            workflow.reply(self.path, first['incident_id'], command, str(command), 'simulated')
        self.assertEqual(self.event('soon', now=self.now+timedelta(seconds=10))['action'], 'cooldown')
        later = self.event('later', now=self.now+timedelta(seconds=301))
        self.assertEqual(later['action'], 'incident_created')
        self.assertNotEqual(first['incident_id'], later['incident_id'])

    def test_replay_survives_restart(self):
        self.event('first')
        replay.initialize(self.path)
        self.assertTrue(self.event('first')['duplicate'])
        self.assertEqual(len(replay.history(self.path)), 1)
