import { useEffect, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { useMissionStore } from '../../store/missionStore';
import { SatelliteModel, OrbitLine } from '../three/SatelliteScene';
import { StarField } from '../three/SpaceScene';
import { backendWS, createAndStartMission, checkBackendHealth } from '../../services/BackendWebSocketService';
import { MissionRiskPanel } from '../three/MissionRiskPanel';

const WARP_SPEEDS = [
  { val: 1, label: '1×' },
  { val: 100, label: '100×' },
  { val: 1000, label: '1K×' },
  { val: 6000, label: '6K×' },
  { val: 18000, label: 'MAX' },   // 18K× = physics-stable ceiling (~4.8 s/day)
];

function TelemetryMini({ label, value, unit, color = '#00d4ff', status }: {
  label: string; value: string; unit?: string; color?: string; status?: string;
}) {
  const statusColor = status === 'critical' ? 'var(--critical)' : status === 'warning' ? 'var(--warning)' : color;
  return (
    <div style={{
      padding: '8px 12px',
      background: 'rgba(0,0,0,0.3)',
      border: `1px solid ${status === 'critical' ? 'rgba(255,45,85,0.4)' : status === 'warning' ? 'rgba(255,140,0,0.25)' : 'rgba(255,255,255,0.06)'}`,
      borderRadius: 6, transition: 'all 0.3s',
      animation: status === 'critical' ? 'threat-alert 1s ease-in-out infinite' : 'none',
    }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', marginBottom: 3 }}>
        {label}
      </div>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: statusColor, lineHeight: 1 }}>
        {value}<span style={{ fontSize: 9, fontWeight: 400, marginLeft: 2, opacity: 0.7 }}>{unit}</span>
      </div>
    </div>
  );
}

function HealthRing({ value }: { value: number }) {
  const r = 36;
  const circ = 2 * Math.PI * r;
  const filled = (value / 100) * circ;
  const color = value > 70 ? '#00ff88' : value > 40 ? '#ff8c00' : '#ff2d55';
  return (
    <svg width={84} height={84} style={{ transform: 'rotate(-90deg)' }}>
      <circle cx={42} cy={42} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={6} />
      <circle cx={42} cy={42} r={r} fill="none" stroke={color}
        strokeWidth={6} strokeDasharray={`${filled} ${circ - filled}`}
        strokeLinecap="round"
        style={{ transition: 'stroke-dasharray 0.8s ease, stroke 0.3s ease', filter: `drop-shadow(0 0 4px ${color})` }}
      />
      <text x={42} y={42} fill={color} textAnchor="middle" dominantBaseline="middle"
        style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, transform: 'rotate(90deg)', transformOrigin: '42px 42px' }}>
        {Math.round(value)}%
      </text>
    </svg>
  );
}

/** Format the fractional part of a mission day as an elapsed clock (Dd HH:MM:SS). */
export function formatElapsed(missionDay: number): string {
  const totalSeconds = Math.max(0, Math.floor(missionDay * 86400));
  const d = Math.floor(totalSeconds / 86400);
  const h = Math.floor((totalSeconds % 86400) / 3600);
  const m = Math.floor((totalSeconds % 3600) / 60);
  const s = totalSeconds % 60;
  return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

export function MissionControlScreen() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const config = useMissionStore((s) => s.config);
  const crew = useMissionStore((s) => s.crew);
  const missionDay = useMissionStore((s) => s.missionDay);
  const status = useMissionStore((s) => s.status);
  const aiAnalysis = useMissionStore((s) => s.aiAnalysis);
  const activeThreats = useMissionStore((s) => s.activeThreats);
  const objectiveProgress = useMissionStore((s) => s.objectiveProgress);
  const telemetryHistory = useMissionStore((s) => s.telemetryHistory);
  const timeMultiplier = useMissionStore((s) => s.timeMultiplier);
  const setTimeMultiplier = useMissionStore((s) => s.setTimeMultiplier);

  const handleWarpChange = (val: number) => {
    setTimeMultiplier(val);
    // Sync to backend if connected so the authoritative simulation runs at the right speed
    if (backendWS.isConnected) {
      backendWS.setTimeMultiplier(val);
    }
  };
  const setScreen = useMissionStore((s) => s.setScreen);

  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');

  useEffect(() => {
    if (config?.id) {
      backendWS.connect(config.id);
    }
    const unsub = backendWS.onStatusChange(setWsStatus);
    return () => unsub();
  }, [config?.id]);

  const powerHistory = telemetryHistory.slice(-60).map((t, i) => ({
    i, v: t.power.batteryPercent,
  }));

  const health = telemetry?.overallHealth ?? 100;
  const healthStatus = telemetry?.healthStatus ?? 'nominal';
  const statusColor = healthStatus === 'nominal' ? '#00ff88' : healthStatus === 'warning' ? '#ff8c00' : '#ff2d55';
  const isHumanMission = config?.type === 'human';

  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid',
      gridTemplateColumns: '310px 1fr 320px',
      gridTemplateRows: '56px 1fr',
      background: '#020409', overflow: 'hidden',
      paddingBottom: 56,
    }}>
      {/* Top status bar */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'rgba(2,4,9,0.98)',
        borderBottom: '1px solid rgba(0,212,255,0.15)',
        display: 'flex', alignItems: 'center',
        padding: '0 20px', gap: 16,
      }}>
        {/* Brand */}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900, color: '#00d4ff', letterSpacing: '0.15em', display: 'flex', alignItems: 'center', gap: 8 }}>
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

        {/* Mission Day + elapsed sim clock (visible at real-time speed) */}
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>
          DAY: <span style={{ color: '#00d4ff', fontWeight: 700 }}>{String(Math.floor(missionDay)).padStart(4, '0')}</span>
          <span style={{ marginLeft: 6, fontSize: 8.5, color: timeMultiplier === 1 && missionDay < 0.02 ? '#ff8c00' : 'rgba(255,255,255,0.45)' }}>
            · T+{formatElapsed(missionDay)}
            {timeMultiplier === 1 && missionDay < 0.02 && ' (1× = 24h/day — use warp ↑)'}
          </span>
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
                title={s.val === 18000 ? 'Maximum physics-stable warp (~4.8 s per mission day)' : `${s.label} speed`}
              >
                {s.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* LEFT PANEL */}
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

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.35)', marginBottom: 3, display: 'flex', justifyContent: 'space-between' }}>
            <span>OBJECTIVE PROGRESS ({Math.round(objectiveProgress)}%)</span>
            <span style={{ color: '#00d4ff' }}>{useMissionStore.getState().missionPhase?.toUpperCase() ?? 'OPERATIONS'}</span>
          </div>
          <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 6 }}>
            <div style={{ height: '100%', width: `${Math.max(2, objectiveProgress)}%`, background: 'linear-gradient(90deg, #00d4ff, #00ff88)', borderRadius: 2, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 10, color: 'rgba(255,255,255,0.65)', lineHeight: 1.4, marginBottom: 8 }}>
            {config?.objective ?? 'Scientific observation and autonomous mission telemetry.'}
          </div>

          {/* Remaining Useful Life (RUL) */}
          <div style={{
            padding: '8px', background: 'rgba(0,255,136,0.05)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 6, marginBottom: 8,
            display: 'flex', justifyContent: 'space-between', alignItems: 'center'
          }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>EST. RUL:</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00ff88', fontWeight: 700 }}>
              {Math.max(0, useMissionStore.getState().rulDays).toFixed(1)} DAYS
            </span>
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
      </div>

      {/* CENTER — 3D Spacecraft View */}
      <div style={{ position: 'relative', background: '#020409' }}>
        <Canvas gl={{ antialias: true }} dpr={[1, 2]}>
          <PerspectiveCamera makeDefault position={[0, 0.5, 4]} fov={40} />
          <ambientLight intensity={0.25} />
          <directionalLight position={[4, 3, 4]} intensity={1.2} color="#fff5e8" />
          <directionalLight position={[-3, -1, -3]} intensity={0.3} color="#aaccff" />
          <StarField />
          <SatelliteModel scale={1.5} />
          <OrbitLine radius={3.2} inclination={51.6} />
          <OrbitControls enableZoom={false} enablePan={false} />
        </Canvas>

        {/* Overlay labels */}
        <div style={{ position: 'absolute', top: 16, left: 16, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em' }}>
          DIGITAL TWIN · {config?.name ?? 'VYOM-01'} · {config?.destination?.toUpperCase().replace('-', ' ') ?? 'EARTH ORBIT'}
        </div>

        {activeThreats.length > 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
            fontFamily: 'var(--font-display)', fontSize: 13, color: '#ff2d55',
            letterSpacing: '0.2em', animation: 'data-flash 0.8s ease-in-out infinite',
            pointerEvents: 'none',
          }}>
            ⚠ {activeThreats[0]?.name}
          </div>
        )}

        {/* Signal & Cislunar readout */}
        {telemetry && (
          <div style={{ position: 'absolute', bottom: 20, right: 20, display: 'flex', alignItems: 'center', gap: 8 }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4ff', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)' }}>
              SIGNAL: {telemetry.comm.signalDbm.toFixed(0)} dBm · {telemetry.orbit.phaseDesc ?? 'Nominal'}
            </span>
          </div>
        )}
      </div>

      {/* RIGHT PANEL — Telemetry */}
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

            {/* Trajectory */}
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

            {/* Comms */}
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

            {/* ── v3.0 additive: Operational Decision Support risk panel ── */}
            <div style={{ height: 1, background: 'rgba(255,255,255,0.06)' }} />
            <MissionRiskPanel />
          </>
        )}
      </div>
    </div>
  );
}
