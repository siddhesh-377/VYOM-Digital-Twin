"""
VYOM Backend — Spacecraft State
Single authoritative mutable state for one mission simulation.
"""
from __future__ import annotations
import math
import time
from dataclasses import dataclass, field
from typing import Dict, List, Optional
from engines.physics.orbital import OrbitalState, default_leo_state


@dataclass
class SubsystemHealth:
    name: str
    health: float = 100.0    # 0-100
    status: str = "nominal"  # nominal | warning | critical | failed
    temperature: float = 25.0


@dataclass
class SpacecraftState:
    """Complete mutable spacecraft state. Updated every simulation tick."""

    # ── Orbital mechanics ────────────────────────────────────────────────────
    orbit: OrbitalState = field(default_factory=lambda: default_leo_state())
    elapsed_sim_s: float = 0.0    # total simulation seconds elapsed
    mission_day: float = 0.0

    # ── Power ────────────────────────────────────────────────────────────────
    battery_percent: float = 96.4
    battery_capacity_wh: float = 8000.0
    battery_charge_wh: float = 7712.0
    voltage_v: float = 28.6
    current_a: float = 4.2
    solar_generation_w: float = 260.0
    power_consumption_w: float = 120.0
    # solar panel health 0-1 (degraded by radiation, debris)
    solar_panel_health: float = 1.0
    in_eclipse: bool = False

    # ── Thermal ──────────────────────────────────────────────────────────────
    cpu_temp_c: float = 41.8
    battery_temp_c: float = 18.2
    payload_temp_c: float = 32.5
    external_temp_c: float = -15.0
    radiator_health: float = 1.0

    # ── Attitude ─────────────────────────────────────────────────────────────
    roll_deg: float = 0.12
    pitch_deg: float = -0.08
    yaw_deg: float = 0.04
    angular_vel_degs: float = 0.01
    reaction_wheel_rpm: float = 3240.0
    attitude_control_ok: bool = True

    # ── Communications ───────────────────────────────────────────────────────
    signal_dbm: float = -72.0
    data_rate_mbps: float = 8.4
    packets_per_sec: float = 240.0
    latency_ms: float = 340.0
    comm_uptime: float = 100.0
    comm_ok: bool = True
    packet_loss_pct: float = 0.0

    # ── Compute ──────────────────────────────────────────────────────────────
    cpu_percent: float = 32.0
    memory_percent: float = 48.0
    storage_percent: float = 12.5

    # ── Propulsion ───────────────────────────────────────────────────────────
    fuel_kg: float = 120.0
    fuel_max_kg: float = 120.0
    thrust_n: float = 0.0
    isp_s: float = 300.0
    propulsion_ok: bool = True

    # ── Radiation ────────────────────────────────────────────────────────────
    radiation_level_usv_h: float = 14.0
    total_dose_msv: float = 0.12
    solar_activity_level: float = 2.4

    # ── Health ───────────────────────────────────────────────────────────────
    overall_health: float = 98.5
    health_status: str = "nominal"   # nominal | warning | critical | failed
    safe_mode: bool = False

    # ── Subsystems ───────────────────────────────────────────────────────────
    subsystems: List[SubsystemHealth] = field(default_factory=lambda: [
        SubsystemHealth("Power & Solar Arrays",  100, "nominal", 18.2),
        SubsystemHealth("Thermal Control",       100, "nominal", 32.5),
        SubsystemHealth("Attitude Control (ADCS)", 100, "nominal", 34.8),
        SubsystemHealth("Communications",        100, "nominal", 28.0),
        SubsystemHealth("On-Board Computer",     100, "nominal", 39.8),
        SubsystemHealth("Propulsion",            100, "nominal", 24.5),
        SubsystemHealth("Payload / Instruments", 100, "nominal", 22.5),
        SubsystemHealth("Life Support (ECLSS)",  100, "nominal", 21.0),
    ])

    # ── Active faults (type -> severity 0-10) ────────────────────────────────
    active_faults: Dict[str, float] = field(default_factory=dict)

    # ── Noise seeds (for reproducibility) ───────────────────────────────────
    _rng_state: float = 0.0

    def noise(self, amplitude: float) -> float:
        """Deterministic-ish noise using time-based seed."""
        import random
        return (random.random() - 0.5) * 2 * amplitude

    def get_subsystem(self, name_substr: str) -> Optional[SubsystemHealth]:
        for s in self.subsystems:
            if name_substr.lower() in s.name.lower():
                return s
        return None

    def update_health(self) -> None:
        """Recompute overall health from subsystem health scores."""
        if not self.subsystems:
            return
        avg = sum(s.health for s in self.subsystems) / len(self.subsystems)
        self.overall_health = round(max(0.0, min(100.0, avg)), 2)
        if self.overall_health > 80:
            self.health_status = "nominal"
        elif self.overall_health > 50:
            self.health_status = "warning"
        elif self.overall_health > 20:
            self.health_status = "critical"
        else:
            self.health_status = "failed"
