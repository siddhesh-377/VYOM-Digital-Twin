import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore, defaultCrew } from '../../store/missionStore';
import { Earth, StarField } from '../three/SpaceScene';
import type { MissionType, MissionDestination, CrewMember } from '../../types/mission';

const MISSION_TYPES: {
  type: MissionType;
  name: string;
  subtitle: string;
  description: string;
  color: string;
  icon: string;
  defaultDest: MissionDestination;
  defaultName: string;
  defaultObjective: string;
}[] = [
  {
    type: 'human',
    name: 'HUMAN EXPLORATION',
    subtitle: 'Crewed Lunar & Deep Space Mission',
    description: 'Human astronauts traveling to the Moon, lunar surface landing, habitat deployment & deep space exploration with full biomedical telemetry.',
    color: '#00ff88',
    icon: '👨‍🚀',
    defaultDest: 'lunar-surface',
    defaultName: 'CHANDRAYAAN-CREW-1',
    defaultObjective: 'Human Lunar Landing, South Pole Shackleton Crater Exploration & Surface Habitat Deployment',
  },
  {
    type: 'orbital',
    name: 'ORBITAL OBSERVATION',
    subtitle: 'Earth Telemetry & Satellite Constellation',
    description: 'Satellites operating in Earth orbit for observation, communication, navigation, and environmental monitoring.',
    color: '#00d4ff',
    icon: '🛰',
    defaultDest: 'earth-orbit',
    defaultName: 'VYOM-ORBITAL-01',
    defaultObjective: 'High-resolution atmospheric telemetry & planetary multi-spectral observation',
  },
  {
    type: 'planetary',
    name: 'PLANETARY PROBE',
    subtitle: 'Mars & Solar System Exploration',
    description: 'Robotic probe traveling beyond Earth orbit to study Mars, moons, and smaller planetary bodies.',
    color: '#ff8c00',
    icon: '🪐',
    defaultDest: 'mars-surface',
    defaultName: 'VYOM-MANGAL-2',
    defaultObjective: 'Martian atmospheric entry, surface rover deployment and subsurface ice core analysis',
  },
  {
    type: 'astrophysics',
    name: 'ASTROPHYSICS OBSERVATORY',
    subtitle: 'Deep Space Telescope',
    description: 'Space telescopes studying the fundamental origin of the cosmos, exoplanets, and gravitational waves.',
    color: '#9b5de5',
    icon: '🔭',
    defaultDest: 'lagrange-l1',
    defaultName: 'VYOM-ASTROSCOPE',
    defaultObjective: 'Deep-field infrared cosmological survey and exoplanet atmospheric spectroscopy at Sun-Earth L2',
  },
];

const DESTINATION_OPTIONS: { id: MissionDestination; label: string; icon: string }[] = [
  { id: 'lunar-surface', label: 'Lunar Surface Landing (Moon)', icon: '🌕' },
  { id: 'lunar-orbit', label: 'Lunar Orbit Gateway (Cislunar)', icon: '🌔' },
  { id: 'earth-orbit', label: 'Low Earth Orbit (LEO 650 km)', icon: '🌍' },
  { id: 'mars-surface', label: 'Martian Surface (Mars Base)', icon: '🔴' },
  { id: 'lagrange-l1', label: 'Sun-Earth L2 Lagrange Point', icon: '✦' },
  { id: 'deep-space', label: 'Interplanetary Deep Space', icon: '🌌' },
];

export function OnboardingScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const setMissionConfig = useMissionStore((s) => s.setMissionConfig);
  const [step, setStep] = useState<'type' | 'details' | 'crew'>('type');
  const [selectedType, setSelectedType] = useState<MissionType>('human');
  const [destination, setDestination] = useState<MissionDestination>('lunar-surface');
  const [missionName, setMissionName] = useState('CHANDRAYAAN-CREW-1');
  const [missionObjective, setMissionObjective] = useState('Human Lunar Landing, South Pole Shackleton Crater Exploration & Surface Habitat Deployment');
  const [crewRoster, setCrewRoster] = useState<CrewMember[]>(defaultCrew);
  const [hovered, setHovered] = useState<MissionType | null>(null);

  const selectedMission = MISSION_TYPES.find((m) => m.type === selectedType) || MISSION_TYPES[0];

  const handleSelectType = (type: MissionType) => {
    setSelectedType(type);
    const m = MISSION_TYPES.find((t) => t.type === type);
    if (m) {
      setDestination(m.defaultDest);
      setMissionName(m.defaultName);
      setMissionObjective(m.defaultObjective);
    }
    setStep('details');
  };

  const handleCrewNameChange = (id: string, name: string) => {
    setCrewRoster((prev) => prev.map((c) => (c.id === id ? { ...c, name } : c)));
  };

  const handleCrewRoleChange = (id: string, role: CrewMember['role']) => {
    setCrewRoster((prev) => prev.map((c) => (c.id === id ? { ...c, role } : c)));
  };

  const handleAddCrew = () => {
    const newC: CrewMember = {
      id: `c-${Date.now()}`,
      name: `Astronaut ${crewRoster.length + 1}`,
      role: 'Mission Specialist',
      heartRateBpm: 70,
      spo2Percent: 99.1,
      respirationBpm: 14,
      coreTempC: 36.8,
      suitPressureKpa: 101.3,
      radiationDoseMsv: 0.12,
      stressIndex: 18,
      status: 'nominal',
      activity: 'Pre-flight preparation',
    };
    setCrewRoster([...crewRoster, newC]);
  };

  const handleRemoveCrew = (id: string) => {
    if (crewRoster.length <= 1) return;
    setCrewRoster(crewRoster.filter((c) => c.id !== id));
  };

  const handleProceedToBudget = () => {
    const finalName = missionName.trim() || `VYOM-${Math.floor(Math.random() * 900) + 100}`;
    const finalObjective = missionObjective.trim() || 'Human space exploration and autonomous telemetry operations';
    const id = finalName.replace(/\s+/g, '-').toUpperCase();

    setMissionConfig({
      id,
      name: finalName,
      type: selectedType,
      destination,
      objective: finalObjective,
      budgetCrore: selectedType === 'human' ? 850 : 350,
      launchSite: { name: 'Satish Dhawan Space Centre (SLP)', country: 'India', lat: 13.72, lng: 80.23, agency: 'ISRO' },
      crew: selectedType === 'human' ? crewRoster : undefined,
      createdAt: Date.now(),
    });
    setScreen('budget');
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#020409' }}>
      {/* 3D Background */}
      <Canvas
        style={{ position: 'absolute', inset: 0, opacity: 0.45 }}
        gl={{ antialias: true }}
        dpr={[1, 1.5]}
      >
        <ambientLight intensity={0.15} />
        <directionalLight position={[5, 3, 5]} intensity={1} />
        <StarField />
        <Earth radius={1.5} />
        <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.2} />
      </Canvas>

      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, rgba(2,4,9,0.3) 30%, rgba(2,4,9,0.85) 100%)',
      }} />

      <div style={{
        position: 'absolute', inset: 0, overflow: 'auto',
        display: 'flex', flexDirection: 'column', alignItems: 'center',
        padding: '36px 24px 80px 24px',
      }}>
        {/* Top bar with back button */}
        <div style={{ width: '100%', maxWidth: 1100, display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 }}>
          <button
            onClick={() => setScreen('welcome')}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 6,
              padding: '6px 12px',
              background: 'rgba(255,255,255,0.06)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6,
              color: 'rgba(255,255,255,0.8)',
              fontFamily: 'var(--font-mono)',
              fontSize: 10,
              fontWeight: 700,
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.borderColor = '#00d4ff';
              e.currentTarget.style.color = '#00d4ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.borderColor = 'rgba(255,255,255,0.15)';
              e.currentTarget.style.color = 'rgba(255,255,255,0.8)';
            }}
          >
            ← BACK TO LANDING
          </button>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.15em' }}>
            VYOM MISSION DESIGN KERNEL
          </div>
        </div>

        {/* Header */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 32 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'rgba(0,212,255,0.7)', marginBottom: 8 }}>
            MISSION CREATOR · {step === 'type' ? 'STEP 01: PROFILE' : step === 'details' ? 'STEP 02: GOAL & IDENTITY' : 'STEP 03: ASTRONAUT CREW'}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 38px)', fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>
            {step === 'type' ? 'CHOOSE MISSION CLASS' : step === 'details' ? 'DEFINE MISSION GOALS' : 'SELECT ASTRONAUT TEAM MEMBERS'}
          </h1>
          <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
            {step === 'type' ? 'Select Human Lunar Exploration or other mission profiles'
              : step === 'details' ? 'Configure your destination, mission name, and scientific goal'
              : 'Choose and name your astronaut team members for real-time biomedical monitoring'}
          </p>
        </motion.div>

        <AnimatePresence mode="wait">
          {/* STEP 1: TYPE SELECTION */}
          {step === 'type' && (
            <motion.div key="step1" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, x: -30 }} style={{ width: '100%', maxWidth: 1100 }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(250px, 1fr))', gap: 16 }}>
                {MISSION_TYPES.map((m, i) => (
                  <motion.div
                    key={m.type}
                    initial={{ opacity: 0, y: 20 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: i * 0.08 }}
                    onClick={() => handleSelectType(m.type)}
                    onMouseEnter={() => setHovered(m.type)}
                    onMouseLeave={() => setHovered(null)}
                    style={{
                      cursor: 'pointer',
                      padding: '26px 22px',
                      background: selectedType === m.type
                        ? `rgba(${m.color === '#00ff88' ? '0,255,136' : m.color === '#00d4ff' ? '0,212,255' : m.color === '#ff8c00' ? '255,140,0' : '155,93,229'},0.14)`
                        : hovered === m.type ? 'rgba(255,255,255,0.06)' : 'rgba(5,15,30,0.8)',
                      border: `1px solid ${selectedType === m.type ? m.color : hovered === m.type ? 'rgba(255,255,255,0.2)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 12,
                      backdropFilter: 'blur(12px)',
                      transition: 'all 0.25s ease',
                      transform: hovered === m.type ? 'translateY(-3px)' : 'none',
                      boxShadow: selectedType === m.type ? `0 0 30px ${m.color}20` : 'none',
                    }}
                  >
                    <div style={{ fontSize: 32, marginBottom: 12 }}>{m.icon}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: m.color, letterSpacing: '0.08em', marginBottom: 3 }}>
                      {m.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginBottom: 10 }}>
                      {m.subtitle}
                    </div>
                    <p style={{ color: 'rgba(255,255,255,0.65)', fontSize: 12, lineHeight: 1.5, marginBottom: 16 }}>
                      {m.description}
                    </p>
                    <div style={{
                      padding: '6px 10px', background: 'rgba(0,212,255,0.05)',
                      border: `1px solid ${m.color}40`, borderRadius: 4,
                      fontFamily: 'var(--font-mono)', fontSize: 9, color: m.color, textAlign: 'center',
                    }}>
                      CONFIGURE {m.name} →
                    </div>
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}

          {/* STEP 2: DETAILS & DESTINATION */}
          {step === 'details' && (
            <motion.div key="step2" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} style={{ width: '100%', maxWidth: 650 }}>
              <div style={{
                display: 'flex', alignItems: 'center', gap: 12, marginBottom: 24, padding: '12px 18px',
                background: 'rgba(5,15,30,0.85)', border: `1px solid ${selectedMission.color}40`, borderRadius: 10,
              }}>
                <span style={{ fontSize: 24 }}>{selectedMission.icon}</span>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, color: selectedMission.color }}>{selectedMission.name}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>{selectedMission.subtitle}</div>
                </div>
                <button
                  onClick={() => setStep('type')}
                  style={{
                    marginLeft: 'auto', background: 'rgba(255,255,255,0.06)', border: '1px solid rgba(255,255,255,0.15)',
                    color: 'rgba(255,255,255,0.7)', padding: '5px 10px', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer',
                  }}
                >
                  ← CHANGE CLASS
                </button>
              </div>

              {/* Destination selector */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(0,212,255,0.8)', marginBottom: 8 }}>
                  MISSION DESTINATION / TARGET GOAL
                </label>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
                  {DESTINATION_OPTIONS.map((d) => (
                    <div
                      key={d.id}
                      onClick={() => setDestination(d.id)}
                      style={{
                        padding: '10px 12px',
                        background: destination === d.id ? 'rgba(0,212,255,0.15)' : 'rgba(0,0,0,0.3)',
                        border: `1px solid ${destination === d.id ? '#00d4ff' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 6, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 8,
                      }}
                    >
                      <span style={{ fontSize: 16 }}>{d.icon}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: destination === d.id ? '#00d4ff' : '#fff' }}>
                        {d.label}
                      </span>
                    </div>
                  ))}
                </div>
              </div>

              {/* Mission Name */}
              <div style={{ marginBottom: 20 }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(0,212,255,0.8)', marginBottom: 6 }}>
                  MISSION NAME / SPACECRAFT CALLSIGN
                </label>
                <input
                  type="text"
                  value={missionName}
                  onChange={(e) => setMissionName(e.target.value)}
                  style={{
                    width: '100%', padding: '12px 16px', background: 'rgba(5,15,30,0.9)',
                    border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8, color: '#fff',
                    fontFamily: 'var(--font-mono)', fontSize: 15, outline: 'none',
                  }}
                />
              </div>

              {/* Objective */}
              <div style={{ marginBottom: 28 }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(0,212,255,0.8)', marginBottom: 6 }}>
                  PRIMARY MISSION OBJECTIVE &amp; GOAL
                </label>
                <textarea
                  value={missionObjective}
                  onChange={(e) => setMissionObjective(e.target.value)}
                  rows={3}
                  style={{
                    width: '100%', padding: '12px 16px', background: 'rgba(5,15,30,0.9)',
                    border: '1px solid rgba(0,212,255,0.3)', borderRadius: 8, color: '#fff',
                    fontFamily: 'var(--font-body)', fontSize: 13, lineHeight: 1.5, outline: 'none',
                  }}
                />
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep('type')} style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>
                  ← BACK
                </button>
                <button
                  onClick={() => selectedType === 'human' ? setStep('crew') : handleProceedToBudget()}
                  className="btn btn-primary btn-lg"
                  style={{ flex: 1 }}
                >
                  {selectedType === 'human' ? 'CHOOSE ASTRONAUT CREW (STEP 03) →' : 'CONFIGURE BUDGET →'}
                </button>
              </div>
            </motion.div>
          )}

          {/* STEP 3: ASTRONAUT CREW SELECTION */}
          {step === 'crew' && (
            <motion.div key="step3" initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }} style={{ width: '100%', maxWidth: 700 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#00ff88' }}>
                    👨‍🚀 ASTRONAUT FLIGHT ROSTER
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                    Customize team members choice for Lunar / Crewed exploration
                  </div>
                </div>
                <button
                  onClick={handleAddCrew}
                  className="btn btn-sm"
                  style={{ color: '#00ff88', borderColor: '#00ff88' }}
                >
                  + ADD ASTRONAUT
                </button>
              </div>

              {/* Astronaut input rows */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
                {crewRoster.map((astronaut, idx) => (
                  <div
                    key={astronaut.id}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px',
                      background: 'rgba(5,15,30,0.9)', border: '1px solid rgba(0,255,136,0.2)',
                      borderRadius: 8,
                    }}
                  >
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00ff88', minWidth: 24 }}>
                      #{idx + 1}
                    </span>
                    <input
                      type="text"
                      value={astronaut.name}
                      onChange={(e) => handleCrewNameChange(astronaut.id, e.target.value)}
                      placeholder="Astronaut Full Name"
                      style={{
                        flex: 1, padding: '8px 12px', background: 'rgba(0,0,0,0.4)',
                        border: '1px solid rgba(255,255,255,0.1)', borderRadius: 6,
                        color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
                      }}
                    />
                    <select
                      value={astronaut.role}
                      onChange={(e) => handleCrewRoleChange(astronaut.id, e.target.value as any)}
                      style={{
                        padding: '8px 10px', background: 'rgba(5,15,30,1)',
                        border: '1px solid rgba(0,212,255,0.25)', borderRadius: 6,
                        color: '#00d4ff', fontFamily: 'var(--font-mono)', fontSize: 11, outline: 'none',
                      }}
                    >
                      <option value="Commander">Commander</option>
                      <option value="Lunar Module Pilot">Lunar Module Pilot</option>
                      <option value="Flight Engineer">Flight Engineer</option>
                      <option value="Mission Specialist">Mission Specialist</option>
                      <option value="Medical Officer">Medical Officer</option>
                      <option value="Payload Commander">Payload Commander</option>
                    </select>
                    {crewRoster.length > 1 && (
                      <button
                        onClick={() => handleRemoveCrew(astronaut.id)}
                        style={{
                          background: 'transparent', border: 'none',
                          color: 'rgba(255,45,85,0.7)', cursor: 'pointer', fontSize: 16, padding: '0 4px',
                        }}
                        title="Remove member"
                      >
                        ✕
                      </button>
                    )}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 12 }}>
                <button onClick={() => setStep('details')} style={{ padding: '12px 20px', background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6, color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer' }}>
                  ← BACK TO GOALS
                </button>
                <button
                  onClick={handleProceedToBudget}
                  className="btn btn-primary btn-lg"
                  style={{ flex: 1 }}
                >
                  CONFIGURE BUDGET &amp; LAUNCH SITE →
                </button>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}
