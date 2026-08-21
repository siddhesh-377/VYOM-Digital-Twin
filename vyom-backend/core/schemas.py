"""VYOM Backend — Pydantic v2 schemas for all API payloads."""
from __future__ import annotations
from typing import Any, Optional, List, Dict, Literal
from pydantic import BaseModel, Field, field_validator
import time


# ── Mission ─────────────────────────────────────────────────────────────────

class LaunchSiteSchema(BaseModel):
    name: str = "Satish Dhawan Space Centre (SLP)"
    country: str = "India"
    lat: float = 13.72
    lng: float = 80.23
    agency: str = "ISRO"


class CrewMemberSchema(BaseModel):
    id: str
    name: str
    role: str
    heartRateBpm: float = 72
    spo2Percent: float = 99.1
    respirationBpm: float = 14
    coreTempC: float = 36.8
    suitPressureKpa: float = 101.3
    radiationDoseMsv: float = 0.0
    stressIndex: float = 18
    status: str = "nominal"
    activity: str = ""


class MissionCreateSchema(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=1)
    type: str = "orbital"
    destination: str = "earth-orbit"
    objective: str = ""
    budgetCrore: float = 0.0
    launchSite: LaunchSiteSchema = Field(default_factory=LaunchSiteSchema)
    crew: List[CrewMemberSchema] = Field(default_factory=list)
    satellite: Optional[Dict[str, Any]] = None
    createdAt: int = Field(default_factory=lambda: int(time.time() * 1000))


class MissionResponseSchema(BaseModel):
    id: str
    name: str
    mission_type: str
    destination: str
    status: str
    objective: str
    budget_crore: float
    launch_site: Dict[str, Any]
    time_multiplier: int
    mission_day: float
    objective_progress: float
    overall_health: float
    created_at: int


# ── Telemetry ────────────────────────────────────────────────────────────────

class TelemetryPowerSchema(BaseModel):
    batteryPercent: float
    voltageV: float
    currentA: float
    solarGenerationW: float
    consumptionW: float


class TelemetryThermalSchema(BaseModel):
    cpuTempC: float
    batteryTempC: float
    payloadTempC: float
    externalTempC: float


class TelemetryAttitudeSchema(BaseModel):
    rollDeg: float
    pitchDeg: float
    yawDeg: float
    angularVelDegS: float
    reactionWheelRpm: float


class TelemetryCommSchema(BaseModel):
    signalDbm: float
    dataRateMbps: float
    packetsPerSec: float
    latencyMs: float
    uptime: float


class TelemetryComputeSchema(BaseModel):
    cpuPercent: float
    memoryPercent: float
    storagePercent: float


class TelemetryOrbitSchema(BaseModel):
    altitudeKm: float
    velocityKms: float
    accelerationMs2: float
    gForce: float
    latitudeDeg: float
    longitudeDeg: float
    inclinationDeg: float
    periodMin: float
    apogeeKm: float
    perigeeKm: float
    semiMajorAxisKm: float
    eccentricity: float
    trueAnomalyDeg: float
    phaseDesc: str = "Nominal Orbital Operations"
    distanceFromEarthKm: float = 650.0
    atmosphericLayer: str = "Exosphere"
    atmosphericDensityKgM3: float = 1.4e-13
    atmosphericDragN: float = 0.0004


class TelemetrySchema(BaseModel):
    missionDay: float
    timestamp: int
    power: TelemetryPowerSchema
    thermal: TelemetryThermalSchema
    attitude: TelemetryAttitudeSchema
    comm: TelemetryCommSchema
    compute: TelemetryComputeSchema
    orbit: TelemetryOrbitSchema
    crew: List[CrewMemberSchema] = Field(default_factory=list)
    overallHealth: float
    healthStatus: str
    dataSource: str = "backend"


# ── Fault ────────────────────────────────────────────────────────────────────

class FaultInjectSchema(BaseModel):
    fault_type: str  # solar_storm | comm_failure | battery_failure | etc.
    severity: float = 7.5
    seed: Optional[int] = None

    @field_validator("severity", mode="before")
    @classmethod
    def coerce_severity(cls, v: Any) -> Any:
        if isinstance(v, bool):
            return v
        if isinstance(v, str):
            try:
                return float(v.strip())
            except ValueError:
                return v
        return v


class FaultResponseSchema(BaseModel):
    id: str
    mission_id: str
    fault_type: str
    name: str
    description: str
    severity: str
    effects: Dict[str, float]
    started_at: int
    active: bool


# ── Command ──────────────────────────────────────────────────────────────────

class CommandSubmitSchema(BaseModel):
    command_type: str
    params: Dict[str, Any] = Field(default_factory=dict)


class CommandResponseSchema(BaseModel):
    id: str
    mission_id: str
    command_type: str
    params: Dict[str, Any]
    status: str
    result: Optional[str] = None
    rejected_reason: Optional[str] = None


# ── Black Box ─────────────────────────────────────────────────────────────────

class BlackBoxEventSchema(BaseModel):
    id: str
    missionDay: float
    timestamp: int
    eventType: str
    severity: str
    description: str
    source: str
    immutable: bool = True


# ── AI Analysis ───────────────────────────────────────────────────────────────

class AIReasoningStepSchema(BaseModel):
    step: int
    phase: str
    title: str
    detail: str
    status: str  # pending | running | complete
    confidence: float
    timestamp: int


class AIAnalysisSchema(BaseModel):
    phase: str = "monitoring"
    anomalyDetected: bool = False
    anomalyDescription: str = ""
    predictedFailure: str = ""
    probability: float = 0.0
    timeToFailureMin: float = 0.0
    recommendedAction: str = ""
    confidence: float = 0.0
    riskLevel: str = "low"
    dataSource: str = "backend-ai"
    reasoningSteps: List[AIReasoningStepSchema] = Field(default_factory=list)
    selectedStrategy: Optional[str] = None
    recoverySecondsRemaining: Optional[float] = None


# ── WebSocket Messages ─────────────────────────────────────────────────────────

class WSMessage(BaseModel):
    type: str
    payload: Any


# ── Report ────────────────────────────────────────────────────────────────────

class MissionReportSchema(BaseModel):
    mission_id: str
    mission_name: str
    mission_type: str
    destination: str
    objective: str
    budget_crore: float
    launch_site: Dict[str, Any]
    status: str
    mission_day: float
    objective_progress: float
    overall_health: float
    stats: Dict[str, Any]
    orbit_summary: Dict[str, Any]
    telemetry_stats: Dict[str, Any]
    incidents: List[Dict[str, Any]]
    ai_diagnoses: List[Dict[str, Any]]
    commands_executed: List[Dict[str, Any]]
    recovery_events: List[Dict[str, Any]]
    crew_summary: List[Dict[str, Any]]
    generated_at: int
