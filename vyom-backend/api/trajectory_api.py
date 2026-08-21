import time
import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db
from core.schemas import TrajectoryStateSchema
from simulation.loop import get_simulation

router = APIRouter(prefix="/api/missions/{mission_id}/trajectory", tags=["trajectory"])

@router.get("", response_model=TrajectoryStateSchema)
def get_trajectory(mission_id: str):
    """Get current trajectory state from simulation."""
    sim = get_simulation(mission_id)
    if not sim:
        return TrajectoryStateSchema(
            planned_path=[],
            actual_path=[],
            deviation={},
            predicted_future=[],
            maneuver_points=[]
        )
    return sim.trajectory_engine.get_trajectory_state()


@router.get("/deviation")
def get_deviation(mission_id: str):
    """Get current trajectory deviation."""
    sim = get_simulation(mission_id)
    if not sim:
        raise HTTPException(404, "Simulation not running")
    return sim.trajectory_engine.get_deviation()


@router.get("/planned")
def get_planned(mission_id: str):
    """Get full planned trajectory."""
    sim = get_simulation(mission_id)
    if not sim:
        raise HTTPException(404, "Simulation not running")
    return sim.trajectory_engine.planned_trajectory
