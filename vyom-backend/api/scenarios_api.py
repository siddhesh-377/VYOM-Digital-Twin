from typing import List, Dict, Any
from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from core.database import get_db, MissionSnapshot
from core.schemas import ScenarioCreateSchema, ScenarioComparisonSchema
from simulation.loop import get_simulation

router = APIRouter(prefix="/api/missions/{mission_id}/scenarios", tags=["scenarios"])


@router.post("/baseline")
def create_baseline(mission_id: str, db: Session = Depends(get_db)):
    """Create a baseline from current simulation state or latest snapshot."""
    sim = get_simulation(mission_id)
    if sim:
        baseline_id = sim.scenario_engine.create_baseline(
            sim.config, dict(vars(sim.state)), sim.mission_day
        )
        return {"baseline_id": baseline_id}
    else:
        snapshot = db.query(MissionSnapshot).filter(MissionSnapshot.mission_id == mission_id).order_by(MissionSnapshot.sim_timestamp.desc()).first()
        if not snapshot:
            raise HTTPException(404, "No simulation or snapshot available for baseline")

        return {"baseline_id": str(snapshot.id)}


@router.post("/compare", response_model=ScenarioComparisonSchema)
def run_comparison(mission_id: str, scenarios: List[ScenarioCreateSchema]):
    """Run simulation comparison for given scenarios."""
    sim = get_simulation(mission_id)
    if not sim:
        raise HTTPException(404, "Simulation not running")

    baseline_id = sim.scenario_engine.create_baseline(
        sim.config, dict(vars(sim.state)), sim.mission_day
    )
    scenario_ids: List[str] = []
    for sc in scenarios:
        sid = sim.scenario_engine.create_scenario(
            baseline_id,
            sc.name,
            sc.fault_injections
        )
        scenario_ids.append(sid)
        sim.scenario_engine.simulate_scenario(sid, sc.duration_days)

    comparison_data = sim.scenario_engine.compare_scenarios(baseline_id, scenario_ids)

    return ScenarioComparisonSchema(
        baseline_id=baseline_id,
        scenarios=[sim.scenario_engine.scenarios[s] for s in scenario_ids],
        comparison=comparison_data
    )
