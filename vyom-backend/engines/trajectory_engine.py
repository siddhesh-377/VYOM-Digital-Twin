"""
VYOM Backend — Trajectory Engine
Manages planned vs actual mission trajectory.
"""
import math
from typing import Dict, List, Any, Optional

class TrajectoryEngine:
    """Generates and tracks spacecraft trajectory."""
    
    def __init__(self) -> None:
        self.planned_trajectory: List[Dict[str, Any]] = []
        self.actual_trajectory: List[Dict[str, Any]] = []
        self._mission_config: Dict[str, Any] = {}

    def plan_trajectory(self, mission_config: Dict[str, Any], destination: str) -> List[Dict[str, Any]]:
        """Generate mission-specific planned trajectory waypoints."""
        self._mission_config = mission_config
        self.planned_trajectory = []
        
        num_waypoints = 50
        
        if destination == 'earth-orbit':
            alt = float(mission_config.get('altitude_km', 400.0))
            for i in range(num_waypoints):
                day = i * 0.1
                lat = math.sin(i / num_waypoints * 2 * math.pi) * 50.0
                lng = (i / num_waypoints * 360.0) % 360.0 - 180.0
                vel = 7.66
                self.planned_trajectory.append({
                    "day": day, "lat": lat, "lng": lng, "alt_km": alt, 
                    "velocity_kms": vel, "phase": "orbit", "description": "LEO orbit"
                })
        elif destination in ['lunar-surface', 'lunar-orbit']:
            for i in range(num_waypoints):
                day = i * (6.0 / num_waypoints)
                alt, phase, desc = 400.0, "parking", "LEO parking"
                if day >= 0.5 and day < 1.0:
                    phase, desc = "tli", "TLI burn"
                    alt = 400.0 + (day - 0.5) * 50000.0
                elif day >= 1.0 and day < 3.0:
                    phase, desc = "coast", "Cislunar coast"
                    alt = 50000.0 + (day - 1.0) * 150000.0
                elif day >= 3.0 and day < 4.0:
                    phase, desc = "loi", "LOI burn"
                    alt = 384400.0 - 100.0
                elif day >= 4.0:
                    phase, desc = "descent", "Descent/Surface"
                    alt = max(0.0, 100.0 - (day - 4.0) * 100.0)
                
                self.planned_trajectory.append({
                    "day": day, "lat": 0.0, "lng": 0.0, "alt_km": alt,
                    "velocity_kms": 1.0, "phase": phase, "description": desc
                })
        elif destination == 'mars-surface':
            for i in range(num_waypoints):
                day = i * (190.0 / num_waypoints)
                alt, phase, desc = 400.0, "parking", "LEO"
                if day > 1.0 and day < 180.0:
                    phase, desc = "cruise", "Interplanetary cruise"
                    alt = day * 100000.0
                elif day >= 180.0:
                    phase, desc = "edl", "MOI/EDL"
                    alt = max(0.0, 100.0 - (day - 180.0) * 10.0)
                self.planned_trajectory.append({
                    "day": day, "lat": 0.0, "lng": 0.0, "alt_km": alt,
                    "velocity_kms": 25.0, "phase": phase, "description": desc
                })
        elif destination in ['lagrange-l1', 'deep-space']:
            for i in range(num_waypoints):
                day = i * (30.0 / num_waypoints)
                phase, desc = "cruise", "Deep space cruise"
                self.planned_trajectory.append({
                    "day": day, "lat": 0.0, "lng": 0.0, "alt_km": 1500000.0,
                    "velocity_kms": 0.5, "phase": phase, "description": desc
                })
                
        return self.planned_trajectory

    def record_actual_point(self, day: float, lat: float, lng: float, alt_km: float, velocity_kms: float) -> None:
        """Appends to actual trajectory."""
        self.actual_trajectory.append({
            "day": float(day), "lat": float(lat), "lng": float(lng),
            "alt_km": float(alt_km), "velocity_kms": float(velocity_kms)
        })

    def get_deviation(self) -> Dict[str, Any]:
        """Compares latest actual point to nearest planned waypoint."""
        if not self.actual_trajectory or not self.planned_trajectory:
            return {"position_deviation_km": 0.0, "velocity_deviation_kms": 0.0, "on_track": True, "nearest_planned_waypoint": None}
            
        latest = self.actual_trajectory[-1]
        nearest = min(self.planned_trajectory, key=lambda wp: abs(wp["day"] - latest["day"]))
        
        pos_dev = abs(latest["alt_km"] - nearest["alt_km"]) + abs(latest["lat"] - nearest["lat"]) * 111.0
        vel_dev = abs(latest["velocity_kms"] - nearest["velocity_kms"])
        
        return {
            "position_deviation_km": float(pos_dev),
            "velocity_deviation_kms": float(vel_dev),
            "on_track": bool(pos_dev < 100.0 and vel_dev < 0.5),
            "nearest_planned_waypoint": nearest
        }

    def get_trajectory_state(self) -> Dict[str, Any]:
        """Returns full trajectory state."""
        return {
            "planned_path": self.planned_trajectory,
            "actual_path": self.actual_trajectory,
            "deviation": self.get_deviation(),
            "predicted_future": self.planned_trajectory[-10:] if len(self.planned_trajectory) >= 10 else self.planned_trajectory,
            "maneuver_points": [wp for wp in self.planned_trajectory if 'burn' in wp.get('description', '').lower() or 'loi' in wp.get('phase', '').lower()],
            "target_location": self._mission_config.get("destination", "unknown")
        }
