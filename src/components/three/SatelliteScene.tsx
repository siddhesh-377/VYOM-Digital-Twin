import { useRef, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMissionStore } from '../../store/missionStore';

// Full 3D satellite model procedurally generated
export function SatelliteModel({
  interactive = false,
  scale = 1,
}: {
  interactive?: boolean;
  scale?: number;
}) {
  const groupRef = useRef<THREE.Group>(null);
  const panelLRef = useRef<THREE.Mesh>(null);
  const panelRRef = useRef<THREE.Mesh>(null);
  const antennaRef = useRef<THREE.Mesh>(null);
  const ledRef = useRef<THREE.PointLight>(null);

  const telemetry = useMissionStore((s) => s.telemetry);
  const aiAnalysis = useMissionStore((s) => s.aiAnalysis);

  // Materials
  const bodyMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#c8d8e8',
    metalness: 0.85,
    roughness: 0.2,
    envMapIntensity: 1,
  }), []);

  const panelMat = useMemo(() => new THREE.ShaderMaterial({
    uniforms: { time: { value: 0 }, power: { value: 1.0 } },
    vertexShader: `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position,1.0); }
    `,
    fragmentShader: `
      varying vec2 vUv;
      uniform float time;
      uniform float power;
      void main() {
        // Solar cell grid pattern
        vec2 grid = fract(vUv * 8.0);
        float cell = step(0.05, grid.x) * step(0.05, grid.y);
        vec3 baseColor = vec3(0.02, 0.05, 0.18);
        vec3 cellColor = vec3(0.05, 0.1, 0.35);
        vec3 color = mix(baseColor, cellColor, cell);
        // Shimmer
        float shimmer = sin(vUv.x * 20.0 + time * 2.0) * 0.05 + 0.95;
        color *= shimmer * power;
        float highlight = max(0.0, sin(vUv.y * 3.14159));
        color += vec3(0.02, 0.04, 0.1) * highlight;
        gl_FragColor = vec4(color, 1.0);
      }
    `,
  }), []);

  const antennaMat = useMemo(() => new THREE.MeshStandardMaterial({
    color: '#ffffff',
    metalness: 0.7,
    roughness: 0.3,
    emissive: '#001122',
  }), []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    (panelMat.uniforms.time as any).value = t;

    if (telemetry) {
      const powerRatio = telemetry.power.batteryPercent / 100;
      (panelMat.uniforms.power as any).value = THREE.MathUtils.lerp(
        (panelMat.uniforms.power as any).value,
        powerRatio,
        0.05
      );
    }

    if (groupRef.current && !interactive) {
      groupRef.current.rotation.y = t * 0.15;
      groupRef.current.rotation.x = Math.sin(t * 0.1) * 0.05;
    }

    // Apply attitude changes from telemetry
    if (groupRef.current && telemetry) {
      groupRef.current.rotation.x = THREE.MathUtils.lerp(
        groupRef.current.rotation.x,
        (telemetry.attitude.pitchDeg * Math.PI) / 180 * 0.5,
        0.02
      );
      groupRef.current.rotation.z = THREE.MathUtils.lerp(
        groupRef.current.rotation.z,
        (telemetry.attitude.rollDeg * Math.PI) / 180 * 0.3,
        0.02
      );
    }

    // Solar panel slight oscillation
    if (panelLRef.current) panelLRef.current.rotation.y = Math.sin(t * 0.5) * 0.05;
    if (panelRRef.current) panelRRef.current.rotation.y = -Math.sin(t * 0.5) * 0.05;

    // Antenna pulse for comms
    if (antennaRef.current) {
      antennaRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.02);
    }

    // LED blink
    if (ledRef.current) {
      const healthOk = !telemetry || telemetry.overallHealth > 70;
      const blinkSpeed = healthOk ? 1 : 5;
      ledRef.current.intensity = Math.sin(t * blinkSpeed) > 0 ? 0.3 : 0;
      ledRef.current.color.setHex(healthOk ? 0x00ff88 : 0xff2d55);
    }
  });

  const s = scale;

  return (
    <group ref={groupRef} scale={[s, s, s]}>
      {/* Main body */}
      <mesh material={bodyMat}>
        <boxGeometry args={[0.5, 0.35, 0.6]} />
      </mesh>

      {/* Body side panels (thermal control) */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * 0.26, 0, 0]} material={bodyMat}>
          <boxGeometry args={[0.02, 0.35, 0.6]} />
        </mesh>
      ))}

      {/* Solar panels — Left */}
      <group ref={panelLRef} position={[-0.8, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.6, 0.02, 0.5]} />
          <primitive object={panelMat} attach="material" />
        </mesh>
        {/* Strut */}
        <mesh position={[0.3, 0, 0]} material={antennaMat}>
          <boxGeometry args={[0.02, 0.02, 0.02]} />
        </mesh>
      </group>

      {/* Solar panels — Right */}
      <group ref={panelRRef} position={[0.8, 0, 0]}>
        <mesh>
          <boxGeometry args={[0.6, 0.02, 0.5]} />
          <primitive object={panelMat} attach="material" />
        </mesh>
      </group>

      {/* Main antenna dish */}
      <group ref={antennaRef} position={[0, 0.25, 0]}>
        <mesh material={antennaMat}>
          <cylinderGeometry args={[0.18, 0.18, 0.01, 32]} />
        </mesh>
        {/* Dish rim */}
        <mesh material={antennaMat} position={[0, 0.005, 0]}>
          <torusGeometry args={[0.18, 0.01, 8, 32]} />
        </mesh>
        {/* Feed horn */}
        <mesh position={[0, 0.12, 0]} material={antennaMat}>
          <cylinderGeometry args={[0.01, 0.02, 0.12, 8]} />
        </mesh>
        {/* Signal indicator light */}
        <pointLight ref={ledRef} position={[0, 0.2, 0]} intensity={0.3} distance={1} color="#00ff88" />
      </group>

      {/* Secondary omni-antenna */}
      <mesh position={[0, -0.2, 0.31]} material={antennaMat}>
        <cylinderGeometry args={[0.005, 0.005, 0.15, 6]} />
      </mesh>

      {/* Payload / sensor bay */}
      <mesh position={[0, -0.21, 0]}>
        <boxGeometry args={[0.25, 0.08, 0.4]} />
        <meshStandardMaterial color="#1a2a3a" metalness={0.9} roughness={0.15} />
      </mesh>

      {/* Thruster nozzles (4 corners) */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
        <mesh key={i} position={[x * 0.22, -0.18, z * 0.22]}>
          <cylinderGeometry args={[0.025, 0.035, 0.04, 8]} />
          <meshStandardMaterial color="#334455" metalness={1} roughness={0.2} />
        </mesh>
      ))}

      {/* Star tracker */}
      <mesh position={[0.18, 0.18, 0.2]}>
        <cylinderGeometry args={[0.03, 0.03, 0.08, 12]} />
        <meshStandardMaterial color="#223344" metalness={0.9} roughness={0.2} />
      </mesh>

      {/* Thermal radiator strip */}
      <mesh position={[0, 0, 0.31]}>
        <boxGeometry args={[0.4, 0.3, 0.01]} />
        <meshStandardMaterial color="#e8e8d0" metalness={0.3} roughness={0.8} emissive="#220000" emissiveIntensity={0.05} />
      </mesh>
    </group>
  );
}

// Orbit line visualization
export function OrbitLine({
  radius = 3.5,
  inclination = 51.6,
  color = '#00d4ff',
}: {
  radius?: number;
  inclination?: number;
  color?: string;
}) {
  const geom = useMemo(() => {
    const points: THREE.Vector3[] = [];
    for (let i = 0; i <= 256; i++) {
      const angle = (i / 256) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * radius, 0, Math.sin(angle) * radius));
    }
    const g = new THREE.BufferGeometry().setFromPoints(points);
    return g;
  }, [radius]);

  const mat = useMemo(() => new THREE.LineBasicMaterial({
    color,
    transparent: true,
    opacity: 0.4,
  }), [color]);

  const line = useMemo(() => new THREE.Line(geom, mat), [geom, mat]);

  return (
    <group rotation={[0, 0, (inclination * Math.PI) / 180]}>
      <primitive object={line} />
    </group>
  );
}

// Ground track point
export function GroundTrack({ points }: { points: { lat: number; lng: number; alt: number }[] }) {
  const geom = useMemo(() => {
    if (points.length < 2) return null;
    const trackPoints = points.map(({ lat, lng, alt }) => {
      const phi = (90 - lat) * (Math.PI / 180);
      const theta = (lng + 180) * (Math.PI / 180);
      const r = 2.05;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    });
    return new THREE.BufferGeometry().setFromPoints(trackPoints);
  }, [points]);

  if (!geom) return null;

  const line = useMemo(
    () => new THREE.Line(geom, new THREE.LineBasicMaterial({ color: '#00d4ff', transparent: true, opacity: 0.3 })),
    [geom]
  );

  return (
    <primitive object={line} />
  );
}
