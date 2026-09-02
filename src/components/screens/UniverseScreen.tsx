import { useRef, useState, useMemo, useEffect } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { OrbitControls, Stars, Billboard } from '@react-three/drei';
import * as THREE from 'three';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { CelestialTextures } from '../three/CelestialTextures';
import { Earth } from '../three/SpaceScene';
import { SatelliteModel, OrbitLine } from '../three/SatelliteScene';
import { DynamicSpacecraftModel } from '../three/DynamicSpacecraftModel';
import { backendWS, BACKEND_API_URL } from '../../services/BackendWebSocketService';

// ==========================================
// CELESTIAL DATA SPECIFICATIONS
// ==========================================
export interface CelestialBodyData {
  id: string;
  name: string;
  category: 'star' | 'terrestrial' | 'gas_giant' | 'ice_giant' | 'satellite' | 'anomaly' | 'belt' | 'dwarf_planet';
  radius: number;
  viewRadius?: number; // Distance camera should maintain
  orbitDistance: number;
  orbitSpeed: number;
  rotationSpeed: number;
  axialTilt: number;
  color: string;
  emissive?: string;
  hasRings?: boolean;
  moons?: { name: string; radius: number; distance: number; speed: number; color: string }[];
  info: {
    diameterKm: string;
    distanceSunKm: string;
    orbitPeriod: string;
    surfaceTemp: string;
    atmosphere: string;
    gravity: string;
    description: string;
    missions: string;
  };
}

const CELESTIAL_DATA: Record<string, CelestialBodyData> = {
  sun: {
    id: 'sun',
    name: 'The Sun (Sol)',
    category: 'star',
    radius: 16,
    viewRadius: 30,
    orbitDistance: 0,
    orbitSpeed: 0,
    rotationSpeed: 0.0015,
    axialTilt: 7.25,
    color: '#ffc844',
    emissive: '#ff9900',
    info: {
      diameterKm: '1,392,700 km (109 × Earth)',
      distanceSunKm: '0 km (Center)',
      orbitPeriod: '230 Million Years (Galactic)',
      surfaceTemp: '5,500°C (Core 15M°C)',
      atmosphere: '73% H, 25% He Plasma',
      gravity: '274.0 m/s² (28g)',
      description: 'G2V yellow dwarf star providing gravitational balance and radiant energy across the solar system.',
      missions: 'Aditya-L1, Parker Solar Probe, SOHO, SDO'
    }
  },
  mercury: {
    id: 'mercury',
    name: 'Mercury',
    category: 'terrestrial',
    radius: 1.2,
    viewRadius: 4,
    orbitDistance: 36,
    orbitSpeed: 0.45,
    rotationSpeed: 0.005,
    axialTilt: 0.03,
    color: '#a8a8a8',
    info: {
      diameterKm: '4,879 km (0.38 × Earth)',
      distanceSunKm: '57.9 Million km (0.39 AU)',
      orbitPeriod: '88 Earth Days',
      surfaceTemp: '-180°C to 430°C',
      atmosphere: 'Trace (O2, Na, H2, He)',
      gravity: '3.7 m/s² (0.38g)',
      description: 'Innermost planet of the solar system with extreme diurnal temperature variations and ancient impact craters.',
      missions: 'MESSENGER, BepiColombo, Mariner 10'
    }
  },
  venus: {
    id: 'venus',
    name: 'Venus',
    category: 'terrestrial',
    radius: 2.2,
    viewRadius: 6,
    orbitDistance: 54,
    orbitSpeed: 0.35,
    rotationSpeed: -0.002,
    axialTilt: 177.3,
    color: '#e2c088',
    info: {
      diameterKm: '12,104 km (0.95 × Earth)',
      distanceSunKm: '108.2 Million km (0.72 AU)',
      orbitPeriod: '224.7 Earth Days',
      surfaceTemp: '465°C (Hottest Planet)',
      atmosphere: '96.5% CO2, 3.5% N2, H2SO4 Clouds',
      gravity: '8.87 m/s² (0.90g)',
      description: 'Enveloped in dense sulfuric clouds creating an intense runaway greenhouse climate.',
      missions: 'Shukrayaan-1, Akatsuki, Magellan, Venera'
    }
  },
  earth: {
    id: 'earth',
    name: 'Earth (Terra)',
    category: 'terrestrial',
    radius: 2.4,
    viewRadius: 7,
    orbitDistance: 78,
    orbitSpeed: 0.28,
    rotationSpeed: 0.02,
    axialTilt: 23.44,
    color: '#2a75d3',
    moons: [{ name: 'Moon (Luna)', radius: 0.65, distance: 6.2, speed: 1.2, color: '#c0c0c0' }],
    info: {
      diameterKm: '12,742 km (1.0 × Earth)',
      distanceSunKm: '149.6 Million km (1.0 AU)',
      orbitPeriod: '365.25 Earth Days',
      surfaceTemp: '-89°C to 58°C (Mean 15°C)',
      atmosphere: '78% N2, 21% O2, 1% Ar/CO2',
      gravity: '9.81 m/s² (1.0g)',
      description: 'The blue marble. Home to humanity with liquid surface oceans and a dynamic protective magnetosphere.',
      missions: 'Gaganyaan, Chandrayaan, ISS, Hubble, Sentinel'
    }
  },
  mars: {
    id: 'mars',
    name: 'Mars (Ares)',
    category: 'terrestrial',
    radius: 1.5,
    viewRadius: 5,
    orbitDistance: 108,
    orbitSpeed: 0.22,
    rotationSpeed: 0.018,
    axialTilt: 25.19,
    color: '#c85a28',
    moons: [
      { name: 'Phobos', radius: 0.25, distance: 3.5, speed: 2.2, color: '#888' },
      { name: 'Deimos', radius: 0.18, distance: 5.2, speed: 1.4, color: '#999' }
    ],
    info: {
      diameterKm: '6,779 km (0.53 × Earth)',
      distanceSunKm: '227.9 Million km (1.52 AU)',
      orbitPeriod: '687 Earth Days (1.88 yr)',
      surfaceTemp: '-140°C to 20°C (Mean -63°C)',
      atmosphere: '95.3% CO2, 2.6% N2, 1.9% Ar',
      gravity: '3.72 m/s² (0.38g)',
      description: 'The Red Planet. Features giant shield volcanoes, expansive canyon rifts, and polar water-ice caps.',
      missions: 'Mangalyaan (MOM), Perseverance, Curiosity, Hope'
    }
  },
  asteroid_belt: {
    id: 'asteroid_belt',
    name: 'Asteroid Belt (Ceres)',
    category: 'dwarf_planet',
    radius: 1.1,
    viewRadius: 6,
    orbitDistance: 142,
    orbitSpeed: 0.18,
    rotationSpeed: 0.03,
    axialTilt: 4,
    color: '#8b8b83',
    info: {
      diameterKm: 'Ceres: 940 km · Belt: 150 Million km Wide',
      distanceSunKm: '414 Million km (2.77 AU)',
      orbitPeriod: '4.6 Earth Years (1,682 Days)',
      surfaceTemp: '-106°C to -38°C',
      atmosphere: 'Trace Water Vapor / Exosphere',
      gravity: '0.28 m/s² (0.029g)',
      description: 'Dwarf planet Ceres and hundreds of thousands of tumbling asteroids between Mars and Jupiter.',
      missions: 'Dawn (Ceres/Vesta Orbiter), Lucy, OSIRIS-REx, Psyche'
    }
  },
  jupiter: {
    id: 'jupiter',
    name: 'Jupiter (Jove)',
    category: 'gas_giant',
    radius: 7.2,
    viewRadius: 18,
    orbitDistance: 178,
    orbitSpeed: 0.12,
    rotationSpeed: 0.04,
    axialTilt: 3.13,
    color: '#d4a373',
    moons: [
      { name: 'Io', radius: 0.5, distance: 11, speed: 2.4, color: '#d4af37' },
      { name: 'Europa', radius: 0.45, distance: 14, speed: 1.8, color: '#b0c4de' },
      { name: 'Ganymede', radius: 0.7, distance: 18, speed: 1.2, color: '#8b8b83' },
      { name: 'Callisto', radius: 0.65, distance: 23, speed: 0.8, color: '#555555' }
    ],
    info: {
      diameterKm: '139,820 km (11.0 × Earth)',
      distanceSunKm: '778.5 Million km (5.20 AU)',
      orbitPeriod: '11.86 Earth Years',
      surfaceTemp: '-110°C (Cloud top)',
      atmosphere: '89.8% H2, 10.2% He, CH4/NH3',
      gravity: '24.79 m/s² (2.53g)',
      description: 'Massive gas giant with counter-rotating atmospheric jet streams and the centuries-old Great Red Spot storm vortex.',
      missions: 'Juno, JUICE, Europa Clipper, Galileo, Voyager'
    }
  },
  saturn: {
    id: 'saturn',
    name: 'Saturn (Cronus)',
    category: 'gas_giant',
    radius: 6.0,
    viewRadius: 16,
    orbitDistance: 235,
    orbitSpeed: 0.09,
    rotationSpeed: 0.038,
    axialTilt: 26.73,
    color: '#e6d3a3',
    hasRings: true,
    moons: [
      { name: 'Titan', radius: 0.75, distance: 16, speed: 1.5, color: '#d2b48c' },
      { name: 'Enceladus', radius: 0.35, distance: 11, speed: 2.1, color: '#ffffff' }
    ],
    info: {
      diameterKm: '116,460 km (9.1 × Earth)',
      distanceSunKm: '1.43 Billion km (9.58 AU)',
      orbitPeriod: '29.45 Earth Years',
      surfaceTemp: '-140°C (Cloud top)',
      atmosphere: '96.3% H2, 3.25% He, CH4',
      gravity: '10.44 m/s² (1.06g)',
      description: 'Distinguished by a breathtaking planetary ring system of sparkling ice chunks and complex shepherd moons.',
      missions: 'Cassini-Huygens, Dragonfly, Pioneer 11, Voyager'
    }
  },
  uranus: {
    id: 'uranus',
    name: 'Uranus (Caelus)',
    category: 'ice_giant',
    radius: 4.0,
    viewRadius: 11,
    orbitDistance: 288,
    orbitSpeed: 0.06,
    rotationSpeed: -0.025,
    axialTilt: 97.77,
    color: '#70d6ff',
    hasRings: true,
    info: {
      diameterKm: '50,724 km (4.0 × Earth)',
      distanceSunKm: '2.87 Billion km (19.2 AU)',
      orbitPeriod: '84.0 Earth Years',
      surfaceTemp: '-195°C (Atmospheric min -224°C)',
      atmosphere: '82.5% H2, 15.2% He, 2.3% Methane',
      gravity: '8.69 m/s² (0.89g)',
      description: 'Aquamarine ice giant tilted 98° on its side, experiencing dramatic 21-year seasonal cycles.',
      missions: 'Voyager 2, Uranus Orbiter and Probe (Proposed)'
    }
  },
  neptune: {
    id: 'neptune',
    name: 'Neptune (Poseidon)',
    category: 'ice_giant',
    radius: 3.8,
    viewRadius: 10,
    orbitDistance: 340,
    orbitSpeed: 0.045,
    rotationSpeed: 0.028,
    axialTilt: 28.32,
    color: '#3a86ff',
    moons: [{ name: 'Triton', radius: 0.55, distance: 10, speed: 1.4, color: '#d8bfd8' }],
    info: {
      diameterKm: '49,244 km (3.86 × Earth)',
      distanceSunKm: '4.50 Billion km (30.1 AU)',
      orbitPeriod: '164.8 Earth Years',
      surfaceTemp: '-201°C (Cloud top)',
      atmosphere: '80% H2, 19% He, 1.5% Methane',
      gravity: '11.15 m/s² (1.14g)',
      description: 'Vivid blue world with the fastest supersonic winds in the solar system exceeding 2,100 km/h.',
      missions: 'Voyager 2, Neptune Odyssey (Concept)'
    }
  },
  wormhole: {
    id: 'wormhole',
    name: 'Gargantua Singularity',
    category: 'anomaly',
    radius: 9,
    viewRadius: 24,
    orbitDistance: 480,
    orbitSpeed: 0.01,
    rotationSpeed: 0.06,
    axialTilt: 45,
    color: '#9b5de5',
    emissive: '#bf5af2',
    info: {
      diameterKm: 'Event Horizon: 48,000 km',
      distanceSunKm: '72.0 Billion km (Interstellar Edge)',
      orbitPeriod: 'Hyperbolic Trajectory',
      surfaceTemp: 'Relativistic Plasma Accretion',
      atmosphere: 'Extreme Spacetime Curvature',
      gravity: '> 10^12 g at Photon Sphere',
      description: 'A luminous Einstein-Rosen bridge anomaly warping light and matter through a swirling accretion disk.',
      missions: 'VYOM Deep Space Telemetry Link'
    }
  },
  satellite: {
    id: 'satellite',
    name: 'VYOM Spacecraft Digital Twin',
    category: 'satellite',
    radius: 0.8,
    viewRadius: 3.5,
    orbitDistance: 78,
    orbitSpeed: 1.5,
    rotationSpeed: 0.05,
    axialTilt: 51.6,
    color: '#00d4ff',
    info: {
      diameterKm: 'Wingspan 4.2 m · Mass 420 kg',
      distanceSunKm: '149.6 Million km (Low Earth Orbit)',
      orbitPeriod: '92.4 Minutes (15.6 orbits/day)',
      surfaceTemp: '-65°C to 125°C',
      atmosphere: 'Space Vacuum (Exosphere)',
      gravity: '8.7 m/s² (Microgravity)',
      description: 'Active mission spacecraft with autonomous telemetry monitoring, high-efficiency solar arrays, and ion propulsion.',
      missions: 'Current Active Mission Telemetry Link'
    }
  }
};

// ==========================================
// 3D SCENE OBJECTS
// ==========================================

// Satisfying, Soft, Realistic Sun (No harsh blinding radiation)
function SunObject({ onSelect, isTarget }: { onSelect: () => void; isTarget: boolean }) {
  const sunRef = useRef<THREE.Mesh>(null);
  const auraRef = useRef<THREE.Mesh>(null);
  const sunTexture = useMemo(() => CelestialTextures.getSunTexture(), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (sunRef.current) sunRef.current.rotation.y = t * 0.003;
    if (auraRef.current) {
      auraRef.current.rotation.z = -t * 0.005;
      const s = 1.02 + Math.sin(t * 0.8) * 0.015;
      auraRef.current.scale.set(s, s, s);
    }
  });

  return (
    <group onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Sun Sphere */}
      <mesh ref={sunRef}>
        <sphereGeometry args={[16, 64, 64]} />
        <meshBasicMaterial map={sunTexture} color="#ffdd77" />
        {/* Soft, natural lighting */}
        <pointLight intensity={2.2} distance={1500} decay={2.0} color="#fff8f0" />
      </mesh>

      {/* Gentle, soothing atmospheric rim aura */}
      <mesh ref={auraRef}>
        <sphereGeometry args={[17.2, 48, 48]} />
        <meshBasicMaterial color="#ffaa22" transparent opacity={0.18} side={THREE.BackSide} depthWrite={false} />
      </mesh>

      {/* Soft selection ring */}
      {isTarget && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[20, 20.8, 64]} />
          <meshBasicMaterial color="#00d4ff" side={THREE.DoubleSide} transparent opacity={0.7} />
        </mesh>
      )}
    </group>
  );
}

// Procedural Planet Component
function PlanetObject({
  data,
  simTime,
  showOrbits,
  onSelect,
  isTarget,
  onPositionUpdate,
}: {
  data: CelestialBodyData;
  simTime: number;
  showOrbits: boolean;
  onSelect: () => void;
  isTarget: boolean;
  onPositionUpdate: (pos: THREE.Vector3) => void;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const meshRef = useRef<THREE.Mesh>(null);
  const posVec = useMemo(() => new THREE.Vector3(), []);

  const texture = useMemo(() => {
    switch (data.id) {
      case 'mercury': return CelestialTextures.getMercuryTexture();
      case 'venus': return CelestialTextures.getVenusTexture();
      case 'mars': return CelestialTextures.getMarsTexture();
      case 'jupiter': return CelestialTextures.getJupiterTexture();
      case 'saturn': return CelestialTextures.getSaturnTexture();
      case 'uranus': return CelestialTextures.getUranusTexture();
      case 'neptune': return CelestialTextures.getNeptuneTexture();
      default: return null;
    }
  }, [data.id]);

  const ringTexture = useMemo(() => {
    return data.id === 'saturn' ? CelestialTextures.getSaturnRingTexture() : null;
  }, [data.id]);

  useFrame(() => {
    if (!groupRef.current) return;
    const angle = simTime * data.orbitSpeed * 0.08;
    const x = Math.cos(angle) * data.orbitDistance;
    const z = Math.sin(angle) * data.orbitDistance;

    groupRef.current.position.set(x, 0, z);
    posVec.set(x, 0, z);

    if (meshRef.current) {
      meshRef.current.rotation.y += data.rotationSpeed;
    }

    if (isTarget) {
      onPositionUpdate(posVec);
    }
  });

  return (
    <>
      {/* Orbit Track Line */}
      {showOrbits && data.orbitDistance > 0 && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[data.orbitDistance - 0.15, data.orbitDistance + 0.15, 128]} />
          <meshBasicMaterial color="rgba(0,212,255,0.18)" transparent opacity={0.22} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* Planet Group */}
      <group ref={groupRef} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        {/* Selection Indicator Ring */}
        {isTarget && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[data.radius * 1.45, data.radius * 1.55, 64]} />
            <meshBasicMaterial color="#00d4ff" side={THREE.DoubleSide} transparent opacity={0.8} />
          </mesh>
        )}

        {/* Planet Mesh */}
        <group rotation={[(data.axialTilt * Math.PI) / 180, 0, 0]}>
          {data.id === 'earth' ? (
            <Earth radius={data.radius} />
          ) : (
            <mesh ref={meshRef}>
              <sphereGeometry args={[data.radius, 64, 64]} />
              <meshStandardMaterial
                map={texture ?? undefined}
                color={texture ? '#ffffff' : data.color}
                roughness={0.65}
                metalness={0.1}
              />
            </mesh>
          )}

          {/* Saturn Rings */}
          {data.hasRings && data.id === 'saturn' && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[data.radius * 1.35, data.radius * 2.5, 64]} />
              <meshStandardMaterial
                map={ringTexture ?? undefined}
                side={THREE.DoubleSide}
                transparent
                opacity={0.9}
                roughness={0.4}
              />
            </mesh>
          )}

          {/* Uranus Rings */}
          {data.hasRings && data.id === 'uranus' && (
            <mesh rotation={[Math.PI / 2, 0, 0]}>
              <ringGeometry args={[data.radius * 1.3, data.radius * 1.6, 64]} />
              <meshBasicMaterial color="#a0f4ff" side={THREE.DoubleSide} transparent opacity={0.25} />
            </mesh>
          )}
        </group>

        {/* Moons */}
        {data.moons?.map((moon) => (
          <MoonObject key={moon.name} moon={moon} simTime={simTime} parentRadius={data.radius} />
        ))}
      </group>
    </>
  );
}

// Moon Component
function MoonObject({
  moon,
  simTime,
  parentRadius,
}: {
  moon: { name: string; radius: number; distance: number; speed: number; color: string };
  simTime: number;
  parentRadius: number;
}) {
  const moonRef = useRef<THREE.Mesh>(null);
  const moonTex = useMemo(() => CelestialTextures.getMoonTexture(), []);

  useFrame(() => {
    if (!moonRef.current) return;
    const angle = simTime * moon.speed * 0.2;
    const dist = parentRadius + moon.distance;
    moonRef.current.position.set(Math.cos(angle) * dist, Math.sin(angle * 0.5) * 0.4, Math.sin(angle) * dist);
    moonRef.current.rotation.y += 0.01;
  });

  return (
    <mesh ref={moonRef}>
      <sphereGeometry args={[moon.radius, 32, 32]} />
      <meshStandardMaterial map={moonTex} color={moon.color} roughness={0.8} />
    </mesh>
  );
}

// Satisfying Asteroid Belt with Ceres Focal Body
function AsteroidBeltField({
  simTime,
  showOrbits,
  onSelect,
  isTarget,
  onPositionUpdate,
}: {
  simTime: number;
  showOrbits: boolean;
  onSelect: () => void;
  isTarget: boolean;
  onPositionUpdate: (pos: THREE.Vector3) => void;
}) {
  const count = 400;
  const meshRef = useRef<THREE.InstancedMesh>(null);
  const ceresGroupRef = useRef<THREE.Group>(null);
  const dummy = useMemo(() => new THREE.Object3D(), []);
  const ceresTex = useMemo(() => CelestialTextures.getMercuryTexture(), []);
  const posVec = useMemo(() => new THREE.Vector3(), []);

  const asteroidData = useMemo(() => {
    return Array.from({ length: count }, () => {
      const dist = 132 + Math.random() * 22;
      const angle = Math.random() * Math.PI * 2;
      const y = (Math.random() - 0.5) * 5;
      const speed = 0.018 + Math.random() * 0.025;
      const scale = 0.2 + Math.random() * 0.7;
      const rotSpeed = (Math.random() - 0.5) * 0.04;
      return { dist, angle, y, speed, scale, rotSpeed };
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();

    // Animate Ceres focal point in asteroid belt
    if (ceresGroupRef.current) {
      const ceresAngle = simTime * 0.18 * 0.08;
      const cx = Math.cos(ceresAngle) * 142;
      const cz = Math.sin(ceresAngle) * 142;
      ceresGroupRef.current.position.set(cx, 0, cz);
      posVec.set(cx, 0, cz);

      if (isTarget) {
        onPositionUpdate(posVec);
      }
    }

    if (!meshRef.current) return;
    asteroidData.forEach((ast, i) => {
      const currentAngle = ast.angle + t * ast.speed;
      dummy.position.set(Math.cos(currentAngle) * ast.dist, ast.y, Math.sin(currentAngle) * ast.dist);
      dummy.rotation.set(t * ast.rotSpeed, t * ast.rotSpeed * 1.4, t * ast.rotSpeed * 0.7);
      dummy.scale.set(ast.scale, ast.scale * 0.85, ast.scale * 1.15);
      dummy.updateMatrix();
      meshRef.current!.setMatrixAt(i, dummy.matrix);
    });
    meshRef.current.instanceMatrix.needsUpdate = true;
  });

  return (
    <>
      {/* Belt Orbit Guide */}
      {showOrbits && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[130, 154, 128]} />
          <meshBasicMaterial color="rgba(140,160,180,0.12)" transparent opacity={0.15} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* Instanced Asteroids */}
      <instancedMesh
        ref={meshRef}
        args={[undefined, undefined, count]}
        onClick={(e) => { e.stopPropagation(); onSelect(); }}
      >
        <dodecahedronGeometry args={[1, 1]} />
        <meshStandardMaterial color="#7a7a74" roughness={0.85} metalness={0.2} />
      </instancedMesh>

      {/* Dwarf Planet Ceres Focal Center */}
      <group ref={ceresGroupRef} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <mesh>
          <sphereGeometry args={[1.1, 32, 32]} />
          <meshStandardMaterial map={ceresTex} color="#999990" roughness={0.9} />
        </mesh>

        {/* Occator Crater Reflective Salt Spot */}
        <mesh position={[0.7, 0.4, 0.7]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshBasicMaterial color="#ffffff" />
        </mesh>

        {/* Selection Indicator */}
        {isTarget && (
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[1.8, 1.95, 48]} />
            <meshBasicMaterial color="#00d4ff" side={THREE.DoubleSide} transparent opacity={0.85} />
          </mesh>
        )}
      </group>
    </>
  );
}

// Deep Space Wormhole Anomaly
function WormholeObject({
  position,
  onSelect,
  isTarget,
  onPositionUpdate,
}: {
  position: [number, number, number];
  onSelect: () => void;
  isTarget: boolean;
  onPositionUpdate: (pos: THREE.Vector3) => void;
}) {
  const diskRef = useRef<THREE.Mesh>(null);
  const jetRef = useRef<THREE.Group>(null);
  const diskTexture = useMemo(() => CelestialTextures.getAccretionDiskTexture(), []);
  const posVec = useMemo(() => new THREE.Vector3(...position), [position]);

  useEffect(() => {
    if (isTarget) {
      onPositionUpdate(posVec);
    }
  }, [isTarget, onPositionUpdate, posVec]);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (diskRef.current) diskRef.current.rotation.z = -t * 0.35;
    if (jetRef.current) {
      const s = 1.0 + Math.sin(t * 3) * 0.08;
      jetRef.current.scale.set(1, s, 1);
    }
  });

  return (
    <group position={position} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
      {/* Event Horizon (Black Void) */}
      <mesh>
        <sphereGeometry args={[6.5, 64, 64]} />
        <meshBasicMaterial color="#000000" />
      </mesh>

      {/* Relativistic Photon Ring Sphere */}
      <mesh>
        <sphereGeometry args={[6.9, 32, 32]} />
        <meshBasicMaterial color="#9b5de5" transparent opacity={0.25} wireframe side={THREE.DoubleSide} />
      </mesh>

      {/* Swirling Relativistic Accretion Disk */}
      <mesh ref={diskRef} rotation={[Math.PI / 2.8, 0, 0]}>
        <planeGeometry args={[42, 42]} />
        <meshBasicMaterial
          map={diskTexture}
          side={THREE.DoubleSide}
          transparent
          blending={THREE.AdditiveBlending}
          depthWrite={false}
        />
      </mesh>

      {/* Soft Bipolar Plasma Jets */}
      <group ref={jetRef}>
        {[-1, 1].map((dir) => (
          <group key={dir} position={[0, dir * 18, 0]} rotation={[dir === 1 ? 0 : Math.PI, 0, 0]}>
            <mesh>
              <cylinderGeometry args={[0.15, 2.0, 30, 16]} />
              <meshBasicMaterial color="#bf5af2" transparent opacity={0.45} blending={THREE.AdditiveBlending} depthWrite={false} />
            </mesh>
            <pointLight color="#bf5af2" intensity={1.2} distance={60} />
          </group>
        ))}
      </group>

      {/* Selection Ring */}
      {isTarget && (
        <mesh rotation={[Math.PI / 2, 0, 0]}>
          <ringGeometry args={[14, 15, 64]} />
          <meshBasicMaterial color="#00d4ff" side={THREE.DoubleSide} transparent opacity={0.8} />
        </mesh>
      )}
    </group>
  );
}

// Live Mission Spacecraft Satellite inside Universe
function UniverseSatellite({
  earthPos,
  simTime,
  onSelect,
  isTarget,
  onPositionUpdate,
}: {
  earthPos: THREE.Vector3;
  simTime: number;
  onSelect: () => void;
  isTarget: boolean;
  onPositionUpdate: (pos: THREE.Vector3) => void;
}) {
  const satGroupRef = useRef<THREE.Group>(null);
  const telemetry = useMissionStore((s) => s.telemetry);
  const config = useMissionStore((s) => s.config);
  const orbitTrail = useMissionStore((s) => s.orbitTrail);
  const posVec = useMemo(() => new THREE.Vector3(), []);
  
  const isOrbitalObs = config?.type === 'orbital';
  const isAstrophysics = config?.type === 'astrophysics';
  const isPlanetary = config?.type === 'planetary';
  const isHuman = config?.type === 'human';

  const orbitRadius = isAstrophysics ? 6.0 : isPlanetary ? 5.2 : 4.2;
  const incl = (telemetry?.orbit.inclinationDeg ?? 51.6) * (Math.PI / 180);

  useFrame(() => {
    if (!satGroupRef.current) return;
    const speed = isAstrophysics ? 0.8 : isPlanetary ? 1.2 : 1.8;
    const angle = simTime * speed * 0.4;

    const localX = Math.cos(angle) * orbitRadius;
    const localZ = Math.sin(angle) * orbitRadius * Math.cos(incl);
    const localY = Math.sin(angle) * orbitRadius * Math.sin(incl);

    const worldPos = posVec.set(earthPos.x + localX, earthPos.y + localY, earthPos.z + localZ);
    satGroupRef.current.position.copy(worldPos);

    if (isTarget) {
      onPositionUpdate(worldPos);
    }
  });

  return (
    <group>
      {/* Orbital Trajectory Layer */}
      <group position={earthPos} rotation={[incl, 0, 0]}>
         <mesh rotation={[Math.PI / 2, 0, 0]}>
           <ringGeometry args={[orbitRadius - 0.02, orbitRadius + 0.02, 128]} />
           <meshBasicMaterial color={isHuman ? '#00ff88' : isOrbitalObs ? '#00d4ff' : isPlanetary ? '#ff8c00' : '#bf5af2'} transparent opacity={0.4} side={THREE.DoubleSide} />
         </mesh>
      </group>
      
      <group ref={satGroupRef} onClick={(e) => { e.stopPropagation(); onSelect(); }}>
        <DynamicSpacecraftModel scale={0.45} interactive={isTarget} />

        {/* Orbital Observation: Ground Sensor Coverage Cone */}
        {isOrbitalObs && (
          <group position={[0, -0.6, 0]} rotation={[0, 0, 0]}>
            <mesh position={[0, -0.8, 0]}>
              <coneGeometry args={[0.9, 1.6, 16, 1, true]} />
              <meshBasicMaterial color="#00d4ff" transparent opacity={0.12} side={THREE.DoubleSide} depthWrite={false} />
            </mesh>
          </group>
        )}

        {/* Astrophysics: Deep Space Optical Axis Vector */}
        {isAstrophysics && (
          <group position={[0, 0, 0.8]} rotation={[0, 0, 0]}>
            <mesh position={[0, 0, 2.0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.01, 0.4, 4.0, 16]} />
              <meshBasicMaterial color="#bf5af2" transparent opacity={0.18} depthWrite={false} />
            </mesh>
          </group>
        )}

        {/* Planetary Probe: Cruise Velocity Vector */}
        {isPlanetary && (
          <group position={[0.4, 0, 0]}>
            <mesh position={[0.6, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.015, 0.015, 1.2, 8]} />
              <meshBasicMaterial color="#ff8c00" transparent opacity={0.6} />
            </mesh>
          </group>
        )}

        {/* Target Selection Marker */}
        {isTarget && (
          <mesh>
            <sphereGeometry args={[1.3, 16, 16]} />
            <meshBasicMaterial color="#00d4ff" wireframe transparent opacity={0.5} />
          </mesh>
        )}
      </group>
    </group>
  );
}

// ── v3.0 additive: Mission Trajectory Monitoring Layer ──────────────────────
// Renders the selected mission's planned/predicted trajectory around Earth in
// the existing Universe visualization. Purely additive: no existing animation,
// object, camera behavior or display is modified.
function MissionTrajectoryOverlay({ simTime, visible }: { simTime: number; visible: boolean }) {
  const config = useMissionStore((s) => s.config);
  const connected = backendWS.isConnected;
  const missionId = config?.id;
  const [traj, setTraj] = useState<any>(null);

  useEffect(() => {
    if (!visible || !connected || !missionId) { setTraj(null); return; }
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND_API_URL}/api/missions/${missionId}/trajectory`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (!cancelled) setTraj(d); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [visible, connected, missionId]);

  // Live Earth scene position (same formula as PlanetObject)
  const earthRef = useRef<THREE.Group>(null);
  useFrame(() => {
    if (!earthRef.current) return;
    const e = CELESTIAL_DATA.earth;
    const angle = simTime * e.orbitSpeed * 0.08;
    earthRef.current.position.set(Math.cos(angle) * e.orbitDistance, 0, Math.sin(angle) * e.orbitDistance);
  });

  const plannedLine = useMemo(() => {
    if (!traj) return null;
    const e = CELESTIAL_DATA.earth;
    const toScene = (p: any): THREE.Vector3 => {
      const r = e.radius * (1.15 + Math.min((p.alt_km ?? 400) / 6371, 3) * 2.2);
      const latR = ((p.lat ?? 0) * Math.PI) / 180;
      const lngR = ((p.lng ?? 0) * Math.PI) / 180;
      return new THREE.Vector3(
        r * Math.cos(latR) * Math.cos(lngR),
        r * Math.sin(latR),
        -r * Math.cos(latR) * Math.sin(lngR)
      );
    };
    const pts = (traj.planned_path ?? []).slice(0, 60).map(toScene);
    return pts.length > 1
      ? new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: '#00d4ff', transparent: true, opacity: 0.65 }))
      : null;
  }, [traj]);

  const futureLine = useMemo(() => {
    if (!traj) return null;
    const e = CELESTIAL_DATA.earth;
    const toScene = (p: any): THREE.Vector3 => {
      const r = e.radius * (1.15 + Math.min((p.alt_km ?? 400) / 6371, 3) * 2.2);
      const latR = ((p.lat ?? 0) * Math.PI) / 180;
      const lngR = ((p.lng ?? 0) * Math.PI) / 180;
      return new THREE.Vector3(
        r * Math.cos(latR) * Math.cos(lngR),
        r * Math.sin(latR),
        -r * Math.cos(latR) * Math.sin(lngR)
      );
    };
    const pts = (traj.predicted_future ?? []).map(toScene);
    return pts.length > 1
      ? new THREE.Line(new THREE.BufferGeometry().setFromPoints(pts),
          new THREE.LineBasicMaterial({ color: '#00ff88', transparent: true, opacity: 0.5 }))
      : null;
  }, [traj]);

  const maneuverPositions = useMemo(() => {
    if (!traj) return [];
    const e = CELESTIAL_DATA.earth;
    const toScene = (p: any): THREE.Vector3 => {
      const r = e.radius * (1.15 + Math.min((p.alt_km ?? 400) / 6371, 3) * 2.2);
      const latR = ((p.lat ?? 0) * Math.PI) / 180;
      const lngR = ((p.lng ?? 0) * Math.PI) / 180;
      return new THREE.Vector3(
        r * Math.cos(latR) * Math.cos(lngR),
        r * Math.sin(latR),
        -r * Math.cos(latR) * Math.sin(lngR)
      );
    };
    return ((traj.maneuver_points ?? []) as any[]).slice(0, 8).map(toScene);
  }, [traj]);

  if (!visible || !traj) return null;

  const e = CELESTIAL_DATA.earth;

  return (
    <group ref={earthRef}>
      {plannedLine && <primitive object={plannedLine} />}
      {futureLine && <primitive object={futureLine} />}
      {/* Maneuver points */}
      {maneuverPositions.map((p: THREE.Vector3, i: number) => (
        <mesh key={i} position={p}>
          <octahedronGeometry args={[e.radius * 0.09, 0]} />
          <meshBasicMaterial color="#ff8c00" />
        </mesh>
      ))}
    </group>
  );
}

// Camera Controller with Smooth Target Following
function CameraController({
  targetPos,
  targetRadius,
  viewRadius,
  isFreeCam,
  controlsRef,
  targetId,
}: {
  targetPos: THREE.Vector3;
  targetRadius: number;
  viewRadius?: number;
  isFreeCam: boolean;
  controlsRef: React.RefObject<any>;
  targetId: string;
}) {
  const { camera } = useThree();
  const desiredCamOffset = useMemo(() => new THREE.Vector3(), []);
  const prevTargetId = useRef(targetId);
  const isTransitioning = useRef(false);

  useEffect(() => {
    if (prevTargetId.current !== targetId) {
      isTransitioning.current = true;
      prevTargetId.current = targetId;
      // Reset transitioning flag after 2 seconds
      setTimeout(() => { isTransitioning.current = false; }, 2000);
    }
  }, [targetId]);

  useFrame(() => {
    if (!controlsRef.current) return;

    if (!isFreeCam) {
      // Smoothly update controls target to follow object position
      controlsRef.current.target.lerp(targetPos, 0.08);

      // Only auto-zoom if we recently switched targets, so we don't fight manual zoom
      if (isTransitioning.current) {
        const idealDist = viewRadius ?? Math.max(targetRadius * 3.2, 4.5);
        desiredCamOffset.copy(camera.position).sub(controlsRef.current.target).normalize().multiplyScalar(idealDist);
        camera.position.lerp(controlsRef.current.target.clone().add(desiredCamOffset), 0.06);
      }
    }
    // NOTE: do NOT call controls.update() here — drei's OrbitControls already
    // applies its damped update once per frame. Calling it twice double-applies
    // the damping factor, which made zooming feel unstable/jerky (the zoom glitch).
  });

  return null;
}

// ==========================================
// MAIN UNIVERSE SIMULATOR SCREEN
// ==========================================
export function UniverseScreen() {
  const [selectedId, setSelectedId] = useState<string>('earth');
  const [timeMultiplier, setTimeMultiplier] = useState<number>(1);
  const [showOrbits, setShowOrbits] = useState<boolean>(true);
  const [isFreeCam, setIsFreeCam] = useState<boolean>(false);
  const [simTime, setSimTime] = useState<number>(0);
  // v3.0 additive: mission trajectory monitoring layer toggle
  const [showTrajectoryLayer, setShowTrajectoryLayer] = useState<boolean>(false);

  const controlsRef = useRef<any>(null);
  const config = useMissionStore((s) => s.config);
  const telemetry = useMissionStore((s) => s.telemetry);

  const earthPos = useRef(new THREE.Vector3(78, 0, 0));
  const currentTargetPos = useRef(new THREE.Vector3(78, 0, 0));

  // Simulation time tick
  useEffect(() => {
    let animId: number;
    let lastTime = performance.now();
    const update = (now: number) => {
      const dt = (now - lastTime) / 1000;
      lastTime = now;
      setSimTime((prev) => prev + dt * timeMultiplier);
      animId = requestAnimationFrame(update);
    };
    animId = requestAnimationFrame(update);
    return () => cancelAnimationFrame(animId);
  }, [timeMultiplier]);

  const selectedData = CELESTIAL_DATA[selectedId] ?? CELESTIAL_DATA.earth;

  const handleSelect = (id: string) => {
    setSelectedId(id);
    setIsFreeCam(false);
    if (id === 'sun') {
      currentTargetPos.current.set(0, 0, 0);
    }
  };

  const handlePositionUpdate = (pos: THREE.Vector3) => {
    currentTargetPos.current.copy(pos);
  };

  return (
    <div style={{ width: '100%', height: '100%', position: 'relative', background: '#010308', overflow: 'hidden' }}>
      {/* 3D WEBGL UNIVERSE CANVAS */}
      <Canvas
        camera={{ position: [88, 14, 88], fov: 45, near: 0.5, far: 5000 }}
        gl={{
          antialias: true,
          powerPreference: 'high-performance',
          toneMapping: THREE.ACESFilmicToneMapping,
          toneMappingExposure: 1.15,
          logarithmicDepthBuffer: true,
        }}
        dpr={[1, 2]}
      >
        <ambientLight intensity={0.2} />

        {/* Deep Space Stars & Soothing Cosmic Background */}
        <Stars radius={1400} depth={400} count={16000} factor={5.5} saturation={0.25} fade speed={0.4} />

        {/* Serene Cosmic Nebula Cloud */}
        <mesh position={[0, 0, -800]}>
          <planeGeometry args={[3200, 3200]} />
          <meshBasicMaterial color="#120822" transparent opacity={0.35} depthWrite={false} />
        </mesh>

        {/* Orbit Controls */}
        <OrbitControls
          ref={controlsRef}
          enableDamping
          dampingFactor={0.08}
          maxDistance={2500}
          minDistance={1.2}
          rotateSpeed={0.8}
          zoomSpeed={1.2}
        />

        {/* Active Camera Target Follower */}
        <CameraController
          targetPos={currentTargetPos.current}
          targetRadius={selectedData.radius}
          viewRadius={selectedData.viewRadius}
          isFreeCam={isFreeCam}
          controlsRef={controlsRef}
          targetId={selectedId}
        />

        {/* 1. The Sun */}
        <SunObject onSelect={() => handleSelect('sun')} isTarget={selectedId === 'sun'} />

        {/* 2. Planets */}
        {Object.values(CELESTIAL_DATA)
          .filter((d) => ['mercury', 'venus', 'earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune'].includes(d.id))
          .map((planet) => (
            <PlanetObject
              key={planet.id}
              data={planet}
              simTime={simTime}
              showOrbits={showOrbits}
              onSelect={() => handleSelect(planet.id)}
              isTarget={selectedId === planet.id}
              onPositionUpdate={(pos) => {
                if (planet.id === 'earth') earthPos.current.copy(pos);
                if (selectedId === planet.id) handlePositionUpdate(pos);
              }}
            />
          ))}

        {/* 3. Asteroid Belt & Dwarf Planet Ceres */}
        <AsteroidBeltField
          simTime={simTime}
          showOrbits={showOrbits}
          onSelect={() => handleSelect('asteroid_belt')}
          isTarget={selectedId === 'asteroid_belt'}
          onPositionUpdate={(pos) => {
            if (selectedId === 'asteroid_belt') handlePositionUpdate(pos);
          }}
        />

        {/* 4. Deep Space Relativistic Wormhole */}
        <WormholeObject
          position={[420, -45, -300]}
          onSelect={() => handleSelect('wormhole')}
          isTarget={selectedId === 'wormhole'}
          onPositionUpdate={(pos) => {
            if (selectedId === 'wormhole') handlePositionUpdate(pos);
          }}
        />

        {/* 5. Mission Spacecraft Digital Twin */}
        <UniverseSatellite
          earthPos={earthPos.current}
          simTime={simTime}
          onSelect={() => handleSelect('satellite')}
          isTarget={selectedId === 'satellite'}
          onPositionUpdate={(pos) => {
            if (selectedId === 'satellite') handlePositionUpdate(pos);
          }}
        />

        {/* 6. v3.0 additive: mission trajectory monitoring layer (opt-in) */}
        <MissionTrajectoryOverlay simTime={simTime} visible={showTrajectoryLayer} />
      </Canvas>

      {/* ==========================================
          OVERLAY USER INTERFACE (HUD & CONTROLS)
          ========================================== */}

      {/* Header Info */}
      <div style={{ position: 'absolute', top: 18, left: 24, zIndex: 10, pointerEvents: 'none' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <div style={{ width: 8, height: 8, borderRadius: '50%', background: '#00d4ff', boxShadow: '0 0 10px #00d4ff' }} />
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 900, color: '#fff', letterSpacing: '0.15em', margin: 0 }}>
            VIRTUAL UNIVERSE SIMULATOR
          </h1>
        </div>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,212,255,0.7)', marginTop: 4 }}>
          INTERACTIVE 3D ASTROPHYSICAL DIGITAL TWIN · 10K+ CELESTIAL BODIES
        </div>
      </div>

      {/* Left Mission Spacecraft Live Tracking Card */}
      <div style={{
        position: 'absolute', top: 72, left: 24, width: 260,
        background: 'rgba(3,8,18,0.85)', border: '1px solid rgba(0,212,255,0.25)',
        borderRadius: 10, backdropFilter: 'blur(12px)', padding: 14, zIndex: 10
      }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>SPACECRAFT TELEMETRY</span>
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88', background: 'rgba(0,255,136,0.15)', padding: '2px 6px', borderRadius: 4 }}>
            LIVE FEED
          </span>
        </div>

        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#00d4ff', marginBottom: 8 }}>
          {config?.name ?? 'VYOM-01 Explorer'}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>ALTITUDE</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{telemetry?.orbit.altitudeKm.toFixed(1) ?? '650.0'} km</div>
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>VELOCITY</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{telemetry?.orbit.velocityKms.toFixed(2) ?? '7.65'} km/s</div>
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>INCLINATION</div>
            <div style={{ color: '#fff', fontWeight: 600 }}>{telemetry?.orbit.inclinationDeg.toFixed(1) ?? '51.6'}°</div>
          </div>
          <div>
            <div style={{ color: 'rgba(255,255,255,0.4)' }}>BATTERY</div>
            <div style={{ color: '#00ff88', fontWeight: 600 }}>{telemetry?.power?.batteryPercent != null && !isNaN(telemetry.power.batteryPercent) ? Math.max(0, Math.min(100, telemetry.power.batteryPercent)).toFixed(1) : '96.4'}%</div>
          </div>
        </div>

        <button
          onClick={() => handleSelect('satellite')}
          style={{
            marginTop: 10, width: '100%', padding: '7px',
            background: selectedId === 'satellite' ? '#00d4ff' : 'rgba(0,212,255,0.15)',
            border: '1px solid #00d4ff', borderRadius: 6,
            color: selectedId === 'satellite' ? '#000' : '#00d4ff',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            letterSpacing: '0.1em', cursor: 'pointer', transition: 'all 0.2s'
          }}
        >
          {selectedId === 'satellite' ? '● LOCKED ON SPACECRAFT' : '🎯 LOCK VIEW ON SPACECRAFT'}
        </button>
      </div>

      {/* Right Target Inspector Card */}
      <AnimatePresence mode="wait">
        <motion.div
          key={selectedId}
          initial={{ opacity: 0, x: 20 }}
          animate={{ opacity: 1, x: 0 }}
          exit={{ opacity: 0, x: 20 }}
          transition={{ duration: 0.25 }}
          style={{
            position: 'absolute', top: 18, right: 24, width: 300,
            background: 'rgba(3,8,18,0.92)', border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 12, backdropFilter: 'blur(16px)', padding: 16, zIndex: 10,
            maxHeight: 'calc(100vh - 120px)', overflowY: 'auto'
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00d4ff', letterSpacing: '0.15em' }}>
              {selectedData.category.toUpperCase().replace('_', ' ')}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>
              ID: {selectedData.id.toUpperCase()}
            </span>
          </div>

          <h2 style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 800, color: '#fff', margin: '4px 0 10px 0' }}>
            {selectedData.name}
          </h2>

          <p style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5, marginBottom: 12 }}>
            {selectedData.info.description}
          </p>

          <div style={{ height: 1, background: 'rgba(255,255,255,0.1)', marginBottom: 12 }} />

          {/* Astronomical Metrics Grid */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 7, fontFamily: 'var(--font-mono)', fontSize: 9 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>DIAMETER</span>
              <span style={{ color: '#fff' }}>{selectedData.info.diameterKm}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>DISTANCE FROM SUN</span>
              <span style={{ color: '#00d4ff' }}>{selectedData.info.distanceSunKm}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>ORBIT PERIOD</span>
              <span style={{ color: '#fff' }}>{selectedData.info.orbitPeriod}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>SURFACE TEMP</span>
              <span style={{ color: '#ffaa00' }}>{selectedData.info.surfaceTemp}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>SURFACE GRAVITY</span>
              <span style={{ color: '#fff' }}>{selectedData.info.gravity}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between' }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>ATMOSPHERE</span>
              <span style={{ color: '#00ff88', textAlign: 'right', maxWidth: 160 }}>{selectedData.info.atmosphere}</span>
            </div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ color: 'rgba(255,255,255,0.4)' }}>EXPLORATION</span>
              <span style={{ color: 'rgba(255,255,255,0.8)', textAlign: 'right', maxWidth: 160 }}>{selectedData.info.missions}</span>
            </div>
          </div>
        </motion.div>
      </AnimatePresence>

      {/* Bottom Navigation & Target Bar */}
      <div style={{
        position: 'absolute', bottom: 64, left: '50%', transform: 'translateX(-50%)',
        display: 'flex', alignItems: 'center', gap: 6,
        background: 'rgba(2,6,15,0.92)', border: '1px solid rgba(0,212,255,0.3)',
        borderRadius: 28, padding: '6px 14px', backdropFilter: 'blur(16px)', zIndex: 10,
        maxWidth: '90vw', overflowX: 'auto'
      }}>
        {/* Quick Target Buttons */}
        {Object.values(CELESTIAL_DATA).map((item) => {
          const active = selectedId === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleSelect(item.id)}
              style={{
                padding: '6px 12px', borderRadius: 16,
                background: active ? '#00d4ff' : 'transparent',
                border: active ? '1px solid #00d4ff' : '1px solid rgba(255,255,255,0.08)',
                color: active ? '#000' : 'rgba(255,255,255,0.7)',
                fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: active ? 700 : 500,
                letterSpacing: '0.08em', cursor: 'pointer', whiteSpace: 'nowrap',
                transition: 'all 0.15s ease'
              }}
            >
              {item.id === 'asteroid_belt' ? 'Asteroid Belt' : item.name.split(' ')[0]}
            </button>
          );
        })}

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.15)', margin: '0 4px' }} />

        {/* Orbit Lines Toggle */}
        <button
          onClick={() => setShowOrbits(!showOrbits)}
          style={{
            padding: '6px 10px', borderRadius: 16,
            background: showOrbits ? 'rgba(0,212,255,0.18)' : 'transparent',
            border: '1px solid rgba(0,212,255,0.3)',
            color: showOrbits ? '#00d4ff' : 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap'
          }}
        >
          {showOrbits ? 'ORBITS: ON' : 'ORBITS: OFF'}
        </button>

        {/* v3.0 additive: trajectory monitoring layer toggle */}
        <button
          onClick={() => setShowTrajectoryLayer(!showTrajectoryLayer)}
          style={{
            padding: '6px 8px', borderRadius: 12,
            background: showTrajectoryLayer ? 'rgba(255,140,0,0.2)' : 'transparent',
            border: `1px solid ${showTrajectoryLayer ? '#ff8c00' : 'rgba(255,255,255,0.08)'}`,
            color: showTrajectoryLayer ? '#ff8c00' : 'rgba(255,255,255,0.5)',
            fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer', whiteSpace: 'nowrap'
          }}
          title="Overlay the selected mission's planned/predicted trajectory around Earth"
        >
          {showTrajectoryLayer ? 'TRAJECTORY: ON' : 'TRAJECTORY: OFF'}
        </button>

        {/* Time Multiplier Buttons */}
        {[1, 5, 25, 100].map((speed) => (
          <button
            key={speed}
            onClick={() => setTimeMultiplier(speed)}
            style={{
              padding: '6px 8px', borderRadius: 12,
              background: timeMultiplier === speed ? 'rgba(0,255,136,0.2)' : 'transparent',
              border: `1px solid ${timeMultiplier === speed ? '#00ff88' : 'rgba(255,255,255,0.08)'}`,
              color: timeMultiplier === speed ? '#00ff88' : 'rgba(255,255,255,0.4)',
              fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer'
            }}
          >
            {speed}×
          </button>
        ))}

        {/* Free Roam / Lock Cam */}
        <button
          onClick={() => setIsFreeCam(!isFreeCam)}
          style={{
            padding: '6px 10px', borderRadius: 16,
            background: isFreeCam ? '#bf5af2' : 'transparent',
            border: '1px solid #bf5af2',
            color: isFreeCam ? '#fff' : '#bf5af2',
            fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700,
            cursor: 'pointer', whiteSpace: 'nowrap'
          }}
        >
          {isFreeCam ? 'FREE ROAM CAM' : 'LOCK TARGET'}
        </button>
      </div>
    </div>
  );
}
