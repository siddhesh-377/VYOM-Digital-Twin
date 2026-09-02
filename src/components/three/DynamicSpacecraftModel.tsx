/**
 * VYOM — Dynamic Spacecraft 3D Modular Digital Twin Model
 * Procedural WebGL 3D models for Human Exploration, Orbital Observation, Planetary Probe, and Astrophysics Observatory
 * with clickable subsystem inspection and real-time failure response animations.
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
  activeThreatOverride?: string | null;
}

export function resolveSpacecraftModelType(type?: string | null, configType?: string | null): SpacecraftModelType {
  const raw = (type || configType || '').toLowerCase();
  if (raw === 'crewed_capsule' || raw === 'earth_observer' || raw === 'planetary_probe' || raw === 'space_telescope') {
    return raw as SpacecraftModelType;
  }
  if (raw.includes('crew') || raw.includes('human') || raw.includes('capsule') || raw.includes('gaganyaan') || raw.includes('chandrayaan')) {
    return 'crewed_capsule';
  }
  if (raw.includes('probe') || raw.includes('mars') || raw.includes('planetary') || raw.includes('mangalyaan')) {
    return 'planetary_probe';
  }
  if (raw.includes('telescope') || raw.includes('astrophysics') || raw.includes('astrosat') || raw.includes('deep-space') || raw.includes('observatory')) {
    return 'space_telescope';
  }
  if (raw.includes('observer') || raw.includes('cartosat') || raw.includes('earth') || raw.includes('imaging') || raw.includes('orbital')) {
    return 'earth_observer';
  }
  return 'crewed_capsule';
}

export function DynamicSpacecraftModel({
  modelType,
  interactive = false,
  scale = 1,
  selectedSubsystem = null,
  onSelectSubsystem,
  activeThreatOverride = null,
}: DynamicSpacecraftModelProps) {
  const groupRef = useRef<THREE.Group>(null);
  const solarWingsRef = useRef<THREE.Group>(null);
  const dishRef = useRef<THREE.Group>(null);
  const statusLedRef = useRef<THREE.PointLight>(null);
  const thrusterFlameRef = useRef<THREE.Mesh>(null);
  const thermalGlowRef = useRef<THREE.PointLight>(null);

  const [hoveredSubsystem, setHoveredSubsystem] = useState<string | null>(null);

  const telemetry = useMissionStore((s) => s.telemetry);
  const config = useMissionStore((s) => s.config);
  const activeThreats = useMissionStore((s) => s.activeThreats);

  // Determine active threat from override or store
  const currentThreat = useMemo(() => {
    if (activeThreatOverride) return activeThreatOverride;
    if (activeThreats && activeThreats.length > 0) {
      return activeThreats[0].type || activeThreats[0].id;
    }
    return null;
  }, [activeThreatOverride, activeThreats]);

  // Determine model type from store config if not explicitly passed
  const activeType = useMemo<SpacecraftModelType>(() => {
    return resolveSpacecraftModelType(modelType, config?.type);
  }, [modelType, config?.type]);

  // Failure mode checks
  const isThermalThreat = currentThreat?.includes('thermal') || currentThreat?.includes('solar');
  const isPowerThreat = currentThreat?.includes('power') || currentThreat?.includes('battery');
  const isCommThreat = currentThreat?.includes('comm') || currentThreat?.includes('signal');
  const isPropulsionThreat = currentThreat?.includes('propulsion') || currentThreat?.includes('debris') || currentThreat?.includes('asteroid');
  const isAttitudeThreat = currentThreat?.includes('attitude');

  // Aerospace materials
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
        emissiveIntensity: 0.8,
        metalness: 0.5,
        roughness: 0.2,
      }),
      threatThermalGlow: new THREE.MeshStandardMaterial({
        color: '#ff3b30',
        emissive: '#ff3b30',
        emissiveIntensity: 1.2,
        roughness: 0.2,
      }),
      threatPowerGlow: new THREE.MeshStandardMaterial({
        color: '#ff9f0a',
        emissive: '#ff9f0a',
        emissiveIntensity: 0.9,
        roughness: 0.3,
      }),
      threatCommGlow: new THREE.MeshStandardMaterial({
        color: '#bf5af2',
        emissive: '#bf5af2',
        emissiveIntensity: 1.0,
        roughness: 0.3,
      }),
    };
  }, []);

  // Solar panel shader with failure flickering support
  const solarPanelShader = useMemo(() => {
    return new THREE.ShaderMaterial({
      uniforms: {
        time: { value: 0 },
        power: { value: 1.0 },
        isFailing: { value: 0.0 },
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
        uniform float isFailing;
        void main() {
          vec2 grid = fract(vUv * vec2(12.0, 6.0));
          float cell = step(0.04, grid.x) * step(0.04, grid.y);
          vec3 baseColor = vec3(0.01, 0.04, 0.16);
          vec3 cellColor = vec3(0.04, 0.12, 0.38);
          if (isFailing > 0.5) {
            float flicker = sin(time * 20.0) * 0.5 + 0.5;
            cellColor = mix(vec3(0.18, 0.08, 0.02), vec3(0.02, 0.02, 0.05), flicker);
          }
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
    solarPanelShader.uniforms.isFailing.value = isPowerThreat ? 1.0 : 0.0;

    if (telemetry) {
      const batteryRatio = (telemetry.power?.batteryPercent ?? 100) / 100;
      solarPanelShader.uniforms.power.value = THREE.MathUtils.lerp(
        solarPanelShader.uniforms.power.value,
        isPowerThreat ? 0.35 : batteryRatio,
        0.05
      );
    }

    if (groupRef.current) {
      if (!interactive) {
        groupRef.current.rotation.y = t * 0.12;
        groupRef.current.rotation.x = Math.sin(t * 0.08) * 0.04;
      }
      // Attitude failure wobble
      if (isAttitudeThreat) {
        groupRef.current.rotation.z += 0.02;
        groupRef.current.rotation.x = Math.sin(t * 4) * 0.25;
      }
    }

    // Solar panels oscillation
    if (solarWingsRef.current) {
      solarWingsRef.current.rotation.y = Math.sin(t * 0.4) * 0.03;
    }

    // High gain antenna slow tracking
    if (dishRef.current) {
      dishRef.current.rotation.y = Math.sin(t * 0.2) * 0.1;
    }

    // Status LED blink
    if (statusLedRef.current) {
      const isNominal = !currentThreat && (!telemetry || telemetry.overallHealth > 70);
      const blinkSpeed = isNominal ? 1.5 : 8.0;
      statusLedRef.current.intensity = Math.sin(t * blinkSpeed) > 0 ? 1.2 : 0.1;
      statusLedRef.current.color.setHex(isNominal ? 0x00ff88 : 0xff3b30);
    }

    // Thruster flame pulsation when propulsion threat or maneuver active
    if (thrusterFlameRef.current) {
      const flameScale = isPropulsionThreat ? Math.sin(t * 25) * 0.4 + 0.9 : 0.0;
      thrusterFlameRef.current.scale.set(flameScale, flameScale, flameScale);
    }

    // Thermal glow pulsation
    if (thermalGlowRef.current) {
      thermalGlowRef.current.intensity = isThermalThreat ? Math.sin(t * 6) * 1.5 + 2.0 : 0.0;
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
    if (isThermalThreat && (name === 'thermal' || name === 'eclss')) {
      return materials.threatThermalGlow;
    }
    if (isPowerThreat && (name === 'power' || name === 'eps')) {
      return materials.threatPowerGlow;
    }
    if (isCommThreat && (name === 'communication' || name === 'comms')) {
      return materials.threatCommGlow;
    }
    if (isPropulsionThreat && name === 'propulsion') {
      return materials.threatThermalGlow;
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
            onClick={(e) => handleSubsystemClick(e, 'Life Support & Crew Module (ECLSS)')}
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
          <mesh
            position={[0, 0.61, 0]}
            material={getSubsystemMat('avionics', materials.antennaWhite)}
            onClick={(e) => handleSubsystemClick(e, 'Docking Adapter & Avionics')}
            onPointerOver={() => setHoveredSubsystem('avionics')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <torusGeometry args={[0.12, 0.02, 12, 32]} />
          </mesh>

          {/* Heat Shield Base (Ablative PICA-X Thermal Protection) */}
          <mesh
            position={[0, 0.08, 0]}
            material={getSubsystemMat('thermal', materials.heatShield)}
            onClick={(e) => handleSubsystemClick(e, 'Ablative Heat Shield (TPS)')}
            onPointerOver={() => setHoveredSubsystem('thermal')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.46, 0.44, 0.06, 32]} />
          </mesh>

          {/* Service Module (Cylindrical Section) */}
          <mesh
            position={[0, -0.28, 0]}
            material={getSubsystemMat('power', materials.bodyTitanium)}
            onClick={(e) => handleSubsystemClick(e, 'Electrical Power System (EPS)')}
            onPointerOver={() => setHoveredSubsystem('power')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.44, 0.44, 0.65, 32]} />
          </mesh>

          {/* Radiator Wrap Strip */}
          <mesh
            position={[0, -0.28, 0]}
            material={getSubsystemMat('thermal', materials.bodyCarbon)}
            onClick={(e) => handleSubsystemClick(e, 'Thermal Radiators (TCS)')}
            onPointerOver={() => setHoveredSubsystem('thermal')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.445, 0.445, 0.3, 32, 1, true]} />
          </mesh>

          {/* Twin Deployable Solar Wings */}
          <group ref={solarWingsRef} position={[0, -0.28, 0]}>
            <mesh
              position={[-0.95, 0, 0]}
              onClick={(e) => handleSubsystemClick(e, 'Solar Array Port (Power EPS)')}
              onPointerOver={() => setHoveredSubsystem('power')}
              onPointerOut={() => setHoveredSubsystem(null)}
            >
              <boxGeometry args={[0.9, 0.02, 0.35]} />
              <primitive object={solarPanelShader} attach="material" />
            </mesh>
            <mesh
              position={[0.95, 0, 0]}
              onClick={(e) => handleSubsystemClick(e, 'Solar Array Starboard (Power EPS)')}
              onPointerOver={() => setHoveredSubsystem('power')}
              onPointerOut={() => setHoveredSubsystem(null)}
            >
              <boxGeometry args={[0.9, 0.02, 0.35]} />
              <primitive object={solarPanelShader} attach="material" />
            </mesh>
          </group>

          {/* Main Service Engine Bell */}
          <mesh
            position={[0, -0.68, 0]}
            material={getSubsystemMat('propulsion', materials.thrusterDark)}
            onClick={(e) => handleSubsystemClick(e, 'Service Propulsion Engine (OMS)')}
            onPointerOver={() => setHoveredSubsystem('propulsion')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.08, 0.22, 0.2, 24]} />
          </mesh>

          {/* Thruster Flame Misfire Mesh */}
          <mesh ref={thrusterFlameRef} position={[0, -0.85, 0]} scale={[0, 0, 0]}>
            <coneGeometry args={[0.18, 0.35, 16]} />
            <meshBasicMaterial color="#ff3b30" transparent opacity={0.8} />
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
            onClick={(e) => handleSubsystemClick(e, 'Avionics & Bus Control (OBC)')}
            onPointerOver={() => setHoveredSubsystem('avionics')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <boxGeometry args={[0.5, 0.4, 0.7]} />
          </mesh>

          {/* Nadir Optical Aperture & Camera Tube */}
          <group
            position={[0, -0.25, 0.15]}
            onClick={(e) => handleSubsystemClick(e, 'Multispectral Optical Camera Payload')}
            onPointerOver={() => setHoveredSubsystem('payload')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
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
            onClick={(e) => handleSubsystemClick(e, 'Synthetic Aperture Radar (SAR)')}
            onPointerOver={() => setHoveredSubsystem('payload')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <boxGeometry args={[0.8, 0.03, 0.4]} />
          </mesh>

          {/* Dual Segment Solar Panels */}
          <group ref={solarWingsRef}>
            <mesh
              position={[-0.95, 0, 0]}
              onClick={(e) => handleSubsystemClick(e, 'Primary Solar Array (EPS)')}
              onPointerOver={() => setHoveredSubsystem('power')}
              onPointerOut={() => setHoveredSubsystem(null)}
            >
              <boxGeometry args={[0.8, 0.02, 0.55]} />
              <primitive object={solarPanelShader} attach="material" />
            </mesh>
            <mesh
              position={[0.95, 0, 0]}
              onClick={(e) => handleSubsystemClick(e, 'Secondary Solar Array (EPS)')}
              onPointerOver={() => setHoveredSubsystem('power')}
              onPointerOut={() => setHoveredSubsystem(null)}
            >
              <boxGeometry args={[0.8, 0.02, 0.55]} />
              <primitive object={solarPanelShader} attach="material" />
            </mesh>
          </group>

          {/* Star Tracker Optical Hoods (ADCS) */}
          <mesh
            position={[0.22, 0.22, -0.2]}
            material={getSubsystemMat('adcs', materials.bodyCarbon)}
            onClick={(e) => handleSubsystemClick(e, 'Attitude Determination (ADCS / Star Tracker)')}
            onPointerOver={() => setHoveredSubsystem('adcs')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.03, 0.04, 0.09, 16]} />
          </mesh>

          {/* Thruster Bell */}
          <mesh
            position={[0, 0, -0.42]}
            rotation={[Math.PI / 2, 0, 0]}
            material={getSubsystemMat('propulsion', materials.thrusterDark)}
            onClick={(e) => handleSubsystemClick(e, 'Hydrazine RCS Propulsion')}
            onPointerOver={() => setHoveredSubsystem('propulsion')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.04, 0.12, 0.16, 16]} />
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
            onClick={(e) => handleSubsystemClick(e, 'Deep Space Bus & Computer (OBC)')}
            onPointerOver={() => setHoveredSubsystem('avionics')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.45, 0.45, 0.5, 8]} />
          </mesh>

          {/* Large Parabolic High-Gain Antenna (HGA) */}
          <group
            ref={dishRef}
            position={[0, 0.35, 0]}
            rotation={[-0.3, 0, 0]}
            onClick={(e) => handleSubsystemClick(e, 'Deep Space High-Gain Antenna (Comms X/Ka-band)')}
            onPointerOver={() => setHoveredSubsystem('communication')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <mesh material={getSubsystemMat('communication', materials.antennaWhite)}>
              <cylinderGeometry args={[0.45, 0.08, 0.12, 32, 1, true]} />
            </mesh>
            <mesh position={[0, 0.18, 0]} material={materials.antennaWhite}>
              <cylinderGeometry args={[0.015, 0.02, 0.22, 12]} />
            </mesh>
          </group>

          {/* Magnetometer & Science Instrument Boom */}
          <mesh
            position={[0, -0.1, 0.65]}
            rotation={[Math.PI / 2, 0, 0]}
            material={getSubsystemMat('payload', materials.antennaWhite)}
            onClick={(e) => handleSubsystemClick(e, 'Magnetometer & Plasma Waves (Science Payload)')}
            onPointerOver={() => setHoveredSubsystem('payload')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.02, 0.02, 0.6, 8]} />
          </mesh>

          {/* Bipropellant Main Thruster Bell */}
          <mesh
            position={[0, -0.45, 0]}
            material={getSubsystemMat('propulsion', materials.thrusterDark)}
            onClick={(e) => handleSubsystemClick(e, 'Liquid Apogee Engine (Propulsion)')}
            onPointerOver={() => setHoveredSubsystem('propulsion')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <cylinderGeometry args={[0.06, 0.2, 0.25, 24]} />
          </mesh>

          {/* RTG Thermal Fin Modules */}
          {[-1, 1].map((dir, i) => (
            <mesh
              key={i}
              position={[dir * 0.55, -0.1, 0]}
              material={getSubsystemMat('power', materials.bodyCarbon)}
              onClick={(e) => handleSubsystemClick(e, 'Radioisotope Thermoelectric Generator (RTG)')}
              onPointerOver={() => setHoveredSubsystem('power')}
              onPointerOut={() => setHoveredSubsystem(null)}
            >
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
            onClick={(e) => handleSubsystemClick(e, '2.4m Optical Mirror & Spectrometer Payload')}
            onPointerOver={() => setHoveredSubsystem('payload')}
            onPointerOut={() => setHoveredSubsystem(null)}
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
                onClick={(e) => handleSubsystemClick(e, 'Cryogenic Multi-Layer Sunshield (TCS)')}
                onPointerOver={() => setHoveredSubsystem('thermal')}
                onPointerOut={() => setHoveredSubsystem(null)}
              >
                <planeGeometry args={[1.3 - idx * 0.1, 1.3 - idx * 0.1]} />
              </mesh>
            ))}
          </group>

          {/* Cryocooler Radiator Strip */}
          <mesh
            position={[0.31, 0.1, 0]}
            material={getSubsystemMat('thermal', materials.bodyCarbon)}
            onClick={(e) => handleSubsystemClick(e, 'Cryocooler Thermal Radiators')}
            onPointerOver={() => setHoveredSubsystem('thermal')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
            <boxGeometry args={[0.04, 0.45, 0.25]} />
          </mesh>

          {/* Comms Gimbal Dish */}
          <mesh
            position={[0, -0.48, 0.35]}
            material={getSubsystemMat('communication', materials.antennaWhite)}
            onClick={(e) => handleSubsystemClick(e, 'Gimballed Space-to-Ground Comms Dish')}
            onPointerOver={() => setHoveredSubsystem('communication')}
            onPointerOut={() => setHoveredSubsystem(null)}
          >
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

      {/* Thermal Threat Pulsing Light */}
      <pointLight
        ref={thermalGlowRef}
        position={[0, 0, 0]}
        intensity={0}
        distance={4.0}
        color="#ff3b30"
      />
    </group>
  );
}
