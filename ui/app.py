import os
from uuid import uuid4
import requests
import streamlit as st

st.set_page_config(page_title="Factory Copilot", page_icon="🏭", layout="wide")
API = os.environ.get("FACTORY_API_URL", "http://127.0.0.1:8000").rstrip("/")


def api(method, path, payload=None):
    try:
        response = requests.request(method, API + path, json=payload, timeout=20,
            headers={'X-API-Key': os.environ.get('FACTORY_API_KEY', '')})
        if not response.ok:
            st.error(f"Request rejected ({response.status_code})")
            st.json(response.json())
            return None
        return response.json()
    except (requests.RequestException, ValueError):
        st.error("Backend unavailable. Start it with: python -m uvicorn backend.main:app --port 8000")
        return None


st.title("Factory Copilot")
st.caption("Machine health • Evidence • Maintenance workflow")
st.warning("Synthetic benchmark demo · Not validated for physical equipment. No trained model yet.")
monitor, incidents, profile, evaluation = st.tabs(["Monitor", "Incidents", "Machine Profile", "Evaluation"])

with monitor:
    st.subheader("Demonstration station")
    st.write("Enter readings to validate the input contract and create a manual test incident.")
    st.caption("Defaults are illustrative inputs, not recorded AI4I samples. Validation checks format and broad bounds, not model compatibility with physical equipment.")
    with st.form("reading"):
        left, right = st.columns(2)
        with left:
            air = st.number_input("Air temperature (K)", value=298.1, min_value=0.1, max_value=1000.0)
            process = st.number_input("Process temperature (K)", value=308.6, min_value=0.1, max_value=1000.0)
            speed = st.number_input("Rotational speed (rpm)", value=1551.0, min_value=0.0, max_value=100000.0)
        with right:
            torque = st.number_input("Torque (N·m)", value=42.8, min_value=0.0, max_value=100000.0)
            wear = st.number_input("Tool wear (min)", value=0.0, min_value=0.0, max_value=100000.0)
            product = st.selectbox("Product type", ["L", "M", "H"])
        submitted = st.form_submit_button("Validate reading", type="primary")
    if submitted:
        reading = dict(profile_id="ai4i-demo-v1", air_temperature_k=air, process_temperature_k=process,
                       rotational_speed_rpm=speed, torque_nm=torque, tool_wear_min=wear, product_type=product)
        result = api("POST", "/readings/validate", reading)
        if result:
            st.session_state.validated = result["reading"]
            st.session_state.event_id = uuid4().hex
        else:
            st.session_state.pop("validated", None)
    if "validated" in st.session_state:
        st.success("Input validated. No failure assessment has been made.")
        st.json(st.session_state.validated, expanded=False)
        st.caption("Incident creation uses this validated snapshot. Submit the form again to apply edits or begin a new event.")
        if st.button("Create manual demo incident"):
            result = api("POST", "/incidents", {"event_id": st.session_state.event_id, "reading": st.session_state.validated})
            if result:
                st.success(f"Incident {result['id']} is open. No message was sent.")
    st.info("Risk assessment, replay and SHAP explanations will be connected after model training.")

with incidents:
    st.subheader("Incident history")
    st.button("Refresh history")
    history = api("GET", "/incidents")
    if history == []:
        st.info("No incidents yet. Validate a reading in Monitor to create your first test incident.")
    for item in history or []:
        with st.expander(f"{item['id']} · {item['status'].title()} · {item['created_at']}"):
            st.write(f"**Origin:** Manual demo · **Notification:** {item['delivery_status']}")
            st.write(f"**Inspection finding:** {item['finding'] or 'Not recorded'}")
            st.json(item["reading"])
            st.caption("Model evidence and inspection guidance are not available yet.")
            st.markdown('**Simulated technician response**')
            actions = {'open': {1: 'Acknowledge'}, 'acknowledged': {
                2: 'Issue confirmed', 3: 'No issue found', 4: 'Inspection inconclusive'},
                'inspected': {5: 'Resolve'}, 'resolved': {}}
            options = actions[item['status']]
            if options:
                choice = st.selectbox('Action', list(options), format_func=options.get, key='action-'+item['id'])
                if st.button('Apply simulated response', key='reply-'+item['id']):
                    result = api('POST', f"/incidents/{item['id']}/simulate-reply",
                        {'command': choice, 'event_id': uuid4().hex})
                    if result:
                        st.rerun()
            st.caption('Resolution does not prove the prediction was correct. Findings are stored separately.')
            if st.button('Show audit trail', key='audit-'+item['id']):
                trail = api('GET', f"/incidents/{item['id']}/history")
                st.json(trail or [])
            if item['delivery_status'] == 'not_sent' and item['status'] != 'resolved':
                if st.button('Send WhatsApp demo alert', key='notify-'+item['id']):
                    result = api('POST', f"/incidents/{item['id']}/notify")
                    if result:
                        st.rerun()
            st.caption('WhatsApp requires local configuration. Provider acceptance is not confirmed phone delivery. Unknown outcomes require checking provider logs; automatic resends are blocked.')

with profile:
    st.subheader("Supported profile")
    settings = api("GET", "/profile")
    if settings:
        st.write(settings["name"])
        st.info(settings["deployment_status"])
        st.table(settings["input_schema"])
        st.json({k: v for k, v in settings.items() if k != "input_schema"})
        st.caption("Profile compatibility is fixed. Stage 2 uses an English template and a recipient set through backend environment variables. Phone numbers are not displayed here.")
        health = api('GET', '/health')
        if health:
            st.write('WhatsApp configuration: ' + health['messaging'])

with evaluation:
    st.subheader("Evaluation readiness")
    st.info("No model has been trained or evaluated. No performance numbers are available.")
    st.write("Planned: AI4I-only classification, logistic regression baseline, XGBoost candidate, separate calibration and untouched final test set.")
    st.write("Results will include PR-AUC, prevalence, precision, recall, confusion counts, Brier score and a reliability plot.")
    st.caption("Failure classification does not establish time to breakdown. SHAP explains model output, not physical root cause.")
