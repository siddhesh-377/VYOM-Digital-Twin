/**
 * VYOM — Dynamic Spacecraft 3D Modular Model (Phase 6)
 * Procedural WebGL 3D models for Human Exploration, Orbital Observation, Planetary Probe, and Astrophysics Observatory
 * with clickable subsystem highlighting and real-time telemetry responsiveness.
 */

import React, { useRef, useMemo, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { useMissionStore } from '../../store/missionStore';
import { SpacecraftModelType } from '../../types/missionProfiles';

interface DynamicSpacecraftModelProps {
  modelType?: SpacecraftModelType;
  interactive?: boolean;
  scale?: number;
  selectedSubsystem?: string | null;
  onSelectSubsystem?: (subsystem: string) => void;
}

export function DynamicSpacecraftModel({
  modelType = 'earth_observer',
  interactive = false,
  scale = 1,
  selectedSubsystem = null,
  onSelectSubsystem,
}: DynamicSpacecraftModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const solarWingsRef = useRef<THREE.Group>(null);
  const dishRef = useRef<THREE.Group>(null);
  const statusLedRef = useRef<THREE.PointLight>(null);

  const [hoveredSubsystem, setHoveredSubsystem] = useState<string | null>(null);

  const telemetry = useMissionStore((s) => s.telemetry);
  const config = useMissionStore((s) => s.config);

  // Determine actual model type from store config if not provided
  const activeType = useMemo<SpacecraftModelType>(() => {
    if (modelType) return modelType;
    if (config?.type === 'human') return 'crewed_capsule';
    if (config?.type === 'planetary') return 'planetary_probe';
    if (config?.type === 'astrophysics') return 'space_telescope';
    return 'earth_observer';
  }, [modelType, config]);

  // Materials with aerospace aesthetics
  const materials = useMemo(() => {
    return {
      bodyGold: new THREE.MeshStandardMaterial({
        color: '#d4af37',
        metalness: 0.9,
        roughness: 0.25,
      }),
      bodyTitanium: new THREE.MeshStandardMaterial({
        color: '#c0c8d0',
        metalness: 0.85,
        roughness: 0.2,
      }),
      bodyCarbon: new THREE.MeshStandardMaterial({
        color: '#1a1f26',
        metalness: 0.5,
        roughness: 0.4,
      }),
      heatShield: new THREE.MeshStandardMaterial({
        color: '#2b221b',
        metalness: 0.2,
        roughness: 0.85,
      }),
      opticalLens: new THREE.MeshPhysicalMaterial({
        color: '#002244',
        metalness: 0.9,
        roughness: 0.05,
        transmission: 0.6,
        thickness: 0.5,
        reflectivity: 0.9,
      }),
      sunshield: new THREE.MeshStandardMaterial({
        color: '#c5a059',
        metalness: 0.8,
        roughness: 0.3,
        side: THREE.DoubleSide,
      }),
      antennaWhite: new THREE.MeshStandardMaterial({
        color: '#f0f4f8',
        metalness: 0.6,
        roughness: 0.3,
      }),
      thrusterDark: new THREE.MeshStandardMaterial({
        color: '#2a313d',
        metalness: 0.95,
        roughness: 0.3,
      }),
      highlightGlow: new THREE.MeshStandardMaterial({
        color: '#00e5ff',
        emissive: '#00e5ff',
        emissiveIntensity: 0.6,
        metalness: 0.5,
        roughness: 0.2,
      }),
      warningGlow: new THREE.MeshStandardMaterial({
        color: '#ff3b30',
        emissive: '#ff3b30',
        emissiveIntensity: 0.7,
      }),
    };
  }, []);

  // Solar panel shader
  const solarPanelShader = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        power: { value: 1.0 },
      },
      vertexShader: `
        varying vec2 vUv;
        void main() {
          vUv = uv;
          gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
        }
      `,
      fragmentShader: `
        varying vec2 vUv;
        uniform float time;
        uniform float power;
        void main() {
          vec2 grid = fract(vUv * vec2(12.0, 6.0));
          float cell = step(0.04, grid.x) * step(0.04, grid.y);
          vec3 baseColor = vec3(0.01, 0.04, 0.16);
          vec3 cellColor = vec3(0.04, 0.12, 0.38);
          vec3 color = mix(baseColor, cellColor, cell);
          float shimmer = sin(vUv.x * 30.0 + time * 1.5) * 0.06 + 0.94;
          color *= shimmer * power;
          gl_FragColor = vec4(color, 1.0);
        }
      `,
    });
  }, []);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    solarPanelShader.uniforms.time.value = t;

    if (telemetry) {
      const batteryRatio = (telemetry.power?.batteryPercent ?? 100) / 100;
      solarPanelShader.uniforms.power.value = THREE.MathUtils.lerp(
        solarPanelShader.uniforms.power.value,
        batteryRatio,
        0.05
      );
    }

    if (groupRef.current && !interactive) {
      groupRef.current.rotation.y = t * 0.12;
      groupRef.current.rotation.x = Math.sin(t * 0.08) * 0.04;
    }

    // Apply attitude from telemetry if available
    if (groupRef.current && telemetry?.attitude) {
      const targetX = (telemetry.attitude.pitchDeg * Math.PI) / 180 * 0.4;
      const targetZ = (telemetry.attitude.rollDeg * Math.PI) / 180 * 0.3;
      groupRef.current.rotation.x = THREE.MathUtils.lerp(groupRef.current.rotation.x, targetX, 0.03);
      groupRef.current.rotation.z = THREE.MathUtils.lerp(groupRef.current.rotation.z, targetZ, 0.03);
    }

    // Subtle solar panel oscillation
    if (solarWingsRef.current) {
      solarWingsRef.current.rotation.y = Math.sin(t * 0.4) * 0.03;
    }

    // Status LED blink
    if (statusLedRef.current) {
      const isNominal = !telemetry || telemetry.overallHealth > 70;
      const blinkSpeed = isNominal ? 1.5 : 6.0;
      statusLedRef.current.intensity = Math.sin(t * blinkSpeed) > 0 ? 0.8 : 0.1;
      statusLedRef.current.color.setHex(isNominal ? 0x00ff88 : 0xff3b30);
    }
  });

  const isSubsystemActive = (name: string) => {
    return selectedSubsystem?.toLowerCase().includes(name.toLowerCase()) ||
           hoveredSubsystem?.toLowerCase().includes(name.toLowerCase());
  };

  const getSubsystemMat = (name: string, defaultMat: THREE.Material) => {
    if (isSubsystemActive(name)) {
      return materials.highlightGlow;
    }
    return defaultMat;
  };

  const handleSubsystemClick = (e: any, name: string) => {
    e.stopPropagation();
    if (onSelectSubsystem) {
      onSelectSubsystem(name);
    }
  };

  const s = scale;

  return (
    <group ref={groupRef} scale={[s, s, s]}>
      {/* ── 1. CREWED CAPSULE (Human Exploration) ── */}
      {activeType === 'crewed_capsule' && (
        <group>
          {/* Crew Module (Truncated Cone) */}
          <mesh
            position={[0, 0.35, 0]}
            material={getSubsystemMat('eclss', materials.bodyTitanium)}
            onClick={(e) => handleSubsystemClick(e, 'Life Support (ECLSS)')}
            onPointerOver={() => setHoveredSubsystem('eclss')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.22, 0.45, 0.5, 32]} />
          </mesh>

          {/* Viewport Window */}
          <mesh position={[0, 0.42, 0.23]} rotation={[0.4, 0, 0]} material={materials.opticalLens}>
            <circleGeometry args={[0.06, 16]} />
          </mesh>

          {/* Docking Hatch Ring */}
          <mesh position={[0, 0.61, 0]} material={materials.antennaWhite}>
            <torusGeometry args={[0.12, 0.02, 12, 32]} />
          </mesh>

          {/* Heat Shield Base */}
          <mesh position={[0, 0.08, 0]} material={getSubsystemMat('thermal', materials.heatShield)}>
            <cylinderGeometry args={[0.46, 0.44, 0.06, 32]} />
          </mesh>

          {/* Service Module (Cylindrical Section) */}
          <mesh
            position={[0, -0.28, 0]}
            material={getSubsystemMat('power', materials.bodyTitanium)}
            onClick={(e) => handleSubsystemClick(e, 'Power System')}
            onPointerOver={() => setHoveredSubsystem('power')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.44, 0.44, 0.65, 32]} />
          </mesh>

          {/* Radiator Wrap Strip */}
          <mesh position={[0, -0.28, 0]} material={getSubsystemMat('thermal', materials.bodyCarbon)}>
            <cylinderGeometry args={[0.445, 0.445, 0.3, 32, 1, true]} />
          </mesh>

          {/* Twin Deployable Solar Wings */}
          <group ref={solarWingsRef} position={[0, -0.28, 0]}>
            {/* Left Wing */}
            <mesh
              position={[-0.95, 0, 0]}
              onClick={(e) => handleSubsystemClick(e, 'Power (EPS)')}
            >
              <boxGeometry args={[0.9, 0.02, 0.35]} />
              <primitive object={solarPanelShader} attach="material" />
            </mesh>
            {/* Right Wing */}
            <mesh
              position={[0.95, 0, 0]}
              onClick={(e) => handleSubsystemClick(e, 'Power (EPS)')}
            >
              <boxGeometry args={[0.9, 0.02, 0.35]} />
              <primitive object={solarPanelShader} attach="material" />
            </mesh>
          </group>

          {/* Main Service Engine Bell */}
          <mesh
            position={[0, -0.68, 0]}
            material={getSubsystemMat('propulsion', materials.thrusterDark)}
            onClick={(e) => handleSubsystemClick(e, 'Propulsion')}
          >
            <cylinderGeometry args={[0.08, 0.22, 0.2, 24]} />
          </mesh>
        </group>
      )}

      {/* ── 2. EARTH OBSERVER (Orbital Observation) ── */}
      {activeType === 'earth_observer' && (
        <group>
          {/* Main Rectangular Satellite Bus */}
          <mesh
            position={[0, 0, 0]}
            material={getSubsystemMat('avionics', materials.bodyGold)}
            onClick={(e) => handleSubsystemClick(e, 'Avionics')}
          >
            <boxGeometry args={[0.5, 0.4, 0.7]} />
          </mesh>

          {/* Nadir Optical Aperture & Camera Tube */}
          <group position={[0, -0.25, 0.15]}>
            <mesh material={getSubsystemMat('payload', materials.bodyCarbon)}>
              <cylinderGeometry args={[0.14, 0.16, 0.22, 32]} />
            </mesh>
            <mesh position={[0, -0.11, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.opticalLens}>
              <circleGeometry args={[0.13, 32]} />
            </mesh>
          </group>

          {/* SAR Radar Antenna Panel Boom */}
          <mesh
            position={[0, 0.25, 0]}
            material={getSubsystemMat('payload', materials.antennaWhite)}
            onClick={(e) => handleSubsystemClick(e, 'Optical/SAR Payload')}
          >
            <boxGeometry args={[0.8, 0.03, 0.4]} />
          </mesh>

          {/* Dual Segment Solar Panels */}
          <group ref={solarWingsRef}>
            <mesh position={[-0.95, 0, 0]}>
              <boxGeometry args={[0.8, 0.02, 0.55]} />
              <primitive object={solarPanelShader} attach="material" />
            </mesh>
            <mesh position={[0.95, 0, 0]}>
              <boxGeometry args={[0.8, 0.02, 0.55]} />
              <primitive object={solarPanelShader} attach="material" />
            </mesh>
          </group>

          {/* Star Tracker Optical Hoods */}
          <mesh position={[0.22, 0.22, -0.2]} material={materials.bodyCarbon}>
            <cylinderGeometry args={[0.03, 0.04, 0.09, 16]} />
          </mesh>
        </group>
      )}

      {/* ── 3. PLANETARY PROBE (Deep Space Exploration) ── */}
      {activeType === 'planetary_probe' && (
        <group>
          {/* Octagonal Deep Space Bus */}
          <mesh
            position={[0, -0.1, 0]}
            material={getSubsystemMat('avionics', materials.bodyGold)}
            onClick={(e) => handleSubsystemClick(e, 'Avionics')}
          >
            <cylinderGeometry args={[0.45, 0.45, 0.5, 8]} />
          </mesh>

          {/* Large Parabolic High-Gain Antenna (HGA) */}
          <group ref={dishRef} position={[0, 0.35, 0]} rotation={[-0.3, 0, 0]}>
            <mesh
              material={getSubsystemMat('communication', materials.antennaWhite)}
              onClick={(e) => handleSubsystemClick(e, 'High-Gain Comms')}
            >
              <cylinderGeometry args={[0.45, 0.08, 0.12, 32, 1, true]} />
            </mesh>
            {/* Feed Horn Strut */}
            <mesh position={[0, 0.18, 0]} material={materials.antennaWhite}>
              <cylinderGeometry args={[0.015, 0.02, 0.22, 12]} />
            </mesh>
          </group>

          {/* Magnetometer & Science Instrument Boom */}
          <mesh
            position={[0, -0.1, 0.65]}
            rotation={[Math.PI / 2, 0, 0]}
            material={getSubsystemMat('payload', materials.antennaWhite)}
            onClick={(e) => handleSubsystemClick(e, 'Science Payload')}
          >
            <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
          </mesh>

          {/* Bipropellant Main Thruster Bell */}
          <mesh
            position={[0, -0.45, 0]}
            material={getSubsystemMat('propulsion', materials.thrusterDark)}
            onClick={(e) => handleSubsystemClick(e, 'Liquid Propulsion')}
          >
            <cylinderGeometry args={[0.06, 0.2, 0.25, 24]} />
          </mesh>

          {/* RTG Thermal Fin Modules */}
          {[-1, 1].map((dir, i) => (
            <mesh key={i} position={[dir * 0.55, -0.1, 0]} material={materials.bodyCarbon}>
              <boxGeometry args={[0.2, 0.3, 0.05]} />
            </mesh>
          ))}
        </group>
      )}

      {/* ── 4. SPACE TELESCOPE (Astrophysics Observatory) ── */}
      {activeType === 'space_telescope' && (
        <group>
          {/* Main Optical Telescope Tube Assembly */}
          <mesh
            position={[0, 0.15, 0]}
            material={getSubsystemMat('payload', materials.bodyTitanium)}
            onClick={(e) => handleSubsystemClick(e, '2.4m Telescope Payload')}
          >
            <cylinderGeometry args={[0.3, 0.32, 0.95, 32]} />
          </mesh>

          {/* Open Aperture Sunshade Door */}
          <group position={[0, 0.65, 0]} rotation={[0.4, 0, 0]}>
            <mesh material={materials.bodyCarbon}>
              <cylinderGeometry args={[0.31, 0.31, 0.15, 32, 1, true]} />
            </mesh>
            <mesh position={[0, -0.05, 0]} rotation={[Math.PI / 2, 0, 0]} material={materials.opticalLens}>
              <circleGeometry args={[0.28, 32]} />
            </mesh>
          </group>

          {/* Layered Diamond Sunshield Palette */}
          <group position={[0, -0.38, 0]}>
            {[-0.04, 0, 0.04].map((offsetY, idx) => (
              <mesh
                key={idx}
                position={[0, offsetY, 0]}
                rotation={[Math.PI / 2, 0, Math.PI / 4]}
                material={getSubsystemMat('thermal', materials.sunshield)}
                onClick={(e) => handleSubsystemClick(e, 'Cryogenic TCS')}
              >
                <planeGeometry args={[1.3 - idx * 0.1, 1.3 - idx * 0.1]} />
              </mesh>
            ))}
          </group>

          {/* Cryocooler Radiator Strip */}
          <mesh position={[0.31, 0.1, 0]} material={materials.bodyCarbon}>
            <boxGeometry args={[0.04, 0.45, 0.25]} />
          </mesh>

          {/* Comms Gimbal Dish */}
          <mesh position={[0, -0.48, 0.35]} material={materials.antennaWhite}>
            <sphereGeometry args={[0.12, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
          </mesh>
        </group>
      )}

      {/* Real-time Health Status Beacon Light */}
      <pointLight
        ref={statusLedRef}
        position={[0, 0.55, 0]}
        intensity={0.6}
        distance={2.5}
        color="#00ff88"
      />
    </group>
  );
}
