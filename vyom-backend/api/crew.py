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

def _engine_state_to_record(role: str, s: dict) -> dict:
    """Map a CrewHealthEngine state dict onto the CrewHealthRecordSchema shape."""
    return {
        "crew_id": s.get("role", role),
        "heart_rate_bpm": s.get("heart_rate_bpm", 72.0),
        "respiratory_rate": s.get("respiratory_rate_bpm", 14.0),
        "spo2_percent": s.get("spo2_percent", 99.0),
        "temperature_c": s.get("temperature_c", 36.8),
        "blood_pressure_sys": s.get("blood_pressure_sys", 120.0),
        "blood_pressure_dia": s.get("blood_pressure_dia", 80.0),
        "fatigue_index": s.get("fatigue", 0.0),
        "stress_index": s.get("stress", 0.0),
        "hydration_percent": s.get("hydration", 100.0),
        "radiation_dose_msv": s.get("radiation_dose_msv", 0.0),
        "o2_exposure_kpa": s.get("o2_exposure_kpa", 21.3),
        "co2_exposure_ppm": s.get("co2_exposure_ppm", 400.0),
        "workload_index": s.get("workload", 30.0),
        "eva_duration_min": s.get("eva_duration_min", 0.0),
        "suit_pressure_kpa": s.get("suit_pressure_kpa", 101.3),
        "location": s.get("location", "Command Module"),
        "spacecraft_module": s.get("spacecraft_module", "CM"),
        "current_task": s.get("current_task", "Monitoring"),
        "task_duration_min": s.get("task_duration_min", 0.0),
        "checklist_status": s.get("checklist_status", "in-progress"),
        "comm_status": s.get("comm_status", "nominal"),
        "tether_status": s.get("tether_status"),
        "data_quality": s.get("data_quality", "simulated"),
    }


@router.get("/health", response_model=List[CrewHealthRecordSchema])
def get_crew_health(mission_id: str, db: Session = Depends(get_db)):
    sim = get_simulation(mission_id)
    if sim and hasattr(sim, 'crew_health_engine'):
        state = sim.crew_health_engine.get_crew_state()
        return [_engine_state_to_record(role, s) for role, s in state.items()]

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
