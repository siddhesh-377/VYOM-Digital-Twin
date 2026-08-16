"""
VYOM Backend — Anomaly Detection Engine
5 detection strategies that identify real telemetry problems.
"""
import time
import uuid
import math
from dataclasses import dataclass, field
from typing import List, Dict, Optional, Deque
from collections import deque
from engines.spacecraft_state import SpacecraftState


# ── Threshold Limits ─────────────────────────────────────────────────────────
LIMITS = {
    "cpu_temp_c":          {"warning": 70.0,  "critical": 82.0,  "dir": "high"},
    "battery_temp_c":      {"warning": 35.0,  "critical": 45.0,  "dir": "high"},
    "battery_percent":     {"warning": 25.0,  "critical": 15.0,  "dir": "low"},
    "voltage_v":           {"warning": 23.5,  "critical": 22.5,  "dir": "low"},
    "signal_dbm":          {"warning": -100.0,"critical": -115.0,"dir": "low"},
    "radiation_level_usv_h": {"warning": 50.0, "critical": 150.0, "dir": "high"},
    "angular_vel_degs":    {"warning": 0.5,   "critical": 2.0,   "dir": "high"},
    "reaction_wheel_rpm":  {"warning": 5500.0,"critical": 6000.0,"dir": "high"},
    "packet_loss_pct":     {"warning": 15.0,  "critical": 50.0,  "dir": "high"},
    "comm_uptime":         {"warning": 70.0,  "critical": 40.0,  "dir": "low"},
    "cpu_percent":         {"warning": 80.0,  "critical": 95.0,  "dir": "high"},
    "fuel_kg":             {"warning": 30.0,  "critical": 12.0,  "dir": "low"},
}

# Rate-of-change limits (per second)
ROC_LIMITS = {
    "battery_percent":    {"warning": 0.2,  "critical": 0.5},   # %/s
    "cpu_temp_c":         {"warning": 1.5,  "critical": 3.0},   # °C/s
    "signal_dbm":         {"warning": 2.0,  "critical": 5.0},   # dBm/s
    "radiation_level_usv_h": {"warning": 5.0, "critical": 20.0},  # uSv/h per sec
    "voltage_v":          {"warning": 0.1,  "critical": 0.3},
}

# Persistence: ticks a value must stay out-of-band before triggering
PERSISTENCE_TICKS = {"warning": 15, "critical": 8}

# Statistical: rolling window size
STAT_WINDOW = 60
Z_SCORE_THRESHOLD = 3.0


@dataclass
class AnomalyEvent:
    id: str
    subsystem: str
    channel: str
    severity: str          # warning | critical
    confidence: float      # 0-100
    detection_strategy: str
    description: str
    current_value: float
    threshold: float
    deviation: float       # how far out of bounds
    detected_at: float     # unix timestamp
    evidence: List[Dict] = field(default_factory=list)


class AnomalyDetector:
    """Runs 5 detection strategies each tick, returns active anomalies."""

    def __init__(self):
        # Rolling window of (timestamp, values_dict)
        self._history: Deque[Dict] = deque(maxlen=STAT_WINDOW)
        self._persistence: Dict[str, int] = {}   # channel -> consecutive out-of-band ticks
        self._prev_values: Dict[str, float] = {}
        self._prev_time: float = 0.0
        self.active_anomalies: List[AnomalyEvent] = []

    def detect(self, state: SpacecraftState, dt_s: float) -> List[AnomalyEvent]:
        """Run all 5 detection strategies. Returns current anomalies."""
        now = time.time()
        snapshot = self._snapshot(state)
        self._history.append({"t": now, **snapshot})

        anomalies: List[AnomalyEvent] = []

        # Strategy 1: Hard threshold
        anomalies.extend(self._threshold_check(snapshot, state))

        # Strategy 2: Rate of change
        if self._prev_time > 0 and dt_s > 0:
            anomalies.extend(self._roc_check(snapshot, dt_s))

        # Strategy 3: Persistence
        anomalies.extend(self._persistence_check(snapshot, state))

        # Strategy 4: Statistical deviation
        if len(self._history) >= 20:
            anomalies.extend(self._statistical_check(snapshot))

        # Strategy 5: Multivariate consistency
        anomalies.extend(self._multivariate_check(state))

        # Deduplicate by channel (keep highest severity)
        seen: Dict[str, AnomalyEvent] = {}
        for a in anomalies:
            key = a.channel
            if key not in seen or (a.severity == "critical" and seen[key].severity == "warning"):
                seen[key] = a

        self.active_anomalies = list(seen.values())
        self._prev_values = snapshot
        self._prev_time = now
        return self.active_anomalies

    def _snapshot(self, state: SpacecraftState) -> Dict:
        return {
            "cpu_temp_c":           state.cpu_temp_c,
            "battery_temp_c":       state.battery_temp_c,
            "battery_percent":      state.battery_percent,
            "voltage_v":            state.voltage_v,
            "signal_dbm":           state.signal_dbm,
            "radiation_level_usv_h": state.radiation_level_usv_h,
            "angular_vel_degs":     state.angular_vel_degs,
            "reaction_wheel_rpm":   state.reaction_wheel_rpm,
            "packet_loss_pct":      state.packet_loss_pct,
            "comm_uptime":          state.comm_uptime,
            "cpu_percent":          state.cpu_percent,
            "fuel_kg":              state.fuel_kg,
        }

    def _threshold_check(self, snap: Dict, state: SpacecraftState) -> List[AnomalyEvent]:
        anomalies = []
        for channel, limits in LIMITS.items():
            val = snap.get(channel)
            if val is None:
                continue
            is_high = limits["dir"] == "high"
            if is_high:
                if val >= limits["critical"]:
                    sev, thresh, dev = "critical", limits["critical"], val - limits["critical"]
                elif val >= limits["warning"]:
                    sev, thresh, dev = "warning", limits["warning"], val - limits["warning"]
                else:
                    continue
            else:  # low
                if val <= limits["critical"]:
                    sev, thresh, dev = "critical", limits["critical"], limits["critical"] - val
                elif val <= limits["warning"]:
                    sev, thresh, dev = "warning", limits["warning"], limits["warning"] - val
                else:
                    continue

            anomalies.append(AnomalyEvent(
                id=str(uuid.uuid4())[:8],
                subsystem=self._channel_to_subsystem(channel),
                channel=channel,
                severity=sev,
                confidence=95.0 if sev == "critical" else 80.0,
                detection_strategy="threshold",
                description=f"{channel} {sev}: {val:.2f} ({'above' if is_high else 'below'} limit {thresh})",
                current_value=val,
                threshold=thresh,
                deviation=dev,
                detected_at=time.time(),
                evidence=[{"channel": channel, "value": val, "threshold": thresh, "strategy": "threshold"}],
            ))
        return anomalies

    def _roc_check(self, snap: Dict, dt_s: float) -> List[AnomalyEvent]:
        anomalies = []
        for channel, limits in ROC_LIMITS.items():
            val = snap.get(channel)
            prev = self._prev_values.get(channel)
            if val is None or prev is None:
                continue
            roc = abs((val - prev) / max(dt_s, 0.001))
            if roc >= limits["critical"]:
                sev, thresh = "critical", limits["critical"]
            elif roc >= limits["warning"]:
                sev, thresh = "warning", limits["warning"]
            else:
                continue
            anomalies.append(AnomalyEvent(
                id=str(uuid.uuid4())[:8],
                subsystem=self._channel_to_subsystem(channel),
                channel=channel + "_roc",
                severity=sev,
                confidence=88.0 if sev == "critical" else 72.0,
                detection_strategy="rate_of_change",
                description=f"{channel} rate-of-change {sev}: {roc:.3f}/s (limit {thresh}/s)",
                current_value=roc,
                threshold=thresh,
                deviation=roc - thresh,
                detected_at=time.time(),
                evidence=[{"channel": channel, "roc": roc, "threshold": thresh, "strategy": "rate_of_change"}],
            ))
        return anomalies

    def _persistence_check(self, snap: Dict, state: SpacecraftState) -> List[AnomalyEvent]:
        anomalies = []
        for channel, limits in LIMITS.items():
            val = snap.get(channel)
            if val is None:
                continue
            is_high = limits["dir"] == "high"
            out_of_band = (is_high and val >= limits["warning"]) or (not is_high and val <= limits["warning"])
            if out_of_band:
                self._persistence[channel] = self._persistence.get(channel, 0) + 1
            else:
                self._persistence[channel] = 0

            ticks = self._persistence.get(channel, 0)
            if ticks >= PERSISTENCE_TICKS["critical"]:
                sev = "critical"
            elif ticks >= PERSISTENCE_TICKS["warning"]:
                sev = "warning"
            else:
                continue

            anomalies.append(AnomalyEvent(
                id=str(uuid.uuid4())[:8],
                subsystem=self._channel_to_subsystem(channel),
                channel=channel + "_persist",
                severity=sev,
                confidence=90.0,
                detection_strategy="persistence",
                description=f"{channel} out-of-band for {ticks} consecutive ticks",
                current_value=val,
                threshold=limits["warning"],
                deviation=ticks,
                detected_at=time.time(),
            ))
        return anomalies

    def _statistical_check(self, snap: Dict) -> List[AnomalyEvent]:
        anomalies = []
        if len(self._history) < 10:
            return []
        for channel in snap:
            history_vals = [h.get(channel) for h in self._history if h.get(channel) is not None]
            if len(history_vals) < 10:
                continue
            mean = sum(history_vals) / len(history_vals)
            variance = sum((x - mean) ** 2 for x in history_vals) / len(history_vals)
            std = math.sqrt(variance) if variance > 0 else 0.001
            current = snap.get(channel)
            if current is None:
                continue
            z = abs((current - mean) / std)
            if z < Z_SCORE_THRESHOLD:
                continue
            sev = "critical" if z > 4.5 else "warning"
            anomalies.append(AnomalyEvent(
                id=str(uuid.uuid4())[:8],
                subsystem=self._channel_to_subsystem(channel),
                channel=channel + "_stat",
                severity=sev,
                confidence=min(99.0, 60 + z * 8),
                detection_strategy="statistical",
                description=f"{channel} z-score={z:.2f} (>{Z_SCORE_THRESHOLD}σ from rolling mean {mean:.2f})",
                current_value=current,
                threshold=mean + Z_SCORE_THRESHOLD * std,
                deviation=z,
                detected_at=time.time(),
            ))
        return anomalies

    def _multivariate_check(self, state: SpacecraftState) -> List[AnomalyEvent]:
        """Check physical consistency across multiple channels."""
        anomalies = []

        # Power balance: generation + discharge should ≈ consumption
        if not state.in_eclipse:
            expected_gen = state.solar_generation_w
            actual_consumption = state.power_consumption_w
            battery_delta_rate = (state.battery_percent - 96.4)  # rough
            # If consuming more than generating AND battery not charging
            if actual_consumption > expected_gen * 1.2 and state.battery_percent < 85:
                anomalies.append(AnomalyEvent(
                    id=str(uuid.uuid4())[:8],
                    subsystem="Power",
                    channel="power_balance",
                    severity="warning",
                    confidence=82.0,
                    detection_strategy="multivariate",
                    description=f"Power imbalance: consuming {actual_consumption:.0f}W > generating {expected_gen:.0f}W with battery at {state.battery_percent:.1f}%",
                    current_value=actual_consumption,
                    threshold=expected_gen,
                    deviation=actual_consumption - expected_gen,
                    detected_at=time.time(),
                    evidence=[
                        {"channel": "solar_generation_w", "value": expected_gen},
                        {"channel": "power_consumption_w", "value": actual_consumption},
                        {"channel": "battery_percent", "value": state.battery_percent},
                    ],
                ))

        # Thermal-power consistency: high CPU temp but low CPU usage is suspicious
        if state.cpu_temp_c > 70 and state.cpu_percent < 20:
            anomalies.append(AnomalyEvent(
                id=str(uuid.uuid4())[:8],
                subsystem="Thermal",
                channel="thermal_cpu_consistency",
                severity="warning",
                confidence=76.0,
                detection_strategy="multivariate",
                description=f"Thermal anomaly: CPU {state.cpu_temp_c:.1f}°C but load only {state.cpu_percent:.0f}%",
                current_value=state.cpu_temp_c,
                threshold=70.0,
                deviation=state.cpu_temp_c - 70,
                detected_at=time.time(),
            ))

        return anomalies

    def _channel_to_subsystem(self, channel: str) -> str:
        MAP = {
            "cpu_temp_c": "Thermal", "battery_temp_c": "Thermal", "payload_temp_c": "Thermal",
            "battery_percent": "Power", "voltage_v": "Power", "solar_generation_w": "Power",
            "signal_dbm": "Communications", "packet_loss_pct": "Communications", "comm_uptime": "Communications",
            "angular_vel_degs": "Attitude Control", "reaction_wheel_rpm": "Attitude Control",
            "radiation_level_usv_h": "Radiation",
            "cpu_percent": "On-Board Computer",
            "fuel_kg": "Propulsion",
        }
        for k, v in MAP.items():
            if channel.startswith(k):
                return v
        return "Unknown"
