"""
VYOM Backend — Telemetry & Blackbox API Routers
"""
import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, TelemetryRecord, BlackBoxEvent as BBEvent
from core.schemas import CommandSubmitSchema, CommandResponseSchema
from simulation.loop import get_simulation

telemetry_router = APIRouter(prefix="/api/missions/{mission_id}/telemetry", tags=["telemetry"])
blackbox_router  = APIRouter(prefix="/api/missions/{mission_id}/blackbox", tags=["blackbox"])
commands_router  = APIRouter(prefix="/api/missions/{mission_id}/commands", tags=["commands"])


# ── Telemetry ─────────────────────────────────────────────────────────────────

@telemetry_router.get("")
def get_latest_telemetry(mission_id: str):
    """Get latest live telemetry for a mission."""
    sim = get_simulation(mission_id)
    if not sim:
        raise HTTPException(404, "Simulation not running")
    from engines.telemetry_engine import build_telemetry_dict
    return build_telemetry_dict(sim.state, sim.mission_day)


@telemetry_router.get("/history")
def get_telemetry_history(
    mission_id: str,
    limit: int = Query(300, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    """Get historical telemetry records from DB."""
    records = (
        db.query(TelemetryRecord)
        .filter(TelemetryRecord.mission_id == mission_id)
        .order_by(TelemetryRecord.sim_timestamp.desc())
        .limit(limit)
        .all()
    )
    return [r.data for r in reversed(records)]


@telemetry_router.get("/orbit/trajectory")
def get_orbit_trajectory(mission_id: str, limit: int = Query(600, ge=10, le=1000)):
    """Get orbit trail for this mission."""
    sim = get_simulation(mission_id)
    if not sim:
        return []
    return sim.orbit_trail[-limit:]


# ── Black Box ─────────────────────────────────────────────────────────────────

@blackbox_router.get("")
def get_blackbox(
    mission_id: str,
    event_type: Optional[str] = None,
    severity: Optional[str] = None,
    limit: int = Query(200, ge=1, le=2000),
    db: Session = Depends(get_db),
):
    """Get black box events for a mission (with v3.0 audit fields)."""
    q = db.query(BBEvent).filter(BBEvent.mission_id == mission_id)
    if event_type:
        q = q.filter(BBEvent.event_type == event_type)
    if severity:
        q = q.filter(BBEvent.severity == severity)
    events = q.order_by(BBEvent.timestamp.desc()).limit(limit).all()
    return [
        {
            "id": e.id,
            "missionDay": e.mission_day,
            "timestamp": e.timestamp,
            "eventType": e.event_type,
            "severity": e.severity,
            "description": e.description,
            "source": e.source,
            "immutable": True,
            # ── v3.0 audit fields ──
            "subsystem": e.subsystem,
            "crewId": e.crew_id,
            "rawError": e.raw_error,
            "normalizedFault": e.normalized_fault,
            "operator": e.operator,
            "commandProcedure": e.command_procedure,
            "result": e.result,
            "recoveryStatus": e.recovery_status,
            "incidentId": e.incident_id,
            "correctionOf": e.correction_of,
            "modelVersion": e.model_version,
            "eventHash": e.event_hash,
            "prevHash": e.prev_hash,
        }
        for e in reversed(events)
    ]


@blackbox_router.get("/verify")
def verify_blackbox_chain(mission_id: str, db: Session = Depends(get_db)):
    """Verify the tamper-evident hash chain of the mission Black Box."""
    from core.blackbox import verify_chain
    return verify_chain(db, mission_id)


@blackbox_router.post("/corrections", status_code=201)
def create_correction_event(
    mission_id: str,
    payload: dict,
    db: Session = Depends(get_db),
):
    """Create a correction event referencing an original Black Box record.

    The original record is never modified or deleted (append-only history).
    Body: {original_event_id, description, corrected_by?, reason?}
    """
    from core.blackbox import append_event
    original_id = payload.get("original_event_id")
    if not original_id:
        raise HTTPException(400, "original_event_id is required")
    original = db.query(BBEvent).filter(BBEvent.id == original_id, BBEvent.mission_id == mission_id).first()
    if not original:
        raise HTTPException(404, "Original event not found")

    ev = append_event(
        db,
        id=f"bb-correction-{int(time.time()*1000)}-{uuid.uuid4().hex[:4]}",
        mission_id=mission_id,
        mission_day=original.mission_day,
        timestamp=int(time.time() * 1000),
        event_type="correction",
        severity="nominal",
        description=payload.get("description") or f"Correction of event {original_id}",
        source=payload.get("corrected_by") or "Ground Control",
        correction_of=original_id,
        operator=payload.get("corrected_by"),
    )
    db.commit()
    return {
        "status": "created",
        "correction_event_id": ev.id,
        "corrects_event": original_id,
        "note": "Original record preserved unmodified (append-only)",
    }


@blackbox_router.get("/export")
def export_blackbox(mission_id: str, db: Session = Depends(get_db)):
    """Export complete black box log as JSON."""
    events = (
        db.query(BBEvent)
        .filter(BBEvent.mission_id == mission_id)
        .order_by(BBEvent.timestamp.asc())
        .all()
    )
    return {
        "mission_id": mission_id,
        "exported_at": int(time.time() * 1000),
        "total_events": len(events),
        "events": [
            {
                "id": e.id,
                "missionDay": e.mission_day,
                "timestamp": e.timestamp,
                "eventType": e.event_type,
                "severity": e.severity,
                "description": e.description,
                "source": e.source,
                # ── v3.0 audit fields ──
                "subsystem": e.subsystem,
                "crewId": e.crew_id,
                "rawError": e.raw_error,
                "normalizedFault": e.normalized_fault,
                "aiAnalysis": e.ai_analysis_json,
                "manualIntervention": e.manual_intervention_json,
                "operator": e.operator,
                "commandProcedure": e.command_procedure,
                "result": e.result,
                "recoveryStatus": e.recovery_status,
                "incidentId": e.incident_id,
                "correctionOf": e.correction_of,
                "modelVersion": e.model_version,
                "eventHash": e.event_hash,
                "prevHash": e.prev_hash,
            }
            for e in events
        ],
    }


# ── Commands ──────────────────────────────────────────────────────────────────

@commands_router.post("", response_model=CommandResponseSchema)
async def submit_command(mission_id: str, payload: CommandSubmitSchema, db: Session = Depends(get_db)):
    """Submit a ground control command."""
    sim = get_simulation(mission_id)
    if not sim:
        raise HTTPException(404, "Simulation not running")

    cmd = sim.cmd_engine.submit(payload.command_type, payload.params, sim.state, sim.mission_day)

    # Persist command to DB
    from core.database import CommandRecord
    db_cmd = CommandRecord(
        id=cmd.id,
        mission_id=mission_id,
        mission_day=cmd.mission_day,
        command_type=cmd.command_type,
        params=cmd.params,
        status=cmd.status,
        rejected_reason=cmd.rejected_reason,
    )
    db.add(db_cmd)
    db.commit()

    return CommandResponseSchema(
        id=cmd.id,
        mission_id=mission_id,
        command_type=cmd.command_type,
        params=cmd.params,
        status=cmd.status,
        result=cmd.result,
        rejected_reason=cmd.rejected_reason,
    )


@commands_router.get("")
def list_commands(mission_id: str):
    """List command history for a mission."""
    sim = get_simulation(mission_id)
    if not sim:
        return []
    return sim.cmd_engine.to_dict_list()


@commands_router.get("/{cmd_id}")
def get_command(mission_id: str, cmd_id: str):
    """Get status of a specific command."""
    sim = get_simulation(mission_id)
    if not sim:
        raise HTTPException(404, "Simulation not running")
    cmd = sim.cmd_engine.commands.get(cmd_id)
    if not cmd:
        raise HTTPException(404, f"Command {cmd_id} not found")
    return {
        "id": cmd.id,
        "command_type": cmd.command_type,
        "status": cmd.status,
        "result": cmd.result,
        "rejected_reason": cmd.rejected_reason,
    }
