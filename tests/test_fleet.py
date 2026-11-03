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


if __name__ == '__main__':
    unittest.main()
