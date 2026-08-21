from typing import Dict, List, Any
from engines.spacecraft_state import SpacecraftState

class RiskEngine:
    """Calculates overall mission risk by analyzing spacecraft state and environmental conditions."""
    
    def __init__(self):
        self._previous_score: float = 0.0
        self._history: List[Dict] = []

    def calculate_risk(self, state: SpacecraftState, environment: Dict, active_faults: List, objectives: List, mission_day: float, rul_days: float, is_human_mission: bool = False) -> Dict:
        """
        Calculates a holistic risk score for the mission.
        
        Args:
            state: Current SpacecraftState.
            environment: Environmental conditions and metrics.
            active_faults: List of currently active faults.
            objectives: Mission objectives list to gauge progress.
            mission_day: Current mission elapsed day.
            rul_days: Remaining Useful Life estimation in days.
            is_human_mission: Flag indicating whether this is a crewed mission.
            
        Returns:
            Dictionary containing the evaluated risk profile, score, category, contributing factors, etc.
        """
        factors = []
        
        # 1. Spacecraft Health (20%)
        health_score = 100.0 - state.overall_health
        factors.append({'name': 'spacecraft_health', 'score': health_score, 'weight': 0.20, 'trend': 'stable'})
        
        # 2. Active Faults (15%)
        fault_score = min(100.0, len(active_faults) * 30.0)
        factors.append({'name': 'active_faults', 'score': fault_score, 'weight': 0.15, 'trend': 'stable'})
        
        # 3. Power Status (10%)
        power_score = max(0.0, 100.0 - state.battery_percent)
        if state.solar_generation_w < state.power_consumption_w:
            power_score = min(100.0, power_score + 20.0)
        factors.append({'name': 'power_status', 'score': power_score, 'weight': 0.10, 'trend': 'stable'})
        
        # 4. Comm Status (5%)
        comm_score = 0.0
        if state.signal_dbm < -90.0:
            comm_score = 80.0
        elif state.signal_dbm < -80.0:
            comm_score = 40.0
        factors.append({'name': 'comm_status', 'score': comm_score, 'weight': 0.05, 'trend': 'stable'})
        
        # 5. Thermal Status (5%)
        thermal_score = 0.0
        if state.cpu_temp_c > 75.0 or state.battery_temp_c > 45.0:
            thermal_score = 90.0
        elif state.cpu_temp_c > 60.0 or state.battery_temp_c > 35.0:
            thermal_score = 40.0
        factors.append({'name': 'thermal_status', 'score': thermal_score, 'weight': 0.05, 'trend': 'stable'})
        
        # 6. Environment (10%)
        env_score = min(100.0, (environment.get('solar_activity_level', 1.0) * 10.0) + (environment.get('radiation_level_usv_h', 1.0) * 2.0))
        factors.append({'name': 'environment', 'score': env_score, 'weight': 0.10, 'trend': 'stable'})
        
        # 7. RUL Remaining (10%)
        rul_score = max(0.0, 100.0 - (rul_days * 2.0))
        factors.append({'name': 'rul_remaining', 'score': rul_score, 'weight': 0.10, 'trend': 'stable'})
        
        # 8. Objective Progress (10%)
        completed = sum(1 for obj in objectives if obj.get('status') == 'completed')
        total = max(1, len(objectives))
        obj_score = max(0.0, 100.0 - ((completed / total) * 100.0))
        factors.append({'name': 'objective_progress', 'score': obj_score, 'weight': 0.10, 'trend': 'stable'})
        
        # 9. Propulsion (10%)
        prop_score = max(0.0, 100.0 - ((state.fuel_kg / max(1.0, state.fuel_max_kg)) * 100.0))
        factors.append({'name': 'propulsion', 'score': prop_score, 'weight': 0.10, 'trend': 'stable'})
        
        # 10. Crew Status (5%)
        if is_human_mission:
            # Placeholder for crew status when risk is calculated directly
            crew_score = 30.0  
            factors.append({'name': 'crew_status', 'score': crew_score, 'weight': 0.05, 'trend': 'stable'})
            
        # Normalize weights if not a human mission
        total_weight = sum(f['weight'] for f in factors)
        
        total_risk = sum(f['score'] * (f['weight'] / total_weight) for f in factors)
        total_risk = max(0.0, min(100.0, total_risk))
        
        category = 'LOW'
        explanation = 'Low risk. All systems nominal.'
        if total_risk > 75.0:
            category = 'CRITICAL'
            explanation = 'Critical risk detected due to: ' + ', '.join(f['name'] for f in factors if f['score'] > 75.0)
        elif total_risk > 50.0:
            category = 'HIGH'
            explanation = 'High risk detected. Attention required.'
        elif total_risk > 25.0:
            category = 'MODERATE'
            explanation = 'Moderate risk level. Nominal operations can continue.'
            
        trend = 'stable'
        if total_risk > self._previous_score + 5.0:
            trend = 'degrading'
        elif total_risk < self._previous_score - 5.0:
            trend = 'improving'
            
        self._previous_score = total_risk
        confidence = 0.5 + min(0.4, len(self._history) * 0.01)
        
        result = {
            'risk_score': round(total_risk, 2),
            'risk_category': category,
            'contributing_factors': factors,
            'confidence': round(confidence, 2),
            'trend': trend,
            'explanation': explanation
        }
        
        self._history.append(result)
        return result
