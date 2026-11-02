import tempfile
import unittest
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import create_app

READING = dict(air_temperature_k=298.1, process_temperature_k=308.6,
               rotational_speed_rpm=1551, torque_nm=42.8, tool_wear_min=0, product_type="L")


class StageOneTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "test.db"
        self.client = TestClient(create_app(self.path))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def test_validation_and_no_fabricated_prediction(self):
        response = self.client.post("/readings/validate", json=READING)
        self.assertEqual(response.status_code, 200)
        self.assertIsNone(response.json()["probability"])
        for change in [{"product_type": "X"}, {"torque_nm": -1}, {"profile_id": "motor"}, {"failure": 1}]:
            self.assertEqual(self.client.post("/readings/validate", json=READING | change).status_code, 422)
        self.assertEqual(self.client.post("/readings/validate", json={}).status_code, 422)

    def test_idempotency_and_conflict(self):
        payload = {"event_id": "sample-1", "reading": READING}
        first = self.client.post("/incidents", json=payload).json()
        second = self.client.post("/incidents", json=payload).json()
        self.assertEqual(first["id"], second["id"])
        self.assertEqual(len(self.client.get("/incidents").json()), 1)
        payload["reading"] = READING | {"torque_nm": 50}
        self.assertEqual(self.client.post("/incidents", json=payload).status_code, 409)
        self.assertEqual(first["delivery_status"], "not_sent")

    def test_persistence_across_app_restart(self):
        self.client.post("/incidents", json={"event_id": "persistent", "reading": READING})
        with TestClient(create_app(self.path)) as restarted:
            self.assertEqual(restarted.get("/incidents").json()[0]["event_id"], "persistent")


if __name__ == "__main__":
    unittest.main()
