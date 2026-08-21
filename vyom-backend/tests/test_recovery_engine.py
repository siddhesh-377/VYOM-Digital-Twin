"""Tests for the autonomous recovery engine."""
import time
import uuid

from engines.recovery_engine import (
    RECOVERY_CONFIRM_TICKS,
    RECOVERY_TIMEOUT_S,
    RecoveryEngine,
)
from engines.anomaly_detector import AnomalyEvent
from engines.spacecraft_state import SpacecraftState


def make_event(channel, severity="critical"):
    return AnomalyEvent(
        id=str(uuid.uuid4())[:8],
        subsystem="Test",
        channel=channel,
        severity=severity,
        confidence=90.0,
        detection_strategy="threshold",
        description="test anomaly",
        current_value=0.0,
        threshold=0.0,
        deviation=0.0,
        detected_at=time.time(),
    )


class TestRecoveryConfirmation:
    def test_confirmed_after_clear_ticks(self):
        engine = RecoveryEngine()
        state = SpacecraftState()
        state.overall_health = 90.0
        engine.begin_monitoring("solar_storm", time.time())
        recovered = []
        for _ in range(RECOVERY_CONFIRM_TICKS):
            recovered = engine.tick([], state, elapsed_since_command_s=10.0)
        assert recovered == ["solar_storm"]

    def test_anomaly_resets_clear_count(self):
        engine = RecoveryEngine()
        state = SpacecraftState()
        state.overall_health = 90.0
        engine.begin_monitoring("solar_storm", time.time())
        # Some clear ticks...
        for _ in range(RECOVERY_CONFIRM_TICKS - 2):
            engine.tick([], state, elapsed_since_command_s=10.0)
        # ...then an anomaly appears
        anomalies = [make_event("radiation_level_usv_h")]
        recovered = engine.tick(anomalies, state, elapsed_since_command_s=10.0)
        assert recovered == []

    def test_low_health_blocks_recovery(self):
        engine = RecoveryEngine()
        state = SpacecraftState()
        state.overall_health = 40.0
        engine.begin_monitoring("solar_storm", time.time())
        recovered = []
        for _ in range(RECOVERY_CONFIRM_TICKS):
            recovered = engine.tick([], state, elapsed_since_command_s=10.0)
        assert recovered == []

    def test_timeout_marks_failed(self):
        engine = RecoveryEngine()
        state = SpacecraftState()
        engine.begin_monitoring("solar_storm", time.time())
        recovered = engine.tick([], state, elapsed_since_command_s=RECOVERY_TIMEOUT_S + 1.0)
        assert recovered == []
        status = engine.get_status()
        assert status[0]["failed_to_recover"] is True

    def test_does_not_monitor_recovered_again(self):
        engine = RecoveryEngine()
        state = SpacecraftState()
        state.overall_health = 90.0
        engine.begin_monitoring("comm_failure", time.time())
        for _ in range(RECOVERY_CONFIRM_TICKS):
            engine.tick([], state, elapsed_since_command_s=10.0)
        # Once recovered, further ticks should not re-return the fault
        recovered = engine.tick([], state, elapsed_since_command_s=10.0)
        assert recovered == []


class TestFaultChannelMapping:
    def test_battery_failure_channels(self):
        assert RecoveryEngine()._fault_to_channels("battery_failure") == ["battery", "voltage"]

    def test_comm_failure_channels(self):
        assert RecoveryEngine()._fault_to_channels("comm_failure") == [
            "signal", "packet_loss", "comm_uptime"]

    def test_unknown_fault_no_channels(self):
        assert RecoveryEngine()._fault_to_channels("mystery") == []

    def test_battery_anomaly_blocks_battery_recovery(self):
        engine = RecoveryEngine()
        state = SpacecraftState()
        state.overall_health = 90.0
        engine.begin_monitoring("battery_failure", time.time())
        # battery_percent anomaly -> active channel "battery"
        anomalies = [make_event("battery_percent")]
        engine.tick(anomalies, state, elapsed_since_command_s=10.0)
        status = engine.get_status()
        assert status[0]["consecutive_clear_ticks"] == 0


class TestStatus:
    def test_get_status_empty(self):
        assert RecoveryEngine().get_status() == []

    def test_get_status_tracks_recovery(self):
        engine = RecoveryEngine()
        state = SpacecraftState()
        state.overall_health = 90.0
        engine.begin_monitoring("solar_storm", time.time())
        for _ in range(RECOVERY_CONFIRM_TICKS):
            engine.tick([], state, elapsed_since_command_s=10.0)
        status = engine.get_status()
        assert status[0]["recovered"] is True
        assert status[0]["recovery_confirmed_at"] is not None