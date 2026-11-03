"""Run once per declared experiment; never select models using final test metrics."""
import argparse
import hashlib
import json
import platform
from pathlib import Path
import joblib
import numpy as np
import sklearn
from sklearn.calibration import CalibratedClassifierCV, calibration_curve
from sklearn.compose import ColumnTransformer
from sklearn.ensemble import HistGradientBoostingClassifier
from sklearn.frozen import FrozenEstimator
from sklearn.linear_model import LogisticRegression
from sklearn.metrics import average_precision_score, brier_score_loss, confusion_matrix, precision_score, recall_score, fbeta_score
from sklearn.pipeline import Pipeline
from sklearn.preprocessing import OneHotEncoder, StandardScaler
from ml.prepare_data import ROOT, FEATURES, SEED, load_data, split_indices


def metrics(y, probabilities, threshold):
    predicted = probabilities >= threshold
    fraction, mean = calibration_curve(y, probabilities, n_bins=8, strategy='quantile')
    return dict(average_precision=float(average_precision_score(y, probabilities)),
        prevalence=float(np.mean(y)), precision=float(precision_score(y, predicted, zero_division=0)),
        recall=float(recall_score(y, predicted, zero_division=0)),
        brier_score=float(brier_score_loss(y, probabilities)),
        confusion_matrix=confusion_matrix(y, predicted, labels=[0, 1]).tolist(),
        threshold=float(threshold), sample_count=len(y),
        reliability=dict(mean_probability=mean.tolist(), observed_fraction=fraction.tolist()))


def select_threshold(y, probabilities):
    # Predeclared validation-only F2 objective; ties favour the higher threshold.
    grid = np.linspace(0.01, 0.99, 99)
    return float(max(grid, key=lambda t: (fbeta_score(y, probabilities >= t, beta=2, zero_division=0), t)))


def engineering_rule(x):
    """Partial UCI label-generating rules, not independent industrial validation."""
    power = x.torque_nm * x.rotational_speed_rpm * (2 * np.pi / 60)
    heat = ((x.process_temperature_k-x.air_temperature_k) < 8.6) & (x.rotational_speed_rpm < 1380)
    strain = x.tool_wear_min * x.torque_nm > x.product_type.map({'L':11000, 'M':12000, 'H':13000})
    return (heat | strain | (power < 3500) | (power > 9000)).to_numpy(dtype=float)


def train(csv, output, candidate):
    output = Path(output)
    if (output / 'metrics.json').exists():
        raise ValueError('Experiment already evaluated. Use a new output directory for a separately documented experiment.')
    x, y = load_data(csv)
    splits = split_indices(y)
    models = {'logistic_regression': LogisticRegression(max_iter=2000, random_state=SEED)}
    if candidate == 'xgboost':
        from xgboost import XGBClassifier
        models[candidate] = XGBClassifier(n_estimators=200, max_depth=3, learning_rate=0.05,
            subsample=1, colsample_bytree=1, n_jobs=1, random_state=SEED, eval_metric='logloss')
    else:
        models['hist_gradient_boosting'] = HistGradientBoostingClassifier(max_iter=200,
            max_leaf_nodes=15, learning_rate=0.05, early_stopping=False, random_state=SEED)
    fitted, validation, thresholds = {}, {}, {}
    for name, estimator in models.items():
        preprocessor = ColumnTransformer([
            ('numeric', StandardScaler(), FEATURES[:-1]),
            ('type', OneHotEncoder(handle_unknown='error', sparse_output=False), ['product_type'])])
        base = Pipeline([('features', preprocessor), ('classifier', estimator)])
        base.fit(x.iloc[splits['train']], y.iloc[splits['train']])
        calibrated = CalibratedClassifierCV(FrozenEstimator(base), method='sigmoid')
        calibrated.fit(x.iloc[splits['calibration']], y.iloc[splits['calibration']])
        probability = calibrated.predict_proba(x.iloc[splits['validation']])[:, 1]
        thresholds[name] = select_threshold(y.iloc[splits['validation']], probability)
        validation[name] = metrics(y.iloc[splits['validation']], probability, thresholds[name])
        fitted[name] = calibrated
    selected = max(validation, key=lambda name: (validation[name]['average_precision'], -validation[name]['brier_score']))
    # Selection and thresholds are now locked. Test data is first evaluated here.
    results = {name: metrics(y.iloc[splits['test']], model.predict_proba(x.iloc[splits['test']])[:, 1], thresholds[name])
               for name, model in fitted.items()}
    rule = metrics(y.iloc[splits['test']], engineering_rule(x.iloc[splits['test']]), 0.5)
    fingerprint = hashlib.sha256(Path(csv).read_bytes()).hexdigest()
    version = 'ai4i-' + selected + '-' + fingerprint[:10] + '-seed42-v1'
    report = dict(model_version=version, selected_model=selected, seed=SEED, dataset_sha256=fingerprint,
        selection='Validation average precision, then Brier score; F2 threshold selected on validation only.',
        split_method='Stratified random rows: 50% train / 20% calibration / 15% validation / 15% test. Not a machine or temporal holdout.',
        splits={key: dict(count=len(ids), failures=int(y.iloc[ids].sum())) for key, ids in splits.items()},
        validation=validation, test=results, engineering_rule=rule,
        rule_limitation='Partial reconstruction of published synthetic label rules; not calibrated probability or an independent industrial baseline.',
        candidate=candidate, threshold=thresholds[selected], features=FEATURES,
        provenance='Public GitHub mirror, blob 8548cc70c84635a6002eb0164a8c91eb4d8183e6; schema checked against UCI, not byte-verified against original.',
        limitations=['Synthetic benchmark only; not a future failure horizon.',
            'Random-row splitting may benefit from correlated synthetic operating conditions.',
            'Calibration uses only 20% of rows and does not establish field probabilities.',
            'Test set has few failures; estimates may vary across other splits.'],
        versions=dict(python=platform.python_version(), sklearn=sklearn.__version__))
    output.mkdir(parents=True, exist_ok=True)
    bundle = dict(model=fitted[selected], version=version, threshold=thresholds[selected], features=FEATURES)
    joblib.dump(bundle, output / 'model.joblib', compress=3)
    (output / 'metrics.json').write_text(json.dumps(report, indent=2), encoding='utf-8')
    (output / 'split_indices.json').write_text(json.dumps({k:v.tolist() for k,v in splits.items()}), encoding='utf-8')
    # Demonstration examples are chosen from validation, never test, by model output.
    ids = splits['validation']
    scores = fitted[selected].predict_proba(x.iloc[ids])[:, 1]
    examples = []
    for label, offset in [('low_score', int(np.argmin(scores))), ('high_score', int(np.argmax(scores)))]:
        index = int(ids[offset])
        examples.append(dict(name=label, row_number=index+1, source='AI4I validation split', reading=x.iloc[index].to_dict()))
    (output / 'samples.json').write_text(json.dumps(examples, indent=2), encoding='utf-8')
    print(json.dumps(dict(selected=selected, threshold=thresholds[selected], test=results[selected]), indent=2))


if __name__ == '__main__':
    parser = argparse.ArgumentParser()
    parser.add_argument('--csv', type=Path, default=ROOT/'data/ai4i2020.csv')
    parser.add_argument('--output', type=Path, default=ROOT/'ml/artifacts')
    parser.add_argument('--candidate', choices=['hist_gradient_boosting', 'xgboost'], default='hist_gradient_boosting')
    args = parser.parse_args()
    train(args.csv, args.output, args.candidate)
