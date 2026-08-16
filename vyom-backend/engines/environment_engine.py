"""
VYOM Backend — Space Environment Engine
Simulates solar activity, eclipse, radiation, and debris.
"""
import math
import random
from dataclasses import dataclass, field
from typing import List


@dataclass
class EnvironmentState:
    solar_activity_level: float = 2.4    # 0-10 scale
    solar_flux_sfu: float = 150.0         # Solar Flux Units
    radiation_level_usv_h: float = 14.0
    magnetic_field_nt: float = 31200.0
    debris_density: float = 1.2           # 0-10 scale
    in_eclipse: bool = False
    eclipse_fraction: float = 0.0         # 0=full sun, 1=full eclipse
    temperature_range_c: List[float] = field(default_factory=lambda: [-90.0, 120.0])
    classification: str = "normal"        # low|normal|warning|critical
    # Active space weather events
    active_cme: bool = False              # Coronal Mass Ejection
    x_class_flare: bool = False


class EnvironmentEngine:
    """Updates environment state each simulation tick."""

    SOLAR_CYCLE_PERIOD_DAYS = 4015.0      # ~11 years

    def __init__(self):
        self.state = EnvironmentState()
        self._phase_offset = 0.0          # random phase in solar cycle

    def tick(self, mission_day: float, dt_s: float, spacecraft_alt_km: float,
             spacecraft_lat_deg: float) -> EnvironmentState:
        """
        Update environment for current mission day.
        Args:
            mission_day: Current mission elapsed days
            dt_s: Simulation time step in seconds
            spacecraft_alt_km: Current spacecraft altitude
            spacecraft_lat_deg: Current geodetic latitude
        """
        # ── Solar activity cycle ─────────────────────────────────────────────
        phase = (mission_day / self.SOLAR_CYCLE_PERIOD_DAYS) * 2 * math.pi + self._phase_offset
        base_solar = 2.5 + 3.5 * (0.5 + 0.5 * math.sin(phase))  # 2.5-6.0 baseline
        jitter = (random.random() - 0.5) * 0.15
        solar = max(0.0, min(10.0, base_solar + jitter))

        # ── Occasional M/X-class flares (random events) ───────────────────────
        self.state.x_class_flare = False
        flare_intensity = 0.0
        if random.random() < 0.0002 * (solar / 5.0):   # rare random flare
            self.state.x_class_flare = True
            flare_intensity = random.uniform(3.0, 6.0)
            solar = min(10.0, solar + flare_intensity)

        # ── CME active if solar > 8.5 ─────────────────────────────────────────
        self.state.active_cme = solar > 8.5

        # ── Radiation model ───────────────────────────────────────────────────
        # Base: ~10 uSv/h in LEO, scales with solar activity and altitude
        alt_factor = 1.0 + max(0.0, (spacecraft_alt_km - 400) / 1000.0) * 2.0
        radiation = (8.0 + solar * 4.0 + (random.random() - 0.5) * 2.0) * alt_factor
        # Van Allen belt enhancement (400-800 km, especially at mid-latitudes)
        if 400 < spacecraft_alt_km < 800 and abs(spacecraft_lat_deg) < 50:
            radiation *= 1.3
        if self.state.x_class_flare:
            radiation *= (2.0 + flare_intensity * 0.5)

        # ── Eclipse detection ─────────────────────────────────────────────────
        # Simple geometric model: assume ~35% of LEO orbit in eclipse
        # Use mission day + inclination to compute rough eclipse fraction
        orbit_phase = (mission_day * 24 * 60 / 97.5) % 1.0   # fraction through orbit (97.5 min period)
        in_eclipse = orbit_phase > 0.62   # ~38% eclipse fraction for LEO
        eclipse_frac = 1.0 if in_eclipse else 0.0

        # ── Debris density ────────────────────────────────────────────────────
        debris = max(0.1, min(10.0, 1.2 + (random.random() - 0.5) * 0.3))
        if 500 < spacecraft_alt_km < 700:  # dense debris shell
            debris += 0.3

        # ── Classification ────────────────────────────────────────────────────
        if solar > 7.5 or radiation > 80:
            classification = "critical"
        elif solar > 4.5 or radiation > 40:
            classification = "warning"
        elif solar < 1.5:
            classification = "low"
        else:
            classification = "normal"

        # ── External temperature range ────────────────────────────────────────
        t_max = 120 + solar * 8
        t_min = -90 - (eclipse_frac * 30)

        self.state = EnvironmentState(
            solar_activity_level=round(solar, 2),
            solar_flux_sfu=round(100 + solar * 30 + random.gauss(0, 5), 1),
            radiation_level_usv_h=round(max(1.0, radiation), 2),
            magnetic_field_nt=round(30000 + random.gauss(0, 500), 0),
            debris_density=round(debris, 2),
            in_eclipse=in_eclipse,
            eclipse_fraction=eclipse_frac,
            temperature_range_c=[round(t_min, 1), round(t_max, 1)],
            classification=classification,
            active_cme=self.state.active_cme,
            x_class_flare=self.state.x_class_flare,
        )
        return self.state

    def force_solar_storm(self, severity: float = 8.5) -> None:
        """Force a solar storm for fault injection / demo scenarios."""
        self.state.solar_activity_level = min(10.0, severity)
        self.state.active_cme = True
        self.state.x_class_flare = severity >= 9.0
        self.state.radiation_level_usv_h = min(500.0, severity * 50)
        self.state.classification = "critical"
