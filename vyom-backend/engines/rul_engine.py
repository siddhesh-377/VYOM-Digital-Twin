"""
VYOM Backend — RUL Engine
Remaining Useful Life calculations.
"""
from typing import Dict, List, Any
from engines.spacecraft_state import SpacecraftState

class RULEngine:
    """Calculates Remaining Useful Life of the spacecraft."""
    
    def __init__(self) -> None:
        self._baseline_lifetime_days: float = 365.0
        self._degradation_history: List[float] = []

    def set_baseline(self, lifetime_days: float) -> None:
        """Set expected mission lifetime."""
        self._baseline_lifetime_days = float(lifetime_days)

    def estimate_rul(self, state: SpacecraftState, active_faults: List[Any], environment: Dict[str, Any], mission_day: float) -> Dict[str, Any]:
        """
        Estimate RUL based on state, faults, and environment.
        """
        base_rul = max(0.0, self._baseline_lifetime_days - float(mission_day))
        
        health_penalty = 0.0
        if state.overall_health < 100.0:
            health_penalty = base_rul * ((100.0 - state.overall_health) / 100.0)
            
        fault_penalty = 0.0
        for fault in active_faults:
            severity = getattr(fault, 'severity', 0.0)
            fault_penalty += severity * 5.0
            
        radiation_penalty = 0.0
        if state.total_dose_msv > 100.0:
            radiation_penalty = (state.total_dose_msv / 100.0) * 10.0
            
        power_penalty = 0.0
        if state.battery_percent < 50.0:
            power_penalty = base_rul * ((50.0 - state.battery_percent) / 50.0) * 0.1

        rul_days = base_rul - health_penalty - fault_penalty - radiation_penalty - power_penalty
        rul_days = max(0.0, rul_days)
        
        self._degradation_history.append(rul_days)
        
        degradation_rate = 0.0
        if len(self._degradation_history) >= 2:
            degradation_rate = self._degradation_history[-2] - self._degradation_history[-1]
            
        confidence = min(1.0, len(self._degradation_history) / 100.0)
        
        factors = {
            "health_penalty": float(health_penalty),
            "fault_penalty": float(fault_penalty),
            "radiation_penalty": float(radiation_penalty),
            "power_penalty": float(power_penalty)
        }
        
        return {
            "rul_days": float(rul_days),
            "confidence": float(confidence),
            "degradation_rate": float(degradation_rate),
            "factors": factors
        }
