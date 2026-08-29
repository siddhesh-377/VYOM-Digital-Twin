import { useEffect, useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { Earth, StarField, OrbitingSatellite, Nebula } from '../three/SpaceScene';
import { useMissionStore } from '../../store/missionStore';
import { InteractiveEarthBackground } from '../ui/InteractiveEarthBackground';

export function WelcomeScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const startMission = useMissionStore((s) => s.startMission);
  const [phase, setPhase] = useState<'intro' | 'tagline' | 'cta' | 'launching'>('intro');
  const [backgroundMode, setBackgroundMode] = useState<'frames' | '3d'>('frames');
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  useEffect(() => {
    const t1 = setTimeout(() => setPhase('tagline'), 800);
    const t2 = setTimeout(() => setPhase('cta'), 1800);
    return () => { clearTimeout(t1); clearTimeout(t2); };
  }, []);

  const handleBeginMission = () => {
    setPhase('launching');
    setTimeout(() => setScreen('onboarding'), 1500);
  };

  const handleQuickStart = () => {
    startMission();
    setScreen('mission-control');
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#020409' }}>
      {/* Interactive 200-Frame Earth Background Animation */}
      {backgroundMode === 'frames' ? (
        <InteractiveEarthBackground
          totalFrames={200}
          autoRotateSpeed={18}
          autoRotate={true}
          showHud={true}
          showVignette={true}
        />
      ) : (
        /* 3D Procedural Fallback Canvas */
        <Canvas
          style={{ position: 'absolute', inset: 0 }}
          gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
          dpr={[1, 2]}
        >
          <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 0, 6]} fov={50} />
          <ambientLight intensity={0.1} />
          <directionalLight position={[5, 3, 5]} intensity={1.2} color="#fff5e8" />
          <StarField />
          <Nebula />
          <Earth radius={2} />
          <OrbitingSatellite earthRadius={2} altitudeKm={650} />
          <OrbitControls enableZoom={false} enablePan={false} autoRotate autoRotateSpeed={0.3} />
        </Canvas>
      )}

      {/* Background Visual Switcher Toggle */}
      <div
        style={{
          position: 'absolute',
          top: 24,
          right: 28,
          zIndex: 20,
          display: 'flex',
          gap: 6,
          background: 'rgba(5, 12, 25, 0.85)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          borderRadius: 6,
          padding: '3px',
          backdropFilter: 'blur(8px)',
        }}
      >
        <button
          onClick={() => setBackgroundMode('frames')}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '4px 10px',
            background: backgroundMode === 'frames' ? 'rgba(0, 212, 255, 0.25)' : 'transparent',
            border: `1px solid ${backgroundMode === 'frames' ? '#00d4ff' : 'transparent'}`,
            borderRadius: 4,
            color: backgroundMode === 'frames' ? '#00d4ff' : 'rgba(255, 255, 255, 0.5)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          🌍 200-FRAME EARTH HD
        </button>
        <button
          onClick={() => setBackgroundMode('3d')}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 8.5,
            fontWeight: 700,
            letterSpacing: '0.08em',
            padding: '4px 10px',
            background: backgroundMode === '3d' ? 'rgba(0, 212, 255, 0.25)' : 'transparent',
            border: `1px solid ${backgroundMode === '3d' ? '#00d4ff' : 'transparent'}`,
            borderRadius: 4,
            color: backgroundMode === '3d' ? '#00d4ff' : 'rgba(255, 255, 255, 0.5)',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          🌌 3D PROCEDURAL
        </button>
      </div>

      {/* Scan line overlay */}
      <div className="scan-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }} />

      {/* Vignette */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at center, transparent 40%, rgba(2,4,9,0.7) 100%)',
      }} />

      {/* Corner frames */}
      {['tl', 'tr', 'bl', 'br'].map((pos) => (
        <div key={pos} style={{
          position: 'absolute',
          top: pos.startsWith('t') ? 20 : 'auto',
          bottom: pos.startsWith('b') ? 20 : 'auto',
          left: pos.endsWith('l') ? 20 : 'auto',
          right: pos.endsWith('r') ? 20 : 'auto',
          width: 40, height: 40,
          borderTop: pos.startsWith('t') ? '1px solid rgba(0,212,255,0.3)' : 'none',
          borderBottom: pos.startsWith('b') ? '1px solid rgba(0,212,255,0.3)' : 'none',
          borderLeft: pos.endsWith('l') ? '1px solid rgba(0,212,255,0.3)' : 'none',
          borderRight: pos.endsWith('r') ? '1px solid rgba(0,212,255,0.3)' : 'none',
          pointerEvents: 'none',
        }} />
      ))}

      {/* Top status bar */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.6 }}
        style={{
          position: 'absolute', top: 28, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 16,
        }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,212,255,0.5)' }}>
          SIMULATION ACTIVE
        </span>
        <div style={{ width: 1, height: 12, background: 'rgba(0,212,255,0.2)' }} />
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.3)' }}>
          VYOM v1.0
        </span>
      </motion.div>

      {/* Central content */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none',
      }}>
        {/* VYOM wordmark */}
        <AnimatePresence>
          {phase !== 'intro' && (
            <motion.div
              initial={{ opacity: 0, scale: 0.8, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              transition={{ duration: 1.0, ease: [0.16, 1, 0.3, 1] }}
              style={{ textAlign: 'center' }}
            >
              <div style={{
                fontFamily: 'var(--font-display)',
                fontSize: 'clamp(60px, 12vw, 140px)',
                fontWeight: 900,
                letterSpacing: '0.15em',
                color: '#ffffff',
                textShadow: '0 0 80px rgba(0,212,255,0.3), 0 0 160px rgba(0,212,255,0.1)',
                lineHeight: 1,
                position: 'relative',
              }}>
                VYOM
                <div style={{
                  position: 'absolute', bottom: -8, left: '50%', transform: 'translateX(-50%)',
                  width: '60%', height: 1,
                  background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.6), transparent)',
                }} />
              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Tagline */}
        <AnimatePresence>
          {(phase === 'tagline' || phase === 'cta' || phase === 'launching') && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.6, delay: 0.1 }}
              style={{ marginTop: 16, textAlign: 'center' }}
            >
              <p style={{
                fontFamily: 'var(--font-body)',
                fontSize: 'clamp(13px, 1.5vw, 18px)',
                letterSpacing: '0.3em',
                color: 'rgba(0,212,255,0.7)',
                textTransform: 'uppercase',
                fontWeight: 300,
              }}>
                Your Mission. Your Universe.
              </p>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Subtitle */}
        <AnimatePresence>
          {(phase === 'cta' || phase === 'launching') && (
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.1 }}
              style={{ marginTop: 10 }}
            >
              <p style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                letterSpacing: '0.12em',
                color: 'rgba(255,255,255,0.35)',
                textAlign: 'center',
              }}>
                Intelligent Digital Space Mission Twin &amp; Autonomous Mission Control
              </p>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* CTA Buttons */}
      <AnimatePresence>
        {(phase === 'cta' || phase === 'launching') && (
          <motion.div
            initial={{ opacity: 0, y: 30 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            transition={{ duration: 0.6, ease: [0.16, 1, 0.3, 1] }}
            style={{
              position: 'absolute', bottom: '15%', left: '50%', transform: 'translateX(-50%)',
              display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            }}
          >
            <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
              <button
                onClick={handleBeginMission}
                disabled={phase === 'launching'}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  padding: '16px 44px',
                  background: phase === 'launching' ? 'rgba(0,212,255,0.05)' : 'rgba(0,212,255,0.1)',
                  border: '1px solid rgba(0,212,255,0.6)',
                  borderRadius: 6,
                  color: '#00d4ff',
                  cursor: phase === 'launching' ? 'default' : 'pointer',
                  transition: 'all 0.25s ease',
                  boxShadow: '0 0 25px rgba(0,212,255,0.15)',
                }}
                onMouseEnter={(e) => {
                  if (phase !== 'launching') {
                    (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.2)';
                    (e.currentTarget as HTMLElement).style.boxShadow = '0 0 40px rgba(0,212,255,0.3)';
                  }
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.1)';
                  (e.currentTarget as HTMLElement).style.boxShadow = '0 0 25px rgba(0,212,255,0.15)';
                }}
              >
                {phase === 'launching' ? (
                  <span style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <span style={{ display: 'inline-block', animation: 'spin 1s linear infinite', width: 12, height: 12, border: '2px solid rgba(0,212,255,0.3)', borderTopColor: '#00d4ff', borderRadius: '50%' }} />
                    INITIALIZING
                  </span>
                ) : 'CREATE MISSION →'}
              </button>

              <button
                onClick={handleQuickStart}
                disabled={phase === 'launching'}
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.2em',
                  textTransform: 'uppercase',
                  padding: '16px 36px',
                  background: 'rgba(255,255,255,0.04)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: 'rgba(255,255,255,0.8)',
                  cursor: phase === 'launching' ? 'default' : 'pointer',
                  transition: 'all 0.25s ease',
                }}
                onMouseEnter={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.08)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.4)';
                }}
                onMouseLeave={(e) => {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.borderColor = 'rgba(255,255,255,0.2)';
                }}
              >
                LAUNCH DEMO 🚀
              </button>
            </div>

            {/* Orbit info strip */}
            <div style={{ display: 'flex', gap: 32, alignItems: 'center' }}>
              {[
                { label: 'ALTITUDE', value: '650 KM' },
                { label: 'SIMULATION', value: 'ACTIVE' },
                { label: 'ORBIT', value: 'LEO 51.6°' },
              ].map(({ label, value }) => (
                <div key={label} style={{ textAlign: 'center' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.1em', color: 'rgba(0,212,255,0.6)' }}>{value}</div>
                </div>
              ))}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom left — data source */}
      <div style={{
        position: 'absolute', bottom: 20, left: 28,
        fontFamily: 'var(--font-mono)', fontSize: 9,
        letterSpacing: '0.12em', color: 'rgba(255,255,255,0.2)',
      }}>
        VYOM SIMULATION ENGINE · ALL DATA SIMULATED
      </div>
    </div>
  );
}
