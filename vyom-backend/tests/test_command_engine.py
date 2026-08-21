"""Tests for the command & safety engine."""
import pytest

from engines.command_engine import CommandEngine, check_safety
from engines.spacecraft_state import SpacecraftState


class TestCheckSafety:
    def test_thruster_low_battery(self):
        state = SpacecraftState()
        state.battery_percent = 10.0
        reason = check_safety("THRUSTER_ASSIST_MODE", {}, state)
        assert reason is not None
        assert "Battery" in reason

    def test_thruster_ok_battery(self):
        state = SpacecraftState()
        state.battery_percent = 60.0
        assert check_safety("THRUSTER_ASSIST_MODE", {}, state) is None

    def test_safe_mode_already_active(self):
        state = SpacecraftState()
        state.safe_mode = True
        reason = check_safety("SAFE_MODE_ENABLE", {}, state)
        assert reason is not None
        assert "already active" in reason

    def test_comm_blackout_blocks_non_essential(self):
        state = SpacecraftState()
        state.signal_dbm = -130.0
        assert check_safety("REDUCE_CPU_LOAD", {}, state) is not None

    def test_comm_blackout_allows_critical(self):
        state = SpacecraftState()
        state.signal_dbm = -130.0
        assert check_safety("SAFE_MODE_ENABLE", {}, state) is None
        assert check_safety("EMERGENCY_LOAD_SHEDDING", {}, state) is None

    def test_propulsion_anomaly_blocks_thrusters(self):
        state = SpacecraftState()
        state.active_faults["propulsion_anomaly"] = 1.0
        reason = check_safety("MOMENTUM_DUMP", {}, state)
        assert reason is not None
        assert "Propulsion anomaly" in reason


class TestCommandLifecycle:
    def test_submit_rejected(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        state.battery_percent = 10.0
        cmd = engine.submit("THRUSTER_ASSIST_MODE", {}, state, 0.0)
        assert cmd.status == "REJECTED"
        assert cmd.rejected_reason is not None
        assert engine.commands[cmd.id] is cmd

    def test_submit_validated(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        cmd = engine.submit("SAFE_MODE_ENABLE", {}, state, 1.0)
        assert cmd.status == "VALIDATED"
        assert cmd.validated_at is not None

    def test_execute_pending_applies_safe_mode(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        consumption_before = state.power_consumption_w
        engine.submit("SAFE_MODE_ENABLE", {}, state, 0.0)
        executed = engine.execute_pending(state)
        assert len(executed) == 1
        assert state.safe_mode is True
        assert state.power_consumption_w < consumption_before
        assert executed[0].status == "COMPLETE"

    def test_rejected_commands_not_executed(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        state.battery_percent = 10.0
        engine.submit("THRUSTER_ASSIST_MODE", {}, state, 0.0)
        assert engine.execute_pending(state) == []


class TestCommandEffects:
    def test_reduce_power_load(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        state.power_consumption_w = 500.0
        engine.submit("REDUCE_POWER_LOAD", {"target_consumption_w": 100}, state, 0.0)
        engine.execute_pending(state)
        assert state.power_consumption_w == 100.0

    def test_switch_antenna_boosts_signal(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        state.signal_dbm = -100.0
        engine.submit("SWITCH_ANTENNA", {}, state, 0.0)
        engine.execute_pending(state)
        assert state.signal_dbm == pytest.approx(-88.0)
        assert state.comm_ok is True

    def test_isolate_thruster_valve(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        state.active_faults["propulsion_anomaly"] = 1.0
        engine.submit("ISOLATE_THRUSTER_VALVE", {}, state, 0.0)
        engine.execute_pending(state)
        assert state.propulsion_ok is False
        assert "propulsion_anomaly" not in state.active_faults

    def test_momentum_dump_resets_wheel(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        state.reaction_wheel_rpm = 6200.0
        state.angular_vel_degs = 1.5
        engine.submit("MOMENTUM_DUMP", {}, state, 0.0)
        engine.execute_pending(state)
        assert state.reaction_wheel_rpm == 3240.0
        assert state.angular_vel_degs < 0.5

    def test_memory_scrubbing_recovers_obc(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        obc = state.get_subsystem("On-Board")
        obc.health = 50.0
        engine.submit("MEMORY_SCRUBBING", {}, state, 0.0)
        engine.execute_pending(state)
        assert obc.health == pytest.approx(65.0)

    def test_gyro_recalibration(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        state.roll_deg = 12.0
        engine.submit("GYRO_RECALIBRATION", {}, state, 0.0)
        engine.execute_pending(state)
        assert state.roll_deg == pytest.approx(1.2)


class TestSerialization:
    def test_to_dict_list(self):
        engine = CommandEngine("M-1")
        state = SpacecraftState()
        engine.submit("SAFE_MODE_ENABLE", {}, state, 0.0)
        data = engine.to_dict_list()
        assert len(data) == 1
        assert data[0]["command_type"] == "SAFE_MODE_ENABLE"
        assert data[0]["mission_id"] == "M-1"
        assert data[0]["status"] in ("VALIDATED", "EXECUTING", "COMPLETE")