import { useMissionStore } from '../../store/missionStore';
import { motion } from 'framer-motion';
import { backendWS } from '../../services/BackendWebSocketService';

const SPEED_OPTIONS = [
  { value: 1, label: '1×', sub: 'REAL TIME' },
  { value: 100, label: '100×', sub: '1.7 HR/S' },
  { value: 10000, label: '10K×', sub: '2.8 HR/S' },
  { value: 100000, label: '100K×', sub: '1.15 DAY/S' },
  { value: 604800, label: '605K×', sub: '⚡ 1S = 7 DAYS' },
  { value: 2592000, label: 'WARP', sub: '🚀 1S = 30 DAYS' },
];

export function MissionTimeScreen() {
  const missionDay = useMissionStore((s) => s.missionDay);
  const timeMultiplier = useMissionStore((s) => s.timeMultiplier);
  const setTimeMultiplier = useMissionStore((s) => s.setTimeMultiplier);

  const handleWarpChange = (val: number) => {
    setTimeMultiplier(val);
    if (backendWS.isConnected) backendWS.setTimeMultiplier(val);
  };
  const estimatedLifetimeYears = useMissionStore((s) => s.estimatedLifetimeYears);
  const objectiveProgress = useMissionStore((s) => s.objectiveProgress);
  const milestones = useMissionStore((s) => s.milestones);
  const config = useMissionStore((s) => s.config);
  const stats = useMissionStore((s) => s.stats);

  const years = Math.floor(missionDay / 365);
  const remainingDays = Math.floor(missionDay % 365);
  const lifetimeDays = (estimatedLifetimeYears || 1.5) * 365;
  const lifetimePct = Math.min(100, (missionDay / lifetimeDays) * 100);

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#020409', paddingBottom: 56, padding: '32px',
    }}>
      <div style={{ maxWidth: 1000, margin: '0 auto' }}>
        {/* Mission clock */}
        <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
          style={{ textAlign: 'center', marginBottom: 40 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'rgba(0,212,255,0.7)', marginBottom: 8 }}>
            HIGH-ACCELERATION MISSION TIME WARP · SIMULATION CLOCK
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(52px, 8vw, 96px)', fontWeight: 900, color: '#00d4ff', letterSpacing: '0.08em', lineHeight: 1 }}>
            {String(Math.floor(missionDay)).padStart(4, '0')}
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, color: 'rgba(255,255,255,0.6)', marginTop: 8 }}>
            ELAPSED MISSION DAYS
          </div>
          {years > 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#00ff88', marginTop: 4 }}>
              {years} YEAR{years > 1 ? 'S' : ''} {remainingDays} DAYS IN FLIGHT
            </div>
          )}
        </motion.div>

        {/* Time multiplier */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.15 }}
          style={{ background: 'rgba(5,12,25,0.92)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 12, padding: '24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,212,255,0.7)' }}>
              TIME ACCELERATION WARP FACTOR
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00ff88' }}>
              CURRENT: {timeMultiplier >= 1000000 ? `${(timeMultiplier / 1000000).toFixed(1)}M×` : timeMultiplier >= 1000 ? `${timeMultiplier / 1000}K×` : `${timeMultiplier}×`}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(130px, 1fr))', gap: 10 }}>
            {SPEED_OPTIONS.map((opt) => (
              <button
                key={opt.value}
                onClick={() => handleWarpChange(opt.value)}
                style={{
                  padding: '16px 10px',
                  background: timeMultiplier === opt.value ? 'rgba(0,212,255,0.2)' : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${timeMultiplier === opt.value ? '#00d4ff' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 8, color: timeMultiplier === opt.value ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                  fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700,
                  cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: timeMultiplier === opt.value ? '0 0 20px rgba(0,212,255,0.2)' : 'none',
                }}
              >
                {opt.label}
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, marginTop: 4, color: timeMultiplier === opt.value ? '#00ff88' : 'rgba(255,255,255,0.3)' }}>
                  {opt.sub}
                </div>
              </button>
            ))}
          </div>
        </motion.div>

        {/* Lifecycle bar */}
        <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.25 }}
          style={{ background: 'rgba(5,12,25,0.92)', border: '1px solid rgba(0,212,255,0.12)', borderRadius: 12, padding: '24px', marginBottom: 24 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,212,255,0.7)' }}>
              MISSION LIFECYCLE &amp; OBJECTIVE PROGRESS
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#00d4ff' }}>
              {Math.round(objectiveProgress)}% COMPLETE
            </div>
          </div>
          <div style={{ width: '100%', height: 12, background: 'rgba(255,255,255,0.06)', borderRadius: 6, overflow: 'hidden', marginBottom: 8 }}>
            <div style={{
              height: '100%', width: `${Math.max(2, objectiveProgress)}%`,
              background: 'linear-gradient(90deg, #00d4ff, #00ff88)',
              borderRadius: 6, transition: 'width 0.4s ease',
              boxShadow: '0 0 12px rgba(0,212,255,0.3)',
            }} />
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>LAUNCH T-0</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
              EST. {estimatedLifetimeYears} YRS LIFETIME
            </span>
          </div>
        </motion.div>

        {/* Milestones list */}
        <div style={{ background: 'rgba(5,12,25,0.92)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 12, padding: '24px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.15em', marginBottom: 12 }}>
            MISSION MILESTONES &amp; PHASE TIMELINE
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {milestones.map((m) => (
              <div key={m.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 14px', background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ color: m.completed ? '#00ff88' : 'rgba(255,255,255,0.2)', fontSize: 12 }}>{m.completed ? '✓' : '○'}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: m.completed ? '#fff' : 'rgba(255,255,255,0.45)' }}>{m.label}</span>
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: m.completed ? '#00ff88' : 'rgba(255,255,255,0.3)' }}>
                  {m.completed ? 'COMPLETED' : `DAY ${m.requiresDays}`}
                </span>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
