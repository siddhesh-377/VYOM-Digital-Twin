import { describe, it, expect } from 'vitest';
import { OrbitalPropagationService } from '../services/OrbitalPropagationService';
import { anomalyPipeline } from '../engines/AnomalyPipelineEngine';
import { TrajectoryPredictionEngine } from '../engines/TrajectoryPredictionEngine';
import { AIContextProvider } from '../engines/AIContextProvider';
import { MISSION_PROFILES } from '../types/missionProfiles';

describe('OrbitalPropagationService', () => {
  it('calculates orbital velocity using Vis-Viva equation accurately', () => {
    const velocityLeo = OrbitalPropagationService.calculateSpeedKms(6378.137 + 400, 6378.137 + 400); // 400km LEO circular
    expect(velocityLeo).toBeGreaterThan(7.5);
    expect(velocityLeo).toBeLessThan(7.8);

    const velocityGeo = OrbitalPropagationService.calculateSpeedKms(6378.137 + 35786, 6378.137 + 35786); // GEO
    expect(velocityGeo).toBeGreaterThan(3.0);
    expect(velocityGeo).toBeLessThan(3.2);
  });

  it('converts ECI coordinates to Geodetic properly', () => {
    const geodetic = OrbitalPropagationService.eciToGeodetic([6378.137 + 400, 0, 0], 0);
    expect(geodetic.latitudeDeg).toBeCloseTo(0, 1);
    expect(geodetic.longitudeDeg).toBeCloseTo(0, 1);
    expect(geodetic.altitudeKm).toBeCloseTo(400, 1);
  });

  it('generates multi-orbit ground track points correctly', () => {
    const groundTrack = OrbitalPropagationService.generateGroundTrack({
      semiMajorAxisKm: 6378.137 + 500,
      eccentricity: 0.001,
      inclinationDeg: 51.6,
      raanDeg: 0,
      argOfPerigeeDeg: 0,
      trueAnomalyDeg: 0,
      epochMs: Date.now(),
    }, 60, 2);

    expect(groundTrack.length).toBeGreaterThan(50);
    groundTrack.forEach((pt) => {
      expect(pt.lat).toBeGreaterThanOrEqual(-55);
      expect(pt.lat).toBeLessThanOrEqual(55);
      expect(pt.lng).toBeGreaterThanOrEqual(-180);
      expect(pt.lng).toBeLessThanOrEqual(180);
    });
  });
});

describe('AnomalyPipelineEngine', () => {
  it('detects threshold and rate of change anomalies', () => {
    // Normal baseline packet
    const normalPacket: any = {
      timestamp: Date.now() - 1000,
      power: { batteryPercent: 95, voltageV: 28.0, solarGenerationW: 240, consumptionW: 180 },
      thermal: { cpuTempC: 38, batteryTempC: 22, payloadTempC: 20, externalTempC: 15 },
      attitude: { pitchDeg: 0, rollDeg: 0, yawDeg: 0, angularVelDegS: 0.05, reactionWheelRpm: 3200 },
      comm: { signalDbm: -75, dataRateMbps: 12, packetsPerSec: 100, latencyMs: 20, uptime: 99.9 },
      compute: { cpuPercent: 32, memoryPercent: 44, storagePercent: 28 },
      orbit: { altitudeKm: 400, velocityKms: 7.66, accelerationMs2: 8.5, gForce: 1, latitudeDeg: 0, longitudeDeg: 0, inclinationDeg: 51.6, periodMin: 92.8, apogeeKm: 405, perigeeKm: 395, semiMajorAxisKm: 6778.137 },
      overallHealth: 98,
      healthStatus: 'nominal',
    };
    anomalyPipeline.evaluate(normalPacket);

    // Thermal spike packet
    const anomalyPacket: any = {
      ...normalPacket,
      timestamp: Date.now(),
      thermal: { cpuTempC: 88, batteryTempC: 58, payloadTempC: 50, externalTempC: 20 },
    };

    const newIncidents = anomalyPipeline.evaluate(anomalyPacket);
    expect(newIncidents).toBeDefined();
    expect(newIncidents.length).toBeGreaterThan(0);
    expect(newIncidents[0].severity).toBe('critical');
    expect(newIncidents[0].normalized_subsystem.toLowerCase()).toContain('thermal');
  });
});

describe('TrajectoryPredictionEngine', () => {
  it('predicts orbital evolution and apogee/perigee across horizons', () => {
    const orbitState: any = {
      altitudeKm: 420,
      velocityKms: 7.66,
      inclinationDeg: 51.6,
      eccentricity: 0.0012,
      semiMajorAxisKm: 6798.137,
      periodMin: 92.8,
      trueAnomalyDeg: 120,
    };

    const prediction10m = TrajectoryPredictionEngine.predictHorizon(orbitState, '10m');
    expect(prediction10m.waypoints.length).toBeGreaterThan(5);
    expect(prediction10m.confidence).toBeGreaterThan(95);

    const prediction24h = TrajectoryPredictionEngine.predictHorizon(orbitState, '24h');
    expect(prediction24h.eclipseEvents.length).toBeGreaterThan(0);
    expect(prediction24h.apogeePredictedKm).toBeGreaterThan(400);
  });
});

describe('AIContextProvider', () => {
  it('generates structured grounded prompt contexts and answers queries', () => {
    const context = AIContextProvider.generatePromptContext();
    expect(context).toContain('[OBSERVED TELEMETRY]');
    expect(context).toContain('[SYSTEM CONSTRAINTS]');

    const answer = AIContextProvider.query('What is the current mission status?');
    expect(answer).toContain('[OBSERVED TELEMETRY]');
    expect(answer).toContain('[AI RECOMMENDATION]');
  });
});

describe('Mission Profiles', () => {
  it('defines 4 aerospace-grade mission profiles with full subsystems', () => {
    const profiles = ['human', 'orbital', 'planetary', 'astrophysics'] as const;
    profiles.forEach((p) => {
      const spec = MISSION_PROFILES[p];
      expect(spec.id).toBeDefined();
      expect(spec.name).toBeDefined();
      expect(spec.subsystems.length).toBeGreaterThanOrEqual(6);
      expect(spec.telemetryChannels.length).toBeGreaterThan(0);
      expect(spec.primaryKPIs.length).toBeGreaterThan(0);
    });
  });
});
