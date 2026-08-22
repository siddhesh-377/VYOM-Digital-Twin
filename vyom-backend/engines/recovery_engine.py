"""
VYOM Backend — Autonomous Recovery Engine
Verifies actual telemetry recovery — never marks recovered just because a command was sent.
"""
import time
from dataclasses import dataclass, field
from typing import Optional, List, Dict
from engines.spacecraft_state import SpacecraftState
from engines.anomaly_detector import AnomalyDetector, AnomalyEvent


RECOVERY_TIMEOUT_S = 180.0     # 3 minutes simulation time max before escalation
RECOVERY_CONFIRM_TICKS = 10   # must be clear for this many consecutive ticks


@dataclass
class RecoveryMonitor:
    fault_type: str
    started_at: float
    command_executed_at: float
    consecutive_clear_ticks: int = 0
    recovered: bool = False
    recovery_confirmed_at: Optional[float] = None
    failed_to_recover: bool = False


class RecoveryEngine:
    """Monitors post-command telemetry to confirm or deny recovery."""

    def __init__(self):
        self._monitors: List[RecoveryMonitor] = []

    def begin_monitoring(self, fault_type: str, command_executed_at: float) -> None:
        """Start monitoring recovery after a command is executed."""
        # De-duplicate: skip if an unresolved monitor already exists for this type
        for m in self._monitors:
            if m.fault_type == fault_type and not m.recovered and not m.failed_to_recover:
                return
        m = RecoveryMonitor(
            fault_type=fault_type,
            started_at=time.time(),
            command_executed_at=command_executed_at,
        )
        self._monitors.append(m)

    def tick(self, anomalies: List[AnomalyEvent], state: SpacecraftState,
             elapsed_since_command_s: float) -> List[str]:
        """
        Returns list of newly confirmed recovery fault_types.
        Only marks recovered if consecutive clear ticks achieved.
        """
        recovered_faults = []
        # Only physical, real-time detection strategies block recovery
        # confirmation. Statistical/multivariate detectors compare against a
        # rolling baseline that is skewed for tens of ticks after a fault and
        # would otherwise keep resetting confirmation forever.
        physical = {"threshold", "rate_of_change", "persistence"}
        active_channels = {
            a.channel.split("_")[0]
            for a in anomalies
            if a.severity == "critical" and a.detection_strategy in physical
        }
        self.last_active_channels = sorted(active_channels)  # diagnostics

        for monitor in self._monitors:
            if monitor.recovered or monitor.failed_to_recover:
                continue

            # Check timeout
            if elapsed_since_command_s > RECOVERY_TIMEOUT_S:
                monitor.failed_to_recover = True
                continue

            # Check if fault-related anomalies have cleared
            fault_channels = self._fault_to_channels(monitor.fault_type)
            still_anomalous = any(
                any(ch.startswith(fc) for ch in active_channels)
                for fc in fault_channels
            )

            if not still_anomalous and state.overall_health > 60:
                monitor.consecutive_clear_ticks += 1
            else:
                monitor.consecutive_clear_ticks = 0

            if monitor.consecutive_clear_ticks >= RECOVERY_CONFIRM_TICKS:
                monitor.recovered = True
                monitor.recovery_confirmed_at = time.time()
                recovered_faults.append(monitor.fault_type)

        return recovered_faults

    def _fault_to_channels(self, fault_type: str) -> List[str]:
        """Map fault type to the telemetry channels we expect to normalize."""
        MAP = {
            "solar_storm":              ["radiation", "signal", "cpu_temp"],
            "comm_failure":             ["signal", "packet_loss", "comm_uptime"],
            "battery_failure":          ["battery", "voltage"],
            "thermal_overheating":      ["cpu_temp", "battery_temp", "payload_temp"],
            "attitude_control_failure": ["angular_vel", "reaction_wheel"],
            "radiation_spike":          ["radiation"],
            "propulsion_anomaly":       ["fuel"],
        }
        return MAP.get(fault_type, [])

    def get_status(self) -> List[Dict]:
        return [
            {
                "fault_type": m.fault_type,
                "recovered": m.recovered,
                "failed_to_recover": m.failed_to_recover,
                "consecutive_clear_ticks": m.consecutive_clear_ticks,
                "recovery_confirmed_at": m.recovery_confirmed_at,
            }
            for m in self._monitors
        ]
