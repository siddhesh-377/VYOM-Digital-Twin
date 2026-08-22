"""
VYOM Backend — Spacecraft Architecture Seed Data
Populates the data-driven spacecraft_architectures table on startup.
Idempotent: only inserts architectures that are missing.
"""
import logging
from sqlalchemy.orm import Session

from core.database import SpacecraftArchitecture

logger = logging.getLogger("vyom")

ARCHITECTURES = [
    {
        "id": "arch-earth-obs",
        "name": "Earth Observation Satellite",
        "category": "Earth Observation",
        "description": "LEO remote-sensing platform for imaging, mapping and climate monitoring. High payload duty cycle, frequent revisit, limited propellant for station-keeping.",
        "subsystems_json": ["Power", "Propulsion", "GNC", "Communications", "Thermal", "Payload (Imaging)", "Computing"],
        "power_config": {"solar_arrays_w": 900, "battery_wh": 12000, "eclipse_fraction": 0.36},
        "propulsion_config": {"type": "hydrazine-thrusters", "fuel_kg": 60, "isp_s": 220, "delta_v_ms": 180},
        "comms_config": {"bands": ["X", "S"], "downlink_mbps": 320, "ground_stations": 4},
        "thermal_config": {"radiators": 2, "heaters_w": 120},
        "mission_constraints": {"orbit_alt_km": [500, 800], "sun_synchronous": True, "design_life_years": 5, "payload_duty_cycle_pct": 25},
        "failure_modes": ["solar_panel_degradation", "sensor_failure", "telemetry_loss", "thermal_overheating"],
        "disposal_options": ["controlled-deorbit", "passive-decay"],
        "is_human_rated": False,
    },
    {
        "id": "arch-communications",
        "name": "Communications Satellite",
        "category": "Communications",
        "description": "GEO relay platform with high-power transponders. Long design life, station-keeping propellant dominated, eclipse seasons drive power/thermal design.",
        "subsystems_json": ["Power", "Propulsion", "GNC", "Communications", "Thermal", "Payload (Transponders)", "Computing"],
        "power_config": {"solar_arrays_w": 10000, "battery_wh": 24000, "eclipse_fraction": 0.04},
        "propulsion_config": {"type": "bi-propellant + electric", "fuel_kg": 600, "isp_s": 1500, "delta_v_ms": 1500},
        "comms_config": {"bands": ["Ku", "Ka", "C"], "downlink_gbps": 40, "ground_stations": 2},
        "thermal_config": {"radiators": 4, "heaters_w": 400},
        "mission_constraints": {"orbit_alt_km": [35786], "geostationary": True, "design_life_years": 15, "payload_duty_cycle_pct": 100},
        "failure_modes": ["comm_failure", "solar_panel_degradation", "battery_failure", "attitude_control_failure"],
        "disposal_options": ["graveyard-orbit"],
        "is_human_rated": False,
    },
    {
        "id": "arch-astro-observatory",
        "name": "Astrophysics Observatory",
        "category": "Science",
        "description": "Precision pointing space telescope. Extremely stable GNC requirements, cryogenic/thermal sensitivity, minimal propulsion, deep-space comm rates.",
        "subsystems_json": ["Power", "GNC (Fine Pointing)", "Communications", "Thermal (Cryogenic)", "Payload (Telescope)", "Computing"],
        "power_config": {"solar_arrays_w": 2000, "battery_wh": 18000, "eclipse_fraction": 0.4},
        "propulsion_config": {"type": "cold-gas", "fuel_kg": 20, "isp_s": 70, "delta_v_ms": 30},
        "comms_config": {"bands": ["Ka"], "downlink_mbps": 150, "ground_stations": 3},
        "thermal_config": {"radiators": 3, "cryocoolers": 1, "heaters_w": 200},
        "mission_constraints": {"orbit_alt_km": [700, 1500], "pointing_accuracy_arcsec": 0.01, "design_life_years": 10, "payload_duty_cycle_pct": 35},
        "failure_modes": ["sensor_failure", "thermal_overheating", "attitude_control_failure", "radiation_spike"],
        "disposal_options": ["passive-decay", "graveyard-orbit"],
        "is_human_rated": False,
    },
    {
        "id": "arch-planetary-orbiter",
        "name": "Planetary Orbiter",
        "category": "Planetary Science",
        "description": "Orbiter for planetary science (e.g. Mars). Deep-space navigation, large delta-v budget for orbit insertion, autonomous fault management required due to light-delay.",
        "subsystems_json": ["Power", "Propulsion", "GNC (Deep-Space)", "Communications (DSN)", "Thermal", "Payload (Science Suite)", "Computing"],
        "power_config": {"solar_arrays_w": 1400, "battery_wh": 9000, "eclipse_fraction": 0.35},
        "propulsion_config": {"type": "bi-propellant", "fuel_kg": 850, "isp_s": 315, "delta_v_ms": 2600},
        "comms_config": {"bands": ["X", "Ka"], "downlink_kbps": 6000, "dsn_windows_per_day": 2},
        "thermal_config": {"radiators": 2, "louvers": 1, "heaters_w": 300},
        "mission_constraints": {"destinations": ["mars-orbit", "venus-orbit"], "design_life_years": 6, "autonomy_level": "high"},
        "failure_modes": ["propulsion_anomaly", "comm_failure", "sensor_failure", "thermal_overheating"],
        "disposal_options": ["planetary-disposal", "surface-retirement", "extended-mission"],
        "is_human_rated": False,
    },
    {
        "id": "arch-mars-orbiter",
        "name": "Mars Orbiter",
        "category": "Planetary Science",
        "description": "Mars-specific orbiter variant. Aerobraking-capable, Mars-relay payload, constrained by launch windows and Mars arrival delta-v.",
        "subsystems_json": ["Power", "Propulsion", "GNC (Deep-Space)", "Communications (DSN + Mars Relay)", "Thermal", "Payload (Mars Science)", "Computing"],
        "power_config": {"solar_arrays_w": 1100, "battery_wh": 8000, "eclipse_fraction": 0.4},
        "propulsion_config": {"type": "bi-propellant (MOI capable)", "fuel_kg": 900, "isp_s": 310, "delta_v_ms": 2400},
        "comms_config": {"bands": ["X", "Ka"], "downlink_kbps": 5000, "mars_relay": True},
        "thermal_config": {"radiators": 2, "heaters_w": 350},
        "mission_constraints": {"destination": "mars-orbit", "launch_window_days": 26, "design_life_years": 5, "aerobraking_capable": True},
        "failure_modes": ["propulsion_anomaly", "comm_failure", "sensor_failure", "thermal_overheating"],
        "disposal_options": ["planetary-disposal", "surface-retirement", "extended-mission"],
        "is_human_rated": False,
    },
    {
        "id": "arch-deep-space-probe",
        "name": "Deep-Space Probe",
        "category": "Deep Space",
        "description": "Interplanetary flyby/escape probe. RTG or large solar arrays, ultra-reliable computing, heliocentric disposal by design.",
        "subsystems_json": ["Power (RTG/Solar)", "Propulsion", "GNC (Autonomous)", "Communications (DSN)", "Thermal", "Payload (Science)", "Computing (Rad-Hard)"],
        "power_config": {"rtg_we": 600, "solar_arrays_w": 600, "battery_wh": 4000},
        "propulsion_config": {"type": "hydrazine + electric", "fuel_kg": 300, "isp_s": 1900, "delta_v_ms": 1200},
        "comms_config": {"bands": ["X", "Ka"], "downlink_kbps": 2000, "high_gain_antenna": True},
        "thermal_config": {"rtg_heating": True, "heaters_w": 150},
        "mission_constraints": {"destinations": ["deep-space", "lagrange-l1"], "design_life_years": 12, "autonomy_level": "maximum"},
        "failure_modes": ["comm_failure", "sensor_failure", "radiation_spike", "propulsion_anomaly"],
        "disposal_options": ["heliocentric-disposal"],
        "is_human_rated": False,
    },
    {
        "id": "arch-navigation",
        "name": "Navigation Satellite",
        "category": "Navigation",
        "description": "MEO precision-timing/navigation constellation member. Atomic-clock redundancy, radiation hardening, constellation-slot keeping.",
        "subsystems_json": ["Power", "Propulsion", "GNC", "Communications", "Thermal", "Payload (Atomic Clocks)", "Computing"],
        "power_config": {"solar_arrays_w": 2500, "battery_wh": 12000, "eclipse_fraction": 0.05},
        "propulsion_config": {"type": "electric (Hall)", "fuel_kg": 120, "isp_s": 1600, "delta_v_ms": 400},
        "comms_config": {"bands": ["L", "S", "C"], "downlink_mbps": 50, "crosslinks": True},
        "thermal_config": {"radiators": 2, "heaters_w": 180},
        "mission_constraints": {"orbit_alt_km": [20200], "clock_redundancy": 4, "design_life_years": 12, "slot_keeping": True},
        "failure_modes": ["radiation_spike", "sensor_failure", "attitude_control_failure", "battery_failure"],
        "disposal_options": ["graveyard-orbit"],
        "is_human_rated": False,
    },
    {
        "id": "arch-weather",
        "name": "Weather Satellite",
        "category": "Earth Observation",
        "description": "Geostationary or polar weather monitoring platform. Continuous full-disk imaging, high reliability, direct broadcast payload.",
        "subsystems_json": ["Power", "Propulsion", "GNC", "Communications", "Thermal", "Payload (Imager/Sounder)", "Computing"],
        "power_config": {"solar_arrays_w": 4500, "battery_wh": 20000, "eclipse_fraction": 0.04},
        "propulsion_config": {"type": "bi-propellant", "fuel_kg": 350, "isp_s": 290, "delta_v_ms": 900},
        "comms_config": {"bands": ["L", "UHF", "Ku"], "downlink_mbps": 120, "direct_broadcast": True},
        "thermal_config": {"radiators": 3, "cooler": 1, "heaters_w": 260},
        "mission_constraints": {"orbit_alt_km": [35786, 850], "design_life_years": 10, "continuous_imaging": True},
        "failure_modes": ["solar_panel_degradation", "sensor_failure", "comm_failure", "thermal_overheating"],
        "disposal_options": ["graveyard-orbit", "controlled-deorbit"],
        "is_human_rated": False,
    },
    {
        "id": "arch-human-rated",
        "name": "Human-Rated Spacecraft",
        "category": "Human Spaceflight",
        "description": "Crewed vehicle with life support (ECLSS), abort capability and full redundancy. Safe crew return is the primary end-of-mission consideration.",
        "subsystems_json": ["Power", "Propulsion", "GNC", "Communications", "Thermal", "Life Support (ECLSS)", "Crew Accommodations", "Computing (Triple Redundant)"],
        "power_config": {"solar_arrays_w": 3600, "battery_wh": 30000, "eclipse_fraction": 0.45},
        "propulsion_config": {"type": "bi-propellant (return burn capable)", "fuel_kg": 700, "isp_s": 315, "delta_v_ms": 1200},
        "comms_config": {"bands": ["S", "Ku", "UHF"], "downlink_mbps": 300, "voice_loop": True},
        "thermal_config": {"radiators": 4, "heat_shield": True, "heaters_w": 500},
        "mission_constraints": {"crew_capacity": 4, "abort_capability": True, "design_life_days": 210, "redundancy_level": "full"},
        "failure_modes": ["power-electrical failure", "comm_failure", "thermal_overheating", "propulsion_anomaly", "life_support_degradation"],
        "disposal_options": ["crew-safe-return", "spacecraft-recovery"],
        "is_human_rated": True,
    },
]


def _normalize_spec(spec: dict) -> dict:
    """Coerce legacy string-list fields into schema-compatible dict lists."""
    out = dict(spec)
    out["subsystems_json"] = [
        {"name": s} if isinstance(s, str) else s
        for s in (spec.get("subsystems_json") or [])
    ]
    out["failure_modes"] = [
        {"id": f} if isinstance(f, str) else f
        for f in (spec.get("failure_modes") or [])
    ]
    return out


def seed_architectures() -> int:
    """Insert any missing architecture definitions. Returns number inserted."""
    from core.database import SessionLocal
    db: Session = SessionLocal()
    inserted = 0
    try:
        existing = {row.id for row in db.query(SpacecraftArchitecture.id).all()}
        for raw_spec in ARCHITECTURES:
            spec = _normalize_spec(raw_spec)
            if spec["id"] in existing:
                continue
            db.add(SpacecraftArchitecture(**spec))
            inserted += 1
        if inserted:
            db.commit()
            logger.info("Seeded %d spacecraft architectures", inserted)
        return inserted
    except Exception as e:
        db.rollback()
        logger.warning("Architecture seeding failed: %s", e)
        return 0
    finally:
        db.close()
