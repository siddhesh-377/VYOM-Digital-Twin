"""
VYOM Backend — Orbital Data API
Integrates real/near-real-time public orbital data (CelesTrak TLE + SGP4-style
analytical propagation) with the mission Digital Twin.

Data provenance is explicit on every response:
  - "tle-propagated"  : derived from a real CelesTrak TLE (near-real-time, NOT
                        actual spacecraft telemetry — TLEs are mean elements)
  - "simulated"       : generated from the mission's own simulated orbit when
                        no external data is available (e.g., offline)
High-frequency raw telemetry remains in the telemetry archive; this API serves
current state and daily orbital history for replay.
"""
import math
import time
from typing import Optional, Dict, Any, List

from fastapi import APIRouter, Depends, HTTPException, Query
from sqlalchemy.orm import Session

from core.database import get_db, Mission, DailySummary
from engines.tle_engine import TLEEngine, R_EARTH_KM, MU_EARTH

router = APIRouter(prefix="/api/orbital", tags=["orbital"])

_tle_engine = TLEEngine()


@router.get("/satellites")
def list_known_satellites():
    """Public satellites with available TLE data for tracking."""
    sats = _tle_engine.get_known_satellites()
    return {
        "data_source": "celestrak.org TLE catalogue",
        "provenance": "tle-propagated (near-real-time) — not spacecraft telemetry",
        "satellites": sats,
    }


def _simulated_state_from_mission(mission: Mission) -> Dict[str, Any]:
    """Fallback: derive an orbital state from the mission's own simulation config.

    Clearly labeled 'simulated' — used only when live TLE fetch is unavailable
    or the mission target is beyond Earth-orbit TLE coverage.
    """
    cfg = mission.config_json if isinstance(mission.config_json, dict) else {}
    inner = cfg.get("config") if isinstance(cfg.get("config"), dict) else {}
    alt_km = float(inner.get("initial_alt_km", cfg.get("initial_alt_km", 650.0)))
    inc_deg = float(inner.get("inclination_deg", cfg.get("inclination_deg", 51.6)))
    now_s = time.time()
    period_s = 2 * math.pi * math.sqrt(((R_EARTH_KM + alt_km) ** 3) / MU_EARTH)
    # Position along the orbit at current time (phase from time-of-day)
    nu = ((now_s % period_s) / period_s) * 360.0
    r = R_EARTH_KM + alt_km
    x = r * math.cos(math.radians(nu))
    y = r * math.sin(math.radians(nu))
    v = math.sqrt(MU_EARTH / r)
    gmst = (now_s / 86400.0 * 360.0 * 1.00273790935) % 360.0
    lon = (nu - gmst) % 360.0
    if lon > 180:
        lon -= 360
    return {
        "latitude_deg": round(inc_deg * math.sin(math.radians(nu)), 4),
        "longitude_deg": round(lon, 4),
        "altitude_km": round(alt_km, 2),
        "velocity_kms": round(v, 4),
        "position_eci_km": [round(x, 1), round(y, 1), 0.0],
        "velocity_eci_kms": [round(-v * math.sin(math.radians(nu)), 4),
                              round(v * math.cos(math.radians(nu)), 4), 0.0],
        "timestamp": int(now_s * 1000),
        "orbital_elements": {
            "inclination_deg": inc_deg,
            "eccentricity": 0.0,
            "period_min": round(period_s / 60.0, 2),
            "mean_motion_rev_day": round(86400.0 / period_s, 4),
        },
        "data_source": "mission-simulation",
        "data_quality": "simulated",
        "reference_frame": "J2000 ECI (approximate)",
        "time_standard": "UTC (Unix epoch ms)",
        "provenance_note": (
            "SIMULATED orbital state derived from the mission's own Digital Twin "
            "configuration. This is NOT real telemetry and NOT a real TLE."
        ),
    }


@router.get("/state/{mission_id}")
async def get_orbital_state(
    mission_id: str,
    norad_id: Optional[str] = Query(None, description="NORAD catalog id of a real satellite to track"),
    db: Session = Depends(get_db),
):
    """Current orbital state for a mission: real TLE propagation if a NORAD id
    is given AND the network is reachable; otherwise clearly-labeled simulated state."""
    mission = db.query(Mission).filter(Mission.id == mission_id).first()
    if not mission:
        raise HTTPException(404, "Mission not found")

    if norad_id:
        tle = await _fetch_tle_safe(norad_id)
        if tle:
            st = _tle_engine.get_orbital_state(tle)
            return {
                "satellite": tle.name,
                "norad_id": norad_id,
                "tle_epoch_year_day": round(tle.epoch, 4),
                "tle_age_hours": round((time.time() - tle.fetched_at) / 3600.0, 2),
                **st.__dict__,
                "position_eci_km": list(st.position_eci_km),
                "velocity_eci_kms": list(st.velocity_eci_kms),
                "orbital_elements": {
                    "inclination_deg": tle.inclination_deg,
                    "raan_deg": tle.raan_deg,
                    "eccentricity": tle.eccentricity,
                    "arg_perigee_deg": tle.arg_perigee_deg,
                    "mean_anomaly_deg": tle.mean_anomaly_deg,
                    "mean_motion_rev_day": tle.mean_motion_rev_day,
                },
                "time_standard": "UTC (Unix epoch ms)",
                "provenance_note": (
                    "Propagated from a real CelesTrak Two-Line Element set using "
                    "analytical Keplerian propagation. TLE-derived positions are "
                    "near-real-time MEAN-element estimates — never present these "
                    "as actual spacecraft telemetry."
                ),
            }

    return _simulated_state_from_mission(mission)


async def _fetch_tle_safe(norad_id: str):
    try:
        return await _tle_engine.fetch_tle_async(norad_id)
    except Exception:
        return None


@router.get("/daily-history/{mission_id}")
def get_daily_orbital_history(
    mission_id: str,
    day: Optional[int] = Query(None, description="Specific mission day to replay"),
    db: Session = Depends(get_db),
):
    """Daily orbital path history recorded by the Digital Twin (one record per
    completed mission day), enabling full-day trajectory replay."""
    q = db.query(DailySummary).filter(DailySummary.mission_id == mission_id)
    if day is not None:
        q = q.filter(DailySummary.mission_day == day)
    rows = q.order_by(DailySummary.mission_day.asc()).all()
    days = []
    for row in rows:
        pts = row.orbital_path_json or []
        days.append({
            "mission_day": row.mission_day,
            "point_count": len(pts),
            "ground_track": pts,
            "data_source": "backend-simulation",
            "data_quality": "simulated",
            "reference_frame": "geodetic lat/lon + altitude km",
        })
    if day is not None:
        if not days:
            raise HTTPException(404, f"No orbital history recorded for day {day}")
        return days[0]
    return {
        "mission_id": mission_id,
        "days_recorded": len(days),
        "days": days,
        "note": "Complete high-frequency raw telemetry remains in the telemetry archive; "
                "these are per-day ground-track snapshots for replay.",
    }
