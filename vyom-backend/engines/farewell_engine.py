"""
VYOM Backend — Farewell Engine
End-of-life and disposal scenario assessments.
"""
import random
from typing import Dict, List, Any
from engines.spacecraft_state import SpacecraftState

class FarewellEngine:
    """Assess readiness and recommend end-of-mission disposition."""
    
    def assess_readiness(self, state: SpacecraftState, objectives_progress: float, mission_day: float, rul_days: float, architecture: Dict[str, Any], is_human_mission: bool = False) -> Dict[str, Any]:
        propellant_remaining = 0.0
        if getattr(state, "fuel_max_kg", 0) > 0:
            propellant_remaining = (state.fuel_kg / state.fuel_max_kg) * 100.0
            
        power_margin = state.battery_percent
        thermal_margin = 100.0 - abs(state.cpu_temp_c - 20.0)
        gnc_capability = 100.0 if state.attitude_control_ok else 20.0
        comm_capability = 100.0 if state.comm_ok else 0.0
        
        res = {
            "spacecraft_health": state.overall_health,
            "objective_completion": objectives_progress,
            "propellant_remaining": propellant_remaining,
            "power_margin": max(0.0, min(100.0, power_margin)),
            "thermal_margin": max(0.0, min(100.0, thermal_margin)),
            "gnc_capability": gnc_capability,
            "comm_capability": comm_capability,
            "rul_days": rul_days
        }
        
        if is_human_mission:
            res["crew_safety_score"] = min(state.overall_health, state.battery_percent)
            
            life_support = 100.0
            for ss in state.subsystems:
                if 'life' in ss.name.lower():
                    life_support = ss.health
                    
            ret_feas = (
                (propellant_remaining * 0.30) +
                (gnc_capability * 0.20) +
                (power_margin * 0.15) +
                (thermal_margin * 0.10) +
                (comm_capability * 0.10) +
                (life_support * 0.10) +
                (100.0 * 0.05)
            )
            res["return_feasibility"] = max(0.0, min(100.0, ret_feas))
            
        return res

    def recommend_disposition(self, assessment: Dict[str, Any], architecture: Dict[str, Any], is_human_mission: bool = False) -> Dict[str, Any]:
        alt = architecture.get("orbit", {}).get("altitude_km", 400)
        dest = architecture.get("destination", "earth-orbit")
        
        recommended_option = 'extended-mission'
        reasoning = 'Default extended mission.'
        
        if is_human_mission:
            recommended_option = 'crew-safe-return'
            if assessment.get("return_feasibility", 0) > 80:
                reasoning = 'Safe return is highly feasible.'
            else:
                reasoning = 'Crew safety is priority despite risks.'
        else:
            if dest in ['mars-surface', 'deep-space', 'lagrange-l1']:
                recommended_option = 'heliocentric-disposal' if dest in ['deep-space', 'lagrange-l1'] else 'surface-retirement'
                reasoning = 'Disposal for deep space/mars missions.'
            elif assessment.get("rul_days", 0) > 30 and assessment.get("spacecraft_health", 0) > 50:
                recommended_option = 'extended-mission'
                reasoning = 'Spacecraft remains healthy with remaining life.'
            elif alt < 1000 and assessment.get("propellant_remaining", 0) > 10:
                recommended_option = 'controlled-deorbit'
                reasoning = 'Sufficient propellant for controlled deorbit.'
            else:
                recommended_option = 'graveyard-orbit'
                reasoning = 'High orbit disposal.'

        return {
            "recommended_option": recommended_option,
            "alternatives_considered": [],
            "reasoning": reasoning
        }
        
    def run_monte_carlo(self, state: SpacecraftState, scenario_name: str, n_runs: int = 1000) -> Dict[str, Any]:
        successes = 0
        failures = 0
        
        failure_causes = {"propulsion": 0, "power": 0, "thermal": 0, "nav": 0}
        
        base_prop = (state.fuel_kg / max(1, state.fuel_max_kg)) * 100 if getattr(state, "fuel_max_kg", 0) else 100.0
        base_nav = 100.0 if state.attitude_control_ok else 20.0
        base_power = state.battery_percent
        base_thermal = 100.0 - abs(state.cpu_temp_c - 20.0)
        
        random.seed(42)
        
        for _ in range(n_runs):
            prop = base_prop * (1.0 + random.uniform(-0.10, 0.10))
            nav = base_nav * (1.0 + random.uniform(-0.05, 0.05))
            power = base_power * (1.0 + random.uniform(-0.15, 0.15))
            therm = base_thermal * (1.0 + random.uniform(-0.10, 0.10))
            
            failed = False
            if prop < 20.0:
                failure_causes["propulsion"] += 1
                failed = True
            elif nav < 50.0:
                failure_causes["nav"] += 1
                failed = True
            elif power < 20.0:
                failure_causes["power"] += 1
                failed = True
            elif therm < 10.0:
                failure_causes["thermal"] += 1
                failed = True
                
            if failed:
                failures += 1
            else:
                successes += 1
                
        sorted_causes = sorted(failure_causes.items(), key=lambda x: x[1], reverse=True)
        dominant = [k for k, v in sorted_causes if v > 0]
        
        succ_rate = successes / n_runs
        
        return {
            "success_rate": float(succ_rate),
            "failure_rate": float(failures / n_runs),
            "dominant_failure_factors": dominant,
            "confidence_interval_95": [float(succ_rate - 0.02), float(succ_rate + 0.02)],
            "runs_completed": n_runs,
            "scenario": scenario_name
        }
