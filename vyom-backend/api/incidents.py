"""
VYOM Backend — Incidents API Router
"""
import time
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db, Incident
from core.schemas import IncidentResponseSchema, ResolutionTimelineSchema, ManualActionSchema, RecoveryProcedureSchema
from engines.manual_recovery_engine import ManualRecoveryEngine

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
        total_resolution_ms=incident.total_resolution_ms
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
    return engine.get_recovery_procedures(incident.normalized_fault_category)

@router.post("/{incident_id}/manual-recovery")
def submit_manual_action(mission_id: str, incident_id: str, payload: ManualActionSchema, db: Session = Depends(get_db)):
    incident = db.query(Incident).filter(Incident.id == incident_id, Incident.mission_id == mission_id).first()
    if not incident:
        raise HTTPException(404, "Incident not found")
        
    engine = ManualRecoveryEngine()
    is_valid, reason = engine.validate_action(payload.procedure_id, incident.normalized_fault_category)
    if not is_valid:
        raise HTTPException(400, f"Invalid action: {reason}")
        
    if incident.normalized_severity == "view-only":
        raise HTTPException(403, "Action not permitted for view-only severity")
        
    payload.timestamp = int(time.time() * 1000)
    payload.result = "executed"
    
    actions = incident.manual_actions_json or []
    actions.append(payload.model_dump())
    incident.manual_actions_json = actions
    db.commit()
    
    return {"status": "success", "action_result": "executed"}
