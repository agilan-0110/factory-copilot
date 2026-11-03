import tempfile
import unittest
from pathlib import Path
import numpy as np
from backend import database
from backend.prediction import Predictor
from backend.schemas import Reading, IncidentCreate
from ml.prepare_data import ROOT, FEATURES, load_data, split_indices


class MLTests(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.x, cls.y = load_data(ROOT/'data/ai4i2020.csv')

    def test_feature_allowlist_excludes_leakage(self):
        self.assertEqual(list(self.x), FEATURES)
        self.assertTrue(set(self.x).isdisjoint({'UDI','Product ID','Machine failure','TWF','HDF','PWF','OSF','RNF'}))

    def test_splits_disjoint_complete_reproducible(self):
        splits = split_indices(self.y)
        self.assertEqual(sorted(map(len, splits.values())), [1500,1500,2000,5000])
        combined = np.concatenate(list(splits.values()))
        self.assertEqual(len(set(combined)), len(self.y))
        for key, ids in splits.items():
            self.assertTrue(np.array_equal(ids, split_indices(self.y)[key]))

    def test_real_model_and_incident_snapshot(self):
        predictor = Predictor(ROOT/'ml/artifacts')
        self.assertIsNotNone(predictor.bundle)
        samples = predictor.document('samples.json')
        results = [predictor.assess(Reading(**sample['reading'])) for sample in samples]
        self.assertFalse(results[0]['flagged'])
        self.assertTrue(results[1]['flagged'])
        self.assertTrue(all(0 <= r['probability'] <= 1 for r in results))
        with tempfile.TemporaryDirectory() as folder:
            path = Path(folder)/'test.db'
            database.initialize(path)
            request = IncidentCreate(event_id='assessed', reading=Reading(**samples[1]['reading']))
            database.create(path, request, results[1])
            database.create(path, request, results[0])
            saved = database.list_incidents(path)[0]
            self.assertEqual(saved['probability'], results[1]['probability'])
            self.assertEqual(saved['model_version'], results[1]['model_version'])

    def test_scaler_fitted_on_training_only(self):
        predictor = Predictor(ROOT/'ml/artifacts')
        base = predictor.bundle['model'].estimator.estimator
        scaler = base.named_steps['features'].named_transformers_['numeric']
        train = split_indices(self.y)['train']
        np.testing.assert_allclose(scaler.mean_, self.x.iloc[train][FEATURES[:-1]].mean().to_numpy())

    def test_missing_artifact_has_no_invented_score(self):
        with tempfile.TemporaryDirectory() as folder:
            with self.assertRaises(RuntimeError):
                Predictor(folder).assess(Reading(**self.x.iloc[0].to_dict()))


if __name__ == '__main__':
    unittest.main()
