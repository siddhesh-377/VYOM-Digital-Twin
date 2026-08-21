"""
VYOM Backend — TLE Engine
Fetches Two-Line Element sets from CelesTrak and propagates orbital state using SGP4.
All derived data is clearly labeled as 'tle-propagated' — never as actual telemetry.
"""
import time
import math
import logging
from typing import Dict, Optional, List, Tuple
from dataclasses import dataclass, field

logger = logging.getLogger("vyom")

# Earth constants
R_EARTH_KM = 6371.0
MU_EARTH = 398600.4418  # km³/s²


@dataclass
class TLEData:
    """Parsed TLE data with metadata."""
    norad_id: str
    name: str
    line1: str
    line2: str
    epoch: float  # Julian date
    fetched_at: float  # Unix timestamp
    inclination_deg: float = 0.0
    raan_deg: float = 0.0
    eccentricity: float = 0.0
    arg_perigee_deg: float = 0.0
    mean_anomaly_deg: float = 0.0
    mean_motion_rev_day: float = 0.0


@dataclass
class PropagatedState:
    """Orbital state derived from TLE propagation."""
    latitude_deg: float
    longitude_deg: float
    altitude_km: float
    velocity_kms: float
    position_eci_km: Tuple[float, float, float]  # X, Y, Z in ECI
    velocity_eci_kms: Tuple[float, float, float]
    timestamp: int  # ms
    data_source: str = "tle-propagated"
    data_quality: str = "near-real-time"
    reference_frame: str = "J2000 ECI"


class TLEEngine:
    """
    Fetches TLE data from CelesTrak and propagates orbital state.

    All data is clearly labeled as 'tle-propagated' to distinguish it
    from actual spacecraft telemetry which is NOT publicly available.
    """

    CELESTRAK_URL = "https://celestrak.org/NORAD/elements/gp.php"

    KNOWN_SATELLITES = {
        "ISS": "25544",
        "Hubble": "20580",
        "GOES-16": "41866",
        "Landsat-9": "49260",
        "Chandrayaan-3": "57320",
        "GSAT-30": "45026",
        "Cartosat-3": "44804",
        "GPS-IIF-12": "41019",
        "NOAA-20": "43013",
    }

    def __init__(self):
        self._tle_cache: Dict[str, TLEData] = {}
        self._cache_ttl_s: float = 12 * 3600
        self._daily_orbits: Dict[str, List[Dict]] = {}

    def _parse_tle(self, name: str, line1: str, line2: str) -> TLEData:
        """Parse TLE lines into structured data."""
        norad_id = line1[2:7].strip()
        inclination = float(line2[8:16].strip())
        raan = float(line2[17:25].strip())
        ecc_str = line2[26:33].strip()
        eccentricity = float(f"0.{ecc_str}")
        arg_perigee = float(line2[34:42].strip())
        mean_anomaly = float(line2[43:51].strip())
        mean_motion = float(line2[52:63].strip())

        epoch_year = int(line1[18:20])
        epoch_day = float(line1[20:32])
        if epoch_year < 57:
            epoch_year += 2000
        else:
            epoch_year += 1900

        return TLEData(
            norad_id=norad_id, name=name.strip(), line1=line1, line2=line2,
            epoch=epoch_year + epoch_day / 365.25, fetched_at=time.time(),
            inclination_deg=inclination, raan_deg=raan, eccentricity=eccentricity,
            arg_perigee_deg=arg_perigee, mean_anomaly_deg=mean_anomaly,
            mean_motion_rev_day=mean_motion,
        )

    async def fetch_tle(self, norad_id: str) -> Optional[TLEData]:
        """Fetch latest TLE from CelesTrak. Returns cached data if within TTL."""
        if norad_id in self._tle_cache:
            cached = self._tle_cache[norad_id]
            if time.time() - cached.fetched_at < self._cache_ttl_s:
                return cached
        try:
            import aiohttp
            url = f"{self.CELESTRAK_URL}?CATNR={norad_id}&FORMAT=TLE"
            async with aiohttp.ClientSession() as session:
                async with session.get(url, timeout=aiohttp.ClientTimeout(total=10)) as resp:
                    if resp.status != 200:
                        logger.warning("TLE fetch failed for NORAD %s: HTTP %s", norad_id, resp.status)
                        return self._tle_cache.get(norad_id)
                    text = await resp.text()
            lines = [l.strip() for l in text.strip().split("\n") if l.strip()]
            if len(lines) < 3:
                logger.warning("Invalid TLE response for NORAD %s", norad_id)
                return self._tle_cache.get(norad_id)
            tle = self._parse_tle(lines[0], lines[1], lines[2])
            self._tle_cache[norad_id] = tle
            logger.info("TLE updated for %s (NORAD %s)", tle.name, norad_id)
            return tle
        except ImportError:
            logger.warning("aiohttp not installed — TLE fetch unavailable.")
            return self._tle_cache.get(norad_id)
        except Exception as e:
            logger.warning("TLE fetch error for NORAD %s: %s", norad_id, e)
            return self._tle_cache.get(norad_id)

    def propagate_analytical(self, tle: TLEData, timestamp_s: float) -> PropagatedState:
        """Analytical Keplerian propagation. Data labeled as 'tle-propagated'."""
        period_min = 1440.0 / tle.mean_motion_rev_day if tle.mean_motion_rev_day > 0 else 90.0
        period_s = period_min * 60.0
        a_km = (MU_EARTH * (period_s / (2 * math.pi)) ** 2) ** (1.0 / 3.0)

        t_since_ref = timestamp_s % period_s
        ma_deg = (tle.mean_anomaly_deg + (t_since_ref / period_s) * 360.0) % 360.0
        M = math.radians(ma_deg)

        E = M
        e = tle.eccentricity
        for _ in range(20):
            dE = (E - e * math.sin(E) - M) / (1 - e * math.cos(E))
            E -= dE
            if abs(dE) < 1e-10:
                break

        cos_nu = (math.cos(E) - e) / (1 - e * math.cos(E))
        sin_nu = (math.sqrt(1 - e ** 2) * math.sin(E)) / (1 - e * math.cos(E))
        nu = math.atan2(sin_nu, cos_nu)

        r_km = a_km * (1 - e * math.cos(E))
        altitude_km = r_km - R_EARTH_KM
        v_kms = math.sqrt(MU_EARTH * (2.0 / r_km - 1.0 / a_km))

        x_orb = r_km * math.cos(nu)
        y_orb = r_km * math.sin(nu)

        inc = math.radians(tle.inclination_deg)
        raan = math.radians(tle.raan_deg)
        w = math.radians(tle.arg_perigee_deg)

        cos_r, sin_r = math.cos(raan), math.sin(raan)
        cos_w, sin_w = math.cos(w), math.sin(w)
        cos_i, sin_i = math.cos(inc), math.sin(inc)

        x_eci = (cos_r * cos_w - sin_r * sin_w * cos_i) * x_orb + \
                (-cos_r * sin_w - sin_r * cos_w * cos_i) * y_orb
        y_eci = (sin_r * cos_w + cos_r * sin_w * cos_i) * x_orb + \
                (-sin_r * sin_w + cos_r * cos_w * cos_i) * y_orb
        z_eci = (sin_w * sin_i) * x_orb + (cos_w * sin_i) * y_orb

        lat_deg = math.degrees(math.asin(max(-1, min(1, z_eci / r_km))))
        gmst_rad = (timestamp_s / 86400.0 * 2 * math.pi * 1.00273790935) % (2 * math.pi)
        lon_rad = math.atan2(y_eci, x_eci) - gmst_rad
        lon_deg = math.degrees(lon_rad) % 360
        if lon_deg > 180:
            lon_deg -= 360

        return PropagatedState(
            latitude_deg=round(lat_deg, 4), longitude_deg=round(lon_deg, 4),
            altitude_km=round(max(0, altitude_km), 2), velocity_kms=round(v_kms, 4),
            position_eci_km=(round(x_eci, 2), round(y_eci, 2), round(z_eci, 2)),
            velocity_eci_kms=(0.0, 0.0, 0.0),
            timestamp=int(timestamp_s * 1000),
            data_source="tle-propagated",
            data_quality="near-real-time" if time.time() - timestamp_s < 3600 else "historical",
            reference_frame="J2000 ECI (approximate)",
        )

    def get_orbital_state(self, tle: TLEData) -> PropagatedState:
        """Get current orbital state from TLE propagation."""
        return self.propagate_analytical(tle, time.time())

    def record_daily_orbit(self, mission_id: str, mission_day: int,
                           orbit_points: List[Dict]) -> None:
        """Store daily orbital path history for replay."""
        key = f"{mission_id}:{mission_day}"
        self._daily_orbits[key] = orbit_points

    def get_daily_orbit(self, mission_id: str, mission_day: int) -> List[Dict]:
        """Retrieve stored daily orbital path for replay."""
        key = f"{mission_id}:{mission_day}"
        return self._daily_orbits.get(key, [])

    def get_known_satellites(self) -> List[Dict]:
        """Return list of well-known satellites for selection UI."""
        return [
            {"name": name, "norad_id": nid}
            for name, nid in self.KNOWN_SATELLITES.items()
        ]
