"""
VYOM Backend — Core Simulation Loop
Authoritative asyncio background task that drives the entire mission simulation.
"""
import asyncio
import time
import uuid
import math
import logging
from typing import Dict, Set, Any, Optional, List
from sqlalchemy.orm import Session

from core.database import SessionLocal, TelemetryRecord, BlackBoxEvent as BBEvent, \
    Mission, ActiveFault as FaultRecord, MissionSnapshot
from engines.spacecraft_state import SpacecraftState, SubsystemHealth
from engines.physics.orbital import default_leo_state, propagate, OrbitalState
from engines.environment_engine import EnvironmentEngine
from engines.telemetry_engine import TelemetryEngine, build_telemetry_dict
from engines.fault_engine import FaultEngine
from engines.anomaly_detector import AnomalyDetector
from engines.ai_guardian import AIGuardian
from engines.command_engine import CommandEngine
from engines.recovery_engine import RecoveryEngine

logger = logging.getLogger("vyom")

TICK_RATE_HZ = 10          # simulation tick rate (real time)
TICK_INTERVAL_S = 1.0 / TICK_RATE_HZ
DB_WRITE_EVERY_S = 2.0     # write telemetry to DB every N sim seconds
SNAPSHOT_EVERY_S = 60.0    # full state snapshot every N sim seconds


class MissionSimulation:
    """Complete simulation instance for one mission."""

    def __init__(self, mission_id: str, config: Dict[str, Any]):
        self.mission_id = mission_id
        self.config = config
        self.running = False
        self.paused = False
        self.time_multiplier = 1

        # Core state
        alt = config.get("initial_alt_km", 650.0)
        inc = config.get("inclination_deg", 51.6)
        orbit = default_leo_state(alt_km=alt, inclination_deg=inc)
        self.state = SpacecraftState(orbit=orbit)

        # Engines
        self.env_engine   = EnvironmentEngine()
        self.telem_engine = TelemetryEngine()
        self.fault_engine = FaultEngine()
        self.anomaly_det  = AnomalyDetector()
        self.ai_guardian  = AIGuardian()
        self.cmd_engine   = CommandEngine(mission_id)
        self.recovery_eng = RecoveryEngine()

        # Timing
        self.elapsed_sim_s: float = 0.0
        self.mission_day: float = 0.0
        self._last_db_write_s: float = 0.0
        self._last_snapshot_s: float = 0.0
        self._last_ai_check_s: float = 0.0
        self._command_executed_at: Optional[float] = None

        # WS broadcast callback (set by WebSocket hub)
        self.broadcast_callback = None

        # Objective tracking
        self.objective_progress: float = 2.0
        self.milestones_completed: set = set()
        self.status: str = "active"

        # Orbit trail (last 600 points for frontend)
        self.orbit_trail: List[Dict] = []
        self._orbit_trail_counter = 0

    async def run(self):
        """Main simulation loop."""
        self.running = True
        prev_wall_time = time.time()
        loop_count = 0

        while self.running:
            loop_start = time.time()

            if not self.paused and self.status not in ["completed", "failed"]:
                # Real delta since last tick
                now = time.time()
                real_dt_s = now - prev_wall_time
                prev_wall_time = now

                # Simulation time step
                sim_dt_s = real_dt_s * self.time_multiplier
                sim_dt_s = min(sim_dt_s, 60.0)  # cap at 60s per tick to avoid instability

                try:
                    await self._tick(sim_dt_s, loop_count)
                except Exception:
                    logger.exception("Simulation tick failed for mission %s", self.mission_id)
                loop_count += 1
            else:
                prev_wall_time = time.time()

            # Sleep to maintain tick rate
            elapsed = time.time() - loop_start
            sleep_time = max(0, TICK_INTERVAL_S - elapsed)
            await asyncio.sleep(sleep_time)

    async def _tick(self, sim_dt_s: float, tick_count: int):
        """Single simulation tick."""
        # ── 1. Advance time ──────────────────────────────────────────────────
        self.elapsed_sim_s += sim_dt_s
        self.mission_day = self.elapsed_sim_s / (24 * 3600)
        self.state.elapsed_sim_s = self.elapsed_sim_s
        self.state.mission_day = self.mission_day

        # ── 2. Orbital mechanics ─────────────────────────────────────────────
        self.state.orbit = propagate(self.state.orbit, sim_dt_s, self.elapsed_sim_s)

        # ── 3. Environment ───────────────────────────────────────────────────
        env = self.env_engine.tick(
            self.mission_day, sim_dt_s,
            self.state.orbit.altitude_km, self.state.orbit.latitude_deg
        )

        # ── 4. Apply active faults to state ──────────────────────────────────
        self.fault_engine.apply_to_state(self.state)

        # ── 5. Telemetry physics ─────────────────────────────────────────────
        self.telem_engine.tick(self.state, env, sim_dt_s)

        # ── 6. Anomaly detection ─────────────────────────────────────────────
        anomalies = self.anomaly_det.detect(self.state, sim_dt_s)

        # ── 7. AI Guardian (every 2s sim time to avoid hammering) ────────────
        ai_analysis = None
        if self.elapsed_sim_s - self._last_ai_check_s >= 2.0 and anomalies:
            self._last_ai_check_s = self.elapsed_sim_s
            diagnosis = self.ai_guardian.run_pipeline(anomalies, self.state)
            ai_analysis = self.ai_guardian.build_ai_analysis(diagnosis, anomalies)

            # Auto-execute commands if diagnosis found
            if diagnosis and self.config.get("control_mode", "autonomous") == "autonomous":
                for cmd_spec in diagnosis.commands[:2]:  # execute first 2 commands
                    self.cmd_engine.submit(
                        cmd_spec["type"], cmd_spec.get("params", {}),
                        self.state, self.mission_day
                    )
                self._command_executed_at = self.elapsed_sim_s
                self.recovery_eng.begin_monitoring(diagnosis.root_cause, self.elapsed_sim_s)
        elif not anomalies:
            ai_analysis = self.ai_guardian.build_ai_analysis(None, [])

        # ── 8. Execute commands ───────────────────────────────────────────────
        executed_cmds = self.cmd_engine.execute_pending(self.state)

        # ── 9. Recovery check ─────────────────────────────────────────────────
        if self._command_executed_at is not None:
            elapsed_since = self.elapsed_sim_s - self._command_executed_at
            recovered = self.recovery_eng.tick(anomalies, self.state, elapsed_since)
            for fault_type in recovered:
                await self._log_event("recovery", "nominal",
                                      f"Recovery confirmed for {fault_type} — all telemetry nominal",
                                      "Recovery Engine")
                # Clear corresponding fault
                self.fault_engine.mitigate_by_type(fault_type)
                self.state.safe_mode = False

        # ── 10. Objective progress ─────────────────────────────────────────────
        self._update_objective()

        # ── 11. Orbit trail ────────────────────────────────────────────────────
        self._orbit_trail_counter += 1
        if self._orbit_trail_counter % 30 == 0:  # every 30 ticks
            self.orbit_trail.append({
                "lat": round(self.state.orbit.latitude_deg, 4),
                "lng": round(self.state.orbit.longitude_deg, 4),
                "alt": round(self.state.orbit.altitude_km, 2),
                "timestamp": int(time.time() * 1000),
            })
            if len(self.orbit_trail) > 600:
                self.orbit_trail = self.orbit_trail[-600:]

        # ── 12. DB persistence ─────────────────────────────────────────────────
        if self.elapsed_sim_s - self._last_db_write_s >= DB_WRITE_EVERY_S:
            self._last_db_write_s = self.elapsed_sim_s
            await self._persist_telemetry()

        if self.elapsed_sim_s - self._last_snapshot_s >= SNAPSHOT_EVERY_S:
            self._last_snapshot_s = self.elapsed_sim_s
            await self._persist_snapshot()

        # ── 13. Broadcast via WebSocket ────────────────────────────────────────
        if self.broadcast_callback:
            telem = build_telemetry_dict(self.state, self.mission_day)
            messages = [
                {"type": "TELEMETRY_UPDATE", "payload": telem},
                {
                    "type": "CLOCK_TICK",
                    "payload": {
                        "missionDay": round(self.mission_day, 6),
                        "elapsedRealMs": int(self.elapsed_sim_s * 1000),
                        "timeMultiplier": self.time_multiplier,
                        "objectiveProgress": round(self.objective_progress, 2),
                        "status": self.status,
                    }
                },
                {
                    "type": "SUBSYSTEM_HEALTH",
                    "payload": {
                        "subsystems": [
                            {
                                "name": s.name,
                                "health": round(s.health, 2),
                                "status": s.status,
                                "temperature": round(s.temperature, 2),
                            }
                            for s in self.state.subsystems
                        ]
                    }
                },
                {
                    "type": "ENVIRONMENT_UPDATE",
                    "payload": {
                        "solarActivityLevel": env.solar_activity_level,
                        "radiationLevel": env.radiation_level_usv_h,
                        "magneticFieldNT": env.magnetic_field_nt,
                        "debrisDensity": env.debris_density,
                        "classification": env.classification,
                        "inEclipse": env.in_eclipse,
                        "temperatureRangeC": env.temperature_range_c,
                        "dataSource": "backend",
                    }
                },
            ]

            if ai_analysis:
                messages.append({"type": "AI_ANALYSIS", "payload": ai_analysis})

            if anomalies:
                messages.append({
                    "type": "ANOMALY_UPDATE",
                    "payload": [
                        {
                            "id": a.id,
                            "subsystem": a.subsystem,
                            "channel": a.channel,
                            "severity": a.severity,
                            "confidence": a.confidence,
                            "description": a.description,
                            "detectedAt": int(a.detected_at * 1000),
                        }
                        for a in anomalies[:10]  # top 10
                    ]
                })

            if executed_cmds:
                for cmd in executed_cmds:
                    messages.append({
                        "type": "COMMAND_UPDATE",
                        "payload": {
                            "id": cmd.id,
                            "command_type": cmd.command_type,
                            "status": cmd.status,
                            "result": cmd.result,
                        }
                    })

            # Active threats (faults in ThreatScenario format)
            faults = self.fault_engine.to_threat_scenarios()
            if faults:
                messages.append({"type": "THREAT_UPDATE", "payload": faults})

            await self.broadcast_callback(messages)

    def _update_objective(self):
        """Update objective progress based on mission day and health."""
        if self.status == "completed":
            return
        # Simple model: progress driven by mission day and subsystem health
        health_factor = self.state.overall_health / 100.0
        day_progress = min(98.0, self.mission_day * 5.0)  # 5% per day, capped at 98
        self.objective_progress = round(day_progress * health_factor, 2)
        if self.objective_progress >= 98.0 and self.status == "active":
            self.objective_progress = 100.0
            self.status = "completed"

    async def _log_event(self, event_type: str, severity: str, description: str, source: str):
        """Persist a Black Box event and broadcast it."""
        ev_id = f"bb-{int(time.time()*1000)}-{uuid.uuid4().hex[:4]}"
        event = {
            "id": ev_id,
            "missionDay": round(self.mission_day, 4),
            "timestamp": int(time.time() * 1000),
            "eventType": event_type,
            "severity": severity,
            "description": description,
            "source": source,
            "immutable": True,
        }
        # Persist to DB
        db: Session = SessionLocal()
        try:
            db_event = BBEvent(
                id=ev_id,
                mission_id=self.mission_id,
                mission_day=self.mission_day,
                timestamp=event["timestamp"],
                event_type=event_type,
                severity=severity,
                description=description,
                source=source,
            )
            db.add(db_event)
            db.commit()
        except Exception as e:
            logger.warning("DB event write failed: %s", e)
        finally:
            db.close()

        # Broadcast to WS clients
        if self.broadcast_callback:
            await self.broadcast_callback([{"type": "BLACKBOX_EVENT", "payload": event}])

    async def _persist_telemetry(self):
        db: Session = SessionLocal()
        try:
            telem = build_telemetry_dict(self.state, self.mission_day)
            rec = TelemetryRecord(
                mission_id=self.mission_id,
                mission_day=self.mission_day,
                sim_timestamp=int(time.time() * 1000),
                data=telem,
            )
            db.add(rec)
            db.commit()
        except Exception as e:
            logger.warning("Telemetry DB write failed: %s", e)
        finally:
            db.close()

    async def _persist_snapshot(self):
        db: Session = SessionLocal()
        try:
            snap = MissionSnapshot(
                mission_id=self.mission_id,
                mission_day=self.mission_day,
                sim_timestamp=int(time.time() * 1000),
                state_json={
                    "mission_day": self.mission_day,
                    "elapsed_sim_s": self.elapsed_sim_s,
                    "objective_progress": self.objective_progress,
                    "status": self.status,
                    "overall_health": self.state.overall_health,
                    "orbit_trail_len": len(self.orbit_trail),
                },
            )
            db.add(snap)
            db.commit()
        except Exception as e:
            logger.warning("Snapshot DB write failed: %s", e)
        finally:
            db.close()


# ── Global Simulation Registry ────────────────────────────────────────────────
# mission_id -> MissionSimulation
_simulations: Dict[str, MissionSimulation] = {}
_tasks: Dict[str, asyncio.Task] = {}


def get_simulation(mission_id: str) -> Optional[MissionSimulation]:
    return _simulations.get(mission_id)


def create_simulation(mission_id: str, config: Dict) -> MissionSimulation:
    sim = MissionSimulation(mission_id, config)
    sim.status = "configuring"
    _simulations[mission_id] = sim
    return sim


async def start_simulation(mission_id: str) -> bool:
    sim = _simulations.get(mission_id)
    if not sim:
        return False
    if mission_id in _tasks and not _tasks[mission_id].done():
        return True  # already running

    task = asyncio.create_task(sim.run(), name=f"sim-{mission_id}")
    _tasks[mission_id] = task
    sim.status = "active"
    return True


async def stop_simulation(mission_id: str) -> bool:
    sim = _simulations.get(mission_id)
    if sim:
        sim.running = False
    task = _tasks.get(mission_id)
    if task and not task.done():
        task.cancel()
        try:
            await task
        except asyncio.CancelledError:
            pass
    _tasks.pop(mission_id, None)
    _simulations.pop(mission_id, None)
    return True


def pause_simulation(mission_id: str) -> bool:
    sim = _simulations.get(mission_id)
    if sim:
        sim.paused = True
        if sim.status not in ("completed", "failed"):
            sim.status = "paused"
        return True
    return False


def resume_simulation(mission_id: str) -> bool:
    sim = _simulations.get(mission_id)
    if sim:
        sim.paused = False
        if sim.status != "completed":
            sim.status = "active"
        return True
    return False


def set_time_multiplier(mission_id: str, multiplier: int) -> bool:
    sim = _simulations.get(mission_id)
    if sim:
        sim.time_multiplier = max(1, min(10_000_000, multiplier))
        return True
    return False
