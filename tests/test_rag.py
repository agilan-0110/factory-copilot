import unittest
import tempfile
from pathlib import Path
from fastapi.testclient import TestClient
from backend.main import create_app
from backend.rag import RAGAssistant, KNOWLEDGE_DOCS


class RAGTests(unittest.TestCase):
    def setUp(self):
        self.temp = tempfile.TemporaryDirectory()
        self.path = Path(self.temp.name) / "test_rag.db"
        self.client = TestClient(create_app(self.path))
        self.client.__enter__()

    def tearDown(self):
        self.client.__exit__(None, None, None)
        self.temp.cleanup()

    def test_knowledge_base_retrieval(self):
        rag = RAGAssistant(KNOWLEDGE_DOCS)
        docs = rag.retrieve("What is Heat Dissipation Failure?")
        self.assertTrue(len(docs) > 0)
        self.assertEqual(docs[0]["id"], "DOC-FAIL-HDF")
        self.assertIn("Process_Temp - Air_Temp < 8.6 K", docs[0]["content"])

    def test_rag_chat_endpoint_grounded_answer(self):
        res = self.client.post("/rag/chat", json={"message": "What is the condition for tool wear failure?"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("reply", data)
        self.assertTrue(data["grounding_verified"])
        self.assertTrue(len(data["retrieved_sources"]) > 0)
        self.assertIn("DOC-FAIL-TWF", [s["id"] for s in data["retrieved_sources"]])

    def test_rag_chat_machine_telemetry_grounding(self):
        res = self.client.post("/rag/chat", json={"message": "What is happening with M-01?", "machine_id": "M-01"})
        self.assertEqual(res.status_code, 200)
        data = res.json()
        self.assertIn("M-01", data["reply"])
        self.assertEqual(data["machine_context"]["machine_id"], "M-01")

    def test_rag_config_endpoints(self):
        # GET config
        res = self.client.get("/rag/config")
        self.assertEqual(res.status_code, 200)
        cfg = res.json()
        self.assertIn("has_api_key", cfg)
        self.assertIn("mode", cfg)

        # POST config to set new key
        post_res = self.client.post("/rag/config", json={"api_key": "AIzaSyTestKey123456789"})
        self.assertEqual(post_res.status_code, 200)
        updated = post_res.json()
        self.assertTrue(updated["has_api_key"])
        self.assertEqual(updated["mode"], "gemini_llm")
        self.assertIn("AIzaSy", updated["masked_key"])


if __name__ == "__main__":
    unittest.main()
