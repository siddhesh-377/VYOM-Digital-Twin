import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type {
  MissionState, AppScreen, MissionConfig, SatelliteConfig, Telemetry,
  ThreatScenario, BlackBoxEvent, OrbitPoint, AIAnalysis, AutonomousAction,
  SpaceEnvironment, MissionObjectiveMilestone, ArchivedMission, ControlMode,
  DispositionType, MissionStats, MissionType, CrewMember, MissionDestination,
  CrewVitalSample, Incident
} from '../types/mission';
import { MISSION_PROFILES } from '../types/missionProfiles';

const defaultEnvironment: SpaceEnvironment = {
  solarActivityLevel: 2.4,
  radiationLevel: 14,
  magneticFieldNT: 31200,
  temperatureRangeC: [-90, 120],
  debrisDensity: 1.2,
  classification: 'normal',
  dataSource: 'simulation',
};

const defaultAI: AIAnalysis = {
  phase: 'monitoring',
  anomalyDetected: false,
  anomalyDescription: '',
  predictedFailure: '',
  probability: 0,
  timeToFailureMin: 0,
  recommendedAction: '',
  confidence: 0,
  riskLevel: 'low',
  dataSource: 'ai-prediction',
};

const defaultStats: MissionStats = {
  totalDistanceKm: 0,
  dataCollectedGB: 0,
  threatsEncountered: 0,
  aiInterventions: 0,
  maxHealth: 100,
  minHealth: 98,
  commUptimePercent: 100,
  orbitsCompleted: 0,
};

/**
 * Merge backend crew health snapshots (snake_case, keyed by role) into the
 * local CrewMember roster without losing local identity fields. All merged
 * physiological values are SIMULATED estimates from the backend engine.
 */
function mergeBackendCrew(local: CrewMember[], backend: any): CrewMember[] {
  if (!Array.isArray(backend) || backend.length === 0) return local;
  return local.map((member) => {
    const snap =
      backend.find((b: any) => (b.role ?? '').toLowerCase() === member.role.toLowerCase()) ??
      backend.find((b: any) => (b.name ?? '').toLowerCase() === member.name.toLowerCase());
    if (!snap) return member;
    const isEva = Boolean(snap.is_eva);
    return {
      ...member,
      heartRateBpm: Math.round(snap.heart_rate_bpm ?? member.heartRateBpm),
      spo2Percent: Math.round((snap.spo2_percent ?? member.spo2Percent) * 10) / 10,
      respirationBpm: Math.round(snap.respiratory_rate_bpm ?? member.respirationBpm),
      coreTempC: Math.round((snap.temperature_c ?? member.coreTempC) * 10) / 10,
      suitPressureKpa: Math.round((snap.suit_pressure_kpa ?? member.suitPressureKpa) * 10) / 10,
      radiationDoseMsv: Math.round((snap.radiation_dose_msv ?? member.radiationDoseMsv) * 1000) / 1000,
      stressIndex: Math.round(snap.stress ?? member.stressIndex),
      status: isEva ? 'eva' : (member.status === 'eva' ? 'nominal' : member.status),
      activity: snap.activity ?? member.activity,
      // v3.0 extended simulated vitals
      bloodPressureSys: Math.round(snap.blood_pressure_sys ?? 0) || undefined,
      bloodPressureDia: Math.round(snap.blood_pressure_dia ?? 0) || undefined,
      fatigueIndex: Math.round(snap.fatigue ?? 0),
      hydrationPercent: Math.round(snap.hydration ?? 0),
      o2ExposureKpa: Math.round((snap.o2_exposure_kpa ?? 0) * 10) / 10 || undefined,
      co2ExposurePpm: Math.round(snap.co2_exposure_ppm ?? 0) || undefined,
      workloadIndex: Math.round(snap.workload ?? 0),
      evaDurationMin: Math.round(snap.eva_duration_min ?? 0),
      location: snap.location ?? (isEva ? 'EVA — Outside Spacecraft' : 'Command Module'),
      spacecraftModule: snap.spacecraft_module ?? 'CM',
      currentTask: snap.activity ?? member.activity,
      taskDurationMin: Math.round(snap.task_duration_min ?? 0),
      checklistStatus: snap.checklist_status ?? 'in-progress',
      commStatus: snap.comm_status ?? 'nominal',
      tetherStatus: isEva ? (snap.tether_status ?? 'attached') : undefined,
      dataQuality: snap.data_quality ?? 'simulated',
    } as CrewMember;
  });
}

export const defaultCrew: CrewMember[] = [
  {
    id: 'c1',
    name: 'Capt. Rajesh Sharma',
    role: 'Commander',
    heartRateBpm: 72,
    spo2Percent: 99.1,
    respirationBpm: 14,
    coreTempC: 36.8,
    suitPressureKpa: 101.3,
    radiationDoseMsv: 0.12,
    stressIndex: 18,
    status: 'nominal',
    activity: 'Flight Control & Trajectory Monitoring',
  },
  {
    id: 'c2',
    name: 'Dr. Sunita Patel',
    role: 'Lunar Module Pilot',
    heartRateBpm: 76,
    spo2Percent: 98.8,
    respirationBpm: 15,
    coreTempC: 37.0,
    suitPressureKpa: 101.3,
    radiationDoseMsv: 0.14,
    stressIndex: 22,
    status: 'nominal',
    activity: 'Lunar Descent & Landing Navigation Check',
  },
  {
    id: 'c3',
    name: 'Cmdr. Vikram Malhotra',
    role: 'Flight Engineer',
    heartRateBpm: 68,
    spo2Percent: 99.4,
    respirationBpm: 13,
    coreTempC: 36.7,
    suitPressureKpa: 101.3,
    radiationDoseMsv: 0.11,
    stressIndex: 15,
    status: 'nominal',
    activity: 'ECLSS Life Support & Power Distribution',
  },
  {
    id: 'c4',
    name: 'Dr. Elena Rostova',
    role: 'Medical Officer',
    heartRateBpm: 70,
    spo2Percent: 99.0,
    respirationBpm: 14,
    coreTempC: 36.9,
    suitPressureKpa: 101.3,
    radiationDoseMsv: 0.13,
    stressIndex: 19,
    status: 'nominal',
    activity: 'Crew Physiological & Radiation Monitoring',
  },
];

const defaultTelemetry: Telemetry = {
  missionDay: 0.1,
  timestamp: Date.now(),
  power: {
    batteryPercent: 96.4,
    voltageV: 28.6,
    currentA: 4.2,
    solarGenerationW: 240,
    consumptionW: 120,
  },
  thermal: {
    cpuTempC: 41.8,
    batteryTempC: 18.2,
    payloadTempC: 32.5,
    externalTempC: -15.0,
  },
  attitude: {
    rollDeg: 0.12,
    pitchDeg: -0.08,
    yawDeg: 0.04,
    angularVelDegS: 0.01,
    reactionWheelRpm: 3240,
  },
  comm: {
    signalDbm: -72.0,
    dataRateMbps: 8.4,
    packetsPerSec: 240,
    latencyMs: 340,
    uptime: 100,
  },
  compute: {
    cpuPercent: 32.0,
    memoryPercent: 48.0,
    storagePercent: 12.5,
  },
  orbit: {
    altitudeKm: 650.0,
    velocityKms: 7.56,
    accelerationMs2: 8.09,
    gForce: 0.825,
    latitudeDeg: 13.72,
    longitudeDeg: 80.23,
    inclinationDeg: 51.6,
    periodMin: 97.5,
    apogeeKm: 658,
    perigeeKm: 642,
    semiMajorAxisKm: 7021.0,
    eccentricity: 0.0012,
    trueAnomalyDeg: 45.0,
    phaseDesc: 'LEO Parking Orbit',
    distanceFromEarthKm: 650,
    atmosphericLayer: 'Exosphere',
    atmosphericDensityKgM3: 1.4e-13,
    atmosphericDragN: 0.0004,
  },
  crew: defaultCrew,
  overallHealth: 98.5,
  healthStatus: 'nominal',
  dataSource: 'simulation',
};

const defaultConfig: MissionConfig = {
  id: 'CHANDRAYAAN-HUMAN-1',
  name: 'CHANDRAYAAN-CREW-1',
  type: 'human',
  destination: 'lunar-surface',
  objective: 'Human Lunar Landing, South Pole Shackleton Crater Exploration & Surface Habitat Deployment',
  budgetCrore: 850,
  launchSite: {
    name: 'Satish Dhawan Space Centre (SLP)',
    country: 'India',
    lat: 13.72,
    lng: 80.23,
    agency: 'ISRO',
  },
  crew: defaultCrew,
  createdAt: Date.now(),
};

const defaultSatellite: SatelliteConfig = {
  type: 'Crewed Lunar Exploration Module & Service Bus',
  body: 'Pressurized command module + ascent module with deployable GaAs solar arrays',
  solarPanels: 4,
  batteryCapacityWh: 8000,
  antennaGainDb: 38,
  payloadType: 'Crew life support (ECLSS), Lunar Surface Rover, Seismic Array & Sample Return',
  propulsionType: 'Hypergolic bipropellant descent engine + dual redundant RCS',
  thermalControl: 'Active liquid ammonia coolant loop + deployable radiators',
  redundancy: 3,
  subsystems: [
    { name: 'Life Support (ECLSS)', health: 100, status: 'nominal', temperature: 21.0 },
    { name: 'Power & Fuel Cells', health: 100, status: 'nominal', temperature: 18.2 },
    { name: 'Descent Propulsion', health: 100, status: 'nominal', temperature: 24.5 },
    { name: 'ADCS & Guidance', health: 100, status: 'nominal', temperature: 34.8 },
    { name: 'Deep Space Comms', health: 100, status: 'nominal', temperature: 28.0 },
    { name: 'Lunar Surface Suite', health: 100, status: 'nominal', temperature: 22.5 },
    { name: 'On-Board Computer', health: 100, status: 'nominal', temperature: 39.8 },
  ],
  dataSource: 'model-estimate',
};

interface MissionStore extends MissionState {
  setScreen: (screen: AppScreen) => void;
  setMissionConfig: (config: MissionConfig) => void;
  setSatelliteConfig: (sat: SatelliteConfig) => void;
  setCrew: (crew: CrewMember[]) => void;
  updateCrewMember: (id: string, partial: Partial<CrewMember>) => void;
  setEstimates: (lifetime: number, reliability: number, reserve: number) => void;
  startMission: () => void;
  pushTelemetry: (t: Telemetry) => void;
  setEnvironment: (env: SpaceEnvironment) => void;
  addThreat: (threat: ThreatScenario) => void;
  mitigateThreat: (id: string) => void;
  setAIAnalysis: (ai: AIAnalysis) => void;
  addAction: (action: AutonomousAction) => void;
  completeAction: (id: string, result: string) => void;
  setControlMode: (mode: ControlMode) => void;
  setObjectiveProgress: (pct: number) => void;
  completeMilestone: (id: string) => void;
  logEvent: (event: BlackBoxEvent) => void;
  pushOrbitPoint: (pt: OrbitPoint) => void;
  setTimeMultiplier: (m: number) => void;
  pauseMission: () => void;
  resumeMission: () => void;
  resetSimulation: () => void;
  pushCrewVitalSample: (memberId: string, sample: CrewVitalSample) => void;
  tickMission: (realDeltaMs: number) => void;
  updateStats: (partial: Partial<MissionStats>) => void;
  completeMission: () => void;
  warpToCompletion: () => void;
  setDisposition: (d: DispositionType) => void;
  archiveMission: () => void;
  loadArchivedMission: (id: string) => void;
  resetMission: () => void;
  setMissionProfile: (profileKey: 'human' | 'orbital' | 'planetary' | 'astrophysics') => void;
  updateTelemetry: (t: Telemetry) => void;
  setSelectedSubsystem: (subsystem: string | null) => void;
  addIncident: (incident: Incident) => void;
  updateIncident: (id: string, partial: Partial<Incident>) => void;
  setTelemetryState: (state: 'LIVE' | 'SIMULATED' | 'REPLAY' | 'STALE' | 'DISCONNECTED') => void;
}

const initialState: MissionState = {
  config: defaultConfig,
  satellite: defaultSatellite,
  status: 'active',
  missionPhase: 'operations',
  controlMode: 'autonomous',
  screen: 'welcome',
  missionDay: 0.1,
  missionStartTime: Date.now(),
  timeMultiplier: 1,
  isPaused: false,
  totalMissionDurationDays: 17,   // default: last milestone day for human mission
  elapsedRealMs: 0,
  estimatedLifetimeYears: 1.5,
  reliabilityPercent: 99.2,
  resourceReservePercent: 94,
  rulDays: 547.5,
  telemetry: defaultTelemetry,
  telemetryHistory: [defaultTelemetry],
  crew: defaultCrew,
  crewVitalsHistory: {},
  environment: defaultEnvironment,
  activeThreats: [],
  threatHistory: [],
  incidents: [],
  dailySummaries: [],
  aiAnalysis: defaultAI,
  pendingActions: [],
  completedActions: [],
  objectiveProgress: 5,
  milestones: [
    { id: 'm1', label: 'Trans-Lunar Injection (TLI) Burn Complete', completed: true, requiresDays: 0.05 },
    { id: 'm2', label: 'Cislunar Transit & Systems Calibration', completed: true, requiresDays: 0.1 },
    { id: 'm3', label: 'Lunar Orbit Insertion (LOI)', completed: false, requiresDays: 3 },
    { id: 'm4', label: 'Lunar Module Undocking & Powered Descent', completed: false, requiresDays: 4 },
    { id: 'm5', label: 'Lunar Touchdown & First Crew Surface EVA', completed: false, requiresDays: 5 },
    { id: 'm6', label: 'In-Situ Lunar Resource Survey Complete', completed: false, requiresDays: 10 },
    { id: 'm7', label: 'Lunar Ascent & Trans-Earth Injection (TEI)', completed: false, requiresDays: 14 },
    { id: 'm8', label: 'Atmospheric Re-entry & Earth Recovery', completed: false, requiresDays: 17 },
  ],
  blackBox: [
    {
      id: 'ev-init',
      timestamp: Date.now() - 60000,
      missionDay: 0,
      eventType: 'milestone',
      severity: 'nominal',
      description: 'CHANDRAYAAN-CREW-1 Mission Control online. 4 crew members reporting nominal vitals.',
      source: 'Crew Health System',
      immutable: true,
    },
    {
      id: 'ev-tli',
      timestamp: Date.now() - 30000,
      missionDay: 0.05,
      eventType: 'milestone',
      severity: 'nominal',
      description: 'Trans-Lunar Injection burn verified. Velocity 10.92 km/s. En route to Moon.',
      source: 'Guidance & Navigation',
      immutable: true,
    },
  ],
  orbitTrail: [
    { lat: 13.72, lng: 80.23, alt: 650, timestamp: Date.now() - 60000 },
  ],
  stats: defaultStats,
  disposition: null,
  archivedMissions: [],
  replayEvents: [],
  replayPosition: 0,
  dataMode: 'simulation',
  selectedSubsystem: null,
  telemetryState: 'SIMULATED',
};

export const useMissionStore = create<MissionStore>()(
  persist(
    (set, get) => ({
      ...initialState,

      setScreen: (screen) => set({ screen }),

      setMissionConfig: (config) => {
        const crewToSet = config.crew && config.crew.length > 0 ? config.crew : defaultCrew;
        set({ config: { ...config, crew: crewToSet }, crew: crewToSet, status: 'configuring' });
      },

      setSatelliteConfig: (satellite) => set({ satellite }),

      setCrew: (crew) => set({ crew }),

      updateCrewMember: (id, partial) =>
        set((s) => ({
          crew: s.crew.map((c) => (c.id === id ? { ...c, ...partial } : c)),
        })),

      setEstimates: (estimatedLifetimeYears, reliabilityPercent, resourceReservePercent) =>
        set({ estimatedLifetimeYears, reliabilityPercent, resourceReservePercent }),

      startMission: () => {
        const cfg = get().config;
        const type = cfg?.type ?? 'human';
        const destination = cfg?.destination ?? 'lunar-surface';
        const milestones = buildMilestones(type, destination);
        const crewRoster = cfg?.crew && cfg.crew.length > 0 ? cfg.crew : defaultCrew;
        const lastMilestoneDay = milestones.reduce((max, m) => Math.max(max, m.requiresDays), 17);
        const totalDays = lastMilestoneDay + 2; // 2-day buffer after final milestone

        set({
          status: 'active',
          missionStartTime: Date.now(),
          missionDay: 0,
          isPaused: false,
          totalMissionDurationDays: totalDays,
          crew: crewRoster,
          crewVitalsHistory: {},
          milestones,
          blackBox: [
            {
              id: `ev-launch-${Date.now()}`,
              timestamp: Date.now(),
              missionDay: 0,
              eventType: 'milestone',
              severity: 'nominal',
              description: `Mission "${cfg?.name ?? 'VYOM-MISSION'}" successfully launched from ${cfg?.launchSite?.name ?? 'Sriharikota'}. Destination: ${destination.toUpperCase().replace('-', ' ')}. Human spaceflight crew aboard.`,
              source: 'Mission Launch Operations',
              immutable: true,
            },
          ],
          orbitTrail: [{ lat: cfg?.launchSite?.lat ?? 13.72, lng: cfg?.launchSite?.lng ?? 80.23, alt: 650, timestamp: Date.now() }],
          telemetryHistory: [defaultTelemetry],
          activeThreats: [],
          completedActions: [],
          pendingActions: [],
          stats: { ...defaultStats },
          objectiveProgress: 2,
        });
      },

      pushTelemetry: (t) =>
        set((s) => ({
          telemetry: t,
          telemetryHistory: [...s.telemetryHistory.slice(-500), t],
          crew: mergeBackendCrew(s.crew, t.crew),
          stats: {
            ...s.stats,
            maxHealth: Math.max(s.stats.maxHealth, t.overallHealth),
            minHealth: Math.min(s.stats.minHealth, t.overallHealth),
            totalDistanceKm: s.stats.totalDistanceKm + (t.orbit.velocityKms * (0.016 * s.timeMultiplier)),
          },
        })),

      setEnvironment: (environment) => set({ environment }),

      addThreat: (threat) =>
        set((s) => ({
          activeThreats: [...s.activeThreats, threat],
          status: 'threatened',
          stats: { ...s.stats, threatsEncountered: s.stats.threatsEncountered + 1 },
        })),

      mitigateThreat: (id) =>
        set((s) => {
          const threat = s.activeThreats.find((t) => t.id === id);
          if (!threat) return {};
          const mitigated = { ...threat, active: false, mitigatedAt: Date.now() };
          const remaining = s.activeThreats.filter((t) => t.id !== id);
          return {
            activeThreats: remaining,
            threatHistory: [...s.threatHistory, mitigated],
            status: remaining.length === 0 ? 'active' : s.status,
          };
        }),

      setAIAnalysis: (aiAnalysis) => set({ aiAnalysis }),

      addAction: (action) =>
        set((s) => ({
          pendingActions: [...s.pendingActions, action],
          stats: { ...s.stats, aiInterventions: s.stats.aiInterventions + 1 },
        })),

      completeAction: (id, result) =>
        set((s) => {
          const action = s.pendingActions.find((a) => a.id === id);
          if (!action) return {};
          const completed = { ...action, status: 'completed' as const, result };
          return {
            pendingActions: s.pendingActions.filter((a) => a.id !== id),
            completedActions: [...s.completedActions, completed],
          };
        }),

      setControlMode: (controlMode) => set({ controlMode }),

      setObjectiveProgress: (objectiveProgress) => set({ objectiveProgress: isNaN(objectiveProgress) ? 0 : objectiveProgress }),

      completeMilestone: (id) =>
        set((s) => ({
          milestones: s.milestones.map((m) =>
            m.id === id ? { ...m, completed: true, completedAt: Date.now() } : m
          ),
        })),

      logEvent: (event) =>
        set((s) => {
          if (s.blackBox.some((e) => e.id === event.id)) return {};
          return { blackBox: [...s.blackBox, event] };
        }),

      pushOrbitPoint: (pt) =>
        set((s) => ({
          orbitTrail: [...s.orbitTrail.slice(-600), pt],
          stats: {
            ...s.stats,
            dataCollectedGB: s.stats.dataCollectedGB + 0.001 * s.timeMultiplier,
          },
        })),

      setTimeMultiplier: (timeMultiplier) => set({ timeMultiplier }),

      pauseMission: () => set({ isPaused: true }),

      resumeMission: () => set({ isPaused: false }),

      resetSimulation: () => {
        // Reset time-dependent state without wiping mission config
        const s = get();
        set({
          missionDay: 0,
          isPaused: false,
          elapsedRealMs: 0,
          objectiveProgress: 2,
          milestones: s.milestones.map((m) => ({ ...m, completed: false, completedAt: undefined })),
          crewVitalsHistory: {},
          blackBox: s.blackBox.slice(0, 1),  // keep only the launch event
          activeThreats: [],
          threatHistory: [],
          incidents: [],
          stats: { ...defaultStats },
        });
      },

      pushCrewVitalSample: (memberId, sample) =>
        set((s) => {
          const existing = s.crewVitalsHistory[memberId] ?? [];
          const trimmed = existing.length >= 200 ? existing.slice(-199) : existing;
          return {
            crewVitalsHistory: {
              ...s.crewVitalsHistory,
              [memberId]: [...trimmed, sample],
            },
          };
        }),

      tickMission: (realDeltaMs) =>
        set((s) => {
          if (s.status === 'completed' || s.isPaused) return {};
          if (s.objectiveProgress >= 100) return {};
          const simMs = realDeltaMs * s.timeMultiplier;
          const simDays = simMs / (1000 * 60 * 60 * 24);
          const newDay = s.missionDay + simDays;
          return {
            missionDay: newDay,
            elapsedRealMs: s.elapsedRealMs + realDeltaMs,
          };
        }),

      updateStats: (partial) =>
        set((s) => ({ stats: { ...s.stats, ...partial } })),

      completeMission: () => {
        set({ status: 'completed', screen: 'completion', objectiveProgress: 100 });
      },

      warpToCompletion: () => {
        const s = get();
        const finalDay = Math.max(s.missionDay, s.totalMissionDurationDays || 17);
        const completedMilestones = s.milestones.map((m) => ({
          ...m,
          completed: true,
          completedAt: m.completedAt || Date.now(),
        }));
        const farewellEvent: BlackBoxEvent = {
          id: `ev-farewell-warp-${Date.now()}`,
          timestamp: Date.now(),
          missionDay: finalDay,
          eventType: 'milestone',
          severity: 'nominal',
          description: `MISSION COMPLETE — All ${s.milestones.length} objectives finalized via high-warp execution at Day ${finalDay.toFixed(1)}. The astronaut team has completed all flight goals. Farewell sequence initiated.`,
          source: 'Mission Control',
          immutable: true,
        };

        set({
          missionDay: finalDay,
          objectiveProgress: 100,
          status: 'completed',
          screen: 'disposition',
          isPaused: false,
          milestones: completedMilestones,
          blackBox: [...s.blackBox, farewellEvent],
        });
      },

      setDisposition: (disposition) => set({ disposition }),

      archiveMission: () =>
        set((s) => {
          if (!s.config) return {};
          const existingIdx = s.archivedMissions.findIndex((m) => m.config.id === s.config.id);
          const archived: ArchivedMission = {
            config: s.config,
            status: s.status,
            stats: s.stats,
            disposition: s.disposition,
            completedAt: Date.now(),
            objectiveProgress: s.objectiveProgress,
            blackBox: s.blackBox.length > 0 ? s.blackBox : s.replayEvents,
          };
          if (existingIdx >= 0) {
            const updated = [...s.archivedMissions];
            updated[existingIdx] = archived;
            return { archivedMissions: updated, replayEvents: archived.blackBox };
          }
          return { archivedMissions: [...s.archivedMissions, archived], replayEvents: archived.blackBox };
        }),

      loadArchivedMission: (id) => {
        const mission = get().archivedMissions.find((m) => m.config.id === id);
        if (mission) {
          set({
            config: mission.config,
            status: mission.status,
            stats: mission.stats,
            disposition: mission.disposition,
            blackBox: mission.blackBox,
            replayEvents: mission.blackBox,
            objectiveProgress: mission.objectiveProgress,
            screen: 'replay',
          });
        }
      },

      resetMission: () => set({ ...initialState, archivedMissions: get().archivedMissions }),

      setMissionProfile: (profileKey) => {
        const profile = MISSION_PROFILES[profileKey] || MISSION_PROFILES.orbital;
        const milestones = buildMilestones(profile.type, profile.defaultConfig.destination);
        const crewRoster = profile.defaultConfig.crew || [];
        set({
          config: profile.defaultConfig,
          satellite: profile.satelliteConfig,
          crew: crewRoster,
          milestones,
          selectedSubsystem: null,
          telemetry: {
            ...defaultTelemetry,
            orbit: {
              ...defaultTelemetry.orbit,
              altitudeKm: profile.initialAltitudeKm,
              inclinationDeg: profile.inclinationDeg,
            },
          },
        });
      },

      updateTelemetry: (t) => {
        get().pushTelemetry(t);
      },

      setSelectedSubsystem: (selectedSubsystem) => set({ selectedSubsystem }),

      addIncident: (incident) =>
        set((s) => {
          if (s.incidents.some((i) => i.id === incident.id)) return {};
          return {
            incidents: [incident, ...s.incidents],
            status: incident.severity === 'critical' ? 'threatened' : s.status,
          };
        }),

      updateIncident: (id, partial) =>
        set((s) => ({
          incidents: s.incidents.map((i) => (i.id === id ? { ...i, ...partial } : i)),
        })),

      setTelemetryState: (telemetryState) => set({ telemetryState }),
    }),
    {
      name: 'vyom-mission-state-v3',
      partialize: (state) => ({
        archivedMissions: state.archivedMissions,
      }),
    }
  )
);

function buildMilestones(type: MissionType, destination: MissionDestination = 'earth-orbit'): MissionObjectiveMilestone[] {
  if (type === 'human' || destination === 'lunar-surface' || destination === 'lunar-orbit') {
    return [
      { id: 'h1', label: 'Trans-Lunar Injection (TLI) Ignition', completed: true, requiresDays: 0.05 },
      { id: 'h2', label: 'Cislunar Space Transit & Mid-Course Correction', completed: false, requiresDays: 1.5 },
      { id: 'h3', label: 'Lunar Orbit Insertion (LOI)', completed: false, requiresDays: 3.2 },
      { id: 'h4', label: 'Lunar Lander Descent & Final Touchdown', completed: false, requiresDays: 4.5 },
      { id: 'h5', label: 'Crew Surface EVA-1: Science & Ice Core Drilling', completed: false, requiresDays: 6.0 },
      { id: 'h6', label: 'Crew Surface EVA-2: Habitat Solar Array Setup', completed: false, requiresDays: 8.5 },
      { id: 'h7', label: 'Ascent Module Liftoff & Trans-Earth Injection', completed: false, requiresDays: 13.0 },
      { id: 'h8', label: 'Atmospheric Entry & Crew Recovery', completed: false, requiresDays: 16.5 },
    ];
  }

  if (destination === 'mars-surface') {
    return [
      { id: 'p1', label: 'Trans-Mars Injection Burn', completed: true, requiresDays: 0.1 },
      { id: 'p2', label: 'Interplanetary Cruise Navigation', completed: false, requiresDays: 90 },
      { id: 'p3', label: 'Mars Orbit Insertion & Atmospheric Entry', completed: false, requiresDays: 210 },
      { id: 'p4', label: 'Martian Surface Touchdown', completed: false, requiresDays: 212 },
      { id: 'p5', label: 'Surface Science Exploration Complete', completed: false, requiresDays: 365 },
    ];
  }

  if (type === 'astrophysics') {
    return [
      { id: 'a1', label: 'Sun-Earth L2 Lagrange Insertion', completed: true, requiresDays: 0.1 },
      { id: 'a2', label: 'Sunshield Deployment & Telescope Cooling', completed: false, requiresDays: 14 },
      { id: 'a3', label: 'First Light Deep-Field Calibration', completed: false, requiresDays: 30 },
      { id: 'a4', label: 'Exoplanet Spectroscopy Survey', completed: false, requiresDays: 90 },
      { id: 'a5', label: 'Cosmology Ultra-Deep Catalog Finalized', completed: false, requiresDays: 180 },
    ];
  }

  return [
    { id: 'm1', label: 'Orbit Established & Solar Deployment', completed: true, requiresDays: 0.05 },
    { id: 'm2', label: 'Payload Subsystems Calibration', completed: false, requiresDays: 1 },
    { id: 'm3', label: 'First Science Telemetry Stream', completed: false, requiresDays: 5 },
    { id: 'm4', label: 'High-Res Planetary Mapping Sequence', completed: false, requiresDays: 20 },
    { id: 'm5', label: 'Mission Objective Finalized', completed: false, requiresDays: 60 },
  ];
}
