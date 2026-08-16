import { useState, useEffect, useRef, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { SatelliteModel, OrbitLine } from '../three/SatelliteScene';
import { StarField } from '../three/SpaceScene';
import type { BlackBoxEvent } from '../../types/mission';

function buildSyntheticReplayEvents(missionName: string, missionType: string): BlackBoxEvent[] {
  const isHuman = missionType === 'human';
  const isPlanetary = missionType === 'planetary';
  const now = Date.now();

  return [
    {
      id: 'rep-1',
      timestamp: now - 3600000 * 24 * 16,
      missionDay: 0.0,
      eventType: 'milestone',
      severity: 'nominal',
      description: `Liftoff & Ascent verified for ${missionName}. All booster stages nominal, flight trajectory nominal.`,
      source: 'Launch Control Center',
      immutable: true,
    },
    {
      id: 'rep-2',
      timestamp: now - 3600000 * 24 * 15.8,
      missionDay: 0.05,
      eventType: 'milestone',
      severity: 'nominal',
      description: isHuman ? 'Trans-Lunar Injection (TLI) burn complete. Spacecraft entering cislunar trajectory.' : 'Trans-Orbital Injection burn executed. Orbit established.',
      source: 'Flight Dynamics Officer',
      immutable: true,
    },
    {
      id: 'rep-3',
      timestamp: now - 3600000 * 24 * 15.5,
      missionDay: 0.15,
      eventType: 'telemetry',
      severity: 'nominal',
      description: 'GaAs Triple-Junction Solar Arrays deployed. Battery charging rate nominal at 3.8 kW.',
      source: 'Power Systems Subsystem',
      immutable: true,
    },
    {
      id: 'rep-4',
      timestamp: now - 3600000 * 24 * 14.5,
      missionDay: 0.8,
      eventType: 'telemetry',
      severity: 'nominal',
      description: 'High-Gain X-Band Deep Space Antenna locked with Ground Station. Uplink 28 Mbps.',
      source: 'Communications Subsystem',
      immutable: true,
    },
    {
      id: 'rep-5',
      timestamp: now - 3600000 * 24 * 13,
      missionDay: 2.1,
      eventType: 'milestone',
      severity: 'nominal',
      description: isHuman ? 'Crew Cabin ECLSS pressurized at 101.3 kPa. Biomedical telemetry nominal.' : 'Autonomous Star Trackers and Reaction Wheels calibrated. Attitude hold active.',
      source: 'ADCS & Guidance',
      immutable: true,
    },
    {
      id: 'rep-6',
      timestamp: now - 3600000 * 24 * 11,
      missionDay: 4.5,
      eventType: 'threat',
      severity: 'warning',
      description: 'Space Environment Warning: Elevated solar proton flux and thermal gradient detected.',
      source: 'Space Weather Sensor Suite',
      immutable: true,
    },
    {
      id: 'rep-7',
      timestamp: now - 3600000 * 24 * 10.8,
      missionDay: 4.65,
      eventType: 'ai',
      severity: 'warning',
      description: 'VYOM AI Guardian: Anomaly diagnosed (Solar Flare Radiative Heating). Safe-reorientation sequence initiated.',
      source: 'Autonomous AI Engine',
      immutable: true,
    },
    {
      id: 'rep-8',
      timestamp: now - 3600000 * 24 * 10.5,
      missionDay: 4.85,
      eventType: 'recovery',
      severity: 'nominal',
      description: 'Autonomous Recovery Verified: Radiator loop active, CPU temp stabilized at 41.2°C.',
      source: 'Recovery Engine',
      immutable: true,
    },
    {
      id: 'rep-9',
      timestamp: now - 3600000 * 24 * 8,
      missionDay: 7.5,
      eventType: 'milestone',
      severity: 'nominal',
      description: isPlanetary ? 'Planetary approach radar online. Primary science instruments calibrated.' : 'Primary Multi-Spectral Observation & Scientific Payload active.',
      source: 'Scientific Payload Team',
      immutable: true,
    },
    {
      id: 'rep-10',
      timestamp: now - 3600000 * 24 * 4,
      missionDay: 12.0,
      eventType: 'telemetry',
      severity: 'nominal',
      description: 'Mid-Mission Diagnostic: 98.6% Overall Spacecraft Health. Zero unmitigated faults.',
      source: 'Mission Health Engine',
      immutable: true,
    },
    {
      id: 'rep-11',
      timestamp: now - 3600000 * 24 * 1,
      missionDay: 15.5,
      eventType: 'milestone',
      severity: 'nominal',
      description: 'Final Mission Science Data Downlink complete (480 GB). Mission objectives 100% achieved.',
      source: 'Mission Operations Directorate',
      immutable: true,
    },
  ];
}

const EVENT_TYPE_COLORS: Record<string, string> = {
  milestone: '#00d4ff',
  threat: '#ff2d55',
  ai: '#9b5de5',
  recovery: '#00ff88',
  telemetry: '#00d4ff',
  command: '#ff8c00',
  all: '#00d4ff',
};

const EVENT_TYPE_ICONS: Record<string, string> = {
  milestone: '★',
  threat: '⚡',
  ai: '◉',
  recovery: '✓',
  telemetry: '≋',
  command: '▶',
};

export function ReplayScreen() {
  const replayEventsStore = useMissionStore((s) => s.replayEvents);
  const blackBoxStore = useMissionStore((s) => s.blackBox);
  const config = useMissionStore((s) => s.config);
  const missionDay = useMissionStore((s) => s.missionDay);
  const setScreen = useMissionStore((s) => s.setScreen);

  // Fallback to blackBox or synthesize realistic events if empty
  const events = useMemo<BlackBoxEvent[]>(() => {
    if (replayEventsStore && replayEventsStore.length >= 3) return replayEventsStore;
    if (blackBoxStore && blackBoxStore.length >= 3) return blackBoxStore;
    return buildSyntheticReplayEvents(config?.name ?? 'VYOM-01', config?.type ?? 'orbital');
  }, [replayEventsStore, blackBoxStore, config]);

  const maxDay = useMemo(() => {
    if (events.length === 0) return Math.max(16, missionDay);
    return Math.max(1, Math.max(...events.map((e) => e.missionDay || 0)));
  }, [events, missionDay]);

  const [position, setPosition] = useState(0); // 0% to 100%
  const [isPlaying, setIsPlaying] = useState(true); // Auto-play by default!
  const [speed, setSpeed] = useState(2); // 1x, 2x, 5x, 10x, 25x
  const [filter, setFilter] = useState('all');
  const [autoScroll, setAutoScroll] = useState(true);
  const eventsEndRef = useRef<HTMLDivElement>(null);

  // Automatic playback loop
  useEffect(() => {
    if (!isPlaying) return;

    const interval = setInterval(() => {
      setPosition((prev) => {
        if (prev >= 100) {
          setIsPlaying(false);
          return 100;
        }
        // Advance smoothly based on speed multiplier
        const step = 0.25 * speed;
        return Math.min(100, prev + step);
      });
    }, 50);

    return () => clearInterval(interval);
  }, [isPlaying, speed]);

  // Determine events visible at current playback position
  const visibleEventCount = Math.max(1, Math.min(events.length, Math.ceil((position / 100) * events.length)));
  const visibleEvents = events.slice(0, visibleEventCount);
  const currentDay = (position / 100) * maxDay;

  // Filter visible events for display
  const displayEvents = useMemo(() => {
    return visibleEvents.filter((e) => filter === 'all' || e.eventType === filter);
  }, [visibleEvents, filter]);

  // Auto-scroll to latest event
  useEffect(() => {
    if (autoScroll && eventsEndRef.current) {
      eventsEndRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
    }
  }, [displayEvents.length, autoScroll]);

  // Simulated telemetry at current replay progress
  const simulatedTelemetry = useMemo(() => {
    const isThreatPhase = position >= 40 && position <= 55;
    const isRecoveryPhase = position > 55 && position <= 70;
    const isCompletePhase = position >= 95;

    return {
      altitude: (650 - Math.sin(position * 0.1) * 12).toFixed(1),
      velocity: (7.66 + Math.cos(position * 0.05) * 0.08).toFixed(2),
      battery: isThreatPhase ? (84.2 - (position - 40) * 0.8).toFixed(1) : isRecoveryPhase ? '94.8' : '98.2',
      cpuTemp: isThreatPhase ? (68.5 + (position - 40) * 1.1).toFixed(1) : isRecoveryPhase ? '45.0' : '41.8',
      health: isThreatPhase ? 78 : 98.5,
      aiState: isThreatPhase ? 'ANOMALY DETECTED' : isRecoveryPhase ? 'MITIGATING' : isCompletePhase ? 'MISSION COMPLETE' : 'MONITORING NOMINAL',
      aiColor: isThreatPhase ? '#ff2d55' : isRecoveryPhase ? '#9b5de5' : '#00ff88',
    };
  }, [position]);

  const handleRestart = () => {
    setPosition(0);
    setIsPlaying(true);
  };

  const handleJump = (targetPct: number) => {
    setPosition(targetPct);
  };

  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid',
      gridTemplateRows: '56px 1fr 90px',
      background: '#020409', overflow: 'hidden', paddingBottom: 56,
    }}>
      {/* Top Header */}
      <div style={{
        background: 'rgba(5,12,25,0.96)',
        borderBottom: '1px solid rgba(0,212,255,0.12)',
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '0 24px', gap: 16,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900, color: '#00d4ff', letterSpacing: '0.15em' }}>
            MISSION CHRONICLE REPLAY
          </div>
          <div style={{ width: 1, height: 20, background: 'rgba(255,255,255,0.1)' }} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.6)' }}>
            SPACECRAFT: <span style={{ color: '#fff', fontWeight: 600 }}>{config?.name}</span>
          </div>
          <div style={{
            padding: '3px 8px', borderRadius: 4,
            background: isPlaying ? 'rgba(0,255,136,0.12)' : 'rgba(255,140,0,0.12)',
            border: `1px solid ${isPlaying ? 'rgba(0,255,136,0.3)' : 'rgba(255,140,0,0.3)'}`,
            fontFamily: 'var(--font-mono)', fontSize: 9,
            color: isPlaying ? '#00ff88' : '#ff8c00', letterSpacing: '0.1em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}>
            <div style={{
              width: 6, height: 6, borderRadius: '50%',
              background: isPlaying ? '#00ff88' : '#ff8c00',
              animation: isPlaying ? 'pulse-dot 1.5s infinite' : 'none',
            }} />
            {isPlaying ? 'AUTO-PLAYING' : 'PAUSED'}
          </div>
        </div>

        {/* Playback Controls & Speed */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {/* Play/Pause Button */}
          <button
            onClick={() => setIsPlaying(!isPlaying)}
            style={{
              padding: '6px 16px',
              background: isPlaying ? 'rgba(255,140,0,0.15)' : 'rgba(0,212,255,0.2)',
              border: `1px solid ${isPlaying ? 'rgba(255,140,0,0.5)' : 'rgba(0,212,255,0.6)'}`,
              borderRadius: 5, color: isPlaying ? '#ff8c00' : '#00d4ff',
              fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
              cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6,
            }}
          >
            {isPlaying ? '❚❚ PAUSE' : '▶ RESUME'}
          </button>

          {/* Restart */}
          <button
            onClick={handleRestart}
            style={{
              padding: '6px 12px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.12)', borderRadius: 5,
              color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)', fontSize: 10,
              cursor: 'pointer',
            }}
            title="Restart replay from Launch"
          >
            ↺ RESTART
          </button>

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

          {/* Speed selector */}
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>SPEED:</span>
          {[1, 2, 5, 10, 25].map((s) => (
            <button
              key={s}
              onClick={() => setSpeed(s)}
              style={{
                padding: '4px 8px',
                background: speed === s ? 'rgba(0,212,255,0.2)' : 'transparent',
                border: `1px solid ${speed === s ? 'rgba(0,212,255,0.5)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 4, color: speed === s ? '#00d4ff' : 'rgba(255,255,255,0.4)',
                fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer',
              }}
            >
              {s}×
            </button>
          ))}

          <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

          {/* Jump to Archive */}
          <button
            onClick={() => setScreen('archive')}
            style={{
              padding: '5px 12px', background: 'rgba(155,93,229,0.12)',
              border: '1px solid rgba(155,93,229,0.35)', borderRadius: 5,
              color: '#9b5de5', fontFamily: 'var(--font-mono)', fontSize: 9,
              letterSpacing: '0.08em', cursor: 'pointer',
            }}
          >
            ◫ ARCHIVE
          </button>
        </div>
      </div>

      {/* Main Split Body: 3D Twin (Left) + Chronicle Stream (Right) */}
      <div style={{
        display: 'grid', gridTemplateColumns: 'minmax(380px, 1.2fr) minmax(420px, 1fr)',
        height: '100%', overflow: 'hidden',
      }}>
        {/* Left: 3D Digital Twin Replay with Synced HUD */}
        <div style={{ position: 'relative', background: '#020409', borderRight: '1px solid rgba(0,212,255,0.08)' }}>
          <Canvas gl={{ antialias: true }} dpr={[1, 2]}>
            <PerspectiveCamera makeDefault position={[0, 0.6, 4.2]} fov={38} />
            <ambientLight intensity={0.2} />
            <directionalLight position={[4, 3, 4]} intensity={1.3} color="#fff5e8" />
            <directionalLight position={[-3, -1, -3]} intensity={0.35} color="#aaccff" />
            <StarField />
            <SatelliteModel scale={1.5} />
            <OrbitLine radius={3.2} inclination={51.6} />
            <OrbitControls enableZoom={false} enablePan={false} autoRotate={isPlaying} autoRotateSpeed={speed * 0.6} />
          </Canvas>

          {/* Overlay HUD Telemetry */}
          <div style={{
            position: 'absolute', top: 16, left: 16,
            display: 'flex', flexDirection: 'column', gap: 8, pointerEvents: 'none',
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.15em' }}>
              ● DIGITAL TWIN SYNCHRONIZED REPLAY
            </div>
            <div style={{
              background: 'rgba(5,12,25,0.85)', padding: '8px 12px', borderRadius: 6,
              border: '1px solid rgba(255,255,255,0.08)', backdropFilter: 'blur(8px)',
              display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 14px',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>REPLAY DAY</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: '#00d4ff', fontWeight: 700 }}>
                  DAY {currentDay.toFixed(2)}
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>HEALTH</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, color: simulatedTelemetry.health > 80 ? '#00ff88' : '#ff8c00', fontWeight: 700 }}>
                  {simulatedTelemetry.health}%
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>BATTERY</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#fff' }}>
                  {simulatedTelemetry.battery}%
                </div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>CPU TEMP</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: Number(simulatedTelemetry.cpuTemp) > 60 ? '#ff2d55' : '#00d4ff' }}>
                  {simulatedTelemetry.cpuTemp}°C
                </div>
              </div>
            </div>
          </div>

          {/* AI Status Badge */}
          <div style={{
            position: 'absolute', bottom: 16, left: 16,
            background: 'rgba(5,12,25,0.85)', padding: '6px 12px', borderRadius: 6,
            border: `1px solid ${simulatedTelemetry.aiColor}40`,
            display: 'flex', alignItems: 'center', gap: 8, backdropFilter: 'blur(8px)',
          }}>
            <div style={{ width: 6, height: 6, borderRadius: '50%', background: simulatedTelemetry.aiColor, boxShadow: `0 0 8px ${simulatedTelemetry.aiColor}` }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: simulatedTelemetry.aiColor, letterSpacing: '0.1em' }}>
              VYOM AI: {simulatedTelemetry.aiState}
            </span>
          </div>

          {/* Replay Finished Banner */}
          {position >= 100 && (
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              style={{
                position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)',
                background: 'rgba(5,12,25,0.95)', border: '1px solid rgba(0,212,255,0.4)',
                padding: '24px 32px', borderRadius: 12, textAlign: 'center',
                boxShadow: '0 0 50px rgba(0,212,255,0.25)', backdropFilter: 'blur(12px)',
                zIndex: 10,
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#00ff88', letterSpacing: '0.2em', marginBottom: 6 }}>
                ✓ REPLAY COMPLETE
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, color: '#fff', fontWeight: 700, marginBottom: 16 }}>
                Full Mission Trajectory Replayed
              </div>
              <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
                <button onClick={handleRestart} className="btn btn-primary btn-sm">
                  ↺ REPLAY AGAIN
                </button>
                <button onClick={() => setScreen('archive')} className="btn btn-sm">
                  ◫ VIEW ARCHIVE
                </button>
              </div>
            </motion.div>
          )}
        </div>

        {/* Right: Chronological Event Stream */}
        <div style={{
          display: 'flex', flexDirection: 'column', height: '100%',
          background: 'rgba(5,12,25,0.92)', overflow: 'hidden',
        }}>
          {/* Stream Filter Bar */}
          <div style={{
            padding: '12px 16px', borderBottom: '1px solid rgba(255,255,255,0.06)',
            display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8,
          }}>
            <div style={{ display: 'flex', gap: 6, overflowX: 'auto' }}>
              {['all', 'milestone', 'threat', 'ai', 'recovery', 'telemetry'].map((f) => {
                const active = filter === f;
                const col = EVENT_TYPE_COLORS[f] || '#00d4ff';
                return (
                  <button
                    key={f}
                    onClick={() => setFilter(f)}
                    style={{
                      padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em',
                      background: active ? `${col}20` : 'transparent',
                      border: `1px solid ${active ? `${col}60` : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 4, color: active ? col : 'rgba(255,255,255,0.45)',
                      cursor: 'pointer', transition: 'all 0.15s',
                    }}
                  >
                    {f === 'all' ? 'ALL' : `${EVENT_TYPE_ICONS[f] || ''} ${f.toUpperCase()}`}
                  </button>
                );
              })}
            </div>

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', whiteSpace: 'nowrap' }}>
              {visibleEventCount} / {events.length} EVENTS
            </div>
          </div>

          {/* Event Feed List */}
          <div style={{
            flex: 1, overflowY: 'auto', padding: '14px 16px',
            display: 'flex', flexDirection: 'column', gap: 8,
          }}>
            {displayEvents.length === 0 ? (
              <div style={{ textAlign: 'center', padding: 40, color: 'rgba(255,255,255,0.3)', fontFamily: 'var(--font-mono)', fontSize: 11 }}>
                No events matching filter at this point in timeline.
              </div>
            ) : (
              displayEvents.map((ev, idx) => {
                const isLatest = idx === displayEvents.length - 1;
                const typeCol = EVENT_TYPE_COLORS[ev.eventType] || '#00d4ff';
                const sevCol = ev.severity === 'critical' ? 'var(--critical)' : ev.severity === 'warning' ? 'var(--warning)' : 'var(--nominal)';

                return (
                  <motion.div
                    key={ev.id}
                    initial={{ opacity: 0, x: 15 }}
                    animate={{ opacity: 1, x: 0 }}
                    transition={{ duration: 0.25 }}
                    style={{
                      padding: '10px 14px',
                      background: isLatest ? 'rgba(0,212,255,0.08)' : 'rgba(0,0,0,0.35)',
                      border: `1px solid ${isLatest ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.06)'}`,
                      borderLeft: `3px solid ${sevCol}`,
                      borderRadius: 6, transition: 'all 0.2s',
                      boxShadow: isLatest ? '0 0 15px rgba(0,212,255,0.1)' : 'none',
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <span style={{
                          padding: '2px 6px', borderRadius: 3,
                          background: `${typeCol}15`, border: `1px solid ${typeCol}40`,
                          fontFamily: 'var(--font-mono)', fontSize: 8, color: typeCol,
                          letterSpacing: '0.08em', fontWeight: 600,
                        }}>
                          {EVENT_TYPE_ICONS[ev.eventType] || ''} {ev.eventType.toUpperCase()}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
                          {ev.source}
                        </span>
                      </div>

                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00d4ff', fontWeight: 700 }}>
                        DAY {Number(ev.missionDay || 0).toFixed(2)}
                      </span>
                    </div>

                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: isLatest ? '#fff' : 'rgba(255,255,255,0.8)', lineHeight: 1.45 }}>
                      {ev.description}
                    </div>
                  </motion.div>
                );
              })
            )}
            <div ref={eventsEndRef} />
          </div>
        </div>
      </div>

      {/* Bottom Timeline Scrubber & Phase Checkpoints */}
      <div style={{
        background: 'rgba(2,4,9,0.98)', borderTop: '1px solid rgba(0,212,255,0.18)',
        padding: '8px 24px', display: 'flex', flexDirection: 'column', justifyContent: 'center',
        gap: 6,
      }}>
        {/* Scrubber track & labels */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.5)', minWidth: 100 }}>
            T+ <span style={{ color: '#00d4ff', fontWeight: 700 }}>{currentDay.toFixed(2)}d</span> / {maxDay.toFixed(1)}d
          </div>

          <div style={{ flex: 1, position: 'relative', display: 'flex', alignItems: 'center' }}>
            <input
              type="range" min={0} max={100} step={0.1}
              value={position}
              onChange={(e) => {
                setPosition(Number(e.target.value));
              }}
              style={{
                width: '100%', cursor: 'pointer',
                accentColor: '#00d4ff',
              }}
            />
          </div>

          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#00ff88', fontWeight: 700, minWidth: 80, textAlign: 'right' }}>
            {position.toFixed(0)}% DONE
          </div>
        </div>

        {/* Clickable Phase Markers */}
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: 4 }}>
          {[
            { label: '01 LIFTOFF', pct: 0 },
            { label: '02 INJECTION', pct: 15 },
            { label: '03 CRUISE / ORBIT', pct: 35 },
            { label: '04 ANOMALY', pct: 45 },
            { label: '05 AI RECOVERY', pct: 60 },
            { label: '06 SCIENCE STREAM', pct: 80 },
            { label: '07 100% COMPLETE', pct: 100 },
          ].map((phase) => (
            <button
              key={phase.label}
              onClick={() => handleJump(phase.pct)}
              style={{
                background: 'transparent', border: 'none',
                fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.05em',
                color: position >= phase.pct ? '#00d4ff' : 'rgba(255,255,255,0.3)',
                cursor: 'pointer', padding: '2px 4px',
                transition: 'color 0.2s',
              }}
            >
              {phase.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}

export function CompletionScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const config = useMissionStore((s) => s.config);
  const stats = useMissionStore((s) => s.stats);
  const missionDay = useMissionStore((s) => s.missionDay);
  const telemetry = useMissionStore((s) => s.telemetry);

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
      background: '#020409', padding: 32, paddingBottom: 80, overflowY: 'auto',
    }}>
      <motion.div
        initial={{ opacity: 0, scale: 0.85 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ duration: 1.2, ease: [0.16, 1, 0.3, 1] }}
        style={{ textAlign: 'center', maxWidth: 800 }}
      >
        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(12px, 2vw, 16px)',
          letterSpacing: '0.5em', color: 'rgba(0,212,255,0.6)',
          marginBottom: 20, animation: 'orbit-pulse 2s ease-in-out infinite',
        }}>
          MISSION OBJECTIVES ACHIEVED
        </div>

        <div style={{
          fontFamily: 'var(--font-display)', fontSize: 'clamp(48px, 9vw, 96px)',
          fontWeight: 900, color: '#fff', letterSpacing: '0.08em',
          textShadow: '0 0 60px rgba(0,212,255,0.35)',
          lineHeight: 1, marginBottom: 20,
        }}>
          {config?.name}
        </div>

        <p style={{
          fontFamily: 'var(--font-body)', fontSize: 'clamp(14px, 2vw, 18px)',
          color: 'rgba(255,255,255,0.65)', marginBottom: 36, lineHeight: 1.6,
        }}>
          "Your spacecraft has successfully completed all operational flight objectives."
        </p>

        {/* Final stats */}
        <div style={{ display: 'flex', gap: 32, justifyContent: 'center', marginBottom: 40, flexWrap: 'wrap' }}>
          {[
            { label: 'MISSION DURATION', value: `${Math.floor(missionDay)} DAYS` },
            { label: 'FINAL HEALTH', value: `${telemetry ? telemetry.overallHealth.toFixed(0) : '98'}%` },
            { label: 'THREATS MITIGATED', value: String(stats.threatsEncountered) },
            { label: 'AI ACTIONS', value: String(stats.aiInterventions) },
          ].map(({ label, value }) => (
            <div key={label} style={{ textAlign: 'center', background: 'rgba(5,12,25,0.8)', padding: '12px 20px', borderRadius: 8, border: '1px solid rgba(0,212,255,0.12)' }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 4, letterSpacing: '0.15em' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#00d4ff' }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', gap: 14, justifyContent: 'center', flexWrap: 'wrap' }}>
          <motion.button
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.6 }}
            onClick={() => setScreen('disposition')}
            className="btn btn-primary btn-lg"
            style={{ fontSize: 13, letterSpacing: '0.15em', padding: '16px 40px', boxShadow: '0 0 35px rgba(0,212,255,0.35)' }}
          >
            DETERMINE SPACECRAFT FATE →
          </motion.button>
          <motion.button
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.8 }}
            onClick={() => setScreen('replay')}
            className="btn btn-lg"
            style={{ fontSize: 13, padding: '16px 32px', background: 'rgba(0,212,255,0.1)', border: '1px solid rgba(0,212,255,0.3)', color: '#00d4ff' }}
          >
            ▶ VIEW MISSION REPLAY
          </motion.button>
        </div>
      </motion.div>
    </div>
  );
}

