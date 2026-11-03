# Build Checkpoint: Stage 6 (Industrial Plant Fleet & RAG Copilot)

**Implemented:**
- **Modern React + Tailwind CSS Web Dashboard**: Replaced the previous Streamlit UI with an industrial Stitch-style React 19 + TypeScript + Tailwind CSS v4 single-page application (`frontend/`).
- **Unified Single-Port Delivery**: FastAPI serves the pre-built React application directly from `frontend/dist` at `http://127.0.0.1:8000/`, with Vite development server support at `http://127.0.0.1:5173/` via CORS and reverse proxy.
- **10-Machine Real-Time Industrial Fleet Simulation (`backend/fleet.py`)**:
  - Simulates 10 CNC milling stations (`M-01` to `M-10`) distributed across Line 1 (Heavy Machining) and Line 2 (Precision Finishing).
  - Continuous telemetry generation: air temperature, process temperature, rotational speed, torque, tool wear, and vibration harmonics.
  - Dynamic physics: realistic thermal drift, operational noise, gradual tool wear accumulation, and synthetic fault injection (Heat Dissipation `HDF`, Overstrain `OSF`, Power Failure `PWF`, Tool Wear `TWF`).
  - Automatic fleet ticking with live incident escalation when machine failure probability exceeds the calibrated 21.0% threshold.
  - Interactive Plant Floor Grid with real-time sparklines, machine inspector, and 1-click tool replacement / fault injection.
- **Grounded Technical RAG Copilot Chatbot (`backend/rag.py` & `frontend/src/components/RAGChatbot.tsx`)**:
  - Indexed technical corpus covering physics failure equations (HDF, OSF, PWF, TWF), SHAP explainability theory, Haas CNC coolant and tooling specifications, and technician response protocols.
  - Grounded semantic retrieval engine with keyword/density ranking and live machine telemetry context injection.
  - Interactive RAG Copilot UI with quick-prompt chips, live station selector, interactive document citations, and a searchable technical knowledge browser.
- **Calibrated ML Classifier**: AI4I 2020 predictive maintenance benchmark model (Histogram Gradient Boosting + Sigmoid Calibration) operating at an F2-optimal threshold of 21.0%.
- **Additive SHAP Explainability**: Raw log-odds feature contributions with additivity mathematical verification and direction indicators.
- **Curated Reference Retrieval & Safety Abstention**: Curated source excerpts from UCI AI4I and Haas CNC documentation with explicit fallback/abstention when equipment-specific procedures are requested.
- **Incident Lifecycle Management**: Full state machine (`new` -> `acknowledged` -> `confirmed`/`no_issue`/`inconclusive` -> `resolved`), immutable evidence snapshotting at incident creation time, simulated WhatsApp action controls, and optional Twilio WhatsApp notification adapter.
- **Automated Replay & Cooldown**: End-to-end replay engine with a 300s cooldown window, automated 2-sample demonstration runner, duplicate event suppression, and event timeline tracking.

## Verification
- All 35 unit tests passing (`tests/test_stage1.py`, `tests/test_stage2_api.py`, `tests/test_workflow.py`, `tests/test_ml.py`, `tests/test_replay.py`, `tests/test_evidence.py`, `tests/test_fleet.py`, `tests/test_rag.py`).
- Frontend production build succeeds cleanly in ~1 second via `npm run build`.
- Local FastAPI TestClient validates static React HTML delivery (`200 OK`) and backend REST endpoints (`/health`, `/predict`, `/explain`, `/incidents`, `/replay`, `/fleet`, `/rag/chat`, `/rag/knowledge`).

Repository: https://github.com/agilan-0110/factory-copilot
