import { useEffect, useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { LineChart, Line, YAxis, Tooltip, ResponsiveContainer } from 'recharts';
import { useMissionStore } from '../../store/missionStore';
import { backendWS } from '../../services/BackendWebSocketService';
import { anomalyPipeline } from '../../engines/AnomalyPipelineEngine';
import { TrajectoryPredictionEngine } from '../../engines/TrajectoryPredictionEngine';
import { MISSION_PROFILES } from '../../types/missionProfiles';
import { DynamicSpacecraftModel } from '../three/DynamicSpacecraftModel';
import { SpacePathRenderer } from '../three/SpacePathRenderer';
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

const WARP_SPEEDS = [
  { label: 'PAUSE', val: 0 },
  { label: '1×', val: 1 },
  { label: '5×', val: 5 },
  { label: '10×', val: 10 },
  { label: '50×', val: 50 },
  { label: '100×', val: 100 },
];

export function MissionControlScreen() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const telemetryHistory = useMissionStore((s) => s.telemetryHistory);
  const telemetryState = useMissionStore((s) => s.telemetryState);
  const config = useMissionStore((s) => s.config);
  const satellite = useMissionStore((s) => s.satellite);
  const status = useMissionStore((s) => s.status);
  const missionDay = useMissionStore((s) => s.missionDay);
  const incidents = useMissionStore((s) => s.incidents);
  const setScreen = useMissionStore((s) => s.setScreen);
  const setMissionProfile = useMissionStore((s) => s.setMissionProfile);
  const timeMultiplier = useMissionStore((s) => s.timeMultiplier);
  const setTimeMultiplier = useMissionStore((s) => s.setTimeMultiplier);

  const [wsStatus, setWsStatus] = useState<'connected' | 'disconnected'>('disconnected');
  const [selectedSubsystem, setSelectedSubsystem] = useState<string | null>(null);
  const [selectedHorizon, setSelectedHorizon] = useState<'10m' | '30m' | '1orbit' | '6h' | '24h'>('1orbit');
  const [showObservedOrbit, setShowObservedOrbit] = useState(true);
  const [showPredictedOrbit, setShowPredictedOrbit] = useState(true);
  const [showGroundTrack, setShowGroundTrack] = useState(true);
  const [utcTimeStr, setUtcTimeStr] = useState('');

  // Mobile detection & mobile tab navigation
  const [isMobile, setIsMobile] = useState(false);
  const [mobileTab, setMobileTab] = useState<'twin' | 'controls' | 'alerts' | 'telemetry'>('twin');

  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 1024);
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  // Update live UTC Master Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setUtcTimeStr(d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

  // Connect to Backend WebSocket
  useEffect(() => {
    const missionId = config?.id ?? 'VYOM-01';
    backendWS.connect(missionId);

    const unsubWs = backendWS.onStatusChange((st) => {
      setWsStatus(st === 'connected' ? 'connected' : 'disconnected');
    });

    return () => {
      unsubWs();
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
      solar: (t.power?.solarGenerationW ?? 2400) / 30,
    }));
  }, [telemetryHistory]);

  const thermalHistoryData = useMemo(() => {
    return telemetryHistory.slice(-50).map((t, idx) => ({
      idx,
      cpu: t.thermal?.cpuTempC ?? 40,
      battery: t.thermal?.batteryTempC ?? 20,
    }));
  }, [telemetryHistory]);

  const handleMissionSelect = (key: 'human' | 'orbital' | 'astrophysics') => {
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

  // ── 1. Left Panel (Controls & Parameters) ──
  const LeftPanel = (
    <aside style={{
      background: 'rgba(4, 8, 16, 0.95)',
      borderRight: isMobile ? 'none' : '1px solid rgba(0, 229, 255, 0.12)',
      padding: isMobile ? '12px' : '16px',
      display: 'flex', flexDirection: 'column', gap: 14,
      overflowY: 'auto', zIndex: 5, height: '100%',
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
        <div style={{ fontSize: 11, color: 'rgba(255,255,255,0.65)', marginTop: 4, lineHeight: 1.3 }}>
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
                border: 'none', borderRadius: 4, padding: '6px 0', fontSize: 9,
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
              padding: '10px 12px', borderRadius: 6, fontSize: 11, fontWeight: 600,
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
  );

  // ── 2. Center Viewport (3D Digital Twin) ──
  const CenterViewport = (
    <main style={{ position: 'relative', overflow: 'hidden', background: '#020409', height: '100%', width: '100%' }}>
      <Canvas gl={{ antialias: true, alpha: false }}>
        <PerspectiveCamera makeDefault position={[0, 2.5, 6]} fov={45} />
        <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} maxDistance={20} minDistance={1.5} />
        <ambientLight intensity={0.4} />
        <directionalLight position={[10, 10, 5]} intensity={1.8} color="#ffffff" />
        <pointLight position={[-10, -10, -5]} intensity={0.3} color="#00e5ff" />
        <StarField />

        {/* Earth sphere background */}
        <mesh position={[0, -2.8, -1.5]}>
          <sphereGeometry args={[2.0, 64, 64]} />
          <meshStandardMaterial color="#1a457a" roughness={0.7} metalness={0.1} />
        </mesh>

        {/* Dynamic Procedural Spacecraft 3D Model */}
        <DynamicSpacecraftModel
          modelType={satellite?.type as any}
          scale={1.2}
          selectedSubsystem={selectedSubsystem}
          onSelectSubsystem={(sub) => setSelectedSubsystem(sub)}
        />

        {/* Space Path & Trajectory Trails */}
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
        zIndex: 4, flexWrap: 'wrap',
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
          OBSERVED
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
          PREDICTED
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
        zIndex: 4, alignItems: 'center', flexWrap: 'wrap',
      }}>
        <span style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.4)', marginRight: 4 }}>HORIZON:</span>
        {(['10m', '30m', '1orbit', '6h', '24h'] as const).map((h) => (
          <button
            key={h}
            onClick={() => setSelectedHorizon(h)}
            style={{
              background: selectedHorizon === h ? '#ff9f0a' : 'transparent',
              color: selectedHorizon === h ? '#000' : 'rgba(255,255,255,0.6)',
              border: 'none', borderRadius: 4, padding: '3px 6px', fontSize: 8,
              fontWeight: 700, cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)',
            }}
          >
            {h}
          </button>
        ))}
      </div>
    </main>
  );

  // ── 3. Right Panel (Alerts & Health Matrix) ──
  const RightPanel = (
    <aside style={{
      background: 'rgba(4, 8, 16, 0.95)',
      borderLeft: isMobile ? 'none' : '1px solid rgba(0, 229, 255, 0.12)',
      padding: isMobile ? '12px' : '16px',
      display: 'flex', flexDirection: 'column', gap: 14,
      overflowY: 'auto', zIndex: 5, height: '100%',
    }}>
      {/* Overall Health Score Card */}
      <div style={{
        background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.08)',
        borderRadius: 8, padding: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between',
      }}>
        <div>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.5)' }}>
            DIGITAL TWIN INTEGRITY
          </div>
          <div style={{ fontSize: 18, fontWeight: 800, color: healthColor, marginTop: 2 }}>
            {overallHealth.toFixed(1)}%
          </div>
          <div style={{ fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
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
  );

  // ── 4. Bottom Strip Charts (Telemetry) ──
  const BottomCharts = (
    <footer style={{
      gridColumn: '1 / -1',
      background: 'rgba(3, 7, 14, 0.96)',
      borderTop: '1px solid rgba(0, 229, 255, 0.14)',
      display: 'grid',
      gridTemplateColumns: isMobile ? '1fr' : '1fr 1fr 1fr',
      gap: 12, padding: isMobile ? '12px' : '8px 20px', zIndex: 10,
      overflowY: isMobile ? 'auto' : 'visible',
    }}>
      {/* Power Profile Chart */}
      <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 6, padding: '6px 10px', border: '1px solid rgba(255,255,255,0.06)' }}>
        <div style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: '#00e5ff', marginBottom: 2 }}>
          POWER GENERATION & BATTERY SOC (%)
        </div>
        <div style={{ height: 80 }}>
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
        <div style={{ height: 80 }}>
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
  );

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column',
      background: '#02040a', overflow: 'hidden',
      color: '#fff', fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>
      {/* ── TOP HEADER BAR ── */}
      <header style={{
        height: isMobile ? 'auto' : 56,
        minHeight: 52,
        background: 'rgba(5, 10, 20, 0.95)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0, 229, 255, 0.18)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: isMobile ? '8px 12px' : '0 20px', zIndex: 10,
        flexWrap: 'wrap', gap: 8,
      }}>
        {/* Brand & Connection State */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, cursor: 'pointer' }} onClick={() => setScreen('welcome')}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%',
              background: telemetryState === 'STALE' ? '#ff3b30' : '#00e5ff',
              boxShadow: telemetryState === 'STALE' ? '0 0 8px #ff3b30' : '0 0 8px #00e5ff',
            }} />
            <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 16, fontWeight: 900, letterSpacing: '0.15em', color: '#00e5ff' }}>
              VYOM
            </span>
          </div>

          <div style={{
            fontSize: 8.5, fontFamily: 'var(--font-mono, monospace)', padding: '2px 6px', borderRadius: 4,
            background: telemetryState === 'LIVE' ? 'rgba(0,255,136,0.15)' : telemetryState === 'STALE' ? 'rgba(255,59,48,0.2)' : 'rgba(255,159,10,0.15)',
            border: `1px solid ${telemetryState === 'LIVE' ? '#00ff88' : telemetryState === 'STALE' ? '#ff3b30' : '#ff9f0a'}`,
            color: telemetryState === 'LIVE' ? '#00ff88' : telemetryState === 'STALE' ? '#ff3b30' : '#ff9f0a',
            fontWeight: 700,
          }}>
            {telemetryState === 'LIVE' ? '🔴 LIVE' : telemetryState === 'STALE' ? '⚠ STALE' : '🟡 SIM'}
          </div>
        </div>

        {/* Mission Type Switcher Buttons */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, background: 'rgba(0,0,0,0.4)', padding: '3px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.08)' }}>
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
                  padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 700,
                  cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)',
                }}
              >
                {prof.name.split(' ')[0]}
              </button>
            );
          })}
        </div>

        {/* Master Clock & Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, fontWeight: 700, color: '#00e5ff' }}>
              {utcTimeStr}
            </div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(255,255,255,0.5)' }}>
              T+{formatElapsed(missionDay)}
            </div>
          </div>

          <div style={{
            padding: '3px 8px', borderRadius: 4, fontSize: 9, fontWeight: 800,
            background: status === 'threatened' ? 'rgba(255,59,48,0.2)' : 'rgba(0,255,136,0.15)',
            border: `1px solid ${status === 'threatened' ? '#ff3b30' : '#00ff88'}`,
            color: status === 'threatened' ? '#ff3b30' : '#00ff88',
          }}>
            {status.toUpperCase()}
          </div>
        </div>
      </header>

      {/* ── MOBILE TAB SWITCHER (For phone/tablet access) ── */}
      {isMobile && (
        <div style={{
          display: 'flex', background: 'rgba(4, 10, 20, 0.95)', borderBottom: '1px solid rgba(0,212,255,0.15)',
          padding: '4px', gap: 4, zIndex: 9,
        }}>
          {[
            { id: 'twin' as const, label: '🛰️ 3D Twin' },
            { id: 'controls' as const, label: '🎮 Controls' },
            { id: 'alerts' as const, label: '⚠️ Alerts' },
            { id: 'telemetry' as const, label: '📊 Telemetry' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setMobileTab(tab.id)}
              style={{
                flex: 1, padding: '8px 4px', fontSize: 10, fontWeight: 700,
                background: mobileTab === tab.id ? 'rgba(0, 229, 255, 0.2)' : 'transparent',
                border: `1px solid ${mobileTab === tab.id ? '#00e5ff' : 'transparent'}`,
                borderRadius: 4, color: mobileTab === tab.id ? '#00e5ff' : 'rgba(255,255,255,0.6)',
                fontFamily: 'var(--font-mono, monospace)', cursor: 'pointer',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      )}

      {/* ── MAIN CONTENT AREA ── */}
      {isMobile ? (
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative' }}>
          {mobileTab === 'twin' && CenterViewport}
          {mobileTab === 'controls' && LeftPanel}
          {mobileTab === 'alerts' && RightPanel}
          {mobileTab === 'telemetry' && BottomCharts}
        </div>
      ) : (
        <div style={{
          flex: 1, display: 'grid',
          gridTemplateColumns: '300px 1fr 320px',
          gridTemplateRows: '1fr 130px',
          overflow: 'hidden',
        }}>
          <div style={{ gridRow: '1 / 2', gridColumn: '1 / 2', overflowY: 'auto' }}>
            {LeftPanel}
          </div>
          <div style={{ gridRow: '1 / 2', gridColumn: '2 / 3', position: 'relative' }}>
            {CenterViewport}
          </div>
          <div style={{ gridRow: '1 / 2', gridColumn: '3 / 4', overflowY: 'auto' }}>
            {RightPanel}
          </div>
          <div style={{ gridRow: '2 / 3', gridColumn: '1 / -1' }}>
            {BottomCharts}
          </div>
        </div>
      )}
    </div>
  );
}
