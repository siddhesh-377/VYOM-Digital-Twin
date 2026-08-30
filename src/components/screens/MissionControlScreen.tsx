import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useMissionStore } from '../../store/missionStore';
import { backendWS } from '../../services/BackendWebSocketService';
import { threatEngine } from '../../engines/ThreatEngine';
import { DynamicSpacecraftModel } from '../three/DynamicSpacecraftModel';
import { StarField } from '../three/SpaceScene';
import type { AppScreen } from '../../types/mission';

export function formatElapsed(day: number): string {
  const totalSecs = Math.floor(day * 86400);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

function HealthRing({ value }: { value: number }) {
  const r = 38;
  const c = 2 * Math.PI * r;
  const offset = c - (value / 100) * c;
  const color = value > 75 ? '#00ff88' : value > 40 ? '#ff8c00' : '#ff2d55';

  return (
    <div style={{ position: 'relative', width: 96, height: 96, margin: '0 auto' }}>
      <svg width={96} height={96} style={{ transform: 'rotate(-90deg)' }}>
        <circle cx={48} cy={48} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={7} />
        <circle
          cx={48} cy={48} r={r} fill="none" stroke={color} strokeWidth={7}
          strokeDasharray={c} strokeDashoffset={offset}
          strokeLinecap="round"
          style={{ transition: 'stroke-dashoffset 0.5s ease, stroke 0.5s ease' }}
        />
      </svg>
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      }}>
        <span style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#fff', lineHeight: 1 }}>
          {Math.round(value)}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
          HEALTH %
        </span>
      </div>
    </div>
  );
}

function TelemetryMini({
  label, value, unit, status,
}: {
  label: string;
  value: string | number;
  unit?: string;
  status?: 'nominal' | 'warning' | 'critical';
}) {
  const color = status === 'critical' ? '#ff2d55' : status === 'warning' ? '#ff8c00' : '#fff';
  const valColor = status === 'critical' ? '#ff2d55' : status === 'warning' ? '#ff8c00' : '#00d4ff';

  return (
    <div style={{
      background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)',
      borderRadius: 6, padding: '6px 8px',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em', marginBottom: 2 }}>
        {label}
      </div>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 3 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: valColor }}>
          {value}
        </span>
        {unit && <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>{unit}</span>}
      </div>
    </div>
  );
}

const WARP_SPEEDS = [
  { label: 'PAUSE', val: 0 },
  { label: '1×', val: 1 },
  { label: '10×', val: 10 },
  { label: '100×', val: 100 },
  { label: '1K×', val: 1000 },
  { label: '10K×', val: 10000 },
  { label: '86K×', val: 86400 },
  { label: '604K×', val: 604800 },
  { label: '2.5M×', val: 2592000 },
];

export function MissionControlScreen() {
  const config = useMissionStore((s) => s.config);
  const telemetry = useMissionStore((s) => s.telemetry);
  const status = useMissionStore((s) => s.status);
  const missionDay = useMissionStore((s) => s.missionDay);
  const crew = useMissionStore((s) => s.crew);
  const aiAnalysis = useMissionStore((s) => s.aiAnalysis);
  const activeThreats = useMissionStore((s) => s.activeThreats);
  const objectiveProgress = useMissionStore((s) => s.objectiveProgress);
  const telemetryHistory = useMissionStore((s) => s.telemetryHistory);
  const timeMultiplier = useMissionStore((s) => s.timeMultiplier);
  const setTimeMultiplier = useMissionStore((s) => s.setTimeMultiplier);
  const setScreen = useMissionStore((s) => s.setScreen);

  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');

  useEffect(() => {
    if (config?.id) {
      backendWS.connect(config.id);
    }
    const unsub = backendWS.onStatusChange(setWsStatus);
    return () => unsub();
  }, [config?.id]);

  const handleWarpChange = (val: number) => {
    setTimeMultiplier(val);
    if (backendWS.isConnected) {
      backendWS.setTimeMultiplier(val);
    }
  };

  const powerHistory = telemetryHistory.slice(-60).map((t, i) => ({
    i, v: t.power.batteryPercent,
  }));

  const health = telemetry?.overallHealth ?? 100;
  const healthStatus = telemetry?.healthStatus ?? 'nominal';
  const statusColor = healthStatus === 'nominal' ? '#00ff88' : healthStatus === 'warning' ? '#ff8c00' : '#ff2d55';
  const isHumanMission = config?.type === 'human';

  // Derived live coordinates
  const lat = (telemetry?.orbit?.latitudeDeg ?? (12.84 + Math.sin(missionDay * 5) * 20)).toFixed(2);
  const lon = (telemetry?.orbit?.longitudeDeg ?? ((77.62 + missionDay * 80) % 360 - 180)).toFixed(2);
  const altKm = (telemetry?.orbit?.altitudeKm ?? 650.0).toFixed(1);
  const velKms = (telemetry?.orbit?.velocityKms ?? 7.62).toFixed(2);
  const signalDbm = (telemetry?.comm?.signalDbm ?? -72).toFixed(0);

  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid',
      gridTemplateColumns: '310px 1fr 320px',
      gridTemplateRows: '56px 1fr',
      background: '#020409', overflow: 'hidden',
      paddingBottom: 56,
      color: '#fff', fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── TOP STATUS BAR ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'rgba(2,4,9,0.98)',
        borderBottom: '1px solid rgba(0,212,255,0.15)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 14,
        zIndex: 10,
      }}>
        {/* Brand */}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900, color: '#00d4ff', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setScreen('welcome')}>
          VYOM
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 7, padding: '2px 4px', borderRadius: 2, letterSpacing: 0,
            background: wsStatus === 'connected' ? 'rgba(155,93,229,0.2)' : 'rgba(255,255,255,0.1)',
            border: `1px solid ${wsStatus === 'connected' ? '#9b5de5' : 'rgba(255,255,255,0.2)'}`,
            color: wsStatus === 'connected' ? '#9b5de5' : 'rgba(255,255,255,0.6)',
          }}>
            {wsStatus === 'connected' ? 'LIVE BACKEND' : 'LOCAL SIM'}
          </div>
        </div>
        <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />

        {/* Mission identity */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>MISSION:</span>
          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
            {config?.name ?? 'VYOM-01'}
          </span>
          <span style={{
            fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 6px',
            background: isHumanMission ? 'rgba(0,255,136,0.12)' : 'rgba(0,212,255,0.12)',
            border: `1px solid ${isHumanMission ? '#00ff88' : '#00d4ff'}`,
            borderRadius: 3, color: isHumanMission ? '#00ff88' : '#00d4ff', textTransform: 'uppercase',
          }}>
            {isHumanMission ? '👨‍🚀 HUMAN' : config?.type?.toUpperCase() ?? 'ORBITAL'}
          </span>
        </div>

        {/* Destination Target */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 8px', background: 'rgba(0,212,255,0.08)',
          border: '1px solid rgba(0,212,255,0.2)', borderRadius: 4,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>TARGET:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00d4ff', fontWeight: 600 }}>
            {config?.destination?.toUpperCase().replace('-', ' ') ?? 'EARTH ORBIT'}
          </span>
        </div>

        {/* Budget badge */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 6,
          padding: '3px 8px', background: 'rgba(0,255,136,0.08)',
          border: '1px solid rgba(0,255,136,0.2)', borderRadius: 4,
        }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>BUDGET:</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: '#00ff88' }}>
            ₹{config?.budgetCrore ?? 250} Cr
          </span>
        </div>

        {/* Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <div style={{ width: 6, height: 6, borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: statusColor }}>
            {status.toUpperCase()}
          </span>
        </div>

        {/* Mission Day */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          DAY: <span style={{ color: '#00d4ff', fontWeight: 700 }}>{String(Math.floor(missionDay)).padStart(4, '0')}</span>
        </div>

        {activeThreats.length > 0 && (
          <div style={{
            padding: '3px 10px', background: 'rgba(255,45,85,0.15)',
            border: '1px solid rgba(255,45,85,0.4)', borderRadius: 4,
            fontFamily: 'var(--font-mono)', fontSize: 9, color: '#ff2d55',
            letterSpacing: '0.1em', animation: 'threat-alert 1s ease-in-out infinite',
          }}>
            ⚠ {activeThreats.length} THREAT ACTIVE
          </div>
        )}

        {/* Ultra Warp Time Multipliers */}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: 8 }}>
          <button
            onClick={() => setScreen('onboarding')}
            style={{
              padding: '5px 10px', background: 'rgba(0,212,255,0.1)',
              border: '1px solid rgba(0,212,255,0.4)', borderRadius: 4,
              color: '#00d4ff', fontFamily: 'var(--font-mono)', fontSize: 9,
              cursor: 'pointer', transition: 'all 0.2s',
            }}
          >
            + NEW MISSION
          </button>

          <div style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
            {WARP_SPEEDS.map((s) => (
              <button key={s.val}
                onClick={() => handleWarpChange(s.val)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8,
                  padding: '3px 6px',
                  background: timeMultiplier === s.val ? 'rgba(0,212,255,0.25)' : 'transparent',
                  border: `1px solid ${timeMultiplier === s.val ? '#00d4ff' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 3, color: timeMultiplier === s.val ? '#00d4ff' : 'rgba(255,255,255,0.4)',
                  cursor: 'pointer',
                }}
                title={`${s.label} speed`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── LEFT PANEL: HEALTH, MISSION & THREAT TRIGGERS ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: 'rgba(5,12,25,0.94)', borderRight: '1px solid rgba(0,212,255,0.08)',
        padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 12,
      }}>
        {/* Health ring */}
        <div style={{ textAlign: 'center', padding: '6px 0' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>SPACECRAFT HEALTH</div>
          <HealthRing value={health} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: statusColor, marginTop: 4 }}>
            {healthStatus.toUpperCase()}
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />

        {/* Astronaut Crew Health Card ONLY FOR HUMAN MISSIONS */}
        {isHumanMission && crew && crew.length > 0 ? (
          <div style={{
            padding: '10px', background: 'rgba(0,255,136,0.04)',
            border: '1px solid rgba(0,255,136,0.2)', borderRadius: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88', letterSpacing: '0.1em' }}>
                👨‍🚀 ASTRONAUT CREW ({crew.length})
              </span>
              <button
                onClick={() => setScreen('crew')}
                style={{
                  background: 'none', border: 'none', color: '#00d4ff',
                  fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer',
                }}
              >
                OPEN HUD →
              </button>
            </div>
            {crew.slice(0, 3).map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fff' }}>{c.name.split(' ').slice(-1)[0]}</span>
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88' }}>{c.heartRateBpm} BPM</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00d4ff' }}>{c.spo2Percent}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          /* Robotic Payload Suite for Non-Human Missions */
          <div style={{
            padding: '10px', background: 'rgba(0,212,255,0.04)',
            border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00d4ff', letterSpacing: '0.1em', marginBottom: 4 }}>
              🛰 SCIENTIFIC INSTRUMENT SUITE
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fff', marginBottom: 2 }}>
              Autonomous Multispectral Ingestion
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>Instruments: Nominal</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88' }}>SNR: 48 dB</span>
            </div>
          </div>
        )}

        {/* Mission Goal & Objective */}
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'rgba(0,212,255,0.7)', marginBottom: 4 }}>
            GOAL: {config?.destination?.toUpperCase().replace('-', ' ') ?? 'EARTH ORBIT'}
          </div>
          <div style={{
            padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>PHASE:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00d4ff' }}>{telemetry?.orbit.phaseDesc ?? 'Nominal'}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>DISTANCE:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#fff' }}>{(telemetry?.orbit.distanceFromEarthKm ?? 650).toLocaleString()} km</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>SITE:</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#fff' }}>{config?.launchSite?.name?.split(' ')[0] ?? 'Sriharikota'}</span>
            </div>
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>
            OBJECTIVE PROGRESS ({Math.round(objectiveProgress)}%)
          </div>
          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${Math.max(2, objectiveProgress)}%`, background: 'linear-gradient(90deg, #00d4ff, #00ff88)', borderRadius: 2, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4 }}>
            {config?.objective ?? 'Scientific observation and autonomous mission telemetry.'}
          </div>
        </div>

        {/* AI Guardian Live Status Card */}
        <div
          onClick={() => setScreen('ai')}
          style={{
            padding: '10px', background: aiAnalysis.anomalyDetected ? 'rgba(155,93,229,0.15)' : 'rgba(0,0,0,0.25)',
            border: `1px solid ${aiAnalysis.anomalyDetected ? '#9b5de5' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 8, cursor: 'pointer',
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#9b5de5', animation: 'ai-pulse 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9b5de5', letterSpacing: '0.12em' }}>VYOM AI GUARDIAN</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9b5de5' }}>OPEN KERNEL →</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: aiAnalysis.anomalyDetected ? '#ff8c00' : 'rgba(255,255,255,0.7)', lineHeight: 1.3 }}>
            {aiAnalysis.anomalyDetected ? `Phase [${aiAnalysis.phase.toUpperCase()}]: ${aiAnalysis.anomalyDescription}` : 'Neural kernel monitoring · All parameters nominal'}
          </div>
        </div>

        {/* Quick Danger Simulator Triggers */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', color: 'rgba(255,45,85,0.7)' }}>
              ⚡ DANGER SIMULATOR
            </span>
            <button
              onClick={() => setScreen('scenarios')}
              style={{ background: 'none', border: 'none', color: '#ff2d55', fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer' }}
            >
              ALL SCENARIOS →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
            {[
              { id: 'solar-storm', label: '☀️ SOLAR FLARE' },
              { id: 'space-debris', label: '💥 DEBRIS CLOUD' },
              { id: 'battery-drain', label: '🔋 BATTERY DROP' },
              { id: 'signal-loss', label: '📡 COMMS LOSS' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => threatEngine.triggerThreat(t.id, t.label, `${t.label} anomaly detected`, { [t.id]: 5 })}
                style={{
                  padding: '5px 4px', background: 'rgba(255,45,85,0.08)',
                  border: '1px solid rgba(255,45,85,0.25)', borderRadius: 4,
                  color: '#ff2d55', fontFamily: 'var(--font-mono)', fontSize: 8,
                  cursor: 'pointer', transition: 'all 0.15s',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── CENTER: 3D SATELLITE DIGITAL TWIN & COORDINATES ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{ position: 'relative', background: '#020409', overflow: 'hidden' }}>
        <Canvas gl={{ antialias: true }} dpr={[1, 2]}>
          <PerspectiveCamera makeDefault position={[0, 0.5, 4]} fov={40} />
          <ambientLight intensity={0.3} />
          <directionalLight position={[4, 3, 4]} intensity={1.4} color="#fff5e8" />
          <directionalLight position={[-3, -1, -3]} intensity={0.4} color="#aaccff" />
          <StarField />
          {/* Mission-Specific Satellite 3D Model */}
          <DynamicSpacecraftModel scale={1.4} interactive={true} />
          <OrbitControls enableZoom={true} enablePan={true} maxDistance={10} minDistance={1.2} />
        </Canvas>

        {/* Top-left Overlay Identity */}
        <div style={{ position: 'absolute', top: 16, left: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.12em', background: 'rgba(2,4,9,0.7)', padding: '4px 8px', borderRadius: 4, backdropFilter: 'blur(4px)' }}>
          DIGITAL TWIN · {config?.name ?? 'VYOM-01'} · {config?.destination?.toUpperCase().replace('-', ' ') ?? 'EARTH ORBIT'}
        </div>

        {/* Active Threat Warning Flash */}
        {activeThreats.length > 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            fontFamily: 'var(--font-display)', fontSize: 13, color: '#ff2d55',
            letterSpacing: '0.2em', animation: 'data-flash 0.8s ease-in-out infinite',
            pointerEvents: 'none', background: 'rgba(0,0,0,0.7)', padding: '8px 16px', borderRadius: 6,
            border: '1px solid #ff2d55',
          }}>
            ⚠ {activeThreats[0]?.name}
          </div>
        )}

        {/* Live Coordinates HUD Ribbon */}
        <div style={{
          position: 'absolute', bottom: 16, left: 16,
          background: 'rgba(2, 6, 14, 0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 212, 255, 0.25)', borderRadius: 6,
          padding: '6px 12px', display: 'flex', gap: 14, alignItems: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fff',
        }}>
          <div>
            <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>COORDINATES:</span>
            <span style={{ color: '#00d4ff', fontWeight: 700 }}>{lat}° N, {lon}° E</span>
          </div>
          <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.15)' }} />
          <div>
            <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>ALT:</span>
            <span style={{ color: '#00ff88', fontWeight: 700 }}>{altKm} km</span>
          </div>
          <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.15)' }} />
          <div>
            <span style={{ color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>VEL:</span>
            <span style={{ color: '#ff9f0a', fontWeight: 700 }}>{velKms} km/s</span>
          </div>
        </div>

        {/* Signal & Orbit Phase Status */}
        {telemetry && (
          <div style={{
            position: 'absolute', bottom: 16, right: 16, display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(2, 6, 14, 0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: 6, padding: '6px 10px',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4ff', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.9)' }}>
              SIGNAL: {signalDbm} dBm · {telemetry.orbit.phaseDesc ?? 'Nominal'}
            </span>
          </div>
        )}
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── RIGHT PANEL: LIVE TELEMETRY STREAM ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        background: 'rgba(5,12,25,0.94)', borderLeft: '1px solid rgba(0,212,255,0.08)',
        padding: '14px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)' }}>
          LIVE TELEMETRY STREAM
        </div>

        {telemetry && (
          <>
            {/* Power */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em', marginBottom: 4 }}>⚡ POWER</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                <TelemetryMini label="BATTERY" value={telemetry.power.batteryPercent.toFixed(1)} unit="%"
                  status={telemetry.power.batteryPercent < 25 ? 'critical' : telemetry.power.batteryPercent < 40 ? 'warning' : undefined} />
                <TelemetryMini label="BUS VOLT" value={telemetry.power.voltageV.toFixed(1)} unit="V"
                  status={telemetry.power.voltageV < 22 ? 'critical' : undefined} />
                <TelemetryMini label="SOLAR GEN" value={telemetry.power.solarGenerationW.toFixed(0)} unit="W" />
                <TelemetryMini label="LOAD DRAW" value={telemetry.power.consumptionW.toFixed(0)} unit="W" />
              </div>
            </div>

            {/* Battery history chart */}
            <div style={{ height: 44 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={powerHistory}>
                  <Line type="monotone" dataKey="v" stroke="#00d4ff" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            {/* Thermal */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em', marginBottom: 4 }}>🌡 THERMAL</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                <TelemetryMini label="CPU TEMP" value={telemetry.thermal.cpuTempC.toFixed(1)} unit="°C"
                  status={telemetry.thermal.cpuTempC > 80 ? 'critical' : telemetry.thermal.cpuTempC > 65 ? 'warning' : undefined} />
                <TelemetryMini label="BATTERY T" value={telemetry.thermal.batteryTempC.toFixed(1)} unit="°C" />
                <TelemetryMini label="PAYLOAD T" value={telemetry.thermal.payloadTempC.toFixed(1)} unit="°C" />
                <TelemetryMini label="EXT TEMP" value={telemetry.thermal.externalTempC.toFixed(0)} unit="°C" />
              </div>
            </div>

            {/* Trajectory & Dynamics */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em', marginBottom: 4 }}>
                {isHumanMission ? '○ CISLUNAR TRAJECTORY' : '○ ORBIT MECHANICS'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                <TelemetryMini label="ALTITUDE" value={telemetry.orbit.altitudeKm.toFixed(1)} unit="km" />
                <TelemetryMini label="VELOCITY" value={telemetry.orbit.velocityKms.toFixed(2)} unit="km/s" />
                <TelemetryMini label="ACCEL" value={(telemetry.orbit.accelerationMs2 ?? 8.09).toFixed(2)} unit="m/s²" />
                <TelemetryMini label="G-FORCE" value={(telemetry.orbit.gForce ?? 0.82).toFixed(2)} unit="g" />
              </div>
            </div>

            {/* Comms & Attitude */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em', marginBottom: 4 }}>📡 COMMS &amp; ATTITUDE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5 }}>
                <TelemetryMini label="SIGNAL" value={telemetry.comm.signalDbm.toFixed(0)} unit="dBm"
                  status={telemetry.comm.signalDbm < -95 ? 'critical' : undefined} />
                <TelemetryMini label="RATE" value={telemetry.comm.dataRateMbps.toFixed(1)} unit="Mbps" />
                <TelemetryMini label="ROLL" value={telemetry.attitude.rollDeg.toFixed(2)} unit="°" />
                <TelemetryMini label="PITCH" value={telemetry.attitude.pitchDeg.toFixed(2)} unit="°" />
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
