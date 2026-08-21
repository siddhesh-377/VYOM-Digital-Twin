"""
VYOM Backend — Risk API Router
"""
from fastapi import APIRouter, Depends, Query, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, MissionRiskHistory
from simulation.loop import get_simulation

router = APIRouter(prefix="/api/missions/{mission_id}/risk", tags=["risk"])

@router.get("")
def get_current_risk(mission_id: str):
    sim = get_simulation(mission_id)
    if sim and hasattr(sim, 'risk_engine'):
        return sim.risk_engine.calculate_risk(sim.state)
    return {
        "risk_score": 0.0, 
        "risk_category": "LOW", 
        "contributing_factors": [], 
        "confidence": 1.0, 
        "trend": "stable", 
        "explanation": "No active simulation", 
        "mission_day": 0.0, 
        "timestamp": 0
    }

@router.get("/history")
def get_risk_history(mission_id: str, limit: int = Query(200, ge=1, le=1000), db: Session = Depends(get_db)):
    records = db.query(MissionRiskHistory).filter(MissionRiskHistory.mission_id == mission_id).order_by(MissionRiskHistory.timestamp.desc()).limit(limit).all()
    return [{c.name: getattr(r, c.name) for c in r.__table__.columns} for r in records]
