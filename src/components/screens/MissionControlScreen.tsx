import { useEffect, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { useMissionStore } from '../../store/missionStore';
import { DynamicSpacecraftModel } from '../three/DynamicSpacecraftModel';
import { SpacePathRenderer } from '../three/SpacePathRenderer';
import { StarField } from '../three/SpaceScene';
import { backendWS } from '../../services/BackendWebSocketService';
import { telemetryProvider, TelemetryConnectionState } from '../../services/TelemetryProvider';
import { MISSION_PROFILES } from '../../types/missionProfiles';
import { anomalyPipeline } from '../../engines/AnomalyPipelineEngine';
import { TrajectoryPredictionEngine } from '../../engines/TrajectoryPredictionEngine';
import { InteractiveEarthBackground } from '../ui/InteractiveEarthBackground';
import { AppScreen } from '../../types/mission';

const WARP_SPEEDS = [
  { val: 1, label: '1×' },
  { val: 100, label: '100×' },
  { val: 1000, label: '1K×' },
  { val: 6000, label: '6K×' },
  { val: 18000, label: '18K×' },
  { val: 864000, label: '864K×' },
];

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
  const satellite = useMissionStore((s) => s.satellite);
  const missionDay = useMissionStore((s) => s.missionDay);
  const status = useMissionStore((s) => s.status);
  const aiAnalysis = useMissionStore((s) => s.aiAnalysis);
  const incidents = useMissionStore((s) => s.incidents);
  const activeThreats = useMissionStore((s) => s.activeThreats);
  const objectiveProgress = useMissionStore((s) => s.objectiveProgress);
  const telemetryHistory = useMissionStore((s) => s.telemetryHistory);
  const timeMultiplier = useMissionStore((s) => s.timeMultiplier);
  const isPaused = useMissionStore((s) => s.isPaused);
  const selectedSubsystem = useMissionStore((s) => s.selectedSubsystem);
  const setSelectedSubsystem = useMissionStore((s) => s.setSelectedSubsystem);
  const setMissionProfile = useMissionStore((s) => s.setMissionProfile);
  const setTimeMultiplier = useMissionStore((s) => s.setTimeMultiplier);
  const setScreen = useMissionStore((s) => s.setScreen);

  const [wsStatus, setWsStatus] = useState<'disconnected' | 'connecting' | 'connected' | 'failed'>('disconnected');
  const [telemetryState, setTelemetryState] = useState<TelemetryConnectionState>('SIMULATED');
  const [centerViewMode, setCenterViewMode] = useState<'spacecraft' | 'earth'>('spacecraft');
  const [showObservedOrbit, setShowObservedOrbit] = useState(true);
  const [showPredictedOrbit, setShowPredictedOrbit] = useState(true);
  const [showGroundTrack, setShowGroundTrack] = useState(true);
  const [selectedHorizon, setSelectedHorizon] = useState<'10m' | '30m' | '1orbit' | '6h' | '24h'>('1orbit');
  const [utcTimeStr, setUtcTimeStr] = useState<string>(new Date().toISOString().slice(11, 19) + ' UTC');

  // Master UTC Mission Clock updater
  useEffect(() => {
    const clockTimer = setInterval(() => {
      setUtcTimeStr(new Date().toISOString().slice(11, 19) + ' UTC');
    }, 1000);
    return () => clearInterval(clockTimer);
  }, []);

  // Connect WebSocket & Telemetry Provider
  useEffect(() => {
    if (config?.id) {
      backendWS.connect(config.id);
      telemetryProvider.init(config.id);
    }
    const unsubWs = backendWS.onStatusChange(setWsStatus);
    const unsubState = telemetryProvider.onStateChange(setTelemetryState);
    return () => {
      unsubWs();
      unsubState();
    };
  }, [config?.id]);

  // Run anomaly pipeline on incoming telemetry
  useEffect(() => {
    if (telemetry) {
      anomalyPipeline.evaluate(telemetry);
    }
  }, [telemetry]);

  const activeMissionKey = useMemo(() => {
    if (config?.type === 'human') return 'human';
    if (config?.type === 'planetary') return 'planetary';
    if (config?.type === 'astrophysics') return 'astrophysics';
    return 'orbital';
  }, [config?.type]);

  const predictionResult = useMemo(() => {
    if (!telemetry?.orbit) return null;
    return TrajectoryPredictionEngine.predictHorizon(telemetry.orbit, selectedHorizon);
  }, [telemetry?.orbit, selectedHorizon]);

  const powerHistoryData = useMemo(() => {
    return telemetryHistory.slice(-50).map((t, idx) => ({
      idx,
      battery: t.power?.batteryPercent ?? 100,
      solar: (t.power?.solarGenerationW ?? 200) / 30, // scaled
    }));
  }, [telemetryHistory]);

  const thermalHistoryData = useMemo(() => {
    return telemetryHistory.slice(-50).map((t, idx) => ({
      idx,
      cpu: t.thermal?.cpuTempC ?? 40,
      battery: t.thermal?.batteryTempC ?? 20,
    }));
  }, [telemetryHistory]);

  const handleMissionSelect = (key: 'human' | 'orbital' | 'planetary' | 'astrophysics') => {
    setMissionProfile(key);
    setSelectedSubsystem(null);
  };

  const handleWarpChange = (val: number) => {
    setTimeMultiplier(val);
    if (backendWS.isConnected) {
      backendWS.setTimeMultiplier(val);
    }
  };

  const overallHealth = telemetry?.overallHealth ?? 100;
  const healthColor = overallHealth > 75 ? '#00ff88' : overallHealth > 45 ? '#ff9f0a' : '#ff3b30';

  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid',
      gridTemplateColumns: '320px 1fr 340px',
      gridTemplateRows: '56px 1fr 140px',
      background: '#02040a', overflow: 'hidden',
      color: '#fff', fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 1. TOP BAR: IDENTITY, STATUS & MASTER CLOCK ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <header style={{
        gridColumn: '1 / -1',
        background: 'rgba(5, 10, 20, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0, 229, 255, 0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 20px', zIndex: 10,
      }}>
        {/* Brand & Connection State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer' }} onClick={() => setScreen('welcome')}>
            <div style={{
              width: 10, height: 10, borderRadius: '50%',
              background: telemetryState === 'STALE' ? '#ff3b30' : '#00e5ff',
              boxShadow: telemetryState === 'STALE' ? '0 0 10px #ff3b30' : '0 0 10px #00e5ff',
              animation: telemetryState === 'STALE' ? 'pulse 1s infinite' : 'none',
            }} />
            <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 18, fontWeight: 900, letterSpacing: '0.18em', color: '#00e5ff' }}>
              VYOM
            </span>
          </div>

          <div style={{
            fontSize: 9, fontFamily: 'var(--font-mono, monospace)', padding: '2px 8px', borderRadius: 4,
            background: telemetryState === 'LIVE' ? 'rgba(0,255,136,0.15)' : telemetryState === 'STALE' ? 'rgba(255,59,48,0.2)' : 'rgba(255,159,10,0.15)',
            border: `1px solid ${telemetryState === 'LIVE' ? '#00ff88' : telemetryState === 'STALE' ? '#ff3b30' : '#ff9f0a'}`,
            color: telemetryState === 'LIVE' ? '#00ff88' : telemetryState === 'STALE' ? '#ff3b30' : '#ff9f0a',
            fontWeight: 700, letterSpacing: '0.08em',
          }}>
            {telemetryState === 'LIVE' ? '🔴 LIVE TELEMETRY' : telemetryState === 'STALE' ? '⚠ TELEMETRY STALE' : '🟡 SIMULATION STREAM'}
          </div>

          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>
            {wsStatus === 'connected' ? '⚡ 10Hz WS CONNECTED' : '🔌 LOCAL BACKEND'}
          </div>
        </div>

        {/* Mission Type Switcher Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,0,0,0.4)', padding: '4px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)' }}>
          {(['human', 'orbital', 'astrophysics'] as const).map((key) => {
            const prof = MISSION_PROFILES[key];
            const isActive = activeMissionKey === key;
            return (
              <button
                key={key}
                onClick={() => handleMissionSelect(key)}
                style={{
                  background: isActive ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
                  border: isActive ? '1px solid #00e5ff' : '1px solid transparent',
                  color: isActive ? '#00e5ff' : 'rgba(255,255,255,0.6)',
                  padding: '4px 10px', borderRadius: 5, fontSize: 10, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)',
                  transition: 'all 0.2s ease',
                }}
              >
                {prof.name.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Master Clock & Mission Elapsed Time (MET) */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 12, fontWeight: 700, color: '#00e5ff' }}>
              {utcTimeStr}
            </div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>
              MET: T+{formatElapsed(missionDay)}
            </div>
          </div>

          {/* Status Badge */}
          <div style={{
            padding: '4px 10px', borderRadius: 4, fontSize: 10, fontWeight: 800,
            background: status === 'threatened' ? 'rgba(255,59,48,0.2)' : 'rgba(0,255,136,0.15)',
            border: `1px solid ${status === 'threatened' ? '#ff3b30' : '#00ff88'}`,
            color: status === 'threatened' ? '#ff3b30' : '#00ff88',
            letterSpacing: '0.08em',
          }}>
            {status.toUpperCase()}
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 2. LEFT PANEL: MISSION NAVIGATION & CONTROLS ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <aside style={{
        background: 'rgba(4, 8, 16, 0.92)',
        borderRight: '1px solid rgba(0, 229, 255, 0.12)',
        padding: '16px', display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto', zIndex: 5,
      }}>
        {/* Active Mission Card */}
        <div style={{
          background: 'rgba(0, 229, 255, 0.04)',
          border: '1px solid rgba(0, 229, 255, 0.25)',
          borderRadius: 8, padding: '12px',
        }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: '#00e5ff', letterSpacing: '0.1em' }}>
            ACTIVE MISSION PROFILE
          </div>
          <div style={{ fontSize: 14, fontWeight: 700, marginTop: 4, color: '#fff' }}>
            {config?.name || 'VYOM Spacecraft'}
          </div>
          <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.6)', marginTop: 4, lineHeight: 1.3 }}>
            {config?.objective || 'Orbital digital twin mission'}
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, marginTop: 10, paddingTop: 8, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
            <div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>MASS</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#fff' }}>{satellite?.type === 'crewed_capsule' ? '5,300 kg' : '1,650 kg'}</div>
            </div>
            <div>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>TARGET BODY</div>
              <div style={{ fontSize: 12, fontWeight: 700, color: '#00e5ff' }}>{config?.destination?.replace('-', ' ').toUpperCase() || 'EARTH'}</div>
            </div>
          </div>
        </div>

        {/* Time Warp Controller */}
        <div style={{
          background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '10px 12px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.5)' }}>TIME WARP ACCELERATION</span>
            <span style={{ fontSize: 11, fontWeight: 700, color: '#00e5ff', fontFamily: 'var(--font-mono, monospace)' }}>{timeMultiplier}×</span>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(6, 1fr)', gap: 4 }}>
            {WARP_SPEEDS.map((w) => (
              <button
                key={w.val}
                onClick={() => handleWarpChange(w.val)}
                style={{
                  background: timeMultiplier === w.val ? '#00e5ff' : 'rgba(255,255,255,0.06)',
                  color: timeMultiplier === w.val ? '#02040a' : '#fff',
                  border: 'none', borderRadius: 4, padding: '4px 0', fontSize: 9,
                  fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {w.label}
              </button>
            ))}
          </div>
        </div>

        {/* Navigation Modes */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.4)', paddingLeft: 4 }}>
            MISSION NAVIGATION
          </div>
          {[
            { id: 'digital-twin', label: '🛰️ Spacecraft Digital Twin' },
            { id: 'orbit', label: '🌍 Orbit & Ground Track' },
            { id: 'universe', label: '🌌 Deep Space Universe' },
            { id: 'crew', label: '👨‍🚀 Crew Physiological HUD', hidden: config?.type !== 'human' },
            { id: 'telemetry', label: '📊 12-Channel Telemetry' },
            { id: 'danger-decision', label: '⚠️ Threat & Risk Simulator' },
            { id: 'ai', label: '🤖 AI Autonomous Operator' },
            { id: 'scenarios', label: '🔬 What-If Scenario Matrix' },
            { id: 'reports', label: '📑 Mission Dossier & PDF' },
          ].filter((n) => !n.hidden).map((nav) => (
            <button
              key={nav.id}
              onClick={() => setScreen(nav.id as AppScreen)}
              style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.07)',
                color: 'rgba(255,255,255,0.85)',
                padding: '8px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
                textAlign: 'left', cursor: 'pointer', transition: 'all 0.2s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(0, 229, 255, 0.12)';
                e.currentTarget.style.borderColor = '#00e5ff';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255,255,255,0.03)';
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.07)';
              }}
            >
              {nav.label}
            </button>
          ))}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 3. CENTER VIEWPORT: 3D DIGITAL TWIN & ORBITAL CANVAS ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <main style={{ position: 'relative', overflow: 'hidden', background: '#020409' }}>
        {/* Interactive 3D WebGL Canvas */}
        <Canvas gl={{ antialias: true, alpha: false }}>
          <PerspectiveCamera makeDefault position={[0, 2.5, 6]} fov={45} />
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} maxDistance={20} minDistance={1.5} />
          <ambientLight intensity={0.4} />
          <directionalLight position={[10, 10, 5]} intensity={1.8} color="#ffffff" />
          <pointLight position={[-10, -10, -5]} intensity={0.3} color="#00e5ff" />
          <StarField />

          {/* Earth sphere background with atmospheric glow */}
          {centerViewMode === 'spacecraft' && (
            <mesh position={[0, -2.8, -1.5]}>
              <sphereGeometry args={[2.0, 64, 64]} />
              <meshStandardMaterial color="#1a457a" roughness={0.7} metalness={0.1} />
            </mesh>
          )}

          {/* Dynamic Procedural Spacecraft 3D Model */}
          <DynamicSpacecraftModel
            modelType={satellite?.type as any}
            scale={1.2}
            selectedSubsystem={selectedSubsystem}
            onSelectSubsystem={(sub) => setSelectedSubsystem(sub)}
          />

          {/* Multi-Horizon Space Path & Orbit Trajectory */}
          <SpacePathRenderer
            showObserved={showObservedOrbit}
            showPredicted={showPredictedOrbit}
            showGroundTrack={showGroundTrack}
            orbitRadius={3.3}
            inclinationDeg={telemetry?.orbit?.inclinationDeg ?? 51.6}
          />
        </Canvas>

        {/* Viewport Control Bar */}
        <div style={{
          position: 'absolute', top: 12, left: 16, display: 'flex', gap: 6,
          background: 'rgba(2, 6, 14, 0.85)', backdropFilter: 'blur(8px)',
          padding: '6px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 4,
        }}>
          <button
            onClick={() => setShowObservedOrbit(!showObservedOrbit)}
            style={{
              background: showObservedOrbit ? 'rgba(0, 229, 255, 0.25)' : 'transparent',
              border: showObservedOrbit ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.1)',
              color: showObservedOrbit ? '#00e5ff' : 'rgba(255,255,255,0.6)',
              padding: '4px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            }}
          >
            OBSERVED ORBIT
          </button>
          <button
            onClick={() => setShowPredictedOrbit(!showPredictedOrbit)}
            style={{
              background: showPredictedOrbit ? 'rgba(255, 159, 10, 0.25)' : 'transparent',
              border: showPredictedOrbit ? '1px solid #ff9f0a' : '1px solid rgba(255,255,255,0.1)',
              color: showPredictedOrbit ? '#ff9f0a' : 'rgba(255,255,255,0.6)',
              padding: '4px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            }}
          >
            PREDICTED PATH
          </button>
          <button
            onClick={() => setShowGroundTrack(!showGroundTrack)}
            style={{
              background: showGroundTrack ? 'rgba(48, 209, 88, 0.25)' : 'transparent',
              border: showGroundTrack ? '1px solid #30d158' : '1px solid rgba(255,255,255,0.1)',
              color: showGroundTrack ? '#30d158' : 'rgba(255,255,255,0.6)',
              padding: '4px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700, cursor: 'pointer',
            }}
          >
            GROUND TRACK
          </button>
        </div>

        {/* Orbit Prediction Horizon Selector */}
        <div style={{
          position: 'absolute', top: 12, right: 16, display: 'flex', gap: 4,
          background: 'rgba(2, 6, 14, 0.85)', backdropFilter: 'blur(8px)',
          padding: '4px 8px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.1)',
          zIndex: 4, alignItems: 'center',
        }}>
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>HORIZON:</span>
          {(['10m', '30m', '1orbit', '6h', '24h'] as const).map((h) => (
            <button
              key={h}
              onClick={() => setSelectedHorizon(h)}
              style={{
                background: selectedHorizon === h ? '#ff9f0a' : 'transparent',
                color: selectedHorizon === h ? '#02040a' : 'rgba(255,255,255,0.7)',
                border: 'none', borderRadius: 4, padding: '3px 6px', fontSize: 9,
                fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              {h}
            </button>
          ))}
        </div>

        {/* Live HUD Readouts Overlay */}
        <div style={{
          position: 'absolute', bottom: 12, left: 16, display: 'flex', gap: 10,
          background: 'rgba(2, 6, 14, 0.85)', backdropFilter: 'blur(8px)',
          padding: '8px 12px', borderRadius: 8, border: '1px solid rgba(0,229,255,0.15)',
          zIndex: 4,
        }}>
          <div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>ALTITUDE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#00e5ff', fontFamily: 'var(--font-mono, monospace)' }}>
              {telemetry?.orbit?.altitudeKm?.toFixed(1) ?? '400.0'} km
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>VELOCITY</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>
              {telemetry?.orbit?.velocityKms?.toFixed(2) ?? '7.66'} km/s
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>INCLINATION</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#fff', fontFamily: 'var(--font-mono, monospace)' }}>
              {telemetry?.orbit?.inclinationDeg?.toFixed(1) ?? '51.6'}°
            </div>
          </div>
          <div style={{ width: 1, background: 'rgba(255,255,255,0.1)' }} />
          <div>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>PREDICTION CONFIDENCE</div>
            <div style={{ fontSize: 13, fontWeight: 700, color: '#ff9f0a', fontFamily: 'var(--font-mono, monospace)' }}>
              {predictionResult?.confidence.toFixed(1) ?? '95.0'}%
            </div>
          </div>
        </div>
      </main>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 4. RIGHT PANEL: ALERT QUEUE & SUBSYSTEM HEALTH ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <aside style={{
        background: 'rgba(4, 8, 16, 0.92)',
        borderLeft: '1px solid rgba(0, 229, 255, 0.12)',
        padding: '16px', display: 'flex', flexDirection: 'column', gap: 14,
        overflowY: 'auto', zIndex: 5,
      }}>
        {/* Overall Health Gauge */}
        <div style={{
          background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 8, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }}>
          <div>
            <div style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.4)' }}>
              DIGITAL TWIN INTEGRITY
            </div>
            <div style={{ fontSize: 20, fontWeight: 900, color: healthColor, marginTop: 2 }}>
              {overallHealth.toFixed(1)}%
            </div>
            <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
              Flight Rules: {overallHealth > 75 ? 'NOMINAL' : 'DEGRADED'}
            </div>
          </div>
          <div style={{
            width: 44, height: 44, borderRadius: '50%', border: `3px solid ${healthColor}`,
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: `0 0 12px ${healthColor}44`,
          }}>
            <span style={{ fontSize: 12, fontWeight: 700, color: healthColor }}>{Math.round(overallHealth)}</span>
          </div>
        </div>

        {/* Real-time Alert & Incident Queue */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
            <span style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.4)' }}>
              REAL-TIME ALERT QUEUE ({incidents.length})
            </span>
            {incidents.length > 0 && (
              <span style={{ fontSize: 8, color: '#ff3b30', fontWeight: 700, fontFamily: 'var(--font-mono, monospace)' }}>
                ● ACTIVE INCIDENT
              </span>
            )}
          </div>

          {incidents.length === 0 ? (
            <div style={{
              background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.2)',
              borderRadius: 6, padding: '12px', textAlign: 'center',
            }}>
              <div style={{ fontSize: 11, color: '#00ff88', fontWeight: 600 }}>All Telemetry Nominal</div>
              <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>No boundary envelope deviations</div>
            </div>
          ) : (
            incidents.slice(0, 3).map((inc) => (
              <div
                key={inc.id}
                onClick={() => setSelectedSubsystem(inc.normalized_subsystem)}
                style={{
                  background: inc.severity === 'critical' ? 'rgba(255,59,48,0.1)' : 'rgba(255,159,10,0.1)',
                  border: `1px solid ${inc.severity === 'critical' ? '#ff3b30' : '#ff9f0a'}`,
                  borderRadius: 6, padding: '8px 10px', cursor: 'pointer',
                  transition: 'all 0.2s ease',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontSize: 9, fontWeight: 700, color: inc.severity === 'critical' ? '#ff3b30' : '#ff9f0a', fontFamily: 'var(--font-mono, monospace)' }}>
                    {inc.id}
                  </span>
                  <span style={{ fontSize: 8, padding: '1px 4px', borderRadius: 2, background: 'rgba(0,0,0,0.4)', color: '#fff' }}>
                    {inc.severity.toUpperCase()}
                  </span>
                </div>
                <div style={{ fontSize: 11, fontWeight: 600, color: '#fff', marginTop: 4 }}>
                  {inc.normalized_subsystem}
                </div>
                <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginTop: 2, lineHeight: 1.2 }}>
                  {inc.description}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Subsystem Health Matrix */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.4)' }}>
            SUBSYSTEM INTEGRITY MATRIX
          </div>
          {(satellite?.subsystems || []).map((sub) => {
            const isSelected = selectedSubsystem === sub.name;
            const subHealthColor = sub.health > 80 ? '#00ff88' : sub.health > 50 ? '#ff9f0a' : '#ff3b30';
            return (
              <div
                key={sub.name}
                onClick={() => setSelectedSubsystem(isSelected ? null : sub.name)}
                style={{
                  background: isSelected ? 'rgba(0, 229, 255, 0.15)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6, padding: '6px 10px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  cursor: 'pointer', transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div style={{ fontSize: 10, fontWeight: 600, color: '#fff' }}>{sub.name}</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>
                    Temp: {sub.temperature.toFixed(1)}°C
                  </div>
                </div>
                <div style={{ fontSize: 11, fontWeight: 700, color: subHealthColor, fontFamily: 'var(--font-mono, monospace)' }}>
                  {sub.health.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </aside>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 5. BOTTOM PANEL: TELEMETRY STRIP CHARTS & TIMELINE ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <footer style={{
        gridColumn: '1 / -1',
        background: 'rgba(3, 7, 14, 0.96)',
        borderTop: '1px solid rgba(0, 229, 255, 0.14)',
        display: 'grid', gridTemplateColumns: '1fr 1fr 1fr',
        gap: 16, padding: '8px 20px', zIndex: 10,
      }}>
        {/* Power Profile Chart */}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '6px 10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: '#00e5ff', marginBottom: 2 }}>
            POWER GENERATION & BATTERY SOC (%)
          </div>
          <div style={{ height: 90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={powerHistoryData}>
                <YAxis domain={[0, 100]} hide />
                <Tooltip contentStyle={{ background: '#02040a', borderColor: '#00e5ff', fontSize: 10 }} />
                <Line type="monotone" dataKey="battery" stroke="#00e5ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="solar" stroke="#ff9f0a" strokeWidth={1} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Thermal Loop Profile Chart */}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '6px 10px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: '#ff9f0a', marginBottom: 2 }}>
            THERMAL JUNCTION & BATTERY TEMPERATURE (°C)
          </div>
          <div style={{ height: 90 }}>
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={thermalHistoryData}>
                <YAxis domain={[-20, 100]} hide />
                <Tooltip contentStyle={{ background: '#02040a', borderColor: '#ff9f0a', fontSize: 10 }} />
                <Line type="monotone" dataKey="cpu" stroke="#ff3b30" strokeWidth={2} dot={false} isAnimationActive={false} />
                <Line type="monotone" dataKey="battery" stroke="#30d158" strokeWidth={1.5} dot={false} isAnimationActive={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Predictive Horizon Summary */}
        <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '8px 12px', border: '1px solid rgba(255,255,255,0.06)' }}>
          <div style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: '#bf5af2', marginBottom: 4 }}>
            TRAJECTORY & ECLIPSE PROJECTION ({selectedHorizon.toUpperCase()})
          </div>
          <div style={{ fontSize: 10, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
            • Predicted Apogee: <strong style={{ color: '#00e5ff' }}>{predictionResult?.apogeePredictedKm.toFixed(1)} km</strong><br />
            • Predicted Periapsis: <strong style={{ color: '#00e5ff' }}>{predictionResult?.perigeePredictedKm.toFixed(1)} km</strong><br />
            • Shadow Egress: <strong style={{ color: '#ff9f0a' }}>{predictionResult?.eclipseEvents.length ?? 0} eclipse event(s) projected</strong>
          </div>
        </div>
      </footer>
    </div>
  );
}
