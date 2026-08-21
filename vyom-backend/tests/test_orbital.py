"""Tests for the Keplerian orbital mechanics propagator."""
import math

import pytest

from engines.physics.orbital import (
    GM_EARTH,
    R_EARTH,
    default_leo_state,
    propagate,
    _eccentric_to_mean,
    _mean_to_eccentric,
    _true_to_eccentric,
    _eccentric_to_true,
)


class TestDefaultLeoState:
    def test_default_altitude(self):
        state = default_leo_state()
        assert state.altitude_km == 650.0
        assert state.inclination_deg == 51.6
        assert state.true_anomaly_deg == 0.0

    def test_semi_major_axis(self):
        state = default_leo_state()
        assert state.semi_major_axis_km == pytest.approx(R_EARTH + 650.0)

    def test_period_consistent_with_kepler(self):
        state = default_leo_state()
        expected = 2 * math.pi * math.sqrt(state.semi_major_axis_km**3 / GM_EARTH) / 60.0
        assert state.period_min == pytest.approx(expected, rel=1e-3)

    def test_velocity_vis_viva(self):
        state = default_leo_state()
        expected = math.sqrt(GM_EARTH / state.semi_major_axis_km)
        assert state.velocity_kms == pytest.approx(expected, rel=1e-3)


class TestKeplerConversions:
    def test_true_to_eccentric_round_trip(self):
        for nu_deg in [0.0, 45.0, 90.0, 180.0, 270.0, 359.0]:
            nu = math.radians(nu_deg)
            E = _true_to_eccentric(nu, 0.01)
            nu_back = _eccentric_to_true(E, 0.01)
            assert nu_back == pytest.approx(nu, abs=1e-6)

    def test_mean_to_eccentric_inverse(self):
        ecc = 0.05
        for E0 in [0.1, 1.0, 2.0, 3.0, 5.0]:
            M = _eccentric_to_mean(E0, ecc)
            E1 = _mean_to_eccentric(M, ecc)
            assert E1 == pytest.approx(E0, abs=1e-6)


class TestPropagate:
    def test_full_orbital_period_returns_to_start(self):
        state = default_leo_state()
        T = state.period_min * 60.0
        new = propagate(state, T, T)
        assert new.true_anomaly_deg % 360.0 == pytest.approx(0.0, abs=1e-6)
        assert new.semi_major_axis_km == pytest.approx(state.semi_major_axis_km)

    def test_altitude_within_expected_band(self):
        state = default_leo_state()
        new = propagate(state, 60.0, 60.0)
        # LEO around 650 km; apogee/perigee are ~659/~642 km
        assert 630.0 < new.altitude_km < 670.0

    def test_true_anomaly_advances(self):
        state = default_leo_state()
        new = propagate(state, 60.0, 60.0)
        # Mean motion ~0.0644 rad/60s -> ~3.7 degrees per minute
        assert 0.0 < new.true_anomaly_deg < 5.0

    def test_latitude_longitude_within_range(self):
        state = default_leo_state()
        new = propagate(state, 300.0, 300.0)
        assert -90.0 <= new.latitude_deg <= 90.0
        assert -180.0 <= new.longitude_deg <= 180.0

    def test_drag_is_small_at_leo(self):
        state = default_leo_state()
        new = propagate(state, 60.0, 60.0)
        assert new.atmospheric_drag_n >= 0
        assert new.atmospheric_layer in ("Thermosphere", "Exosphere")

    def test_apogee_perigee_consistent(self):
        state = default_leo_state()
        a = state.semi_major_axis_km
        e = state.eccentricity
        new = propagate(state, 60.0, 60.0)
        assert new.apogee_km == pytest.approx(a * (1 + e) - R_EARTH)
        assert new.perigee_km == pytest.approx(a * (1 - e) - R_EARTH)