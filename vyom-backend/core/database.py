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


def init_db():
    Base.metadata.create_all(bind=engine)


def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()
