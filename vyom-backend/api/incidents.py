"""
VYOM Backend — Incidents API Router
"""
import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db, Incident, BlackBoxEvent as BBEvent
from core.schemas import IncidentResponseSchema, ResolutionTimelineSchema, ManualActionSchema, RecoveryProcedureSchema
from engines.manual_recovery_engine import ManualRecoveryEngine
from engines.spacecraft_state import SpacecraftState
from simulation.loop import get_simulation

# Maps normalized fault categories (FaultNormalizer) to canonical fault types
# understood by the manual recovery procedure library.
CATEGORY_TO_FAULTS = {
    "solar-radiation": ["solar_storm", "radiation_spike"],
    "communication-signal": ["comm_failure", "telemetry_loss"],
    "power-electrical": ["battery_failure", "solar_panel_degradation"],
    "thermal-control": ["thermal_overheating"],
    "attitude-control": ["attitude_control_failure"],
    "propulsion-pressure": ["propulsion_anomaly"],
    "sensor-data": ["sensor_failure"],
}


def _fault_types_for_category(category: str) -> List[str]:
    return CATEGORY_TO_FAULTS.get(category, [category])


def _get_state_for_mission(mission_id: str) -> SpacecraftState:
    """Live authoritative state if the simulation is running, else a default state."""
    sim = get_simulation(mission_id)
    return sim.state if sim else SpacecraftState()

router = APIRouter(prefix="/api/missions/{mission_id}/incidents", tags=["incidents"])

@router.get("", response_model=List[IncidentResponseSchema])
def list_incidents(mission_id: str, status: Optional[str] = None, limit: int = Query(50, ge=1, le=200), db: Session = Depends(get_db)):
    q = db.query(Incident).filter(Incident.mission_id == mission_id)
    if status:
        q = q.filter(Incident.status == status)
    incidents = q.order_by(Incident.created_at.desc()).limit(limit).all()
    return incidents

@router.get("/{incident_id}", response_model=IncidentResponseSchema)
def get_incident(mission_id: str, incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id, Incident.mission_id == mission_id).first()
    if not incident:
        raise HTTPException(404, "Incident not found")
    return incident

@router.get("/{incident_id}/timeline", response_model=ResolutionTimelineSchema)
def get_timeline(mission_id: str, incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id, Incident.mission_id == mission_id).first()
    if not incident:
        raise HTTPException(404, "Incident not found")
        
    timeline = ResolutionTimelineSchema(
        incident_id=incident.id,
        detection_time_ms=incident.detection_time_ms,
        diagnosis_time_ms=incident.diagnosis_time_ms,
        decision_time_ms=incident.decision_time_ms,
        recovery_start_time_ms=incident.recovery_start_time_ms,
        recovery_end_time_ms=incident.recovery_end_time_ms,
        total_resolution_ms=incident.total_resolution_ms,
        detection_sim_s=incident.detection_sim_s,
        diagnosis_sim_s=incident.diagnosis_sim_s,
        decision_sim_s=incident.decision_sim_s,
        recovery_start_sim_s=incident.recovery_start_sim_s,
        recovery_end_sim_s=incident.recovery_end_sim_s,
        total_resolution_sim_s=incident.total_resolution_sim_s,
    )
    if incident.diagnosis_time_ms and incident.detection_time_ms:
        timeline.diagnosis_duration_ms = incident.diagnosis_time_ms - incident.detection_time_ms
    if incident.decision_time_ms and incident.diagnosis_time_ms:
        timeline.decision_duration_ms = incident.decision_time_ms - incident.diagnosis_time_ms
    if incident.recovery_end_time_ms and incident.recovery_start_time_ms:
        timeline.recovery_duration_ms = incident.recovery_end_time_ms - incident.recovery_start_time_ms
        
    return timeline

@router.get("/{incident_id}/procedures", response_model=List[RecoveryProcedureSchema])
def get_procedures(mission_id: str, incident_id: str, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id, Incident.mission_id == mission_id).first()
    if not incident:
        raise HTTPException(404, "Incident not found")
        
    engine = ManualRecoveryEngine()
    severity = incident.normalized_severity or "warning"
    state = _get_state_for_mission(mission_id)
    procedures: List[RecoveryProcedureSchema] = []
    seen_ids = set()
    for fault_type in _fault_types_for_category(incident.normalized_fault_category or ""):
        for proc in engine.get_recovery_procedures(fault_type, severity):
            if proc.id in seen_ids:
                continue
            seen_ids.add(proc.id)
            validation = engine.validate_action(proc.id, state, severity)
            procedures.append(RecoveryProcedureSchema(
                id=proc.id,
                name=proc.name,
                description=proc.description,
                applicable_faults=proc.applicable_faults,
                severity_level=proc.severity_level,
                steps=proc.steps,
                commands=proc.commands,
                estimated_duration_s=proc.estimated_duration_s,
                risk_level=proc.risk_level,
                requires_confirmation=proc.requires_confirmation,
                execution_mode=validation.get("execution_mode"),
            ))
    return procedures

@router.post("/{incident_id}/manual-recovery")
def submit_manual_action(mission_id: str, incident_id: str, payload: ManualActionSchema, db: Session = Depends(get_db)):
    """Execute a validated manual recovery procedure.

    Severity-gated: critical incidents are reference/view-only. Every action,
    operator, procedure, command and result is recorded to the incident record
    and the Black Box. Commands are routed through the safety-validating
    CommandEngine — arbitrary unsafe spacecraft commands are never permitted.
    """
    incident = db.query(Incident).filter(Incident.id == incident_id, Incident.mission_id == mission_id).first()
    if not incident:
        raise HTTPException(404, "Incident not found")

    engine = ManualRecoveryEngine()
    severity = incident.normalized_severity or "warning"
    state = _get_state_for_mission(mission_id)
    validation = engine.validate_action(payload.procedure_id, state, severity)
    if not validation["valid"]:
        raise HTTPException(400, f"Invalid action: {validation['reason']}")

    execution_mode = validation.get("execution_mode", "execute")
    if execution_mode == "view-only":
        raise HTTPException(403, "Procedure is reference/view-only for this severity level")

    proc = engine.PROCEDURE_LIBRARY.get(payload.procedure_id)
    if proc is None:
        raise HTTPException(404, "Procedure not found")
    if proc.requires_confirmation and not payload.confirmed:
        raise HTTPException(400, "Operator confirmation required for this procedure")

    payload.timestamp = int(time.time() * 1000)

    sim = get_simulation(mission_id)
    command_results = []
    if sim:
        # Route procedure commands through the safety-validating CommandEngine
        for cmd_type in proc.commands:
            cmd = sim.cmd_engine.submit(cmd_type, {}, sim.state, sim.mission_day)
            command_results.append({
                "command": cmd.command_type,
                "status": cmd.status,
                "rejected_reason": cmd.rejected_reason,
            })
        # Begin autonomous recovery monitoring so completion time is measured
        # from actual telemetry, not assumed on submission
        for fault_type in _fault_types_for_category(incident.normalized_fault_category or ""):
            sim.recovery_eng.begin_monitoring(fault_type, sim.elapsed_sim_s)
        sim.incident_engine.record_decision(incident.id, "manual", payload.procedure_id, sim.elapsed_sim_s)
        sim.incident_engine.start_recovery(incident.id, sim.elapsed_sim_s)
        live = sim.incident_engine.get_incident(incident.id) or {}
        incident.recovery_start_time_ms = live.get("recovery_start_time_ms") or incident.recovery_start_time_ms
        if incident.status in ("open", "diagnosing"):
            incident.status = "recovering"

    rejected = [c for c in command_results if c["status"] == "REJECTED"]
    if command_results and len(rejected) == len(command_results):
        payload.result = "rejected"
        action_result = "rejected"
    else:
        payload.result = "executed" if command_results else "recorded"
        action_result = payload.result

    # Full audit trail on the incident record
    actions = incident.manual_actions_json or []
    actions.append(payload.model_dump())
    incident.manual_actions_json = actions
    incident.recovery_mode = "manual"

    # Black Box audit event (hash-chained append-only)
    from core.blackbox import append_event
    ev = append_event(
        db,
        id=f"bb-manual-{int(time.time()*1000)}-{uuid.uuid4().hex[:4]}",
        mission_id=mission_id,
        mission_day=incident.mission_day,
        timestamp=payload.timestamp,
        event_type="recovery",
        severity="nominal",
        description=f"Manual recovery: {proc.name} executed by {payload.operator}",
        source="Manual Recovery Console",
        subsystem=incident.normalized_subsystem,
        raw_error=incident.raw_error,
        normalized_fault=incident.normalized_fault_category,
        operator=payload.operator,
        command_procedure=f"{proc.id}: {', '.join(proc.commands)}",
        result=action_result,
        recovery_status="recovering",
        incident_id=incident.id,
        manual_intervention_json={
            "mode": "manual",
            "operator": payload.operator,
            "procedure_id": proc.id,
            "procedure_name": proc.name,
            "commands": command_results or proc.commands,
            "confirmed": payload.confirmed,
            "timestamp": payload.timestamp,
        },
    )
    db.add(ev)
    db.commit()

    return {
        "status": "success",
        "action_result": action_result,
        "execution_mode": execution_mode,
        "commands": command_results,
        "blackbox_event_id": ev.id,
    }
