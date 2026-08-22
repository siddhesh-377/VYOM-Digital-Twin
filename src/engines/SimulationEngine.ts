// VYOM — High-Fidelity Mission Simulation & Autonomous AI Engine
// Drives Keplerian kinematics, atmospheric layers, dynamic telemetry reactions, and multi-step AI reasoning

import { useMissionStore } from '../store/missionStore';
import type {
  Telemetry, CrewMember, OrbitPoint, BlackBoxEvent,
  AIAnalysis, AIReasoningStep, AutonomousAction, ThreatScenario
} from '../types/mission';
import { backendWS } from '../services/BackendWebSocketService';
import { eventBus } from './MissionEventBus';

let orbitAngle = 0;

// Earth Physical Constants
const EARTH_RADIUS_KM = 6371.0;
const EARTH_MU = 398600.4418; // km^3 / s^2 (Standard Gravitational Parameter G * M_Earth)

interface TelemetryState {
  battery: number;
  voltage: number;
  current: number;
  solar: number;
  consumption: number;
  cpuTemp: number;
  batteryTemp: number;
  payloadTemp: number;
  extTemp: number;
  roll: number;
  pitch: number;
  yaw: number;
  angularVel: number;
  reactionWheel: number;
  signal: number;
  dataRate: number;
  packets: number;
  latency: number;
  commUptime: number;
  cpu: number;
  memory: number;
  storage: number;
  altitude: number;
  velocity: number;
  acceleration: number;
  gForce: number;
  lat: number;
  lng: number;
  inclination: number;
  period: number;
  semiMajorAxis: number;
  eccentricity: number;
  trueAnomaly: number;
  distanceFromEarthKm: number;
  phaseDesc: string;
  health: number;
  atmosphericLayer: 'Troposphere' | 'Stratosphere' | 'Mesosphere' | 'Thermosphere' | 'Exosphere';
  atmosphericDensity: number;
  atmosphericDrag: number;
}

let simState: TelemetryState = {
  battery: 96.4,
  voltage: 28.6,
  current: 4.2,
  solar: 260,
  consumption: 120,
  cpuTemp: 41.8,
  batteryTemp: 18.2,
  payloadTemp: 32.5,
  extTemp: -15.0,
  roll: 0.12,
  pitch: -0.08,
  yaw: 0.04,
  angularVel: 0.01,
  reactionWheel: 3240,
  signal: -72,
  dataRate: 8.4,
  packets: 240,
  latency: 340,
  commUptime: 100,
  cpu: 32,
  memory: 48,
  storage: 12.5,
  altitude: 650,
  velocity: 7.53,
  acceleration: 8.09,
  gForce: 0.825,
  lat: 13.72,
  lng: 80.23,
  inclination: 51.6,
  period: 97.7,
  semiMajorAxis: 7021.0,
  eccentricity: 0.0012,
  trueAnomaly: 45.0,
  distanceFromEarthKm: 650,
  phaseDesc: 'Nominal Orbital Operations',
  health: 98.5,
  atmosphericLayer: 'Exosphere',
  atmosphericDensity: 1.4e-13,
  atmosphericDrag: 0.0004,
};

let threatEffects: Record<string, number> = {};

// AI Reasoning state management
let aiPipelineTimer: any = null;
let currentAiSteps: AIReasoningStep[] = [];

function lerp(a: number, b: number, t: number) { return a + (b - a) * t; }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }
function noise(amp: number) { return (Math.random() - 0.5) * 2 * amp; }

function getAtmosphericData(altKm: number) {
  if (altKm < 12) {
    const rho = 1.225 * Math.exp(-altKm / 8.5);
    return { layer: 'Troposphere' as const, density: rho, drag: rho * 2.2 };
  } else if (altKm < 50) {
    const rho = 0.312 * Math.exp(-(altKm - 12) / 7.2);
    return { layer: 'Stratosphere' as const, density: rho, drag: rho * 1.8 };
  } else if (altKm < 85) {
    const rho = 0.0014 * Math.exp(-(altKm - 50) / 6.0);
    return { layer: 'Mesosphere' as const, density: rho, drag: rho * 0.9 };
  } else if (altKm < 600) {
    const rho = 1.8e-6 * Math.exp(-(altKm - 85) / 45.0);
    return { layer: 'Thermosphere' as const, density: rho, drag: rho * 0.05 };
  } else {
    const rho = 1.4e-13 * Math.exp(-(altKm - 600) / 200.0);
    return { layer: 'Exosphere' as const, density: Math.max(1e-16, rho), drag: Math.max(1e-7, rho * 0.001) };
  }
}

function applyThreatEffects(state: TelemetryState): TelemetryState {
  const s = { ...state };
  const e = threatEffects;

  if (e.radiation) {
    s.health = Math.max(10, s.health - e.radiation * 0.04);
    s.batteryTemp += e.radiation * 2.8;
    s.cpu += e.radiation * 4.0;
  }
  if (e.solar) {
    s.signal -= e.solar * 4.5;
    s.dataRate = Math.max(0.2, s.dataRate - e.solar * 1.2);
    s.payloadTemp += e.solar * 6.5;
    s.solar += e.solar * 35;
    s.health = Math.max(15, s.health - e.solar * 0.03);
  }
  if (e.asteroid || e.debris) {
    const sev = e.asteroid || e.debris;
    s.health = Math.max(5, s.health - sev * 4.5);
    s.roll += sev * 2.5;
    s.pitch += sev * 1.8;
    s.angularVel += sev * 0.15;
    s.cpu += sev * 6.0;
  }
  if (e.power) {
    s.battery = Math.max(8.0, s.battery - e.power * 6.5);
    s.voltage = Math.max(18.5, s.voltage - e.power * 1.8);
    s.solar = Math.max(10, s.solar * (1 - e.power * 0.15));
    s.consumption = Math.max(40, s.consumption - e.power * 8);
    s.health = Math.max(20, s.health - e.power * 0.05);
  }
  if (e.thermal) {
    s.cpuTemp += e.thermal * 6.5;
    s.payloadTemp += e.thermal * 5.2;
    s.batteryTemp += e.thermal * 3.8;
    s.health = Math.max(25, s.health - e.thermal * 0.08);
  }
  if (e.comms) {
    s.signal = Math.max(-125, s.signal - e.comms * 6.0);
    s.dataRate = Math.max(0.1, s.dataRate * 0.2);
    s.commUptime = Math.max(40, s.commUptime - e.comms * 5.5);
  }
  if (e.attitude) {
    s.roll += e.attitude * 3.5;
    s.pitch += e.attitude * 2.8;
    s.yaw += e.attitude * 3.0;
    s.angularVel += e.attitude * 0.22;
    s.reactionWheel = Math.min(6500, s.reactionWheel + e.attitude * 450);
  }

  return s;
}

function tickCrewVitals(crew: CrewMember[], missionDay: number, envRadiation: number): CrewMember[] {
  const hasThreat = Object.keys(threatEffects).length > 0;
  const isSolarStorm = !!threatEffects.solar || !!threatEffects.radiation;

  return crew.map((c, idx) => {
    const hourOfDay = (missionDay * 24 + idx * 2) % 24;
    const isSleeping = hourOfDay >= 22 || hourOfDay < 6;
    const isEVA = !isSleeping && missionDay > 4 && missionDay < 12 && (c.role.includes('Commander') || c.role.includes('Pilot'));

    let targetHeartRate = isSleeping ? 58 : isEVA ? 94 : 72;
    let targetStress = isSleeping ? 8 : isEVA ? 48 : 18;
    let targetRespiration = isSleeping ? 12 : isEVA ? 20 : 14;
    let targetSpO2 = 99.2;
    let targetPressure = 101.3;

    if (hasThreat) {
      targetHeartRate += 28;
      targetStress += 40;
      targetRespiration += 7;
    }

    if (isSolarStorm) {
      targetStress += 25;
    }

    const hr = clamp(lerp(c.heartRateBpm, targetHeartRate, 0.05) + noise(1.5), 48, 165);
    const spo2 = clamp(lerp(c.spo2Percent, targetSpO2, 0.02) + noise(0.1), 91, 100);
    const resp = clamp(lerp(c.respirationBpm, targetRespiration, 0.03) + noise(0.4), 8, 34);
    const temp = clamp(lerp(c.coreTempC, 36.8 + (isEVA ? 0.3 : 0), 0.01) + noise(0.02), 35.8, 38.6);
    const stress = clamp(lerp(c.stressIndex, targetStress, 0.06) + noise(1), 0, 100);
    const radInc = (envRadiation * 0.00002) + (isSolarStorm ? 0.0015 : 0.00001);
    const rad = c.radiationDoseMsv + radInc;

    const status: CrewMember['status'] = hasThreat && stress > 60 ? 'elevated'
      : isEVA ? 'eva'
      : isSleeping ? 'resting'
      : spo2 < 95 || hr > 130 ? 'critical'
      : 'nominal';

    const activity = isEVA ? 'Lunar Surface Extravehicular Activity (EVA)'
      : isSleeping ? 'Crew Sleep Cycle'
      : c.role === 'Commander' ? 'Mission Trajectory & Autonomous Systems Oversight'
      : c.role === 'Lunar Module Pilot' ? 'Lander Telemetry & Terrain Radar Sync'
      : c.role === 'Flight Engineer' ? 'ECLSS Life Support & Power Distribution'
      : 'Biomedical Telemetry & Radiation Monitoring';

    return {
      ...c,
      heartRateBpm: parseFloat(hr.toFixed(0)),
      spo2Percent: parseFloat(spo2.toFixed(1)),
      respirationBpm: parseFloat(resp.toFixed(0)),
      coreTempC: parseFloat(temp.toFixed(1)),
      suitPressureKpa: targetPressure,
      radiationDoseMsv: parseFloat(rad.toFixed(4)),
      stressIndex: parseFloat(stress.toFixed(0)),
      status,
      activity,
    };
  });
}

function tickTelemetry(simDeltaMs: number): Telemetry {
  const store = useMissionStore.getState();
  const dt = Math.max(0.001, simDeltaMs / 1000);
  const cfg = store.config;
  const isHumanLunar = cfg?.type === 'human' || cfg?.destination === 'lunar-surface' || cfg?.destination === 'lunar-orbit';

  // --- Keplerian Physics & Gravitational Mechanics ---
  const r_km = EARTH_RADIUS_KM + simState.altitude;
  simState.semiMajorAxis = r_km;
  
  // Orbital period T = 2*pi * sqrt(a^3 / mu)
  const periodSeconds = 2 * Math.PI * Math.sqrt(Math.pow(r_km, 3) / EARTH_MU);
  simState.period = periodSeconds / 60; // minutes

  // Angular velocity omega = 2*pi / T
  const omega = (2 * Math.PI) / periodSeconds;
  orbitAngle += omega * dt;
  if (orbitAngle > Math.PI * 2 * 1000) {
    orbitAngle = orbitAngle % (Math.PI * 2);
  }

  // True Anomaly theta
  simState.trueAnomaly = ((orbitAngle * 180) / Math.PI) % 360;

  // Instantaneous orbital speed v = sqrt(mu / r)
  const v_kms = Math.sqrt(EARTH_MU / r_km);
  simState.velocity = v_kms;

  // Centripetal acceleration a = mu / r^2 (in m/s^2)
  const a_ms2 = (EARTH_MU / (r_km * r_km)) * 1000;
  simState.acceleration = a_ms2;
  simState.gForce = a_ms2 / 9.80665;

  // Ground Track Coordinate Projection
  const incRad = (simState.inclination * Math.PI) / 180;
  simState.lat = Math.sin(orbitAngle) * simState.inclination;
  
  const earthRotRate = (360 / (24 * 3600)) * dt;
  const orbitLngProgression = ((omega * 180) / Math.PI) * dt * Math.cos(incRad);
  simState.lng = (simState.lng + orbitLngProgression - earthRotRate);
  while (simState.lng > 180) simState.lng -= 360;
  while (simState.lng < -180) simState.lng += 360;

  // Atmospheric physics at current altitude
  const atmo = getAtmosphericData(simState.altitude);
  simState.atmosphericLayer = atmo.layer;
  simState.atmosphericDensity = atmo.density;
  simState.atmosphericDrag = atmo.drag;

  // --- Mission Phase & Deep Space Trajectory ---
  if (isHumanLunar) {
    const day = store.missionDay;
    if (day < 0.1) {
      simState.phaseDesc = 'Earth Parking Orbit (LEO 650 km)';
      simState.distanceFromEarthKm = 650;
      simState.altitude = 650;
    } else if (day < 3.2) {
      simState.phaseDesc = 'Cislunar Transit (TLI Trajectory)';
      simState.distanceFromEarthKm = Math.min(384400, 650 + (day / 3.2) * 383750);
      simState.velocity = clamp(10.92 - (day / 3.2) * 8.5, 1.2, 11);
      simState.altitude = simState.distanceFromEarthKm;
    } else if (day < 4.5) {
      simState.phaseDesc = 'Lunar Orbit Insertion (LOI · 100 km)';
      simState.distanceFromEarthKm = 384400;
      simState.velocity = 1.63;
      simState.altitude = 100;
    } else if (day < 13.0) {
      simState.phaseDesc = 'Lunar Surface Operations (South Pole Base)';
      simState.distanceFromEarthKm = 384400;
      simState.velocity = 0;
      simState.altitude = 0;
    } else if (day < 16.5) {
      simState.phaseDesc = 'Trans-Earth Return Trajectory (TEI)';
      simState.distanceFromEarthKm = Math.max(650, 384400 - ((day - 13.0) / 3.5) * 383750);
      simState.velocity = clamp(1.6 + ((day - 13.0) / 3.5) * 9.4, 1.6, 11.2);
      simState.altitude = simState.distanceFromEarthKm;
    } else {
      simState.phaseDesc = 'Atmospheric Entry & Recovery Phase';
      simState.distanceFromEarthKm = 0;
      simState.velocity = 0.05;
      simState.altitude = 0;
    }
  } else {
    simState.phaseDesc = `Nominal Orbit · ${simState.atmosphericLayer} (${simState.altitude.toFixed(0)} km)`;
    simState.distanceFromEarthKm = simState.altitude;
  }

  // --- Real-Time Power & Day/Night Orbital Eclipse ---
  const inSunlight = Math.sin(orbitAngle) > -0.25;
  const baseSolar = inSunlight ? 260 + noise(15) : 0;
  simState.solar = Math.max(0, baseSolar);
  
  // Power budget
  const netPower = (simState.solar - simState.consumption) / 120;
  simState.battery = clamp(simState.battery + (netPower > 0 ? 0.06 : -0.05) * dt, 5, 100);
  simState.voltage = clamp(24.2 + (simState.battery / 100) * 8.4 + noise(0.06), 18.0, 34.0);
  simState.current = clamp((simState.consumption / Math.max(1, simState.voltage)) + noise(0.08), 0.5, 20.0);

  // --- Real-Time Thermal Dynamics ---
  const targetCpu = 38 + (simState.cpu / 100) * 20 + (inSunlight ? 8 : -5);
  simState.cpuTemp = lerp(simState.cpuTemp, targetCpu, 0.02) + noise(0.12);
  const targetBat = 16 + (inSunlight ? 7 : -5);
  simState.batteryTemp = lerp(simState.batteryTemp, targetBat, 0.015) + noise(0.06);
  simState.payloadTemp = lerp(simState.payloadTemp, 28 + (inSunlight ? 10 : -7), 0.015) + noise(0.08);
  simState.extTemp = inSunlight ? 118 + noise(4) : -88 + noise(4);

  // --- Real-Time ADCS Attitude Kinematics ---
  simState.roll = lerp(simState.roll, 0.1, 0.05) + noise(0.03);
  simState.pitch = lerp(simState.pitch, -0.05, 0.05) + noise(0.03);
  simState.yaw = lerp(simState.yaw, 0.02, 0.05) + noise(0.02);
  simState.angularVel = (Math.abs(simState.roll) + Math.abs(simState.pitch) + Math.abs(simState.yaw)) * 0.02;
  simState.reactionWheel = clamp(3200 + noise(40), 1000, 6500);

  // --- Real-Time Communications Telemetry ---
  const isDeep = simState.distanceFromEarthKm > 50000;
  simState.signal = clamp(-72 - (isDeep ? 18 : 0) + noise(2.2), -120, -40);
  simState.dataRate = clamp((isDeep ? 4.2 : 8.4) + noise(0.5), 0.1, 100);
  simState.latency = clamp((isDeep ? 1280 : 340) + noise(18), 50, 5000);
  simState.commUptime = clamp(simState.commUptime + noise(0.02), 85, 100);

  // --- Real-Time Avionics Compute Load ---
  simState.cpu = clamp(32 + noise(3.5), 5, 98);
  simState.memory = clamp(48 + noise(1.2), 20, 92);
  simState.storage = clamp(simState.storage + 0.0001 * dt, 0, 100);

  // Apply live space threats & anomalies
  const affected = applyThreatEffects(simState);

  // Health restoration when threats cleared
  if (Object.keys(threatEffects).length === 0) {
    simState.health = clamp(simState.health + 0.03 * dt, 0, 100);
  }

  // Tick crew vitals for human missions
  const updatedCrew = tickCrewVitals(store.crew || [], store.missionDay, store.environment.radiationLevel);

  const healthStatus = affected.health > 70 ? 'nominal'
    : affected.health > 40 ? 'warning'
    : affected.health > 10 ? 'critical' : 'failed';

  return {
    missionDay: store.missionDay,
    timestamp: Date.now(),
    power: {
      batteryPercent: clamp(affected.battery, 0, 100),
      voltageV: clamp(affected.voltage, 0, 40),
      currentA: clamp(affected.current, 0, 20),
      solarGenerationW: clamp(affected.solar, 0, 500),
      consumptionW: affected.consumption,
    },
    thermal: {
      cpuTempC: affected.cpuTemp,
      batteryTempC: affected.batteryTemp,
      payloadTempC: affected.payloadTemp,
      externalTempC: affected.extTemp,
    },
    attitude: {
      rollDeg: affected.roll,
      pitchDeg: affected.pitch,
      yawDeg: affected.yaw,
      angularVelDegS: affected.angularVel,
      reactionWheelRpm: affected.reactionWheel,
    },
    comm: {
      signalDbm: affected.signal,
      dataRateMbps: clamp(affected.dataRate, 0, 100),
      packetsPerSec: 240 + Math.round(noise(12)),
      latencyMs: clamp(affected.latency, 0, 5000),
      uptime: clamp(affected.commUptime, 0, 100),
    },
    compute: {
      cpuPercent: clamp(affected.cpu, 0, 100),
      memoryPercent: clamp(affected.memory, 0, 100),
      storagePercent: clamp(affected.storage, 0, 100),
    },
    orbit: {
      altitudeKm: affected.altitude,
      velocityKms: affected.velocity,
      accelerationMs2: affected.acceleration,
      gForce: affected.gForce,
      latitudeDeg: affected.lat,
      longitudeDeg: affected.lng,
      inclinationDeg: affected.inclination,
      periodMin: affected.period,
      apogeeKm: affected.altitude + 8,
      perigeeKm: affected.altitude - 8,
      semiMajorAxisKm: affected.semiMajorAxis,
      eccentricity: affected.eccentricity,
      trueAnomalyDeg: affected.trueAnomaly,
      phaseDesc: affected.phaseDesc,
      distanceFromEarthKm: affected.distanceFromEarthKm,
      atmosphericLayer: affected.atmosphericLayer,
      atmosphericDensityKgM3: affected.atmosphericDensity,
      atmosphericDragN: affected.atmosphericDrag,
    },
    crew: updatedCrew,
    overallHealth: clamp(affected.health + noise(0.5), 0, 100),
    healthStatus,
    dataSource: 'simulation',
  };
}

// --- VYOM Multi-Step AI Reasoning Pipeline ---
function launchAIPipeline(threat: ThreatScenario) {
  const store = useMissionStore.getState();
  if (aiPipelineTimer) return; // already in flight

  const startTime = Date.now();
  currentAiSteps = [
    { step: 1, phase: 'ingesting', title: 'Telemetry Ingestion & Sensor Anomaly Isolation', detail: `Extracting z-score sensor variance: ${threat.name}. Bus voltage, temperature, and attitude deltas isolated.`, status: 'running', confidence: 99.4, timestamp: startTime },
    { step: 2, phase: 'diagnosing', title: 'Diagnostic Neural Root-Cause Classification', detail: `Feedforward transformer classifier evaluating single-event upsets & physical subsystem stress.`, status: 'pending', confidence: 96.8, timestamp: startTime + 3000 },
    { step: 3, phase: 'predicting', title: 'Monte Carlo Failure Projection (5,000 runs)', detail: `Simulating catastrophic subsystem cascade risk: 88.4% probability within 6.2 minutes without intervention.`, status: 'pending', confidence: 94.2, timestamp: startTime + 6000 },
    { step: 4, phase: 'optimizing', title: 'Multi-Strategy Autonomous Countermeasure Optimization', detail: `Evaluating 4 recovery pathways. Optimal sequence selected: power rerouting, RCS reaction damping & thermal pump override.`, status: 'pending', confidence: 98.1, timestamp: startTime + 9000 },
    { step: 5, phase: 'executing', title: 'Step-by-Step Command Execution & Closed-Loop Verification', detail: `Broadcasting encrypted OBC command sequence. Telemetry stabilization confirmed.`, status: 'pending', confidence: 99.8, timestamp: startTime + 12000 },
  ];

  const updateAIState = (phaseIndex: number, riskLevel: AIAnalysis['riskLevel']) => {
    currentAiSteps = currentAiSteps.map((s, idx) => ({
      ...s,
      status: idx < phaseIndex ? 'complete' : idx === phaseIndex ? 'running' : 'pending',
    }));

    const activeStep = currentAiSteps[Math.min(phaseIndex, currentAiSteps.length - 1)];
    const ai: AIAnalysis = {
      phase: activeStep.phase as any,
      anomalyDetected: phaseIndex < 4,
      anomalyDescription: `${threat.name} — ${threat.description}`,
      predictedFailure: threat.type === 'solar-storm' ? 'Radiation exposure & communication blackout'
        : threat.type === 'power-failure' ? 'Life support & bus voltage collapse'
        : 'Subsystem degradation',
      probability: phaseIndex >= 4 ? 0.05 : 0.88,
      timeToFailureMin: phaseIndex >= 4 ? 0 : 6.2,
      recommendedAction: threat.type === 'solar-storm' ? 'Direct crew to radiation shelter · Angle solar arrays edge-on to flux'
        : threat.type === 'power-failure' ? 'Engage redundant fuel cells · Shed auxiliary payload power'
        : 'Execute autonomous attitude dampening & thermal shunt valve activation',
      confidence: activeStep.confidence,
      riskLevel,
      dataSource: 'ai-prediction',
      reasoningSteps: [...currentAiSteps],
      neuralActivations: [0.94, 0.88, 0.96, 0.72, 0.99, 0.85],
      monteCarloRuns: 5000,
      selectedStrategy: 'Autonomous Multi-Subsystem Closed-Loop Recovery Sequence α-4',
      recoverySecondsRemaining: Math.max(0, 15 - phaseIndex * 3),
    };
    store.setAIAnalysis(ai);
  };

  // Step 1: Ingesting
  updateAIState(0, 'critical');
  const action: AutonomousAction = {
    id: `action-${Date.now()}`,
    triggeredAt: Date.now(),
    type: threat.type,
    description: `Autonomous Multi-Phase Mitigation: ${threat.name}`,
    status: 'executing',
  };
  store.addAction(action);

  store.logEvent({
    id: `ev-ai-init-${Date.now()}`,
    timestamp: Date.now(),
    missionDay: store.missionDay,
    eventType: 'ai',
    severity: 'warning',
    description: `VYOM AI: Initiated 5-Phase Diagnostic & Countermeasure Pipeline for ${threat.name}.`,
    source: 'VYOM Autonomous Kernel',
    immutable: true,
  });

  // Step 2: Diagnosing (at 3s)
  setTimeout(() => updateAIState(1, 'critical'), 3000);

  // Step 3: Predicting (at 6s)
  setTimeout(() => updateAIState(2, 'high'), 6000);

  // Step 4: Optimizing (at 9s)
  setTimeout(() => updateAIState(3, 'medium'), 9000);

  // Step 5: Executing & Verifying (at 12s)
  setTimeout(() => {
    updateAIState(4, 'low');
    store.completeAction(action.id, 'Countermeasures deployed successfully · Telemetry nominal');
    store.mitigateThreat(threat.id);
    threatEffects = {};
    simState.health = Math.min(simState.health + 20, 100);

    store.logEvent({
      id: `ev-ai-recovered-${Date.now()}`,
      timestamp: Date.now(),
      missionDay: store.missionDay,
      eventType: 'recovery',
      severity: 'nominal',
      description: `Recovery verified. All sensor parameters converged within nominal operating envelope.`,
      source: 'VYOM Autonomous Kernel',
      immutable: true,
    });
  }, 12000);

  // Complete (at 16s)
  setTimeout(() => {
    currentAiSteps = currentAiSteps.map((s) => ({ ...s, status: 'complete' }));
    store.setAIAnalysis({
      phase: 'monitoring',
      anomalyDetected: false,
      anomalyDescription: '',
      predictedFailure: '',
      probability: 0,
      timeToFailureMin: 0,
      recommendedAction: '',
      confidence: 99.9,
      riskLevel: 'low',
      dataSource: 'ai-prediction',
      reasoningSteps: currentAiSteps,
      neuralActivations: [0.1, 0.05, 0.08, 0.02, 0.04, 0.01],
      monteCarloRuns: 5000,
      selectedStrategy: 'Systems Nominal',
      recoverySecondsRemaining: 0,
    });
    aiPipelineTimer = null;
  }, 16000);

  aiPipelineTimer = true;
}

function tickAI() {
  const store = useMissionStore.getState();
  const t = store.telemetry;
  if (!t) return;

  const hasThreats = store.activeThreats.length > 0;
  if (hasThreats && store.controlMode === 'autonomous' && !aiPipelineTimer) {
    launchAIPipeline(store.activeThreats[0]);
  }
}

function tickObjective() {
  const store = useMissionStore.getState();
  const { missionDay, milestones, status, totalMissionDurationDays } = store;
  if (status !== 'active' && status !== 'threatened' && status !== 'recovering') return;

  if (milestones.length === 0) return;

  let completedCount = 0;
  for (const m of milestones) {
    if (m.completed) {
      completedCount++;
    } else if (missionDay >= m.requiresDays) {
      store.completeMilestone(m.id);
      completedCount++;
      const event: BlackBoxEvent = {
        id: `ev-milestone-${m.id}-${Date.now()}`,
        timestamp: Date.now(),
        missionDay,
        eventType: 'milestone',
        severity: 'nominal',
        description: `Mission Milestone Completed: ${m.label}`,
        source: 'Flight Dynamics Officer',
        immutable: true,
      };
      store.logEvent(event);
    }
  }

  // OBJECTIVE PROGRESS = pure milestone completion percentage
  const milestonePct = Math.round((completedCount / milestones.length) * 100);
  store.setObjectiveProgress(milestonePct);

  // Auto mission-complete: all milestones done, OR elapsed days exceeded planned duration
  const allDone = completedCount >= milestones.length;
  const timeExpired = totalMissionDurationDays > 0 && missionDay >= totalMissionDurationDays;

  if ((allDone || timeExpired) && status === 'active') {
    // Log privacy-safe farewell event
    const farewellEvent: BlackBoxEvent = {
      id: `ev-farewell-${Date.now()}`,
      timestamp: Date.now(),
      missionDay,
      eventType: 'milestone',
      severity: 'nominal',
      description: allDone
        ? `MISSION COMPLETE — All ${milestones.length} mission objectives achieved at Day ${missionDay.toFixed(1)}. The astronaut team has successfully completed the mission. Farewell sequence initiated.`
        : `MISSION COMPLETE — Planned mission duration of ${totalMissionDurationDays} days reached at Day ${missionDay.toFixed(1)}. The astronaut team has completed all assigned operations. Farewell sequence initiated.`,
      source: 'Mission Control',
      immutable: true,
    };
    store.logEvent(farewellEvent);
    store.setObjectiveProgress(100);
    store.completeMission();
  }
}

function tickEnvironment() {
  const store = useMissionStore.getState();
  const day = store.missionDay;
  const solarCycle = Math.sin(day / 30) * 0.5 + 0.5;
  const solarLevel = 1.5 + solarCycle * 3.5 + noise(0.2);
  const classification = solarLevel > 7 ? 'critical'
    : solarLevel > 4.5 ? 'warning'
    : solarLevel > 2 ? 'normal' : 'low';

  store.setEnvironment({
    solarActivityLevel: clamp(solarLevel, 0, 10),
    radiationLevel: clamp(10 + solarLevel * 5 + noise(2), 5, 100),
    magneticFieldNT: Math.round(30000 + noise(1000)),
    temperatureRangeC: [-90 - Math.round(solarLevel * 2), 120 + Math.round(solarLevel * 5)],
    debrisDensity: clamp(1.2 + noise(0.3), 0.1, 10),
    classification,
    dataSource: 'simulation',
  });
}

export function setThreatEffects(effects: Record<string, number>) {
  threatEffects = effects;
}

export function clearThreatEffects() {
  threatEffects = {};
}

export function triggerThreat(type: string, name: string, description: string, effects: Record<string, number>) {
  const store = useMissionStore.getState();
  const threat: ThreatScenario = {
    id: `threat-${Date.now()}`,
    type: type as any,
    name,
    description,
    active: true,
    severity: 'critical',
    startedAt: Date.now(),
    effects,
  };
  store.addThreat(threat);
  setThreatEffects(effects);

  const event: BlackBoxEvent = {
    id: `ev-threat-${Date.now()}`,
    timestamp: Date.now(),
    missionDay: store.missionDay,
    eventType: 'threat',
    severity: 'critical',
    description: `THREAT DETECTED: ${name} — ${description}`,
    source: 'Threat Warning System',
    immutable: true,
  };
  store.logEvent(event);
}

function onClockTick(payload: { realDelta: number; simDelta: number; simDays: number; tickCount: number }) {
  if (backendWS.isConnected) return;
  const store = useMissionStore.getState();

  const telemetry = tickTelemetry(payload.simDelta);
  store.pushTelemetry(telemetry);

  if (payload.tickCount % 30 === 0) {
    const pt: OrbitPoint = {
      lat: telemetry.orbit.latitudeDeg,
      lng: telemetry.orbit.longitudeDeg,
      alt: telemetry.orbit.altitudeKm,
      timestamp: Date.now(),
    };
    store.pushOrbitPoint(pt);
  }

  // Push crew vitals history every 10 ticks for chart data
  if (payload.tickCount % 10 === 0 && telemetry.crew && telemetry.crew.length > 0) {
    const now = Date.now();
    for (const member of telemetry.crew) {
      store.pushCrewVitalSample(member.id, {
        missionDay: store.missionDay,
        timestamp: now,
        heartRateBpm: member.heartRateBpm,
        spo2Percent: member.spo2Percent,
        respirationBpm: member.respirationBpm,
        coreTempC: member.coreTempC,
        stressIndex: member.stressIndex,
        fatigueIndex: member.fatigueIndex ?? 0,
        hydrationPercent: member.hydrationPercent ?? 75,
        radiationDoseMsv: member.radiationDoseMsv,
        bloodPressureSys: member.bloodPressureSys,
        bloodPressureDia: member.bloodPressureDia,
        workloadIndex: member.workloadIndex,
      });
    }
  }

  if (payload.tickCount % 30 === 0) tickAI();
  if (payload.tickCount % 120 === 0) tickObjective();
  if (payload.tickCount % 300 === 0) tickEnvironment();
}

export function startSimulationEngine() {
  // Legacy no-op: MissionClockEngine (started in initializeEngines) is now the single simulation clock.
}

export function stopSimulationEngine() {
  // Legacy no-op: MissionClockEngine manages the single rAF clock.
}

eventBus.subscribe('CLOCK_TICK', onClockTick);
