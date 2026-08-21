import time
import uuid
from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from pydantic import BaseModel

from core.database import get_db, FarewellAssessment
from core.schemas import FarewellAssessmentSchema
from simulation.loop import get_simulation

router = APIRouter(prefix="/api/missions/{mission_id}/farewell", tags=["farewell"])

class MonteCarloRequest(BaseModel):
    scenario_name: str = "return"
    n_runs: int = 1000

@router.get("/assessment", response_model=FarewellAssessmentSchema)
def get_assessment(mission_id: str, db: Session = Depends(get_db)):
    """Run farewell readiness assessment and save to db."""
    sim = get_simulation(mission_id)
    if not sim:
        raise HTTPException(404, "Simulation not running")
        
    assessment_data = sim.farewell_engine.assess_readiness(sim.state)
    disposition = sim.farewell_engine.recommend_disposition()
    
    db_assessment = FarewellAssessment(
        id=f"fa-{int(time.time()*1000)}-{uuid.uuid4().hex[:4]}",
        mission_id=mission_id,
        mission_day=sim.mission_day,
        timestamp=int(time.time() * 1000),
        spacecraft_health=assessment_data.get("spacecraft_health", 100.0),
        objective_completion=assessment_data.get("objective_completion", 0.0),
        propellant_remaining=assessment_data.get("propellant_remaining", 100.0),
        power_margin=assessment_data.get("power_margin", 100.0),
        thermal_margin=assessment_data.get("thermal_margin", 100.0),
        gnc_capability=assessment_data.get("gnc_capability", 100.0),
        comm_capability=assessment_data.get("comm_capability", 100.0),
        rul_days=assessment_data.get("rul_days", 0.0),
        crew_safety_score=assessment_data.get("crew_safety_score"),
        return_feasibility=assessment_data.get("return_feasibility"),
        monte_carlo_results=assessment_data.get("monte_carlo_results"),
        recommended_option=disposition.get("recommended_option", ""),
        alternatives_considered=disposition.get("alternatives_considered", []),
        reasoning=disposition.get("reasoning", ""),
        assessment_type="operator-requested"
    )
    db.add(db_assessment)
    db.commit()
    db.refresh(db_assessment)
    
    return db_assessment


@router.post("/monte-carlo")
def run_monte_carlo(mission_id: str, payload: MonteCarloRequest):
    """Run monte carlo simulation for end-of-mission scenarios."""
    sim = get_simulation(mission_id)
    if not sim:
        raise HTTPException(404, "Simulation not running")
        
    results = sim.farewell_engine.run_monte_carlo(
        scenario_name=payload.scenario_name, 
        n_runs=payload.n_runs
    )
    return results


@router.get("/history", response_model=List[FarewellAssessmentSchema])
def get_farewell_history(mission_id: str, db: Session = Depends(get_db)):
    """Get history of farewell assessments."""
    records = db.query(FarewellAssessment).filter(FarewellAssessment.mission_id == mission_id).all()
    return records
