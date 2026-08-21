"""VYOM Backend — Database models and connection setup (SQLite by default)."""
import os
from sqlalchemy import create_engine, Column, Integer, String, Float, Text, Boolean, BigInteger, JSON
from sqlalchemy.orm import declarative_base, sessionmaker, Session

DATABASE_URL = os.getenv("VYOM_DATABASE_URL", "sqlite:///./vyom_missions.db")

engine = create_engine(
    DATABASE_URL,
    connect_args={"check_same_thread": False} if DATABASE_URL.startswith("sqlite") else {},
    echo=False,
)
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()


# ── ORM Models ──────────────────────────────────────────────────────────────

class Mission(Base):
    __tablename__ = "missions"
    id              = Column(String, primary_key=True, index=True)
    name            = Column(String, nullable=False)
    mission_type    = Column(String, default="orbital")
    destination     = Column(String, default="earth-orbit")
    status          = Column(String, default="configuring")  # configuring|active|paused|completed|failed
    objective       = Column(Text, default="")
    budget_crore    = Column(Float, default=0.0)
    launch_site     = Column(JSON, default=dict)
    config_json     = Column(JSON, default=dict)
    satellite_json  = Column(JSON, default=dict)
    crew_json       = Column(JSON, default=list)
    time_multiplier = Column(Integer, default=1)
    mission_day     = Column(Float, default=0.0)
    objective_progress = Column(Float, default=0.0)
    overall_health  = Column(Float, default=100.0)
    created_at      = Column(BigInteger, default=0)
    started_at      = Column(BigInteger, nullable=True)
    # ── v3.0 additions (all nullable for backward compat) ──
    architecture_id     = Column(String, nullable=True)
    mission_phase       = Column(String, default="pre-launch")
    planned_end_day     = Column(Float, nullable=True)
    estimated_lifetime_days = Column(Float, nullable=True)
    rul_days            = Column(Float, nullable=True)
    end_goal            = Column(String, nullable=True)
    phase_transitions_json = Column(JSON, default=list)


class TelemetryRecord(Base):
    __tablename__ = "telemetry"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    mission_id      = Column(String, index=True, nullable=False)
    mission_day     = Column(Float, default=0.0)
    sim_timestamp   = Column(BigInteger, default=0)  # ms since epoch
    data            = Column(JSON, nullable=False)   # full Telemetry object


class BlackBoxEvent(Base):
    __tablename__ = "blackbox_events"
    id              = Column(String, primary_key=True)
    mission_id      = Column(String, index=True, nullable=False)
    mission_day     = Column(Float, default=0.0)
    timestamp       = Column(BigInteger, default=0)
    event_type      = Column(String, default="telemetry")
    severity        = Column(String, default="nominal")
    description     = Column(Text, default="")
    source          = Column(String, default="System")
    immutable       = Column(Boolean, default=True)
    # ── v3.0 additions (all nullable for backward compat) ──
    subsystem           = Column(String, nullable=True)
    crew_id             = Column(String, nullable=True)
    spacecraft_state_json = Column(JSON, nullable=True)
    telemetry_snapshot_json = Column(JSON, nullable=True)
    raw_error           = Column(Text, nullable=True)
    normalized_fault    = Column(String, nullable=True)
    ai_analysis_json    = Column(JSON, nullable=True)
    manual_intervention_json = Column(JSON, nullable=True)
    operator            = Column(String, nullable=True)
    command_procedure   = Column(Text, nullable=True)
    result              = Column(Text, nullable=True)
    recovery_status     = Column(String, nullable=True)
    incident_id         = Column(String, nullable=True)
    correction_of       = Column(String, nullable=True)  # references original event ID
    model_version       = Column(String, default="3.0.0")


class CommandRecord(Base):
    __tablename__ = "commands"
    id              = Column(String, primary_key=True)
    mission_id      = Column(String, index=True, nullable=False)
    mission_day     = Column(Float, default=0.0)
    command_type    = Column(String, nullable=False)
    params          = Column(JSON, default=dict)
    status          = Column(String, default="PENDING")
    validated_at    = Column(BigInteger, nullable=True)
    executed_at     = Column(BigInteger, nullable=True)
    acknowledged_at = Column(BigInteger, nullable=True)
    result          = Column(Text, nullable=True)
    rejected_reason = Column(Text, nullable=True)


class MissionSnapshot(Base):
    __tablename__ = "mission_snapshots"
    id              = Column(Integer, primary_key=True, autoincrement=True)
    mission_id      = Column(String, index=True, nullable=False)
    mission_day     = Column(Float, default=0.0)
    sim_timestamp   = Column(BigInteger, default=0)
    state_json      = Column(JSON, nullable=False)


class ActiveFault(Base):
    __tablename__ = "active_faults"
    id              = Column(String, primary_key=True)
    mission_id      = Column(String, index=True, nullable=False)
    fault_type      = Column(String, nullable=False)
    name            = Column(String, default="")
    description     = Column(Text, default="")
    severity        = Column(String, default="warning")
    effects         = Column(JSON, default=dict)
    started_at      = Column(BigInteger, default=0)
    mitigated_at    = Column(BigInteger, nullable=True)
    active          = Column(Boolean, default=True)
    # ── v3.0 additions ──
    incident_id         = Column(String, nullable=True)
    normalized_category = Column(String, nullable=True)


# ════════════════════════════════════════════════════════════════════════════
# NEW v3.0 TABLES
# ════════════════════════════════════════════════════════════════════════════

class Incident(Base):
    """Unique incident records linking faults to AI analysis and recovery."""
    __tablename__ = "incidents"
    id                  = Column(String, primary_key=True, index=True)  # INC-YYYYMMDD-NNN
    mission_id          = Column(String, index=True, nullable=False)
    fault_id            = Column(String, nullable=True)
    raw_error           = Column(Text, default="")
    normalized_fault_category = Column(String, nullable=True)  # e.g. propulsion-pressure
    normalized_subsystem = Column(String, nullable=True)
    normalized_severity = Column(String, default="warning")
    normalized_root_cause = Column(Text, nullable=True)
    confidence          = Column(Float, default=0.0)
    detection_time_ms   = Column(BigInteger, nullable=True)
    diagnosis_time_ms   = Column(BigInteger, nullable=True)
    decision_time_ms    = Column(BigInteger, nullable=True)
    recovery_start_time_ms = Column(BigInteger, nullable=True)
    recovery_end_time_ms = Column(BigInteger, nullable=True)
    total_resolution_ms = Column(BigInteger, nullable=True)
    recovery_mode       = Column(String, nullable=True)  # ai | manual
    ai_analysis_json    = Column(JSON, nullable=True)
    manual_actions_json = Column(JSON, nullable=True)
    status              = Column(String, default="open")  # open|diagnosing|recovering|resolved|failed
    mission_day         = Column(Float, default=0.0)
    created_at          = Column(BigInteger, default=0)


class CrewHealthRecord(Base):
    """Periodic crew health snapshots for human missions."""
    __tablename__ = "crew_health_records"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    mission_id          = Column(String, index=True, nullable=False)
    mission_day         = Column(Float, default=0.0)
    timestamp           = Column(BigInteger, default=0)
    crew_id             = Column(String, nullable=False)  # role-based, not name
    heart_rate_bpm      = Column(Float, default=72.0)
    respiratory_rate    = Column(Float, default=14.0)
    spo2_percent        = Column(Float, default=99.0)
    temperature_c       = Column(Float, default=36.8)
    blood_pressure_sys  = Column(Float, default=120.0)
    blood_pressure_dia  = Column(Float, default=80.0)
    fatigue_index       = Column(Float, default=10.0)
    stress_index        = Column(Float, default=15.0)
    hydration_percent   = Column(Float, default=92.0)
    radiation_dose_msv  = Column(Float, default=0.0)
    o2_exposure_kpa     = Column(Float, default=21.3)
    co2_exposure_ppm    = Column(Float, default=400.0)
    workload_index      = Column(Float, default=30.0)
    eva_duration_min    = Column(Float, default=0.0)
    suit_pressure_kpa   = Column(Float, default=101.3)
    location            = Column(String, default="Command Module")
    spacecraft_module   = Column(String, default="CM")
    current_task        = Column(String, default="Monitoring")
    task_duration_min   = Column(Float, default=0.0)
    checklist_status    = Column(String, default="pending")  # pending|in-progress|complete
    comm_status         = Column(String, default="nominal")  # nominal|degraded|lost
    tether_status       = Column(String, nullable=True)  # attached|detached (EVA only)
    data_quality        = Column(String, default="simulated")


class DailySummary(Base):
    """One record per mission day aggregating all mission state."""
    __tablename__ = "daily_summaries"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    mission_id          = Column(String, index=True, nullable=False)
    mission_day         = Column(Integer, default=0)
    summary_json        = Column(JSON, nullable=False)
    orbital_path_json   = Column(JSON, nullable=True)
    created_at          = Column(BigInteger, default=0)


class ScheduledActivity(Base):
    """Mission activity schedule with planned vs actual tracking."""
    __tablename__ = "scheduled_activities"
    id                  = Column(String, primary_key=True)
    mission_id          = Column(String, index=True, nullable=False)
    name                = Column(String, nullable=False)
    description         = Column(Text, default="")
    mission_phase       = Column(String, default="primary-mission")
    objective_id        = Column(String, nullable=True)
    responsible_system  = Column(String, default="System")
    crew_id             = Column(String, nullable=True)
    planned_start_day   = Column(Float, nullable=False)
    planned_end_day     = Column(Float, nullable=False)
    actual_start_day    = Column(Float, nullable=True)
    actual_end_day      = Column(Float, nullable=True)
    status              = Column(String, default="scheduled")  # scheduled|active|completed|delayed|cancelled|failed
    dependencies        = Column(JSON, default=list)
    delay_days          = Column(Float, default=0.0)
    result              = Column(Text, nullable=True)
    telemetry_snapshot_json = Column(JSON, nullable=True)
    event_ids           = Column(JSON, default=list)
    created_at          = Column(BigInteger, default=0)
    updated_at          = Column(BigInteger, default=0)


class MissionObjective(Base):
    """Structured mission objectives with weighting for progress calculation."""
    __tablename__ = "mission_objectives"
    id                  = Column(String, primary_key=True)
    mission_id          = Column(String, index=True, nullable=False)
    name                = Column(String, nullable=False)
    description         = Column(Text, default="")
    weight              = Column(Float, default=0.1)  # 0-1, all weights should sum to 1
    status              = Column(String, default="pending")  # pending|active|completed|delayed|failed
    completed_at        = Column(BigInteger, nullable=True)
    mission_day_completed = Column(Float, nullable=True)
    criteria            = Column(JSON, default=dict)
    order_index         = Column(Integer, default=0)


class MissionRiskHistory(Base):
    """Risk score snapshots over time."""
    __tablename__ = "mission_risk_history"
    id                  = Column(Integer, primary_key=True, autoincrement=True)
    mission_id          = Column(String, index=True, nullable=False)
    mission_day         = Column(Float, default=0.0)
    timestamp           = Column(BigInteger, default=0)
    risk_score          = Column(Float, default=0.0)
    risk_category       = Column(String, default="LOW")  # LOW|MODERATE|HIGH|CRITICAL
    contributing_factors = Column(JSON, default=list)
    confidence          = Column(Float, default=0.5)
    trend               = Column(String, default="stable")  # improving|stable|degrading


class SpacecraftArchitecture(Base):
    """Data-driven spacecraft architecture definitions."""
    __tablename__ = "spacecraft_architectures"
    id                  = Column(String, primary_key=True)
    name                = Column(String, nullable=False)
    category            = Column(String, default="General")
    description         = Column(Text, default="")
    subsystems_json     = Column(JSON, default=list)
    power_config        = Column(JSON, default=dict)
    propulsion_config   = Column(JSON, default=dict)
    comms_config        = Column(JSON, default=dict)
    thermal_config      = Column(JSON, default=dict)
    mission_constraints = Column(JSON, default=dict)
    failure_modes       = Column(JSON, default=list)
    disposal_options    = Column(JSON, default=list)
    is_human_rated      = Column(Boolean, default=False)


class FarewellAssessment(Base):
    """End-of-mission decision records."""
    __tablename__ = "farewell_assessments"
    id                  = Column(String, primary_key=True)
    mission_id          = Column(String, index=True, nullable=False)
    mission_day         = Column(Float, default=0.0)
    timestamp           = Column(BigInteger, default=0)
    spacecraft_health   = Column(Float, default=100.0)
    objective_completion = Column(Float, default=0.0)
    propellant_remaining = Column(Float, default=100.0)
    power_margin        = Column(Float, default=100.0)
    thermal_margin      = Column(Float, default=100.0)
    gnc_capability      = Column(Float, default=100.0)
    comm_capability     = Column(Float, default=100.0)
    rul_days            = Column(Float, default=0.0)
    crew_safety_score   = Column(Float, nullable=True)
    return_feasibility  = Column(Float, nullable=True)
    monte_carlo_results = Column(JSON, nullable=True)
    recommended_option  = Column(String, default="")
    alternatives_considered = Column(JSON, default=list)
    reasoning           = Column(Text, default="")
    assessment_type     = Column(String, default="automated")  # automated|operator-requested


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
