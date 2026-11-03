"""Fleet management and live continuous telemetry measurement for 10 industrial machines."""
import math
import random
from datetime import datetime, timezone
from typing import Dict, List, Optional
from backend.schemas import Reading

MACHINE_SPECS = [
    {"machine_id": "M-01", "name": "Line 1: Heavy Rough Milling", "product_type": "L", "base_speed": 1500, "base_torque": 42.0, "initial_wear": 25},
    {"machine_id": "M-02", "name": "Line 1: High-Speed Profiler", "product_type": "L", "base_speed": 1650, "base_torque": 38.0, "initial_wear": 60},
    {"machine_id": "M-03", "name": "Line 1: Precision CNC Milling", "product_type": "M", "base_speed": 1450, "base_torque": 46.0, "initial_wear": 95},
    {"machine_id": "M-04", "name": "Line 1: 3D Surface Contouring", "product_type": "M", "base_speed": 1520, "base_torque": 41.5, "initial_wear": 140},
    {"machine_id": "M-05", "name": "Line 1: High-Load Boring Center", "product_type": "L", "base_speed": 1380, "base_torque": 52.0, "initial_wear": 185},
    {"machine_id": "M-06", "name": "Line 2: 5-Axis Aerospace Spindle", "product_type": "H", "base_speed": 1720, "base_torque": 35.0, "initial_wear": 30},
    {"machine_id": "M-07", "name": "Line 2: Micro-Finishing Station", "product_type": "H", "base_speed": 1850, "base_torque": 31.0, "initial_wear": 75},
    {"machine_id": "M-08", "name": "Line 2: Face Milling Spindle", "product_type": "M", "base_speed": 1480, "base_torque": 44.0, "initial_wear": 115},
    {"machine_id": "M-09", "name": "Line 2: Heavy Slotting Center", "product_type": "H", "base_speed": 1350, "base_torque": 55.0, "initial_wear": 205},
    {"machine_id": "M-10", "name": "Line 2: Precision Drill & Tap", "product_type": "M", "base_speed": 1580, "base_torque": 39.0, "initial_wear": 40},
]


class MachineState:
    def __init__(self, spec: dict):
        self.machine_id = spec["machine_id"]
        self.name = spec["name"]
        self.product_type = spec["product_type"]
        self.base_speed = spec["base_speed"]
        self.base_torque = spec["base_torque"]
        self.tool_wear_min = float(spec["initial_wear"])
        self.air_temp_k = 298.15 + random.uniform(-0.5, 0.5)
        self.process_temp_k = self.air_temp_k + 10.4
        self.rotational_speed_rpm = float(self.base_speed)
        self.torque_nm = float(self.base_torque)
        self.fault_mode: Optional[str] = None
        self.last_assessment: Optional[dict] = None
        self.history: List[dict] = []
        self.active_incident_id: Optional[str] = None
        self.step_count = 0

    def current_reading(self) -> Reading:
        return Reading(
            profile_id="ai4i-demo-v1",
            machine_id=self.machine_id,
            air_temperature_k=round(self.air_temp_k, 2),
            process_temperature_k=round(self.process_temp_k, 2),
            rotational_speed_rpm=round(self.rotational_speed_rpm, 1),
            torque_nm=round(self.torque_nm, 2),
            tool_wear_min=round(self.tool_wear_min, 1),
            product_type=self.product_type,
        )

    def tick(self):
        """Simulate continuous live measurement fluctuation and cutting wear."""
        self.step_count += 1
        
        # Tool wear accumulates continuously
        wear_increment = 0.5 if self.product_type == "H" else (0.8 if self.product_type == "M" else 1.0)
        self.tool_wear_min += wear_increment

        # Natural thermal cycle and ambient noise
        ambient_drift = 0.2 * math.sin(self.step_count / 15.0)
        self.air_temp_k = 298.15 + ambient_drift + random.uniform(-0.15, 0.15)

        # Baseline physics
        speed_jitter = random.gauss(0, 8.0)
        torque_jitter = random.gauss(0, 0.8)

        # Apply fault injection or normal dynamics
        if self.fault_mode == "overheat":
            # Air temp and process temp close together or excessive heating
            self.air_temp_k = 303.5 + random.uniform(-0.2, 0.2)
            self.process_temp_k = 312.8 + random.uniform(-0.3, 0.3)
            self.rotational_speed_rpm = 1320.0 + speed_jitter
            self.torque_nm = 56.5 + torque_jitter
        elif self.fault_mode == "wear_spike":
            self.tool_wear_min = max(self.tool_wear_min, 225.0)
            self.rotational_speed_rpm = self.base_speed * 0.95 + speed_jitter
            self.torque_nm = self.base_torque * 1.15 + torque_jitter
            self.process_temp_k = self.air_temp_k + 10.2 + random.uniform(-0.2, 0.2)
        elif self.fault_mode == "power_strain":
            self.rotational_speed_rpm = 1220.0 + speed_jitter
            self.torque_nm = 71.0 + torque_jitter
            self.process_temp_k = self.air_temp_k + 10.8 + random.uniform(-0.2, 0.2)
        else:
            # Nominal steady operation
            self.rotational_speed_rpm = self.base_speed + speed_jitter
            self.torque_nm = self.base_torque + torque_jitter
            heat_delta = 9.8 + (self.torque_nm * self.rotational_speed_rpm / 16000.0)
            self.process_temp_k = self.air_temp_k + heat_delta + random.uniform(-0.1, 0.1)

        # Append to telemetry history (keep last 30 readings)
        record = {
            "timestamp": datetime.now(timezone.utc).isoformat(),
            "air_temperature_k": round(self.air_temp_k, 2),
            "process_temperature_k": round(self.process_temp_k, 2),
            "rotational_speed_rpm": round(self.rotational_speed_rpm, 1),
            "torque_nm": round(self.torque_nm, 2),
            "tool_wear_min": round(self.tool_wear_min, 1),
            "probability": self.last_assessment.get("probability", 0.0) if self.last_assessment else 0.0,
        }
        self.history.append(record)
        if len(self.history) > 30:
            self.history.pop(0)

    def inject_fault(self, mode: Optional[str]):
        self.fault_mode = mode

    def replace_tool(self):
        self.tool_wear_min = 0.0
        self.fault_mode = None
        self.active_incident_id = None


class IndustrialFleet:
    def __init__(self):
        self.machines: Dict[str, MachineState] = {
            spec["machine_id"]: MachineState(spec) for spec in MACHINE_SPECS
        }

    def tick_all(self, predictor, explainer, db_path: Optional[str] = None) -> List[dict]:
        """Advance all 10 machines by one live measurement cycle and evaluate probabilities."""
        results = []
        for machine_id, m in self.machines.items():
            m.tick()
            reading = m.current_reading()
            
            # ML Assessment
            assessment = predictor.assess(reading)
            if assessment.get("flagged"):
                # Calculate SHAP explanation for flagged or critical machines
                assessment["explanation"] = explainer.explain(reading)
                assessment["model_evidence"] = assessment["explanation"].get("top_factors", [])
                
                # Auto-open or link incident in DB if path provided
                if db_path and not m.active_incident_id:
                    from backend import database
                    from backend.schemas import IncidentCreate
                    try:
                        event_id = f"auto-{m.machine_id}-{int(datetime.now(timezone.utc).timestamp())}"
                        created = database.create(db_path, IncidentCreate(event_id=event_id, reading=reading), assessment)
                        m.active_incident_id = created["id"]
                    except Exception:
                        pass
            else:
                assessment["explanation"] = {"status": "nominal"}
                assessment["model_evidence"] = []
                
            m.last_assessment = assessment
            
            # Classify overall machine status
            prob = assessment.get("probability", 0.0)
            if prob >= 0.21:
                status = "critical"
            elif prob >= 0.12 or m.tool_wear_min >= 190.0:
                status = "warning"
            else:
                status = "nominal"

            summary = {
                "machine_id": m.machine_id,
                "name": m.name,
                "product_type": m.product_type,
                "status": status,
                "reading": reading.model_dump(),
                "assessment": assessment,
                "tool_wear_min": round(m.tool_wear_min, 1),
                "fault_mode": m.fault_mode,
                "active_incident_id": m.active_incident_id,
                "history": m.history[-15:],
            }
            results.append(summary)
        return results

    def get_snapshot(self) -> List[dict]:
        """Return the current state of all 10 machines."""
        snapshot = []
        for m in self.machines.values():
            prob = m.last_assessment.get("probability", 0.0) if m.last_assessment else 0.0
            if prob >= 0.21:
                status = "critical"
            elif prob >= 0.12 or m.tool_wear_min >= 190.0:
                status = "warning"
            else:
                status = "nominal"

            snapshot.append({
                "machine_id": m.machine_id,
                "name": m.name,
                "product_type": m.product_type,
                "status": status,
                "reading": m.current_reading().model_dump(),
                "assessment": m.last_assessment,
                "tool_wear_min": round(m.tool_wear_min, 1),
                "fault_mode": m.fault_mode,
                "active_incident_id": m.active_incident_id,
                "history": m.history[-15:],
            })
        return snapshot

    def inject_fault(self, machine_id: str, mode: Optional[str]):
        if machine_id in self.machines:
            self.machines[machine_id].inject_fault(mode)

    def replace_tool(self, machine_id: str):
        if machine_id in self.machines:
            self.machines[machine_id].replace_tool()
