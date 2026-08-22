"""
VYOM Backend — Daily Summary Engine
Accumulates daily telemetry and generates comprehensive summaries.
"""
from typing import Dict, List, Optional
import time

class DailySummaryEngine:
    """Accumulates daily data and generates daily mission summaries."""

    def __init__(self):
        self._current_day_data: Dict = {
            "health_values": [],
            "stress_values": [],
            "fatigue_values": [],
            "battery_values": [],
            "cpu_temp_values": [],
            "radiation_values": [],
            "altitude_values": [],
            "velocity_values": [],
            "solar_activity_values": [],
            "risk_scores": [],
            "orbit_points": [],
            "events": [],
            "activities": [],
            "objectives_snapshot": None,
            "latest_environment": None,
            "latest_crew_state": {}
        }

    def accumulate_tick(self, mission_day: float, state_snapshot: Dict, environment: Dict, crew_health: Dict, risk: Dict, active_faults: List, orbit_point: Dict) -> None:
        """Accumulates data for the current day."""
        self._current_day_data["health_values"].append(state_snapshot.get("overall_health", 100))
        # crew_health is the engine state dict keyed by role -> member state
        if isinstance(crew_health, dict):
            for _role, member in crew_health.items():
                if isinstance(member, dict):
                    self._current_day_data["stress_values"].append(member.get("stress", 0))
                    self._current_day_data["fatigue_values"].append(member.get("fatigue", 0))
            self._current_day_data["latest_crew_state"] = {
                role: dict(member) for role, member in crew_health.items() if isinstance(member, dict)
            }
        self._current_day_data["battery_values"].append(state_snapshot.get("battery_percent", 100))
        self._current_day_data["cpu_temp_values"].append(state_snapshot.get("cpu_temp_c", 45))
        self._current_day_data["radiation_values"].append(state_snapshot.get("radiation_level_usv_h", 0))

        self._current_day_data["altitude_values"].append(orbit_point.get("alt", orbit_point.get("altitude_km", 400)))
        self._current_day_data["velocity_values"].append(orbit_point.get("velocity_kms", orbit_point.get("velocity_km_s", 7.66)))
        self._current_day_data["solar_activity_values"].append(
            environment.get("solar_activity_level", environment.get("solar_activity_index", 0)))
        self._current_day_data["risk_scores"].append(
            risk.get("risk_score", risk.get("current_score", 0)))

        self._current_day_data["orbit_points"].append(orbit_point)
        self._current_day_data["latest_environment"] = environment

    def generate_summary(self, mission_id: str, mission_day_int: int) -> Dict:
        """Produces a comprehensive daily summary and resets accumulator."""
        data = self._current_day_data
        
        # Calculate aggregates
        def safe_avg(lst, default=0):
            return sum(lst) / len(lst) if lst else default
            
        def safe_min(lst, default=0):
            return min(lst) if lst else default
            
        def safe_max(lst, default=0):
            return max(lst) if lst else default

        summary = {
            "mission_id": mission_id,
            "mission_day": mission_day_int,
            "timestamp": int(time.time() * 1000),
            "mission_state": {
                "health_avg": safe_avg(data["health_values"], 100),
                "health_min": safe_min(data["health_values"], 100),
                "health_max": safe_max(data["health_values"], 100),
                "status": "nominal" if safe_avg(data["health_values"], 100) > 80 else "degraded",
                "phase": "Operations"
            },
            "crew_summary": {
                "crew_count": len(data.get("latest_crew_state", {}) or {}),
                "avg_stress": safe_avg(data["stress_values"]),
                "avg_fatigue": safe_avg(data["fatigue_values"]),
                "radiation_doses": safe_avg(data["radiation_values"]),
                "activities": data.get("activities", []),
                # Per-crew-member end-of-day state (SIMULATED values)
                "crew": {
                    role: {
                        "heart_rate_bpm": m.get("heart_rate_bpm"),
                        "spo2_percent": m.get("spo2_percent"),
                        "temperature_c": m.get("temperature_c"),
                        "blood_pressure_sys": m.get("blood_pressure_sys"),
                        "blood_pressure_dia": m.get("blood_pressure_dia"),
                        "fatigue": m.get("fatigue"),
                        "stress": m.get("stress"),
                        "hydration": m.get("hydration"),
                        "radiation_dose_msv": m.get("radiation_dose_msv"),
                        "workload": m.get("workload"),
                        "eva_duration_min": m.get("eva_duration_min"),
                        "location": m.get("location"),
                        "current_task": m.get("current_task"),
                        "comm_status": m.get("comm_status"),
                        "data_quality": m.get("data_quality", "simulated"),
                    }
                    for role, m in (data.get("latest_crew_state") or {}).items()
                },
            },
            "orbital_state": {
                "avg_altitude": safe_avg(data["altitude_values"]),
                "avg_velocity": safe_avg(data["velocity_values"]),
                "ground_track_points": data["orbit_points"]
            },
            "environment": {
                "avg_solar_activity": safe_avg(data["solar_activity_values"]),
                "max_radiation": safe_max(data["radiation_values"]),
                "eclipse_fraction": (data.get("latest_environment") or {}).get("eclipse_fraction", 0.0),
                "classification": (data.get("latest_environment") or {}).get("classification", "nominal"),
            },
            "events": data.get("events", []),
            "activities": data.get("activities", []),
            "objectives": data.get("objectives_snapshot", {}),
            "risk": {
                "avg_risk_score": safe_avg(data["risk_scores"]),
                "max_risk_score": safe_max(data["risk_scores"]),
                "category": "moderate",
                "trend": "stable"
            },
            "telemetry_highlights": {
                "min_battery": safe_min(data["battery_values"], 100),
                "max_cpu_temp": safe_max(data["cpu_temp_values"], 45),
                "max_radiation_dose": safe_max(data["radiation_values"], 0)
            }
        }
        
        # Reset current day data
        self._current_day_data = {
            "health_values": [], "stress_values": [], "fatigue_values": [],
            "battery_values": [], "cpu_temp_values": [], "radiation_values": [],
            "altitude_values": [], "velocity_values": [], "solar_activity_values": [],
            "risk_scores": [], "orbit_points": [], "events": [], "activities": [],
            "objectives_snapshot": None, "latest_environment": None,
            "latest_crew_state": {}
        }
        
        return summary

    def get_orbital_path(self, mission_day_int: int) -> List[Dict]:
        """Returns accumulated orbit points for the day."""
        return self._current_day_data.get("orbit_points", [])
