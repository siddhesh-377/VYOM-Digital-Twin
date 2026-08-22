"""
VYOM Backend — Fault Injection API Router
"""
import time
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, ActiveFault as FaultRecord, Incident as IncidentRecord
from core.blackbox import append_event
from core.schemas import FaultInjectSchema, FaultResponseSchema
from engines.telemetry_engine import build_telemetry_dict
from simulation.loop import get_simulation

router = APIRouter(prefix="/api/missions/{mission_id}/faults", tags=["faults"])


@router.post("", response_model=FaultResponseSchema, status_code=201)
async def inject_fault(mission_id: str, payload: FaultInjectSchema, db: Session = Depends(get_db)):
    """Inject a fault into the running simulation."""
    sim = get_simulation(mission_id)
    if not sim:
        raise HTTPException(404, f"Mission {mission_id} not running")

    try:
        fault = sim.fault_engine.inject_fault(
            payload.fault_type,
            severity=payload.severity,
            seed=payload.seed,
        )
    except ValueError as e:
        raise HTTPException(400, str(e))

    # ── v3.0: Create unique incident with normalized fault classification ──
    incident = sim.incident_engine.create_incident(
        fault_type=fault.fault_type,
        fault_id=fault.id,
        raw_error=fault.description,
        mission_id=mission_id,
        mission_day=sim.mission_day,
        effects=fault.effects,
        sim_time_s=sim.elapsed_sim_s,
    )
    # Attribute read by the simulation loop to link diagnosis/recovery phases
    fault.incident_id = incident["incident_id"]
    normalized = incident["normalized_fault"]
    severity_label = "critical" if fault.severity >= 7 else "warning"

    # Persist to DB
    db_fault = FaultRecord(
        id=fault.id,
        mission_id=mission_id,
        fault_type=fault.fault_type,
        name=fault.name,
        description=fault.description,
        severity=str(fault.severity),
        effects=fault.effects,
        started_at=int(fault.started_at * 1000),
        active=True,
        incident_id=incident["incident_id"],
        normalized_category=normalized["category"],
    )
    db.add(db_fault)

    # Persist the incident record (authoritative backend timestamps)
    db_incident = IncidentRecord(
        id=incident["incident_id"],
        mission_id=mission_id,
        fault_id=fault.id,
        raw_error=fault.description,
        normalized_fault_category=normalized["category"],
        normalized_subsystem=normalized["subsystem"],
        normalized_severity=severity_label,
        normalized_root_cause=normalized["root_cause"],
        confidence=normalized["confidence"],
        detection_time_ms=incident["detection_time_ms"],
        status="open",
        mission_day=sim.mission_day,
        created_at=int(time.time() * 1000),
    )
    db.add(db_incident)

    # Telemetry snapshot for post-hoc reconstruction
    telemetry_snapshot = build_telemetry_dict(sim.state, sim.mission_day)

    # Log to black box (hash-chained append-only)
    ev = append_event(
        db,
        id=f"bb-fault-{int(time.time()*1000)}-{uuid.uuid4().hex[:4]}",
        mission_id=mission_id,
        mission_day=sim.mission_day,
        timestamp=int(time.time() * 1000),
        event_type="threat",
        severity=severity_label,
        description=f"FAULT INJECTED: {fault.name} — {fault.description}",
        source="Fault Injection System",
        subsystem=normalized["subsystem"],
        raw_error=fault.description,
        normalized_fault=normalized["category"],
        incident_id=incident["incident_id"],
        spacecraft_state_json={
            "overall_health": round(getattr(sim.state, "overall_health", 0.0), 2),
            "battery_percent": round(getattr(sim.state, "battery_percent", 0.0), 2),
            "orbit": {
                "alt_km": round(getattr(sim.state.orbit, "altitude_km", 0.0), 2),
                "lat_deg": round(getattr(sim.state.orbit, "latitude_deg", 0.0), 4),
                "lng_deg": round(getattr(sim.state.orbit, "longitude_deg", 0.0), 4),
                "velocity_kms": round(getattr(sim.state.orbit, "velocity_kms", 0.0), 4),
            },
        },
        telemetry_snapshot_json=telemetry_snapshot,
    )
    db.add(ev)
    db.commit()

    # Broadcast to WS clients
    ws_messages = [
            {
                "type": "THREAT_DETECTED",
                "payload": {
                    "id": fault.id,
                    "type": fault.fault_type,
                    "name": fault.name,
                    "description": fault.description,
                    "active": True,
                    "severity": severity_label,
                    "startedAt": int(fault.started_at * 1000),
                    "effects": fault.effects,
                }
            },
            {
                "type": "BLACKBOX_EVENT",
                "payload": {
                    "id": ev.id,
                    "missionDay": sim.mission_day,
                    "timestamp": ev.timestamp,
                    "eventType": "threat",
                    "severity": ev.severity,
                    "description": ev.description,
                    "source": ev.source,
                    "immutable": True,
                }
            }
    ]
    # Send full incident info to Vyom AI consumers over WS
    ws_messages.append({
        "type": "INCIDENT_UPDATE",
        "payload": sim.incident_engine.get_incident(incident["incident_id"]),
    })
    if sim.broadcast_callback:
        await sim.broadcast_callback(ws_messages)

    return FaultResponseSchema(
        id=fault.id,
        mission_id=mission_id,
        fault_type=fault.fault_type,
        name=fault.name,
        description=fault.description,
        severity=str(fault.severity),
        effects=fault.effects,
        started_at=int(fault.started_at * 1000),
        active=True,
    )


@router.get("", response_model=List[FaultResponseSchema])
def list_faults(mission_id: str):
    """List active faults for a mission."""
    sim = get_simulation(mission_id)
    if not sim:
        return []
    return [
        FaultResponseSchema(
            id=f.id,
            mission_id=mission_id,
            fault_type=f.fault_type,
            name=f.name,
            description=f.description,
            severity=str(f.severity),
            effects=f.effects,
            started_at=int(f.started_at * 1000),
            active=f.active,
        )
        for f in sim.fault_engine.active_faults.values()
    ]


@router.delete("/{fault_id}", status_code=200)
async def mitigate_fault(mission_id: str, fault_id: str, db: Session = Depends(get_db)):
    """Mitigate (clear) a specific fault."""
    sim = get_simulation(mission_id)
    if not sim:
        raise HTTPException(404, "Mission not running")

    ok = sim.fault_engine.mitigate_fault(fault_id)
    if not ok:
        raise HTTPException(404, f"Fault {fault_id} not found or already mitigated")

    # ── v3.0: Close associated incident as a manual ground-control recovery ──
    incident_payload = None
    for f in sim.fault_engine.active_faults.values():
        if f.id == fault_id and getattr(f, "incident_id", None):
            inc_id = f.incident_id
            sim.incident_engine.record_decision(inc_id, "manual", "Ground Control Mitigation", sim.elapsed_sim_s)
            sim.incident_engine.start_recovery(inc_id, sim.elapsed_sim_s)
            sim.incident_engine.complete_recovery(inc_id, success=True, sim_time_s=sim.elapsed_sim_s)
            sim._sync_incident_to_db(inc_id)
            incident_payload = sim.incident_engine.get_incident(inc_id)
            break
    # Mark the DB fault row inactive
    db.query(FaultRecord).filter(FaultRecord.id == fault_id).update(
        {"active": False, "mitigated_at": int(time.time() * 1000)}
    )

    # Log to BB (hash-chained append-only)
    ev = append_event(
        db,
        id=f"bb-mitigation-{int(time.time()*1000)}-{uuid.uuid4().hex[:4]}",
        mission_id=mission_id,
        mission_day=sim.mission_day,
        timestamp=int(time.time() * 1000),
        event_type="recovery",
        severity="nominal",
        description=f"Fault {fault_id} manually mitigated by ground control",
        source="Ground Control",
        operator="ground-control",
        result="fault mitigated",
        recovery_status="resolved",
        incident_id=(incident_payload or {}).get("incident_id"),
        manual_intervention_json={
            "mode": "manual",
            "operator": "ground-control",
            "action": "direct mitigation",
            "timestamp": int(time.time() * 1000),
        },
    )
    db.add(ev)
    db.commit()

    if sim.broadcast_callback:
        ws = [
            {"type": "THREAT_MITIGATED", "payload": {"id": fault_id, "mission_id": mission_id}},
            {
                "type": "BLACKBOX_EVENT",
                "payload": {
                    "id": ev.id,
                    "missionDay": sim.mission_day,
                    "timestamp": ev.timestamp,
                    "eventType": "recovery",
                    "severity": ev.severity,
                    "description": ev.description,
                    "source": ev.source,
                    "immutable": True,
                }
            },
        ]
        if incident_payload:
            ws.append({"type": "INCIDENT_UPDATE", "payload": incident_payload})
        await sim.broadcast_callback(ws)

    return {"status": "mitigated", "fault_id": fault_id}
