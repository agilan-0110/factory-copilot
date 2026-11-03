from typing import Literal
from pydantic import BaseModel, ConfigDict, Field


class Reading(BaseModel):
    model_config = ConfigDict(extra="forbid", allow_inf_nan=False)
    profile_id: Literal["ai4i-demo-v1"] = "ai4i-demo-v1"
    machine_id: str = Field(default="M-01", max_length=50)
    air_temperature_k: float = Field(gt=0, le=1000)
    process_temperature_k: float = Field(gt=0, le=1000)
    rotational_speed_rpm: float = Field(ge=0, le=100000)
    torque_nm: float = Field(ge=0, le=100000)
    tool_wear_min: float = Field(ge=0, le=100000)
    product_type: Literal["L", "M", "H"]


class IncidentCreate(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event_id: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")
    reading: Reading


class SimulatedReply(BaseModel):
    model_config = ConfigDict(extra="forbid")
    command: Literal[1, 2, 3, 4, 5]
    event_id: str = Field(min_length=1, max_length=100, pattern=r"^[a-zA-Z0-9_-]+$")


class ExplanationRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    reading: Reading
    scope: Literal['benchmark_reference', 'equipment_specific'] = 'benchmark_reference'


class ReplayRequest(BaseModel):
    model_config = ConfigDict(extra='forbid')
    event_id: str = Field(min_length=1, max_length=100, pattern=r'^[a-zA-Z0-9_-]+$')
    scenario: Literal['low_score', 'high_score']
