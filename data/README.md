# AI4I benchmark data

AI4I 2020 Predictive Maintenance Dataset (2020), UCI Machine Learning Repository.
DOI: https://doi.org/10.24432/C5HS5C
Original documentation: https://archive.ics.uci.edu/dataset/601/ai4i
License: CC BY 4.0, https://creativecommons.org/licenses/by/4.0/

This is synthetic data, not collected workshop readings. The six model inputs are temperature (K), process temperature (K), rotational speed (rpm), torque (Nm), tool wear (min), and product type. All failure-mode labels and both identifiers are excluded from model features.

The direct UCI download was blocked by DNS in the execution environment. The CSV was retrieved through GitHub from:
https://github.com/somayaahmed27/AI4I-2020-Predictive-Maintenance-Dataset/blob/main/AI4I%202020%20Predictive%20Maintenance%20Dataset.csv

Retrieved source blob: `8548cc70c84635a6002eb0164a8c91eb4d8183e6`. Newlines were normalized when saving. The training report records SHA-256 of the exact local CSV. Schema and row count were checked against UCI documentation; the mirror has not been byte-verified against the original download. No labels were changed or invented.

Split: seeded stratified random rows, 50% training, 20% calibration, 15% validation, 15% final test. Row identifiers in the split manifest are zero-based positional indices, never model inputs. These are not separate machines or a temporal holdout. Correlated synthetic operating conditions can make this benchmark easier than real deployment.

The rule baseline implements documented heat-dissipation, power and overstrain rules. It omits stochastic tool-wear/random failures. It is a partial reconstruction of the synthetic label generator, not independently validated equipment guidance.
