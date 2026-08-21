"""
VYOM Backend — Scenario Engine
Creates baselines and what-if scenarios, and compares their outcomes.
"""
import uuid
import copy
import random
import math
from typing import Dict, List, Optional
import time

class ScenarioEngine:
    """Manages creation, simulation, and comparison of what-if scenarios."""

    def __init__(self):
        self.scenarios: Dict[str, Dict] = {}

    def create_baseline(self, mission_config: Dict, spacecraft_state_snapshot: Dict, mission_day: float) -> str:
        """Captures a baseline state and returns a scenario_id."""
        baseline_id = f"base-{str(uuid.uuid4())[:8]}"
        self.scenarios[baseline_id] = {
            "type": "baseline",
            "mission_config": copy.deepcopy(mission_config),
            "state_snapshot": copy.deepcopy(spacecraft_state_snapshot),
            "mission_day": mission_day,
            "created_at": time.time(),
            "faults": []
        }
        return baseline_id

    def create_scenario(self, baseline_id: str, name: str, fault_injections: List[Dict]) -> str:
        """Creates a what-if scenario based on a baseline."""
        if baseline_id not in self.scenarios:
            raise ValueError(f"Baseline {baseline_id} not found.")
            
        scenario_id = f"scen-{str(uuid.uuid4())[:8]}"
        baseline = self.scenarios[baseline_id]
        
        self.scenarios[scenario_id] = {
            "type": "what-if",
            "name": name,
            "baseline_id": baseline_id,
            "mission_config": copy.deepcopy(baseline["mission_config"]),
            "state_snapshot": copy.deepcopy(baseline["state_snapshot"]),
            "mission_day": baseline["mission_day"],
            "created_at": time.time(),
            "faults": copy.deepcopy(fault_injections)
        }
        return scenario_id

    def simulate_scenario(self, scenario_id: str, duration_days: float = 10.0) -> Dict:
        """Runs a simplified deterministic simulation forward for duration_days."""
        if scenario_id not in self.scenarios:
            raise ValueError(f"Scenario {scenario_id} not found.")
            
        scenario = self.scenarios[scenario_id]
        state = scenario["state_snapshot"]
        faults = scenario["faults"]
        
        health = state.get("overall_health", 100.0)
        battery = state.get("battery_percent", 100.0)
        radiation = state.get("radiation_level_usv_h", 5.0)
        stress = 20.0
        
        # Apply faults roughly
        degradation_rate = 1.0 # percent per day
        battery_drain = 2.0
        rad_increase = 0.0
        
        for fault in faults:
            sev = fault.get("severity", 5.0)
            if fault["fault_type"] == "battery_failure":
                battery_drain += sev * 1.5
            elif fault["fault_type"] == "radiation_spike":
                rad_increase += sev * 2.0
            elif fault["fault_type"] == "solar_panel_degradation":
                battery_drain += sev * 1.0
            degradation_rate += sev * 0.5
            
        # Simulate over duration
        health -= degradation_rate * duration_days
        battery -= battery_drain * duration_days
        radiation += rad_increase
        stress += (degradation_rate * 0.5) * duration_days
        
        health = max(0.0, min(100.0, health))
        battery = max(0.0, min(100.0, battery))
        stress = max(0.0, min(100.0, stress))
        
        success = health > 20.0
        
        result = {
            "scenario_id": scenario_id,
            "mission_success": success,
            "final_health": health,
            "crew_safety": stress < 80.0,
            "trajectory_deviation": random.uniform(0.1, 5.0) * duration_days,
            "resource_consumption": 100 - battery,
            "recovery_time_estimate": degradation_rate * 2.0,
            "risk_score": min(100.0, degradation_rate * 10),
            "objectives_impact": "high" if health < 50 else "low"
        }
        
        scenario["result"] = result
        return result

    def compare_scenarios(self, baseline_id: str, scenario_ids: List[str]) -> Dict:
        """Returns a side-by-side comparison of baseline and scenarios."""
        # Ensure baseline is simulated if it wasn't
        if "result" not in self.scenarios[baseline_id]:
            self.simulate_scenario(baseline_id, 10.0)
            
        for sid in scenario_ids:
            if "result" not in self.scenarios.get(sid, {}):
                self.simulate_scenario(sid, 10.0)
                
        metrics = [
            "mission_success", "final_health", "crew_safety", 
            "trajectory_deviation", "resource_consumption", 
            "recovery_time_estimate", "risk_score"
        ]
        
        comparison = {
            "metrics": metrics,
            "baseline": self.scenarios[baseline_id]["result"],
            "scenarios": {sid: self.scenarios[sid]["result"] for sid in scenario_ids}
        }
        
        # Add relative status (better/same/worse)
        for sid in scenario_ids:
            scen_res = comparison["scenarios"][sid]
            base_res = comparison["baseline"]
            
            scen_res["status"] = {}
            for m in metrics:
                s_val = scen_res[m]
                b_val = base_res[m]
                if isinstance(s_val, bool):
                    status = "same" if s_val == b_val else ("better" if s_val else "worse")
                else:
                    # For some metrics lower is better (trajectory_deviation, resource_consumption, recovery, risk)
                    # For others higher is better (final_health)
                    lower_is_better = m in ["trajectory_deviation", "resource_consumption", "recovery_time_estimate", "risk_score"]
                    if abs(s_val - b_val) < 0.01:
                        status = "same"
                    elif s_val > b_val:
                        status = "worse" if lower_is_better else "better"
                    else:
                        status = "better" if lower_is_better else "worse"
                        
                scen_res["status"][m] = status
                
        return comparison
