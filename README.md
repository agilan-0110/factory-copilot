# Factory Copilot

Stage 3: a trained benchmark classifier and evaluation view, four Streamlit tabs, a FastAPI input contract, a fixed profile, SQLite incidents, technician responses and an optional Twilio WhatsApp adapter.

**Synthetic benchmark demonstration only. Not validated for physical equipment.** Model scores come from a trained classifier. Default custom inputs are illustrative; the named low/high scenarios are actual validation rows selected using model scores. Incidents are manually opened, with the backend recording its own assessment and model version. WhatsApp is disabled unless explicitly configured and its send button is used. SHAP and inspection guidance are not implemented yet.

## Run on Windows (Python 3.10+)

From this project directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements-ml.txt
.\.venv\Scripts\python.exe -m uvicorn backend.main:app --host 127.0.0.1 --port 8000
```

In a second terminal in the same directory:

```powershell
.\.venv\Scripts\python.exe -m streamlit run ui/app.py --server.address 127.0.0.1 --server.port 8501
```

Open http://127.0.0.1:8501. API documentation: http://127.0.0.1:8000/docs.

Validate a reading, create a manual incident, and open Incidents. Repeated creation for the same validated event returns the same incident. Revalidating begins a new event. Backend errors are shown in the interface.

## Configuration and persistence

`config/demo_machine.json` declares the fixed profile and units. Temperatures are Kelvin. The API rejects unknown fields (including target labels), unknown profiles, missing readings, invalid product types and out-of-bounds values. Broad input bounds are sanity checks, not validated operating ranges.

The database defaults to `runtime/factory.db` and survives server restarts. Set `$env:FACTORY_DB_PATH` before starting the backend to change the location. Set `$env:FACTORY_API_URL` before starting Streamlit to change its API address. `.env.example` documents these variables; `.env` is not loaded automatically.

By default the app runs locally without credentials. Operator endpoints accept loopback clients only when no API key is configured. Before exposing the backend through an HTTPS tunnel, set a strong `FACTORY_API_KEY` in both backend and Streamlit environments. Operator requests then require the matching `X-API-Key` header. Never expose the Streamlit server publicly: it is an operator interface, not a public judging deployment. Stop servers with Ctrl+C. Use one backend instance with a persistent local disk.

## Stage 2 demo without credentials

1. Validate a reading and create a manual incident in Monitor.
2. In Incidents, expand it and select **Apply simulated response** to acknowledge.
3. Record one finding: issue confirmed, no issue found or inconclusive.
4. Resolve after inspection. The finding remains separate from resolution.
5. Open **Show audit trail**. Simulated and WhatsApp responses are labelled by source.

Commands `1` through `5` map to acknowledge, confirmed, no issue, inconclusive and resolve. Invalid order returns HTTP 409. Replayed event IDs cannot apply an action twice or target a different incident. Resolved incidents are immutable through this workflow. Feedback does not retrain any model.

## Optional WhatsApp setup

Set the environment variables documented in `.env.example` locally; do not commit secrets. `.env` files are not automatically loaded.

- `TWILIO_ACCOUNT_SID` and `TWILIO_AUTH_TOKEN`: your Twilio account credentials.
- `TWILIO_WHATSAPP_FROM`: sandbox sender, formatted `whatsapp:+<country code and number>`.
- `DEMO_WHATSAPP_TO`: the single approved participant, in the same format.
- `TWILIO_WEBHOOK_URL`: exact public HTTPS URL ending `/webhooks/whatsapp`.
- `FACTORY_API_KEY`: strong operator key, also supplied to Streamlit.

Join the Twilio WhatsApp sandbox from the approved recipient's phone. Follow the provider's sandbox conversation-window requirements before sending free-form demo text. Configure its incoming-message webhook to the exact URL above, using POST. Tunnel only the backend; keep Streamlit local. Restart services after changing environment variables.

The **Send WhatsApp demo alert** button sends only to the configured recipient, never a caller-supplied number. Reply with the exact alert ID and command, for example `A0123456789AB 1`. Incoming requests require a valid Twilio signature, matching account, approved sender and configured destination. Invalid commands are ignored with an empty TwiML response and do not change state.

Notification states are `not_sent`, `sending`, `provider_accepted` or `unknown`. Provider acceptance does **not** confirm delivery. This stage does not implement delivery-status callbacks. One send attempt is reserved per incident; repeated clicks do not send again. A crash or timeout can leave `sending` or `unknown`: inspect Twilio logs before any manual recovery. There is no automatic retry/reset endpoint. Exact event deduplication is implemented; cross-event cooldown policy is deferred until automatic model alerts exist.

Twilio reference: https://www.twilio.com/docs/whatsapp/sandbox and https://www.twilio.com/docs/usage/webhooks/webhooks-security.

## Stage 3 model and results

The checked-in trusted `ml/artifacts/model.joblib` is ready for inference after installing ML requirements. Do not load arbitrary uploaded joblib/pickle files. The shipped artifact uses scikit-learn 1.7.2; use the pinned version. `FACTORY_MODEL_DIR` can select another locally trusted experiment directory. Restart FastAPI after changing artifacts.

The training process fits preprocessing only on 5,000 training rows; sigmoid calibration uses a separate 2,000 rows. It selects between logistic regression and the tree candidate on 1,500 validation rows by average precision, with Brier score as a tie-breaker. Each model's alert threshold maximizes validation F2 over a predeclared 0.01–0.99 grid. Only then are 1,500 final test rows evaluated. No oversampling or target-label features are used.

XGBoost could not be installed in this environment. The actual tree candidate is scikit-learn histogram gradient boosting; the trainer also supports `--candidate xgboost` when that package is installed. This substitution is explicit, not an XGBoost result.

| Final test model | Average precision | Precision | Recall | Brier score |
|---|---:|---:|---:|---:|
| Logistic regression | 0.4413 | 0.3173 | 0.6471 | 0.02444 |
| Histogram gradient boosting (selected) | 0.8492 | 0.6615 | 0.8431 | 0.01115 |

Selected threshold: 0.21. Test failure prevalence: 3.4%. Confusion counts: TN 1427, FP 22, FN 8, TP 43. Average precision is step-weighted PR area, not a trapezoidal PR-AUC calculation. The reliability plot uses eight quantile bins and can obscure finer calibration errors.

**The published-rule baseline beats the selected ML classifier on this test split:** TN 1449, FP 0, FN 5, TP 46. Those rules partly reconstruct the synthetic label generator. We retain the learned model as a benchmark classification demonstration, not a claim that ML beats known engineering logic or is ready for plant deployment.

Reproduce in a new experiment directory (the trainer refuses to overwrite an evaluated experiment):

```powershell
.\.venv\Scripts\python.exe -m ml.train --output ml/reproduction
```

Do not use repeated final-test results to tune the model. To use a new experiment, set `FACTORY_MODEL_DIR` to its path. Sources, license and mirror provenance are in `data/README.md`; exact splits, metrics and demo samples are included under `ml/artifacts`. The same data is synthetic and row-correlated; these results do not prove generalization to a different machine, future time period or physical failure horizon.

## Checks

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Checks cover input validation, duplicate events, persistence, workflow transitions, reply association, send deduplication, missing-service fallback, operator authentication and signed webhook processing. Provider calls in unit tests are mocked; they do not send real messages. The signed webhook test requires the Twilio SDK.

Core workflow tests can be run independently: `python -m unittest discover -s tests -p test_workflow.py -v`. See `BUILD_STATUS.md` for verified results and outstanding checks in the build environment.

## Next stages

2. Implemented: technician lifecycle, labelled response simulation and WhatsApp adapter; live integration verification pending.
3. Implemented: AI4I acquisition, documented splits, baseline/candidate training, calibration, evaluation and direct inference.
4. SHAP evidence, curated guidance retrieval and optional LLM wording.
5. End-to-end replay and incident workflow.
6. Submission documentation, clean setup verification and demo recording.

Implementation uses FastAPI's Pydantic request models and Streamlit forms: https://fastapi.tiangolo.com/tutorial/body/ and https://docs.streamlit.io/develop/api-reference/execution-flow/st.form.
