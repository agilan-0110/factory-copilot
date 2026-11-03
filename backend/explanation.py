"""Explain raw classifier log-odds, never additive calibrated probabilities."""
class ModelExplainer:
    def __init__(self, predictor):
        self.predictor = predictor
        self.explainer = None

    def explain(self, reading):
        unavailable = dict(status='unavailable', factors=[], top_factors=[],
            limitations='Model explanations unavailable; no root cause established.')
        if self.predictor.bundle is None:
            return unavailable
        try:
            import numpy as np
            import pandas as pd
            import shap
            bundle = self.predictor.bundle
            base = bundle['model'].estimator.estimator
            transformer = base.named_steps['features']
            classifier = base.named_steps['classifier']
            inputs = reading.model_dump()
            matrix = transformer.transform(pd.DataFrame([{k:inputs[k] for k in bundle['features']}]))
            if self.explainer is None:
                self.explainer = shap.TreeExplainer(classifier, model_output='raw', feature_perturbation='tree_path_dependent')
            result = self.explainer(matrix)
            values = np.asarray(result.values).reshape(-1)
            baseline = float(np.asarray(result.base_values).reshape(-1)[0])
            raw = float(classifier.decision_function(matrix)[0]) if hasattr(classifier, 'decision_function') else float(classifier.predict(matrix, output_margin=True)[0])
            if not np.isfinite(values).all() or not np.isfinite(baseline) or not np.isfinite(raw):
                return unavailable
            if not np.isclose(baseline + values.sum(), raw, atol=1e-5):
                return unavailable
            grouped = list(values[:5]) + [float(values[5:].sum())]
            factors = [dict(feature=k, value=inputs[k], contribution=float(v),
                direction='raises' if v>0 else 'lowers' if v<0 else 'neutral') for k,v in zip(bundle['features'], grouped)]
            factors.sort(key=lambda f: abs(f['contribution']), reverse=True)
            return dict(status='available', method='SHAP TreeExplainer (tree-path-dependent)',
                shap_version=shap.__version__, model_version=bundle['version'],
                output_scale='Uncalibrated classifier log-odds (not percentage points)',
                base_value=baseline, raw_output=raw, contribution_sum=float(values.sum()),
                factors=factors, top_factors=factors[:3],
                limitations='Contributions explain the model, not physical root cause or deviation from safe operating ranges. Calibration is a separate sigmoid mapping.')
        except Exception:
            return unavailable
