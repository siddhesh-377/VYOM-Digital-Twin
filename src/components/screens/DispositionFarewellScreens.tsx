import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import type { DispositionType } from '../../types/mission';

const DISPOSITIONS: {
  type: DispositionType;
  name: string;
  icon: string;
  description: string;
  detail: string;
  color: string;
}[] = [
  {
    type: 'return',
    name: 'RETURN TO EARTH',
    icon: '🌍',
    description: 'Controlled atmospheric re-entry and recovery.',
    detail: 'The spacecraft executes a deorbit burn, enters the atmosphere, deploys parachutes, and is recovered on the surface. Mission data and hardware are preserved.',
    color: '#00ff88',
  },
  {
    type: 'deorbit',
    name: 'CONTROLLED DEORBIT',
    icon: '🌊',
    description: 'Guided orbital decay into designated disposal zone.',
    detail: 'The spacecraft performs a controlled deorbit burn to ensure re-entry over a designated ocean disposal zone, minimizing risk to populated areas.',
    color: '#00d4ff',
  },
  {
    type: 'retirement',
    name: 'ORBITAL RETIREMENT',
    icon: '⭐',
    description: 'Spacecraft continues in stable retirement orbit.',
    detail: 'The spacecraft is passivated (fuel vented, batteries discharged) and placed in a stable graveyard orbit above operational zones, where it will remain indefinitely.',
    color: '#9b5de5',
  },
];

export function DispositionScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const setDisposition = useMissionStore((s) => s.setDisposition);
  const archiveMission = useMissionStore((s) => s.archiveMission);
  const config = useMissionStore((s) => s.config);
  const stats = useMissionStore((s) => s.stats);
  const [selected, setSelected] = useState<DispositionType | null>(null);
  const [confirming, setConfirming] = useState(false);

  const handleConfirm = () => {
    if (!selected) return;
    setDisposition(selected);
    archiveMission();
    setConfirming(true);
    setTimeout(() => setScreen('farewell'), 2500);
  };

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: '#020409', padding: '32px', paddingBottom: 80, overflowY: 'auto',
    }}>
      <motion.div
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        style={{ textAlign: 'center', marginBottom: 48, maxWidth: 600 }}
      >
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, letterSpacing: '0.3em', color: 'rgba(0,212,255,0.6)', marginBottom: 16 }}>
          MISSION COMPLETE
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(32px, 5vw, 56px)', fontWeight: 900, color: '#fff', marginBottom: 12 }}>
          {config?.name}
        </div>
        <p style={{ fontFamily: 'var(--font-body)', fontSize: 16, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
          Your mission has reached its objective. It is time to determine the final disposition of the spacecraft.
        </p>
      </motion.div>

      {/* Disposition options */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 20, width: '100%', maxWidth: 900, marginBottom: 40 }}>
        {DISPOSITIONS.map((d, i) => (
          <motion.div
            key={d.type}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: i * 0.15 }}
            onClick={() => !confirming && setSelected(d.type)}
            style={{
              padding: '32px 28px',
              background: selected === d.type ? `rgba(${d.color === '#00ff88' ? '0,255,136' : d.color === '#00d4ff' ? '0,212,255' : '155,93,229'},0.1)` : 'rgba(5,12,25,0.9)',
              border: `1px solid ${selected === d.type ? d.color + '50' : 'rgba(255,255,255,0.07)'}`,
              borderRadius: 14,
              cursor: confirming ? 'default' : 'pointer',
              transition: 'all 0.3s',
              transform: selected === d.type ? 'scale(1.02)' : 'scale(1)',
              boxShadow: selected === d.type ? `0 0 40px ${d.color}15` : 'none',
            }}
          >
            <div style={{ fontSize: 40, marginBottom: 16 }}>{d.icon}</div>
            <div style={{
              fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700,
              color: selected === d.type ? d.color : '#fff',
              letterSpacing: '0.06em', marginBottom: 8,
            }}>
              {d.name}
            </div>
            <p style={{ fontFamily: 'var(--font-body)', fontSize: 13, color: 'rgba(255,255,255,0.5)', lineHeight: 1.6 }}>
              {selected === d.type ? d.detail : d.description}
            </p>
          </motion.div>
        ))}
      </div>

      {/* Mission stats summary */}
      <motion.div
        initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ delay: 0.5 }}
        style={{ display: 'flex', gap: 32, marginBottom: 40, flexWrap: 'wrap', justifyContent: 'center' }}
      >
        {[
          { label: 'MISSION DURATION', value: 'COMPLETE' },
          { label: 'THREATS MITIGATED', value: String(stats.threatsEncountered) },
          { label: 'AI INTERVENTIONS', value: String(stats.aiInterventions) },
          { label: 'PEAK HEALTH', value: `${stats.maxHealth.toFixed(0)}%` },
        ].map(({ label, value }) => (
          <div key={label} style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#00d4ff' }}>{value}</div>
          </div>
        ))}
      </motion.div>

      {/* Confirm button */}
      {selected && !confirming && (
        <motion.button
          initial={{ opacity: 0, scale: 0.9 }}
          animate={{ opacity: 1, scale: 1 }}
          onClick={handleConfirm}
          style={{
            fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, letterSpacing: '0.2em',
            padding: '18px 60px',
            background: DISPOSITIONS.find((d) => d.type === selected)?.color ?? '#00d4ff',
            border: 'none', borderRadius: 8, color: '#000',
            cursor: 'pointer',
            boxShadow: `0 0 40px ${DISPOSITIONS.find((d) => d.type === selected)?.color ?? '#00d4ff'}40`,
          }}
        >
          CONFIRM: {DISPOSITIONS.find((d) => d.type === selected)?.name} →
        </motion.button>
      )}

      {confirming && (
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#00d4ff', textAlign: 'center' }}
        >
          DISPOSITION CONFIRMED · ARCHIVING MISSION · PREPARING FAREWELL…
        </motion.div>
      )}
    </div>
  );
}

export function FarewellScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const config = useMissionStore((s) => s.config);
  const disposition = useMissionStore((s) => s.disposition);
  const resetMission = useMissionStore((s) => s.resetMission);
  const archiveMission = useMissionStore((s) => s.archiveMission);
  const [phase, setPhase] = useState(0);
  const [autoRedirectCountdown, setAutoRedirectCountdown] = useState<number | null>(null);

  // Guarantee mission is archived
  useEffect(() => {
    archiveMission();
  }, [archiveMission]);

  // Phase transition sequencing
  useEffect(() => {
    const t1 = setTimeout(() => setPhase(1), 1800);
    const t2 = setTimeout(() => setPhase(2), 4200);
    const t3 = setTimeout(() => {
      setPhase(3);
      setAutoRedirectCountdown(7);
    }, 7000);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
      clearTimeout(t3);
    };
  }, []);

  // Automatic countdown to navigate to archive screen
  useEffect(() => {
    if (autoRedirectCountdown === null) return;
    if (autoRedirectCountdown <= 0) {
      setScreen('archive');
      return;
    }
    const timer = setInterval(() => {
      setAutoRedirectCountdown((prev) => (prev !== null ? prev - 1 : null));
    }, 1000);
    return () => clearInterval(timer);
  }, [autoRedirectCountdown, setScreen]);

  const handleNewMission = () => {
    resetMission();
    setScreen('welcome');
  };

  const handleGoToArchive = () => {
    setScreen('archive');
  };

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      alignItems: 'center', justifyContent: 'center',
      background: 'radial-gradient(ellipse at center, rgba(0,212,255,0.04) 0%, #020409 70%)',
      position: 'relative', overflow: 'hidden', padding: 24,
    }}>
      {/* Stars animation */}
      <div style={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none' }}>
        {Array.from({ length: 80 }).map((_, i) => (
          <div key={i} style={{
            position: 'absolute',
            left: `${(i * 13.7) % 100}%`,
            top: `${(i * 23.3) % 100}%`,
            width: (i % 3) + 1,
            height: (i % 3) + 1,
            borderRadius: '50%',
            background: i % 4 === 0 ? '#00d4ff' : 'white',
            opacity: 0.3 + ((i % 5) / 10),
            animation: `star-twinkle ${2 + (i % 4)}s ease-in-out infinite`,
            animationDelay: `${(i % 3)}s`,
          }} />
        ))}
      </div>

      <div style={{ textAlign: 'center', zIndex: 1, padding: '24px 32px', maxWidth: 800 }}>
        {/* Phase 0: Mission Title */}
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 1.5 }}
        >
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, letterSpacing: '0.4em', color: 'rgba(0,212,255,0.6)', marginBottom: 16 }}>
            MISSION ACCOMPLISHED · STANDBY
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 7vw, 84px)', fontWeight: 900, color: '#fff', marginBottom: 16, letterSpacing: '0.05em', textShadow: '0 0 50px rgba(0,212,255,0.3)' }}>
            {config?.name}
          </div>
        </motion.div>

        {/* Phase 1: Farewell Poetry Quote */}
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: phase >= 1 ? 1 : 0 }}
          transition={{ duration: 1.2 }}
          style={{ fontFamily: 'var(--font-body)', fontSize: 'clamp(14px, 2vw, 19px)', color: 'rgba(255,255,255,0.7)', lineHeight: 1.8, marginBottom: 28, maxWidth: 540, margin: '0 auto 28px' }}
        >
          "Every mission has an end.<br />Every journey leaves a permanent mark among the stars."
        </motion.p>

        {/* Phase 2: Farewell message & Archive acknowledgment */}
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: phase >= 2 ? 1 : 0, scale: phase >= 2 ? 1 : 0.95 }}
          transition={{ duration: 1 }}
          style={{
            marginBottom: 28, padding: '16px 24px',
            background: 'rgba(5,12,25,0.75)', border: '1px solid rgba(0,212,255,0.25)',
            borderRadius: 10, backdropFilter: 'blur(10px)',
          }}
        >
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00d4ff', letterSpacing: '0.2em', marginBottom: 6 }}>
            ✓ MISSION TELEMETRY &amp; BLACK BOX ARCHIVED
          </div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#fff', fontWeight: 700 }}>
            "Thank you, {config?.name}."
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.45)', marginTop: 6 }}>
            FINAL DISPOSITION: <span style={{ color: '#00ff88' }}>{disposition?.replace('-', ' ').toUpperCase() ?? 'COMPLETED & ARCHIVED'}</span>
          </div>
        </motion.div>

        {/* Phase 3: Auto-Redirect Notice & Interactive Buttons */}
        <motion.div
          initial={{ opacity: 0, y: 15 }}
          animate={{ opacity: phase >= 3 ? 1 : 0, y: phase >= 3 ? 0 : 15 }}
          transition={{ duration: 0.8 }}
        >
          {autoRedirectCountdown !== null && (
            <div style={{ marginBottom: 24 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#00d4ff', letterSpacing: '0.15em', marginBottom: 8 }}>
                ◫ AUTOMATICALLY RETURNING TO MISSION ARCHIVE IN <span style={{ fontSize: 14, fontWeight: 700, color: '#00ff88' }}>{autoRedirectCountdown}s</span>…
              </div>
              <div style={{ width: '100%', maxWidth: 360, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2, margin: '0 auto', overflow: 'hidden' }}>
                <div style={{
                  height: '100%',
                  width: `${(autoRedirectCountdown / 7) * 100}%`,
                  background: 'linear-gradient(90deg, #00d4ff, #00ff88)',
                  transition: 'width 1s linear',
                }} />
              </div>
            </div>
          )}

          <div style={{ display: 'flex', gap: 12, justifyContent: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleGoToArchive}
              className="btn btn-primary btn-lg"
              style={{ padding: '12px 28px', fontSize: 12, letterSpacing: '0.12em', boxShadow: '0 0 25px rgba(0,212,255,0.4)' }}
            >
              ◫ VIEW ARCHIVE NOW
            </button>
            <button
              onClick={() => setScreen('replay')}
              className="btn btn-lg"
              style={{ padding: '12px 24px', fontSize: 12, background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
            >
              ▶ REPLAY MISSION
            </button>
            <button
              onClick={() => setScreen('reports')}
              className="btn btn-lg"
              style={{ padding: '12px 24px', fontSize: 12 }}
            >
              ≡ PDF REPORT
            </button>
            <button
              onClick={handleNewMission}
              className="btn btn-lg"
              style={{ padding: '12px 24px', fontSize: 12, background: 'rgba(255,255,255,0.05)', color: 'rgba(255,255,255,0.7)' }}
            >
              + NEW MISSION
            </button>
          </div>
        </motion.div>
      </div>
    </div>
  );
}

