import React, { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import type { CrewMember } from '../../types/mission';
import {
  CrewAnatomyScene,
  PhysiologicalMode,
  BodyRegionId,
  getThermalColor,
  getPressureColor,
  getVitalColor,
} from '../three/CrewAnatomyScene';
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
} from 'recharts';

const ROLES: CrewMember['role'][] = [
  'Commander',
  'Lunar Module Pilot',
  'Flight Engineer',
  'Mission Specialist',
  'Medical Officer',
  'Payload Commander',
];

const MODES: { id: PhysiologicalMode; label: string; icon: string }[] = [
  { id: 'temperature', label: 'THERMAL / TEMP', icon: '🌡️' },
  { id: 'pressure', label: 'CONTACT PRESSURE', icon: '🎯' },
  { id: 'cardio', label: 'CARDIOVASCULAR', icon: '❤️' },
  { id: 'respiratory', label: 'RESPIRATORY', icon: '🫁' },
  { id: 'fatigue', label: 'FATIGUE & NEURO', icon: '⚡' },
  { id: 'radiation', label: 'RADIATION', icon: '☢️' },
  { id: 'eclss', label: 'SUIT & ECLSS', icon: '🛡️' },
];

export function CrewScreen() {
  const crew = useMissionStore((s) => s.crew);
  const config = useMissionStore((s) => s.config);
  const setCrew = useMissionStore((s) => s.setCrew);
  const updateCrewMember = useMissionStore((s) => s.updateCrewMember);
  const environment = useMissionStore((s) => s.environment);
  const crewVitalsHistory = useMissionStore((s) => s.crewVitalsHistory);
  const missionDay = useMissionStore((s) => s.missionDay);

  // Active Astronaut & 3D Twin Controls
  const [selectedCrewId, setSelectedCrewId] = useState<string>(crew[0]?.id || 'c-1');
  const [activeMode, setActiveMode] = useState<PhysiologicalMode>('temperature');
  const [selectedRegion, setSelectedRegion] = useState<BodyRegionId>('chest');
  const [xRay, setXRay] = useState(false);
  const [showHotspots, setShowHotspots] = useState(true);
  const [autoRotate, setAutoRotate] = useState(false);

  // Timeline scrubber state
  const [timelineDay, setTimelineDay] = useState<number>(Math.floor(missionDay || 1));
  const [historyMetric, setHistoryMetric] = useState<
    'heartRateBpm' | 'spo2Percent' | 'respirationBpm' | 'coreTempC' | 'stressIndex' | 'fatigueIndex' | 'radiationDoseMsv'
  >('heartRateBpm');

  // Modal State
  const [showAddModal, setShowAddModal] = useState(false);
  const [newAstronautName, setNewAstronautName] = useState('');
  const [newAstronautRole, setNewAstronautRole] = useState<CrewMember['role']>('Mission Specialist');

  const selectedMember: CrewMember = useMemo(() => {
    return crew.find((c) => c.id === selectedCrewId) || crew[0] || {
      id: 'c-1',
      name: 'Astronaut (Prime)',
      role: 'Commander',
      heartRateBpm: 74,
      spo2Percent: 99.1,
      respirationBpm: 14,
      coreTempC: 36.8,
      suitPressureKpa: 29.6,
      radiationDoseMsv: 0.14,
      stressIndex: 20,
      fatigueIndex: 18,
      hydrationPercent: 94,
      status: 'nominal',
      activity: 'EVA Surface Exploration',
    };
  }, [crew, selectedCrewId]);

  // Selected Body Region Detailed Diagnostics
  const regionDetails = useMemo(() => {
    const core = selectedMember.coreTempC ?? 36.8;
    const hr = selectedMember.heartRateBpm ?? 74;
    const stress = selectedMember.stressIndex ?? 20;
    const fatigue = selectedMember.fatigueIndex ?? 18;
    const rad = selectedMember.radiationDoseMsv ?? 0.14;

    const data: Record<BodyRegionId, {
      title: string;
      temp: number;
      tempLimits: [number, number];
      pressure: number;
      pressureLimits: [number, number];
      fatigue: number;
      radiation: number;
      loadStatus: 'nominal' | 'caution' | 'warning' | 'critical';
      recommendation: string;
      details: string;
    }> = {
      head: {
        title: 'Helmet & Cranial / Neural Matrix',
        temp: core + 0.1,
        tempLimits: [36.5, 37.5],
        pressure: 22.4,
        pressureLimits: [18.0, 26.0],
        fatigue: stress * 0.8,
        radiation: rad * 1.1,
        loadStatus: stress > 65 ? 'warning' : 'nominal',
        recommendation: stress > 65 ? 'Implement 15-minute cognitive rest cycle. Verify HUD brightness.' : 'All cranial and helmet interface parameters nominal.',
        details: 'Tracks intracranial perfusion, EEG cognitive workload, helmet neck-ring latch integrity, and visor thermal gradient.',
      },
      chest: {
        title: 'Hard Upper Torso (Cardio/Pulmonary Core)',
        temp: core,
        tempLimits: [36.6, 37.4],
        pressure: 31.2,
        pressureLimits: [24.0, 36.0],
        fatigue: fatigue * 0.6,
        radiation: rad,
        loadStatus: hr > 105 ? 'critical' : hr > 90 ? 'caution' : 'nominal',
        recommendation: hr > 100 ? 'Reduce EVA physical cadence. Administer 100% O2 flow and monitor ECG.' : 'Cardiopulmonary dynamics within safe flight envelope.',
        details: 'Hard Upper Torso (HUT) chest cuirass, ECG lead telemetry, pulmonary gas exchange, and Displays and Control Module (DCM).',
      },
      plss: {
        title: 'Primary Life Support System (PLSS Backpack)',
        temp: 16.4,
        tempLimits: [12.0, 22.0],
        pressure: selectedMember.suitPressureKpa ?? 29.6,
        pressureLimits: [28.0, 32.0],
        fatigue: 0,
        radiation: rad * 0.7,
        loadStatus: (selectedMember.suitPressureKpa ?? 29.6) < 26 ? 'critical' : 'nominal',
        recommendation: (selectedMember.suitPressureKpa ?? 29.6) < 26 ? 'EMERGENCY: Secondary O2 actuator activation required. Return to airlock.' : 'PLSS dual oxygen tanks and sublimator loop operating optimally.',
        details: 'Houses primary and secondary high-pressure O2 cylinders, water sublimator radiator, LiOH CO2 scrubber, and telemetry transceiver.',
      },
      abdomen: {
        title: 'Lower Abdomen & Core Visceral Hydration',
        temp: core - 0.2,
        tempLimits: [36.4, 37.3],
        pressure: 24.1,
        pressureLimits: [20.0, 30.0],
        fatigue: fatigue * 0.7,
        radiation: rad * 0.9,
        loadStatus: 'nominal',
        recommendation: 'Core hydration reserves satisfactory. Continue scheduled fluid intake (250 mL/h).',
        details: 'Monitors core hydration index, digestive perfusion, and flexible Lower Torso Assembly (LTA) waist disconnect ring.',
      },
      arm_left: {
        title: 'Left Arm & Rotary Joint Bearing',
        temp: core - 1.2,
        tempLimits: [34.5, 36.5],
        pressure: 28.6,
        pressureLimits: [20.0, 34.0],
        fatigue: fatigue,
        radiation: rad * 1.05,
        loadStatus: fatigue > 70 ? 'caution' : 'nominal',
        recommendation: 'Rotary bearing friction nominal. Forearm computer displays active telemetry stream.',
        details: 'Shoulder dual-axis bearing, forearm telemetry status cuff, and Phase VI thermal micrometeoroid garment (TMG) sleeve.',
      },
      arm_right: {
        title: 'Right Arm & Tool Operation Assembly',
        temp: core - 1.1,
        tempLimits: [34.5, 36.5],
        pressure: 27.9,
        pressureLimits: [20.0, 34.0],
        fatigue: fatigue * 1.1,
        radiation: rad * 1.05,
        loadStatus: fatigue > 75 ? 'caution' : 'nominal',
        recommendation: 'Ensure periodic wrist release during power tool usage to reduce flexor fatigue.',
        details: 'Right arm assembly with reinforced elbow joint, tool tether attachment points, and bio-strain gauges.',
      },
      hand_left: {
        title: 'Left Extravehicular Phase VI Glove',
        temp: core - 2.8,
        tempLimits: [32.0, 35.5],
        pressure: 34.8,
        pressureLimits: [22.0, 40.0],
        fatigue: fatigue * 1.2,
        radiation: rad * 1.2,
        loadStatus: 'nominal',
        recommendation: 'Glove heater element at 40% duty cycle. Tactile feedback nominal.',
        details: 'Phase VI EVA glove with silicone grip palm matrix, active resistive fingertip heaters, and wrist quick-disconnect.',
      },
      hand_right: {
        title: 'Right Extravehicular Phase VI Glove',
        temp: core - 2.6,
        tempLimits: [32.0, 35.5],
        pressure: 36.2,
        pressureLimits: [22.0, 40.0],
        fatigue: fatigue * 1.3,
        radiation: rad * 1.2,
        loadStatus: fatigue > 75 ? 'warning' : 'nominal',
        recommendation: fatigue > 75 ? 'High grip strain detected. Pause heavy torque operations for 5 minutes.' : 'Grip force and fingertip thermal parameters nominal.',
        details: 'Integrated tactile strain sensors, thumb joint thermal insulation, and carabiner lanyard tether.',
      },
      hips: {
        title: 'Lower Torso Assembly (LTA) & Hips',
        temp: core - 0.6,
        tempLimits: [35.5, 37.0],
        pressure: 32.5,
        pressureLimits: [22.0, 38.0],
        fatigue: fatigue * 0.8,
        radiation: rad * 0.85,
        loadStatus: 'nominal',
        recommendation: 'Harness contact distribution balanced. No localized pressure pinching detected.',
        details: 'Flexible waist joint, seat retention harness contact points, and biological waste containment umbilical.',
      },
      leg_left: {
        title: 'Left Leg & Knee Articulation Joint',
        temp: core - 1.4,
        tempLimits: [34.0, 36.5],
        pressure: 26.4,
        pressureLimits: [18.0, 35.0],
        fatigue: fatigue * 0.9,
        radiation: rad * 0.95,
        loadStatus: 'nominal',
        recommendation: 'Knee articulation torque nominal. TMG gaiter intact.',
        details: 'Dual-axis knee joint flex bellows, thigh utility pocket, and suit pressure containment bladder.',
      },
      leg_right: {
        title: 'Right Leg & Knee Articulation Joint',
        temp: core - 1.3,
        tempLimits: [34.0, 36.5],
        pressure: 27.1,
        pressureLimits: [18.0, 35.0],
        fatigue: fatigue * 0.9,
        radiation: rad * 0.95,
        loadStatus: 'nominal',
        recommendation: 'Lower extremity circulation and suit pressure containment normal.',
        details: 'Right leg pressure restraint layer, knee joint rotary bearings, and surface geology tool clip.',
      },
      feet: {
        title: 'Lunar / Orbital EVA Traction Boots',
        temp: core - 3.2,
        tempLimits: [31.0, 35.0],
        pressure: 42.1,
        pressureLimits: [20.0, 50.0],
        fatigue: fatigue * 0.75,
        radiation: rad * 1.3,
        loadStatus: 'nominal',
        recommendation: 'Footbed ground contact pressure evenly distributed. Bootie thermal insulation intact.',
        details: 'Reinforced silicone tread sole, heel retention locking lugs for foot restraints, and multi-layer insulation bootie.',
      },
    };

    return data[selectedRegion] || data.chest;
  }, [selectedMember, selectedRegion]);

  // Handle Add Astronaut
  const handleAddAstronaut = () => {
    if (!newAstronautName.trim()) return;
    const newMember: CrewMember = {
      id: `c-${Date.now()}`,
      name: newAstronautName.trim(),
      role: newAstronautRole,
      heartRateBpm: 72,
      spo2Percent: 99.2,
      respirationBpm: 14,
      coreTempC: 36.8,
      suitPressureKpa: 29.6,
      radiationDoseMsv: 0.12,
      stressIndex: 18,
      fatigueIndex: 15,
      hydrationPercent: 95,
      status: 'nominal',
      activity: 'Scientific Payload Operations',
    };
    setCrew([...crew, newMember]);
    setSelectedCrewId(newMember.id);
    setNewAstronautName('');
    setShowAddModal(false);
  };

  // Toggle EVA status
  const handleToggleEVA = () => {
    const isEVA = selectedMember.status === 'eva';
    updateCrewMember(selectedMember.id, {
      status: isEVA ? 'nominal' : 'eva',
      activity: isEVA ? 'IVA Operations & Systems Check' : 'EVA Surface Extravehicular Sortie',
      suitPressureKpa: isEVA ? 101.3 : 29.6,
    });
  };

  // Simulated Historical Vitals Data for Timeline
  const vitalsHistoryData = useMemo(() => {
    const history = crewVitalsHistory[selectedMember.id] || [];
    if (history.length > 5) {
      return history.map((h, i) => ({
        day: h.missionDay ?? i,
        heartRateBpm: h.heartRateBpm,
        spo2Percent: h.spo2Percent,
        respirationBpm: h.respirationBpm,
        coreTempC: h.coreTempC,
        stressIndex: h.stressIndex,
        fatigueIndex: h.fatigueIndex ?? 15,
        radiationDoseMsv: h.radiationDoseMsv,
      }));
    }
    // Synthetic 14-day mission profile
    return Array.from({ length: 15 }, (_, i) => ({
      day: i + 1,
      heartRateBpm: 70 + Math.sin(i * 0.8) * 8 + (i === 7 ? 22 : 0),
      spo2Percent: 99.2 - Math.cos(i * 0.5) * 0.6,
      respirationBpm: 14 + Math.sin(i * 0.7) * 2,
      coreTempC: 36.8 + Math.sin(i * 0.9) * 0.3,
      stressIndex: 15 + Math.sin(i * 0.6) * 12 + (i === 7 ? 28 : 0),
      fatigueIndex: 12 + i * 2.2,
      radiationDoseMsv: 0.02 + i * 0.012,
    }));
  }, [crewVitalsHistory, selectedMember.id]);

  // Detect Active Physiological Anomaly
  const activeAnomaly = useMemo(() => {
    const hr = selectedMember.heartRateBpm ?? 74;
    const spo2 = selectedMember.spo2Percent ?? 99;
    const temp = selectedMember.coreTempC ?? 36.8;
    const stress = selectedMember.stressIndex ?? 20;

    if (hr > 110) {
      return {
        severity: 'CRITICAL' as const,
        title: 'TACHYCARDIA & CARDIOVASCULAR STRAIN',
        color: '#ff2d55',
        message: `Heart rate spiked to ${hr} BPM under elevated physical exertion. Potential cardiac overwork.`,
        action: 'Mandate immediate rest. Increase LCVG cooling water flow and enrich breathing loop O2.',
      };
    }
    if (spo2 < 94) {
      return {
        severity: 'CRITICAL' as const,
        title: 'HYPOXIA WARNING (LOW SpO2)',
        color: '#ff2d55',
        message: `Blood oxygen saturation dropped to ${spo2.toFixed(1)}%. Partial pressure of O2 below nominal threshold.`,
        action: 'Inspect PLSS O2 regulator line. Check suit seal and increase emergency O2 purge.',
      };
    }
    if (temp > 38.0) {
      return {
        severity: 'WARNING' as const,
        title: 'HYPERTHERMIA / CORE THERMAL SPIKE',
        color: '#ff8c00',
        message: `Core temperature elevated at ${temp.toFixed(1)} °C. Liquid Cooling Garment heat extraction insufficient.`,
        action: 'Increase sublimation chiller rate. Reduce metabolic activity cadence.',
      };
    }
    if (stress > 65) {
      return {
        severity: 'CAUTION' as const,
        title: 'HIGH COGNITIVE & NEURAL STRESS',
        color: '#ff8c00',
        message: `Stress index at ${stress}%. Prolonged complex operational task load detected.`,
        action: 'Initiate telemetry debriefing. Re-allocate secondary non-critical tasks to ground control.',
      };
    }
    return null;
  }, [selectedMember]);

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#020409', padding: '20px 24px 80px', color: '#fff' }}>
      
      {/* ─── 1. SIMULATED TELEMETRY DISCLAIMER ─── */}
      <div style={{
        padding: '8px 16px', marginBottom: 16,
        background: 'rgba(0,212,255,0.05)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 8,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', animation: 'pulse-dot 1.5s infinite' }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'rgba(255,255,255,0.7)' }}>
            DIGITAL TWIN TELEMETRY STREAM: <strong style={{ color: '#00d4ff' }}>3D SPATIAL ANATOMY KERNEL ACTIVE</strong> · DATA STATUS: <strong style={{ color: '#00ff88' }}>AUTHORITATIVE SIMULATION</strong>
          </span>
        </div>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)' }}>
          MISSION CLOCK: DAY {Number(missionDay || 1).toFixed(2)} · MISSION CONTROL SYNC OK
        </span>
      </div>

      {/* ─── 2. TOP COMMAND BAR: ASTRONAUT SELECTOR & OVERLAY MODES ─── */}
      <div style={{
        background: 'rgba(5,15,30,0.95)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 12,
        padding: '16px 20px', marginBottom: 18, display: 'flex', flexDirection: 'column', gap: 14,
      }}>
        {/* Row 1: Astronaut Switching Tabs */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.15em' }}>
              ACTIVE CREW TWIN:
            </span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {crew.map((member) => {
                const isSelected = member.id === selectedMember.id;
                const isEVA = member.status === 'eva';
                return (
                  <button
                    key={member.id}
                    onClick={() => setSelectedCrewId(member.id)}
                    style={{
                      padding: '7px 14px', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s',
                      background: isSelected ? 'rgba(0,212,255,0.2)' : 'rgba(0,0,0,0.35)',
                      border: `1px solid ${isSelected ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
                      color: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.6)',
                      fontFamily: 'var(--font-mono)', fontSize: 10, display: 'flex', alignItems: 'center', gap: 8,
                    }}
                  >
                    <div style={{ width: 6, height: 6, borderRadius: '50%', background: isEVA ? '#ff8c00' : isSelected ? '#00ff88' : 'rgba(255,255,255,0.3)' }} />
                    <span style={{ fontWeight: isSelected ? 700 : 400 }}>{member.name}</span>
                    <span style={{ fontSize: 8, opacity: 0.6 }}>({member.role})</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div style={{ display: 'flex', gap: 8 }}>
            <button
              onClick={handleToggleEVA}
              style={{
                padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9,
                background: selectedMember.status === 'eva' ? 'rgba(255,140,0,0.2)' : 'rgba(0,212,255,0.12)',
                border: `1px solid ${selectedMember.status === 'eva' ? '#ff8c00' : 'rgba(0,212,255,0.4)'}`,
                color: selectedMember.status === 'eva' ? '#ff8c00' : '#00d4ff',
              }}
            >
              {selectedMember.status === 'eva' ? '⚡ EVA IN PROGRESS (29.6 kPa)' : '🛰️ DEPLOY EVA SPACESUIT'}
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              style={{
                padding: '7px 14px', borderRadius: 6, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 9,
                background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.4)', color: '#00ff88',
              }}
            >
              + ADD CREW
            </button>
          </div>
        </div>

        {/* Row 2: 7 Physiological Mode Selectors */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 12, flexWrap: 'wrap', gap: 10 }}>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {MODES.map((m) => {
              const isActive = activeMode === m.id;
              return (
                <button
                  key={m.id}
                  onClick={() => setActiveMode(m.id)}
                  style={{
                    padding: '6px 12px', borderRadius: 6, cursor: 'pointer', transition: 'all 0.2s',
                    background: isActive ? 'linear-gradient(135deg, rgba(0,212,255,0.25) 0%, rgba(155,93,229,0.25) 100%)' : 'rgba(0,0,0,0.25)',
                    border: `1px solid ${isActive ? '#00d4ff' : 'rgba(255,255,255,0.08)'}`,
                    color: isActive ? '#fff' : 'rgba(255,255,255,0.5)',
                    fontFamily: 'var(--font-mono)', fontSize: 9, display: 'flex', alignItems: 'center', gap: 6,
                    fontWeight: isActive ? 700 : 400,
                  }}
                >
                  <span>{m.icon}</span>
                  <span>{m.label}</span>
                </button>
              );
            })}
          </div>

          {/* 3D Scene Interactive Viewport Toggles */}
          <div style={{ display: 'flex', gap: 6 }}>
            <button
              onClick={() => setXRay(!xRay)}
              style={{
                padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 8.5,
                background: xRay ? 'rgba(155,93,229,0.3)' : 'rgba(0,0,0,0.3)',
                border: `1px solid ${xRay ? '#9b5de5' : 'rgba(255,255,255,0.1)'}`,
                color: xRay ? '#9b5de5' : 'rgba(255,255,255,0.5)',
              }}
            >
              👁️ X-RAY ANATOMY {xRay ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setShowHotspots(!showHotspots)}
              style={{
                padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 8.5,
                background: showHotspots ? 'rgba(0,212,255,0.2)' : 'rgba(0,0,0,0.3)',
                border: `1px solid ${showHotspots ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
                color: showHotspots ? '#00d4ff' : 'rgba(255,255,255,0.5)',
              }}
            >
              📍 3D HOTSPOTS {showHotspots ? 'ON' : 'OFF'}
            </button>
            <button
              onClick={() => setAutoRotate(!autoRotate)}
              style={{
                padding: '5px 10px', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 8.5,
                background: autoRotate ? 'rgba(0,255,136,0.2)' : 'rgba(0,0,0,0.3)',
                border: `1px solid ${autoRotate ? '#00ff88' : 'rgba(255,255,255,0.1)'}`,
                color: autoRotate ? '#00ff88' : 'rgba(255,255,255,0.5)',
              }}
            >
              🔄 360° ORBIT {autoRotate ? 'ON' : 'OFF'}
            </button>
          </div>
        </div>
      </div>

      {/* ─── 3. ACTIVE ANOMALY ALERT BANNER ─── */}
      <AnimatePresence>
        {activeAnomaly && (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            style={{
              padding: '14px 20px', marginBottom: 18, borderRadius: 10,
              background: `${activeAnomaly.color}15`, border: `1px solid ${activeAnomaly.color}66`,
              display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12,
            }}
          >
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 4 }}>
                <span style={{
                  padding: '2px 8px', borderRadius: 4, background: activeAnomaly.color, color: '#000',
                  fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 900,
                }}>
                  {activeAnomaly.severity}
                </span>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                  {activeAnomaly.title}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                {activeAnomaly.message}
              </div>
            </div>
            <div style={{
              padding: '8px 14px', background: 'rgba(0,0,0,0.4)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00ff88', maxWidth: 440,
            }}>
              <strong>RECOMMENDED COUNTERMEASURE:</strong> {activeAnomaly.action}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ─── 4. MAIN DIGITAL TWIN WORKSPACE (3-COLUMN GRID) ─── */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(280px, 320px) 1fr minmax(300px, 340px)',
        gap: 18, marginBottom: 20, alignItems: 'stretch',
      }}>

        {/* ─── LEFT COLUMN: REGION DEEP-DIVE & CORE BIOMETRICS ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Selected Region Telemetry Inspector */}
          <div style={{
            padding: '16px', background: 'rgba(5,15,30,0.92)', border: '1px solid rgba(0,212,255,0.2)',
            borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00d4ff', letterSpacing: '0.12em' }}>
                SELECTED BODY REGION
              </span>
              <span style={{
                padding: '2px 6px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 8,
                background: regionDetails.loadStatus === 'critical' ? 'rgba(255,45,85,0.2)' : 'rgba(0,255,136,0.12)',
                color: regionDetails.loadStatus === 'critical' ? '#ff2d55' : '#00ff88',
              }}>
                {regionDetails.loadStatus.toUpperCase()}
              </span>
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              {regionDetails.title}
            </div>

            <div style={{ fontFamily: 'var(--font-body)', fontSize: 10.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.4 }}>
              {regionDetails.details}
            </div>

            {/* Region Key Parameters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 4 }}>
              <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>LOCAL TEMP</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: getThermalColor(regionDetails.temp) }}>
                  {regionDetails.temp.toFixed(1)} <span style={{ fontSize: 10 }}>°C</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
                  RANGE: {regionDetails.tempLimits[0]}–{regionDetails.tempLimits[1]}°C
                </div>
              </div>

              <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>CONTACT PRESSURE</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: getPressureColor(regionDetails.pressure) }}>
                  {regionDetails.pressure.toFixed(1)} <span style={{ fontSize: 10 }}>kPa</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>
                  RANGE: {regionDetails.pressureLimits[0]}–{regionDetails.pressureLimits[1]} kPa
                </div>
              </div>
            </div>

            {/* Regional Recommendation */}
            <div style={{ padding: '8px 10px', background: 'rgba(0,212,255,0.06)', borderRadius: 6, border: '1px solid rgba(0,212,255,0.15)', marginTop: 4 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00d4ff', marginBottom: 2 }}>CLINICAL GUIDANCE:</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.3 }}>
                {regionDetails.recommendation}
              </div>
            </div>
          </div>

          {/* Core Biometrics Dashboard HUD */}
          <div style={{
            padding: '16px', background: 'rgba(5,15,30,0.92)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.12em' }}>
              PRIMARY BIOMETRICS · {selectedMember.name.toUpperCase()}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {/* Heart Rate */}
              <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>HEART RATE</span>
                  <span style={{ color: '#ff2d55', fontSize: 9 }}>❤️</span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: getVitalColor(selectedMember.heartRateBpm, 95, 115) }}>
                  {selectedMember.heartRateBpm} <span style={{ fontSize: 9, fontWeight: 400 }}>BPM</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>ECG: SINUS RHYTHM</div>
              </div>

              {/* SpO2 */}
              <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>BLOOD O2 (SpO2)</span>
                  <span style={{ color: '#00d4ff', fontSize: 9 }}>🫁</span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: getVitalColor(100 - selectedMember.spo2Percent, 4, 8) }}>
                  {selectedMember.spo2Percent.toFixed(1)} <span style={{ fontSize: 9, fontWeight: 400 }}>%</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>PO2: 21.2 kPa</div>
              </div>

              {/* Core Temp */}
              <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>CORE TEMP</span>
                  <span style={{ color: '#00ff88', fontSize: 9 }}>🌡️</span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: getThermalColor(selectedMember.coreTempC) }}>
                  {selectedMember.coreTempC.toFixed(1)} <span style={{ fontSize: 9, fontWeight: 400 }}>°C</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>NORM: 36.5–37.5°C</div>
              </div>

              {/* Respiration */}
              <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>RESPIRATION</span>
                  <span style={{ color: '#00d4ff', fontSize: 9 }}>💨</span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#00d4ff' }}>
                  {selectedMember.respirationBpm} <span style={{ fontSize: 9, fontWeight: 400 }}>BPM</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>MINUTE VOL: 7.8 L</div>
              </div>

              {/* Stress & Fatigue */}
              <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>STRESS INDEX</span>
                  <span style={{ color: '#9b5de5', fontSize: 9 }}>⚡</span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: getVitalColor(selectedMember.stressIndex, 50, 75) }}>
                  {selectedMember.stressIndex} <span style={{ fontSize: 9, fontWeight: 400 }}>/ 100</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>COGNITIVE LOAD: NOMINAL</div>
              </div>

              {/* Hydration */}
              <div style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>HYDRATION</span>
                  <span style={{ color: '#00aaff', fontSize: 9 }}>💧</span>
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#00aaff' }}>
                  {selectedMember.hydrationPercent ?? 95} <span style={{ fontSize: 9, fontWeight: 400 }}>%</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>ELECTROLYTES: BALANCED</div>
              </div>
            </div>
          </div>
        </div>

        {/* ─── CENTER COLUMN: 3D ASTRONAUT DIGITAL TWIN CANVAS ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <CrewAnatomyScene
            member={selectedMember}
            mode={activeMode}
            selectedRegion={selectedRegion}
            onSelectRegion={(id) => setSelectedRegion(id)}
            xRay={xRay}
            showHotspots={showHotspots}
            autoRotate={autoRotate}
            height={560}
          />

          {/* Quick Body Region Selection Strip */}
          <div style={{
            padding: '10px 14px', background: 'rgba(5,15,30,0.85)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 8, display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 6, overflowX: 'auto',
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.1em', flexShrink: 0 }}>
              SELECT REGION:
            </span>
            {(['head', 'chest', 'plss', 'abdomen', 'arm_left', 'hand_left', 'hips', 'leg_left', 'feet'] as BodyRegionId[]).map((reg) => (
              <button
                key={reg}
                onClick={() => setSelectedRegion(reg)}
                style={{
                  padding: '4px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 8,
                  background: selectedRegion === reg ? 'rgba(0,212,255,0.25)' : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${selectedRegion === reg ? '#00d4ff' : 'rgba(255,255,255,0.08)'}`,
                  color: selectedRegion === reg ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                  whiteSpace: 'nowrap',
                }}
              >
                {reg.replace('_', ' ').toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        {/* ─── RIGHT COLUMN: CONSUMABLES & LIFE-SUPPORT (ECLSS) REQUIREMENTS ─── */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          
          {/* Life Support Consumables Tracker */}
          <div style={{
            padding: '16px', background: 'rgba(5,15,30,0.92)', border: '1px solid rgba(0,255,136,0.2)',
            borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 10,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00ff88', letterSpacing: '0.12em' }}>
                CREW CONSUMABLES &amp; ECLSS STATUS
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
                AUTONOMY: 5.9 DAYS
              </span>
            </div>

            {/* Consumables Progress Bars */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              
              {/* O2 Reserve */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 8, marginBottom: 3 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>O2 AVAILABILITY / STORAGE</span>
                  <span style={{ color: '#00ff88', fontWeight: 700 }}>18.4 kg (94%) · 142h</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                  <div style={{ width: '94%', height: '100%', background: '#00ff88', borderRadius: 2 }} />
                </div>
              </div>

              {/* Water Reserve */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 8, marginBottom: 3 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>POTABLE WATER / RECOVERY</span>
                  <span style={{ color: '#00d4ff', fontWeight: 700 }}>28.6 L (88%) · 2.5 L/d</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                  <div style={{ width: '88%', height: '100%', background: '#00d4ff', borderRadius: 2 }} />
                </div>
              </div>

              {/* Food / Nutrition */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 8, marginBottom: 3 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>CALORIC INTAKE / RATIONS</span>
                  <span style={{ color: '#ff8c00', fontWeight: 700 }}>2,850 kcal/day (91%)</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                  <div style={{ width: '91%', height: '100%', background: '#ff8c00', borderRadius: 2 }} />
                </div>
              </div>

              {/* CO2 Scrubbing */}
              <div>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 8, marginBottom: 3 }}>
                  <span style={{ color: 'rgba(255,255,255,0.6)' }}>CO2 SCRUBBER CAPACITY</span>
                  <span style={{ color: '#00ff88', fontWeight: 700 }}>380 ppm (0.04 kPa)</span>
                </div>
                <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                  <div style={{ width: '96%', height: '100%', background: '#00ff88', borderRadius: 2 }} />
                </div>
              </div>
            </div>
          </div>

          {/* Cabin vs Suit Atmospheric Comparison */}
          <div style={{
            padding: '16px', background: 'rgba(5,15,30,0.92)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.12em' }}>
              ATMOSPHERIC &amp; SUIT ENVELOPE
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 8.5 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>CABIN PRESSURE:</span>
                <span style={{ color: '#00ff88', fontWeight: 700 }}>101.3 kPa (1.0 atm)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>SUIT PRESSURE:</span>
                <span style={{ color: '#00d4ff', fontWeight: 700 }}>{(selectedMember.suitPressureKpa ?? 29.6).toFixed(1)} kPa (Nominal)</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>CABIN TEMP &amp; HUMIDITY:</span>
                <span style={{ color: '#fff', fontWeight: 700 }}>21.4 °C · 44% RH</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>ENVIRONMENT RADIATION:</span>
                <span style={{ color: '#ff8c00', fontWeight: 700 }}>{environment.radiationLevel.toFixed(0)} μSv/h</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0' }}>
                <span style={{ color: 'rgba(255,255,255,0.5)' }}>CUMULATIVE CREW DOSE:</span>
                <span style={{ color: '#ff8c00', fontWeight: 700 }}>{(selectedMember.radiationDoseMsv ?? 0.14).toFixed(3)} mSv</span>
              </div>
            </div>
          </div>

          {/* Current Activity & Checklist */}
          <div style={{
            padding: '14px', background: 'rgba(5,15,30,0.92)', border: '1px solid rgba(255,255,255,0.08)',
            borderRadius: 10, display: 'flex', flexDirection: 'column', gap: 6,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(155,93,229,0.8)', letterSpacing: '0.12em' }}>
              CURRENT MISSION ASSIGNMENT
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: '#fff' }}>
              {selectedMember.activity}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
              Bio-telemetry continuous monitoring enabled via digital twin telemetry link.
            </div>
          </div>
        </div>
      </div>

      {/* ─── 5. BOTTOM PANEL: PHYSIOLOGICAL MISSION TIMELINE & HISTORICAL PLAYBACK ─── */}
      <div style={{
        background: 'rgba(5,15,30,0.95)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 12,
        padding: '18px 20px', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00d4ff', letterSpacing: '0.15em', marginBottom: 2 }}>
              HISTORICAL BIOTELEMETRY PLAYBACK · MISSION DAY {timelineDay}
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#fff' }}>
              PHYSIOLOGICAL TRAJECTORY &amp; TREND ANALYSIS
            </div>
          </div>

          {/* Metric Selector Tabs */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {[
              { id: 'heartRateBpm', label: 'HEART RATE (BPM)', color: '#ff2d55' },
              { id: 'spo2Percent', label: 'SpO2 (%)', color: '#00d4ff' },
              { id: 'respirationBpm', label: 'RESPIRATION', color: '#00ff88' },
              { id: 'coreTempC', label: 'CORE TEMP (°C)', color: '#ff8c00' },
              { id: 'stressIndex', label: 'STRESS INDEX', color: '#9b5de5' },
              { id: 'fatigueIndex', label: 'FATIGUE', color: '#ff00bb' },
              { id: 'radiationDoseMsv', label: 'RADIATION (mSv)', color: '#ffd700' },
            ].map((met) => (
              <button
                key={met.id}
                onClick={() => setHistoryMetric(met.id as any)}
                style={{
                  padding: '4px 10px', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 8,
                  background: historyMetric === met.id ? `${met.color}25` : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${historyMetric === met.id ? met.color : 'rgba(255,255,255,0.08)'}`,
                  color: historyMetric === met.id ? met.color : 'rgba(255,255,255,0.5)',
                  fontWeight: historyMetric === met.id ? 700 : 400,
                }}
              >
                {met.label}
              </button>
            ))}
          </div>
        </div>

        {/* Recharts Timeline Trend Chart */}
        <div style={{ height: 110, width: '100%' }}>
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={vitalsHistoryData}>
              <defs>
                <linearGradient id="bioGrad" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                </linearGradient>
              </defs>
              <XAxis dataKey="day" stroke="rgba(255,255,255,0.3)" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.4)' }} />
              <YAxis stroke="rgba(255,255,255,0.3)" domain={['auto', 'auto']} tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.4)' }} />
              <Tooltip
                contentStyle={{ background: '#051020', border: '1px solid #00d4ff40', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 9 }}
              />
              <Area type="monotone" dataKey={historyMetric} stroke="#00d4ff" strokeWidth={2} fill="url(#bioGrad)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Mission Day Scrubber Slider */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>DAY 0</span>
          <input
            type="range"
            min={0}
            max={Math.max(14, Math.floor(missionDay || 1))}
            value={timelineDay}
            onChange={(e) => setTimelineDay(parseInt(e.target.value))}
            style={{ flex: 1, accentColor: '#00d4ff', cursor: 'pointer' }}
          />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00d4ff', fontWeight: 700 }}>
            CURRENT: DAY {timelineDay}
          </span>
        </div>
      </div>

      {/* ─── 6. ADD ASTRONAUT MODAL ─── */}
      <AnimatePresence>
        {showAddModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            style={{
              position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(8px)',
              display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 100,
            }}
          >
            <div style={{
              width: 440, background: '#051224', border: '1px solid #00d4ff40', borderRadius: 12,
              padding: '24px', boxShadow: '0 0 40px rgba(0,212,255,0.2)',
            }}>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                ADD CREW MEMBER TO DIGITAL TWIN
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 14, marginBottom: 20 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    ASTRONAUT FULL NAME / DESIGNATION
                  </div>
                  <input
                    type="text"
                    value={newAstronautName}
                    onChange={(e) => setNewAstronautName(e.target.value)}
                    placeholder="e.g. Dr. Maya Sharma"
                    style={{
                      width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff',
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                    }}
                  />
                </div>

                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.5)', marginBottom: 6 }}>
                    MISSION FLIGHT ROLE
                  </div>
                  <select
                    value={newAstronautRole}
                    onChange={(e) => setNewAstronautRole(e.target.value as any)}
                    style={{
                      width: '100%', padding: '10px 12px', background: 'rgba(0,0,0,0.4)',
                      border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff',
                      fontFamily: 'var(--font-mono)', fontSize: 11,
                    }}
                  >
                    {ROLES.map((r) => (
                      <option key={r} value={r} style={{ background: '#051224' }}>{r}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    padding: '8px 16px', background: 'transparent', border: '1px solid rgba(255,255,255,0.2)',
                    borderRadius: 6, color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleAddAstronaut}
                  style={{
                    padding: '8px 18px', background: '#00d4ff', border: 'none', borderRadius: 6,
                    color: '#000', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, cursor: 'pointer',
                  }}
                >
                  INITIALIZE TWIN
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}

export default CrewScreen;
