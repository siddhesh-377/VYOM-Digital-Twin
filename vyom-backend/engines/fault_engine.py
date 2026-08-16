"""
VYOM Backend — Fault Injection Engine
10 fault types that modify actual spacecraft telemetry state.
Each fault has a severity (0-10) and duration.
"""
import time
import random
import uuid
from dataclasses import dataclass, field
from typing import Dict, Optional, List
from engines.spacecraft_state import SpacecraftState


FAULT_CATALOGUE = {
    "solar_storm": {
        "name": "Solar Storm (CME)",
        "description": "X-class coronal mass ejection. Extreme radiation, communication blackout risk, power anomalies.",
        "default_severity": 7.5,
        "effects": {
            "solar_storm": 1.0, 
            "radiation_spike": 1.0, 
            "comm_failure": 0.7, 
            "thermal_overheating": 0.5
        },
    },
    "comm_failure": {
        "name": "Communication System Failure",
        "description": "Antenna fault or deep-space interference causing signal degradation and data loss.",
        "default_severity": 6.0,
        "effects": {"comm_failure": 1.0},
    },
    "solar_panel_degradation": {
        "name": "Solar Panel Degradation",
        "description": "Micrometeorite strike and radiation damage reducing solar array output efficiency.",
        "default_severity": 5.0,
        "effects": {"solar_panel_degradation": 1.0},
    },
    "battery_failure": {
        "name": "Battery Cell Failure",
        "description": "Primary battery cell short-circuit. Rapid voltage drop, reduced energy storage.",
        "default_severity": 7.0,
        "effects": {"battery_failure": 1.0, "power": 0.5},
    },
    "thermal_overheating": {
        "name": "Thermal Overheating",
        "description": "Radiator blockage or eclipse exit causing rapid CPU and payload temperature excursion.",
        "default_severity": 6.5,
        "effects": {"thermal_overheating": 1.0},
    },
    "sensor_failure": {
        "name": "Sensor Array Failure",
        "description": "Star tracker and attitude sensors biased by radiation. Navigation accuracy degraded.",
        "default_severity": 5.0,
        "effects": {"sensor_failure": 1.0},
    },
    "propulsion_anomaly": {
        "name": "Propulsion System Anomaly",
        "description": "Thruster valve stuck open. Uncontrolled fuel consumption and attitude disturbance.",
        "default_severity": 6.0,
        "effects": {"propulsion_anomaly": 1.0, "attitude_control_failure": 0.3},
    },
    "attitude_control_failure": {
        "name": "Attitude Control Failure",
        "description": "Reaction wheel saturation and gyro bias. Spacecraft tumbling, solar panel misalignment.",
        "default_severity": 7.0,
        "effects": {"attitude_control_failure": 1.0},
    },
    "radiation_spike": {
        "name": "Radiation Spike (SEP Event)",
        "description": "Solar energetic particle event. High-energy protons causing bit flips and sensor noise.",
        "default_severity": 6.0,
        "effects": {"radiation_spike": 1.0},
    },
    "telemetry_loss": {
        "name": "Telemetry Loss / Blackout",
        "description": "Complete loss of telemetry downlink. Spacecraft operating autonomously without ground contact.",
        "default_severity": 8.0,
        "effects": {"comm_failure": 1.5, "telemetry_loss": 1.0},
    },
}

# Frontend scenario ids -> canonical catalogue key.
# Also maps the hyphenated spelling of every catalogue key.
FAULT_ALIASES = {
    "solar-storm": "solar_storm",
    "solar-flare": "radiation_spike",
    "power-failure": "battery_failure",
    "thermal-failure": "thermal_overheating",
    "communication-failure": "comm_failure",
    "comm-failure": "comm_failure",
    "attitude-failure": "attitude_control_failure",
    "debris": "solar_panel_degradation",
    "space-debris": "solar_panel_degradation",
    "sensor-glitch": "sensor_failure",
    "thruster-leak": "propulsion_anomaly",
    "thermal-overheat": "thermal_overheating",
    "communication-loss": "telemetry_loss",
    "reaction-wheel-fault": "attitude_control_failure",
}

# Canonical catalogue key -> frontend-friendly threat type id.
FRONTEND_TYPE_MAP = {
    "solar_storm": "solar-storm",
    "comm_failure": "communication-failure",
    "solar_panel_degradation": "power-failure",
    "battery_failure": "power-failure",
    "thermal_overheating": "thermal-failure",
    "sensor_failure": "sensor-glitch",
    "propulsion_anomaly": "thruster-leak",
    "attitude_control_failure": "attitude-failure",
    "radiation_spike": "solar-flare",
    "telemetry_loss": "communication-loss",
}


def resolve_fault_type(fault_type: str) -> str:
    """Resolve a user-supplied fault type (hyphenated or underscored) to a catalogue key."""
    key = fault_type.strip()
    if key in FAULT_ALIASES:
        return FAULT_ALIASES[key]
    normalized = key.replace("-", "_")
    if normalized in FAULT_CATALOGUE:
        return normalized
    return key


def to_frontend_type(fault_type: str) -> str:
    """Convert a canonical catalogue key to the frontend threat id."""
    return FRONTEND_TYPE_MAP.get(fault_type, fault_type.replace("_", "-"))


@dataclass
class ActiveFault:
    id: str
    fault_type: str
    name: str
    description: str
    severity: float           # 0-10 user-specified
    effects: Dict[str, float] # effect_type -> scaled severity
    started_at: float         # unix timestamp
    active: bool = True
    mitigated_at: Optional[float] = None


class FaultEngine:
    """Manages active fault injection and removal."""

    def __init__(self):
        self.active_faults: Dict[str, ActiveFault] = {}  # id -> fault

    def inject_fault(self, fault_type: str, severity: Optional[float] = None,
                     seed: Optional[int] = None) -> ActiveFault:
        """Inject a fault into the simulation."""
        if seed is not None:
            random.seed(seed)

        fault_type = resolve_fault_type(fault_type)
        catalogue = FAULT_CATALOGUE.get(fault_type)
        if not catalogue:
            raise ValueError(f"Unknown fault type: {fault_type}")

        sev = severity if severity is not None else catalogue["default_severity"]
        sev = max(0.1, min(10.0, sev))
        norm_sev = sev / 10.0  # 0-1 normalised severity

        # Scale effects by severity
        effects = {k: v * norm_sev * sev for k, v in catalogue["effects"].items()}

        fault = ActiveFault(
            id=str(uuid.uuid4())[:8],
            fault_type=fault_type,
            name=catalogue["name"],
            description=catalogue["description"],
            severity=sev,
            effects=effects,
            started_at=time.time(),
        )
        self.active_faults[fault.id] = fault
        return fault

    def mitigate_fault(self, fault_id: str) -> bool:
        """Mark a fault as mitigated."""
        fault = self.active_faults.get(fault_id)
        if fault and fault.active:
            fault.active = False
            fault.mitigated_at = time.time()
            return True
        return False

    def mitigate_by_type(self, fault_type: str) -> int:
        """Mitigate all faults of a given type."""
        fault_type = resolve_fault_type(fault_type)
        count = 0
        for fault in self.active_faults.values():
            if fault.fault_type == fault_type and fault.active:
                fault.active = False
                fault.mitigated_at = time.time()
                count += 1
        return count

    def apply_to_state(self, state: SpacecraftState) -> None:
        """Write active fault effects into spacecraft state."""
        # Reset fault effects in state
        state.active_faults = {}

        for fault in self.active_faults.values():
            if not fault.active:
                continue
            for effect_key, effect_val in fault.effects.items():
                if effect_key in state.active_faults:
                    state.active_faults[effect_key] = max(state.active_faults[effect_key], effect_val)
                else:
                    state.active_faults[effect_key] = effect_val

    def get_active_list(self) -> List[ActiveFault]:
        return [f for f in self.active_faults.values() if f.active]

    def to_threat_scenarios(self) -> List[Dict]:
        """Convert to frontend ThreatScenario format."""
        result = []
        for f in self.active_faults.values():
            result.append({
                "id": f.id,
                "type": to_frontend_type(f.fault_type),
                "name": f.name,
                "description": f.description,
                "active": f.active,
                "severity": "critical" if f.severity >= 7 else "warning",
                "startedAt": int(f.started_at * 1000),
                "effects": f.effects,
                "mitigatedAt": int(f.mitigated_at * 1000) if f.mitigated_at else None,
            })
        return result
