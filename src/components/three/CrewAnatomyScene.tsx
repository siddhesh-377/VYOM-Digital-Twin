/**
 * CrewAnatomyScene — procedural three.js human figure for the Human Digital Twin.
 * Purely geometric primitives (no external assets). Vitals markers are color-coded
 * from the selected crew member's SIMULATED physiological estimates.
 */
import { useMemo, useRef } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import * as THREE from 'three';
import type { CrewMember } from '../../types/mission';

function vitalColor(value: number, warn: number, crit: number): string {
  if (value >= crit) return '#ff2d55';
  if (value >= warn) return '#ff8c00';
  return '#00ff88';
}

/** Pulsing halo marker attached to an anatomical point. */
function VitalMarker({
  position,
  color,
  label,
}: {
  position: [number, number, number];
  color: string;
  label: string;
}) {
  const ref = useRef<THREE.Mesh>(null);
  useFrame(({ clock }) => {
    const s = 1 + Math.sin(clock.getElapsedTime() * 3) * 0.25;
    ref.current?.scale.setScalar(s);
  });
  return (
    <group position={position}>
      <mesh ref={ref}>
        <sphereGeometry args={[0.055, 16, 16]} />
        <meshBasicMaterial color={color} transparent opacity={0.9} />
      </mesh>
      <pointLight color={color} intensity={2} distance={1.2} />
      {/* HTML-free label sprite substitute: small floating ring */}
      <mesh rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.09, 0.008, 8, 24]} />
        <meshBasicMaterial color={color} transparent opacity={0.5} />
      </mesh>
      <group name={`marker-${label}`} />
    </group>
  );
}

/** Procedural human figure built from primitives. */
function HumanFigure({ member }: { member: CrewMember | null }) {
  const group = useRef<THREE.Group>(null);
  useFrame(({ clock }) => {
    // Subtle breathing motion
    const breathe = Math.sin(clock.getElapsedTime() * (member ? Math.max(0.4, member.respirationBpm / 12) : 0.8)) * 0.006;
    if (group.current) group.current.scale.y = 1 + breathe;
  });

  const hr = member?.heartRateBpm ?? 72;
  const stress = member?.stressIndex ?? 15;
  const fatigue = member?.fatigueIndex ?? 10;
  const hydration = member?.hydrationPercent ?? 95;
  const rad = member?.radiationDoseMsv ?? 0.1;

  const heartColor = vitalColor(hr, 95, 120);
  const lungColor = vitalColor(100 - (member?.spo2Percent ?? 99), 3, 6);
  const brainColor = vitalColor(stress, 50, 75);
  const muscleColor = vitalColor(fatigue, 50, 75);
  const bodyColor = vitalColor(100 - hydration, 20, 35);
  const shieldColor = vitalColor(rad * 100, 50, 100);

  const isEVA = member?.status === 'eva';

  const skinMaterial = useMemo(
    () => new THREE.MeshStandardMaterial({ color: '#8fb8d8', metalness: 0.15, roughness: 0.55, transparent: true, opacity: 0.92 }),
    []
  );

  return (
    <group ref={group} position={[0, -0.9, 0]}>
      {/* Head + brain */}
      <mesh material={skinMaterial} position={[0, 2.62, 0]}>
        <sphereGeometry args={[0.22, 24, 24]} />
      </mesh>
      <VitalMarker position={[0, 2.66, 0.08]} color={brainColor} label="brain-stress" />

      {/* Torso */}
      <mesh material={skinMaterial} position={[0, 1.85, 0]} castShadow>
        <capsuleGeometry args={[0.34, 0.72, 8, 20]} />
      </mesh>
      {/* Heart */}
      <VitalMarker position={[-0.09, 2.02, 0.18]} color={heartColor} label="heart-rate" />
      {/* Lungs */}
      <VitalMarker position={[0.13, 2.06, 0.14]} color={lungColor} label="lungs-spo2" />
      {/* Hydration / core */}
      <VitalMarker position={[0, 1.7, 0.2]} color={bodyColor} label="core-hydration" />

      {/* Arms */}
      <mesh material={skinMaterial} position={[-0.52, 1.78, 0]} rotation={[0, 0, 0.18]}>
        <capsuleGeometry args={[0.09, 0.95, 6, 14]} />
      </mesh>
      <mesh material={skinMaterial} position={[0.52, 1.78, 0]} rotation={[0, 0, -0.18]}>
        <capsuleGeometry args={[0.09, 0.95, 6, 14]} />
      </mesh>
      {/* Muscle fatigue markers on forearms */}
      <VitalMarker position={[-0.58, 1.32, 0.05]} color={muscleColor} label="fatigue-l" />
      <VitalMarker position={[0.58, 1.32, 0.05]} color={muscleColor} label="fatigue-r" />

      {/* Legs */}
      <mesh material={skinMaterial} position={[-0.17, 0.68, 0]}>
        <capsuleGeometry args={[0.115, 1.05, 6, 14]} />
      </mesh>
      <mesh material={skinMaterial} position={[0.17, 0.68, 0]}>
        <capsuleGeometry args={[0.115, 1.05, 6, 14]} />
      </mesh>

      {/* EVA suit outline + tether when on EVA */}
      {isEVA && (
        <>
          <mesh position={[0, 1.55, 0]}>
            <capsuleGeometry args={[0.52, 1.55, 8, 24]} />
            <meshStandardMaterial color="#00d4ff" wireframe transparent opacity={0.22} />
          </mesh>
          {/* Tether line to spacecraft (visual anchor) */}
          <mesh position={[1.6, 1.9, -0.4]} rotation={[0, 0, Math.PI / 3.2]}>
            <cylinderGeometry args={[0.012, 0.012, 2.6, 8]} />
            <meshStandardMaterial color="#00ff88" emissive="#00ff88" emissiveIntensity={0.4} />
          </mesh>
          <VitalMarker position={[1.6, 1.9, -0.4]} color="#00ff88" label="tether" />
        </>
      )}

      {/* Radiation exposure shell */}
      <mesh position={[0, 1.45, 0]}>
        <sphereGeometry args={[1.5, 24, 24]} />
        <meshBasicMaterial color={shieldColor} transparent opacity={0.04} />
      </mesh>
    </group>
  );
}

export function CrewAnatomyScene({
  member,
  height = 380,
}: {
  member: CrewMember | null;
  height?: number;
}) {
  return (
    <div style={{ width: '100%', height, borderRadius: 10, overflow: 'hidden', background: 'radial-gradient(ellipse at 50% 30%, #071528 0%, #020409 70%)', border: '1px solid rgba(0,212,255,0.15)' }}>
      <Canvas camera={{ position: [0, 1.4, 4.2], fov: 42 }} dpr={[1, 2]}>
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 5, 4]} intensity={1.1} />
        <directionalLight position={[-4, 2, -3]} intensity={0.35} color="#00d4ff" />
        <HumanFigure member={member} />
        <gridHelper args={[8, 16, '#0a2036', '#06121f']} position={[0, -0.92, 0]} />
        <OrbitControls enablePan={false} minDistance={2.2} maxDistance={8} autoRotate autoRotateSpeed={0.6} target={[0, 0.9, 0]} />
      </Canvas>
    </div>
  );
}
