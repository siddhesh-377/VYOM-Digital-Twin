import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { Earth, StarField } from '../three/SpaceScene';
import { SatelliteModel, OrbitLine, GroundTrack } from '../three/SatelliteScene';
import { useRef, useMemo, useState } from 'react';
import * as THREE from 'three';

// Atmospheric Layers Visualization with labeled shell boundaries
function EarthAtmosphericShells() {
  const EARTH_RADIUS = 2;
  const SCALE = EARTH_RADIUS / 6371;

  // Troposphere 12km, Stratosphere 50km, Mesosphere 85km, Thermosphere 600km (Kármán line at 100km)
  const rTropo = EARTH_RADIUS + 12 * SCALE * 8;
  const rStrato = EARTH_RADIUS + 50 * SCALE * 8;
  const rMeso = EARTH_RADIUS + 85 * SCALE * 8;
  const rKarman = EARTH_RADIUS + 100 * SCALE * 8;
  const rThermo = EARTH_RADIUS + 600 * SCALE * 8;

  return (
    <group>
      {/* Troposphere (0-12 km) - dense blue haze */}
      <mesh>
        <sphereGeometry args={[rTropo, 32, 32]} />
        <meshBasicMaterial color="#60a5fa" transparent opacity={0.18} side={THREE.BackSide} />
      </mesh>

      {/* Stratosphere (12-50 km) - ozone cyan shell */}
      <mesh>
        <sphereGeometry args={[rStrato, 32, 32]} />
        <meshBasicMaterial color="#38bdf8" transparent opacity={0.12} side={THREE.BackSide} />
      </mesh>

      {/* Mesosphere (50-85 km) - deeper blue shell */}
      <mesh>
        <sphereGeometry args={[rMeso, 32, 32]} />
        <meshBasicMaterial color="#0284c7" transparent opacity={0.08} side={THREE.BackSide} />
      </mesh>

      {/* Kármán Line (100 km) Boundary Ring of Space */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <ringGeometry args={[rKarman - 0.005, rKarman + 0.005, 64]} />
        <meshBasicMaterial color="#00ff88" transparent opacity={0.45} side={THREE.DoubleSide} />
      </mesh>

      {/* Thermosphere (85-600 km) - ionospheric outer glow */}
      <mesh>
        <sphereGeometry args={[rThermo, 32, 32]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.05} side={THREE.BackSide} />
      </mesh>
    </group>
  );
}

// Cislunar trajectory arc between Earth and Moon for human lunar missions
function CislunarTrajectory() {
  const curve = useMemo(() => {
    return new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(0, 0.4, 2.2),
      new THREE.Vector3(3.5, 2.0, 1.0),
      new THREE.Vector3(7.0, 0.5, -0.5) // Moon position
    );
  }, []);

  const geom = useMemo(() => {
    const points = curve.getPoints(64);
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [curve]);

  const trajectoryLine = useMemo(
    () => new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#00d4ff', transparent: true, opacity: 0.6 })),
    [geom]
  );

  const satRef = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    const t = (clock.getElapsedTime() * 0.05) % 1;
    const pos = curve.getPoint(t);
    if (satRef.current) satRef.current.position.copy(pos);
  });

  return (
    <group>
      {/* Flight trajectory path */}
      <primitive object={trajectoryLine} />

      {/* Moon */}
      <group position={[7.0, 0.5, -0.5]}>
        <mesh>
          <sphereGeometry args={[0.65, 32, 32]} />
          <meshStandardMaterial color="#c8c8d0" roughness={0.9} />
        </mesh>
        {/* Landing target marker */}
        <mesh position={[0, 0.67, 0]}>
          <coneGeometry args={[0.08, 0.2, 8]} />
          <meshBasicMaterial color="#00ff88" />
        </mesh>
      </group>

      {/* Spacecraft traveling on curve */}
      <group ref={satRef}>
        <SatelliteModel scale={0.15} />
      </group>
    </group>
  );
}

// Precision Orbital Satellite with Live Kinematic Vectors
function PrecisionOrbitSatellite({ altitudeKm = 650, missionDay = 0 }: { altitudeKm?: number; missionDay?: number }) {
  const satGroupRef = useRef<THREE.Group>(null);
  const velocityVectorRef = useRef<THREE.ArrowHelper>(null);
  const gravityVectorRef = useRef<THREE.ArrowHelper>(null);
  const angle = useRef(missionDay * 15);

  const EARTH_RADIUS = 2;
  const SCALE = EARTH_RADIUS / 6371;
  const orbitRadius = EARTH_RADIUS + altitudeKm * SCALE * 8;

  useFrame((_, delta) => {
    angle.current += delta * 0.6;
    const currentAngle = angle.current;

    const x = Math.cos(currentAngle) * orbitRadius;
    const y = Math.sin(currentAngle * 0.4) * orbitRadius * 0.15;
    const z = Math.sin(currentAngle) * orbitRadius;

    if (satGroupRef.current) {
      satGroupRef.current.position.set(x, y, z);
    }
  });

  return (
    <group ref={satGroupRef}>
      <SatelliteModel scale={0.4} />
      {/* Velocity Vector (Tangential Arrow in Cyan) */}
      <mesh position={[0, 0, 0.3]}>
        <cylinderGeometry args={[0.015, 0.015, 0.4, 8]} />
        <meshBasicMaterial color="#00d4ff" />
      </mesh>
      {/* Gravity Vector (Centripetal Arrow towards Earth in Crimson) */}
      <mesh position={[-0.2, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.015, 0.015, 0.35, 8]} />
        <meshBasicMaterial color="#ff2d55" />
      </mesh>
    </group>
  );
}

export function OrbitScreen() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const orbitTrail = useMissionStore((s) => s.orbitTrail);
  const missionDay = useMissionStore((s) => s.missionDay);
  const config = useMissionStore((s) => s.config);
  const [showAtmosphereGuide, setShowAtmosphereGuide] = useState(true);

  const isHumanLunar = config?.type === 'human' || config?.destination === 'lunar-surface' || config?.destination === 'lunar-orbit';

  const altitude = telemetry?.orbit.altitudeKm ?? 650;
  const velocity = telemetry?.orbit.velocityKms ?? 7.53;
  const acceleration = telemetry?.orbit.accelerationMs2 ?? 8.09;
  const gForce = telemetry?.orbit.gForce ?? 0.825;
  const trueAnomaly = telemetry?.orbit.trueAnomalyDeg ?? 45.0;
  const layer = telemetry?.orbit.atmosphericLayer ?? 'Exosphere';
  const density = telemetry?.orbit.atmosphericDensityKgM3 ?? 1.4e-13;
  const drag = telemetry?.orbit.atmosphericDragN ?? 0.0004;

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#020409', paddingBottom: 56, position: 'relative' }}>
      {/* 3D Simulation Canvas */}
      <div style={{ flex: 1, position: 'relative' }}>
        <Canvas gl={{ antialias: true }} dpr={[1, 2]} camera={{ position: [0, 4, 10], fov: 45 }}>
          <PerspectiveCamera makeDefault position={isHumanLunar ? [3, 4, 11] : [0, 3.5, 9]} fov={45} />
          <ambientLight intensity={0.25} />
          <directionalLight position={[5, 4, 5]} intensity={1.2} color="#fff5e8" />
          <StarField />
          <Earth radius={2} />
          <EarthAtmosphericShells />

          {isHumanLunar ? (
            <CislunarTrajectory />
          ) : (
            <>
              <OrbitLine radius={2 + altitude * (2 / 6371) * 8} inclination={telemetry?.orbit.inclinationDeg ?? 51.6} color="#00d4ff" />
              <PrecisionOrbitSatellite altitudeKm={altitude} missionDay={missionDay} />
              <GroundTrack points={orbitTrail} />
            </>
          )}

          <OrbitControls enablePan={true} minDistance={3} maxDistance={25} autoRotate autoRotateSpeed={0.12} />
        </Canvas>

        {/* Top-Left: Precision Keplerian Kinematics HUD */}
        <div style={{ position: 'absolute', top: 20, left: 20, zIndex: 10, maxWidth: 360 }}>
          <div style={{
            background: 'rgba(5,15,30,0.94)', border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 12, padding: '18px 20px', backdropFilter: 'blur(14px)',
            boxShadow: '0 0 30px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.15em' }}>
                ORBITAL MECHANICS &amp; FLIGHT DYNAMICS
              </span>
              <span style={{
                fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 6px',
                background: 'rgba(0,255,136,0.12)', border: '1px solid #00ff88',
                borderRadius: 3, color: '#00ff88',
              }}>
                KEPLERIAN ACCURATE
              </span>
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#fff', marginBottom: 8 }}>
              {isHumanLunar ? 'CISLUNAR TRANSIT TRAJECTORY' : `${config?.name ?? 'SPACECRAFT'} ORBIT`}
            </div>

            {/* Live Kinematic Metrics Grid */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, marginBottom: 12 }}>
              {[
                { label: 'ALTITUDE (h)', value: `${altitude.toFixed(1)} km`, color: '#00d4ff' },
                { label: 'ORBITAL SPEED (v)', value: `${velocity.toFixed(3)} km/s`, color: '#00ff88' },
                { label: 'GRAV. ACCEL (ag)', value: `${acceleration.toFixed(2)} m/s²`, color: '#ff8c00' },
                { label: 'EFFECTIVE G-FORCE', value: `${gForce.toFixed(3)} g`, color: '#fff' },
                { label: 'TRUE ANOMALY (θ)', value: `${trueAnomaly.toFixed(1)}°`, color: '#00d4ff' },
                { label: 'ORBITAL PERIOD (T)', value: `${(telemetry?.orbit.periodMin ?? 97.7).toFixed(1)} min`, color: '#fff' },
              ].map(({ label, value, color }) => (
                <div key={label} style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color }}>{value}</div>
                </div>
              ))}
            </div>

            {/* Vector Legend */}
            <div style={{ display: 'flex', gap: 12, padding: '6px 10px', background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00d4ff' }}>
                <span style={{ width: 8, height: 2, background: '#00d4ff' }} /> Velocity Vector (v⃗)
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: '#ff2d55' }}>
                <span style={{ width: 8, height: 2, background: '#ff2d55' }} /> Gravitational Pull (a⃗g)
              </div>
            </div>
          </div>
        </div>

        {/* Top-Right: Atmospheric Layers & Deployment Escape Ladder */}
        <div style={{ position: 'absolute', top: 20, right: 20, zIndex: 10, width: 340 }}>
          <div style={{
            background: 'rgba(5,15,30,0.94)', border: '1px solid rgba(0,212,255,0.25)',
            borderRadius: 12, padding: '18px 20px', backdropFilter: 'blur(14px)',
            boxShadow: '0 0 30px rgba(0,0,0,0.6)',
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00d4ff', letterSpacing: '0.15em' }}>
                EARTH ATMOSPHERIC LAYERS
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
                ASCENT ESCAPE PROFILE
              </span>
            </div>

            {/* Atmospheric Layers Breakdown */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 4, marginBottom: 12 }}>
              {[
                { name: 'EXOSPHERE', alt: '> 600 km', color: '#00d4ff', desc: 'Geocorona · Satellite Operating Orbit', active: layer === 'Exosphere' },
                { name: 'THERMOSPHERE', alt: '85 – 600 km', color: '#00ff88', desc: 'Kármán Line (100 km) · Space Boundary', active: layer === 'Thermosphere' },
                { name: 'MESOSPHERE', alt: '50 – 85 km', color: '#38bdf8', desc: 'Coldest Layer (-90°C) · Meteor Ablation', active: layer === 'Mesosphere' },
                { name: 'STRATOSPHERE', alt: '12 – 50 km', color: '#818cf8', desc: 'Ozone Layer · Supersonic Flight', active: layer === 'Stratosphere' },
                { name: 'TROPOSPHERE', alt: '0 – 12 km', color: '#60a5fa', desc: 'Dense Air · Planetary Weather Envelope', active: layer === 'Troposphere' },
              ].map((l) => (
                <div
                  key={l.name}
                  style={{
                    padding: '6px 10px',
                    background: l.active ? 'rgba(0,212,255,0.18)' : 'rgba(0,0,0,0.25)',
                    border: `1px solid ${l.active ? l.color : 'rgba(255,255,255,0.05)'}`,
                    borderRadius: 6,
                    display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                  }}
                >
                  <div>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 10, fontWeight: 700, color: l.color }}>{l.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>({l.alt})</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.6)', marginTop: 1 }}>{l.desc}</div>
                  </div>
                  {l.active && (
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 7.5, padding: '2px 5px',
                      background: `${l.color}25`, border: `1px solid ${l.color}`,
                      borderRadius: 3, color: l.color, fontWeight: 700,
                    }}>
                      CRAFT HERE
                    </span>
                  )}
                </div>
              ))}
            </div>

            {/* Current Atmospheric Parameters */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 6 }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>AIR DENSITY (ρ)</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fff' }}>{density.toExponential(2)} kg/m³</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)' }}>DYNAMIC DRAG</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#00ff88' }}>{drag < 0.001 ? '< 0.001 N' : `${drag.toFixed(3)} N`}</div>
              </div>
            </div>
          </div>
        </div>

        {/* Bottom Status Bar */}
        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)', fontSize: 9.5, letterSpacing: '0.12em',
          color: 'rgba(255,255,255,0.4)', textAlign: 'center', background: 'rgba(5,15,30,0.85)',
          padding: '6px 16px', borderRadius: 20, border: '1px solid rgba(0,212,255,0.15)',
        }}>
          REAL-TIME KEPLERIAN KINEMATICS · ATMOSPHERIC ESCAPE VISUALIZATION · DRAG ORBIT TO INSPECT
        </div>
      </div>
    </div>
  );
}
