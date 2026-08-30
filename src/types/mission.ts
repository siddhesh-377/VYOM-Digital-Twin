// VYOM — Core Mission Domain Types

export type MissionType = 'orbital' | 'planetary' | 'human' | 'astrophysics';

export type MissionDestination = 'earth-orbit' | 'lunar-surface' | 'lunar-orbit' | 'mars-surface' | 'lagrange-l1' | 'deep-space';

export type MissionStatus = 'active' | 'threatened' | 'recovering' | 'completed' | 'failed' | 'configuring';

export type ControlMode = 'autonomous' | 'manual';

export type HealthStatus = 'nominal' | 'warning' | 'critical' | 'failed';

export type DataSource = 'simulation' | 'model-estimate' | 'ai-prediction';

export type ThreatType = 'space-debris' | 'solar-storm' | 'power-failure' | 'thermal-overheat' | 'sensor-glitch' | 'communication-loss' | 'reaction-wheel-fault' | 'thruster-leak' | 'solar-flare' | 'asteroid' | 'debris' | 'thermal-failure' | 'communication-failure' | 'attitude-failure' | 'thermal' | 'power';

export type ThreatSeverity = 'warning' | 'critical' | 'fatal';

export type DispositionType = 'graveyard-orbit' | 'atmospheric-reentry' | 'lunar-impact' | 'interplanetary-escape' | 'heliocentric-orbit' | 'return' | 'deorbit' | 'retirement';

export interface LaunchSite {
  name: string;
  country: string;
  lat: number;
  lng: number;
  agency: string;
}

export const LAUNCH_SITES: LaunchSite[] = [
  { name: 'Satish Dhawan Space Centre (SLP)', country: 'India', lat: 13.72, lng: 80.23, agency: 'ISRO' },
  { name: 'Kennedy Space Center (LC-39A)', country: 'United States', lat: 28.57, lng: -80.65, agency: 'NASA' },
  { name: 'Guiana Space Centre (ELA-4)', country: 'French Guiana', lat: 5.24, lng: -52.77, agency: 'ESA' },
  { name: 'Tanegashima Space Center', country: 'Japan', lat: 30.40, lng: 130.97, agency: 'JAXA' },
  { name: 'Baikonur Cosmodrome (Site 1/5)', country: 'Kazakhstan', lat: 45.96, lng: 63.31, agency: 'Roscosmos' },
];

export interface CrewMember {
  id: string;
  name: string;
  role: 'Commander' | 'Lunar Module Pilot' | 'Flight Engineer' | 'Mission Specialist' | 'Medical Officer' | 'Payload Commander';
  heartRateBpm: number;
  spo2Percent: number;
  respirationBpm: number;
  coreTempC: number;
  suitPressureKpa: number;
  radiationDoseMsv: number;
  stressIndex: number; // 0–100
  status: 'nominal' | 'elevated' | 'critical' | 'resting' | 'eva';
  activity: string;
  // ── v3.0 Human Digital Twin additive fields (all SIMULATED estimates) ──
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  fatigueIndex?: number;      // 0-100
  hydrationPercent?: number;  // 0-100
  o2ExposureKpa?: number;
  co2ExposurePpm?: number;
  workloadIndex?: number;     // 0-100
  evaDurationMin?: number;
  location?: string;          // crew location / EVA position
  spacecraftModule?: string;
  currentTask?: string;
  taskDurationMin?: number;
  checklistStatus?: string;   // pending | in-progress | complete
  commStatus?: string;        // nominal | degraded | lost
  tetherStatus?: string;      // attached | detached (EVA only)
  dataQuality?: string;       // simulated | estimated | real
}

export interface MissionConfig {
  id: string;
  name: string;
  type: MissionType;
  destination: MissionDestination;
  objective: string;
  budgetCrore: number; // In INR Crores
  launchSite: LaunchSite;
  crew?: CrewMember[];
  createdAt: number;
}

export interface SatelliteSubsystem {
  name: string;
  health: number; // 0–100
  status: HealthStatus;
  temperature: number; // °C
}

export interface SatelliteConfig {
  type: string;
  body: string;
  solarPanels: number; // count
  batteryCapacityWh: number;
  antennaGainDb: number;
  payloadType: string;
  propulsionType: string;
  thermalControl: string;
  redundancy: number; // 0–3
  subsystems: SatelliteSubsystem[];
  dataSource: DataSource;
}

export interface TelemetryPower {
  batteryPercent: number;
  voltageV: number;
  currentA: number;
  solarGenerationW: number;
  consumptionW: number;
}

export interface TelemetryThermal {
  cpuTempC: number;
  batteryTempC: number;
  payloadTempC: number;
  externalTempC: number;
}

export interface TelemetryAttitude {
  rollDeg: number;
  pitchDeg: number;
  yawDeg: number;
  angularVelDegS: number;
  reactionWheelRpm: number;
}

export interface TelemetryComm {
  signalDbm: number;
  dataRateMbps: number;
  packetsPerSec: number;
  latencyMs: number;
  uptime: number; // %
}

export interface TelemetryCompute {
  cpuPercent: number;
  memoryPercent: number;
  storagePercent: number;
}

export interface TelemetryOrbit {
  altitudeKm: number;
  velocityKms: number;
  accelerationMs2: number;
  gForce: number;
  latitudeDeg: number;
  longitudeDeg: number;
  inclinationDeg: number;
  periodMin: number;
  apogeeKm: number;
  perigeeKm: number;
  semiMajorAxisKm: number;
  eccentricity: number;
  trueAnomalyDeg: number;
  phaseDesc?: string;
  distanceFromEarthKm?: number;
  atmosphericLayer: 'Troposphere' | 'Stratosphere' | 'Mesosphere' | 'Thermosphere' | 'Exosphere';
  atmosphericDensityKgM3: number;
  atmosphericDragN: number;
}

export interface Telemetry {
  missionDay: number;
  timestamp: number;
  power: TelemetryPower;
  thermal: TelemetryThermal;
  attitude: TelemetryAttitude;
  comm: TelemetryComm;
  compute: TelemetryCompute;
  orbit: TelemetryOrbit;
  crew?: CrewMember[];
  overallHealth: number; // 0–100
  healthStatus: HealthStatus;
  dataSource: DataSource;
}

export interface ThreatScenario {
  id: string;
  type: ThreatType;
  name: string;
  description: string;
  active: boolean;
  severity: ThreatSeverity;
  startedAt: number;
  mitigatedAt?: number;
  effects: Record<string, number>; // subsystem deltas
}

export interface AIReasoningStep {
  step: number;
  phase: string;
  title: string;
  detail: string;
  status: 'pending' | 'running' | 'complete';
  confidence: number;
  timestamp: number;
}

export type AIWorkflowStage =
  | 'Error Received'
  | 'Analysing'
  | 'Diagnosing'
  | 'Recovery Decision'
  | 'Executing'
  | 'Verifying'
  | 'Resolved'
  | 'AI TIMEOUT';

export interface AIAnalysis {
  phase: 'monitoring' | 'ingesting' | 'diagnosing' | 'predicting' | 'optimizing' | 'executing' | 'verifying' | 'analyzing';
  anomalyDetected: boolean;
  anomalyDescription: string;
  predictedFailure: string;
  probability: number;
  timeToFailureMin: number;
  recommendedAction: string;
  confidence: number;
  riskLevel: 'low' | 'medium' | 'high' | 'critical';
  dataSource: DataSource;
  reasoningSteps?: AIReasoningStep[];
  neuralActivations?: number[];
  monteCarloRuns?: number;
  selectedStrategy?: string;
  recoverySecondsRemaining?: number;
  actions?: { type: string; params: any; validated?: boolean }[];
  // ── 6-Second Workflow Fields ──
  liveStage?: AIWorkflowStage;
  realElapsedSeconds?: number;
  realRemainingSeconds?: number;
  virtualRecoveryTimeStr?: string;
  virtualRecoveryTimeSeconds?: number;
  isTimeout?: boolean;
  incidentId?: string;
}

export interface AutonomousAction {
  id: string;
  triggeredAt: number;
  type: string;
  description: string;
  status: 'pending' | 'executing' | 'completed' | 'overridden';
  result?: string;
}

export interface BlackBoxEvent {
  id: string;
  timestamp: number;
  missionDay: number;
  eventType: 'threat' | 'ai' | 'command' | 'telemetry' | 'milestone' | 'override' | 'recovery';
  severity: 'nominal' | 'warning' | 'critical';
  description: string;
  source: string;
  immutable: true;
}

export interface OrbitPoint {
  lat: number;
  lng: number;
  alt: number;
  timestamp: number;
}

export interface SpaceEnvironment {
  solarActivityLevel: number; // 0–10
  radiationLevel: number; // μSv/h
  magneticFieldNT: number; // nT
  temperatureRangeC: [number, number];
  debrisDensity: number; // 0–10
  classification: 'low' | 'normal' | 'warning' | 'critical';
  dataSource: DataSource;
}

export interface MissionObjectiveMilestone {
  id: string;
  label: string;
  completed: boolean;
  completedAt?: number;
  requiresDays: number;
}

export interface MissionStats {
  totalDistanceKm: number;
  dataCollectedGB: number;
  threatsEncountered: number;
  aiInterventions: number;
  maxHealth: number;
  minHealth: number;
  commUptimePercent: number;
  orbitsCompleted: number;
}

export interface ArchivedMission {
  config: MissionConfig;
  status: MissionStatus;
  stats: MissionStats;
  disposition: DispositionType | null;
  completedAt: number;
  objectiveProgress: number;
  blackBox: BlackBoxEvent[];
}

// ── v3.0 Types ──

export type MissionPhase = 'pre-launch' | 'launch' | 'orbit-insertion' | 'cruise' | 'operations' | 'extended-ops' | 'end-of-life';

export interface RecoveryProcedure {
  id: string;
  fault_type: string;
  name: string;
  description: string;
  steps: string[];
  estimated_time_s: number;
  success_probability: number;
  risk_level: 'low' | 'medium' | 'high';
}

export interface Incident {
  id: string;
  mission_day: number;
  normalized_fault_category: string;
  normalized_subsystem: string;
  severity: string;
  status: 'open' | 'detected' | 'diagnosing' | 'recovering' | 'resolved' | 'failed' | 'investigating' | 'diagnosed' | 'unresolved' | 'AI TIMEOUT' | 'timeout';
  description: string;
  detection_time: number;
  diagnosis_time?: number;
  decision_time?: number;
  recovery_start?: number;
  recovery_end?: number;
  total_resolution_ms?: number;
  recovery_mode: 'manual' | 'ai' | 'hybrid' | 'none';
  procedures: RecoveryProcedure[];
  // ── v3.0 additive fields (backend-authoritative) ──
  raw_error?: string;
  normalized_root_cause?: string;
  confidence?: number;
  ai_analysis?: Record<string, unknown>;
  manual_actions?: Record<string, unknown>[];
  fault_id?: string;
  // Simulation-clock timeline (authoritative under time acceleration)
  detection_sim_s?: number;
  diagnosis_sim_s?: number;
  decision_sim_s?: number;
  recovery_start_sim_s?: number;
  recovery_end_sim_s?: number;
  total_resolution_sim_s?: number;
  // ── 6-Second Optimization Fields ──
  ai_processing_time_s?: number;      // Real wall-clock AI time (target ~5.0s, max 6.0s)
  virtual_recovery_time_s?: number;  // Virtual mission physical recovery time (e.g. 9300s = 2h 35m)
  virtual_recovery_time_str?: string;// Formatted virtual recovery string
  is_timeout?: boolean;              // True if terminated by 6.0s hard safety limit
}

export interface DailySummary {
  mission_day: number;
  health_avg: number;
  health_min: number;
  health_max: number;
  incidents_count: number;
  critical_events: number;
  distance_traveled_km: number;
  power_generated_wh: number;
  data_transmitted_mb: number;
  environment_classification: string;
}

export interface MissionRiskAssessment {
  risk_score: number; // 0-100
  risk_category: 'minimal' | 'low' | 'moderate' | 'high' | 'critical';
  trend: 'stable' | 'increasing' | 'decreasing';
  contributing_factors: Array<{ factor: string; impact: number }>;
  recommendations: string[];
}

export interface SpacecraftArchitecture {
  id: string;
  name: string;
  description: string;
  type: string;
  mass_kg: number;
  power_capacity_w: number;
  reliability_base: number;
  redundancy_level: number;
  propulsion_type: string;
  cost_crore: number;
}

export interface FarewellAssessment {
  readiness_score: number;
  rul_days: number;
  recommended_option: DispositionType;
  monte_carlo_success_rate: number;
  confidence: number;
  factors: string[];
}

export interface Scenario {
  id: string;
  name: string;
  description: string;
  fault_type: string;
  mitigation_strategy: string;
}

/** One historical physiological snapshot per crew member (SIMULATED estimates) */
export interface CrewVitalSample {
  missionDay: number;
  timestamp: number;
  heartRateBpm: number;
  spo2Percent: number;
  respirationBpm: number;
  coreTempC: number;
  stressIndex: number;
  fatigueIndex: number;
  hydrationPercent: number;
  radiationDoseMsv: number;
  bloodPressureSys?: number;
  bloodPressureDia?: number;
  workloadIndex?: number;
}

export interface MissionState {
  config: MissionConfig | null;
  satellite: SatelliteConfig | null;
  status: MissionStatus;
  missionPhase: MissionPhase;
  controlMode: ControlMode;
  screen: AppScreen;
  missionDay: number;
  missionStartTime: number;
  timeMultiplier: number;
  isPaused: boolean;
  totalMissionDurationDays: number;
  elapsedRealMs: number;
  estimatedLifetimeYears: number;
  reliabilityPercent: number;
  resourceReservePercent: number;
  rulDays: number;
  telemetry: Telemetry | null;
  telemetryHistory: Telemetry[];
  crew: CrewMember[];
  /** Per-member physiological history (SIMULATED). Key = CrewMember.id */
  crewVitalsHistory: Record<string, CrewVitalSample[]>;
  environment: SpaceEnvironment;
  activeThreats: ThreatScenario[];
  threatHistory: ThreatScenario[];
  incidents: Incident[];
  aiAnalysis: AIAnalysis;
  pendingActions: AutonomousAction[];
  completedActions: AutonomousAction[];
  objectiveProgress: number;
  milestones: MissionObjectiveMilestone[];
  blackBox: BlackBoxEvent[];
  orbitTrail: OrbitPoint[];
  trajectoryState?: any;
  dailySummaries: DailySummary[];
  riskAssessment?: MissionRiskAssessment;
  farewellAssessment?: FarewellAssessment;
  stats: MissionStats;
  disposition: DispositionType | null;
  archivedMissions: ArchivedMission[];
  replayEvents: BlackBoxEvent[];
  replayPosition: number;
  dataMode: 'simulation' | 'live' | 'replay' | 'prediction';
  selectedSubsystem?: string | null;
  telemetryState?: 'LIVE' | 'SIMULATED' | 'REPLAY' | 'STALE' | 'DISCONNECTED';
}

export type AppScreen =
  | 'welcome'
  | 'onboarding'
  | 'budget'
  | 'launch'
  | 'satellite'
  | 'launch-sequence'
  | 'mission-control'
  | 'crew'
  | 'planning'
  | 'architecture'
  | 'digital-twin'
  | 'orbit'
  | 'universe'
  | 'telemetry'
  | 'environment'
  | 'scenarios'
  | 'danger-decision'
  | 'ai'
  | 'mission-time'
  | 'timeline'
  | 'blackbox'
  | 'replay'
  | 'reports'
  | 'archive'
  | 'completion'
  | 'disposition'
  | 'farewell';
