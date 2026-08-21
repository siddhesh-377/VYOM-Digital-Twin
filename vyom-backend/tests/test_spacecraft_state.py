"""Tests for spacecraft state health aggregation."""
import pytest

from engines.spacecraft_state import SpacecraftState, SubsystemHealth


class TestUpdateHealth:
    def test_average_health_computed(self):
        state = SpacecraftState()
        state.subsystems = [
            SubsystemHealth("A", health=100.0),
            SubsystemHealth("B", health=50.0),
            SubsystemHealth("C", health=0.0),
        ]
        state.update_health()
        assert state.overall_health == pytest.approx(50.0)

    def test_status_nominal(self):
        state = SpacecraftState()
        state.subsystems = [SubsystemHealth("A", health=90.0)]
        state.update_health()
        assert state.health_status == "nominal"

    def test_status_warning(self):
        state = SpacecraftState()
        state.subsystems = [SubsystemHealth("A", health=60.0)]
        state.update_health()
        assert state.health_status == "warning"

    def test_status_critical(self):
        state = SpacecraftState()
        state.subsystems = [SubsystemHealth("A", health=30.0)]
        state.update_health()
        assert state.health_status == "critical"

    def test_status_failed(self):
        state = SpacecraftState()
        state.subsystems = [SubsystemHealth("A", health=10.0)]
        state.update_health()
        assert state.health_status == "failed"

    def test_health_clamped_to_100(self):
        state = SpacecraftState()
        state.subsystems = [SubsystemHealth("A", health=500.0)]
        state.update_health()
        assert state.overall_health == 100.0

    def test_health_clamped_to_0(self):
        state = SpacecraftState()
        state.subsystems = [SubsystemHealth("A", health=-10.0)]
        state.update_health()
        assert state.overall_health == 0.0

    def test_no_subsystems_returns(self):
        state = SpacecraftState()
        state.subsystems = []
        state.update_health()
        assert state.overall_health == 98.5  # unchanged


class TestGetSubsystem:
    def test_find_by_substring(self):
        state = SpacecraftState()
        sys_ = state.get_subsystem("Power")
        assert sys_ is not None
        assert sys_.name == "Power & Solar Arrays"

    def test_missing_returns_none(self):
        state = SpacecraftState()
        assert state.get_subsystem("Warp Core") is None

    def test_case_insensitive(self):
        state = SpacecraftState()
        assert state.get_subsystem("COMMUNICATIONS") is not None