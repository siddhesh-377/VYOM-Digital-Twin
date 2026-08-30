/**
 * VYOM — Multi-Horizon Trajectory & Orbit Prediction Engine (Phase 11)
 * Computes forward-propagated orbital trajectories for 10min, 30min, 1-orbit, 6hr, and 24hr horizons
 * with Keplerian kinematics and prediction confidence metrics.
 */

import { OrbitalPropagationService, KeplerianElements, MU_EARTH, R_EARTH } from '../services/OrbitalPropagationService';
import { TelemetryOrbit } from '../types/mission';

export type PredictionHorizon = '10m' | '30m' | '1orbit' | '6h' | '24h';

export interface PredictedWaypoint {
  timestamp: number;
  latitudeDeg: number;
  longitudeDeg: number;
  altitudeKm: number;
  velocityKms: number;
  inEclipse: boolean;
  groundStationContact?: string;
  confidencePercent: number;
}

export interface HorizonPredictionResult {
  horizon: PredictionHorizon;
  horizonDurationSec: number;
  confidence: number;
  waypoints: PredictedWaypoint[];
  apogeePredictedKm: number;
  perigeePredictedKm: number;
  eclipseEvents: Array<{ enterTime: number; exitTime: number; durationMin: number }>;
}

export class TrajectoryPredictionEngine {
  /**
   * Generates predictive trajectory horizon results given current orbital state
   */
  public static predictHorizon(
    orbit: TelemetryOrbit,
    horizon: PredictionHorizon = '1orbit'
  ): HorizonPredictionResult {
    const horizonSecondsMap: Record<PredictionHorizon, number> = {
      '10m': 10 * 60,
      '30m': 30 * 60,
      '1orbit': Math.max(90, (orbit.periodMin || 92.5)) * 60,
      '6h': 6 * 3600,
      '24h': 24 * 3600,
    };

    const confidenceMap: Record<PredictionHorizon, number> = {
      '10m': 99.5,
      '30m': 97.2,
      '1orbit': 94.8,
      '6h': 89.0,
      '24h': 82.5,
    };

    const totalSeconds = horizonSecondsMap[horizon];
    const confidence = confidenceMap[horizon];
    const stepCount = 60;
    const dt = totalSeconds / stepCount;

    const semiMajorAxisKm = orbit.semiMajorAxisKm || (R_EARTH + orbit.altitudeKm);
    const eccentricity = orbit.eccentricity || 0.001;
    const inclinationDeg = orbit.inclinationDeg || 51.6;

    const baseElements: KeplerianElements = {
      semiMajorAxisKm,
      eccentricity,
      inclinationDeg,
      raanDeg: orbit.longitudeDeg || 0,
      argOfPerigeeDeg: 0,
      trueAnomalyDeg: orbit.trueAnomalyDeg || 0,
      epochMs: Date.now(),
    };

    const waypoints: PredictedWaypoint[] = [];
    const eclipseEvents: Array<{ enterTime: number; exitTime: number; durationMin: number }> = [];
    let currentlyInEclipse = false;
    let eclipseStartTime = 0;

    for (let i = 0; i <= stepCount; i++) {
      const elapsedSec = i * dt;
      const prop = OrbitalPropagationService.propagateKeplerian(baseElements, elapsedSec);
      const eci = OrbitalPropagationService.keplerianToECI(prop);
      const gmst = (7.2921159e-5 * elapsedSec) % (2 * Math.PI);
      const geodetic = OrbitalPropagationService.eciToGeodetic(eci.positionKm, gmst);

      // Simplified Earth shadow cylinder model for eclipse prediction
      const [x, , z] = eci.positionKm;
      const inShadow = x < 0 && Math.sqrt(z * z) < R_EARTH;

      if (inShadow && !currentlyInEclipse) {
        currentlyInEclipse = true;
        eclipseStartTime = baseElements.epochMs + elapsedSec * 1000;
      } else if (!inShadow && currentlyInEclipse) {
        currentlyInEclipse = false;
        const exitTime = baseElements.epochMs + elapsedSec * 1000;
        eclipseEvents.push({
          enterTime: eclipseStartTime,
          exitTime,
          durationMin: (exitTime - eclipseStartTime) / 60000,
        });
      }

      waypoints.push({
        timestamp: baseElements.epochMs + elapsedSec * 1000,
        latitudeDeg: geodetic.latitudeDeg,
        longitudeDeg: geodetic.longitudeDeg,
        altitudeKm: geodetic.altitudeKm,
        velocityKms: eci.speedKms,
        inEclipse: inShadow,
        confidencePercent: Math.max(70, confidence - (elapsedSec / totalSeconds) * 10),
      });
    }

    return {
      horizon,
      horizonDurationSec: totalSeconds,
      confidence,
      waypoints,
      apogeePredictedKm: OrbitalPropagationService.calculateApoapsisKm(semiMajorAxisKm, eccentricity),
      perigeePredictedKm: OrbitalPropagationService.calculatePeriapsisKm(semiMajorAxisKm, eccentricity),
      eclipseEvents,
    };
  }
}
