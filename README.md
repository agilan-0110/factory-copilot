# Factory Copilot

Stage 1: a local maintenance-workflow skeleton with four Streamlit tabs, a FastAPI input contract, a fixed benchmark profile and SQLite incident persistence.

**Synthetic benchmark demonstration only. Not validated for physical equipment.** No model, probability, SHAP attribution, dataset replay or evaluation metric is fabricated. Default inputs are illustrative, not downloaded dataset rows. Incidents are manually created test records; no messages are sent.

## Run on Windows (Python 3.10+)

From this project directory:

```powershell
python -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
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

This stage is local-only, has no authentication, and must not be exposed publicly. No phone numbers or API keys are needed. Stop servers with Ctrl+C. Use one backend instance with a persistent local disk.

## Checks

```powershell
.\.venv\Scripts\python.exe -m unittest discover -s tests -v
```

Checks cover validation, absent prediction values, duplicate-event handling, conflicting event IDs and persistence across app instances.

## Next stages

2. Technician lifecycle, explicitly labelled response simulation and WhatsApp adapter.
3. AI4I acquisition, documented data splits, baseline/candidate training, calibration and evaluation.
4. SHAP evidence, curated guidance retrieval and optional LLM wording.
5. End-to-end replay and incident workflow.
6. Submission documentation, clean setup verification and demo recording.

Implementation uses FastAPI's Pydantic request models and Streamlit forms: https://fastapi.tiangolo.com/tutorial/body/ and https://docs.streamlit.io/develop/api-reference/execution-flow/st.form.
