"""Tests for the fault injection engine and fault catalogue mappings."""
import pytest

from engines.fault_engine import (
    FAULT_CATALOGUE,
    FaultEngine,
    resolve_fault_type,
    to_frontend_type,
)
from engines.spacecraft_state import SpacecraftState


class TestResolveFaultType:
    @pytest.mark.parametrize(
        "alias,canonical",
        [
            ("solar-storm", "solar_storm"),
            ("solar-flare", "radiation_spike"),
            ("power-failure", "battery_failure"),
            ("thermal-failure", "thermal_overheating"),
            ("communication-failure", "comm_failure"),
            ("comm-failure", "comm_failure"),
            ("attitude-failure", "attitude_control_failure"),
            ("debris", "solar_panel_degradation"),
            ("space-debris", "solar_panel_degradation"),
            ("sensor-glitch", "sensor_failure"),
            ("thruster-leak", "propulsion_anomaly"),
            ("thermal-overheat", "thermal_overheating"),
            ("communication-loss", "telemetry_loss"),
            ("reaction-wheel-fault", "attitude_control_failure"),
        ],
    )
    def test_aliases(self, alias, canonical):
        assert resolve_fault_type(alias) == canonical

    def test_canonical_underscored_passthrough(self):
        assert resolve_fault_type("solar_storm") == "solar_storm"

    def test_unknown_returns_input(self):
        assert resolve_fault_type("warp_breakdown") == "warp_breakdown"


class TestToFrontendType:
    @pytest.mark.parametrize(
        "canonical,frontend",
        [
            ("solar_storm", "solar-storm"),
            ("battery_failure", "power-failure"),
            ("solar_panel_degradation", "power-failure"),
            ("telemetry_loss", "communication-loss"),
            ("radiation_spike", "solar-flare"),
        ],
    )
    def test_mapping(self, canonical, frontend):
        assert to_frontend_type(canonical) == frontend

    def test_fallback_dashes(self):
        assert to_frontend_type("mystery_fault") == "mystery-fault"


class TestInjectFault:
    def test_inject_unknown_raises(self):
        engine = FaultEngine()
        with pytest.raises(ValueError):
            engine.inject_fault("not_a_real_fault")

    def test_inject_catalogue_fault(self):
        engine = FaultEngine()
        fault = engine.inject_fault("solar_storm")
        assert fault.fault_type == "solar_storm"
        assert fault.name == FAULT_CATALOGUE["solar_storm"]["name"]
        assert engine.get_active_list() == [fault]

    def test_inject_uses_default_severity(self):
        engine = FaultEngine()
        fault = engine.inject_fault("comm_failure")
        assert fault.severity == FAULT_CATALOGUE["comm_failure"]["default_severity"]

    def test_severity_clamped(self):
        engine = FaultEngine()
        fault = engine.inject_fault("comm_failure", severity=500.0)
        assert fault.severity == 10.0
        fault = engine.inject_fault("comm_failure", severity=0.0)
        assert fault.severity == 0.1

    def test_inject_via_alias(self):
        engine = FaultEngine()
        fault = engine.inject_fault("thruster-leak")
        assert fault.fault_type == "propulsion_anomaly"

    def test_effects_scaled_by_severity(self):
        engine = FaultEngine()
        fault = engine.inject_fault("solar_storm", severity=10.0)
        # solar_storm effect scale 1.0 * (10/10) * 10 = 10.0
        assert fault.effects["solar_storm"] == pytest.approx(10.0)


class TestMitigation:
    def test_mitigate_fault(self):
        engine = FaultEngine()
        fault = engine.inject_fault("solar_storm")
        assert engine.mitigate_fault(fault.id) is True
        assert fault.active is False
        assert fault.mitigated_at is not None

    def test_mitigate_unknown_fault(self):
        engine = FaultEngine()
        assert engine.mitigate_fault("nope") is False

    def test_mitigate_by_type(self):
        engine = FaultEngine()
        engine.inject_fault("comm_failure")
        engine.inject_fault("comm_failure")
        assert engine.mitigate_by_type("communication-failure") == 2
        assert engine.mitigate_by_type("comm_failure") == 0

    def test_mitigated_not_in_active(self):
        engine = FaultEngine()
        fault = engine.inject_fault("solar_storm")
        engine.mitigate_fault(fault.id)
        assert engine.get_active_list() == []


class TestApplyToState:
    def test_applies_fault_effects(self):
        engine = FaultEngine()
        engine.inject_fault("solar_storm", severity=10.0)
        state = SpacecraftState()
        engine.apply_to_state(state)
        assert "solar_storm" in state.active_faults
        assert state.active_faults["solar_storm"] == pytest.approx(10.0)

    def test_ignores_mitigated_faults(self):
        engine = FaultEngine()
        fault = engine.inject_fault("comm_failure")
        engine.mitigate_fault(fault.id)
        state = SpacecraftState()
        engine.apply_to_state(state)
        assert state.active_faults == {}

    def test_clears_previous_effects(self):
        engine = FaultEngine()
        engine.inject_fault("comm_failure")
        state = SpacecraftState()
        state.active_faults["stale_fault"] = 1.0
        engine.apply_to_state(state)
        assert "stale_fault" not in state.active_faults

    def test_takes_max_effect_value(self):
        engine = FaultEngine()
        engine.inject_fault("solar_storm", severity=10.0)
        engine.inject_fault("solar_storm", severity=5.0)
        state = SpacecraftState()
        engine.apply_to_state(state)
        assert state.active_faults["solar_storm"] == pytest.approx(10.0)


class TestThreatScenarios:
    def test_to_threat_scenarios(self):
        engine = FaultEngine()
        fault = engine.inject_fault("solar_storm", severity=8.0)
        scenarios = engine.to_threat_scenarios()
        assert len(scenarios) == 1
        assert scenarios[0]["id"] == fault.id
        assert scenarios[0]["type"] == "solar-storm"
        assert scenarios[0]["severity"] == "critical"

    def test_warning_severity(self):
        engine = FaultEngine()
        engine.inject_fault("solar_storm", severity=5.0)
        scenarios = engine.to_threat_scenarios()
        assert scenarios[0]["severity"] == "warning"