"""
VYOM Backend — Fault Injection API Router
"""
import time
import uuid
from typing import List
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, ActiveFault as FaultRecord, BlackBoxEvent as BBEvent
from core.schemas import FaultInjectSchema, FaultResponseSchema
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
    )
    db.add(db_fault)

    # Log to black box
    ev = BBEvent(
        id=f"bb-fault-{int(time.time()*1000)}-{uuid.uuid4().hex[:4]}",
        mission_id=mission_id,
        mission_day=sim.mission_day,
        timestamp=int(time.time() * 1000),
        event_type="threat",
        severity="critical" if fault.severity >= 7 else "warning",
        description=f"FAULT INJECTED: {fault.name} — {fault.description}",
        source="Fault Injection System",
    )
    db.add(ev)
    db.commit()

    # Broadcast to WS clients
    if sim.broadcast_callback:
        await sim.broadcast_callback([
            {
                "type": "THREAT_DETECTED",
                "payload": {
                    "id": fault.id,
                    "type": fault.fault_type,
                    "name": fault.name,
                    "description": fault.description,
                    "active": True,
                    "severity": "critical" if fault.severity >= 7 else "warning",
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
        ])

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

    # Log to BB
    ev = BBEvent(
        id=f"bb-mitigation-{int(time.time()*1000)}-{uuid.uuid4().hex[:4]}",
        mission_id=mission_id,
        mission_day=sim.mission_day,
        timestamp=int(time.time() * 1000),
        event_type="recovery",
        severity="nominal",
        description=f"Fault {fault_id} manually mitigated by ground control",
        source="Ground Control",
    )
    db.add(ev)
    db.commit()

    if sim.broadcast_callback:
        await sim.broadcast_callback([
            {"type": "THREAT_MITIGATED", "payload": {"id": fault_id, "mission_id": mission_id}},
        ])

    return {"status": "mitigated", "fault_id": fault_id}
