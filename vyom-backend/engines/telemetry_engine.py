"""
VYOM Backend — Physics-Based Telemetry Engine
Generates plausible spacecraft telemetry from physical state.
All outputs conform to the frontend Telemetry TypeScript interface.
"""
import math
import random
import time
from typing import Dict, Any
from engines.spacecraft_state import SpacecraftState
from engines.environment_engine import EnvironmentState


# ── Physical constants / spacecraft parameters ────────────────────────────────
SOLAR_PANEL_AREA_M2    = 12.0      # m² total solar panel area
SOLAR_CONSTANT_W_M2    = 1361.0    # W/m² at 1 AU
PANEL_EFFICIENCY       = 0.295     # 29.5% GaAs triple-junction
NOMINAL_CONSUMPTION_W  = 220.0     # nominal power draw
BATTERY_CAPACITY_WH    = 8000.0
MIN_VOLTAGE_V          = 22.0
MAX_CPU_TEMP_C         = 85.0
NOM_CPU_TEMP_C         = 42.0
THERMAL_DECAY          = 0.05      # thermal time constant


class TelemetryEngine:
    """Generates telemetry from spacecraft physical state."""

    def __init__(self):
        self._rolling_power_history: list = []
        self._tick = 0

    def tick(self, state: SpacecraftState, env: EnvironmentState, dt_s: float) -> SpacecraftState:
        """
        Update spacecraft state for one simulation tick.
        Modifies state in-place and returns it.
        """
        self._tick += 1
        self._update_power(state, env, dt_s)
        self._update_thermal(state, env, dt_s)
        self._update_attitude(state, env, dt_s)
        self._update_comm(state, env, dt_s)
        self._update_compute(state, env, dt_s)
        self._update_propulsion(state, dt_s)
        self._update_radiation(state, env, dt_s)
        self._update_subsystem_health(state)
        state.update_health()
        return state

    def _update_power(self, state: SpacecraftState, env: EnvironmentState, dt_s: float):
        """Update power subsystem with solar generation and battery model."""
        # Solar flux reduces in eclipse
        effective_flux = SOLAR_CONSTANT_W_M2 * (1 - env.eclipse_fraction)
        # Panel degradation from radiation (0-1)
        panel_degradation = state.solar_panel_health
        # Solar generation
        solar_gen = effective_flux * SOLAR_PANEL_AREA_M2 * PANEL_EFFICIENCY * panel_degradation
        # Add noise
        solar_gen += random.gauss(0, solar_gen * 0.01)
        solar_gen = max(0.0, solar_gen)

        # Power consumption (nominal + fault-driven)
        faults = state.active_faults
        consumption = NOMINAL_CONSUMPTION_W
        if state.safe_mode:
            consumption *= 0.4   # safe mode: 40% nominal
        if "battery_failure" in faults:
            consumption *= (1 + faults["battery_failure"] * 0.1)
        consumption += random.gauss(0, 5)
        consumption = max(50, consumption)

        # Battery charging/discharging
        net_w = solar_gen - consumption
        delta_wh = net_w * (dt_s / 3600.0)
        state.battery_charge_wh = max(0.0, min(BATTERY_CAPACITY_WH, state.battery_charge_wh + delta_wh))
        state.battery_percent = round(state.battery_charge_wh / BATTERY_CAPACITY_WH * 100, 2)

        # Voltage model: 22V (depleted) to 29.2V (full)
        state.voltage_v = round(22.0 + (state.battery_percent / 100) * 7.2 + random.gauss(0, 0.05), 2)
        state.current_a = round(consumption / max(1, state.voltage_v) + random.gauss(0, 0.1), 2)
        state.solar_generation_w = round(solar_gen, 1)
        state.power_consumption_w = round(consumption, 1)
        state.in_eclipse = env.in_eclipse

        # Power subsystem health
        pw_sys = state.get_subsystem("Power")
        if pw_sys:
            if state.battery_percent < 15:
                pw_sys.health = max(0, pw_sys.health - 0.8 * dt_s / 60)
                pw_sys.status = "critical"
            elif state.battery_percent < 30:
                pw_sys.health = max(0, pw_sys.health - 0.2 * dt_s / 60)
                pw_sys.status = "warning"
            elif state.battery_percent > 50 and pw_sys.health < 100:
                pw_sys.health = min(100, pw_sys.health + 0.05 * dt_s / 60)
                pw_sys.status = "nominal"

    def _update_thermal(self, state: SpacecraftState, env: EnvironmentState, dt_s: float):
        """Update thermal state."""
        # CPU temp: function of CPU load + solar heating + eclipse cooling
        solar_heat = env.solar_activity_level * 2.5
        eclipse_cool = -15.0 * env.eclipse_fraction
        cpu_load_heat = (state.cpu_percent / 100.0) * 20.0
        target_cpu_temp = NOM_CPU_TEMP_C + solar_heat + eclipse_cool + cpu_load_heat

        # Fault-driven temperature spikes
        if "thermal_overheating" in state.active_faults:
            target_cpu_temp += state.active_faults["thermal_overheating"] * 8.0

        # First-order thermal model
        state.cpu_temp_c += (target_cpu_temp - state.cpu_temp_c) * THERMAL_DECAY * dt_s / 10
        state.cpu_temp_c += random.gauss(0, 0.2)
        state.cpu_temp_c = round(state.cpu_temp_c, 2)

        # Battery temperature (lagging)
        target_bat_temp = 18.0 + env.solar_activity_level * 1.5 + eclipse_cool * 0.5
        state.battery_temp_c += (target_bat_temp - state.battery_temp_c) * 0.02 * dt_s / 10
        state.battery_temp_c += random.gauss(0, 0.1)
        state.battery_temp_c = round(state.battery_temp_c, 2)

        # Payload temperature
        target_pay_temp = 32.0 + solar_heat * 0.8 + eclipse_cool * 0.3
        state.payload_temp_c += (target_pay_temp - state.payload_temp_c) * 0.03 * dt_s / 10
        state.payload_temp_c += random.gauss(0, 0.15)
        state.payload_temp_c = round(state.payload_temp_c, 2)

        # External temperature: extreme swings
        state.external_temp_c = round(env.temperature_range_c[1] if not env.in_eclipse else env.temperature_range_c[0], 1)

        # Thermal subsystem health
        th_sys = state.get_subsystem("Thermal")
        if th_sys:
            if state.cpu_temp_c > MAX_CPU_TEMP_C:
                th_sys.health = max(0, th_sys.health - 1.2 * dt_s / 60)
                th_sys.status = "critical"
            elif state.cpu_temp_c > 75:
                th_sys.health = max(0, th_sys.health - 0.4 * dt_s / 60)
                th_sys.status = "warning"
            elif state.cpu_temp_c < 65 and th_sys.health < 100:
                th_sys.health = min(100, th_sys.health + 0.08 * dt_s / 60)
                th_sys.status = "nominal"
            th_sys.temperature = state.cpu_temp_c

    def _update_attitude(self, state: SpacecraftState, env: EnvironmentState, dt_s: float):
        """Update attitude control."""
        if "attitude_control_failure" in state.active_faults:
            sev = state.active_faults["attitude_control_failure"]
            state.roll_deg += random.gauss(0, 0.3 * sev)
            state.pitch_deg += random.gauss(0, 0.25 * sev)
            state.yaw_deg += random.gauss(0, 0.28 * sev)
            state.angular_vel_degs = min(5.0, state.angular_vel_degs + sev * 0.02)
            state.reaction_wheel_rpm = min(6500, state.reaction_wheel_rpm + sev * 50)
        else:
            # Dampen back toward nominal
            state.roll_deg = round(state.roll_deg * 0.99 + random.gauss(0, 0.005), 3)
            state.pitch_deg = round(state.pitch_deg * 0.99 + random.gauss(0, 0.005), 3)
            state.yaw_deg = round(state.yaw_deg * 0.99 + random.gauss(0, 0.005), 3)
            state.angular_vel_degs = round(abs(state.angular_vel_degs) * 0.98 + abs(random.gauss(0, 0.002)), 4)
            state.reaction_wheel_rpm = round(state.reaction_wheel_rpm * 0.999 + random.gauss(0, 5) + 3240 * 0.001, 1)

        # ADCS health
        adcs = state.get_subsystem("Attitude")
        if adcs:
            rw_sat = state.reaction_wheel_rpm > 6000
            angular_excess = abs(state.roll_deg) > 2 or abs(state.pitch_deg) > 2
            if rw_sat or angular_excess:
                adcs.health = max(0, adcs.health - 0.6 * dt_s / 60)
                adcs.status = "critical" if rw_sat else "warning"
            elif adcs.health < 100:
                adcs.health = min(100, adcs.health + 0.05 * dt_s / 60)
                adcs.status = "nominal"

    def _update_comm(self, state: SpacecraftState, env: EnvironmentState, dt_s: float):
        """Update communications."""
        # Free-space path loss to nearest ground station (~35,000 km slant range for LEO)
        # Signal: -72 dBm nominal, degrades with solar activity
        base_signal = -72.0
        solar_loss = env.solar_activity_level * 2.5
        eclipse_boost = 1.5 if env.in_eclipse else 0  # less ionospheric scintillation

        if "comm_failure" in state.active_faults:
            sev = state.active_faults["comm_failure"]
            state.signal_dbm = max(-130, base_signal - sev * 7.0 - solar_loss + random.gauss(0, 2))
            state.packet_loss_pct = min(100, sev * 12.0)
            state.data_rate_mbps = max(0, 8.4 * (1 - sev * 0.12))
            state.comm_uptime = max(0, 100 - sev * 10)
        else:
            state.signal_dbm = round(base_signal - solar_loss + eclipse_boost + random.gauss(0, 1.5), 2)
            state.packet_loss_pct = max(0, env.solar_activity_level * 0.3 + random.random() * 0.5)
            state.data_rate_mbps = round(max(0.1, 8.4 - env.solar_activity_level * 0.2 + random.gauss(0, 0.1)), 2)
            state.comm_uptime = round(max(0, 100 - env.solar_activity_level * 0.8 - state.packet_loss_pct * 0.5 + random.gauss(0, 0.3)), 1)

        state.packets_per_sec = round(max(0, 240 * (1 - state.packet_loss_pct / 100) + random.gauss(0, 3)), 1)
        state.latency_ms = round(max(20, 340 + env.solar_activity_level * 15 + random.gauss(0, 10)), 1)
        state.comm_ok = state.signal_dbm > -110

        # Comms subsystem health
        comm_sys = state.get_subsystem("Communications")
        if comm_sys:
            if state.signal_dbm < -110:
                comm_sys.health = max(0, comm_sys.health - 0.8 * dt_s / 60)
                comm_sys.status = "critical"
            elif state.signal_dbm < -95:
                comm_sys.health = max(0, comm_sys.health - 0.2 * dt_s / 60)
                comm_sys.status = "warning"
            elif comm_sys.health < 100:
                comm_sys.health = min(100, comm_sys.health + 0.06 * dt_s / 60)
                comm_sys.status = "nominal"

    def _update_compute(self, state: SpacecraftState, env: EnvironmentState, dt_s: float):
        """Update onboard computer state."""
        # CPU load: baseline + fault detection overhead + radiation-induced slowdown
        baseline_cpu = 32.0
        anomaly_load = 15.0 if len(state.active_faults) > 0 else 0.0
        rad_slowdown = env.radiation_level_usv_h * 0.05
        target_cpu = min(99, baseline_cpu + anomaly_load + rad_slowdown)
        state.cpu_percent = round(target_cpu + random.gauss(0, 1.5), 1)
        state.memory_percent = round(48.0 + len(state.active_faults) * 3.0 + random.gauss(0, 0.5), 1)
        state.storage_percent = round(min(99, state.storage_percent + 0.0002 * dt_s), 2)

    def _update_propulsion(self, state: SpacecraftState, dt_s: float):
        """Update propulsion state."""
        if state.thrust_n > 0 and state.propulsion_ok:
            # Tsiolkovsky rocket equation for fuel consumption
            # dm = thrust * dt / (Isp * g0)
            g0 = 9.80665  # m/s²
            mass_flow = state.thrust_n / (state.isp_s * g0)  # kg/s
            state.fuel_kg = max(0, state.fuel_kg - mass_flow * dt_s)

        if "propulsion_anomaly" in state.active_faults:
            # Anomalous thrust: lose fuel faster
            sev = state.active_faults["propulsion_anomaly"]
            state.fuel_kg = max(0, state.fuel_kg - 0.001 * sev * dt_s)

        prop_sys = state.get_subsystem("Propulsion")
        if prop_sys:
            fuel_frac = state.fuel_kg / max(1, state.fuel_max_kg)
            if fuel_frac < 0.1:
                prop_sys.status = "critical"
            elif fuel_frac < 0.25:
                prop_sys.status = "warning"
            else:
                prop_sys.status = "nominal"
            prop_sys.health = max(0, fuel_frac * 100)

    def _update_radiation(self, state: SpacecraftState, env: EnvironmentState, dt_s: float):
        """Update radiation dose accumulation."""
        dose_rate = env.radiation_level_usv_h / 3600  # uSv/s
        dose_msv_increment = dose_rate * dt_s / 1000   # mSv increment
        state.total_dose_msv = round(state.total_dose_msv + dose_msv_increment, 5)
        state.radiation_level_usv_h = env.radiation_level_usv_h
        state.solar_activity_level = env.solar_activity_level

        # Radiation spike fault
        if "radiation_spike" in state.active_faults:
            sev = state.active_faults["radiation_spike"]
            state.radiation_level_usv_h *= (1 + sev * 0.8)
            # Solar panel degradation from radiation
            state.solar_panel_health = max(0.3, state.solar_panel_health - 0.0001 * sev * dt_s)

    def _update_subsystem_health(self, state: SpacecraftState):
        """Apply fault-driven health degradation to subsystems."""
        faults = state.active_faults

        mapping = {
            "solar_storm":          [("Power",  0.02), ("Communications", 0.04), ("Payload", 0.01)],
            "comm_failure":         [("Communications", 0.15)],
            "solar_panel_degradation": [("Power", 0.08)],
            "battery_failure":      [("Power", 0.12)],
            "thermal_overheating":  [("Thermal", 0.10), ("On-Board", 0.03)],
            "sensor_failure":       [("Payload", 0.10), ("On-Board", 0.05)],
            "propulsion_anomaly":   [("Propulsion", 0.12)],
            "attitude_control_failure": [("Attitude", 0.15)],
            "radiation_spike":      [("Payload", 0.08), ("On-Board", 0.06)],
            "telemetry_loss":       [("Communications", 0.20), ("On-Board", 0.05)],
        }

        for fault_type, sev in faults.items():
            targets = mapping.get(fault_type, [])
            for substr, rate in targets:
                sys = state.get_subsystem(substr)
                if sys:
                    sys.health = max(0, sys.health - rate * sev)
                    if sys.health < 20:
                        sys.status = "critical"
                    elif sys.health < 50:
                        sys.status = "warning"


def build_telemetry_dict(state: SpacecraftState, mission_day: float) -> Dict[str, Any]:
    """Build the full telemetry dict matching the frontend TypeScript Telemetry interface."""
    orbit = state.orbit
    return {
        "missionDay": round(mission_day, 6),
        "timestamp": int(time.time() * 1000),
        "power": {
            "batteryPercent": round(state.battery_percent, 2),
            "voltageV": state.voltage_v,
            "currentA": state.current_a,
            "solarGenerationW": state.solar_generation_w,
            "consumptionW": state.power_consumption_w,
        },
        "thermal": {
            "cpuTempC": state.cpu_temp_c,
            "batteryTempC": state.battery_temp_c,
            "payloadTempC": state.payload_temp_c,
            "externalTempC": state.external_temp_c,
        },
        "attitude": {
            "rollDeg": round(state.roll_deg, 3),
            "pitchDeg": round(state.pitch_deg, 3),
            "yawDeg": round(state.yaw_deg, 3),
            "angularVelDegS": round(state.angular_vel_degs, 4),
            "reactionWheelRpm": round(state.reaction_wheel_rpm, 1),
        },
        "comm": {
            "signalDbm": state.signal_dbm,
            "dataRateMbps": state.data_rate_mbps,
            "packetsPerSec": state.packets_per_sec,
            "latencyMs": state.latency_ms,
            "uptime": state.comm_uptime,
        },
        "compute": {
            "cpuPercent": state.cpu_percent,
            "memoryPercent": state.memory_percent,
            "storagePercent": state.storage_percent,
        },
        "orbit": {
            "altitudeKm": round(orbit.altitude_km, 2),
            "velocityKms": round(orbit.velocity_kms, 4),
            "accelerationMs2": round(orbit.acceleration_ms2, 4),
            "gForce": round(orbit.g_force, 4),
            "latitudeDeg": round(orbit.latitude_deg, 4),
            "longitudeDeg": round(orbit.longitude_deg, 4),
            "inclinationDeg": orbit.inclination_deg,
            "periodMin": round(orbit.period_min, 3),
            "apogeeKm": round(orbit.apogee_km, 1),
            "perigeeKm": round(orbit.perigee_km, 1),
            "semiMajorAxisKm": round(orbit.semi_major_axis_km, 1),
            "eccentricity": orbit.eccentricity,
            "trueAnomalyDeg": round(orbit.true_anomaly_deg, 2),
            "phaseDesc": "Nominal Orbital Operations",
            "distanceFromEarthKm": round(orbit.altitude_km, 2),
            "atmosphericLayer": orbit.atmospheric_layer,
            "atmosphericDensityKgM3": orbit.atmospheric_density_kg_m3,
            "atmosphericDragN": orbit.atmospheric_drag_n,
        },
        "overallHealth": state.overall_health,
        "healthStatus": state.health_status,
        "dataSource": "backend",
    }
