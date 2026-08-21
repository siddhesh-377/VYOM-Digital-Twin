"""
VYOM Backend — Activities API Router
"""
import time
import uuid
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, ScheduledActivity
from core.schemas import ScheduledActivityCreateSchema, ScheduledActivityResponseSchema

router = APIRouter(prefix="/api/missions/{mission_id}/activities", tags=["activities"])

@router.get("", response_model=List[ScheduledActivityResponseSchema])
def list_activities(mission_id: str, status: Optional[str] = None, db: Session = Depends(get_db)):
    q = db.query(ScheduledActivity).filter(ScheduledActivity.mission_id == mission_id)
    if status:
        q = q.filter(ScheduledActivity.status == status)
    activities = q.order_by(ScheduledActivity.planned_start_day).all()
    return activities

@router.post("", response_model=ScheduledActivityResponseSchema, status_code=201)
def create_activity(mission_id: str, payload: ScheduledActivityCreateSchema, db: Session = Depends(get_db)):
    act_id = f"ACT-{uuid.uuid4().hex[:8]}"
    now = int(time.time() * 1000)
    
    act = ScheduledActivity(
        id=act_id,
        mission_id=mission_id,
        name=payload.name,
        description=payload.description,
        mission_phase=payload.mission_phase,
        objective_id=payload.objective_id,
        responsible_system=payload.responsible_system,
        crew_id=payload.crew_id,
        planned_start_day=payload.planned_start_day,
        planned_end_day=payload.planned_end_day,
        dependencies=payload.dependencies,
        created_at=now,
        updated_at=now
    )
    db.add(act)
    db.commit()
    db.refresh(act)
    return act

@router.patch("/{act_id}", response_model=ScheduledActivityResponseSchema)
def update_activity(mission_id: str, act_id: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    act = db.query(ScheduledActivity).filter(ScheduledActivity.id == act_id, ScheduledActivity.mission_id == mission_id).first()
    if not act:
        raise HTTPException(404, "Activity not found")
        
    for key in ["status", "actual_start_day", "actual_end_day", "result", "delay_days"]:
        if key in payload:
            setattr(act, key, payload[key])
            
    act.updated_at = int(time.time() * 1000)
    db.commit()
    db.refresh(act)
    return act
