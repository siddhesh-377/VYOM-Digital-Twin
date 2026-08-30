import React, { useEffect, useRef, useState, useMemo } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion } from 'framer-motion';
import * as THREE from 'three';
import { Earth, StarField, OrbitingSatellite, Nebula } from '../three/SpaceScene';
import { useMissionStore } from '../../store/missionStore';
import type { AppScreen } from '../../types/mission';

// ── Satellite Trajectory Ring in 3D Space ─────────────────────────────────────
function OrbitTrajectoryRing({ radius, inclinationDeg = 51.6, color = '#00e5ff' }: { radius: number; inclinationDeg?: number; color?: string }) {
  const points = useMemo(() => {
    const pts: THREE.Vector3[] = [];
    const segments = 128;
    for (let i = 0; i <= segments; i++) {
      const theta = (i / segments) * Math.PI * 2;
      pts.push(new THREE.Vector3(Math.cos(theta) * radius, 0, Math.sin(theta) * radius));
    }
    return pts;
  }, [radius]);

  const geom = useMemo(() => new THREE.BufferGeometry().setFromPoints(points), [points]);
  const mat = useMemo(() => new THREE.LineBasicMaterial({ color, transparent: true, opacity: 0.35 }), [color]);
  const incRad = (inclinationDeg * Math.PI) / 180;

  return (
    <group rotation={[0, 0, incRad]}>
      <primitive object={new THREE.Line(geom, mat)} />
    </group>
  );
}

// ── Constellation of Secondary Tracking Beacons ──────────────────────────────
function ConstellationTrackers() {
  const groupRef = useRef<THREE.Group>(null);
  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.08;
    }
  });

  return (
    <group ref={groupRef}>
      {[
        { pos: [2.8, 1.2, 0] as [number, number, number], color: '#00ff88' },
        { pos: [-2.4, -1.5, 1.2] as [number, number, number], color: '#ff9f0a' },
        { pos: [0.5, 2.7, -1.8] as [number, number, number], color: '#bf5af2' },
      ].map((sat, i) => (
        <group key={i} position={sat.pos}>
          <mesh>
            <sphereGeometry args={[0.04, 16, 16]} />
            <meshBasicMaterial color={sat.color} />
          </mesh>
          <pointLight color={sat.color} intensity={0.4} distance={1.5} />
        </group>
      ))}
    </group>
  );
}

export function WelcomeScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const startMission = useMissionStore((s) => s.startMission);
  const setMissionProfile = useMissionStore((s) => s.setMissionProfile);

  const [selectedMission, setSelectedMission] = useState<'human' | 'orbital' | 'astrophysics'>('orbital');
  const [isAutoRotating, setIsAutoRotating] = useState(true);
  const [timeStr, setTimeStr] = useState('');
  const controlsRef = useRef<any>(null);

  // Live UTC Clock
  useEffect(() => {
    const updateTime = () => {
      const d = new Date();
      setTimeStr(d.toISOString().replace('T', ' ').slice(0, 19) + ' UTC');
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => {
      clearInterval(interval);
    };
  }, []);

  const handleSelectMission = (key: 'human' | 'orbital' | 'astrophysics') => {
    setSelectedMission(key);
    setMissionProfile(key);
  };

  const handleLaunchDirect = (screen: AppScreen = 'mission-control') => {
    setMissionProfile(selectedMission);
    startMission();
    setScreen(screen);
  };

  const handleResetCamera = () => {
    if (controlsRef.current) {
      controlsRef.current.reset();
    }
  };

  const missionList = [
    {
      key: 'orbital' as const,
      name: 'CartoSat-3D',
      badge: 'EARTH OBSERVATION',
      icon: '🛰️',
      desc: 'Sun-synchronous multi-spectral remote sensing digital twin with 12-channel telemetry.',
      orbit: 'SSO 500 KM · 97.4 MIN',
      color: '#00e5ff',
    },
    {
      key: 'human' as const,
      name: 'Gaganyaan-H1',
      badge: 'CREWED EXPEDITION',
      icon: '👨‍🚀',
      desc: 'Human spaceflight mission twin with ECLSS life support, cabin pressure, and physiological telemetry.',
      orbit: 'LEO 400 KM · 51.6° INC',
      color: '#30d158',
    },
    {
      key: 'astrophysics' as const,
      name: 'AstroSat-II',
      badge: 'DEEP SPACE OBSERVATORY',
      icon: '🔭',
      desc: 'Space observatory at Sun-Earth L2 with multi-band UV/X-ray sensors and cryogenic attitude hold.',
      orbit: 'LAGRANGE L2 · CRYO HOLD',
      color: '#bf5af2',
    },
  ];

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#020409', overflow: 'hidden', userSelect: 'none' }}>
      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 1. ULTRA-HD 3D WEBGL EARTH SCENE (SMOOTH 60+ FPS) ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <Canvas
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera makeDefault position={[0, 0.4, 5.8]} fov={45} />
        <OrbitControls
          ref={controlsRef}
          enablePan={false}
          enableZoom={true}
          minDistance={3.2}
          maxDistance={8.5}
          enableDamping={true}
          dampingFactor={0.06}
          autoRotate={isAutoRotating}
          autoRotateSpeed={0.5}
        />
        <ambientLight intensity={0.15} />
        <directionalLight position={[6, 3, 5]} intensity={1.8} color="#fff8e8" />
        <pointLight position={[-8, -4, -4]} intensity={0.6} color="#00e5ff" />
        
        {/* Starfield & Cosmic Haze */}
        <StarField />
        <Nebula />
        
        {/* Procedural HD Earth */}
        <Earth radius={2.0} />
        
        {/* Active Orbiting Satellite & Trajectory Trails */}
        <OrbitingSatellite earthRadius={2.0} altitudeKm={selectedMission === 'human' ? 400 : 650} />
        <OrbitTrajectoryRing radius={2.6} inclinationDeg={selectedMission === 'human' ? 51.6 : 97.4} color={selectedMission === 'human' ? '#30d158' : '#00e5ff'} />
        <ConstellationTrackers />
      </Canvas>

      {/* Atmospheric Cosmic Gradient Overlays (Vignette for High Contrast) */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'radial-gradient(ellipse at center, transparent 30%, rgba(2,4,9,0.5) 70%, rgba(2,4,9,0.92) 100%)',
      }} />

      {/* Top Header Glow Bar */}
      <div style={{
        position: 'absolute', top: 0, left: 0, right: 0, height: 140, pointerEvents: 'none', zIndex: 2,
        background: 'linear-gradient(to bottom, rgba(2,4,9,0.92) 0%, rgba(2,4,9,0) 100%)',
      }} />

      {/* Bottom Footer Glow Bar */}
      <div style={{
        position: 'absolute', bottom: 0, left: 0, right: 0, height: 180, pointerEvents: 'none', zIndex: 2,
        background: 'linear-gradient(to top, rgba(2,4,9,0.95) 0%, rgba(2,4,9,0) 100%)',
      }} />

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 2. TOP STATUS BAR (ISRO / MISSION IDENTITY) ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <header style={{
        position: 'absolute', top: 0, left: 0, right: 0, zIndex: 10,
        display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        padding: '16px 28px',
      }}>
        {/* Brand & Telemetry Status */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div style={{
            display: 'flex', alignItems: 'center', gap: 8,
            background: 'rgba(5, 12, 25, 0.85)', backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 229, 255, 0.25)', borderRadius: 8,
            padding: '6px 14px',
          }}>
            <div style={{
              width: 8, height: 8, borderRadius: '50%', background: '#00ff88',
              boxShadow: '0 0 10px #00ff88',
              animation: 'pulse 1.8s ease-in-out infinite',
            }} />
            <span style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: 16, fontWeight: 900, letterSpacing: '0.15em',
              color: '#00e5ff', textShadow: '0 0 15px rgba(0,229,255,0.4)',
            }}>
              VYOM
            </span>
            <span style={{
              fontSize: 10, fontFamily: 'var(--font-mono, monospace)',
              color: 'rgba(255,255,255,0.7)', letterSpacing: '0.08em', fontWeight: 600,
            }}>
              MISSION DIGITAL TWIN
            </span>
          </div>

          <div style={{
            display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(0, 255, 136, 0.1)', border: '1px solid rgba(0, 255, 136, 0.3)',
            borderRadius: 6, padding: '4px 10px',
            fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: '#00ff88', fontWeight: 700,
          }}>
            <span>●</span> 10HZ HIGH-PRECISION STREAM
          </div>
        </div>

        {/* Master UTC Clock */}
        <div style={{
          display: 'flex', alignItems: 'center', gap: 12,
          background: 'rgba(5, 12, 25, 0.85)', backdropFilter: 'blur(10px)',
          border: '1px solid rgba(255,255,255,0.1)', borderRadius: 8,
          padding: '6px 16px',
        }}>
          <div style={{ textAlign: 'right' }}>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, fontWeight: 700, color: '#00e5ff' }}>
              {timeStr || '2026-08-30 12:00:00 UTC'}
            </div>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
              AUTONOMOUS MISSION CONTROL v2.2
            </div>
          </div>
        </div>
      </header>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 3. CENTER HERO: TITLE & LIVE TELEMETRY TELEMTRIC METRICS ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <main style={{
        position: 'absolute', inset: 0, zIndex: 5,
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', padding: '0 20px',
      }}>
        <motion.div
          initial={{ opacity: 0, y: 25 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: 'center', pointerEvents: 'auto', maxWidth: 900 }}
        >
          {/* Main Title */}
          <div style={{ position: 'relative', display: 'inline-block' }}>
            <h1 style={{
              fontFamily: 'var(--font-display, sans-serif)',
              fontSize: 'clamp(52px, 8vw, 108px)',
              fontWeight: 900,
              letterSpacing: '0.18em',
              lineHeight: 1,
              margin: 0,
              color: '#ffffff',
              textShadow: '0 0 50px rgba(0,229,255,0.4), 0 0 100px rgba(0,229,255,0.2)',
            }}>
              VYOM
            </h1>
            <div style={{
              position: 'absolute', bottom: -6, left: '15%', right: '15%', height: 2,
              background: 'linear-gradient(90deg, transparent, #00e5ff, transparent)',
              boxShadow: '0 0 12px #00e5ff',
            }} />
          </div>

          {/* Subtitle */}
          <p style={{
            fontFamily: 'var(--font-sans, system-ui, sans-serif)',
            fontSize: 'clamp(12px, 1.6vw, 16px)',
            fontWeight: 600,
            letterSpacing: '0.24em',
            color: '#00e5ff',
            textTransform: 'uppercase',
            marginTop: 14,
            marginBottom: 6,
            textShadow: '0 0 12px rgba(0,229,255,0.3)',
          }}>
            Intelligent Space Mission Digital Twin &amp; Autonomous Mission Control
          </p>

          <p style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            color: 'rgba(255,255,255,0.65)',
            letterSpacing: '0.08em',
            maxWidth: 620,
            margin: '0 auto 20px auto',
            lineHeight: 1.5,
          }}>
            Real-time Keplerian orbital physics, 12-channel telemetry stream, multi-horizon trajectory forecasting, and grounded zero-hallucination AI mission guardian.
          </p>

          {/* Real-time Telemetry Metrics Pill Bar */}
          <div style={{
            display: 'flex', justifyContent: 'center', gap: 12, flexWrap: 'wrap',
            marginBottom: 24,
          }}>
            {[
              { label: 'ORBITAL ALTITUDE', value: selectedMission === 'human' ? '400.0 KM' : '650.0 KM' },
              { label: 'ORBITAL VELOCITY', value: '7.66 KM/S' },
              { label: 'DOWNLINK STATUS', value: 'ISTRAC 100%' },
              { label: 'AI HEALTH METRIC', value: '99.8% NOMINAL' },
            ].map((stat) => (
              <div key={stat.label} style={{
                background: 'rgba(5, 12, 25, 0.85)', backdropFilter: 'blur(8px)',
                border: '1px solid rgba(0, 229, 255, 0.2)', borderRadius: 6,
                padding: '6px 14px', textAlign: 'center',
              }}>
                <div style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em' }}>
                  {stat.label}
                </div>
                <div style={{ fontSize: 12, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#00e5ff', marginTop: 2 }}>
                  {stat.value}
                </div>
              </div>
            ))}
          </div>

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* ── 4. INTERACTIVE MISSION CAROUSEL (1-CLICK PROFILE SELECT) ── */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          <div style={{
            display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12,
            maxWidth: 820, margin: '0 auto 24px auto',
          }}>
            {missionList.map((m) => {
              const isSel = selectedMission === m.key;
              return (
                <div
                  key={m.key}
                  onClick={() => handleSelectMission(m.key)}
                  style={{
                    background: isSel ? 'rgba(0, 229, 255, 0.12)' : 'rgba(5, 12, 25, 0.75)',
                    border: `1.5px solid ${isSel ? m.color : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 8, padding: '12px 14px', textAlign: 'left',
                    cursor: 'pointer', transition: 'all 0.25s ease',
                    boxShadow: isSel ? `0 0 20px ${m.color}33` : 'none',
                    backdropFilter: 'blur(10px)',
                  }}
                  onMouseEnter={(e) => {
                    if (!isSel) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.3)';
                      e.currentTarget.style.background = 'rgba(5, 12, 25, 0.9)';
                    }
                  }}
                  onMouseLeave={(e) => {
                    if (!isSel) {
                      e.currentTarget.style.borderColor = 'rgba(255,255,255,0.12)';
                      e.currentTarget.style.background = 'rgba(5, 12, 25, 0.75)';
                    }
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontSize: 16 }}>{m.icon}</span>
                    <span style={{
                      fontSize: 8, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700,
                      color: isSel ? m.color : 'rgba(255,255,255,0.5)', letterSpacing: '0.08em',
                    }}>
                      {m.badge}
                    </span>
                  </div>

                  <div style={{ fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                    {m.name}
                  </div>

                  <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.65)', marginTop: 4, lineHeight: 1.3, minHeight: 26 }}>
                    {m.desc}
                  </div>

                  <div style={{
                    fontSize: 8.5, fontFamily: 'var(--font-mono, monospace)', fontWeight: 600,
                    color: m.color, marginTop: 8, paddingTop: 6, borderTop: '1px solid rgba(255,255,255,0.08)',
                  }}>
                    {m.orbit}
                  </div>
                </div>
              );
            })}
          </div>

          {/* ══════════════════════════════════════════════════════════════════════ */}
          {/* ── 5. PRIMARY ACTION BUTTONS (CTAs) ── */}
          {/* ══════════════════════════════════════════════════════════════════════ */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 14, flexWrap: 'wrap' }}>
            <button
              onClick={() => handleLaunchDirect('mission-control')}
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12, fontWeight: 800, letterSpacing: '0.15em',
                padding: '14px 36px',
                background: 'linear-gradient(135deg, rgba(0,229,255,0.25) 0%, rgba(0,140,255,0.35) 100%)',
                border: '1.5px solid #00e5ff',
                borderRadius: 6, color: '#ffffff',
                cursor: 'pointer', transition: 'all 0.25s ease',
                boxShadow: '0 0 30px rgba(0,229,255,0.3)',
                display: 'flex', alignItems: 'center', gap: 10,
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,229,255,0.45) 0%, rgba(0,140,255,0.55) 100%)';
                e.currentTarget.style.boxShadow = '0 0 45px rgba(0,229,255,0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'linear-gradient(135deg, rgba(0,229,255,0.25) 0%, rgba(0,140,255,0.35) 100%)';
                e.currentTarget.style.boxShadow = '0 0 30px rgba(0,229,255,0.3)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              <span>🚀</span> ENTER MISSION CONTROL
            </button>

            <button
              onClick={() => setScreen('onboarding')}
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.15em',
                padding: '14px 28px',
                background: 'rgba(5, 12, 25, 0.85)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 6, color: '#ffffff',
                cursor: 'pointer', transition: 'all 0.25s ease',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#00e5ff';
                e.currentTarget.style.color = '#00e5ff';
                e.currentTarget.style.background = 'rgba(0, 229, 255, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                e.currentTarget.style.color = '#ffffff';
                e.currentTarget.style.background = 'rgba(5, 12, 25, 0.85)';
              }}
            >
              <span>⚙️</span> CUSTOM MISSION WIZARD
            </button>

            <button
              onClick={() => handleLaunchDirect('scenarios')}
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12, fontWeight: 700, letterSpacing: '0.15em',
                padding: '14px 24px',
                background: 'rgba(5, 12, 25, 0.85)',
                border: '1px solid rgba(255,255,255,0.25)',
                borderRadius: 6, color: 'rgba(255,255,255,0.85)',
                cursor: 'pointer', transition: 'all 0.25s ease',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.borderColor = '#ff9f0a';
                e.currentTarget.style.color = '#ff9f0a';
                e.currentTarget.style.background = 'rgba(255, 159, 10, 0.1)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.borderColor = 'rgba(255,255,255,0.25)';
                e.currentTarget.style.color = 'rgba(255,255,255,0.85)';
                e.currentTarget.style.background = 'rgba(5, 12, 25, 0.85)';
              }}
            >
              <span>⚡</span> WHAT-IF SIMULATOR
            </button>
          </div>
        </motion.div>
      </main>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 6. BOTTOM RIGHT: 3D EARTH INTERACTION HUD ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', bottom: 20, right: 28, zIndex: 10,
        display: 'flex', alignItems: 'center', gap: 10,
        padding: '8px 14px',
        background: 'rgba(5, 12, 25, 0.85)', backdropFilter: 'blur(10px)',
        border: '1px solid rgba(0, 229, 255, 0.25)', borderRadius: 8,
        boxShadow: '0 4px 20px rgba(0,0,0,0.6)',
      }}>
        <div style={{
          width: 6, height: 6, borderRadius: '50%',
          background: isAutoRotating ? '#00ff88' : '#00e5ff',
          boxShadow: `0 0 8px ${isAutoRotating ? '#00ff88' : '#00e5ff'}`,
        }} />

        <div style={{ display: 'flex', flexDirection: 'column' }}>
          <span style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em' }}>
            3D DIGITAL TWIN VIEWPORT
          </span>
          <span style={{ fontSize: 10, fontFamily: 'var(--font-mono, monospace)', fontWeight: 700, color: '#00e5ff' }}>
            🖱️ DRAG TO ROTATE 360° · SCROLL TO ZOOM
          </span>
        </div>

        <button
          onClick={() => setIsAutoRotating(!isAutoRotating)}
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9, fontWeight: 700, padding: '4px 8px',
            background: isAutoRotating ? 'rgba(0, 229, 255, 0.18)' : 'rgba(255,255,255,0.08)',
            border: `1px solid ${isAutoRotating ? '#00e5ff' : 'rgba(255,255,255,0.2)'}`,
            borderRadius: 4, color: isAutoRotating ? '#00e5ff' : '#ffffff',
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
          title="Toggle Earth auto-rotation"
        >
          {isAutoRotating ? 'AUTO-SPIN: ON' : 'AUTO-SPIN: OFF'}
        </button>

        <button
          onClick={handleResetCamera}
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9, fontWeight: 700, padding: '4px 8px',
            background: 'rgba(255,255,255,0.08)',
            border: '1px solid rgba(255,255,255,0.2)',
            borderRadius: 4, color: 'rgba(255,255,255,0.8)',
            cursor: 'pointer', transition: 'all 0.2s ease',
          }}
          title="Reset 3D camera orientation"
        >
          RESET
        </button>
      </div>

      {/* ══════════════════════════════════════════════════════════════════════ */}
      {/* ── 7. BOTTOM LEFT: ISRO TELEMETRY TAPE ── */}
      {/* ══════════════════════════════════════════════════════════════════════ */}
      <div style={{
        position: 'absolute', bottom: 20, left: 28, zIndex: 10,
        fontFamily: 'var(--font-mono, monospace)', fontSize: 9,
        color: 'rgba(255,255,255,0.5)', letterSpacing: '0.12em',
        display: 'flex', alignItems: 'center', gap: 8,
      }}>
        <span style={{ color: '#00e5ff' }}>◈</span>
        <span>ISRO TELEMETRY PROTOCOL · REVOLUTION PERIOD: 97.4 MIN · 12 SUBSYSTEMS NOMINAL</span>
      </div>
    </div>
  );
}
