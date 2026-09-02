/**
 * VYOM — Mission Launch & Deployment Cinematic Configurations
 * Authoritative video paths, phase titles, descriptions, and spacecraft models for all 4 mission profiles.
 */

import type { MissionType } from '../types/mission';
import type { SpacecraftModelType } from '../types/missionProfiles';

export interface MissionPhaseDetail {
  phaseTitle: string;
  badgeLabel: string;
  description: string;
  videoUrl: string;
  subsystemHighlights: string[];
}

export interface MissionCinematicConfig {
  type: MissionType;
  title: string;
  subtitle: string;
  accentColor: string;
  modelType: SpacecraftModelType;
  launch: MissionPhaseDetail;
  deployment: MissionPhaseDetail;
}

export const MISSION_CINEMATICS: Record<MissionType, MissionCinematicConfig> = {
  human: {
    type: 'human',
    title: 'HUMAN EXPLORATION',
    subtitle: 'Crewed Lunar & Deep Space Mission',
    accentColor: '#00ff88',
    modelType: 'crewed_capsule',
    launch: {
      phaseTitle: 'LAUNCH & ASCENT',
      badgeLabel: 'PHASE 01: POWERED ASCENT',
      description: 'Launch and ascent of the crewed exploration spacecraft toward low Earth orbit.',
      videoUrl: '/animations/Human exploration mission launching.mp4',
      subsystemHighlights: ['First Stage Ignition', 'Max-Q Transonic Barrier', 'Booster Separation', 'Crew Abort System Armed'],
    },
    deployment: {
      phaseTitle: 'ORBITAL INSERTION & DEPLOYMENT',
      badgeLabel: 'PHASE 02: ORBITAL INSERTION',
      description: 'Spacecraft deployment and orbital insertion prepare the vehicle for crewed exploration operations.',
      videoUrl: '/animations/Human exploration mission deployment.mp4',
      subsystemHighlights: ['Service Module Separation', 'Twin Solar Wing Deployment', 'ECLSS Pressurization', 'Guidance Sync'],
    },
  },
  orbital: {
    type: 'orbital',
    title: 'ORBITAL OBSERVATION',
    subtitle: 'Earth Telemetry & Satellite Constellation',
    accentColor: '#00d4ff',
    modelType: 'earth_observer',
    launch: {
      phaseTitle: 'ORBITAL LAUNCH',
      badgeLabel: 'PHASE 01: VEHICLE LAUNCH',
      description: 'Launch of the Earth-observation spacecraft into its operational orbital trajectory.',
      videoUrl: '/animations/orbital observation launching.mp4',
      subsystemHighlights: ['Core Stage Firing', 'Atmospheric Ascent', 'Payload Fairing Jettison', 'Guidance Telemetry Lock'],
    },
    deployment: {
      phaseTitle: 'SATELLITE DEPLOYMENT',
      badgeLabel: 'PHASE 02: SOLAR ARRAY ACTIVATION',
      description: 'Satellite deployment and solar-array activation prepare the spacecraft for Earth observation.',
      videoUrl: '/animations/orbital mission deployment.mp4',
      subsystemHighlights: ['Clamp Band Release', 'Gallium Arsenide Array Unlock', 'SAR Antenna Deployment', 'Nadir Earth Lock'],
    },
  },
  planetary: {
    type: 'planetary',
    title: 'PLANETARY PROBE',
    subtitle: 'Mars & Solar System Exploration',
    accentColor: '#ff8c00',
    modelType: 'planetary_probe',
    launch: {
      phaseTitle: 'TRANS-PLANETARY INJECTION',
      badgeLabel: 'PHASE 01: ORBITAL DEPARTURE',
      description: 'Launch and orbital departure initiate the spacecraft\'s journey toward its planetary destination.',
      videoUrl: '/animations/planetary probe mission launching.mp4',
      subsystemHighlights: ['Heavy Launch Vehicle Ascent', 'Upper Stage Restart', 'Earth Escape Velocity (11.2 km/s)', 'Deep Space Trajectory'],
    },
    deployment: {
      phaseTitle: 'DEEP-SPACE DEPLOYMENT',
      badgeLabel: 'PHASE 02: CRUISE STABILIZATION',
      description: 'Deep-space deployment establishes the probe for interplanetary cruise and scientific exploration.',
      videoUrl: '/animations/planetory probe deployment.mp4',
      subsystemHighlights: ['Aeroshell Separation', 'High-Gain Parabolic Dish Open', 'Magnetometer Boom Lock', 'RTG Power Nominal'],
    },
  },
  astrophysics: {
    type: 'astrophysics',
    title: 'ASTROPHYSICS OBSERVATORY',
    subtitle: 'Deep Space Cosmic Telescope',
    accentColor: '#9b5de5',
    modelType: 'space_telescope',
    launch: {
      phaseTitle: 'OBSERVATORY LAUNCH',
      badgeLabel: 'PHASE 01: OBSERVATORY ASCENT',
      description: 'Launch of the space observatory toward its designated observation environment.',
      videoUrl: '/animations/Astrophysics mission launching.mp4',
      subsystemHighlights: ['Cleanroom Fairing Lift', 'Trans-Lagrange Insertion Burn', 'Spacecraft Separation', 'Star Tracker Initialized'],
    },
    deployment: {
      phaseTitle: 'TELESCOPE & SUNSHIELD DEPLOYMENT',
      badgeLabel: 'PHASE 02: OPTICAL COMMISSIONING',
      description: 'Telescope and spacecraft systems deploy and stabilize for deep-space astronomical observations.',
      videoUrl: '/animations/astrophysics mission deployment.mp4',
      subsystemHighlights: ['Kapton Sunshield Tensioning', 'Secondary Mirror Latch', 'Cryogenic Cooler Startup', 'Deep-Field Alignment'],
    },
  },
};

export function getMissionCinematic(type?: MissionType): MissionCinematicConfig {
  if (type && MISSION_CINEMATICS[type]) {
    return MISSION_CINEMATICS[type];
  }
  return MISSION_CINEMATICS.orbital;
}
