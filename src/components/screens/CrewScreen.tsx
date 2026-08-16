import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import type { CrewMember } from '../../types/mission';

const ROLES: CrewMember['role'][] = [
  'Commander',
  'Lunar Module Pilot',
  'Flight Engineer',
  'Mission Specialist',
  'Medical Officer',
  'Payload Commander',
];

function HeartRateGraph({ bpm, color }: { bpm: number; color: string }) {
  const points = [
    0, 2, -1, 3, 0, 0, -4, 18, -12, 4, 0, 1, -1, 0,
    0, 2, -1, 3, 0, 0, -4, 18, -12, 4, 0, 1, -1, 0,
  ];

  return (
    <div style={{ height: 28, width: '100%', overflow: 'hidden', display: 'flex', alignItems: 'center' }}>
      <svg width="100%" height="28" viewBox="0 0 140 28" preserveAspectRatio="none">
        <path
          d={`M ${points.map((p, i) => `${i * 5},${14 - p * (bpm / 75) * 0.7}`).join(' L ')}`}
          fill="none"
          stroke={color}
          strokeWidth="1.5"
          style={{ opacity: 0.8 }}
        />
      </svg>
    </div>
  );
}

export function CrewScreen() {
  const crew = useMissionStore((s) => s.crew);
  const config = useMissionStore((s) => s.config);
  const setCrew = useMissionStore((s) => s.setCrew);
  const updateCrewMember = useMissionStore((s) => s.updateCrewMember);
  const environment = useMissionStore((s) => s.environment);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAstronautName, setNewAstronautName] = useState('');
  const [newAstronautRole, setNewAstronautRole] = useState<CrewMember['role']>('Mission Specialist');
  const [showAddModal, setShowAddModal] = useState(false);

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
      suitPressureKpa: 101.3,
      radiationDoseMsv: 0.12,
      stressIndex: 18,
      status: 'nominal',
      activity: 'Systems Operation & Scientific Observation',
    };
    setCrew([...crew, newMember]);
    setNewAstronautName('');
    setShowAddModal(false);
  };

  const handleRemoveAstronaut = (id: string) => {
    if (crew.length <= 1) return;
    setCrew(crew.filter((c) => c.id !== id));
  };

  const avgHeartRate = crew.length > 0 ? (crew.reduce((acc, c) => acc + c.heartRateBpm, 0) / crew.length).toFixed(0) : '0';
  const avgSpO2 = crew.length > 0 ? (crew.reduce((acc, c) => acc + c.spo2Percent, 0) / crew.length).toFixed(1) : '0';
  const totalRad = crew.length > 0 ? (crew.reduce((acc, c) => acc + c.radiationDoseMsv, 0) / crew.length).toFixed(3) : '0';

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#020409', paddingBottom: 80, padding: '28px' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 28, flexWrap: 'wrap', gap: 16 }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.2em', marginBottom: 4 }}>
            BIOMEDICAL TELEMETRY &amp; CREW HEALTH HUD · {config?.name ?? 'CREWED EXPLORATION'}
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#fff' }}>
            ASTRONAUT CREW MONITORING
          </h1>
        </div>

        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setShowAddModal(true)}
            className="btn btn-primary"
            style={{ fontSize: 11, padding: '10px 20px' }}
          >
            + ADD CREW MEMBER
          </button>
        </div>
      </div>

      {/* Overview stats */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 14, marginBottom: 28 }}>
        {[
          { label: 'CREW COMPLEMENT', value: `${crew.length} ASTRONAUTS`, sub: config?.destination?.toUpperCase().replace('-', ' ') ?? 'LUNAR SURFACE' },
          { label: 'AVG HEART RATE', value: `${avgHeartRate} BPM`, sub: 'RESTING / ACTIVE MIX' },
          { label: 'MEAN SpO2', value: `${avgSpO2}%`, sub: 'BLOOD OXYGEN' },
          { label: 'CUMULATIVE DOSE', value: `${totalRad} mSv`, sub: `ENV: ${environment.radiationLevel.toFixed(0)} μSv/h` },
          { label: 'ECLSS CABIN PRESSURE', value: '101.3 kPa', sub: 'O2 21.4% · N2 78.2%' },
        ].map(({ label, value, sub }) => (
          <div key={label} style={{
            padding: '16px', background: 'rgba(5,15,30,0.85)',
            border: '1px solid rgba(0,212,255,0.12)', borderRadius: 10,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#00d4ff' }}>{value}</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>{sub}</div>
          </div>
        ))}
      </div>

      {/* Crew Cards Grid */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(320px, 1fr))', gap: 18 }}>
        {crew.map((member) => {
          const isCritical = member.status === 'critical';
          const isElevated = member.status === 'elevated';
          const isEVA = member.status === 'eva';
          const statusColor = isCritical ? 'var(--critical)' : isElevated ? 'var(--warning)' : isEVA ? '#00d4ff' : 'var(--nominal)';

          return (
            <motion.div
              key={member.id}
              layout
              style={{
                padding: '24px',
                background: 'rgba(5,12,25,0.92)',
                border: `1px solid ${isCritical ? 'rgba(255,45,85,0.4)' : isElevated ? 'rgba(255,140,0,0.3)' : 'rgba(0,212,255,0.12)'}`,
                borderRadius: 12,
                boxShadow: isCritical ? '0 0 20px rgba(255,45,85,0.15)' : 'none',
              }}
            >
              {/* Card top */}
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
                <div>
                  {editingId === member.id ? (
                    <input
                      type="text"
                      defaultValue={member.name}
                      onBlur={(e) => {
                        updateCrewMember(member.id, { name: e.target.value });
                        setEditingId(null);
                      }}
                      autoFocus
                      style={{
                        background: 'rgba(0,0,0,0.5)', border: '1px solid #00d4ff',
                        color: '#fff', padding: '4px 8px', borderRadius: 4,
                        fontFamily: 'var(--font-display)', fontSize: 16,
                      }}
                    />
                  ) : (
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        onClick={() => setEditingId(member.id)}
                        style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#fff', cursor: 'pointer' }}
                        title="Click to rename"
                      >
                        {member.name}
                      </span>
                      <span style={{ fontSize: 11, cursor: 'pointer', opacity: 0.4 }} onClick={() => setEditingId(member.id)}>✎</span>
                    </div>
                  )}

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#00d4ff', marginTop: 2 }}>
                    {member.role.toUpperCase()}
                  </div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 8px',
                    background: `${statusColor}18`, border: `1px solid ${statusColor}40`,
                    borderRadius: 4, color: statusColor, fontWeight: 700,
                  }}>
                    {member.status.toUpperCase()}
                  </span>
                  {crew.length > 1 && (
                    <button
                      onClick={() => handleRemoveAstronaut(member.id)}
                      style={{
                        background: 'transparent', border: 'none',
                        color: 'rgba(255,255,255,0.25)', cursor: 'pointer', fontSize: 14,
                      }}
                      title="Remove astronaut"
                    >
                      ✕
                    </button>
                  )}
                </div>
              </div>

              {/* Heart rate graph */}
              <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 6, padding: '8px 12px', marginBottom: 16, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>ECG RHYTHM &amp; PULSE</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: statusColor }}>{member.heartRateBpm} BPM</span>
                </div>
                <HeartRateGraph bpm={member.heartRateBpm} color={statusColor} />
              </div>

              {/* Vitals grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                {[
                  { label: 'BLOOD O2 (SpO2)', value: `${member.spo2Percent}%`, color: member.spo2Percent < 96 ? '#ff2d55' : '#00ff88' },
                  { label: 'RESPIRATION', value: `${member.respirationBpm} bpm`, color: '#00d4ff' },
                  { label: 'CORE TEMP', value: `${member.coreTempC}°C`, color: '#00d4ff' },
                  { label: 'SUIT PRESSURE', value: `${member.suitPressureKpa} kPa`, color: '#fff' },
                  { label: 'RAD DOSE', value: `${member.radiationDoseMsv} mSv`, color: member.radiationDoseMsv > 1 ? '#ff8c00' : '#00ff88' },
                  { label: 'STRESS INDEX', value: `${member.stressIndex}%`, color: member.stressIndex > 60 ? '#ff2d55' : '#00d4ff' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Current Activity */}
              <div style={{
                padding: '8px 12px', background: 'rgba(0,212,255,0.04)',
                border: '1px solid rgba(0,212,255,0.12)', borderRadius: 6,
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,212,255,0.6)', marginBottom: 2 }}>CURRENT ACTIVITY</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>{member.activity}</div>
              </div>
            </motion.div>
          );
        })}
      </div>

      {/* Add Astronaut Modal */}
      <AnimatePresence>
        {showAddModal && (
          <div style={{
            position: 'fixed', inset: 0, zIndex: 2000,
            background: 'rgba(2,4,9,0.85)', backdropFilter: 'blur(8px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            padding: 24,
          }}>
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              style={{
                width: '100%', maxWidth: 440,
                background: 'rgba(5,15,30,0.95)',
                border: '1px solid rgba(0,212,255,0.3)',
                borderRadius: 14, padding: '28px',
              }}
            >
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 16 }}>
                ADD ASTRONAUT TEAM MEMBER
              </div>

              <div style={{ marginBottom: 16 }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', marginBottom: 6 }}>
                  ASTRONAUT FULL NAME
                </label>
                <input
                  type="text"
                  placeholder="e.g. Cmdr. Sarah Connor"
                  value={newAstronautName}
                  onChange={(e) => setNewAstronautName(e.target.value)}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'rgba(0,0,0,0.4)',
                    border: '1px solid rgba(0,212,255,0.25)', borderRadius: 6,
                    color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 13, outline: 'none',
                  }}
                />
              </div>

              <div style={{ marginBottom: 24 }}>
                <label style={{ display: 'block', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', marginBottom: 6 }}>
                  CREW ROLE
                </label>
                <select
                  value={newAstronautRole}
                  onChange={(e) => setNewAstronautRole(e.target.value as any)}
                  style={{
                    width: '100%', padding: '10px 14px', background: 'rgba(5,15,30,1)',
                    border: '1px solid rgba(0,212,255,0.25)', borderRadius: 6,
                    color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 12, outline: 'none',
                  }}
                >
                  {ROLES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'flex', gap: 10 }}>
                <button
                  onClick={() => setShowAddModal(false)}
                  style={{
                    flex: 1, padding: '10px', background: 'transparent',
                    border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
                    color: 'rgba(255,255,255,0.6)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
                  }}
                >
                  CANCEL
                </button>
                <button
                  onClick={handleAddAstronaut}
                  className="btn btn-primary"
                  style={{ flex: 1, fontSize: 11 }}
                >
                  CONFIRM &amp; ADD
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
