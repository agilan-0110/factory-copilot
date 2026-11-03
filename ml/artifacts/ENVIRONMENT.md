# Training environment

Python 3.10.11; scikit-learn 1.7.2; NumPy 2.2.6; pandas 2.3.3; SciPy 1.15.3; joblib 1.6.0.

Model format: trusted project-generated joblib. Never accept arbitrary serialized models from users. Retrain in a new experiment directory if runtime package compatibility changes. The exact dataset hash, splits, seed, selection policy and metrics are in the neighbouring JSON files.
