"""
VYOM Backend — Mission CRUD API Router
"""
import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from core.database import get_db, Mission
from core.schemas import MissionCreateSchema, MissionResponseSchema
from simulation.loop import (
    create_simulation, start_simulation, stop_simulation,
    pause_simulation, resume_simulation, set_time_multiplier, get_simulation
)

router = APIRouter(prefix="/api/missions", tags=["missions"])


@router.post("", response_model=MissionResponseSchema, status_code=201)
async def create_mission(payload: MissionCreateSchema, db: Session = Depends(get_db)):
    """Create a new mission and initialize simulation (but don't start it yet)."""
    mission_id = payload.id or f"VYOM-{uuid.uuid4().hex[:8].upper()}"

    # Check if already exists
    existing = db.query(Mission).filter(Mission.id == mission_id).first()
    if existing:
        return _to_response(existing)

    mission = Mission(
        id=mission_id,
        name=payload.name,
        mission_type=payload.type,
        destination=payload.destination,
        status="configuring",
        objective=payload.objective,
        budget_crore=payload.budgetCrore,
        launch_site=payload.launchSite.model_dump(),
        config_json=payload.model_dump(),
        crew_json=[c.model_dump() for c in payload.crew],
        satellite_json=payload.satellite or {},
        time_multiplier=1,
        mission_day=0.0,
        objective_progress=0.0,
        overall_health=100.0,
        created_at=int(time.time() * 1000),
    )
    db.add(mission)
    db.commit()
    db.refresh(mission)

    # Create simulation instance (not started)
    sim_config = {
        "initial_alt_km": 650.0,
        "inclination_deg": 51.6,
        "control_mode": "autonomous",
        "type": payload.type,
        "destination": payload.destination,
    }
    create_simulation(mission_id, sim_config)

    return _to_response(mission)


@router.get("", response_model=List[MissionResponseSchema])
def list_missions(db: Session = Depends(get_db)):
    missions = db.query(Mission).order_by(Mission.created_at.desc()).limit(50).all()
    return [_to_response(m) for m in missions]


@router.get("/{mission_id}", response_model=MissionResponseSchema)
def get_mission(mission_id: str, db: Session = Depends(get_db)):
    m = _get_or_404(mission_id, db)
    # Sync from live simulation if running
    sim = get_simulation(mission_id)
    if sim:
        m.mission_day = sim.mission_day
        m.objective_progress = sim.objective_progress
        m.overall_health = sim.state.overall_health
        m.status = sim.status
    return _to_response(m)


@router.post("/{mission_id}/start", status_code=200)
async def start_mission(mission_id: str, db: Session = Depends(get_db)):
    m = _get_or_404(mission_id, db)

    # Ensure simulation exists
    sim = get_simulation(mission_id)
    if not sim:
        cfg = {
            "initial_alt_km": 650.0,
            "inclination_deg": 51.6,
            "control_mode": "autonomous",
            "type": m.mission_type,
            "destination": m.destination,
        }
        create_simulation(mission_id, cfg)

    success = await start_simulation(mission_id)
    if not success:
        raise HTTPException(500, "Failed to start simulation")

    m.status = "active"
    m.started_at = int(time.time() * 1000)
    db.commit()

    return {"status": "started", "mission_id": mission_id}


@router.post("/{mission_id}/pause", status_code=200)
def pause_mission(mission_id: str, db: Session = Depends(get_db)):
    m = _get_or_404(mission_id, db)
    ok = pause_simulation(mission_id)
    if ok:
        m.status = "paused"
        db.commit()
    return {"status": "paused" if ok else "not_running", "mission_id": mission_id}


@router.post("/{mission_id}/resume", status_code=200)
def resume_mission(mission_id: str, db: Session = Depends(get_db)):
    m = _get_or_404(mission_id, db)
    ok = resume_simulation(mission_id)
    if ok:
        m.status = "active"
        db.commit()
    return {"status": "resumed" if ok else "not_found", "mission_id": mission_id}


@router.post("/{mission_id}/reset", status_code=200)
async def reset_mission(mission_id: str, db: Session = Depends(get_db)):
    m = _get_or_404(mission_id, db)
    await stop_simulation(mission_id)
    cfg = {
        "initial_alt_km": 650.0,
        "inclination_deg": 51.6,
        "control_mode": "autonomous",
        "type": m.mission_type,
        "destination": m.destination,
    }
    create_simulation(mission_id, cfg)
    m.status = "configuring"
    m.mission_day = 0.0
    m.objective_progress = 0.0
    m.overall_health = 100.0
    db.commit()
    return {"status": "reset", "mission_id": mission_id}


@router.patch("/{mission_id}/warp", status_code=200)
def set_warp(mission_id: str, multiplier: int, db: Session = Depends(get_db)):
    _get_or_404(mission_id, db)
    ok = set_time_multiplier(mission_id, multiplier)
    if not ok:
        raise HTTPException(404, "Simulation not found")
    sim = get_simulation(mission_id)
    db.query(Mission).filter(Mission.id == mission_id).update({"time_multiplier": multiplier})
    db.commit()
    return {"status": "ok", "time_multiplier": multiplier}


def _get_or_404(mission_id: str, db: Session) -> Mission:
    m = db.query(Mission).filter(Mission.id == mission_id).first()
    if not m:
        raise HTTPException(404, f"Mission {mission_id} not found")
    return m


def _to_response(m: Mission) -> MissionResponseSchema:
    return MissionResponseSchema(
        id=m.id,
        name=m.name,
        mission_type=m.mission_type,
        destination=m.destination,
        status=m.status,
        objective=m.objective,
        budget_crore=m.budget_crore,
        launch_site=m.launch_site or {},
        time_multiplier=m.time_multiplier,
        mission_day=m.mission_day,
        objective_progress=m.objective_progress,
        overall_health=m.overall_health,
        created_at=m.created_at,
    )
