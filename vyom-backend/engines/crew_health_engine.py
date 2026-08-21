import math
import random
from typing import Dict, List, Any

class CrewHealthEngine:
    """Engine simulating crew physiological and psychological health metrics."""
    
    def __init__(self):
        self.crew_state: Dict[str, Dict] = {}

    def initialize_crew(self, crew_roster: List[Dict]) -> None:
        """
        Initializes baseline health state for all crew members.
        
        Args:
            crew_roster: List of dictionaries detailing the crew (must include 'role' and 'name').
        """
        for member in crew_roster:
            role = member.get('role', 'unknown')
            self.crew_state[role] = {
                'name': member.get('name', 'Unknown'),
                'role': role,
                'heart_rate_bpm': 72.0,
                'respiratory_rate_bpm': 14.0,
                'spo2_percent': 99.0,
                'temperature_c': 36.8,
                'blood_pressure_sys': 120.0,
                'blood_pressure_dia': 80.0,
                'fatigue': 0.0,
                'stress': 0.0,
                'hydration': 100.0,
                'radiation_dose_msv': 0.0,
                'o2_exposure_kpa': 21.3,
                'co2_exposure_ppm': 400.0,
                'workload': 30.0,
                'eva_duration_min': 0.0,
                'suit_pressure_kpa': 101.3,
                'is_eva': False,
                'activity': 'monitoring',
                'data_quality': 'simulated'
            }

    def tick(self, dt_s: float, mission_day: float, environment: Dict, active_faults: List) -> Dict[str, Dict]:
        """
        Updates the crew health metrics based on environmental and situational factors.
        
        Args:
            dt_s: Delta time in seconds since last tick.
            mission_day: Current mission duration in days.
            environment: Current environmental conditions.
            active_faults: Current list of active spacecraft faults.
            
        Returns:
            Updated crew state mapping.
        """
        hours_elapsed = dt_s / 3600.0
        # Circadian rhythm is modeled as a sine curve over a 24-hour period
        circadian_modifier = math.sin(mission_day * 2 * math.pi)
        
        num_crew = len(self.crew_state)
        base_co2 = 400.0 + (num_crew * 100.0)
        
        fault_stress = min(100.0, len(active_faults) * 15.0)
        thermal_fault = any('thermal' in str(f).lower() for f in active_faults)
        
        rad_level = environment.get('radiation_level_usv_h', 0.0)

        for role, state in self.crew_state.items():
            is_eva = state.get('is_eva', False)
            activity = state.get('activity', 'monitoring')
            
            # Workload
            if is_eva:
                workload = 80.0
            elif activity == 'science':
                workload = 60.0
            elif activity == 'sleep':
                workload = 5.0
            else:
                workload = 30.0
                
            state['workload'] = workload + random.gauss(0, 2)
            
            # Stress
            if len(active_faults) > 0:
                state['stress'] += fault_stress * hours_elapsed
            else:
                state['stress'] -= 10.0 * hours_elapsed
            state['stress'] = max(0.0, min(100.0, state['stress']))
            
            # Fatigue
            if activity == 'sleep':
                state['fatigue'] -= 10.0 * hours_elapsed
            else:
                state['fatigue'] += 0.5 * hours_elapsed
                if is_eva:
                    state['fatigue'] += 2.0 * hours_elapsed
            state['fatigue'] = max(0.0, min(100.0, state['fatigue']))
            
            # Hydration
            state['hydration'] -= 0.3 * hours_elapsed
            mission_hour_24 = (mission_day * 24.0) % 24.0
            # Simulating meals/hydration events roughly every 6 hours
            if 6 <= mission_hour_24 < 7 or 12 <= mission_hour_24 < 13 or 18 <= mission_hour_24 < 19:
                state['hydration'] = min(100.0, state['hydration'] + 20.0)
            state['hydration'] = max(50.0, min(100.0, state['hydration']))
            
            # Vitals calculation
            hr_modifier = circadian_modifier * 5.0 + state['stress'] * 0.2
            if is_eva:
                hr_modifier += 20.0
            state['heart_rate_bpm'] = 72.0 + hr_modifier + random.gauss(0, 2)
            state['heart_rate_bpm'] = max(55.0, min(160.0, state['heart_rate_bpm']))
            
            rr_modifier = circadian_modifier * 1.0 + state['stress'] * 0.05
            if is_eva:
                rr_modifier += 5.0
            state['respiratory_rate_bpm'] = 14.0 + rr_modifier + random.gauss(0, 1)
            state['respiratory_rate_bpm'] = max(10.0, min(30.0, state['respiratory_rate_bpm']))
            
            state['spo2_percent'] = 99.0 - (rad_level * 0.01) + random.gauss(0, 0.5)
            state['spo2_percent'] = max(88.0, min(100.0, state['spo2_percent']))
            
            temp_modifier = circadian_modifier * 0.3
            if thermal_fault:
                temp_modifier += 0.5
            state['temperature_c'] = 36.8 + temp_modifier + random.gauss(0, 0.1)
            state['temperature_c'] = max(35.5, min(39.5, state['temperature_c']))
            
            sys_modifier = circadian_modifier * 5.0 + state['stress'] * 0.3
            state['blood_pressure_sys'] = 120.0 + sys_modifier + random.gauss(0, 3)
            state['blood_pressure_sys'] = max(90.0, min(180.0, state['blood_pressure_sys']))
            
            dia_modifier = circadian_modifier * 3.0 + state['stress'] * 0.1
            state['blood_pressure_dia'] = 80.0 + dia_modifier + random.gauss(0, 2)
            state['blood_pressure_dia'] = max(60.0, min(120.0, state['blood_pressure_dia']))
            
            # Environment exposures
            state['radiation_dose_msv'] += rad_level * hours_elapsed * 0.001
            state['o2_exposure_kpa'] = 21.3 + random.gauss(0, 0.1)
            state['co2_exposure_ppm'] = base_co2 + random.gauss(0, 10)
            state['co2_exposure_ppm'] = max(300.0, min(5000.0, state['co2_exposure_ppm']))
            
            if is_eva:
                state['eva_duration_min'] += dt_s / 60.0
                state['suit_pressure_kpa'] = 29.6 + random.gauss(0, 0.2)
            else:
                state['suit_pressure_kpa'] = 101.3 + random.gauss(0, 0.2)
                
            state['data_quality'] = 'simulated'
            
        return self.crew_state

    def generate_daily_summary(self, mission_day: int) -> Dict:
        """Aggregates high-level crew health metrics for the day."""
        summary = {'mission_day': mission_day, 'crew': {}}
        for role, state in self.crew_state.items():
            summary['crew'][role] = {
                'avg_heart_rate': state['heart_rate_bpm'],
                'fatigue_level': state['fatigue'],
                'stress_level': state['stress'],
                'radiation_dose_msv': state['radiation_dose_msv']
            }
        return summary

    def get_crew_state(self) -> Dict[str, Dict]:
        """Returns the current detailed crew health state."""
        return self.crew_state
        
    def to_snapshot_list(self) -> List[Dict]:
        """Returns a list of crew health records suitable for serialization."""
        return list(self.crew_state.values())
