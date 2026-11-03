import json
import tempfile
import unittest
from pathlib import Path
from unittest.mock import patch
from fastapi.testclient import TestClient
from backend.prediction import Predictor
from backend.explanation import ModelExplainer
from backend.guidance import retrieve, CORPUS
from backend.schemas import Reading
from backend.main import create_app
from ml.prepare_data import ROOT


class EvidenceTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.predictor = Predictor(ROOT/'ml/artifacts')
        cls.reading = Reading(**cls.predictor.document('samples.json')[1]['reading'])
        cls.explanation = ModelExplainer(cls.predictor).explain(cls.reading)

    def test_real_shap_additivity(self):
        e = self.explanation
        self.assertEqual(e['status'], 'available')
        self.assertEqual(len(e['factors']), 6)
        self.assertAlmostEqual(e['base_value'] + sum(f['contribution'] for f in e['factors']), e['raw_output'], places=5)
        self.assertIn('not percentage points', e['output_scale'])

    def test_reference_integrity_and_scope(self):
        result = retrieve(self.explanation)
        self.assertEqual(result['status'], 'reference_only')
        self.assertFalse(result['equipment_match'])
        ids = set(result['evidence_ids'])
        self.assertTrue(ids)
        self.assertTrue(all(g['evidence_id'] in ids for g in result['inspection_guidance']))
        self.assertEqual(retrieve(self.explanation, scope='equipment_specific')['sources'], [])
        self.assertEqual(retrieve(self.explanation, profile_id='hydraulic_press')['sources'], [])

    def test_missing_and_duplicate_corpus(self):
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'corpus.json'
            self.assertEqual(retrieve(self.explanation, corpus_path=path)['status'], 'insufficient_evidence')
            corpus = json.loads(CORPUS.read_text())
            path.write_text(json.dumps(corpus + corpus[:1]))
            self.assertEqual(retrieve(self.explanation, corpus_path=path)['sources'], [])

    def test_explanation_failure_preserves_score(self):
        explainer = ModelExplainer(self.predictor)
        with patch('shap.TreeExplainer', side_effect=RuntimeError('unavailable')):
            self.assertEqual(explainer.explain(self.reading)['status'], 'unavailable')
        self.assertGreater(self.predictor.assess(self.reading)['probability'], 0)

    def test_irrelevant_features_abstain(self):
        e = dict(status='available', top_factors=[dict(feature='pressure', contribution=1)])
        self.assertEqual(retrieve(e)['status'], 'insufficient_evidence')

    def test_endpoint_and_persisted_evidence(self):
        with tempfile.TemporaryDirectory() as folder:
            with TestClient(create_app(Path(folder)/'test.db')) as client:
                body = {'reading': self.reading.model_dump()}
                response = client.post('/explain', json=body)
                self.assertEqual(response.status_code, 200)
                self.assertEqual(response.json()['explanation']['status'], 'available')
                unsupported = client.post('/explain', json=body | {'scope': 'equipment_specific'})
                self.assertEqual(unsupported.json()['guidance']['status'], 'insufficient_evidence')
                created = client.post('/incidents', json=body | {'event_id': 'evidence'}).json()
                self.assertEqual(created['explanation']['status'], 'available')
                saved = client.get('/incidents').json()[0]
                self.assertEqual(saved['guidance']['corpus_sha256'], created['guidance']['corpus_sha256'])
