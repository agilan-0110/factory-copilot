import unittest
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import create_app


class FleetTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "test_fleet.db"
        self.client = TestClient(create_app(self.path))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def test_fleet_has_ten_machines(self):
        res = self.client.get('/fleet')
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertEqual(len(data), 10)
        machine_ids = [m['machine_id'] for m in data]
        self.assertIn('M-01', machine_ids)
        self.assertIn('M-10', machine_ids)
        for m in data:
            self.assertIn('status', m)
            self.assertIn('reading', m)
            self.assertIn('tool_wear_min', m)
            self.assertEqual(m['reading']['profile_id'], 'ai4i-demo-v1')

    def test_fleet_continuous_tick(self):
        res1 = self.client.get('/fleet').json()
        wear1 = res1[0]['tool_wear_min']
        
        tick_res = self.client.post('/fleet/tick')
        self.assertEqual(tick_res.status_code, 200)
        res2 = tick_res.json()
        self.assertEqual(len(res2), 10)
        self.assertGreater(res2[0]['tool_wear_min'], wear1)

    def test_inject_fault_and_replace_tool(self):
        # Inject overheat fault
        self.client.post('/fleet/machines/M-03/inject-fault?mode=overheat')
        self.client.post('/fleet/tick')
        m3 = next(m for m in self.client.get('/fleet').json() if m['machine_id'] == 'M-03')
        self.assertEqual(m3['fault_mode'], 'overheat')
        self.assertGreater(m3['reading']['air_temperature_k'], 300.0)

        # Replace tool
        res = self.client.post('/fleet/machines/M-03/replace-tool')
        self.assertEqual(res.status_code, 200)
        m3_after = next(m for m in self.client.get('/fleet').json() if m['machine_id'] == 'M-03')
        self.assertEqual(m3_after['tool_wear_min'], 0.0)
        self.assertIsNone(m3_after['fault_mode'])

    def test_auto_trip_policy_get_and_set(self):
        # Default policy
        res = self.client.get('/fleet/auto-trip-policy')
        self.assertEqual(res.status_code, 200)
        policy = res.json()
        self.assertTrue(policy['auto_trip_enabled'])
        self.assertAlmostEqual(policy['auto_trip_threshold'], 0.60)

        # Update policy
        update_res = self.client.post('/fleet/auto-trip-policy', json={'enabled': True, 'threshold': 0.75})
        self.assertEqual(update_res.status_code, 200)
        updated = update_res.json()
        self.assertTrue(updated['auto_trip_enabled'])
        self.assertAlmostEqual(updated['auto_trip_threshold'], 0.75)

    def test_emergency_auto_trip_and_rearm(self):
        # Set threshold to 50%
        self.client.post('/fleet/auto-trip-policy', json={'enabled': True, 'threshold': 0.50})
        # Inject wear_spike on M-05 to drive failure risk high
        self.client.post('/fleet/machines/M-05/inject-fault?mode=wear_spike')
        
        # Tick fleet to evaluate risk and trip
        self.client.post('/fleet/tick')
        
        m5 = next(m for m in self.client.get('/fleet').json() if m['machine_id'] == 'M-05')
        self.assertTrue(m5.get('is_tripped'))
        self.assertEqual(m5.get('status'), 'tripped')
        self.assertEqual(m5['reading']['rotational_speed_rpm'], 0.0)
        self.assertEqual(m5['reading']['torque_nm'], 0.0)
        self.assertIsNotNone(m5.get('trip_reason'))

        # Check that subsequent ticks keep the spindle at 0 RPM
        self.client.post('/fleet/tick')
        m5_latched = next(m for m in self.client.get('/fleet').json() if m['machine_id'] == 'M-05')
        self.assertTrue(m5_latched.get('is_tripped'))
        self.assertEqual(m5_latched['reading']['rotational_speed_rpm'], 0.0)

        # Test re-arm
        rearm_res = self.client.post('/fleet/machines/M-05/rearm')
        self.assertEqual(rearm_res.status_code, 200)
        rearm_data = rearm_res.json()
        self.assertEqual(rearm_data.get('status'), 'rearmed')


if __name__ == '__main__':
    unittest.main()
