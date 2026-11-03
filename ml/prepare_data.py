"""Only the six deployment features may enter the model."""
from pathlib import Path
import numpy as np
import pandas as pd
from sklearn.model_selection import train_test_split

ROOT = Path(__file__).resolve().parents[1]
COLUMNS = {
    'Air temperature [K]': 'air_temperature_k',
    'Process temperature [K]': 'process_temperature_k',
    'Rotational speed [rpm]': 'rotational_speed_rpm',
    'Torque [Nm]': 'torque_nm', 'Tool wear [min]': 'tool_wear_min',
    'Type': 'product_type'}
FEATURES = list(COLUMNS.values())
SEED = 42


def load_data(path):
    frame = pd.read_csv(path, encoding='utf-8-sig')
    required = list(COLUMNS) + ['Machine failure', 'UDI', 'Product ID', 'TWF', 'HDF', 'PWF', 'OSF', 'RNF']
    if len(frame) != 10000 or not set(required).issubset(frame):
        raise ValueError('Expected the complete 10,000-row AI4I CSV with original column names.')
    if frame[required].isna().any().any() or not frame['UDI'].is_unique:
        raise ValueError('Missing values or duplicate record identifiers.')
    x = frame[list(COLUMNS)].rename(columns=COLUMNS)
    y = frame['Machine failure']
    if not x.product_type.isin(['L', 'M', 'H']).all() or not y.isin([0, 1]).all():
        raise ValueError('Unexpected product types or labels.')
    if not np.isfinite(x[FEATURES[:-1]].to_numpy(dtype=float)).all():
        raise ValueError('Non-finite readings.')
    return x, y.astype(int)


def split_indices(y):
    indices = np.arange(len(y))
    development, test = train_test_split(indices, test_size=0.15, stratify=y, random_state=SEED)
    fitting, validation = train_test_split(development, test_size=15/85, stratify=y.iloc[development], random_state=SEED)
    train, calibration = train_test_split(fitting, test_size=20/70, stratify=y.iloc[fitting], random_state=SEED)
    return dict(train=train, calibration=calibration, validation=validation, test=test)
