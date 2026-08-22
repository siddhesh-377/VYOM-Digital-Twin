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
    Mission, ActiveFault as FaultRecord, MissionSnapshot, \
    Incident as IncidentRecord, CrewHealthRecord, DailySummary, \
    MissionRiskHistory, ScheduledActivity, MissionObjective as MissionObjectiveModel
from engines.spacecraft_state import SpacecraftState, SubsystemHealth
from engines.physics.orbital import default_leo_state, propagate, OrbitalState
from engines.environment_engine import EnvironmentEngine
from engines.telemetry_engine import TelemetryEngine, build_telemetry_dict
from engines.fault_engine import FaultEngine
from engines.anomaly_detector import AnomalyDetector
from engines.ai_guardian import AIGuardian
from engines.command_engine import CommandEngine
from engines.recovery_engine import RecoveryEngine
from engines.incident_engine import IncidentEngine
from engines.crew_health_engine import CrewHealthEngine
from engines.risk_engine import RiskEngine
from engines.trajectory_engine import TrajectoryEngine
from engines.rul_engine import RULEngine
from engines.farewell_engine import FarewellEngine
from engines.daily_summary_engine import DailySummaryEngine
from engines.scenario_engine import ScenarioEngine

logger = logging.getLogger("vyom")

TICK_RATE_HZ = 10          # simulation tick rate (real time)
TICK_INTERVAL_S = 1.0 / TICK_RATE_HZ
DB_WRITE_EVERY_S = 2.0     # write telemetry to DB every N sim seconds
SNAPSHOT_EVERY_S = 60.0    # full state snapshot every N sim seconds

# Sub-stepped integration limits. Physics stays stable because no single step
# exceeds MAX_PHYSICS_STEP_S; high time-warp factors are honored by running
# multiple physics steps per wall-clock tick.
MAX_PHYSICS_STEP_S = 60.0
MAX_SUBSTEPS_PER_TICK = 30   # 30 x 60s x 10Hz = up to 18,000x effective speed

# Corrective command -> fault types it is designed to clear. Only applied
# while a recovery attempt is being monitored; verified by RecoveryEngine.
COMMAND_FIXES = {
    "SWITCH_ANTENNA":          ["comm_failure", "telemetry_loss"],
    "RECALIBRATE_COMM":        ["comm_failure", "telemetry_loss"],
    "ACTIVATE_THERMAL_SHUNT":  ["thermal_overheating"],
    "MOMENTUM_DUMP":           ["attitude_control_failure"],
    "GYRO_RECALIBRATION":      ["attitude_control_failure", "sensor_failure"],
    "ISOLATE_THRUSTER_VALVE":  ["propulsion_anomaly"],
    "MEMORY_SCRUBBING":        ["radiation_spike"],
    "RADIATION_SAFE_MODE":     ["radiation_spike"],
    "EMERGENCY_LOAD_SHEDDING": ["battery_failure"],
    "SUSPEND_NON_ESSENTIAL":   ["solar_panel_degradation"],
}


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
        
        # v3.0 Engines
        self.incident_engine = IncidentEngine()
        self.crew_health_engine = CrewHealthEngine()
        self.risk_engine = RiskEngine()
        self.trajectory_engine = TrajectoryEngine()
        # Generate the mission-specific planned trajectory so actual flight can
        # be tracked against plan from Mission Day 0
        try:
            self.trajectory_engine.plan_trajectory(
                {
                    "altitude_km": alt,
                    "inclination_deg": inc,
                    **{k: v for k, v in config.items() if isinstance(v, (int, float, str))},
                },
                config.get("destination", "earth-orbit"),
            )
        except Exception:
            logger.warning("Trajectory planning failed; continuing without plan", exc_info=True)
        self.rul_engine = RULEngine()
        self.farewell_engine = FarewellEngine()
        self.daily_summary_engine = DailySummaryEngine()
        self.scenario_engine = ScenarioEngine()

        # Timing
        self.elapsed_sim_s: float = 0.0
        self.mission_day: float = 0.0
        self.current_day_int: int = 0
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
        self.mission_phase: str = "pre-launch"

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

                # Total simulated time to advance this tick
                sim_dt_s = real_dt_s * self.time_multiplier

                # Sub-stepped integration: physics steps are kept <= 60 s each
                # for numerical stability, but up to MAX_SUBSTEPS_PER_TICK steps
                # run per tick so high time-warp settings actually deliver the
                # promised simulation rate instead of being silently clamped.
                n_substeps = max(1, min(MAX_SUBSTEPS_PER_TICK,
                                        math.ceil(sim_dt_s / MAX_PHYSICS_STEP_S)))
                step_dt = sim_dt_s / n_substeps

                try:
                    for _ in range(n_substeps):
                        await self._tick(step_dt, loop_count)
                        if self.paused or self.status in ["completed", "failed"]:
                            break
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
        
        # Check integer day transition
        new_day_int = int(self.mission_day)
        if new_day_int > self.current_day_int:
            # Generate daily summary and persist
            db = SessionLocal()
            try:
                summary = self.daily_summary_engine.generate_summary(self.mission_id, self.current_day_int)
                db_summary = DailySummary(
                    mission_id=self.mission_id,
                    mission_day=self.current_day_int,
                    summary_json=summary,
                    orbital_path_json=self.daily_summary_engine.get_orbital_path(self.current_day_int),
                    created_at=int(time.time() * 1000)
                )
                db.add(db_summary)
                db.commit()
                if self.broadcast_callback:
                    await self.broadcast_callback([{"type": "DAILY_SUMMARY", "payload": summary}])
            except Exception as e:
                logger.error(f"Failed to generate daily summary: {e}")
            finally:
                db.close()
            self.current_day_int = new_day_int

        # ── 2. Orbital mechanics ─────────────────────────────────────────────
        self.state.orbit = propagate(self.state.orbit, sim_dt_s, self.elapsed_sim_s)
        self.trajectory_engine.record_actual_point(
            self.mission_day, self.state.orbit.latitude_deg, self.state.orbit.longitude_deg, 
            self.state.orbit.altitude_km, self.state.orbit.velocity_kms
        )

        # ── 3. Environment ───────────────────────────────────────────────────
        env = self.env_engine.tick(
            self.mission_day, sim_dt_s,
            self.state.orbit.altitude_km, self.state.orbit.latitude_deg
        )

        # ── 4. Apply active faults to state ──────────────────────────────────
        self.fault_engine.apply_to_state(self.state)

        # ── 5. Telemetry physics ─────────────────────────────────────────────
        self.telem_engine.tick(self.state, env, sim_dt_s)
        
        # ── Crew Health Update ──
        if self.config.get("crew_json"):
            # Initialize on first tick
            if not self.crew_health_engine.crew_state:
                self.crew_health_engine.initialize_crew(self.config.get("crew_json"))
            crew_vitals = self.crew_health_engine.tick(sim_dt_s, self.mission_day, env.__dict__, self.fault_engine.active_faults)
            # Update state crew array
            self.state.crew = self.crew_health_engine.to_snapshot_list()

        # ── 6. Anomaly detection ─────────────────────────────────────────────
        anomalies = self.anomaly_det.detect(self.state, sim_dt_s)

        # ── 7. AI Guardian (every 0.5s sim time for fast 6-second response) ───
        ai_analysis = None
        if self.elapsed_sim_s - self._last_ai_check_s >= 0.5 and anomalies:
            self._last_ai_check_s = self.elapsed_sim_s
            diagnosis = self.ai_guardian.run_pipeline(anomalies, self.state)
            ai_analysis = self.ai_guardian.build_ai_analysis(diagnosis, anomalies)
            
            # Find associated incident (if any)
            active_faults = list(self.fault_engine.active_faults.values())
            for fault in active_faults:
                if getattr(fault, 'incident_id', None):
                    self.incident_engine.record_diagnosis(fault.incident_id, ai_analysis, self.elapsed_sim_s)
                    self._sync_incident_to_db(fault.incident_id)
                    # Broadcast incident update
                    if self.broadcast_callback:
                        incident = self.incident_engine.get_incident(fault.incident_id)
                        asyncio.create_task(self.broadcast_callback([{"type": "INCIDENT_UPDATE", "payload": incident}]))

            # Auto-execute commands if diagnosis found
            if diagnosis and self.config.get("control_mode", "autonomous") == "autonomous":
                for cmd_spec in diagnosis.commands[:2]:  # execute first 2 commands
                    self.cmd_engine.submit(
                        cmd_spec["type"], cmd_spec.get("params", {}),
                        self.state, self.mission_day
                    )
                self._command_executed_at = self.elapsed_sim_s
                self.recovery_eng.begin_monitoring(diagnosis.root_cause, self.elapsed_sim_s)
                # Also monitor each active injected fault by its canonical type so
                # recovery confirmation targets the real fault even when the AI
                # classification falls back to unknown_anomaly
                for fault in active_faults:
                    if fault.active and getattr(fault, 'incident_id', None):
                        self.recovery_eng.begin_monitoring(fault.fault_type, self.elapsed_sim_s)

                # Update incident for auto-recovery (never override a manual takeover)
                for fault in active_faults:
                    if getattr(fault, 'incident_id', None):
                        live_inc = self.incident_engine.get_incident(fault.incident_id)
                        if live_inc and live_inc.get("recovery_mode") == "manual":
                            continue  # operator has taken control of this incident
                        self.incident_engine.record_decision(fault.incident_id, "ai", "Autonomous Execution", self.elapsed_sim_s)
                        self.incident_engine.start_recovery(fault.incident_id, self.elapsed_sim_s)
                        self._sync_incident_to_db(fault.incident_id)
                        
        elif not anomalies:
            ai_analysis = self.ai_guardian.build_ai_analysis(None, [])

        # ── 8. Execute commands ───────────────────────────────────────────────
        executed_cmds = self.cmd_engine.execute_pending(self.state)

        # A completed corrective command mitigates its target fault in the
        # FaultEngine registry (telemetry effects would otherwise be re-applied
        # every tick). The Recovery Engine still independently verifies that
        # telemetry actually returns to nominal before confirming resolution.
        if executed_cmds and self.recovery_eng.get_status():
            for cmd in executed_cmds:
                for fixed_type in COMMAND_FIXES.get(cmd.command_type, []):
                    self.fault_engine.mitigate_by_type(fixed_type)

        # ── 9. Recovery check ─────────────────────────────────────────────────
        if self._command_executed_at is not None:
            elapsed_since = self.elapsed_sim_s - self._command_executed_at
            recovered = self.recovery_eng.tick(anomalies, self.state, elapsed_since)
            for fault_type in recovered:
                await self._log_event("recovery", "nominal",
                                      f"Recovery confirmed for {fault_type} — all telemetry nominal",
                                      "Recovery Engine")
                # Clear corresponding fault and update incident
                for fault in self.fault_engine.active_faults.values():
                    if fault.fault_type == fault_type and getattr(fault, 'incident_id', None):
                        self.incident_engine.complete_recovery(fault.incident_id, success=True, sim_time_s=self.elapsed_sim_s)
                        self._sync_incident_to_db(fault.incident_id)
                        if self.broadcast_callback:
                            incident = self.incident_engine.get_incident(fault.incident_id)
                            asyncio.create_task(self.broadcast_callback([{"type": "INCIDENT_UPDATE", "payload": incident}]))

                self.fault_engine.mitigate_by_type(fault_type)
                self._sync_faults_to_db()
                self.state.safe_mode = False

        # ── 10. Objective & Risk & RUL progress ──────────────────────────────
        self._update_objective()
        self._update_lifecycle_phase()

        # Persist RUL to the mission row periodically (every ~60s sim time)
        if tick_count % 600 == 0:
            try:
                db = SessionLocal()
                m = db.query(Mission).filter(Mission.id == self.mission_id).first()
                if m:
                    rul_now = self.rul_engine.estimate_rul(
                        self.state, self.fault_engine.active_faults,
                        env.__dict__, self.mission_day)
                    m.rul_days = float(rul_now.get("rul_days", 0.0))
                    db.commit()
                db.close()
            except Exception as e:
                logger.warning("RUL persist failed: %s", e)
        
        # Calculate Risk and RUL every 10 ticks to save CPU
        if tick_count % 10 == 0:
            rul_data = self.rul_engine.estimate_rul(self.state, self.fault_engine.active_faults, env.__dict__, self.mission_day)
            risk_data = self.risk_engine.calculate_risk(self.state, env.__dict__, self.fault_engine.active_faults, [], self.mission_day, rul_data["rul_days"], bool(self.config.get("crew_json")))
            
            # Accumulate for daily summary
            orbit_pt = {"lat": self.state.orbit.latitude_deg, "lng": self.state.orbit.longitude_deg, "alt": self.state.orbit.altitude_km}
            self.daily_summary_engine.accumulate_tick(self.mission_day, self.state.__dict__, env.__dict__, self.crew_health_engine.crew_state, risk_data, self.fault_engine.active_faults, orbit_pt)

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

        # Risk + crew health snapshots on their own timer (decoupled from the
        # telemetry-write phase, which can alias with tick-count gates)
        if self.elapsed_sim_s - getattr(self, "_last_riskcrew_s", 0.0) >= 5.0:
            self._last_riskcrew_s = self.elapsed_sim_s
            db = SessionLocal()
            try:
                # Save Risk
                risk_data = self.risk_engine.calculate_risk(self.state, env.__dict__, self.fault_engine.active_faults, [], self.mission_day, 365.0, False)
                db_risk = MissionRiskHistory(mission_id=self.mission_id, mission_day=self.mission_day, timestamp=int(time.time() * 1000), risk_score=risk_data["risk_score"], risk_category=risk_data["risk_category"], contributing_factors=risk_data["contributing_factors"], trend=risk_data["trend"])
                db.add(db_risk)

                # Save Crew Health
                if self.crew_health_engine.crew_state:
                    for crew_rec in self.crew_health_engine.to_snapshot_list():
                        # Map engine keys -> model columns; crew_id is the
                        # non-identifying role label (never a name)
                        mapped = {k: v for k, v in crew_rec.items() if hasattr(CrewHealthRecord, k)}
                        remap = {"fatigue": "fatigue_index", "stress": "stress_index",
                                 "hydration": "hydration_percent", "workload": "workload_index",
                                 "respiratory_rate_bpm": "respiratory_rate"}
                        for src, dst in remap.items():
                            if src in crew_rec:
                                mapped[dst] = crew_rec[src]
                        mapped.pop("name", None)
                        mapped.pop("is_eva", None)
                        mapped["crew_id"] = crew_rec.get("role") or crew_rec.get("crew_id") or "Crew"
                        crew_db = CrewHealthRecord(mission_id=self.mission_id, mission_day=self.mission_day, timestamp=int(time.time()*1000), **mapped)
                        db.add(crew_db)
                db.commit()
            except Exception as e:
                logger.warning("Crew/risk DB write failed: %s", e)
            finally:
                db.close()

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
                        "missionPhase": self.mission_phase
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

    def _update_lifecycle_phase(self):
        """Advance the mission lifecycle phase from configured/derived milestones.

        Phases: pre-launch → launch → LEOP → commissioning → primary-mission →
        extended-mission → end-of-life. Boundaries are derived from the
        mission's planned end day / estimated lifetime when available, so the
        lifecycle reflects the defined mission rather than a hardcoded number.
        Every transition is appended to phase_transitions_json and the Black Box.
        """
        if self.status in ("completed", "failed"):
            return

        # Derive lifetime anchors once per sim (cached)
        if not hasattr(self, "_lifecycle_anchors"):
            planned_end = None
            lifetime = None
            db: Session = SessionLocal()
            try:
                m = db.query(Mission).filter(Mission.id == self.mission_id).first()
                if m:
                    planned_end = getattr(m, "planned_end_day", None)
                    lifetime = getattr(m, "estimated_lifetime_days", None)
            except Exception:
                pass
            finally:
                db.close()
            if not lifetime:
                # Destination-based nominal lifetimes (data-driven fallback)
                dest = str(self.config.get("destination", "earth-orbit"))
                lifetime = {
                    "leo": 5.0, "earth-orbit": 5.0, "lunar-orbit": 3.0,
                    "lunar-surface": 2.0, "mars-orbit": 4.0, "mars-surface": 2.0,
                    "deep-space": 12.0, "lagrange-l1": 10.0,
                }.get(dest, 5.0) * 365.0
            if not planned_end:
                planned_end = float(lifetime)
            self._lifecycle_anchors = {
                "launch_end_day": 0.02,
                "leop_end_day": 0.25,
                "commissioning_end_day": 1.0,
                "primary_end_day": min(planned_end, planned_end * 0.8),
                "extended_end_day": planned_end,
            }

        a = self._lifecycle_anchors
        day = self.mission_day
        if day <= 0.0:
            new_phase = "pre-launch"
        elif day < a["launch_end_day"]:
            new_phase = "launch"
        elif day < a["leop_end_day"]:
            new_phase = "leop"
        elif day < a["commissioning_end_day"]:
            new_phase = "commissioning"
        elif day < a["primary_end_day"]:
            new_phase = "primary-mission"
        elif day < a["extended_end_day"]:
            new_phase = "extended-mission"
        else:
            new_phase = "end-of-life"

        if new_phase != self.mission_phase:
            prev = self.mission_phase
            self.mission_phase = new_phase
            transition = {
                "from": prev,
                "to": new_phase,
                "mission_day": round(day, 4),
                "timestamp": int(time.time() * 1000),
                "anchors": {k: round(v, 2) for k, v in a.items()},
            }
            db: Session = SessionLocal()
            try:
                m = db.query(Mission).filter(Mission.id == self.mission_id).first()
                if m:
                    transitions = m.phase_transitions_json or []
                    transitions.append(transition)
                    m.phase_transitions_json = transitions
                    m.mission_phase = new_phase
                    db.commit()
            except Exception as e:
                logger.warning("Phase transition persist failed: %s", e)
            finally:
                db.close()

    def _update_objective(self):
        """Update objective progress.

        Primary model: weighted completion of genuine mission objectives stored
        in the mission_objectives table. Fallback (no objectives defined):
        day/health-based estimate, preserved for backward compatibility.
        """
        if self.status == "completed":
            return

        # Refresh the objective list from the DB at most every 10s sim time
        if self.elapsed_sim_s - getattr(self, "_last_obj_refresh_s", -1e9) >= 10.0:
            self._last_obj_refresh_s = self.elapsed_sim_s
            db: Session = SessionLocal()
            try:
                rows = db.query(MissionObjectiveModel).filter(
                    MissionObjectiveModel.mission_id == self.mission_id
                ).all()
                self._objectives_cache = [
                    {"weight": o.weight or 0.0, "status": o.status} for o in rows
                ]
            except Exception as e:
                logger.warning("Objective refresh failed: %s", e)
            finally:
                db.close()

        cached = getattr(self, "_objectives_cache", None)
        if cached:
            total_weight = sum(o["weight"] for o in cached) or 1.0
            done_weight = sum(o["weight"] for o in cached if o["status"] == "completed")
            self.objective_progress = round(done_weight / total_weight * 100.0, 2)
            if self.objective_progress >= 99.9 and self.status == "active":
                self.objective_progress = 100.0
                self.status = "completed"
                self._log_event_sync("objective", "nominal",
                                     "All mission objectives completed — mission complete",
                                     "Objective Engine")
            return

        # Legacy fallback: progress driven by mission day and subsystem health
        health_factor = self.state.overall_health / 100.0
        day_progress = min(98.0, self.mission_day * 5.0)  # 5% per day, capped at 98
        self.objective_progress = round(day_progress * health_factor, 2)
        if day_progress >= 98.0 and self.status == "active":
            self.objective_progress = 100.0
            self.status = "completed"

    def _log_event_sync(self, event_type: str, severity: str, description: str, source: str):
        """Fire-and-forget black box event from synchronous context."""
        try:
            asyncio.get_running_loop()
            asyncio.ensure_future(self._log_event(event_type, severity, description, source))
        except RuntimeError:
            pass

    def _sync_faults_to_db(self):
        """Mirror active/mitigated fault flags into the active_faults table."""
        db: Session = SessionLocal()
        try:
            for fault in self.fault_engine.active_faults.values():
                row = db.query(FaultRecord).filter(FaultRecord.id == fault.id).first()
                if row and not fault.active:
                    row.active = False
                    row.mitigated_at = int(fault.mitigated_at * 1000) if fault.mitigated_at else int(time.time() * 1000)
            db.commit()
        except Exception as e:
            logger.warning("Fault DB sync failed: %s", e)
        finally:
            db.close()

    def _sync_incident_to_db(self, incident_id: str):
        """Persist incident lifecycle timestamps from the authoritative engine
        state to the incidents table (append-only field updates on the live row)."""
        inc = self.incident_engine.get_incident(incident_id)
        if not inc:
            return
        db: Session = SessionLocal()
        try:
            row = db.query(IncidentRecord).filter(IncidentRecord.id == incident_id).first()
            if not row:
                return  # Incident rows are created at injection time by the API
            row.diagnosis_time_ms = inc.get("diagnosis_time_ms", row.diagnosis_time_ms)
            row.decision_time_ms = inc.get("decision_time_ms", row.decision_time_ms)
            row.recovery_start_time_ms = inc.get("recovery_start_time_ms", row.recovery_start_time_ms)
            row.recovery_end_time_ms = inc.get("recovery_end_time_ms", row.recovery_end_time_ms)
            row.total_resolution_ms = inc.get("total_resolution_ms", row.total_resolution_ms)
            for fld in ("detection_sim_s", "diagnosis_sim_s", "decision_sim_s",
                        "recovery_start_sim_s", "recovery_end_sim_s", "total_resolution_sim_s"):
                if inc.get(fld) is not None:
                    setattr(row, fld, inc[fld])
            if inc.get("recovery_mode"):
                row.recovery_mode = inc["recovery_mode"]
            if inc.get("ai_analysis"):
                row.ai_analysis_json = inc["ai_analysis"]
            status_map = {"detected": "open", "diagnosing": "diagnosing",
                          "recovering": "recovering"}
            new_status = status_map.get(inc.get("status"), inc.get("status"))
            if new_status:
                row.status = new_status
            db.commit()
        except Exception as e:
            logger.warning("Incident DB sync failed for %s: %s", incident_id, e)
        finally:
            db.close()

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
        # Persist to DB (hash-chained append-only)
        db: Session = SessionLocal()
        try:
            from core.blackbox import append_event
            db_event = append_event(
                db,
                id=ev_id,
                mission_id=self.mission_id,
                mission_day=self.mission_day,
                timestamp=event["timestamp"],
                event_type=event_type,
                severity=severity,
                description=description,
                source=source,
            )
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
