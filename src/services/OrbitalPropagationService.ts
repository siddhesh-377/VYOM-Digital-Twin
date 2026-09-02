/**
 * VYOM — Real-Time Orbital Tracking & Propagation Service (Phase 3)
 * Provides physically grounded Keplerian orbital mechanics, coordinate transformations (ECI/ECEF/Geodetic),
 * velocity vectors, apoapsis/periapsis calculation, and multi-orbit ground track generation.
 */

// Earth gravitational parameter (km^3 / s^2)
export const MU_EARTH = 398600.4418;
// Earth equatorial radius (km)
export const R_EARTH = 6378.137;
// Earth J2 perturbation coefficient
export const J2_EARTH = 1.08263e-3;
// Earth angular rotation rate (rad/s)
export const OMEGA_EARTH = 7.2921159e-5;

export interface KeplerianElements {
  semiMajorAxisKm: number;    // a
  eccentricity: number;       // e
  inclinationDeg: number;     // i
  raanDeg: number;            // Ω (Right Ascension of Ascending Node)
  argOfPerigeeDeg: number;    // ω (Argument of Perigee)
  trueAnomalyDeg: number;     // ν
  epochMs: number;
}

export interface GeodeticPosition {
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
}

export interface StateVector {
  positionKm: [number, number, number]; // [x, y, z] in ECI
  velocityKms: [number, number, number]; // [vx, vy, vz] in ECI
  speedKms: number;
}

export interface OrbitalParameters {
  semiMajorAxisKm: number;
  eccentricity: number;
  inclinationDeg: number;
  apoapsisKm: number;
  periapsisKm: number;
  orbitalPeriodMin: number;
  meanMotionRadS: number;
  orbitalPhase: string;
  velocityKms: number;
  altitudeKm: number;
  latitudeDeg: number;
  longitudeDeg: number;
}

export class OrbitalPropagationService {
  /**
   * Calculates orbital period in minutes given semi-major axis (km)
   */
  public static calculatePeriodMinutes(semiMajorAxisKm: number): number {
    if (semiMajorAxisKm <= 0) return 0;
    const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(semiMajorAxisKm, 3) / MU_EARTH);
    return periodSeconds / 60;
  }

  /**
   * Calculates apoapsis altitude (km) above Earth's surface
   */
  public static calculateApoapsisKm(semiMajorAxisKm: number, eccentricity: number): number {
    return semiMajorAxisKm * (1 + eccentricity) - R_EARTH;
  }

  /**
   * Calculates periapsis altitude (km) above Earth's surface
   */
  public static calculatePeriapsisKm(semiMajorAxisKm: number, eccentricity: number): number {
    return semiMajorAxisKm * (1 - eccentricity) - R_EARTH;
  }

  /**
   * Calculates instantaneous orbital speed (km/s) using Vis-Viva equation
   * v^2 = mu * (2/r - 1/a)
   */
  public static calculateSpeedKms(radiusKm: number, semiMajorAxisKm: number): number {
    if (radiusKm <= 0 || semiMajorAxisKm <= 0) return 0;
    const vSquared = MU_EARTH * (2 / radiusKm - 1 / semiMajorAxisKm);
    return Math.sqrt(Math.max(0, vSquared));
  }

  /**
   * Propagates Keplerian elements forward by deltaSeconds
   */
  public static propagateKeplerian(
    elements: KeplerianElements,
    deltaSeconds: number
  ): KeplerianElements {
    const a = elements.semiMajorAxisKm;
    const e = elements.eccentricity;
    const n = Math.sqrt(MU_EARTH / Math.pow(a, 3)); // Mean motion (rad/s)

    // J2 Nodal Precession (RAAN drift in deg/s)
    const p = a * (1 - e * e);
    const incRad = (elements.inclinationDeg * Math.PI) / 180;
    const raanRateRadS = -1.5 * J2_EARTH * Math.pow(R_EARTH / p, 2) * n * Math.cos(incRad);
    const raanDeltaDeg = (raanRateRadS * deltaSeconds * 180) / Math.PI;

    // Advance mean anomaly
    const currentM = this.trueAnomalyToMeanAnomaly(elements.trueAnomalyDeg, e);
    const newMRad = (currentM * Math.PI) / 180 + n * deltaSeconds;
    const normalizedMRad = ((newMRad % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI);
    const newTrueAnomalyDeg = this.meanAnomalyToTrueAnomaly((normalizedMRad * 180) / Math.PI, e);

    return {
      ...elements,
      raanDeg: (elements.raanDeg + raanDeltaDeg + 360) % 360,
      trueAnomalyDeg: newTrueAnomalyDeg,
      epochMs: elements.epochMs + deltaSeconds * 1000,
    };
  }

  /**
   * Converts Keplerian elements to ECI State Vector [position, velocity]
   */
  public static keplerianToECI(elements: KeplerianElements): StateVector {
    const a = elements.semiMajorAxisKm;
    const e = elements.eccentricity;
    const i = (elements.inclinationDeg * Math.PI) / 180;
    const raan = (elements.raanDeg * Math.PI) / 180;
    const argP = (elements.argOfPerigeeDeg * Math.PI) / 180;
    const nu = (elements.trueAnomalyDeg * Math.PI) / 180;

    // Radius in orbital plane
    const p = a * (1 - e * e);
    const r = p / (1 + e * Math.cos(nu));

    // Position in perifocal frame (PQW)
    const xP = r * Math.cos(nu);
    const yP = r * Math.sin(nu);
    const zP = 0;

    // Velocity in perifocal frame
    const h = Math.sqrt(MU_EARTH * p);
    const vxP = -(MU_EARTH / h) * Math.sin(nu);
    const vyP = (MU_EARTH / h) * (e + Math.cos(nu));
    const vzP = 0;

    // Perifocal to ECI rotation matrix
    const cosRaan = Math.cos(raan);
    const sinRaan = Math.sin(raan);
    const cosArgP = Math.cos(argP);
    const sinArgP = Math.sin(argP);
    const cosI = Math.cos(i);
    const sinI = Math.sin(i);

    const Px = cosRaan * cosArgP - sinRaan * sinArgP * cosI;
    const Py = sinRaan * cosArgP + cosRaan * sinArgP * cosI;
    const Pz = sinArgP * sinI;

    const Qx = -cosRaan * sinArgP - sinRaan * cosArgP * cosI;
    const Qy = -sinRaan * sinArgP + cosRaan * cosArgP * cosI;
    const Qz = cosArgP * sinI;

    const x = xP * Px + yP * Qx;
    const y = xP * Py + yP * Qy;
    const z = xP * Pz + yP * Qz;

    const vx = vxP * Px + vyP * Qx;
    const vy = vxP * Py + vyP * Qy;
    const vz = vxP * Pz + vyP * Qz;

    const speed = Math.sqrt(vx * vx + vy * vy + vz * vz);

    return {
      positionKm: [x, y, z],
      velocityKms: [vx, vy, vz],
      speedKms: speed,
    };
  }

  /**
   * Converts ECI Coordinates to Geodetic Latitude, Longitude, Altitude (WGS-84)
   */
  public static eciToGeodetic(
    eciPositionKm: [number, number, number],
    gmstRad: number
  ): GeodeticPosition {
    const [x, y, z] = eciPositionKm;

    // Rotate ECI position to ECEF by Greenwich Mean Sidereal Time (GMST)
    const xEcef = x * Math.cos(gmstRad) + y * Math.sin(gmstRad);
    const yEcef = -x * Math.sin(gmstRad) + y * Math.cos(gmstRad);
    const zEcef = z;

    const r = Math.sqrt(xEcef * xEcef + yEcef * yEcef + zEcef * zEcef);
    const latRad = Math.asin(zEcef / r);
    const lngRad = Math.atan2(yEcef, xEcef);

    const latDeg = (latRad * 180) / Math.PI;
    const lngDeg = (lngRad * 180) / Math.PI;
    const altKm = r - R_EARTH;

    return {
      latitudeDeg: latDeg,
      longitudeDeg: lngDeg,
      altitudeKm: Math.max(0, altKm),
    };
  }

  /**
   * Generates a series of ground-track points spanning 1 or more orbits
   */
  public static generateGroundTrack(
    elements: KeplerianElements,
    steps: number = 180,
    orbitCount: number = 1
  ): Array<{ lat: number; lng: number; alt: number; timestamp: number }> {
    const points: Array<{ lat: number; lng: number; alt: number; timestamp: number }> = [];
    const periodSec = this.calculatePeriodMinutes(elements.semiMajorAxisKm) * 60;
    const totalTimeSec = periodSec * orbitCount;
    const dt = totalTimeSec / steps;

    for (let i = 0; i <= steps; i++) {
      const t = i * dt;
      const propElements = this.propagateKeplerian(elements, t);
      const eci = this.keplerianToECI(propElements);
      const gmst = (OMEGA_EARTH * t) % (2 * Math.PI);
      const geodetic = this.eciToGeodetic(eci.positionKm, gmst);

      points.push({
        lat: geodetic.latitudeDeg,
        lng: geodetic.longitudeDeg,
        alt: geodetic.altitudeKm,
        timestamp: elements.epochMs + t * 1000,
      });
    }

    return points;
  }

  /**
   * Solves Kepler's Equation M = E - e*sin(E) using Newton-Raphson
   */
  private static meanAnomalyToTrueAnomaly(meanAnomalyDeg: number, e: number): number {
    const MRad = (meanAnomalyDeg * Math.PI) / 180;
    let E = MRad;
    for (let iter = 0; iter < 10; iter++) {
      const f = E - e * Math.sin(E) - MRad;
      const fPrime = 1 - e * Math.cos(E);
      const dE = f / fPrime;
      E -= dE;
      if (Math.abs(dE) < 1e-6) break;
    }

    // True anomaly nu from eccentric anomaly E
    const sinNu = (Math.sqrt(1 - e * e) * Math.sin(E)) / (1 - e * Math.cos(E));
    const cosNu = (Math.cos(E) - e) / (1 - e * Math.cos(E));
    const nuRad = Math.atan2(sinNu, cosNu);
    return (((nuRad * 180) / Math.PI + 360) % 360);
  }

  private static trueAnomalyToMeanAnomaly(trueAnomalyDeg: number, e: number): number {
    const nuRad = (trueAnomalyDeg * Math.PI) / 180;
    const cosNu = Math.cos(nuRad);
    const cosE = (e + cosNu) / (1 + e * cosNu);
    const sinE = (Math.sqrt(1 - e * e) * Math.sin(nuRad)) / (1 + e * cosNu);
    const E = Math.atan2(sinE, cosE);
    const MRad = E - e * Math.sin(E);
    return (((MRad * 180) / Math.PI + 360) % 360);
  }
}
