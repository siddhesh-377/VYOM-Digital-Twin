/**
 * DangerDecisionEngine — AI-Powered Danger Simulation and Decision Support Engine
 * 
 * Provides automated emergency detection, multi-strategy probabilistic evaluation,
 * Monte Carlo outcome branching simulations, decision tree visualizer, and dynamic
 * contingency rerouting.
 */

export interface DangerScenario {
  id: string;
  name: string;
  code: string;
  category: 'ECLSS & Crew Life Support' | 'Power & Energy Systems' | 'Thermal Control' | 'Radiation & Space Weather' | 'GNC Attitude & Stability' | 'Propulsion & Delta-V';
  severity: 'CRITICAL' | 'HIGH DANGER' | 'EMERGENCY';
  affectedSubsystem: string;
  affectedCrewRegion: 'chest' | 'head' | 'plss' | 'abdomen' | 'body' | null;
  description: string;
  timeToCriticalitySec: number;
  telemetrySnapshot: {
    label: string;
    value: string | number;
    unit: string;
    nominal: string;
    status: 'critical' | 'warning' | 'nominal';
  }[];
  availableResources: {
    o2Kg: number;
    o2Percent: number;
    batteryWh: number;
    batteryPercent: number;
    propellantKg: number;
    powerW: number;
  };
  options: ResponseOption[];
}

export interface ResponseOption {
  id: string;
  key: 'A' | 'B' | 'C' | 'D';
  name: string;
  explanation: string;
  expectedObjective: string;
  successProbability: number;       // 0 - 100
  failureProbability: number;       // 0 - 100
  executionTime: string;            // e.g. "30 sec"
  resourceRequirements: string;
  sideEffects: string;
  astronautSafetyImpact: 'High positive' | 'Positive' | 'Moderate' | 'High risk' | 'Critical risk';
  missionImpact: 'Low' | 'Moderate' | 'High' | 'Severe';
  simulationConfidence: number;     // 0 - 100
  isRecommended: boolean;
  whyThisOption: {
    positiveFactors: string[];
    riskTradeoffs: string[];
    rankingRationale: string;
  };
  simulatedOutcome: 'SUCCESS' | 'PARTIAL SUCCESS' | 'UNSTABLE' | 'FAILURE';
  outcomeNarrative: string;
  predictedMetrics: {
    finalHealth: number;
    crewHeartRateBpm: number;
    crewSpo2Percent: number;
    crewStressIndex: number;
    o2ConsumptionKg: number;
    batteryConsumptionWh: number;
    propellantConsumptionKg: number;
    timelineDelayMin: number;
  };
  contingencyFallback?: {
    recommendation: string;
    newSuccessProbability: number;
    newFailureProbability: number;
    actionPlan: string;
  };
}

export interface SimulationExecutionProgress {
  step: number;
  totalSteps: number;
  stageName: string;
  details: string;
  elapsedSec: number;
  probabilityDistribution: {
    success: number;
    partial: number;
    unstable: number;
    failure: number;
  };
  liveSubsystemHealth: number;
  liveCrewHeartRate: number;
  liveCrewSpo2: number;
  liveCrewStress: number;
  isComplete: boolean;
  finalOutcome?: 'SUCCESS' | 'PARTIAL SUCCESS' | 'UNSTABLE' | 'FAILURE';
}

export interface SimulationHistoryRecord {
  id: string;
  timestamp: string;
  scenarioName: string;
  category: string;
  selectedOptionKey: string;
  selectedOptionName: string;
  finalOutcome: 'SUCCESS' | 'PARTIAL SUCCESS' | 'UNSTABLE' | 'FAILURE';
  initialSuccessProb: number;
  finalHealth: number;
  crewSafetyScore: number;
  durationSec: number;
}

// ─── Realistic Danger Scenarios Library ──────────────────────────────────────
export const DANGER_SCENARIOS_LIBRARY: DangerScenario[] = [
  {
    id: 'danger-o2-depress',
    name: 'Crew Oxygen System Degradation & Cabin Pressure Drop',
    code: 'ECLSS-O2-FAIL',
    category: 'ECLSS & Crew Life Support',
    severity: 'CRITICAL',
    affectedSubsystem: 'ECLSS Primary Cryogenic Loop A & Cabin Valve',
    affectedCrewRegion: 'chest',
    description: 'Rapid drop in cabin PO2 partial pressure (down to 13.8 kPa) accompanied by micro-leak in primary metabolic oxygen feedline manifold.',
    timeToCriticalitySec: 240, // 4 mins
    telemetrySnapshot: [
      { label: 'CABIN PO2', value: 13.8, unit: 'kPa', nominal: '21.3 kPa', status: 'critical' },
      { label: 'CABIN PRESSURE', value: 74.2, unit: 'kPa', nominal: '101.3 kPa', status: 'warning' },
      { label: 'O2 MASS FLOW', value: 0.12, unit: 'kg/h', nominal: '0.45 kg/h', status: 'critical' },
      { label: 'ASTRONAUT SpO2', value: 88, unit: '%', nominal: '98 - 100%', status: 'critical' },
      { label: 'CREW HEART RATE', value: 124, unit: 'BPM', nominal: '68 - 78 BPM', status: 'warning' },
      { label: 'CREW STRESS INDEX', value: 82, unit: '/100', nominal: '20 - 35', status: 'critical' },
    ],
    availableResources: {
      o2Kg: 420,
      o2Percent: 84,
      batteryWh: 7600,
      batteryPercent: 92,
      propellantKg: 110,
      powerW: 4200,
    },
    options: [
      {
        id: 'o2-opt-a',
        key: 'A',
        name: 'Activate Redundant Cryogenic O2 Supply & Pressurize Cabin',
        explanation: 'Open high-pressure secondary cross-strapped oxygen tank valves and command auto-isolation of leaking manifold loop A.',
        expectedObjective: 'Restore cabin PO2 to nominal 21.0 kPa within 45 seconds and stabilize astronaut SpO2 above 96%.',
        successProbability: 88,
        failureProbability: 12,
        executionTime: '30 sec',
        resourceRequirements: '8.5 kg Cryo O2, 180W Auxiliary Valve Actuator Power',
        sideEffects: 'Consumes 2% of reserve emergency oxygen buffer allocated for lunar return.',
        astronautSafetyImpact: 'High positive',
        missionImpact: 'Low',
        simulationConfidence: 96,
        isRecommended: true,
        whyThisOption: {
          positiveFactors: [
            'Immediate physiological stabilization of crew (SpO2 recovers in <40s)',
            'Utilizes fully verified secondary redundant solenoid valves',
            'Negligible mission science impact with minimal power consumption'
          ],
          riskTradeoffs: [
            'Reduces return emergency oxygen reserves from 84% to 82%',
            'Requires ground telemetry confirmation of isolated line seal'
          ],
          rankingRationale: 'Ranked #1 due to the highest success probability (88%) and instant crew respiratory protection with minimal operational penalty.'
        },
        simulatedOutcome: 'SUCCESS',
        outcomeNarrative: 'Secondary oxygen manifold pressurized at 21.4 kPa. Astronaut SpO2 normalized to 98.5%. Crew heart rate decreased to 74 BPM.',
        predictedMetrics: {
          finalHealth: 96.5,
          crewHeartRateBpm: 74,
          crewSpo2Percent: 98.5,
          crewStressIndex: 28,
          o2ConsumptionKg: 8.5,
          batteryConsumptionWh: 12,
          propellantConsumptionKg: 0,
          timelineDelayMin: 0,
        },
      },
      {
        id: 'o2-opt-b',
        key: 'B',
        name: 'Isolate Affected Hab Module & Don Emergency Spacesuits (IVA)',
        explanation: 'Seal inter-module pressure hatches, depressurize service tunnel, and transition crew into Intravehicular Activity (IVA) suits.',
        expectedObjective: 'Guarantee 100% crew life support containment inside sealed suit circuits regardless of module leaks.',
        successProbability: 74,
        failureProbability: 26,
        executionTime: '2 min 15 sec',
        resourceRequirements: '4x IVA Suit Consumable Packs, Module Airlock Gas Purge',
        sideEffects: 'Loss of crew mobility and temporary closure of science payload workstation module.',
        astronautSafetyImpact: 'Positive',
        missionImpact: 'Moderate',
        simulationConfidence: 91,
        isRecommended: false,
        whyThisOption: {
          positiveFactors: [
            'Eliminates cabin atmosphere dependency through independent suit scrubbers',
            'Protects against potential structural micro-fissures in primary hull'
          ],
          riskTradeoffs: [
            'Longer execution latency (2m 15s) during which hypoxia stress remains high',
            'Suspends scheduled experiments and restricts cabin volume'
          ],
          rankingRationale: 'Ranked #2: Highly conservative and safe, but imposes workflow penalties and takes longer to initiate than direct valve switch.'
        },
        simulatedOutcome: 'PARTIAL SUCCESS',
        outcomeNarrative: 'Crew successfully donned IVA suits. Atmosphere stabilized in suit loops, but mission timeline delayed by 45 minutes.',
        predictedMetrics: {
          finalHealth: 88.0,
          crewHeartRateBpm: 88,
          crewSpo2Percent: 97.0,
          crewStressIndex: 48,
          o2ConsumptionKg: 14.0,
          batteryConsumptionWh: 65,
          propellantConsumptionKg: 0,
          timelineDelayMin: 45,
        },
      },
      {
        id: 'o2-opt-c',
        key: 'C',
        name: 'Dynamic Differential Pressure Balancing & Continuous Monitoring',
        explanation: 'Modulate primary regulator duty cycle to overpower the leak while running real-time acoustic leak triangulation.',
        expectedObjective: 'Maintain marginal breathable envelope without switching to reserve tanks while seeking exact breach point.',
        successProbability: 38,
        failureProbability: 62,
        executionTime: 'Immediate (0 sec)',
        resourceRequirements: 'High-Rate O2 Continuous Blowdown (2.8 kg/hr)',
        sideEffects: 'Rapid unrecoverable venting of oxygen into space if leak aperture widens.',
        astronautSafetyImpact: 'High risk',
        missionImpact: 'Severe',
        simulationConfidence: 89,
        isRecommended: false,
        whyThisOption: {
          positiveFactors: [
            'Zero immediate configuration switching overhead',
            'Allows automated acoustic array to continue searching for pinpoint location'
          ],
          riskTradeoffs: [
            '62% probability of accelerated cabin decompression',
            'Astronaut SpO2 risks falling below critical 80% threshold',
            'Severe wastage of precious primary consumables'
          ],
          rankingRationale: 'Ranked #3: Extremely hazardous. High failure rate (62%) due to exponential leak expansion risk under high differential pressure.'
        },
        simulatedOutcome: 'UNSTABLE',
        outcomeNarrative: 'Leak rate accelerated past regulator compensation capacity. Cabin PO2 dropped to 11.2 kPa. Contingency protocol triggered.',
        predictedMetrics: {
          finalHealth: 48.0,
          crewHeartRateBpm: 138,
          crewSpo2Percent: 82.0,
          crewStressIndex: 94,
          o2ConsumptionKg: 32.0,
          batteryConsumptionWh: 40,
          propellantConsumptionKg: 0,
          timelineDelayMin: 120,
        },
        contingencyFallback: {
          recommendation: 'Emergency Contingency: Immediate Overwrite to Option A (Redundant O2 Isolation)',
          newSuccessProbability: 84,
          newFailureProbability: 16,
          actionPlan: 'Auto-fire explosive pyro-valves on loop A and initiate direct emergency lung demand regulator feed.',
        },
      },
    ],
  },

  {
    id: 'danger-battery-thermal',
    name: 'Thermal Runaway & Overheating in Main Li-Ion Battery Bank A',
    code: 'EPS-BATT-THERM',
    category: 'Power & Energy Systems',
    severity: 'CRITICAL',
    affectedSubsystem: 'Primary Power Distribution & Battery Module A',
    affectedCrewRegion: null,
    description: 'Cell temperature in Battery Bank A spiked to 88.4°C with escalating internal resistance and continuous thermal propagation risk.',
    timeToCriticalitySec: 180, // 3 mins
    telemetrySnapshot: [
      { label: 'BATTERY A TEMP', value: 88.4, unit: '°C', nominal: '15 - 25°C', status: 'critical' },
      { label: 'VOLTAGE BUS A', value: 31.8, unit: 'V', nominal: '28.0 V', status: 'critical' },
      { label: 'INTERNAL RESISTANCE', value: 145, unit: 'mΩ', nominal: '22 mΩ', status: 'critical' },
      { label: 'BUS B TEMP', value: 21.0, unit: '°C', nominal: '15 - 25°C', status: 'nominal' },
      { label: 'FLUID COOLING FLOW', value: 1.8, unit: 'L/min', nominal: '3.2 L/min', status: 'warning' },
    ],
    availableResources: {
      o2Kg: 420,
      o2Percent: 100,
      batteryWh: 4100, // Bank B remaining
      batteryPercent: 51,
      propellantKg: 110,
      powerW: 3800,
    },
    options: [
      {
        id: 'batt-opt-a',
        key: 'A',
        name: 'Electrically Isolate Bank A & Divert Active Glycol Cooling',
        explanation: 'Open solid-state bus contactor A, reroute total spacecraft load to Bank B + Solar, and pump maximum coolant to Module A.',
        expectedObjective: 'Quench thermal propagation in Bank A within 90 seconds while maintaining uninterrupted avionics on Bank B.',
        successProbability: 91,
        failureProbability: 9,
        executionTime: '15 sec',
        resourceRequirements: 'Max Glycol Pump Speed (45W), Bank B Sole Load Absorption',
        sideEffects: 'Reduces total peak power capacity by 50% until Bank A cools and resets.',
        astronautSafetyImpact: 'Positive',
        missionImpact: 'Low',
        simulationConfidence: 98,
        isRecommended: true,
        whyThisOption: {
          positiveFactors: [
            'Instantly halts electrical Joule heating in damaged battery cells',
            'Cross-strapped Bank B possesses sufficient capacity for all essential systems',
            'Maximizes cooling loop heat dissipation into deep-space radiators'
          ],
          riskTradeoffs: [
            'Requires non-essential science instruments to enter low-power standby for 2 hours'
          ],
          rankingRationale: 'Ranked #1: Highest confidence (98%) and 91% success probability with immediate thermal halt and zero crew danger.'
        },
        simulatedOutcome: 'SUCCESS',
        outcomeNarrative: 'Battery Bank A temperature stabilized at 34°C. Bus B seamlessly carried vital spacecraft loads. No thermal propagation.',
        predictedMetrics: {
          finalHealth: 94.0,
          crewHeartRateBpm: 72,
          crewSpo2Percent: 99.0,
          crewStressIndex: 24,
          o2ConsumptionKg: 0,
          batteryConsumptionWh: 450,
          propellantConsumptionKg: 0,
          timelineDelayMin: 0,
        },
      },
      {
        id: 'batt-opt-b',
        key: 'B',
        name: 'Emergency Deep-Discharge of Bank A into External Resistor Shunts',
        explanation: 'Rapidly drain electrochemical energy from Bank A through external dump resistors to eliminate flammable energy potential.',
        expectedObjective: 'Starve thermal runaway reaction of electrochemical reactants.',
        successProbability: 68,
        failureProbability: 32,
        executionTime: '1 min 30 sec',
        resourceRequirements: 'Shunt Resistor Dissipation Capacity (6 kW)',
        sideEffects: 'Permanent loss of Battery Bank A for the remainder of the mission.',
        astronautSafetyImpact: 'Moderate',
        missionImpact: 'Moderate',
        simulationConfidence: 87,
        isRecommended: false,
        whyThisOption: {
          positiveFactors: [
            'Completely neutralizes fire/explosion risk permanently'
          ],
          riskTradeoffs: [
            'Permanently reduces mission lifespan and prevents secondary eclipse experiments',
            'Discharge resistors generate temporary external thermal wave'
          ],
          rankingRationale: 'Ranked #2: Effective at extinguishing fire risk, but permanently damages mission power redundancy.'
        },
        simulatedOutcome: 'PARTIAL SUCCESS',
        outcomeNarrative: 'Bank A fully discharged. Thermal runaway prevented, but spacecraft operating in degraded single-battery architecture.',
        predictedMetrics: {
          finalHealth: 76.0,
          crewHeartRateBpm: 80,
          crewSpo2Percent: 99.0,
          crewStressIndex: 38,
          o2ConsumptionKg: 0,
          batteryConsumptionWh: 2100,
          propellantConsumptionKg: 0,
          timelineDelayMin: 15,
        },
      },
      {
        id: 'batt-opt-c',
        key: 'C',
        name: 'Attempt In-Situ Pulse-Charging Reconditioning Cycle',
        explanation: 'Execute micro-second inverted polarity pulses to dissolve suspected lithium dendritic shorts inside the cell matrix.',
        expectedObjective: 'Clear internal short-circuit without shedding battery capacity.',
        successProbability: 24,
        failureProbability: 76,
        executionTime: '45 sec',
        resourceRequirements: 'High-Frequency Inverter Pulses',
        sideEffects: 'Catastrophic cell thermal breach if dendrite does not dissolve immediately.',
        astronautSafetyImpact: 'Critical risk',
        missionImpact: 'Severe',
        simulationConfidence: 82,
        isRecommended: false,
        whyThisOption: {
          positiveFactors: [
            'Theoretical full restoration of 100% dual-battery capacity if successful'
          ],
          riskTradeoffs: [
            '76% catastrophic failure probability',
            'Severe risk of battery casing rupture and toxic electrolyte off-gassing'
          ],
          rankingRationale: 'Ranked #3: Extremely ill-advised. The 76% failure probability presents an unacceptable danger to vehicle integrity.'
        },
        simulatedOutcome: 'FAILURE',
        outcomeNarrative: 'Pulse current triggered internal arc. Thermal casing breached. Emergency fire suppression commanded automatically.',
        predictedMetrics: {
          finalHealth: 38.0,
          crewHeartRateBpm: 125,
          crewSpo2Percent: 95.0,
          crewStressIndex: 88,
          o2ConsumptionKg: 0,
          batteryConsumptionWh: 3200,
          propellantConsumptionKg: 0,
          timelineDelayMin: 180,
        },
        contingencyFallback: {
          recommendation: 'Emergency Contingency: Fire Extinguishing & Isolated Bus B Cutover',
          newSuccessProbability: 79,
          newFailureProbability: 21,
          actionPlan: 'Deploy Pyrobubbler CO2 fire suppression on Bank A bay and seal thermal isolation doors.',
        },
      },
    ],
  },

  {
    id: 'danger-solar-flare',
    name: 'Coronal Mass Ejection & Severe Radiation Proton Surge',
    code: 'ENV-SOLAR-CME',
    category: 'Radiation & Space Weather',
    severity: 'HIGH DANGER',
    affectedSubsystem: 'Spacecraft Avionics Hull & Astronaut Whole-Body Dose',
    affectedCrewRegion: 'body',
    description: 'X-Class solar flare particle front arriving in 180 seconds. Predicted cosmic radiation flux exceeding 480 μSv/h with high-energy proton bombardment.',
    timeToCriticalitySec: 180,
    telemetrySnapshot: [
      { label: 'RADIATION FLUX', value: 492, unit: 'μSv/h', nominal: '12 - 18 μSv/h', status: 'critical' },
      { label: 'SOLAR FLUX (SFU)', value: 340, unit: 'SFU', nominal: '120 - 160 SFU', status: 'critical' },
      { label: 'BIT FLIP RATE', value: 18.4, unit: 'err/min', nominal: '<0.1 err/min', status: 'warning' },
      { label: 'CREW ACCUM DOSE', value: 1.42, unit: 'mSv', nominal: '<0.5 mSv/wk', status: 'warning' },
      { label: 'AVIONICS TMR INTEGRITY', value: 92, unit: '%', nominal: '100%', status: 'nominal' },
    ],
    availableResources: {
      o2Kg: 420,
      o2Percent: 100,
      batteryWh: 7800,
      batteryPercent: 96,
      propellantKg: 108,
      powerW: 5100,
    },
    options: [
      {
        id: 'rad-opt-a',
        key: 'A',
        name: 'Maneuver Spacecraft to Storm Shelter Attitude & Crew Storm Haven Entry',
        explanation: 'Align spacecraft propulsion block towards the Sun to act as a 1200kg mass radiation shield; crew retreats to water-lined storm haven.',
        expectedObjective: 'Attenuate ionizing proton flux by 88% and protect astronaut hematopoietic bone marrow from acute radiation syndrome.',
        successProbability: 94,
        failureProbability: 6,
        executionTime: '1 min 10 sec',
        resourceRequirements: '1.4 kg RCS Propellant for Attitude Slew, 60W Storm Haven Lighting',
        sideEffects: 'Temporary loss of Earth communication downlink for 35 minutes while High-Gain Antenna is shadowed.',
        astronautSafetyImpact: 'High positive',
        missionImpact: 'Low',
        simulationConfidence: 97,
        isRecommended: true,
        whyThisOption: {
          positiveFactors: [
            'Leverages spacecraft fuel and water tanks as heavy passive shielding mass',
            'Reduces crew biological absorbed dose from 492 μSv/h down to safe 38 μSv/h',
            'Spacecraft ADCS reaction wheels execute slew smoothly with minimal fuel'
          ],
          riskTradeoffs: [
            '35-minute communications blackout with ground mission control'
          ],
          rankingRationale: 'Ranked #1: Gold standard spaceflight survival protocol with 94% success rate and maximum biological protection.'
        },
        simulatedOutcome: 'SUCCESS',
        outcomeNarrative: 'Spacecraft shadow shield locked on solar vector. Crew dose rate dropped to 36 μSv/h. Avionics EDAC scrubbers handled bit-flips.',
        predictedMetrics: {
          finalHealth: 98.0,
          crewHeartRateBpm: 70,
          crewSpo2Percent: 99.0,
          crewStressIndex: 22,
          o2ConsumptionKg: 2.0,
          batteryConsumptionWh: 180,
          propellantConsumptionKg: 1.4,
          timelineDelayMin: 35,
        },
      },
      {
        id: 'rad-opt-b',
        key: 'B',
        name: 'Orient Solar Panels Edge-On & Activate Triple-Modular Redundancy Lock',
        explanation: 'Feather solar arrays parallel to proton stream to avoid panel degradation and lock flight computers into aggressive lockstep TMR.',
        expectedObjective: 'Prioritize spacecraft hardware and electronics survival while crew remains at normal flight stations.',
        successProbability: 62,
        failureProbability: 38,
        executionTime: '40 sec',
        resourceRequirements: 'Solar Array Drive SADA Power, 240W Battery Discharge',
        sideEffects: 'Astronauts receive 3.5x higher biological radiation dose than in Storm Haven.',
        astronautSafetyImpact: 'Moderate',
        missionImpact: 'Moderate',
        simulationConfidence: 90,
        isRecommended: false,
        whyThisOption: {
          positiveFactors: [
            'Preserves continuous Earth telemetry and optical tracking',
            'Minimizes solar cell crystal lattice dislocation damage'
          ],
          riskTradeoffs: [
            'Elevated astronaut cellular radiation exposure',
            'Crew fatigue and long-term biodose tracking required'
          ],
          rankingRationale: 'Ranked #2: Good equipment protection, but prioritizes electronics over crew biological shielding.'
        },
        simulatedOutcome: 'PARTIAL SUCCESS',
        outcomeNarrative: 'Electronics survived nominal. Crew accumulated 3.8 mSv additional radiation dose requiring medical antioxidant protocol.',
        predictedMetrics: {
          finalHealth: 85.0,
          crewHeartRateBpm: 84,
          crewSpo2Percent: 98.0,
          crewStressIndex: 56,
          o2ConsumptionKg: 3.5,
          batteryConsumptionWh: 380,
          propellantConsumptionKg: 0.2,
          timelineDelayMin: 0,
        },
      },
      {
        id: 'rad-opt-c',
        key: 'C',
        name: 'Maintain Science Orbit & Continue Full-Spectrum Observation',
        explanation: 'Keep all high-voltage instruments active to gather unprecedented in-situ scientific data on the Coronal Mass Ejection.',
        expectedObjective: 'Capture high-value astrophysical science data during peak solar particle event.',
        successProbability: 31,
        failureProbability: 69,
        executionTime: '0 sec',
        resourceRequirements: '100% Continuous Scientific Power Draw (2800W)',
        sideEffects: 'Severe sensor latch-up, high probability of flight computer crash, and dangerous crew radiation dose.',
        astronautSafetyImpact: 'High risk',
        missionImpact: 'Severe',
        simulationConfidence: 86,
        isRecommended: false,
        whyThisOption: {
          positiveFactors: [
            'Captures historic scientific heliophysics telemetry'
          ],
          riskTradeoffs: [
            '69% failure rate from avionics single-event burnouts (SEB)',
            'Astronaut dose exceeds annual NASA/ISRO safety thresholds'
          ],
          rankingRationale: 'Ranked #3: Unacceptable risk. Radiation flux is severe enough to cause hardware latch-ups and crew radiation sickness.'
        },
        simulatedOutcome: 'UNSTABLE',
        outcomeNarrative: 'Primary payload sensor array saturated. High-voltage power supply tripped off. Flight computer triggered automatic safe-mode reboot.',
        predictedMetrics: {
          finalHealth: 54.0,
          crewHeartRateBpm: 118,
          crewSpo2Percent: 96.0,
          crewStressIndex: 92,
          o2ConsumptionKg: 6.0,
          batteryConsumptionWh: 1200,
          propellantConsumptionKg: 0,
          timelineDelayMin: 240,
        },
        contingencyFallback: {
          recommendation: 'Emergency Contingency: Safe-Mode Sun Pointing & Fast Medical Haven Entry',
          newSuccessProbability: 82,
          newFailureProbability: 18,
          actionPlan: 'Execute emergency watchdog hardware reboot and administer radioprotective amifostine to crew.',
        },
      },
    ],
  },

  {
    id: 'danger-adcs-tumble',
    name: 'ADCS Reaction Wheel Runaway & Spacecraft Tumbling',
    code: 'GNC-RWA-TUMBLE',
    category: 'GNC Attitude & Stability',
    severity: 'CRITICAL',
    affectedSubsystem: 'Reaction Wheel 3 (RWA-3) & Star Tracker Optical Lock',
    affectedCrewRegion: 'head',
    description: 'Reaction wheel 3 tachometer failure caused motor overspeed to 6,800 RPM. Spacecraft experiencing uncontrolled 3-axis rotation at 3.8°/sec.',
    timeToCriticalitySec: 150, // 2.5 mins
    telemetrySnapshot: [
      { label: 'ANGULAR VELOCITY', value: 3.84, unit: '°/s', nominal: '<0.02 °/s', status: 'critical' },
      { label: 'RWA-3 SPEED', value: 6820, unit: 'RPM', nominal: '1500 - 3500 RPM', status: 'critical' },
      { label: 'STAR TRACKER LOCK', value: 'LOST', unit: 'state', nominal: 'LOCKED', status: 'critical' },
      { label: 'SOLAR PANEL ILLUM', value: 42, unit: '%', nominal: '98 - 100%', status: 'critical' },
      { label: 'CREW VESTIBULAR / STRESS', value: 89, unit: '/100', nominal: '<25', status: 'critical' },
    ],
    availableResources: {
      o2Kg: 420,
      o2Percent: 100,
      batteryWh: 6900,
      batteryPercent: 86,
      propellantKg: 98,
      powerW: 2400,
    },
    options: [
      {
        id: 'rwa-opt-a',
        key: 'A',
        name: 'Cut RWA-3 Power, Fire Pulsed RCS Hydrazine Jets to Detumble',
        explanation: 'Electrically disengage rogue wheel RWA-3 and command 16-pulse opposing hydrazine RCS thruster firings to null body rates.',
        expectedObjective: 'Reduce angular tumbling rate below 0.05°/sec within 20 seconds and recover autonomous sun-pointing.',
        successProbability: 92,
        failureProbability: 8,
        executionTime: '20 sec',
        resourceRequirements: '2.8 kg Hydrazine RCS Propellant, 45W Solenoid Drivers',
        sideEffects: 'Consumes small amount of reaction control delta-V budget.',
        astronautSafetyImpact: 'High positive',
        missionImpact: 'Low',
        simulationConfidence: 98,
        isRecommended: true,
        whyThisOption: {
          positiveFactors: [
            'Immediate rate dampening via direct high-torque chemical thrusters',
            'Prevents solar array power loss and restores stable thermal environment',
            'Resolves crew disorientation and spatial disorientation'
          ],
          riskTradeoffs: [
            'Requires 2.8 kg hydrazine expenditure'
          ],
          rankingRationale: 'Ranked #1: Rapid, decisive stabilization with 92% success rate that guarantees vehicle recovery before battery depletion.'
        },
        simulatedOutcome: 'SUCCESS',
        outcomeNarrative: 'Spacecraft rates stabilized to 0.01°/s in 18 seconds. Star trackers acquired lock. Sun vector restored at 99.4% solar power.',
        predictedMetrics: {
          finalHealth: 96.0,
          crewHeartRateBpm: 72,
          crewSpo2Percent: 99.0,
          crewStressIndex: 26,
          o2ConsumptionKg: 0.5,
          batteryConsumptionWh: 80,
          propellantConsumptionKg: 2.8,
          timelineDelayMin: 0,
        },
      },
      {
        id: 'rwa-opt-b',
        key: 'B',
        name: 'Magnetic Torquer Rod Desaturation (No Chemical Fuel)',
        explanation: 'Attempt to counter the spin using electromagnetic dipole interaction with Earth’s geomagnetic field alone.',
        expectedObjective: 'Save chemical propellant by relying purely on electromagnetic torquing.',
        successProbability: 46,
        failureProbability: 54,
        executionTime: '8 min 30 sec',
        resourceRequirements: '120W Continuous Magnetorquer Current',
        sideEffects: 'Slow torque generation allows battery drain to reach critical levels while tumbling in shadow.',
        astronautSafetyImpact: 'High risk',
        missionImpact: 'Moderate',
        simulationConfidence: 88,
        isRecommended: false,
        whyThisOption: {
          positiveFactors: [
            'Zero chemical propellant consumed'
          ],
          riskTradeoffs: [
            'Torque output is far too low (0.05 Nm) to arrest high rate tumble quickly',
            'Vehicle will tumble through 4 complete eclipse cycles, draining batteries below 25%'
          ],
          rankingRationale: 'Ranked #2: High failure rate (54%). Magnetic torquers lack sufficient authority for dynamic runaway recovery.'
        },
        simulatedOutcome: 'UNSTABLE',
        outcomeNarrative: 'Magnetorquers failed to arrest tumble in time. Battery level dropped to 22% due to solar panel misalignment.',
        predictedMetrics: {
          finalHealth: 58.0,
          crewHeartRateBpm: 110,
          crewSpo2Percent: 97.0,
          crewStressIndex: 82,
          o2ConsumptionKg: 1.5,
          batteryConsumptionWh: 2400,
          propellantConsumptionKg: 0,
          timelineDelayMin: 90,
        },
        contingencyFallback: {
          recommendation: 'Emergency Contingency: Immediate RCS Thruster Intervene',
          newSuccessProbability: 86,
          newFailureProbability: 14,
          actionPlan: 'Fire full 4-thruster emergency deceleration burn to stop spin immediately.',
        },
      },
      {
        id: 'rwa-opt-c',
        key: 'C',
        name: 'Invert 3-Axis Gyro Matrix & Attempt Dynamic Momentum Damping',
        explanation: 'Command remaining 3 reaction wheels to absorb the angular momentum of wheel 3 through dynamic coordinate inversion.',
        expectedObjective: 'Balance internal momentum without external torque.',
        successProbability: 28,
        failureProbability: 72,
        executionTime: '1 min 15 sec',
        resourceRequirements: 'Peak Reaction Wheel Power (380W)',
        sideEffects: 'High likelihood of saturating all 4 reaction wheels simultaneously, creating uncontrolled tumble.',
        astronautSafetyImpact: 'Critical risk',
        missionImpact: 'Severe',
        simulationConfidence: 84,
        isRecommended: false,
        whyThisOption: {
          positiveFactors: [
            'Zero consumable propellant cost'
          ],
          riskTradeoffs: [
            '72% failure rate; saturates all remaining healthy wheels',
            'Severe gyroscopic precession forces on vehicle structure'
          ],
          rankingRationale: 'Ranked #3: Unsound control strategy. Saturating the full wheel cluster leaves the vehicle completely uncontrollable.'
        },
        simulatedOutcome: 'FAILURE',
        outcomeNarrative: 'Wheels 1, 2, and 4 entered speed saturation. Spacecraft tumble rate increased to 5.2°/s. Emergency safe-mode triggered.',
        predictedMetrics: {
          finalHealth: 42.0,
          crewHeartRateBpm: 130,
          crewSpo2Percent: 96.0,
          crewStressIndex: 95,
          o2ConsumptionKg: 2.0,
          batteryConsumptionWh: 1800,
          propellantConsumptionKg: 0,
          timelineDelayMin: 180,
        },
        contingencyFallback: {
          recommendation: 'Emergency Contingency: Manual RCS Override',
          newSuccessProbability: 88,
          newFailureProbability: 12,
          actionPlan: 'Command manual RCS thrust pulse package to null tumbling rates.',
        },
      },
    ],
  },
];
