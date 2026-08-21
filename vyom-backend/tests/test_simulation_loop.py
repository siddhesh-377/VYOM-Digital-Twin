"""Tests for the core simulation loop and its control functions."""
import asyncio

import pytest

from simulation.loop import (
    MissionSimulation,
    create_simulation,
    get_simulation,
    start_simulation,
    stop_simulation,
    pause_simulation,
    resume_simulation,
    set_time_multiplier,
    _simulations,
)


@pytest.fixture
def sim():
    _simulations.clear()
    yield create_simulation("TEST-LOOP", {"initial_alt_km": 650.0})
    _simulations.clear()


class TestRegistry:
    def test_create_simulation(self, sim):
        assert get_simulation("TEST-LOOP") is sim
        assert sim.status == "configuring"

    def test_get_missing_returns_none(self):
        assert get_simulation("DOES-NOT-EXIST") is None

    def test_stop_removes_from_registry(self, sim):
        asyncio.run(stop_simulation("TEST-LOOP"))
        assert get_simulation("TEST-LOOP") is None

    def test_start_marks_active(self, sim):
        asyncio.run(start_simulation("TEST-LOOP"))
        assert sim.status == "active"
        asyncio.run(stop_simulation("TEST-LOOP"))

    def test_start_missing_simulation_returns_false(self):
        assert asyncio.run(start_simulation("NOPE")) is False

    def test_pause_and_resume(self, sim):
        assert pause_simulation("TEST-LOOP") is True
        assert sim.paused is True
        assert sim.status == "paused"
        assert resume_simulation("TEST-LOOP") is True
        assert sim.paused is False
        assert sim.status == "active"

    def test_pause_missing_returns_false(self):
        assert pause_simulation("NOPE") is False

    def test_set_time_multiplier(self, sim):
        assert set_time_multiplier("TEST-LOOP", 50) is True
        assert sim.time_multiplier == 50

    def test_set_time_multiplier_clamps_low(self, sim):
        set_time_multiplier("TEST-LOOP", 0)
        assert sim.time_multiplier == 1


class TestTick:
    def test_tick_advances_mission_day(self, sim):
        asyncio.run(sim._tick(10.0, 0))
        assert sim.elapsed_sim_s == pytest.approx(10.0)
        assert sim.mission_day == pytest.approx(10.0 / 86400.0)

    def test_tick_updates_state(self, sim):
        asyncio.run(sim._tick(10.0, 0))
        assert sim.state.elapsed_sim_s == pytest.approx(10.0)
        assert sim.state.orbit.altitude_km > 0

    def test_tick_produces_anomaly_list(self, sim):
        asyncio.run(sim._tick(10.0, 0))
        anomalies = sim.anomaly_det.active_anomalies
        assert isinstance(anomalies, list)
        for a in anomalies:
            assert a.channel and a.severity in ("warning", "critical")

    def test_injected_fault_appears_in_state(self, sim):
        sim.fault_engine.inject_fault("solar_storm", severity=8.0)
        asyncio.run(sim._tick(10.0, 0))
        assert "solar_storm" in sim.state.active_faults

    def test_tick_persists_telemetry_after_threshold(self, sim):
        sim.time_multiplier = 100
        for _ in range(5):
            asyncio.run(sim._tick(10.0, 0))
        # After enough sim time DB writes happen (guard: table must exist)
        from core.database import SessionLocal, TelemetryRecord
        db = SessionLocal()
        try:
            count = db.query(TelemetryRecord).filter(
                TelemetryRecord.mission_id == "TEST-LOOP").count()
        finally:
            db.close()
        assert count >= 1

    def test_update_objective_progress(self, sim):
        sim.elapsed_sim_s = 2 * 86400  # day 2
        sim.mission_day = 2.0
        sim._update_objective()
        assert sim.objective_progress > 0.0

    def test_objective_completes_at_98(self, sim):
        sim.status = "active"
        sim.elapsed_sim_s = 30 * 86400
        sim.mission_day = 30.0
        sim._update_objective()
        assert sim.objective_progress == 100.0
        assert sim.status == "completed"


class TestRunLoop:
    def test_run_loop_executes_ticks(self):
        sim = create_simulation("TEST-RUN", {})
        sim.time_multiplier = 100

        async def run_short():
            task = asyncio.create_task(sim.run())
            await asyncio.sleep(0.4)  # ~4 ticks
            sim.running = False
            await task

        asyncio.run(run_short())
        assert sim.elapsed_sim_s > 0
        assert sim.mission_day > 0

    def test_run_loop_respects_pause(self):
        sim = create_simulation("TEST-RUN-PAUSE", {})
        sim.paused = True

        async def run_short():
            task = asyncio.create_task(sim.run())
            await asyncio.sleep(0.3)
            sim.running = False
            await task

        asyncio.run(run_short())
        assert sim.elapsed_sim_s == 0.0