import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import type { CrewMember } from '../../types/mission';
import { CrewAnatomyScene } from '../three/CrewAnatomyScene';
import { AreaChart, Area, XAxis, YAxis, Tooltip, ResponsiveContainer } from 'recharts';

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
  const crewVitalsHistory = useMissionStore((s) => s.crewVitalsHistory);

  const [editingId, setEditingId] = useState<string | null>(null);
  const [newAstronautName, setNewAstronautName] = useState('');
  const [newAstronautRole, setNewAstronautRole] = useState<CrewMember['role']>('Mission Specialist');
  const [showAddModal, setShowAddModal] = useState(false);
  const [expandedHistoryId, setExpandedHistoryId] = useState<string | null>(null);
  const [historyMetric, setHistoryMetric] = useState<'heartRateBpm' | 'spo2Percent' | 'respirationBpm' | 'coreTempC' | 'stressIndex' | 'fatigueIndex' | 'hydrationPercent' | 'radiationDoseMsv'>('heartRateBpm');

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

  // ── v3.0 Human Digital Twin state ──
  const [anatomyMemberId, setAnatomyMemberId] = useState<string | null>(null);
  const selectedAnatomyMember = crew.find((c) => c.id === anatomyMemberId) ?? crew[0] ?? null;

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#020409', paddingBottom: 80, padding: '28px' }}>
      {/* v3.0 SIMULATED data disclaimer */}
      <div style={{
        padding: '10px 16px', marginBottom: 20,
        background: 'rgba(255,140,0,0.06)', border: '1px solid rgba(255,140,0,0.25)', borderRadius: 8,
        display: 'flex', alignItems: 'center', gap: 10,
      }}>
        <span style={{ fontSize: 14 }}>⚠</span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'rgba(255,255,255,0.6)', lineHeight: 1.5 }}>
          ALL PHYSIOLOGICAL VALUES ON THIS SCREEN ARE <strong style={{ color: '#ff8c00' }}>SIMULATED / ESTIMATED</strong> MODEL OUTPUTS
          FOR DIGITAL-TWIN DECISION SUPPORT. THEY ARE NOT REAL MEDICAL DATA AND MUST NOT BE TREATED AS MEDICAL DIAGNOSES.
          DATA QUALITY: <strong style={{ color: '#ff8c00' }}>{selectedAnatomyMember?.dataQuality?.toUpperCase() ?? 'SIMULATED'}</strong>
        </span>
      </div>
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

      {/* ── v3.0 Human Digital Twin: 3D Anatomy + Extended Monitoring ── */}
      <div style={{
        padding: '24px', marginBottom: 28,
        background: 'rgba(5,12,25,0.92)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 12,
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16, flexWrap: 'wrap', gap: 10 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00d4ff', letterSpacing: '0.2em', marginBottom: 4 }}>
              HUMAN DIGITAL TWIN · PROCEDURAL 3D ANATOMY MODEL
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 17, fontWeight: 700, color: '#fff' }}>
              CREW PHYSIOLOGY VISUALIZATION
            </div>
          </div>
          {/* Member selector */}
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
            {crew.map((m) => (
              <button
                key={m.id}
                onClick={() => setAnatomyMemberId(m.id)}
                style={{
                  padding: '6px 12px', cursor: 'pointer', transition: 'all 0.2s', borderRadius: 5,
                  background: selectedAnatomyMember?.id === m.id ? 'rgba(0,212,255,0.2)' : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${selectedAnatomyMember?.id === m.id ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
                  color: selectedAnatomyMember?.id === m.id ? '#00d4ff' : 'rgba(255,255,255,0.45)',
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                }}
              >
                {m.role.toUpperCase()}
              </button>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'minmax(280px, 420px) 1fr', gap: 20, alignItems: 'start' }}>
          {/* 3D anatomy view */}
          <div>
            <CrewAnatomyScene member={selectedAnatomyMember} />
            <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)', textAlign: 'center' }}>
              MARKERS: ♥ HEART RATE · LUNGS SpO2 · BRAIN STRESS · MUSCLE FATIGUE · CORE HYDRATION
              {selectedAnatomyMember?.status === 'eva' && ' · TETHER (EVA)'}
            </div>
          </div>

          {/* Extended monitoring panels */}
          {selectedAnatomyMember && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {/* Location / task / comm strip */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 8 }}>
                {[
                  { label: 'LOCATION', value: selectedAnatomyMember.location ?? 'Command Module' },
                  { label: 'SPACECRAFT MODULE', value: selectedAnatomyMember.spacecraftModule ?? 'CM' },
                  { label: 'CURRENT TASK', value: selectedAnatomyMember.currentTask ?? selectedAnatomyMember.activity },
                  { label: 'TASK DURATION', value: `${Math.round(selectedAnatomyMember.taskDurationMin ?? 0)} min` },
                  { label: 'CHECKLIST', value: (selectedAnatomyMember.checklistStatus ?? 'in-progress').toUpperCase() },
                  { label: 'COMMS', value: (selectedAnatomyMember.commStatus ?? 'nominal').toUpperCase() },
                ].map(({ label, value }) => (
                  <div key={label} style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#fff' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Index bars: fatigue / stress / workload / hydration */}
              {([
                { label: 'FATIGUE', v: selectedAnatomyMember.fatigueIndex ?? 0, invert: true },
                { label: 'STRESS', v: selectedAnatomyMember.stressIndex ?? 0, invert: true },
                { label: 'WORKLOAD', v: selectedAnatomyMember.workloadIndex ?? 0, invert: true },
                { label: 'HYDRATION', v: selectedAnatomyMember.hydrationPercent ?? 100, invert: false },
              ]).map(({ label, v, invert }) => {
                const bad = invert ? v >= 60 : v <= 60;
                const warn = invert ? v >= 40 : v <= 80;
                const col = bad ? '#ff2d55' : warn ? '#ff8c00' : '#00ff88';
                return (
                  <div key={label}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>
                      <span>{label} (SIMULATED)</span><span style={{ color: col }}>{Math.round(v)}%</span>
                    </div>
                    <div style={{ height: 5, background: 'rgba(255,255,255,0.06)', borderRadius: 3 }}>
                      <div style={{ height: '100%', width: `${Math.max(0, Math.min(100, v))}%`, background: col, borderRadius: 3, transition: 'width 0.4s' }} />
                    </div>
                  </div>
                );
              })}

              {/* EVA / exposure panel */}
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 8 }}>
                {[
                  { label: 'EVA DURATION', value: `${Math.round(selectedAnatomyMember.evaDurationMin ?? 0)} min`, color: selectedAnatomyMember.status === 'eva' ? '#00d4ff' : '#fff' },
                  { label: 'SUIT PRESSURE', value: `${selectedAnatomyMember.suitPressureKpa} kPa`, color: '#fff' },
                  { label: 'TETHER', value: selectedAnatomyMember.tetherStatus ? selectedAnatomyMember.tetherStatus.toUpperCase() : 'N/A (IVA)', color: selectedAnatomyMember.tetherStatus === 'detached' ? '#ff2d55' : '#00ff88' },
                  { label: 'O2 EXPOSURE', value: `${selectedAnatomyMember.o2ExposureKpa ?? '—'} kPa`, color: '#fff' },
                  { label: 'CO2 EXPOSURE', value: `${selectedAnatomyMember.co2ExposurePpm ?? '—'} ppm`, color: (selectedAnatomyMember.co2ExposurePpm ?? 400) > 2000 ? '#ff8c00' : '#fff' },
                  { label: 'BLOOD PRESSURE', value: selectedAnatomyMember.bloodPressureSys ? `${selectedAnatomyMember.bloodPressureSys}/${selectedAnatomyMember.bloodPressureDia}` : '—', color: '#fff' },
                  { label: 'RAD DOSE', value: `${selectedAnatomyMember.radiationDoseMsv} mSv`, color: selectedAnatomyMember.radiationDoseMsv > 1 ? '#ff8c00' : '#00ff88' },
                  { label: 'DIST FROM S/C', value: selectedAnatomyMember.status === 'eva' ? '< 30 m (tethered)' : '—', color: '#fff' },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color }}>{value}</div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
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
              <div style={{ background: 'rgba(0,0,0,0.35)', borderRadius: 6, padding: '8px 12px', marginBottom: 10, border: '1px solid rgba(255,255,255,0.04)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>ECG RHYTHM &amp; PULSE</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: statusColor }}>{member.heartRateBpm} BPM</span>
                </div>
                <HeartRateGraph bpm={member.heartRateBpm} color={statusColor} />
              </div>

              {/* Abnormal condition banners */}
              {(() => {
                const alerts: { msg: string; color: string }[] = [];
                if (member.heartRateBpm > 100) alerts.push({ msg: `TACHYCARDIA: ${member.heartRateBpm} BPM`, color: '#ff2d55' });
                if (member.heartRateBpm < 50) alerts.push({ msg: `BRADYCARDIA: ${member.heartRateBpm} BPM`, color: '#ff2d55' });
                if (member.spo2Percent < 95) alerts.push({ msg: `HYPOXIA: SpO2 ${member.spo2Percent}%`, color: '#ff2d55' });
                if (member.stressIndex > 70) alerts.push({ msg: `HIGH STRESS: ${member.stressIndex}%`, color: '#ff8c00' });
                if ((member.fatigueIndex ?? 0) > 75) alerts.push({ msg: `FATIGUE CRITICAL: ${member.fatigueIndex}%`, color: '#ff8c00' });
                if (member.coreTempC > 38.5) alerts.push({ msg: `HYPERTHERMIA: ${member.coreTempC}°C`, color: '#ff8c00' });
                if (member.radiationDoseMsv > 1) alerts.push({ msg: `RAD DOSE HIGH: ${member.radiationDoseMsv.toFixed(3)} mSv`, color: '#ff8c00' });
                return alerts.length > 0 ? (
                  <div style={{ marginBottom: 10, display: 'flex', flexDirection: 'column', gap: 4 }}>
                    {alerts.map((a) => (
                      <div key={a.msg} style={{ padding: '4px 10px', background: `${a.color}12`, border: `1px solid ${a.color}40`, borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 8.5, color: a.color, letterSpacing: '0.08em' }}>
                        ⚠ {a.msg} [SIMULATED ESTIMATE]
                      </div>
                    ))}
                  </div>
                ) : null;
              })()}

              {/* Vitals history chart toggle */}
              <div style={{ marginBottom: 12 }}>
                <button
                  onClick={() => setExpandedHistoryId(expandedHistoryId === member.id ? null : member.id)}
                  style={{ width: '100%', padding: '6px 10px', background: expandedHistoryId === member.id ? 'rgba(0,212,255,0.12)' : 'rgba(0,0,0,0.2)', border: `1px solid ${expandedHistoryId === member.id ? 'rgba(0,212,255,0.3)' : 'rgba(255,255,255,0.06)'}`, borderRadius: 6, color: expandedHistoryId === member.id ? '#00d4ff' : 'rgba(255,255,255,0.35)', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', cursor: 'pointer', textAlign: 'left' }}
                >
                  {expandedHistoryId === member.id ? '▲ HIDE VITALS HISTORY CHART' : '▼ SHOW VITALS HISTORY CHART'} [{(crewVitalsHistory[member.id] ?? []).length} SAMPLES] [SIMULATED ESTIMATE]
                </button>
                <AnimatePresence>
                  {expandedHistoryId === member.id && (
                    <motion.div initial={{ opacity: 0, height: 0 }} animate={{ opacity: 1, height: 'auto' }} exit={{ opacity: 0, height: 0 }} style={{ overflow: 'hidden' }}>
                      <div style={{ paddingTop: 10 }}>
                        {/* Metric selector */}
                        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5, marginBottom: 8 }}>
                          {([
                            { key: 'heartRateBpm', label: 'HR (bpm)' },
                            { key: 'spo2Percent', label: 'SpO2 (%)' },
                            { key: 'respirationBpm', label: 'Resp (bpm)' },
                            { key: 'coreTempC', label: 'Temp (°C)' },
                            { key: 'stressIndex', label: 'Stress (%)' },
                            { key: 'fatigueIndex', label: 'Fatigue (%)' },
                            { key: 'hydrationPercent', label: 'Hydration (%)' },
                            { key: 'radiationDoseMsv', label: 'Rad (mSv)' },
                          ] as { key: typeof historyMetric; label: string }[]).map(({ key, label }) => (
                            <button key={key} onClick={() => setHistoryMetric(key)}
                              style={{ padding: '3px 8px', borderRadius: 4, cursor: 'pointer', fontFamily: 'var(--font-mono)', fontSize: 7.5, background: historyMetric === key ? 'rgba(0,212,255,0.2)' : 'rgba(0,0,0,0.3)', border: `1px solid ${historyMetric === key ? '#00d4ff' : 'rgba(255,255,255,0.06)'}`, color: historyMetric === key ? '#00d4ff' : 'rgba(255,255,255,0.35)' }}>
                              {label}
                            </button>
                          ))}
                        </div>
                        {/* Chart */}
                        <div style={{ height: 140, background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 0' }}>
                          {(crewVitalsHistory[member.id] ?? []).length > 1 ? (
                            <ResponsiveContainer width="100%" height="100%">
                              <AreaChart data={(crewVitalsHistory[member.id] ?? []).map((s) => ({ day: parseFloat(s.missionDay.toFixed(2)), v: (s as any)[historyMetric] ?? 0 }))} margin={{ top: 4, right: 8, bottom: 4, left: 0 }}>
                                <XAxis dataKey="day" tick={{ fontFamily: 'var(--font-mono)', fontSize: 7, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} label={{ value: 'MISSION DAY', position: 'insideBottomRight', offset: -4, fontSize: 6, fill: 'rgba(255,255,255,0.2)' }} />
                                <YAxis tick={{ fontFamily: 'var(--font-mono)', fontSize: 7, fill: 'rgba(255,255,255,0.3)' }} tickLine={false} axisLine={false} width={32} />
                                <Tooltip contentStyle={{ background: 'rgba(5,12,25,0.95)', border: '1px solid rgba(0,212,255,0.25)', borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 9 }} formatter={(v: number) => [v.toFixed(2), historyMetric]} labelFormatter={(d) => `Day ${d}`} />
                                <Area type="monotone" dataKey="v" stroke="#00d4ff" fill="rgba(0,212,255,0.08)" strokeWidth={1.5} dot={false} animationDuration={300} />
                              </AreaChart>
                            </ResponsiveContainer>
                          ) : (
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.25)' }}>
                              COLLECTING DATA — ACCELERATE TIME WARP TO BUILD HISTORY
                            </div>
                          )}
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.2)', marginTop: 4, textAlign: 'center' }}>
                          ALL VALUES ARE SIMULATED PHYSIOLOGICAL ESTIMATES — NOT REAL MEDICAL DATA
                        </div>
                      </div>
                    </motion.div>
                  )}
                </AnimatePresence>
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
