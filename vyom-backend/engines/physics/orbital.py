"""
VYOM Backend — Keplerian Orbital Mechanics Propagator

Implements two-body gravitational physics for spacecraft trajectory propagation.
All units: km, km/s, seconds, degrees unless noted.
"""
import math
from dataclasses import dataclass
from typing import Tuple

# ── Physical Constants ────────────────────────────────────────────────────────
GM_EARTH   = 398600.4418   # km³/s²  (Standard gravitational parameter)
R_EARTH    = 6371.0        # km      (Mean Earth radius)
OMEGA_E    = 7.2921150e-5  # rad/s   (Earth rotation rate)
J2         = 1.08263e-3    # Earth oblateness coefficient


@dataclass
class OrbitalState:
    """Complete spacecraft orbital state."""
    # Keplerian elements
    semi_major_axis_km: float        # a
    eccentricity: float              # e
    inclination_deg: float           # i
    raan_deg: float                  # Ω  (right ascension of ascending node)
    arg_perigee_deg: float           # ω  (argument of perigee)
    true_anomaly_deg: float          # ν
    
    # Derived quantities (computed each tick)
    altitude_km: float = 650.0
    velocity_kms: float = 7.65
    period_min: float = 97.5
    apogee_km: float = 658.0
    perigee_km: float = 642.0
    acceleration_ms2: float = 8.8
    g_force: float = 0.9
    
    # Ground track
    latitude_deg: float = 0.0
    longitude_deg: float = 0.0
    
    # Atmospheric
    atmospheric_layer: str = "Exosphere"
    atmospheric_density_kg_m3: float = 1.4e-13
    atmospheric_drag_n: float = 0.0


def _true_to_eccentric(true_anom_rad: float, ecc: float) -> float:
    """Convert true anomaly to eccentric anomaly."""
    cos_nu = math.cos(true_anom_rad)
    E = math.acos((ecc + cos_nu) / (1 + ecc * cos_nu))
    if true_anom_rad > math.pi:
        E = 2 * math.pi - E
    return E


def _eccentric_to_mean(E_rad: float, ecc: float) -> float:
    """Convert eccentric anomaly to mean anomaly (Kepler's equation)."""
    return E_rad - ecc * math.sin(E_rad)


def _mean_to_eccentric(M_rad: float, ecc: float, tol: float = 1e-10) -> float:
    """Solve Kepler's equation: M = E - e*sin(E) via Newton-Raphson."""
    E = M_rad  # initial guess
    for _ in range(50):
        dE = (M_rad - (E - ecc * math.sin(E))) / (1 - ecc * math.cos(E))
        E += dE
        if abs(dE) < tol:
            break
    return E


def _eccentric_to_true(E_rad: float, ecc: float) -> float:
    """Convert eccentric anomaly to true anomaly."""
    cos_E = math.cos(E_rad)
    cos_nu = (cos_E - ecc) / (1 - ecc * cos_E)
    cos_nu = max(-1.0, min(1.0, cos_nu))
    nu = math.acos(cos_nu)
    if E_rad > math.pi:
        nu = 2 * math.pi - nu
    return nu


def propagate(state: OrbitalState, dt_s: float, elapsed_s: float) -> OrbitalState:
    """
    Propagate orbital state forward by dt_s seconds.
    Uses Keplerian two-body propagation with J2 nodal precession.

    Args:
        state: Current orbital state
        dt_s: Time step in seconds (simulation time)
        elapsed_s: Total elapsed simulation seconds (for ground track)

    Returns:
        Updated OrbitalState
    """
    a = state.semi_major_axis_km
    e = state.eccentricity
    i_rad = math.radians(state.inclination_deg)
    raan_rad = math.radians(state.raan_deg)
    om_rad = math.radians(state.arg_perigee_deg)
    nu_rad = math.radians(state.true_anomaly_deg)

    # ── Orbital period and mean motion ──────────────────────────────────────
    T_s = 2 * math.pi * math.sqrt(a**3 / GM_EARTH)  # seconds
    n   = 2 * math.pi / T_s                           # mean motion rad/s

    # ── Propagate mean anomaly ───────────────────────────────────────────────
    E0   = _true_to_eccentric(nu_rad, e)
    M0   = _eccentric_to_mean(E0, e)
    M1   = M0 + n * dt_s
    E1   = _mean_to_eccentric(M1, e)
    nu1  = _eccentric_to_true(E1, e)

    # ── J2 precession of RAAN ────────────────────────────────────────────────
    # dΩ/dt = -3/2 * n * J2 * (R_E/a)² * cos(i) / (1-e²)²
    j2_factor = -1.5 * n * J2 * (R_EARTH / a)**2 * math.cos(i_rad) / (1 - e**2)**2
    raan_rad += j2_factor * dt_s

    # ── Radius at new position ───────────────────────────────────────────────
    r_km = a * (1 - e * math.cos(E1))
    alt_km = r_km - R_EARTH

    # ── Orbital speed (vis-viva) ─────────────────────────────────────────────
    v_kms = math.sqrt(GM_EARTH * (2 / r_km - 1 / a))

    # ── Centripetal acceleration ─────────────────────────────────────────────
    acc_ms2 = (GM_EARTH / r_km**2) * 1000.0    # km→m

    # ── ECI position vector ──────────────────────────────────────────────────
    # r_ECI = R_z(-RAAN) * R_x(-i) * R_z(-ω) * r_perifocal
    cos_om = math.cos(om_rad)
    sin_om = math.sin(om_rad)
    cos_i  = math.cos(i_rad)
    sin_i  = math.sin(i_rad)
    cos_raan = math.cos(raan_rad)
    sin_raan = math.sin(raan_rad)
    cos_nu1  = math.cos(nu1)
    sin_nu1  = math.sin(nu1)

    # Perifocal coordinates
    x_pf = r_km * cos_nu1
    y_pf = r_km * sin_nu1

    # Rotate to ECI
    x_eci = (cos_raan * cos_om - sin_raan * sin_om * cos_i) * x_pf + \
            (-cos_raan * sin_om - sin_raan * cos_om * cos_i) * y_pf
    y_eci = (sin_raan * cos_om + cos_raan * sin_om * cos_i) * x_pf + \
            (-sin_raan * sin_om + cos_raan * cos_om * cos_i) * y_pf
    z_eci = (sin_om * sin_i) * x_pf + (cos_om * sin_i) * y_pf

    # ── ECI → ECEF (Earth rotation) ─────────────────────────────────────────
    theta_gst = OMEGA_E * elapsed_s  # Greenwich Sidereal Time approximation
    cos_gst = math.cos(theta_gst)
    sin_gst = math.sin(theta_gst)
    x_ecef = x_eci * cos_gst + y_eci * sin_gst
    y_ecef = -x_eci * sin_gst + y_eci * cos_gst
    z_ecef = z_eci

    # ── ECEF → Geodetic (lat/lon/alt) ───────────────────────────────────────
    lon_rad = math.atan2(y_ecef, x_ecef)
    lon_deg = math.degrees(lon_rad)

    p = math.sqrt(x_ecef**2 + y_ecef**2)
    lat_rad = math.atan2(z_ecef, p * (1 - 0.00669437999014))  # WGS84 approx
    lat_deg = math.degrees(lat_rad)
    lat_deg = max(-90.0, min(90.0, lat_deg))

    # ── Atmospheric layer ────────────────────────────────────────────────────
    layer, density, drag = _atmospheric_data(alt_km)

    # ── Apogee / Perigee ─────────────────────────────────────────────────────
    apo_km  = a * (1 + e) - R_EARTH
    peri_km = a * (1 - e) - R_EARTH

    return OrbitalState(
        semi_major_axis_km=a,
        eccentricity=e,
        inclination_deg=state.inclination_deg,
        raan_deg=math.degrees(raan_rad) % 360,
        arg_perigee_deg=math.degrees(om_rad) % 360,
        true_anomaly_deg=math.degrees(nu1) % 360,
        altitude_km=max(0, alt_km),
        velocity_kms=v_kms,
        period_min=T_s / 60.0,
        apogee_km=apo_km,
        perigee_km=peri_km,
        acceleration_ms2=acc_ms2,
        g_force=acc_ms2 / 9.80665,
        latitude_deg=lat_deg,
        longitude_deg=lon_deg,
        atmospheric_layer=layer,
        atmospheric_density_kg_m3=density,
        atmospheric_drag_n=drag,
    )


def _atmospheric_data(alt_km: float) -> Tuple[str, float, float]:
    """Return (layer_name, density_kg_m3, drag_force_N) for given altitude."""
    if alt_km < 12:
        rho = 1.225 * math.exp(-alt_km / 8.5)
        return "Troposphere",   rho,          rho * 2.2
    elif alt_km < 50:
        rho = 0.312 * math.exp(-(alt_km - 12) / 7.2)
        return "Stratosphere",  rho,          rho * 1.8
    elif alt_km < 85:
        rho = 0.0014 * math.exp(-(alt_km - 50) / 6.0)
        return "Mesosphere",    rho,          rho * 0.9
    elif alt_km < 600:
        rho = 1.8e-6 * math.exp(-(alt_km - 85) / 45.0)
        return "Thermosphere",  max(rho, 1e-14), rho * 0.05
    else:
        rho = 1.4e-13 * math.exp(-(alt_km - 600) / 200.0)
        return "Exosphere",     max(rho, 1e-16), max(rho * 0.001, 1e-10)


def default_leo_state(
    alt_km: float = 650.0,
    inclination_deg: float = 51.6,
    eccentricity: float = 0.0012,
) -> OrbitalState:
    """Create a default Low Earth Orbit state."""
    a = R_EARTH + alt_km
    T_s = 2 * math.pi * math.sqrt(a**3 / GM_EARTH)
    v = math.sqrt(GM_EARTH / a)
    return OrbitalState(
        semi_major_axis_km=a,
        eccentricity=eccentricity,
        inclination_deg=inclination_deg,
        raan_deg=45.0,
        arg_perigee_deg=0.0,
        true_anomaly_deg=0.0,
        altitude_km=alt_km,
        velocity_kms=v,
        period_min=T_s / 60.0,
        apogee_km=alt_km + eccentricity * a,
        perigee_km=alt_km - eccentricity * a,
    )
