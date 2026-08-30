import { useRef, useState } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { Earth, StarField, OrbitingSatellite, Nebula } from '../three/SpaceScene';
import { useMissionStore } from '../../store/missionStore';

export function WelcomeScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const startMission = useMissionStore((s) => s.startMission);
  const [phase, setPhase] = useState<'cta' | 'launching'>('cta');
  const cameraRef = useRef<THREE.PerspectiveCamera>(null);

  const handleBeginMission = () => {
    setPhase('launching');
    setTimeout(() => setScreen('onboarding'), 600);
  };

  const handleQuickStart = () => {
    startMission();
    setScreen('mission-control');
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: '#020409',
      overflow: 'hidden',
      userSelect: 'none',
    }}>
      {/* ── 1. Interactive 3D WebGL Space Canvas (Drag to Rotate 360°) ── */}
      <Canvas
        style={{ position: 'absolute', inset: 0, zIndex: 1 }}
        gl={{ antialias: true, alpha: false, powerPreference: 'high-performance' }}
        dpr={[1, 2]}
      >
        <PerspectiveCamera ref={cameraRef} makeDefault position={[0, 0, 5.8]} fov={50} />
        <ambientLight intensity={0.15} />
        <directionalLight position={[6, 3, 5]} intensity={1.8} color="#fff8e8" />
        <pointLight position={[-6, -3, -4]} intensity={0.5} color="#00e5ff" />
        <StarField />
        <Nebula />
        <Earth radius={2.0} />
        <OrbitingSatellite earthRadius={2.0} altitudeKm={650} />
        <OrbitControls
          enableZoom={true}
          enablePan={false}
          enableDamping={true}
          dampingFactor={0.06}
          autoRotate={true}
          autoRotateSpeed={0.4}
          minDistance={3.0}
          maxDistance={8.0}
        />
      </Canvas>

      {/* Subtle Scanline Overlay */}
      <div className="scan-overlay" style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2 }} />

      {/* Cosmic Vignette for Text Clarity */}
      <div style={{
        position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2,
        background: 'radial-gradient(ellipse at center, transparent 35%, rgba(2,4,9,0.55) 70%, rgba(2,4,9,0.92) 100%)',
      }} />

      {/* Corner Frame Lines */}
      {['tl', 'tr', 'bl', 'br'].map((pos) => (
        <div key={pos} style={{
          position: 'absolute',
          top: pos.startsWith('t') ? 20 : 'auto',
          bottom: pos.startsWith('b') ? 20 : 'auto',
          left: pos.endsWith('l') ? 20 : 'auto',
          right: pos.endsWith('r') ? 20 : 'auto',
          width: 32, height: 32,
          borderTop: pos.startsWith('t') ? '1px solid rgba(0,212,255,0.4)' : 'none',
          borderBottom: pos.startsWith('b') ? '1px solid rgba(0,212,255,0.4)' : 'none',
          borderLeft: pos.endsWith('l') ? '1px solid rgba(0,212,255,0.4)' : 'none',
          borderRight: pos.endsWith('r') ? '1px solid rgba(0,212,255,0.4)' : 'none',
          pointerEvents: 'none', zIndex: 3,
        }} />
      ))}

      {/* Top Status Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2, duration: 0.6 }}
        style={{
          position: 'absolute', top: 24, left: '50%', transform: 'translateX(-50%)',
          display: 'flex', alignItems: 'center', gap: 14, zIndex: 5,
          background: 'rgba(5, 12, 25, 0.75)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0, 212, 255, 0.2)', borderRadius: 20,
          padding: '5px 16px',
        }}
      >
        <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88' }} />
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,212,255,0.85)', fontWeight: 600 }}>
          SIMULATION ACTIVE
        </span>
        <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.2)' }} />
        <span style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.6)' }}>
          VYOM v2.2
        </span>
      </motion.div>

      {/* ── 2. Clean Central Hero Content ── */}
      <div style={{
        position: 'absolute', inset: 0,
        display: 'flex', flexDirection: 'column',
        alignItems: 'center', justifyContent: 'center',
        pointerEvents: 'none', zIndex: 4, padding: '0 20px',
      }}>
        {/* VYOM Wordmark */}
        <motion.div
          initial={{ opacity: 0, scale: 0.85, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.16, 1, 0.3, 1] }}
          style={{ textAlign: 'center', pointerEvents: 'auto' }}
        >
          <div style={{
            fontFamily: 'var(--font-display, Orbitron, sans-serif)',
            fontSize: 'clamp(56px, 12vw, 130px)',
            fontWeight: 900,
            letterSpacing: '0.15em',
            color: '#ffffff',
            textShadow: '0 0 60px rgba(0,212,255,0.35), 0 0 120px rgba(0,212,255,0.15)',
            lineHeight: 1,
            position: 'relative',
          }}>
            VYOM
            <div style={{
              position: 'absolute', bottom: -6, left: '50%', transform: 'translateX(-50%)',
              width: '60%', height: 2,
              background: 'linear-gradient(90deg, transparent, rgba(0,212,255,0.8), transparent)',
              boxShadow: '0 0 10px #00d4ff',
            }} />
          </div>
        </motion.div>

        {/* Tagline */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.15 }}
          style={{ marginTop: 16, textAlign: 'center' }}
        >
          <p style={{
            fontFamily: 'var(--font-body, Space Grotesk, sans-serif)',
            fontSize: 'clamp(12px, 1.8vw, 18px)',
            letterSpacing: '0.3em',
            color: '#00d4ff',
            textTransform: 'uppercase',
            fontWeight: 500,
            textShadow: '0 0 10px rgba(0,212,255,0.3)',
          }}>
            Your Mission. Your Universe.
          </p>
        </motion.div>

        {/* Subtitle */}
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5, delay: 0.25 }}
          style={{ marginTop: 8, textAlign: 'center', maxWidth: 640 }}
        >
          <p style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 'clamp(9.5px, 1.2vw, 11px)',
            letterSpacing: '0.1em',
            color: 'rgba(255,255,255,0.65)',
            lineHeight: 1.4,
          }}>
            Intelligent Digital Space Mission Twin &amp; Autonomous Mission Control
          </p>
        </motion.div>
      </div>

      {/* ── 3. Bottom CTA & Orbit Info Strip ── */}
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 30 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.6, delay: 0.3, ease: [0.16, 1, 0.3, 1] }}
          style={{
            position: 'absolute', bottom: '8%', left: '50%', transform: 'translateX(-50%)',
            display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16,
            zIndex: 5, width: '90%', maxWidth: 540,
          }}
        >
          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 14, alignItems: 'center', flexWrap: 'wrap', justifyContent: 'center' }}>
            <button
              onClick={handleBeginMission}
              disabled={phase === 'launching'}
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                padding: '14px 34px',
                background: 'rgba(0, 212, 255, 0.12)',
                border: '1.5px solid #00d4ff',
                borderRadius: 6,
                color: '#00d4ff',
                cursor: phase === 'launching' ? 'default' : 'pointer',
                transition: 'all 0.25s ease',
                boxShadow: '0 0 25px rgba(0,212,255,0.2)',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={(e) => {
                if (phase !== 'launching') {
                  e.currentTarget.style.background = 'rgba(0, 212, 255, 0.25)';
                  e.currentTarget.style.boxShadow = '0 0 35px rgba(0, 212, 255, 0.4)';
                  e.currentTarget.style.transform = 'translateY(-2px)';
                }
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(0, 212, 255, 0.12)';
                e.currentTarget.style.boxShadow = '0 0 25px rgba(0, 212, 255, 0.2)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              CREATE MISSION →
            </button>

            <button
              onClick={handleQuickStart}
              disabled={phase === 'launching'}
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                fontWeight: 700,
                letterSpacing: '0.18em',
                textTransform: 'uppercase',
                padding: '14px 28px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: '1px solid rgba(255, 255, 255, 0.25)',
                borderRadius: 6,
                color: '#ffffff',
                cursor: phase === 'launching' ? 'default' : 'pointer',
                transition: 'all 0.25s ease',
                backdropFilter: 'blur(8px)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.12)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.5)';
                e.currentTarget.style.transform = 'translateY(-2px)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.background = 'rgba(255, 255, 255, 0.05)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.25)';
                e.currentTarget.style.transform = 'translateY(0)';
              }}
            >
              LAUNCH DEMO 🚀
            </button>
          </div>

          {/* Minimalist Orbit Info Strip */}
          <div style={{
            display: 'flex', gap: 24, alignItems: 'center', justifyContent: 'center',
            background: 'rgba(5, 12, 25, 0.75)', backdropFilter: 'blur(8px)',
            padding: '6px 20px', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)',
          }}>
            {[
              { label: 'ALTITUDE', value: '650 KM' },
              { label: 'SIMULATION', value: 'ACTIVE' },
              { label: 'ORBIT', value: 'LEO 51.6°' },
            ].map(({ label, value }) => (
              <div key={label} style={{ textAlign: 'center' }}>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.1em', color: '#00d4ff', fontWeight: 700 }}>{value}</div>
              </div>
            ))}
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom Footer Note */}
      <div style={{
        position: 'absolute', bottom: 16, left: 24,
        fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5,
        letterSpacing: '0.12em', color: 'rgba(255,255,255,0.3)',
        zIndex: 5,
      }}>
        VYOM SIMULATION ENGINE · GROUNDED AEROSPACE INTELLIGENCE
      </div>
    </div>
  );
}
