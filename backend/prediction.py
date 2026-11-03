"""Load only project-controlled artifacts, never user-uploaded pickle/joblib files."""
import json
from pathlib import Path


class Predictor:
    def __init__(self, directory):
        self.directory = Path(directory)
        self.bundle = None
        self.error = None
        try:
            if (self.directory / 'model.joblib').exists():
                import joblib
                self.bundle = joblib.load(self.directory / 'model.joblib')
        except Exception:
            self.error = 'Model artifact could not be loaded. Check ML dependencies and regenerate the artifact.'

    def assess(self, reading):
        if self.bundle is None:
            raise RuntimeError(self.error or 'Model not trained. Run python -m ml.train first.')
        import pandas as pd
        inputs = reading.model_dump()
        x = pd.DataFrame([{key: inputs[key] for key in self.bundle['features']}])
        score = float(self.bundle['model'].predict_proba(x)[0, 1])
        return dict(probability=score, threshold=self.bundle['threshold'],
            flagged=score >= self.bundle['threshold'], model_version=self.bundle['version'],
            context='Estimated failure-label probability on the synthetic AI4I benchmark; no time-to-failure claim.')

    def document(self, name):
        if self.bundle is None:
            raise RuntimeError(self.error or 'No trained model artifact available.')
        return json.loads((self.directory / name).read_text(encoding='utf-8'))
