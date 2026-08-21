"""Tests for the physics-based telemetry engine."""
import pytest

from engines.telemetry_engine import TelemetryEngine, build_telemetry_dict
from engines.spacecraft_state import SpacecraftState
from engines.environment_engine import EnvironmentState
from core.schemas import TelemetrySchema


def default_env():
    return EnvironmentState()


class TestTelemetryEngine:
    def test_tick_mutates_state_in_place(self):
        engine = TelemetryEngine()
        state = SpacecraftState()
        result = engine.tick(state, default_env(), 10.0)
        assert result is state

    def test_battery_stays_within_bounds(self):
        engine = TelemetryEngine()
        state = SpacecraftState()
        for _ in range(10):
            engine.tick(state, default_env(), 10.0)
            assert 0.0 <= state.battery_percent <= 100.0

    def test_voltage_within_physical_range(self):
        engine = TelemetryEngine()
        state = SpacecraftState()
        for _ in range(10):
            engine.tick(state, default_env(), 10.0)
            assert 22.0 <= state.voltage_v <= 29.2

    def test_power_consumption_floor(self):
        engine = TelemetryEngine()
        state = SpacecraftState()
        state.safe_mode = True
        for _ in range(5):
            engine.tick(state, default_env(), 10.0)
            assert state.power_consumption_w >= 50.0

    def test_battery_drains_in_eclipse(self):
        engine = TelemetryEngine()
        state = SpacecraftState()
        state.battery_percent = 60.0
        state.battery_charge_wh = 4800.0
        env = default_env()
        env.in_eclipse = True
        env.eclipse_fraction = 1.0
        engine.tick(state, env, 600.0)  # 10 min in eclipse
        assert state.battery_charge_wh < 4800.0

    def test_fault_drives_power_draw(self):
        engine = TelemetryEngine()
        state = SpacecraftState()
        state.active_faults["battery_failure"] = 1.0
        engine.tick(state, default_env(), 10.0)
        assert state.power_consumption_w > 200.0

    def test_thermal_overheating_fault_spikes_cpu_temp(self):
        engine = TelemetryEngine()
        state = SpacecraftState()
        state.active_faults["thermal_overheating"] = 2.0
        for _ in range(20):
            engine.tick(state, default_env(), 10.0)
        assert state.cpu_temp_c > 50.0

    def test_radiation_dose_accumulates(self):
        engine = TelemetryEngine()
        state = SpacecraftState()
        start_dose = state.total_dose_msv
        engine.tick(state, default_env(), 3600.0)
        assert state.total_dose_msv > start_dose

    def test_tick_updates_subsystem_health(self):
        engine = TelemetryEngine()
        state = SpacecraftState()
        power = state.get_subsystem("Power")
        health_before = power.health
        engine.tick(state, default_env(), 10.0)
        assert power.health == pytest.approx(health_before, abs=1.0)


class TestBuildTelemetryDict:
    def test_validate_against_pydantic_schema(self):
        state = SpacecraftState()
        telem = build_telemetry_dict(state, 1.5)
        parsed = TelemetrySchema(**telem)
        assert parsed.missionDay == pytest.approx(1.5)
        assert parsed.dataSource == "backend"

    def test_all_sections_present(self):
        state = SpacecraftState()
        telem = build_telemetry_dict(state, 0.0)
        for section in ["power", "thermal", "attitude", "comm", "compute", "orbit", "crew"]:
            assert section in telem

    def test_orbit_values(self):
        state = SpacecraftState()
        telem = build_telemetry_dict(state, 0.0)
        assert telem["orbit"]["altitudeKm"] == pytest.approx(650.0, abs=1.0)
        assert telem["orbit"]["inclinationDeg"] == 51.6

    def test_health_fields(self):
        state = SpacecraftState()
        telem = build_telemetry_dict(state, 0.0)
        assert telem["overallHealth"] == state.overall_health
        assert telem["healthStatus"] == state.health_status

    def test_fault_effects_reflected(self):
        engine = TelemetryEngine()
        state = SpacecraftState()
        state.active_faults["comm_failure"] = 2.0
        for _ in range(5):
            engine.tick(state, default_env(), 10.0)
        telem = build_telemetry_dict(state, 0.0)
        assert telem["comm"]["signalDbm"] < -70.0
        assert telem["comm"]["packetsPerSec"] < 240.0