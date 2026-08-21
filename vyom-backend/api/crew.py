"""
VYOM Backend — Crew API Router
"""
from typing import List
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, CrewHealthRecord, DailySummary
from core.schemas import CrewHealthRecordSchema
from simulation.loop import get_simulation

router = APIRouter(prefix="/api/missions/{mission_id}/crew", tags=["crew"])

@router.get("/health", response_model=List[CrewHealthRecordSchema])
def get_crew_health(mission_id: str, db: Session = Depends(get_db)):
    sim = get_simulation(mission_id)
    if sim and hasattr(sim, 'crew_health_engine'):
        return sim.crew_health_engine.get_crew_state()
        
    records = db.query(CrewHealthRecord).filter(CrewHealthRecord.mission_id == mission_id).order_by(CrewHealthRecord.timestamp.desc()).limit(10).all()
    result = {}
    for r in records:
        if r.crew_id not in result:
            result[r.crew_id] = r
    return list(result.values())

@router.get("/health/history")
def get_crew_history(mission_id: str, crew_id: str = None, limit: int = Query(200, ge=1, le=1000), db: Session = Depends(get_db)):
    q = db.query(CrewHealthRecord).filter(CrewHealthRecord.mission_id == mission_id)
    if crew_id:
        q = q.filter(CrewHealthRecord.crew_id == crew_id)
    records = q.order_by(CrewHealthRecord.timestamp.desc()).limit(limit).all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in records]

@router.get("/daily-summary/{day}")
def get_daily_crew_summary(mission_id: str, day: int, db: Session = Depends(get_db)):
    record = db.query(DailySummary).filter(DailySummary.mission_id == mission_id, DailySummary.mission_day == day).first()
    if not record:
        raise HTTPException(404, "Summary not found")
    
    return record.summary_json.get('crew_summary', {})
