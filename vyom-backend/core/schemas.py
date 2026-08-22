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
    architectureId: Optional[str] = None
    endGoal: Optional[str] = None  # intended end-of-mission goal, declared at creation
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
    # ── v3.0 additions (all optional for backward compat) ──
    mission_phase: Optional[str] = None
    rul_days: Optional[float] = None
    risk_history: List[Dict[str, Any]] = Field(default_factory=list)
    daily_summaries: List[Dict[str, Any]] = Field(default_factory=list)
    trajectory_summary: Optional[Dict[str, Any]] = None
    failure_analysis: List[Dict[str, Any]] = Field(default_factory=list)
    ai_vs_manual_comparison: Optional[Dict[str, Any]] = None
    crew_health_summary: List[Dict[str, Any]] = Field(default_factory=list)
    lifecycle_history: List[Dict[str, Any]] = Field(default_factory=list)
    farewell_assessment: Optional[Dict[str, Any]] = None
    objectives_detail: List[Dict[str, Any]] = Field(default_factory=list)
    activities_summary: List[Dict[str, Any]] = Field(default_factory=list)


# ════════════════════════════════════════════════════════════════════════════
# NEW v3.0 SCHEMAS
# ════════════════════════════════════════════════════════════════════════════

# ── Incident ─────────────────────────────────────────────────────────────────

class IncidentResponseSchema(BaseModel):
    id: str
    mission_id: str
    fault_id: Optional[str] = None
    raw_error: str = ""
    normalized_fault_category: Optional[str] = None
    normalized_subsystem: Optional[str] = None
    normalized_severity: str = "warning"
    normalized_root_cause: Optional[str] = None
    confidence: float = 0.0
    detection_time_ms: Optional[int] = None
    diagnosis_time_ms: Optional[int] = None
    decision_time_ms: Optional[int] = None
    recovery_start_time_ms: Optional[int] = None
    recovery_end_time_ms: Optional[int] = None
    total_resolution_ms: Optional[int] = None
    recovery_mode: Optional[str] = None
    ai_analysis_json: Optional[Dict[str, Any]] = None
    manual_actions_json: Optional[List[Dict[str, Any]]] = None
    status: str = "open"
    mission_day: float = 0.0
    created_at: int = 0


class ResolutionTimelineSchema(BaseModel):
    """Timeline of incident resolution timestamps."""
    incident_id: str
    detection_time_ms: Optional[int] = None
    diagnosis_time_ms: Optional[int] = None
    diagnosis_duration_ms: Optional[int] = None
    decision_time_ms: Optional[int] = None
    decision_duration_ms: Optional[int] = None
    recovery_start_time_ms: Optional[int] = None
    recovery_end_time_ms: Optional[int] = None
    recovery_duration_ms: Optional[int] = None
    total_resolution_ms: Optional[int] = None
    # Simulation-clock timeline (authoritative under time acceleration)
    detection_sim_s: Optional[float] = None
    diagnosis_sim_s: Optional[float] = None
    decision_sim_s: Optional[float] = None
    recovery_start_sim_s: Optional[float] = None
    recovery_end_sim_s: Optional[float] = None
    total_resolution_sim_s: Optional[float] = None


# ── Manual Recovery ──────────────────────────────────────────────────────────

class ManualActionSchema(BaseModel):
    incident_id: str
    operator: str = "Ground Control"
    procedure_id: str
    command: str = ""
    result: str = ""
    timestamp: int = 0
    confirmed: bool = False  # operator confirmation required for execution


class RecoveryProcedureSchema(BaseModel):
    id: str
    name: str
    description: str
    applicable_faults: List[str]
    severity_level: str
    steps: List[str]
    commands: List[str]
    estimated_duration_s: float
    risk_level: str
    requires_confirmation: bool = True
    execution_mode: Optional[str] = None  # execute | execute-after-confirmation | view-only


# ── Crew Health ──────────────────────────────────────────────────────────────

class CrewHealthRecordSchema(BaseModel):
    crew_id: str
    heart_rate_bpm: float = 72.0
    respiratory_rate: float = 14.0
    spo2_percent: float = 99.0
    temperature_c: float = 36.8
    blood_pressure_sys: float = 120.0
    blood_pressure_dia: float = 80.0
    fatigue_index: float = 10.0
    stress_index: float = 15.0
    hydration_percent: float = 92.0
    radiation_dose_msv: float = 0.0
    o2_exposure_kpa: float = 21.3
    co2_exposure_ppm: float = 400.0
    workload_index: float = 30.0
    eva_duration_min: float = 0.0
    suit_pressure_kpa: float = 101.3
    location: str = "Command Module"
    spacecraft_module: str = "CM"
    current_task: str = "Monitoring"
    task_duration_min: float = 0.0
    checklist_status: str = "pending"
    comm_status: str = "nominal"
    tether_status: Optional[str] = None
    data_quality: str = "simulated"


# ── Daily Summary ────────────────────────────────────────────────────────────

class DailySummarySchema(BaseModel):
    mission_day: int
    summary_json: Dict[str, Any]
    orbital_path_json: Optional[List[Dict[str, Any]]] = None


# ── Scheduled Activity ───────────────────────────────────────────────────────

class ScheduledActivityCreateSchema(BaseModel):
    name: str = Field(min_length=1)
    description: str = ""
    mission_phase: str = "primary-mission"
    objective_id: Optional[str] = None
    responsible_system: str = "System"
    crew_id: Optional[str] = None
    planned_start_day: float
    planned_end_day: float
    dependencies: List[str] = Field(default_factory=list)


class ScheduledActivityResponseSchema(BaseModel):
    id: str
    mission_id: str
    name: str
    description: str
    mission_phase: str
    objective_id: Optional[str] = None
    responsible_system: str
    crew_id: Optional[str] = None
    planned_start_day: float
    planned_end_day: float
    actual_start_day: Optional[float] = None
    actual_end_day: Optional[float] = None
    status: str
    dependencies: List[str]
    delay_days: float
    result: Optional[str] = None


# ── Mission Objective ────────────────────────────────────────────────────────

class MissionObjectiveSchema(BaseModel):
    id: Optional[str] = None
    name: str = Field(min_length=1)
    description: str = ""
    weight: float = 0.1
    status: str = "pending"
    criteria: Dict[str, Any] = Field(default_factory=dict)
    order_index: int = 0


class MissionObjectiveResponseSchema(BaseModel):
    id: str
    mission_id: str
    name: str
    description: str
    weight: float
    status: str
    completed_at: Optional[int] = None
    mission_day_completed: Optional[float] = None
    criteria: Dict[str, Any]
    order_index: int


# ── Risk Assessment ──────────────────────────────────────────────────────────

class RiskFactorSchema(BaseModel):
    name: str
    score: float
    weight: float
    trend: str = "stable"


class RiskAssessmentSchema(BaseModel):
    risk_score: float
    risk_category: str  # LOW|MODERATE|HIGH|CRITICAL
    contributing_factors: List[RiskFactorSchema]
    confidence: float
    trend: str
    explanation: str
    mission_day: float
    timestamp: int


# ── Spacecraft Architecture ──────────────────────────────────────────────────

class SpacecraftArchitectureSchema(BaseModel):
    id: str
    name: str
    category: str
    description: str
    subsystems_json: List[Dict[str, Any]]
    power_config: Dict[str, Any]
    propulsion_config: Dict[str, Any]
    comms_config: Dict[str, Any]
    thermal_config: Dict[str, Any]
    mission_constraints: Dict[str, Any]
    failure_modes: List[Dict[str, Any]]
    disposal_options: List[str]
    is_human_rated: bool


# ── Farewell Assessment ──────────────────────────────────────────────────────

class FarewellAssessmentSchema(BaseModel):
    id: str
    mission_id: str
    mission_day: float
    spacecraft_health: float
    objective_completion: float
    propellant_remaining: float
    power_margin: float
    thermal_margin: float
    gnc_capability: float
    comm_capability: float
    rul_days: float
    crew_safety_score: Optional[float] = None
    return_feasibility: Optional[float] = None
    monte_carlo_results: Optional[Dict[str, Any]] = None
    recommended_option: str
    alternatives_considered: List[Dict[str, Any]]
    reasoning: str
    assessment_type: str


# ── Scenario Comparison ──────────────────────────────────────────────────────

class ScenarioCreateSchema(BaseModel):
    name: str = Field(min_length=1)
    fault_injections: List[Dict[str, Any]]  # [{fault_type, severity}]
    duration_days: float = 10.0


class ScenarioComparisonSchema(BaseModel):
    baseline_id: str
    scenarios: List[Dict[str, Any]]
    comparison: Dict[str, Any]  # metric -> {baseline, scenario_1, ...}


# ── Trajectory ───────────────────────────────────────────────────────────────

class TrajectoryStateSchema(BaseModel):
    planned_path: List[Dict[str, Any]]
    actual_path: List[Dict[str, Any]]
    deviation: Dict[str, Any]
    predicted_future: List[Dict[str, Any]]
    maneuver_points: List[Dict[str, Any]]
    target_location: Optional[Dict[str, Any]] = None


# ── Enhanced BlackBox ────────────────────────────────────────────────────────

class EnhancedBlackBoxEventSchema(BaseModel):
    """Extended black box event with full audit context."""
    id: str
    missionDay: float
    timestamp: int
    eventType: str
    severity: str
    description: str
    source: str
    immutable: bool = True
    # v3.0 fields
    subsystem: Optional[str] = None
    crew_id: Optional[str] = None
    raw_error: Optional[str] = None
    normalized_fault: Optional[str] = None
    incident_id: Optional[str] = None
    recovery_status: Optional[str] = None
    correction_of: Optional[str] = None
    model_version: str = "3.0.0"

