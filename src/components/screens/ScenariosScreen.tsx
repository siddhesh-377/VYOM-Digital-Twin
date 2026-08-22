import { useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { SatelliteModel } from '../three/SatelliteScene';
import { StarField } from '../three/SpaceScene';
import { threatEngine } from '../../engines/ThreatEngine';
import { backendWS, injectFaultViaBackend } from '../../services/BackendWebSocketService';
import { WhatIfComparison } from '../three/WhatIfComparison';

const THREATS = [
  {
    id: 'solar-storm',
    name: 'SOLAR STORM',
    icon: '☀',
    description: 'Intense solar particle event — radiation spike, communication interference, thermal increase.',
    severity: 'critical' as const,
    effects: { radiation: 8, solar: 6, thermal: 5 },
    color: '#ff8c00',
  },
  {
    id: 'asteroid',
    name: 'ASTEROID IMPACT',
    icon: '☄',
    description: 'Near-miss asteroid debris — microimpact damage to outer panels, attitude disturbance.',
    severity: 'critical' as const,
    effects: { asteroid: 4 },
    color: '#ff2d55',
  },
  {
    id: 'debris',
    name: 'SPACE DEBRIS',
    icon: '⚙',
    description: 'High-density debris field — evasive maneuvers required, fuel consumption elevated.',
    severity: 'warning' as const,
    effects: { debris: 5 },
    color: '#ff8c00',
  },
  {
    id: 'power-failure',
    name: 'POWER FAILURE',
    icon: '⚡',
    description: 'Solar panel degradation — battery drain, emergency load shedding required.',
    severity: 'critical' as const,
    effects: { power: 7 },
    color: '#ff2d55',
  },
  {
    id: 'thermal-failure',
    name: 'THERMAL EVENT',
    icon: '🌡',
    description: 'Extreme thermal excursion — payload cooling failure, temperature thresholds exceeded.',
    severity: 'critical' as const,
    effects: { thermal: 8 },
    color: '#ff8c00',
  },
  {
    id: 'communication-failure',
    name: 'COMM FAILURE',
    icon: '📡',
    description: 'Communication blackout — antenna fault or severe signal interference.',
    severity: 'warning' as const,
    effects: { comms: 9 },
    color: '#9b5de5',
  },
  {
    id: 'attitude-failure',
    name: 'ATTITUDE ERROR',
    icon: '🎯',
    description: 'Attitude control system anomaly — spacecraft tumbling, solar panel misalignment.',
    severity: 'warning' as const,
    effects: { attitude: 8 },
    color: '#ff8c00',
  },
];

export function ScenariosScreen() {
  const activeThreats = useMissionStore((s) => s.activeThreats);
  const blackBox = useMissionStore((s) => s.blackBox);
  const [triggered, setTriggered] = useState<string | null>(null);
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  const ai = useMissionStore((s) => s.aiAnalysis);
  const incidents = useMissionStore((s) => s.incidents);

  const handleTrigger = async (threat: typeof THREATS[0]) => {
    if (activeThreats.length > 0) return; // Only one threat at a time
    setTriggered(threat.id);
    const store = useMissionStore.getState();
    let injected = false;
    if (backendWS.isConnected && store.config?.id) {
      injected = await injectFaultViaBackend(store.config.id, threat.id);
    }
    if (!injected) {
      threatEngine.triggerThreat(
        threat.id,
        threat.name,
        threat.description,
        threat.effects
      );
    }
    setTimeout(() => setTriggered(null), 3000);
  };

  const recentEvents = blackBox.slice(-6).reverse();

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', background: '#020409',
      paddingBottom: 56, overflow: 'hidden',
    }}>
      {/* Left: 3D satellite */}
      <div style={{ flex: '0 0 35%', position: 'relative', borderRight: '1px solid rgba(255,45,85,0.1)' }}>
        <Canvas gl={{ antialias: true }} dpr={[1, 1.5]} camera={{ position: [0, 0.5, 3.5], fov: 45 }}>
          <ambientLight intensity={activeThreats.length > 0 ? 0.05 : 0.2} />
          <directionalLight
            position={[3, 3, 3]}
            intensity={activeThreats.length > 0 ? 0.5 : 1}
            color={activeThreats.some((t) => t.type === 'solar-storm') ? '#ff8c00' : '#fff5e8'}
          />
          <StarField />
          <SatelliteModel scale={1.5} />
          <OrbitControls enablePan={false} enableZoom={false} autoRotate autoRotateSpeed={activeThreats.length > 0 ? 3 : 0.5} />
        </Canvas>
        {/* Active threat overlay */}
        {activeThreats.length > 0 && (
          <div style={{
            position: 'absolute', inset: 0, pointerEvents: 'none',
            background: 'rgba(255,45,85,0.05)',
            border: '2px solid rgba(255,45,85,0.3)',
            animation: 'threat-alert 1s ease-in-out infinite',
          }} />
        )}
        <div style={{
          position: 'absolute', top: 16, left: 16,
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em',
        }}>
          THREAT SIMULATOR · {activeThreats.length > 0 ? '⚠ THREAT ACTIVE' : 'NOMINAL'}
        </div>
      </div>

      {/* Right: Scenarios + Log */}
      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
        {/* Header */}
        <div style={{
          padding: '20px 24px', borderBottom: '1px solid rgba(255,255,255,0.06)',
          display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 10,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,45,85,0.7)', letterSpacing: '0.2em', marginBottom: 4 }}>
              MISSION CHALLENGE MODE
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#fff' }}>
              DANGER SIMULATOR
            </div>
          </div>
          {activeThreats.length > 0 && (
            <div style={{
              padding: '8px 16px',
              background: ai.isTimeout ? 'rgba(255,45,85,0.2)' : 'rgba(155,93,229,0.15)',
              border: `1px solid ${ai.isTimeout ? '#ff2d55' : '#9b5de5'}`,
              borderRadius: 6, display: 'flex', alignItems: 'center', gap: 14,
            }}>
              <div style={{
                width: 6, height: 6, borderRadius: '50%',
                background: ai.isTimeout ? '#ff2d55' : '#9b5de5',
                animation: !ai.isTimeout ? 'ai-pulse 1s infinite' : 'none',
              }} />
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: '#fff' }}>
                STAGE: <strong style={{ color: ai.isTimeout ? '#ff2d55' : '#9b5de5' }}>{(ai.liveStage ?? 'ANALYSING').toUpperCase()}</strong>
                {' · '}AI TIME: <strong style={{ color: '#00d4ff' }}>{(ai.realElapsedSeconds ?? 0).toFixed(1)}s</strong> / 6.0s
                {ai.virtualRecoveryTimeStr && (
                  <span style={{ marginLeft: 10, opacity: 0.8, color: '#00ff88' }}>
                    (Virtual: {ai.virtualRecoveryTimeStr})
                  </span>
                )}
              </div>
            </div>
          )}
        </div>

        <div style={{ flex: 1, overflow: 'auto', padding: '20px 24px', display: 'flex', gap: 20 }}>
          {/* Threat cards */}
          <div style={{ flex: '0 0 55%' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
              SELECT A THREAT SCENARIO TO TRIGGER
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
              {THREATS.map((threat) => {
                const isActive = activeThreats.some((t) => t.type === threat.id);
                const isTriggering = triggered === threat.id;
                const disabled = activeThreats.length > 0 && !isActive;
                return (
                  <motion.div
                    key={threat.id}
                    whileHover={!disabled && !isActive ? { scale: 1.02, y: -2 } : {}}
                    onClick={() => !disabled && !isActive && handleTrigger(threat)}
                    onMouseEnter={() => setHoveredId(threat.id)}
                    onMouseLeave={() => setHoveredId(null)}
                    style={{
                      padding: '16px',
                      background: isActive ? `rgba(${threat.color === '#ff2d55' ? '255,45,85' : threat.color === '#ff8c00' ? '255,140,0' : '155,93,229'},0.1)` : 'rgba(0,0,0,0.4)',
                      border: `1px solid ${isActive ? threat.color + '50' : 'rgba(255,255,255,0.06)'}`,
                      borderRadius: 8,
                      cursor: disabled ? 'not-allowed' : isActive ? 'default' : 'pointer',
                      opacity: disabled ? 0.3 : 1,
                      transition: 'all 0.2s',
                      animation: isActive ? 'threat-alert 1s ease-in-out infinite' : 'none',
                    }}
                  >
                    <div style={{ fontSize: 24, marginBottom: 8 }}>{threat.icon}</div>
                    <div style={{
                      fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700,
                      color: isActive ? threat.color : '#fff', letterSpacing: '0.05em', marginBottom: 4,
                    }}>
                      {isActive ? '⚡ ACTIVE: ' : ''}{threat.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5 }}>
                      {threat.description}
                    </div>
                    {!isActive && !disabled && (
                      <div style={{
                        marginTop: 10, padding: '5px 10px',
                        background: 'rgba(255,255,255,0.05)', border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 9,
                        color: threat.color, textAlign: 'center', letterSpacing: '0.1em',
                      }}>
                        {isTriggering ? 'TRIGGERING…' : `[ TRIGGER ${threat.name} ]`}
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>

            <div style={{ marginTop: 12, padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.2)' }}>
                FICTIONAL SCENARIO · VYOM AI will autonomously detect and respond to all triggered threats
              </span>
            </div>
          </div>

          {/* Recent events & Comparison */}
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
              RECENT EVENTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, flex: 1, overflowY: 'auto' }}>
              <AnimatePresence>
                {recentEvents.map((ev) => (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: 20 }}
                    animate={{ opacity: 1, x: 0 }}
                    style={{
                      padding: '10px 12px',
                      background: 'rgba(0,0,0,0.3)',
                      borderLeft: `2px solid ${ev.severity === 'critical' ? 'var(--critical)' : ev.severity === 'warning' ? 'var(--warning)' : 'var(--nominal)'}`,
                      borderRadius: '0 6px 6px 0',
                    }}
                  >
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginBottom: 3 }}>
                      DAY {Math.floor(ev.missionDay)} · {ev.eventType.toUpperCase()} · {ev.source}
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4 }}>
                      {ev.description}
                    </div>
                  </motion.div>
                ))}
              </AnimatePresence>
              {recentEvents.length === 0 && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.2)', padding: 20, textAlign: 'center' }}>
                  No events yet — trigger a scenario
                </div>
              )}
            </div>

            {/* AI vs Manual Performance Card */}
            <div style={{ marginTop: 20, padding: '16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.1em', marginBottom: 10 }}>
                📊 AI VS MANUAL PERFORMANCE METRICS
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>VYOM AI GUARDIAN AVG</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#00ff88', fontWeight: 700 }}>
                    {useMissionStore.getState().incidents.filter(i => i.recovery_mode === 'ai' && i.total_resolution_ms).length > 0 
                      ? (useMissionStore.getState().incidents.filter(i => i.recovery_mode === 'ai' && i.total_resolution_ms).reduce((a, b) => a + (b.total_resolution_ms || 0), 0) / useMissionStore.getState().incidents.filter(i => i.recovery_mode === 'ai' && i.total_resolution_ms).length / 1000).toFixed(1) + 's' 
                      : '--'}
                  </div>
                </div>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', marginBottom: 4 }}>MANUAL CONTROL AVG</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#ff8c00', fontWeight: 700 }}>
                    {useMissionStore.getState().incidents.filter(i => i.recovery_mode === 'manual' && i.total_resolution_ms).length > 0 
                      ? (useMissionStore.getState().incidents.filter(i => i.recovery_mode === 'manual' && i.total_resolution_ms).reduce((a, b) => a + (b.total_resolution_ms || 0), 0) / useMissionStore.getState().incidents.filter(i => i.recovery_mode === 'manual' && i.total_resolution_ms).length / 1000).toFixed(1) + 's' 
                      : '--'}
                  </div>
                </div>
              </div>

              {/* ── v3.0 additive: Mission What-If / Scenario Comparison ── */}
              <WhatIfComparison />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
