"""
VYOM Backend — Mission CRUD API Router
"""
import time
import uuid
from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.orm import Session

from core.database import get_db, Mission, SpacecraftArchitecture
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
        architecture_id=getattr(payload, "architectureId", None),
        end_goal=getattr(payload, "endGoal", None),
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
        "crew_json": [c.model_dump() for c in payload.crew],
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
            "crew_json": m.crew_json or [],
        }
        create_simulation(mission_id, cfg)

    success = await start_simulation(mission_id)
    if not success:
        raise HTTPException(500, "Failed to start simulation")

    # Derive lifecycle anchors once (architecture- or destination-driven)
    if not m.estimated_lifetime_days:
        dest = str(m.destination or "earth-orbit")
        years = {
            "leo": 5.0, "earth-orbit": 5.0, "lunar-orbit": 3.0,
            "lunar-surface": 2.0, "mars-orbit": 4.0, "mars-surface": 2.0,
            "deep-space": 12.0, "lagrange-l1": 10.0,
        }.get(dest, 5.0)
        # Architecture constraint overrides when available
        try:
            cfg = m.config_json if isinstance(m.config_json, dict) else {}
            arch_id = getattr(m, "architecture_id", None) or cfg.get("architectureId")
            if arch_id:
                arch = db.query(SpacecraftArchitecture).filter(
                    SpacecraftArchitecture.id == str(arch_id)).first()
                if arch:
                    years = float((arch.mission_constraints or {}).get(
                        "design_life_years", years))
        except Exception:
            pass
        m.estimated_lifetime_days = round(years * 365.0, 1)
    if not m.planned_end_day:
        m.planned_end_day = m.estimated_lifetime_days
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


@router.patch("/{mission_id}/end-goal", status_code=200)
def set_end_goal(mission_id: str, payload: dict, db: Session = Depends(get_db)):
    """Update the intended end-of-mission goal via a traceable mission-change event.

    The original goal is preserved in the Black Box history; this creates a new
    mission-change record (append-only).
    """
    from core.blackbox import append_event
    m = _get_or_404(mission_id, db)
    new_goal = payload.get("end_goal")
    if not new_goal:
        raise HTTPException(400, "end_goal is required")
    old_goal = getattr(m, "end_goal", None)
    m.end_goal = str(new_goal)
    ev = append_event(
        db,
        id=f"bb-goal-change-{int(time.time()*1000)}-{uuid.uuid4().hex[:4]}",
        mission_id=mission_id,
        mission_day=m.mission_day,
        timestamp=int(time.time() * 1000),
        event_type="mission-change",
        severity="nominal",
        description=f"End-of-mission goal updated: {old_goal or 'none'} -> {new_goal}",
        source=payload.get("changed_by") or "Mission Director",
        operator=payload.get("changed_by"),
        command_procedure="END_GOAL_UPDATE",
        result=f"{old_goal} -> {new_goal}",
    )
    db.commit()
    return {"status": "ok", "previous_goal": old_goal, "new_goal": m.end_goal,
            "change_event_id": ev.id}


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
