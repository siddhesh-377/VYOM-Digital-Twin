"""
VYOM Backend — Objectives API Router
"""
import time
import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, MissionObjective
from core.schemas import MissionObjectiveSchema, MissionObjectiveResponseSchema

router = APIRouter(prefix="/api/missions/{mission_id}/objectives", tags=["objectives"])

@router.get("", response_model=List[MissionObjectiveResponseSchema])
def list_objectives(mission_id: str, db: Session = Depends(get_db)):
    objectives = db.query(MissionObjective).filter(MissionObjective.mission_id == mission_id).order_by(MissionObjective.order_index).all()
    return objectives

@router.post("", response_model=MissionObjectiveResponseSchema, status_code=201)
def create_objective(mission_id: str, payload: MissionObjectiveSchema, db: Session = Depends(get_db)):
    obj_id = payload.id or f"OBJ-{uuid.uuid4().hex[:8]}"
    
    obj = MissionObjective(
        id=obj_id,
        mission_id=mission_id,
        name=payload.name,
        description=payload.description,
        weight=payload.weight,
        status=payload.status,
        criteria=payload.criteria,
        order_index=payload.order_index
    )
    db.add(obj)
    db.commit()
    db.refresh(obj)
    return obj

@router.patch("/{obj_id}", response_model=MissionObjectiveResponseSchema)
def update_objective(mission_id: str, obj_id: str, payload: Dict[str, Any], db: Session = Depends(get_db)):
    obj = db.query(MissionObjective).filter(MissionObjective.id == obj_id, MissionObjective.mission_id == mission_id).first()
    if not obj:
        raise HTTPException(404, "Objective not found")
        
    if "status" in payload:
        obj.status = payload["status"]
        if obj.status == "completed":
            obj.completed_at = int(time.time() * 1000)
    
    if "completed_at" in payload:
        obj.completed_at = payload["completed_at"]
        
    if "mission_day_completed" in payload:
        obj.mission_day_completed = payload["mission_day_completed"]
        
    db.commit()
    db.refresh(obj)
    return obj
