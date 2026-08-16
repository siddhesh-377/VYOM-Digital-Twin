import { useState, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { useMissionStore } from '../../store/missionStore';
import { Earth, StarField } from '../three/SpaceScene';
import { LAUNCH_SITES } from '../../types/mission';
import type { LaunchSite } from '../../types/mission';

function LaunchMarker({ site, selected, hovered, onClick, onHover }: {
  site: LaunchSite & { index: number };
  selected: boolean;
  hovered: boolean;
  onClick: () => void;
  onHover: (h: boolean) => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  const phi = (90 - site.lat) * (Math.PI / 180);
  const theta = (site.lng + 180) * (Math.PI / 180);
  const r = 2.05;
  const pos: [number, number, number] = [
    -r * Math.sin(phi) * Math.cos(theta),
    r * Math.cos(phi),
    r * Math.sin(phi) * Math.sin(theta),
  ];

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.scale.setScalar(selected ? 1.5 + Math.sin(t * 3) * 0.2 : 1);
    }
    if (ringRef.current) {
      ringRef.current.scale.setScalar(1 + Math.sin(t * 2 + site.index) * 0.5);
      (ringRef.current.material as THREE.MeshBasicMaterial).opacity =
        (0.5 - Math.sin(t * 2 + site.index) * 0.3);
    }
  });

  return (
    <group position={pos}>
      <mesh ref={ringRef}>
        <ringGeometry args={[0.04, 0.06, 16]} />
        <meshBasicMaterial color={selected ? '#00d4ff' : '#ffffff'} transparent opacity={0.4} />
      </mesh>
      <mesh ref={meshRef}
        onClick={(e) => { e.stopPropagation(); onClick(); }}
        onPointerOver={() => onHover(true)}
        onPointerOut={() => onHover(false)}
      >
        <sphereGeometry args={[0.03, 8, 8]} />
        <meshBasicMaterial color={selected ? '#00d4ff' : hovered ? '#ffffff' : '#aaddff'} />
      </mesh>
      {(selected || hovered) && (
        <mesh position={[0, 0.1, 0]}>
          <cylinderGeometry args={[0.003, 0.003, 0.2, 4]} />
          <meshBasicMaterial color="#00d4ff" transparent opacity={0.5} />
        </mesh>
      )}
    </group>
  );
}

function EarthWithSites({ sites, selectedSite, setSelectedSite }: {
  sites: (LaunchSite & { index: number })[];
  selectedSite: LaunchSite | null;
  setSelectedSite: (s: LaunchSite) => void;
}) {
  const [hoveredSite, setHoveredSite] = useState<string | null>(null);
  const groupRef = useRef<THREE.Group>(null);

  useFrame((_, delta) => {
    if (groupRef.current) {
      groupRef.current.rotation.y += delta * 0.04;
    }
  });

  return (
    <>
      <ambientLight intensity={0.2} />
      <directionalLight position={[5, 3, 5]} intensity={1.2} color="#fff5e8" />
      <directionalLight position={[-4, -2, -4]} intensity={0.3} color="#88bbff" />
      <StarField />
      <group ref={groupRef}>
        <Earth radius={2} />
        {sites.map((site) => (
          <LaunchMarker
            key={site.name}
            site={site}
            selected={selectedSite?.name === site.name}
            hovered={hoveredSite === site.name}
            onClick={() => setSelectedSite(site)}
            onHover={(h) => setHoveredSite(h ? site.name : null)}
          />
        ))}
      </group>
      <OrbitControls enableZoom={true} minDistance={3} maxDistance={10} />
    </>
  );
}

export function LaunchLocationScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const config = useMissionStore((s) => s.config);
  const setMissionConfig = useMissionStore((s) => s.setMissionConfig);

  const [selectedSite, setSelectedSite] = useState<LaunchSite>(
    config?.launchSite || LAUNCH_SITES[0]
  );
  const [launchWindow] = useState('T-00:15:00 · Optimal Window Open');

  const sitesWithIndex = LAUNCH_SITES.map((s, i) => ({ ...s, index: i }));

  const handleProceed = () => {
    const siteToUse = selectedSite || LAUNCH_SITES[0];
    if (config) {
      setMissionConfig({ ...config, launchSite: siteToUse });
    }
    setScreen('satellite');
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#020409', overflow: 'hidden' }}>
      {/* 3D Canvas */}
      <Canvas style={{ position: 'absolute', inset: 0 }} gl={{ antialias: true }} dpr={[1, 2]}>
        <EarthWithSites
          sites={sitesWithIndex}
          selectedSite={selectedSite}
          setSelectedSite={setSelectedSite}
        />
      </Canvas>

      {/* Top Header */}
      <motion.div
        initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }}
        style={{
          position: 'absolute', top: 20, left: '50%', transform: 'translateX(-50%)',
          textAlign: 'center', zIndex: 10, pointerEvents: 'none', width: '90%', maxWidth: 700,
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'rgba(0,212,255,0.7)', marginBottom: 4 }}>
          STEP 04 OF 05 · SPACEPORT &amp; LAUNCH LOCATION SELECTION
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(18px, 3vw, 28px)', fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
          WHERE WILL {config?.name?.toUpperCase() ?? 'YOUR MISSION'} BEGIN?
        </h1>
        <p style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)', marginTop: 2 }}>
          Budget: ₹{config?.budgetCrore ?? 250} Cr · Click any spaceport on the 3D globe or select from the list
        </p>
      </motion.div>

      {/* Site list - Left Scrollable Panel */}
      <motion.div
        initial={{ opacity: 0, x: -30 }} animate={{ opacity: 1, x: 0 }} transition={{ delay: 0.15 }}
        style={{
          position: 'absolute', left: 24, top: 140, bottom: 24,
          width: 320, zIndex: 10,
          background: 'rgba(5,15,30,0.92)', border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 12, padding: '16px', backdropFilter: 'blur(12px)',
          display: 'flex', flexDirection: 'column',
          boxShadow: '0 0 30px rgba(0,0,0,0.6)',
        }}
      >
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.8)', letterSpacing: '0.15em', marginBottom: 12 }}>
          AVAILABLE SPACEPORTS ({sitesWithIndex.length})
        </div>

        {/* Scrollable list with high-contrast scrollbar */}
        <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4 }}>
          {sitesWithIndex.map((site) => {
            const isSelected = selectedSite?.name === site.name;
            return (
              <div
                key={site.name}
                onClick={() => setSelectedSite(site)}
                style={{
                  padding: '12px 14px', marginBottom: 8,
                  background: isSelected ? 'rgba(0,212,255,0.18)' : 'rgba(0,0,0,0.35)',
                  border: `1px solid ${isSelected ? '#00d4ff' : 'rgba(255,255,255,0.06)'}`,
                  borderRadius: 8, cursor: 'pointer',
                  transition: 'all 0.2s',
                  boxShadow: isSelected ? '0 0 15px rgba(0,212,255,0.2)' : 'none',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{
                    width: 8, height: 8, borderRadius: '50%',
                    background: isSelected ? '#00d4ff' : 'rgba(255,255,255,0.25)',
                    boxShadow: isSelected ? '0 0 8px #00d4ff' : 'none',
                    flexShrink: 0,
                  }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: isSelected ? 700 : 500, color: isSelected ? '#00d4ff' : '#fff' }}>
                      {site.name}
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>
                      {site.country} · {site.agency}
                    </div>
                  </div>
                  {isSelected && <span style={{ color: '#00ff88', fontSize: 11 }}>✓</span>}
                </div>
              </div>
            );
          })}
        </div>
      </motion.div>

      {/* Selected site info - Right Scrollable Panel with Sticky Action Bar */}
      <AnimatePresence>
        {selectedSite && (
          <motion.div
            initial={{ opacity: 0, x: 30 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: 30 }}
            style={{
              position: 'absolute', right: 24, top: 140, bottom: 24,
              width: 340, zIndex: 10,
              background: 'rgba(5,15,30,0.94)', border: '1px solid rgba(0,212,255,0.25)',
              borderRadius: 12, padding: '20px', backdropFilter: 'blur(14px)',
              display: 'flex', flexDirection: 'column',
              boxShadow: '0 0 30px rgba(0,0,0,0.6)',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(0,212,255,0.8)', marginBottom: 8 }}>
              SELECTED LAUNCH COMPLEX
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 2 }}>
              {selectedSite.name}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00d4ff', marginBottom: 14 }}>
              {selectedSite.country} · {selectedSite.agency}
            </div>

            {/* Scrollable details */}
            <div style={{ flex: 1, overflowY: 'auto', paddingRight: 4, marginBottom: 14 }}>
              {[
                { label: 'COORDINATES', value: `${selectedSite.lat.toFixed(2)}°N, ${selectedSite.lng.toFixed(2)}°E` },
                { label: 'SIM. LAUNCH WINDOW', value: launchWindow },
                { label: 'INSERTION TRAJECTORY', value: config?.destination === 'lunar-surface' ? 'Trans-Lunar Injection (TLI)' : 'LEO 650 km · 51.6° Inc.' },
                { label: 'DESTINATION TARGET', value: config?.destination?.toUpperCase().replace('-', ' ') ?? 'EARTH ORBIT' },
                { label: 'SPACECRAFT TARGET', value: config?.name ?? 'CUSTOM-01' },
                { label: 'MISSION BUDGET', value: `₹${config?.budgetCrore ?? 250} Crore INR` },
              ].map(({ label, value }) => (
                <div key={label} style={{ marginBottom: 10, padding: '8px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.04)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>
                    {label}
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff' }}>
                    {value}
                  </div>
                </div>
              ))}
            </div>

            {/* Pinned Action Buttons */}
            <div style={{
              background: 'rgba(5,15,30,0.95)', borderTop: '1px solid rgba(0,212,255,0.2)',
              paddingTop: 16, marginTop: 'auto', display: 'flex', gap: 8
            }}>
              <button
                onClick={() => setScreen('budget')}
                style={{
                  padding: '12px 14px', background: 'rgba(255,255,255,0.05)',
                  border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
                  color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)', fontSize: 10, cursor: 'pointer',
                  transition: 'all 0.2s', flexShrink: 0
                }}
              >
                ← BACK
              </button>
              <button
                onClick={handleProceed}
                style={{
                  flex: 1, padding: '16px', background: '#00d4ff', color: '#020409',
                  border: 'none', borderRadius: 8, fontFamily: 'var(--font-display)',
                  fontSize: 14, fontWeight: 800, cursor: 'pointer', transition: 'all 0.2s',
                  boxShadow: '0 0 20px rgba(0,212,255,0.4)',
                }}
              >
                CONFIRM &amp; GENERATE SPACECRAFT →
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
