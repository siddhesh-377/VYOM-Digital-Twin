/**
 * VYOM — Four Mission Profiles Architecture (Phase 5)
 * Defines specifications, subsystems, telemetry channels, KPIs, and 3D configuration
 * for Human Exploration, Orbital Observation, Planetary Probe, and Astrophysics Observatory.
 */

import { MissionType, MissionConfig, SatelliteConfig } from './mission';

export type SpacecraftModelType = 'crewed_capsule' | 'earth_observer' | 'planetary_probe' | 'space_telescope';

export interface MissionProfileDefinition {
  id: string;
  name: string;
  type: MissionType;
  modelType: SpacecraftModelType;
  destination: string;
  tagline: string;
  description: string;
  targetBody: string;
  budgetCrore: number;
  initialAltitudeKm: number;
  inclinationDeg: number;
  massKg: number;
  primaryKPIs: string[];
  subsystems: Array<{
    id: string;
    name: string;
    type: 'power' | 'thermal' | 'adcs' | 'propulsion' | 'communication' | 'payload' | 'avionics' | 'life_support';
    nominalHealth: number;
    description: string;
  }>;
  telemetryChannels: Array<{
    id: string;
    name: string;
    subsystem: string;
    unit: string;
    nominalRange: [number, number];
    warningRange: [number, number];
    criticalRange: [number, number];
  }>;
  defaultConfig: MissionConfig;
  satelliteConfig: SatelliteConfig;
}

export const MISSION_PROFILES: Record<string, MissionProfileDefinition> = {
  human: {
    id: 'human-expedition-1',
    name: 'Gaganyaan-H1 Crewed Expedition',
    type: 'human',
    modelType: 'crewed_capsule',
    destination: 'earth-orbit',
    tagline: 'Human Spaceflight & Environmental Life Support Digital Twin',
    description: 'Human orbital mission equipped with autonomous Environmental Control and Life Support System (ECLSS), crew physiological monitoring, and fail-safe re-entry systems.',
    targetBody: 'Earth',
    budgetCrore: 10500,
    initialAltitudeKm: 400.0,
    inclinationDeg: 51.6,
    massKg: 5300,
    primaryKPIs: [
      'Crew Status',
      'Cabin Pressure (kPa)',
      'Oxygen PO2 (kPa)',
      'CO2 Level (ppm)',
      'Cabin Temp (°C)',
      'Radiation (μSv/h)',
      'Bus Voltage (V)',
      'Propellant Reserve (kg)',
    ],
    subsystems: [
      { id: 'eps', name: 'Electrical Power System (EPS)', type: 'power', nominalHealth: 98, description: 'Twin deployable GaAs solar arrays and dual Li-ion battery banks' },
      { id: 'tcs', name: 'Thermal Control System (TCS)', type: 'thermal', nominalHealth: 96, description: 'Active fluid loop radiators and multi-layer thermal insulation' },
      { id: 'adcs', name: 'Attitude Control (ADCS)', type: 'adcs', nominalHealth: 99, description: 'Star trackers, sun sensors, and fine pointing reaction wheels' },
      { id: 'eclss', name: 'Life Support System (ECLSS)', type: 'life_support', nominalHealth: 97, description: 'Atmospheric revitalization, oxygen regulation, and CO2 scrubbers' },
      { id: 'comm', name: 'S-Band Telemetry & Voice', type: 'communication', nominalHealth: 100, description: 'High-reliability redundant transceivers and phased array antennas' },
      { id: 'prop', name: 'Reaction Control (RCS)', type: 'propulsion', nominalHealth: 98, description: 'Hypergolic bi-propellant thruster clusters for 6-DoF maneuvers' },
      { id: 'avionics', name: 'Flight Computer (C&DH)', type: 'avionics', nominalHealth: 100, description: 'Triple-modular redundant fault-tolerant flight management computers' },
    ],
    telemetryChannels: [
      { id: 'cabin_press', name: 'Cabin Pressure', subsystem: 'eclss', unit: 'kPa', nominalRange: [98, 103], warningRange: [90, 106], criticalRange: [75, 115] },
      { id: 'o2_partial', name: 'Oxygen Partial Pressure', subsystem: 'eclss', unit: 'kPa', nominalRange: [20, 23], warningRange: [18, 25], criticalRange: [15, 28] },
      { id: 'co2_ppm', name: 'CO2 Concentration', subsystem: 'eclss', unit: 'ppm', nominalRange: [300, 600], warningRange: [600, 1200], criticalRange: [1200, 2500] },
      { id: 'radiation_dose', name: 'Radiation Exposure', subsystem: 'eclss', unit: 'μSv/h', nominalRange: [10, 30], warningRange: [30, 80], criticalRange: [80, 200] },
      { id: 'battery_soc', name: 'Battery State of Charge', subsystem: 'eps', unit: '%', nominalRange: [75, 100], warningRange: [50, 75], criticalRange: [20, 50] },
    ],
    defaultConfig: {
      id: 'human-expedition-1',
      name: 'Gaganyaan-H1 Crewed Expedition',
      type: 'human',
      destination: 'earth-orbit',
      objective: 'Demonstrate crew safety, bio-regenerative life support, and autonomous trajectory control in Low Earth Orbit.',
      budgetCrore: 10500,
      launchSite: { name: 'Satish Dhawan Space Centre (SLP)', country: 'India', lat: 13.72, lng: 80.23, agency: 'ISRO' },
      createdAt: Date.now(),
      crew: [
        { id: 'c1', name: 'Cmdr. Prashanth Nair', role: 'Commander', heartRateBpm: 72, spo2Percent: 99, respirationBpm: 14, coreTempC: 36.8, suitPressureKpa: 101.3, radiationDoseMsv: 0.12, stressIndex: 18, status: 'nominal', activity: 'Orbital Navigation & Telemetry Audit' },
        { id: 'c2', name: 'Dr. Angad Prathap', role: 'Flight Engineer', heartRateBpm: 68, spo2Percent: 99, respirationBpm: 13, coreTempC: 36.7, suitPressureKpa: 101.3, radiationDoseMsv: 0.11, stressIndex: 15, status: 'nominal', activity: 'ECLSS Loop Diagnostic' },
        { id: 'c3', name: 'Ajit Krishnan', role: 'Mission Specialist', heartRateBpm: 74, spo2Percent: 98, respirationBpm: 15, coreTempC: 36.9, suitPressureKpa: 101.3, radiationDoseMsv: 0.13, stressIndex: 20, status: 'nominal', activity: 'Solar Flux & Radiation Calibration' },
      ],
    },
    satelliteConfig: {
      type: 'crewed_capsule',
      body: 'Cylindrical Crew Module with Conical Heatshield',
      solarPanels: 2,
      batteryCapacityWh: 15000,
      antennaGainDb: 18,
      payloadType: 'Crew Habitability & Life Support Module',
      propulsionType: 'Hypergolic MMH/N2O4 Bipropellant',
      thermalControl: 'Active Fluid Heatpipe Loop with Radiators',
      redundancy: 3,
      subsystems: [
        { name: 'Power (EPS)', health: 98, status: 'nominal', temperature: 22 },
        { name: 'Thermal (TCS)', health: 96, status: 'nominal', temperature: 20 },
        { name: 'ADCS / GNC', health: 99, status: 'nominal', temperature: 18 },
        { name: 'Life Support (ECLSS)', health: 97, status: 'nominal', temperature: 21 },
        { name: 'Communication', health: 100, status: 'nominal', temperature: 24 },
        { name: 'Propulsion', health: 98, status: 'nominal', temperature: 23 },
        { name: 'Flight Avionics', health: 100, status: 'nominal', temperature: 22 },
      ],
      dataSource: 'simulation',
    },
  },

  orbital: {
    id: 'orbital-obs-1',
    name: 'CartoSat-3D Earth Observation',
    type: 'orbital',
    modelType: 'earth_observer',
    destination: 'earth-orbit',
    tagline: 'High-Resolution Optical & SAR Remote Sensing Digital Twin',
    description: 'Sun-synchronous polar Earth observation satellite with multispectral imaging payloads, real-time geodetic ground tracking, and high-rate X-band downlink.',
    targetBody: 'Earth',
    budgetCrore: 3500,
    initialAltitudeKm: 505.0,
    inclinationDeg: 97.4,
    massKg: 1650,
    primaryKPIs: [
      'Altitude (505 km)',
      'Inclination (97.4°)',
      'Ground Track Swath',
      'Optical Payload Health',
      'Solar Panel Generation',
      'ADCS Pointing Jitter',
      'X-Band Downlink Rate',
      'Imaging Buffer Status',
    ],
    subsystems: [
      { id: 'eps', name: 'Electrical Power System (EPS)', type: 'power', nominalHealth: 99, description: 'Dual articulate solar array wings generating 2200W' },
      { id: 'tcs', name: 'Thermal Control System', type: 'thermal', nominalHealth: 98, description: 'Multi-layer insulation blankets and louvers' },
      { id: 'adcs', name: 'Precision ADCS', type: 'adcs', nominalHealth: 99, description: 'High-precision star trackers with 0.005° pointing accuracy' },
      { id: 'payload', name: 'Optical & SAR Sensor Suite', type: 'payload', nominalHealth: 97, description: '0.25m resolution panchromatic telescope and C-band SAR antenna' },
      { id: 'comm', name: 'X-Band High Speed Downlink', type: 'communication', nominalHealth: 99, description: '800 Mbps gigabit downlink to ground tracking network' },
      { id: 'prop', name: 'Orbit Maintenance Thrusters', type: 'propulsion', nominalHealth: 100, description: 'Hydrazine monopropellant thrusters for drag compensation' },
      { id: 'avionics', name: 'Payload Data Handling (PDH)', type: 'avionics', nominalHealth: 100, description: 'High-throughput solid state mass memory and image processors' },
    ],
    telemetryChannels: [
      { id: 'sensor_temp', name: 'Sensor Focal Plane Temp', subsystem: 'payload', unit: '°C', nominalRange: [-15, -5], warningRange: [-5, 5], criticalRange: [5, 25] },
      { id: 'pointing_jitter', name: 'Pointing Jitter', subsystem: 'adcs', unit: 'arcsec', nominalRange: [0.1, 0.5], warningRange: [0.5, 1.2], criticalRange: [1.2, 3.5] },
      { id: 'solar_power', name: 'Solar Generation', subsystem: 'eps', unit: 'W', nominalRange: [1800, 2400], warningRange: [1200, 1800], criticalRange: [600, 1200] },
      { id: 'data_rate', name: 'RF Downlink Bitrate', subsystem: 'comm', unit: 'Mbps', nominalRange: [600, 850], warningRange: [400, 600], criticalRange: [100, 400] },
    ],
    defaultConfig: {
      id: 'orbital-obs-1',
      name: 'CartoSat-3D Earth Observation',
      type: 'orbital',
      destination: 'earth-orbit',
      objective: 'Acquire high-resolution stereoscopic imagery and radar terrain maps for planetary environmental monitoring.',
      budgetCrore: 3500,
      launchSite: { name: 'Satish Dhawan Space Centre (FLP)', country: 'India', lat: 13.72, lng: 80.23, agency: 'ISRO' },
      createdAt: Date.now(),
    },
    satelliteConfig: {
      type: 'earth_observer',
      body: 'Hexagonal Carbon Composite Bus with Nadir Optical Aperture',
      solarPanels: 4,
      batteryCapacityWh: 9500,
      antennaGainDb: 28,
      payloadType: '0.25m Panchromatic & Hyperspectral Imager + SAR',
      propulsionType: 'Hydrazine Monopropellant Blowdown',
      thermalControl: 'Passive MLI with Active Thermal Louvers',
      redundancy: 2,
      subsystems: [
        { name: 'Power (EPS)', health: 99, status: 'nominal', temperature: 24 },
        { name: 'Thermal (TCS)', health: 98, status: 'nominal', temperature: 18 },
        { name: 'Precision ADCS', health: 99, status: 'nominal', temperature: 19 },
        { name: 'Optical/SAR Payload', health: 97, status: 'nominal', temperature: -10 },
        { name: 'High-Rate Comms', health: 99, status: 'nominal', temperature: 26 },
        { name: 'Propulsion', health: 100, status: 'nominal', temperature: 20 },
        { name: 'Avionics & PDH', health: 100, status: 'nominal', temperature: 22 },
      ],
      dataSource: 'simulation',
    },
  },

  planetary: {
    id: 'planetary-probe-1',
    name: 'Chandrayaan-4 Lunar Sample Return',
    type: 'planetary',
    modelType: 'planetary_probe',
    destination: 'lunar-surface',
    tagline: 'Deep Space Interplanetary Trajectory & Autonomous Probe Digital Twin',
    description: 'Robotic exploration spacecraft on trans-lunar trajectory with high-gain parabolic reflector, autonomous docking sensors, and sample return module.',
    targetBody: 'Moon',
    budgetCrore: 6150,
    initialAltitudeKm: 384400.0,
    inclinationDeg: 28.5,
    massKg: 3900,
    primaryKPIs: [
      'Distance to Target (km)',
      'Velocity (km/s)',
      'Trajectory Delta-V',
      'One-Way Light Time Delay',
      'High-Gain Antenna Signal',
      'Science Payload Status',
      'Propellant Tank Pressure',
      'Thermal Shield Gradient',
    ],
    subsystems: [
      { id: 'eps', name: 'Power & RTG Management', type: 'power', nominalHealth: 98, description: 'Gallium arsenide solar panels and auxiliary radioisotope heater units' },
      { id: 'tcs', name: 'Deep Space Thermal Insulation', type: 'thermal', nominalHealth: 97, description: 'Cryogenic shield and high-emissivity radiation radiators' },
      { id: 'adcs', name: 'Autonomous Deep Space Nav', type: 'adcs', nominalHealth: 99, description: 'Optical terrain relative navigation and autonomous guidance sensors' },
      { id: 'payload', name: 'Lunar Surface & Science Suite', type: 'payload', nominalHealth: 98, description: 'Core drill, mineral spectrometer, and robotic sample container' },
      { id: 'comm', name: 'High-Gain Deep Space Antenna', type: 'communication', nominalHealth: 99, description: '2.5m steerable parabolic reflector with DSN X/Ka-band link' },
      { id: 'prop', name: 'Liquid Apogee & RCS Engine', type: 'propulsion', nominalHealth: 97, description: '440N liquid apogee motor + 8x 22N attitude thrusters' },
      { id: 'avionics', name: 'Autonomous Flight Computer', type: 'avionics', nominalHealth: 100, description: 'Rad-hard autonomous navigation and docking computer' },
    ],
    telemetryChannels: [
      { id: 'dist_target', name: 'Distance to Target', subsystem: 'adcs', unit: 'km', nominalRange: [1000, 384400], warningRange: [500, 1000], criticalRange: [50, 500] },
      { id: 'owlt_delay', name: 'Signal Latency (OWLT)', subsystem: 'comm', unit: 's', nominalRange: [1.0, 1.5], warningRange: [1.5, 3.0], criticalRange: [3.0, 10.0] },
      { id: 'tank_press', name: 'Propellant Tank Pressure', subsystem: 'prop', unit: 'bar', nominalRange: [16, 20], warningRange: [13, 16], criticalRange: [9, 13] },
      { id: 'hga_snr', name: 'High-Gain Link SNR', subsystem: 'comm', unit: 'dB', nominalRange: [14, 22], warningRange: [8, 14], criticalRange: [3, 8] },
    ],
    defaultConfig: {
      id: 'planetary-probe-1',
      name: 'Chandrayaan-4 Lunar Sample Return',
      type: 'planetary',
      destination: 'lunar-surface',
      objective: 'Execute precision soft-landing at the lunar south pole, collect core regolith samples, and perform automated trans-Earth injection.',
      budgetCrore: 6150,
      launchSite: { name: 'Satish Dhawan Space Centre (SLP)', country: 'India', lat: 13.72, lng: 80.23, agency: 'ISRO' },
      createdAt: Date.now(),
    },
    satelliteConfig: {
      type: 'planetary_probe',
      body: 'Octagonal Deep Space Bus with Center Engine Column',
      solarPanels: 3,
      batteryCapacityWh: 12000,
      antennaGainDb: 36,
      payloadType: 'Robotic Surface Drill & Sample Return Capsule',
      propulsionType: 'Bi-propellant MMH/MON-3 Liquid Apogee Engine',
      thermalControl: 'Multi-layer Thermal Blankets and RHUs',
      redundancy: 3,
      subsystems: [
        { name: 'Power System', health: 98, status: 'nominal', temperature: 15 },
        { name: 'Deep Space Thermal', health: 97, status: 'nominal', temperature: 5 },
        { name: 'Autonomous Nav / ADCS', health: 99, status: 'nominal', temperature: 16 },
        { name: 'Science Payload', health: 98, status: 'nominal', temperature: 10 },
        { name: 'High-Gain Comms', health: 99, status: 'nominal', temperature: 20 },
        { name: 'Liquid Propulsion', health: 97, status: 'nominal', temperature: 18 },
        { name: 'Avionics & C&DH', health: 100, status: 'nominal', temperature: 19 },
      ],
      dataSource: 'simulation',
    },
  },

  astrophysics: {
    id: 'astrophysics-obs-1',
    name: 'AstroSat-II Space Observatory',
    type: 'astrophysics',
    modelType: 'space_telescope',
    destination: 'lagrange-l1',
    tagline: 'Deep Space Astronomical Observatory & Exoplanet Digital Twin',
    description: 'Space-based optical, ultraviolet, and X-ray telescope in halo orbit with cryogenic instrument bay, multi-layer sunshield, and sub-arcsecond pointing stability.',
    targetBody: 'Crab Nebula (NGC 1952)',
    budgetCrore: 4200,
    initialAltitudeKm: 1500000.0,
    inclinationDeg: 15.0,
    massKg: 2800,
    primaryKPIs: [
      'Observation Target (RA/Dec)',
      'Pointing Stability (0.01")',
      'Detector Cryo Temp (45K)',
      'Primary Mirror Alignment',
      'Sunshield Temperature Gradient',
      'Deep Space Link Margin',
      'Science Data FIFO Rate',
      'Observation Duty Cycle',
    ],
    subsystems: [
      { id: 'eps', name: 'EPS & Solar Shield Power', type: 'power', nominalHealth: 99, description: 'Sunshield integrated solar array providing continuous 1800W' },
      { id: 'tcs', name: 'Cryogenic Thermal Enclosure', type: 'thermal', nominalHealth: 98, description: '5-layer Kapton sunshield maintaining 45K cryogenic detector bay' },
      { id: 'adcs', name: 'Ultra-Fine Guidance ADCS', type: 'adcs', nominalHealth: 100, description: 'Fine guidance sensors and isolated low-vibration reaction wheels' },
      { id: 'payload', name: '2.4m Optical / UV Telescope', type: 'payload', nominalHealth: 99, description: 'Ritchey-Chrétien telescope with infrared spectrometer and UV imager' },
      { id: 'comm', name: 'Deep Space Ka-Band Comm', type: 'communication', nominalHealth: 98, description: 'High-throughput science data downlink to terrestrial observatories' },
      { id: 'prop', name: 'Halo Station-Keeping Thrusters', type: 'propulsion', nominalHealth: 100, description: 'Cold gas micro-thrusters for perturbation compensation' },
      { id: 'avionics', name: 'Science Data Processing Unit', type: 'avionics', nominalHealth: 100, description: 'Real-time wavefront sensing and detector calibration processors' },
    ],
    telemetryChannels: [
      { id: 'cryo_temp', name: 'Detector Cryo Temp', subsystem: 'tcs', unit: 'K', nominalRange: [40, 50], warningRange: [50, 70], criticalRange: [70, 110] },
      { id: 'pointing_err', name: 'Pointing Drift', subsystem: 'adcs', unit: 'arcsec', nominalRange: [0.01, 0.05], warningRange: [0.05, 0.2], criticalRange: [0.2, 1.0] },
      { id: 'science_fifo', name: 'Science Data Buffer', subsystem: 'payload', unit: 'GB', nominalRange: [10, 80], warningRange: [80, 110], criticalRange: [110, 128] },
      { id: 'mirror_align', name: 'Optical Alignment', subsystem: 'payload', unit: 'nm', nominalRange: [5, 20], warningRange: [20, 50], criticalRange: [50, 150] },
    ],
    defaultConfig: {
      id: 'astrophysics-obs-1',
      name: 'AstroSat-II Space Observatory',
      type: 'astrophysics',
      destination: 'lagrange-l1',
      objective: 'Conduct multi-wavelength spectroscopic surveys of high-redshift active galactic nuclei and characterize exoplanetary atmospheric signatures.',
      budgetCrore: 4200,
      launchSite: { name: 'Guiana Space Centre (ELA-4)', country: 'French Guiana', lat: 5.24, lng: -52.77, agency: 'ESA' },
      createdAt: Date.now(),
    },
    satelliteConfig: {
      type: 'space_telescope',
      body: 'Cylindrical Optical Tube Assembly with Layered Sunshield Palette',
      solarPanels: 2,
      batteryCapacityWh: 11000,
      antennaGainDb: 32,
      payloadType: '2.4m Ritchey-Chrétien Optical/UV/X-Ray Spectrograph',
      propulsionType: 'Cold Gas Micro-Thrusters (0.01N)',
      thermalControl: '5-Layer Sunshield & Closed-Cycle Cryocooler',
      redundancy: 3,
      subsystems: [
        { name: 'Power (EPS)', health: 99, status: 'nominal', temperature: -20 },
        { name: 'Cryogenic TCS', health: 98, status: 'nominal', temperature: -228 }, // 45 Kelvin
        { name: 'Fine Guidance ADCS', health: 100, status: 'nominal', temperature: 10 },
        { name: '2.4m Telescope Payload', health: 99, status: 'nominal', temperature: -50 },
        { name: 'Ka-Band Downlink', health: 98, status: 'nominal', temperature: 15 },
        { name: 'Station-Keeping Prop', health: 100, status: 'nominal', temperature: 12 },
        { name: 'Avionics & C&DH', health: 100, status: 'nominal', temperature: 18 },
      ],
      dataSource: 'simulation',
    },
  },
};
