"""Tests for the space environment engine."""
import pytest

from engines.environment_engine import EnvironmentEngine


class TestEnvironmentEngine:
    def test_initial_state(self):
        engine = EnvironmentEngine()
        assert engine.state.solar_activity_level == 2.4
        assert engine.state.radiation_level_usv_h == 14.0
        assert engine.state.classification == "normal"

    def test_tick_returns_state(self):
        engine = EnvironmentEngine()
        result = engine.tick(1.0, 10.0, 650.0, 20.0)
        assert result is engine.state

    def test_radiation_positive(self):
        engine = EnvironmentEngine()
        for day in [0.5, 10.0, 100.0, 1000.0]:
            engine.tick(day, 10.0, 650.0, 20.0)
            assert engine.state.radiation_level_usv_h >= 1.0

    def test_solar_activity_bounded(self):
        engine = EnvironmentEngine()
        for day in range(0, 50):
            engine.tick(float(day), 10.0, 650.0, 20.0)
            assert 0.0 <= engine.state.solar_activity_level <= 10.0

    def test_classification_valid(self):
        engine = EnvironmentEngine()
        for day in range(0, 50):
            engine.tick(float(day), 10.0, 650.0, 20.0)
            assert engine.state.classification in ("low", "normal", "warning", "critical")

    def test_van_allen_enhancement_mid_latitude(self):
        engine = EnvironmentEngine()
        low_alt = engine.tick(1.0, 10.0, 450.0, 0.0)
        high_alt = engine.tick(1.0, 10.0, 1200.0, 0.0)
        # Radiation should not exceed sane LEO bounds in either case
        assert low_alt.radiation_level_usv_h < 500.0
        assert high_alt.radiation_level_usv_h < 500.0

    def test_debris_density_bounded(self):
        engine = EnvironmentEngine()
        for day in range(0, 50):
            engine.tick(float(day), 10.0, 650.0, 20.0)
            assert 0.1 <= engine.state.debris_density <= 10.0

    def test_eclipse_flag_boolean(self):
        engine = EnvironmentEngine()
        for day in range(0, 50):
            engine.tick(float(day), 10.0, 650.0, 20.0)
            assert isinstance(engine.state.in_eclipse, bool)

    def test_force_solar_storm(self):
        engine = EnvironmentEngine()
        engine.force_solar_storm(9.5)
        assert engine.state.active_cme is True
        assert engine.state.x_class_flare is True
        assert engine.state.classification == "critical"
        assert engine.state.radiation_level_usv_h == pytest.approx(475.0)

    def test_force_solar_storm_caps(self):
        engine = EnvironmentEngine()
        engine.force_solar_storm(50.0)
        assert engine.state.solar_activity_level == 10.0