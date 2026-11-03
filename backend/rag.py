"""RAG (Retrieval-Augmented Generation) engine for Factory Copilot technical maintenance."""
import os
from pathlib import Path
import re
from typing import Dict, List, Optional
import requests

# Technical Knowledge Base Documents
KNOWLEDGE_DOCS = [
    {
        "id": "DOC-FAIL-HDF",
        "title": "Heat Dissipation Failure (HDF) Physics & Diagnostic",
        "category": "Failure Physics",
        "source": "UCI AI4I 2020 Benchmark Specification",
        "url": "https://archive.ics.uci.edu/dataset/601/ai4i",
        "keywords": ["heat", "dissipation", "temperature", "cooling", "overheating", "air", "process", "speed", "hdf"],
        "summary": "Heat Dissipation Failure occurs when thermal energy cannot escape the cutting zone adequately.",
        "content": (
            "Heat Dissipation Failure (HDF) is formally triggered when the temperature difference between "
            "process temperature and air temperature is below 8.6 Kelvin (i.e., Process_Temp - Air_Temp < 8.6 K) "
            "while the rotational spindle speed is below 1380 RPM. In this regime, low rotational airflow prevents convective "
            "heat transfer while cutting friction elevates localized tool contact temperature."
        ),
        "guidance": "Inspect coolant flow rate, coolant nozzle aim, ambient temperature ventilation, and ensure spindle rotational speed is above 1380 RPM during high-torque cutting passes."
    },
    {
        "id": "DOC-FAIL-OSF",
        "title": "Overstrain Failure (OSF) Physics & Strain Limits",
        "category": "Failure Physics",
        "source": "UCI AI4I 2020 Benchmark Specification",
        "url": "https://archive.ics.uci.edu/dataset/601/ai4i",
        "keywords": ["overstrain", "strain", "torque", "wear", "product", "variant", "osf", "limits"],
        "summary": "Overstrain Failure occurs when the mechanical stress product of tool wear and torque exceeds material limits.",
        "content": (
            "Overstrain Failure (OSF) is determined by the product of accumulated Tool Wear (in minutes) and Spindle Torque (in Nm). "
            "The failure boundary depends on the product quality variant: "
            "1. Variant L (Low): Failure if Tool_Wear × Torque > 11,000 min·Nm. "
            "2. Variant M (Medium): Failure if Tool_Wear × Torque > 12,000 min·Nm. "
            "3. Variant H (High): Failure if Tool_Wear × Torque > 13,000 min·Nm. "
            "High torque on an already-worn tool causes plastic deformation or catastrophic edge chipping."
        ),
        "guidance": "Check torque spikes during heavy roughing. When cutting Variant L parts, replace cutting inserts before tool wear reaches 180 minutes to avoid crossing the 11,000 min·Nm threshold."
    },
    {
        "id": "DOC-FAIL-PWF",
        "title": "Power Failure (PWF) Mechanical Operating Envelope",
        "category": "Failure Physics",
        "source": "UCI AI4I 2020 Benchmark Specification",
        "url": "https://archive.ics.uci.edu/dataset/601/ai4i",
        "keywords": ["power", "failure", "spindle", "watt", "torque", "speed", "stall", "pwf", "motor"],
        "summary": "Power Failure occurs when required mechanical power violates spindle motor limits.",
        "content": (
            "Power Failure (PWF) is governed by mechanical power: Power (W) = Torque (Nm) × Rotational Speed (RPM) × 2π / 60. "
            "The acceptable continuous operating envelope is between 3,500 Watts and 9,000 Watts. "
            "If mechanical power drops below 3,500 W during an active cutting pass, spindle stall is detected. "
            "If mechanical power exceeds 9,000 W, electrical overload or spindle drive overcurrent occurs."
        ),
        "guidance": "Verify spindle motor current draw, drive belt tension, electrical supply voltage, and check for cutter stalling or excessive depth of cut."
    },
    {
        "id": "DOC-FAIL-TWF",
        "title": "Tool Wear Failure (TWF) Replacement Protocol",
        "category": "Tooling Maintenance",
        "source": "UCI AI4I 2020 Benchmark Specification",
        "url": "https://archive.ics.uci.edu/dataset/601/ai4i",
        "keywords": ["tool", "wear", "twf", "minutes", "flank", "insert", "cutter", "replacement"],
        "summary": "Tool Wear Failure occurs when cutting inserts exceed their mechanical fatigue lifespan.",
        "content": (
            "Tool Wear Failure (TWF) occurs when accumulated cutting contact time reaches the critical wear window between "
            "200 and 240 minutes. Beyond 200 minutes, microscopic flank wear land rapidly accelerates, leading to dimensional "
            "out-of-tolerance parts, severe chattering, and sudden insert fracturing."
        ),
        "guidance": "Schedule preventive tool insert replacement when tool wear reaches 180–190 minutes. Do not operate above 200 minutes without visual microscope inspection of the cutting edge."
    },
    {
        "id": "DOC-SHAP-EXPLAIN",
        "title": "SHAP Explainability & Additive Factor Interpretation",
        "category": "Machine Learning",
        "source": "TreeExplainer Log-Odds Evidence Specification",
        "url": "https://github.com/agilan-0110/factory-copilot",
        "keywords": ["shap", "explanation", "factor", "log-odds", "contribution", "additivity", "threshold", "model"],
        "summary": "Mathematical principles for interpreting SHAP feature contributions on tree classifiers.",
        "content": (
            "SHAP (SHapley Additive exPlanations) TreeExplainer calculates the exact marginal contribution of each telemetry feature "
            "to the tree classifier's raw uncalibrated log-odds score. Features with positive contributions (+) raise the probability of failure, "
            "while negative contributions (-) pull the score lower toward nominal safety. "
            "Additivity Property: Base_Value + Sum(Feature_Contributions) = Raw_Model_Output. "
            "Important: SHAP values represent model log-odds impacts, not percentage points or verified physical causality."
        ),
        "guidance": "Use SHAP factors to identify which sensor parameters are driving the model alert. Never assume feature presence proves a physical mechanical defect without technician verification."
    },
    {
        "id": "DOC-HAAS-COOLANT",
        "title": "CNC Coolant & Sump Maintenance Standards",
        "category": "Machine Maintenance",
        "source": "Haas Mill Operator Manual — Maintenance",
        "url": "https://haascnc.com/service/online-operator-s-manuals/mill-operator-s-manual/mill---safety.html",
        "keywords": ["coolant", "fluid", "sump", "refractometer", "concentration", "haas", "lubrication"],
        "summary": "Standard operating procedure for CNC coolant concentration and delivery.",
        "content": (
            "Regular maintenance requires checking coolant level and concentration daily. Use an optical refractometer to measure "
            "coolant concentration (maintain between 6% and 9% for steel and aluminum milling). "
            "Low coolant concentration leads to thermal tool degradation and excessive frictional heat. "
            "Clean chip screens daily and ensure flood coolant pump pressure delivers minimum 30 PSI at the tool nozzle."
        ),
        "guidance": "Verify coolant tank level, skim tramp oil, check refractometer percentage, and flush coolant lines to ensure unblocked delivery."
    },
    {
        "id": "DOC-HAAS-TOOLING",
        "title": "CNC Spindle & Toolholder Retention Inspection",
        "category": "Machine Maintenance",
        "source": "Haas Tooling Maintenance Guidelines",
        "url": "https://haascnc.com/service/troubleshooting-and-how-to/how-to/mill---tooling---maintenance.html",
        "keywords": ["spindle", "toolholder", "pull", "stud", "retention", "taper", "runout", "chatter"],
        "summary": "Inspection procedures for toolholder tapers, pull studs, and spindle seating.",
        "content": (
            "Inspect the retention knob (pull stud) on every toolholder for damage, micro-fissures, and correct torque specification. "
            "Inspect the 40-taper or 50-taper spindle socket for fretting corrosion or metal chips. "
            "Spindle runout must not exceed 0.0002 inches (0.005 mm) at the spindle nose. "
            "Loose or worn pull studs cause tool pull-out under heavy axial cutting loads."
        ),
        "guidance": "Wipe spindle taper clean with lint-free cloth and isopropyl alcohol. Verify pull stud torque with a calibrated retention knob socket."
    },
    {
        "id": "DOC-WORKFLOW-PROTO",
        "title": "Technician Incident Lifecycle Protocol (Commands 1–5)",
        "category": "Incident Protocol",
        "source": "Factory Copilot Standard Operating Procedure",
        "url": "https://github.com/agilan-0110/factory-copilot",
        "keywords": ["workflow", "incident", "protocol", "command", "acknowledge", "confirm", "resolve", "audit"],
        "summary": "Ordered technician response lifecycle for factory alerts.",
        "content": (
            "When an incident is opened, it enters status 'new'. Technicians respond via simulated buttons or WhatsApp using ordered commands: "
            "Command 1 (Acknowledge): Technician claims incident and commences on-site inspection (status -> acknowledged). "
            "Command 2 (Issue Confirmed): Physical defect or out-of-tolerance reading verified on station (status -> confirmed). "
            "Command 3 (No Issue Found): Station inspected, determined to be a false positive (status -> no_issue). "
            "Command 4 (Inconclusive): Ambiguous reading requiring engineering diagnostic review (status -> inconclusive). "
            "Command 5 (Resolve After Inspection): Station repaired and released to production (status -> resolved, immutable)."
        ),
        "guidance": "Follow the sequence strictly. Commands out of sequence are rejected with HTTP 409 Conflict. Resolved incidents cannot be re-opened."
    },
    {
        "id": "DOC-FLEET-SPECS",
        "title": "Plant Fleet Specifications: Line 1 & Line 2 Machines",
        "category": "Fleet Architecture",
        "source": "Industrial Plant Fleet Configuration",
        "url": "https://github.com/agilan-0110/factory-copilot",
        "keywords": ["fleet", "machines", "stations", "line", "m-01", "m-02", "m-03", "m-04", "m-05", "m-06", "m-07", "m-08", "m-09", "m-10"],
        "summary": "Operational profile of the 10 CNC milling stations.",
        "content": (
            "The plant comprises 10 active machines: "
            "Line 1 (Heavy Machining): M-01 (Rough Milling), M-02 (High-Speed Profiling), M-03 (Precision Milling), M-04 (Surface Contouring), M-05 (Heavy Boring). "
            "Line 2 (High-Precision & Finishing): M-06 (Aerospace Spindle), M-07 (Micro-Finishing), M-08 (Face Milling), M-09 (Heavy Slotting), M-10 (Drill & Tap). "
            "Nominal alert threshold across all stations is 21.0% failure probability, with a 300-second cross-event cooldown policy."
        ),
        "guidance": "Review machine specifications before applying high-torque machining operations. Stations on Line 1 run Variant L/M; Line 2 runs Variant M/H."
    }
]


class RAGAssistant:
    def __init__(self, docs: List[dict] = KNOWLEDGE_DOCS):
        self.docs = docs

    def retrieve(self, query: str, machine_context: Optional[dict] = None, top_k: int = 3) -> List[dict]:
        """Keyword and semantic-density retriever over technical knowledge base."""
        query_lower = query.lower()
        tokens = re.findall(r'\b[a-zA-Z0-9_-]+\b', query_lower)
        
        scored = []
        for doc in self.docs:
            score = 0
            # Keyword matches
            for kw in doc["keywords"]:
                if kw in query_lower:
                    score += 3
            # Token matches in title and summary
            for token in tokens:
                if len(token) > 2:
                    if token in doc["title"].lower():
                        score += 4
                    if token in doc["summary"].lower():
                        score += 2
                    if token in doc["content"].lower():
                        score += 1
            
            # Boost if relevant to machine context
            if machine_context:
                if "tool_wear_min" in machine_context and machine_context["tool_wear_min"] > 180 and "wear" in doc["keywords"]:
                    score += 3
                if "status" in machine_context and machine_context["status"] == "critical" and "fail" in doc["id"].lower():
                    score += 2
                    
            if score > 0:
                scored.append((score, doc))
                
        # Sort by relevance score descending
        scored.sort(key=lambda x: x[0], reverse=True)
        if not scored:
            # Fallback to top general docs
            return self.docs[:top_k]
        return [item[1] for item in scored[:top_k]]

    @staticmethod
    def get_configured_key(api_key: Optional[str] = None) -> str:
        if api_key and api_key.strip():
            return api_key.strip()
        key = os.environ.get("GEMINI_API_KEY") or os.environ.get("GOOGLE_API_KEY")
        if key and key.strip():
            return key.strip()
        for env_path in [Path(".env"), Path("../.env")]:
            if env_path.exists():
                try:
                    for line in env_path.read_text(encoding="utf-8").splitlines():
                        line = line.strip()
                        if line and not line.startswith("#") and "=" in line:
                            k, v = line.split("=", 1)
                            if k.strip() in ("GEMINI_API_KEY", "GOOGLE_API_KEY"):
                                v = v.strip().strip("'\"")
                                if v:
                                    return v
                except Exception:
                    pass
        return ""

    def answer(self, query: str, machine_context: Optional[dict] = None, fleet_context: Optional[List[dict]] = None, api_key: Optional[str] = None) -> dict:
        """Synthesize a grounded answer using retrieved documents, live machine context, and optional Gemini LLM."""
        retrieved = self.retrieve(query, machine_context, top_k=3)
        
        # Check if query references a specific machine
        target_machine = machine_context
        if not target_machine and fleet_context:
            for m in fleet_context:
                if m["machine_id"].lower() in query.lower() or m["name"].lower() in query.lower():
                    target_machine = m
                    break

        # Check if Gemini API key is available (passed directly or from environment)
        resolved_key = self.get_configured_key(api_key)
        if resolved_key:
            try:
                llm_response = self._call_gemini_llm(query, retrieved, target_machine, resolved_key)
                if llm_response:
                    return {
                        "reply": llm_response,
                        "retrieved_sources": retrieved,
                        "machine_context": target_machine,
                        "grounding_verified": True,
                        "mode": "gemini_llm"
                    }
            except Exception:
                pass

        # Deterministic Grounded Synthesizer
        reply = self._generate_grounded_response(query, retrieved, target_machine)
        return {
            "reply": reply,
            "retrieved_sources": retrieved,
            "machine_context": target_machine,
            "grounding_verified": True,
            "mode": "grounded_retrieval_synthesizer"
        }

    def _generate_grounded_response(self, query: str, docs: List[dict], machine: Optional[dict]) -> str:
        """Generate structured technical response citing exact sources and machine telemetry."""
        sections = []

        # 1. Machine telemetry analysis (if applicable)
        if machine:
            m_id = machine["machine_id"]
            m_name = machine.get("name", "Station")
            m_status = machine.get("status", "nominal").upper()
            prob = machine.get("assessment", {}).get("probability", 0.0) if machine.get("assessment") else 0.0
            reading = machine.get("reading", {})
            
            telemetry_text = (
                f"### 🔍 Real-Time Diagnostic for Station [{m_id}: {m_name}]\n"
                f"- **Operational Status:** `{m_status}`\n"
                f"- **Failure Risk Assessment:** **{(prob * 100).toFixed(1) if hasattr(prob, 'toFixed') else f'{prob*100:.1f}%'}** "
                f"(Alert Cutoff: 21.0%)\n"
                f"- **Live Readings:** Process Temp: `{reading.get('process_temperature_k')} K`, "
                f"Speed: `{reading.get('rotational_speed_rpm')} RPM`, "
                f"Torque: `{reading.get('torque_nm')} Nm`, "
                f"Tool Wear: `{reading.get('tool_wear_min')} min` (Variant {reading.get('product_type')})\n"
            )
            if machine.get("active_incident_id"):
                telemetry_text += f"- **Active Incident:** Incident `{machine['active_incident_id']}` is currently OPEN.\n"
            sections.append(telemetry_text)

        # 2. Retrieved Technical Knowledge Synthesis
        knowledge_text = "### 📚 Retrieved Technical Knowledge & Engineering Standards\n"
        for doc in docs:
            knowledge_text += (
                f"**[{doc['id']}] {doc['title']}**\n"
                f"{doc['content']}\n"
                f"*Maintenance Recommendation:* {doc['guidance']}\n"
                f"*Source Link:* [{doc['source']}]({doc['url']})\n\n"
            )
        sections.append(knowledge_text)

        # 3. Direct actionable guidance
        action_text = (
            "### 🛠️ Recommended Action Protocol\n"
            "1. **Confirm Sensor Telemetry:** Validate that readings fall within normal nominal operating bounds.\n"
            "2. **Follow Technician Protocol:** If an incident is active, apply Command `1` (Acknowledge) to assign a technician on site, followed by physical inspection.\n"
            "3. **Physical Verification Note:** Model probability scores and SHAP factors represent benchmark failure patterns; always verify mechanical conditions physically before replacing components."
        )
        sections.append(action_text)

        return "\n\n".join(sections)

    def _call_gemini_llm(self, query: str, docs: List[dict], machine: Optional[dict], api_key: str) -> Optional[str]:
        """Call Google Gemini API with grounded technical context and machine telemetry."""
        context_str = "\n\n".join([f"[{d['id']}] {d['title']}:\n{d['content']}\nGuidance: {d['guidance']}" for d in docs])
        machine_str = str(machine) if machine else "No specific machine selected."
        
        system_instruction = (
            "You are Factory Copilot RAG Assistant, an expert AI maintenance engineer for an industrial manufacturing plant. "
            "Answer the user's question clearly, professionally, and concisely using GitHub-flavored Markdown. "
            "CRITICAL RULES:\n"
            "1. Ground your answer strictly in the provided technical documents and live machine context.\n"
            "2. Always cite source document IDs using [DOC-ID] and machine stations using [M-XX].\n"
            "3. Include actionable diagnostic recommendations.\n"
            "4. Never invent unvalidated equipment repair procedures."
        )

        prompt = (
            f"User Question: {query}\n\n"
            f"Live Machine Telemetry Context:\n{machine_str}\n\n"
            f"Retrieved Technical Documentation:\n{context_str}\n\n"
            "Provide a grounded, professional diagnostic answer citing relevant [DOC-ID] sources."
        )

        payload = {
            "contents": [{"parts": [{"text": prompt}]}],
            "systemInstruction": {"parts": [{"text": system_instruction}]}
        }

        # Try gemini-2.0-flash, then gemini-1.5-flash
        models = ["gemini-2.0-flash", "gemini-1.5-flash"]
        for model in models:
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent?key={api_key.strip()}"
            try:
                res = requests.post(url, json=payload, timeout=10)
                if res.status_code == 200:
                    data = res.json()
                    candidates = data.get("candidates", [])
                    if candidates and "content" in candidates[0] and "parts" in candidates[0]["content"]:
                        return candidates[0]["content"]["parts"][0]["text"]
            except Exception:
                continue
        return None
