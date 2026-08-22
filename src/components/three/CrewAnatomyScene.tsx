import React, { useMemo, useRef, useState } from "react";
import { Canvas, useFrame } from "@react-three/fiber";
import { OrbitControls, PerspectiveCamera } from "@react-three/drei";
import * as THREE from "three";
import type { CrewMember } from "../../types/mission";

export type PhysiologicalMode =
  | "temperature"
  | "pressure"
  | "cardio"
  | "respiratory"
  | "fatigue"
  | "radiation"
  | "eclss";

export type BodyRegionId =
  | "head"
  | "chest"
  | "plss"
  | "abdomen"
  | "arm_left"
  | "arm_right"
  | "hand_left"
  | "hand_right"
  | "hips"
  | "leg_left"
  | "leg_right"
  | "feet";

export interface BodyRegionData {
  id: BodyRegionId;
  name: string;
  temperature: number;
  tempRange: [number, number];
  pressureKpa: number;
  pressureRange: [number, number];
  muscleFatigue: number;
  radiationDose: number;
  status: "nominal" | "caution" | "warning" | "critical";
  description: string;
}

// ─── Color Helper Functions ──────────────────────────────────────────────
export function getThermalColor(tempC: number): string {
  if (tempC < 35.0) return "#00d4ff"; // Hypothermia
  if (tempC < 36.5) return "#00aaff"; // Mild Cool
  if (tempC <= 37.5) return "#00ff88"; // Nominal Core
  if (tempC <= 38.2) return "#ff8c00"; // Elevated
  return "#ff2d55"; // Hyperthermia / Fever
}

export function getPressureColor(pressureKpa: number): string {
  if (pressureKpa < 18) return "#00ff88"; // Low/Nominal
  if (pressureKpa < 28) return "#00d4ff"; // Normal suit pressure
  if (pressureKpa < 38) return "#ff8c00"; // High contact load
  return "#ff2d55"; // Critical pressure point
}

export function getVitalColor(v: number, warn: number, crit: number, invert = false): string {
  if (invert) {
    if (v <= crit) return "#ff2d55";
    if (v <= warn) return "#ff8c00";
    return "#00ff88";
  }
  if (v >= crit) return "#ff2d55";
  if (v >= warn) return "#ff8c00";
  return "#00ff88";
}

// ─── 3D Hotspot Pin Component ─────────────────────────────────────────────
function HotspotPin({
  position,
  label,
  value,
  color,
  active,
  onClick,
}: {
  position: [number, number, number];
  label: string;
  value: string;
  color: string;
  active: boolean;
  onClick: () => void;
}) {
  const meshRef = useRef<THREE.Mesh>(null);
  const ringRef = useRef<THREE.Mesh>(null);

  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    if (meshRef.current) {
      meshRef.current.scale.setScalar(active ? 1.3 : 1 + Math.sin(t * 4) * 0.15);
    }
    if (ringRef.current) {
      ringRef.current.rotation.z = t * 1.5;
      ringRef.current.scale.setScalar(1 + Math.sin(t * 3) * 0.2);
    }
  });

  return (
    <group position={position}>
      {/* Interactive Clickable Sphere */}
      <mesh ref={meshRef} onClick={(e) => { e.stopPropagation(); onClick(); }}>
        <sphereGeometry args={[0.065, 16, 16]} />
        <meshStandardMaterial
          color={color}
          emissive={color}
          emissiveIntensity={active ? 1.5 : 0.6}
          roughness={0.2}
          metalness={0.8}
        />
      </mesh>

      {/* Pulsing Target Ring */}
      <mesh ref={ringRef} rotation={[Math.PI / 2, 0, 0]}>
        <torusGeometry args={[0.11, 0.009, 8, 32]} />
        <meshBasicMaterial color={color} transparent opacity={active ? 0.9 : 0.5} />
      </mesh>

      {/* Floating Light */}
      <pointLight color={color} intensity={active ? 3 : 1.2} distance={0.8} />
    </group>
  );
}

// ─── Procedural Spacesuit Astronaut Mesh Assembly ───────────────────────────
function AstronautSpacesuit({
  member,
  mode,
  selectedRegion,
  onSelectRegion,
  xRay,
  showHotspots,
}: {
  member: CrewMember | null;
  mode: PhysiologicalMode;
  selectedRegion: BodyRegionId | null;
  onSelectRegion: (id: BodyRegionId) => void;
  xRay: boolean;
  showHotspots: boolean;
}) {
  const suitGroup = useRef<THREE.Group>(null);
  const heartRef = useRef<THREE.Mesh>(null);
  const lungsRef = useRef<THREE.Group>(null);

  const hr = member?.heartRateBpm ?? 72;
  const resp = member?.respirationBpm ?? 14;
  const coreTemp = member?.coreTempC ?? 36.8;
  const spo2 = member?.spo2Percent ?? 99;
  const stress = member?.stressIndex ?? 18;
  const fatigue = member?.fatigueIndex ?? 15;
  const rad = member?.radiationDoseMsv ?? 0.12;
  const suitPress = member?.suitPressureKpa ?? 29.6;

  // Breathing and heartbeat animation
  useFrame(({ clock }) => {
    const t = clock.getElapsedTime();
    // Respiration expansion
    const breatheRate = (resp / 60) * Math.PI * 2;
    const breatheDelta = Math.sin(t * breatheRate) * 0.02;
    if (lungsRef.current) {
      lungsRef.current.scale.set(1 + breatheDelta * 1.5, 1 + breatheDelta, 1 + breatheDelta * 2);
    }
    // Heartbeat pulsing
    const heartBps = (hr / 60) * Math.PI * 2;
    const heartBeat = Math.pow(Math.sin(t * heartBps), 4) * 0.35;
    if (heartRef.current) {
      heartRef.current.scale.setScalar(1 + heartBeat);
    }
  });

  // Calculate Region Telemetry Values
  const regionData: Record<BodyRegionId, BodyRegionData> = useMemo(() => {
    return {
      head: {
        id: "head",
        name: "Helmet & Cranial Complex",
        temperature: coreTemp + 0.1,
        tempRange: [36.5, 37.5],
        pressureKpa: 22.4,
        pressureRange: [18.0, 26.0],
        muscleFatigue: stress * 0.8,
        radiationDose: rad * 1.1,
        status: stress > 60 ? "warning" : "nominal",
        description: "Helmet neck-ring seal, cranial perfusion, EEG stress index, and ocular HUD interface.",
      },
      chest: {
        id: "chest",
        name: "Hard Upper Torso (Cardio/Pulmonary)",
        temperature: coreTemp,
        tempRange: [36.6, 37.4],
        pressureKpa: 31.2,
        pressureRange: [24.0, 36.0],
        muscleFatigue: fatigue * 0.6,
        radiationDose: rad,
        status: hr > 100 || spo2 < 95 ? "critical" : "nominal",
        description: "HUT chest cuirass, cardiac chamber, pulmonary gas exchange, and DCM controls.",
      },
      plss: {
        id: "plss",
        name: "Primary Life Support System (PLSS)",
        temperature: 16.4,
        tempRange: [12.0, 22.0],
        pressureKpa: suitPress,
        pressureRange: [28.0, 32.0],
        muscleFatigue: 0,
        radiationDose: rad * 0.7,
        status: suitPress < 24 ? "critical" : "nominal",
        description: "Dual high-pressure O2 cylinders, sublimator cooling loop, battery power, and CO2 scrubber.",
      },
      abdomen: {
        id: "abdomen",
        name: "Lower Abdomen & Core Viscera",
        temperature: coreTemp - 0.2,
        tempRange: [36.4, 37.3],
        pressureKpa: 24.1,
        pressureRange: [20.0, 30.0],
        muscleFatigue: fatigue * 0.7,
        radiationDose: rad * 0.9,
        status: "nominal",
        description: "Core hydration reserves, gastrointestinal perfusion, and waist articulation ring.",
      },
      arm_left: {
        id: "arm_left",
        name: "Left Arm Assembly & Rotary Bearings",
        temperature: coreTemp - 1.2,
        tempRange: [34.5, 36.5],
        pressureKpa: 28.6,
        pressureRange: [20.0, 34.0],
        muscleFatigue: fatigue,
        radiationDose: rad * 1.05,
        status: fatigue > 70 ? "caution" : "nominal",
        description: "Shoulder dual-axis bearing, forearm telemetry status sleeve, and thermal sleeve.",
      },
      arm_right: {
        id: "arm_right",
        name: "Right Arm Assembly",
        temperature: coreTemp - 1.1,
        tempRange: [34.5, 36.5],
        pressureKpa: 27.9,
        pressureRange: [20.0, 34.0],
        muscleFatigue: fatigue * 1.1,
        radiationDose: rad * 1.05,
        status: fatigue > 70 ? "caution" : "nominal",
        description: "Shoulder rotary bearing, elbow flex joint, and robotic teleoperation arm.",
      },
      hand_left: {
        id: "hand_left",
        name: "Left Extravehicular Phase VI Glove",
        temperature: coreTemp - 2.8,
        tempRange: [32.0, 35.5],
        pressureKpa: 34.8,
        pressureRange: [22.0, 40.0],
        muscleFatigue: fatigue * 1.2,
        radiationDose: rad * 1.2,
        status: "nominal",
        description: "Silicone palm grip, active resistive fingertip heaters, and wrist quick-disconnect.",
      },
      hand_right: {
        id: "hand_right",
        name: "Right Extravehicular Phase VI Glove",
        temperature: coreTemp - 2.6,
        tempRange: [32.0, 35.5],
        pressureKpa: 36.2,
        pressureRange: [22.0, 40.0],
        muscleFatigue: fatigue * 1.3,
        radiationDose: rad * 1.2,
        status: fatigue > 75 ? "warning" : "nominal",
        description: "Tactile load sensors, fingertip thermal pads, and tool lanyard carabiner.",
      },
      hips: {
        id: "hips",
        name: "Lower Torso Assembly (LTA) & Hips",
        temperature: coreTemp - 0.6,
        tempRange: [35.5, 37.0],
        pressureKpa: 32.5,
        pressureRange: [22.0, 38.0],
        muscleFatigue: fatigue * 0.8,
        radiationDose: rad * 0.85,
        status: "nominal",
        description: "Flexible waist bearing, seat harness restraint anchors, and bio-waste umbilical.",
      },
      leg_left: {
        id: "leg_left",
        name: "Left Leg & Knee Articulation",
        temperature: coreTemp - 1.4,
        tempRange: [34.0, 36.5],
        pressureKpa: 26.4,
        pressureRange: [18.0, 35.0],
        muscleFatigue: fatigue * 0.9,
        radiationDose: rad * 0.95,
        status: "nominal",
        description: "Dual-axis knee joint bellows, TMG gaiter, and thigh pocket utility pouches.",
      },
      leg_right: {
        id: "leg_right",
        name: "Right Leg Assembly",
        temperature: coreTemp - 1.3,
        tempRange: [34.0, 36.5],
        pressureKpa: 27.1,
        pressureRange: [18.0, 35.0],
        muscleFatigue: fatigue * 0.9,
        radiationDose: rad * 0.95,
        status: "nominal",
        description: "Lower leg pressure restraint layer, knee articulation ring, and tether anchor.",
      },
      feet: {
        id: "feet",
        name: "Lunar / Orbital EVA Traction Boots",
        temperature: coreTemp - 3.2,
        tempRange: [31.0, 35.0],
        pressureKpa: 42.1,
        pressureRange: [20.0, 50.0],
        muscleFatigue: fatigue * 0.75,
        radiationDose: rad * 1.3,
        status: "nominal",
        description: "Reinforced silicone tread sole, heel locking lugs, and thermal insulation bootie.",
      },
    };
  }, [coreTemp, hr, spo2, stress, fatigue, rad, suitPress]);

  // Compute color based on current active visualization mode
  const getRegionColor = (id: BodyRegionId): string => {
    const data = regionData[id];
    if (selectedRegion === id) return "#00d4ff"; // Active selection highlight
    if (data.status === "critical") return "#ff2d55";
    if (data.status === "warning") return "#ff8c00";

    switch (mode) {
      case "temperature":
        return getThermalColor(data.temperature);
      case "pressure":
        return getPressureColor(data.pressureKpa);
      case "cardio":
        return id === "chest" ? getVitalColor(hr, 95, 115) : "#1c324a";
      case "respiratory":
        return id === "chest" || id === "head" ? getVitalColor(100 - spo2, 4, 8) : "#182c40";
      case "fatigue":
        return getVitalColor(data.muscleFatigue, 50, 75);
      case "radiation":
        return getVitalColor(data.radiationDose * 50, 40, 80);
      case "eclss":
        return id === "plss" || id === "chest" ? "#00ff88" : "#1a3550";
      default:
        return "#1f3a58";
    }
  };

  // Base Suit Material generator
  const createSuitMaterial = (id: BodyRegionId) => {
    const color = getRegionColor(id);
    const isSelected = selectedRegion === id;
    return new THREE.MeshStandardMaterial({
      color: new THREE.Color(color),
      roughness: xRay ? 0.2 : 0.45,
      metalness: xRay ? 0.8 : 0.35,
      transparent: xRay,
      opacity: xRay ? 0.35 : (isSelected ? 1.0 : 0.92),
      wireframe: xRay,
      emissive: isSelected ? new THREE.Color(color) : new THREE.Color(0x000000),
      emissiveIntensity: isSelected ? 0.6 : 0.0,
    });
  };

  return (
    <group ref={suitGroup} position={[0, -1.0, 0]}>
      {/* ─── 1. HELMET & VISOR COMPLEX (Head) ─── */}
      <group position={[0, 2.7, 0]} onClick={(e) => { e.stopPropagation(); onSelectRegion("head"); }}>
        {/* Outer Helmet Shell */}
        <mesh material={createSuitMaterial("head")}>
          <sphereGeometry args={[0.26, 32, 32]} />
        </mesh>

        {/* Gold Reflective Extravehicular Visor */}
        <mesh position={[0, 0.02, 0.08]} rotation={[0.1, 0, 0]}>
          <sphereGeometry args={[0.24, 32, 16, 0, Math.PI, 0, Math.PI * 0.75]} />
          <meshStandardMaterial
            color="#ffd700"
            roughness={0.08}
            metalness={0.95}
            transparent={xRay}
            opacity={xRay ? 0.25 : 0.95}
          />
        </mesh>

        {/* Helmet Locking Ring (Neck) */}
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.2, 0.21, 0.06, 32]} />
          <meshStandardMaterial color="#00d4ff" roughness={0.3} metalness={0.8} />
        </mesh>

        {/* Cranial Holographic Brain inside (X-Ray mode) */}
        {xRay && (
          <mesh position={[0, 0.05, 0]}>
            <sphereGeometry args={[0.12, 16, 16]} />
            <meshBasicMaterial color={getVitalColor(stress, 50, 75)} wireframe />
          </mesh>
        )}
      </group>

      {/* ─── 2. HARD UPPER TORSO (HUT / Chest) ─── */}
      <group position={[0, 1.95, 0]} onClick={(e) => { e.stopPropagation(); onSelectRegion("chest"); }}>
        {/* Main Chest Cuirass */}
        <mesh material={createSuitMaterial("chest")} castShadow>
          <cylinderGeometry args={[0.34, 0.3, 0.75, 24]} />
        </mesh>

        {/* Displays & Control Module (DCM) on Chest */}
        <mesh position={[0, 0.05, 0.32]}>
          <boxGeometry args={[0.26, 0.28, 0.08]} />
          <meshStandardMaterial color="#081422" metalness={0.85} roughness={0.2} />
        </mesh>
        {/* DCM Display Screen */}
        <mesh position={[0, 0.08, 0.365]}>
          <planeGeometry args={[0.2, 0.12]} />
          <meshBasicMaterial color="#00ff88" transparent opacity={0.8} />
        </mesh>

        {/* Mission Patch / ISRO-NASA Emblem */}
        <mesh position={[-0.14, 0.2, 0.31]} rotation={[0, -0.2, 0]}>
          <circleGeometry args={[0.045, 16]} />
          <meshBasicMaterial color="#00d4ff" />
        </mesh>

        {/* X-Ray: Beating Cardiac Chamber */}
        <mesh ref={heartRef} position={[-0.08, 0.12, 0.08]}>
          <sphereGeometry args={[0.075, 16, 16]} />
          <meshBasicMaterial color={getVitalColor(hr, 95, 115)} transparent opacity={0.9} />
        </mesh>

        {/* X-Ray: Pulmonary Lung Lobes */}
        <group ref={lungsRef} position={[0, 0.1, 0.02]}>
          <mesh position={[-0.12, 0, 0]}>
            <capsuleGeometry args={[0.065, 0.22, 6, 12]} />
            <meshBasicMaterial color={getVitalColor(100 - spo2, 4, 8)} transparent opacity={0.7} />
          </mesh>
          <mesh position={[0.12, 0, 0]}>
            <capsuleGeometry args={[0.065, 0.22, 6, 12]} />
            <meshBasicMaterial color={getVitalColor(100 - spo2, 4, 8)} transparent opacity={0.7} />
          </mesh>
        </group>
      </group>

      {/* ─── 3. PRIMARY LIFE SUPPORT SYSTEM (PLSS Backpack) ─── */}
      <group position={[0, 2.05, -0.34]} onClick={(e) => { e.stopPropagation(); onSelectRegion("plss"); }}>
        {/* Main Backpack Housing */}
        <mesh material={createSuitMaterial("plss")}>
          <boxGeometry args={[0.48, 0.72, 0.28]} />
        </mesh>

        {/* High-Pressure Dual Oxygen Cylinders */}
        <mesh position={[-0.14, 0.08, 0.12]}>
          <cylinderGeometry args={[0.065, 0.065, 0.52, 16]} />
          <meshStandardMaterial color="#00ff88" metalness={0.7} roughness={0.3} />
        </mesh>
        <mesh position={[0.14, 0.08, 0.12]}>
          <cylinderGeometry args={[0.065, 0.065, 0.52, 16]} />
          <meshStandardMaterial color="#00ff88" metalness={0.7} roughness={0.3} />
        </mesh>

        {/* Sublimator Radiator Top Vent */}
        <mesh position={[0, 0.38, 0]}>
          <boxGeometry args={[0.36, 0.08, 0.22]} />
          <meshStandardMaterial color="#ff8c00" metalness={0.9} roughness={0.2} />
        </mesh>

        {/* Comms Antenna Mast */}
        <mesh position={[0.2, 0.52, -0.05]}>
          <cylinderGeometry args={[0.008, 0.008, 0.38, 8]} />
          <meshStandardMaterial color="#00d4ff" />
        </mesh>
      </group>

      {/* ─── 4. LOWER ABDOMEN & WAIST ─── */}
      <group position={[0, 1.42, 0]} onClick={(e) => { e.stopPropagation(); onSelectRegion("abdomen"); }}>
        <mesh material={createSuitMaterial("abdomen")}>
          <cylinderGeometry args={[0.29, 0.28, 0.36, 24]} />
        </mesh>
        {/* Utility Belt & Tool Loops */}
        <mesh position={[0, -0.14, 0]}>
          <torusGeometry args={[0.3, 0.035, 8, 24]} />
          <meshStandardMaterial color="#00d4ff" metalness={0.8} />
        </mesh>
      </group>

      {/* ─── 5. LEFT ARM & GLOVE ─── */}
      <group position={[-0.48, 2.15, 0]}>
        {/* Shoulder Joint Bearing */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#00d4ff" metalness={0.8} />
        </mesh>
        {/* Upper Arm & Elbow */}
        <group onClick={(e) => { e.stopPropagation(); onSelectRegion("arm_left"); }}>
          <mesh position={[-0.14, -0.28, 0]} rotation={[0, 0, 0.25]} material={createSuitMaterial("arm_left")}>
            <capsuleGeometry args={[0.09, 0.44, 8, 16]} />
          </mesh>
          {/* Forearm Telemetry Cuff */}
          <mesh position={[-0.26, -0.58, 0.04]} rotation={[0, 0, 0.15]} material={createSuitMaterial("arm_left")}>
            <capsuleGeometry args={[0.08, 0.36, 8, 16]} />
          </mesh>
          {/* Left Wrist Computer Screen */}
          <mesh position={[-0.28, -0.62, 0.12]} rotation={[0.4, 0, 0.2]}>
            <planeGeometry args={[0.08, 0.12]} />
            <meshBasicMaterial color="#00d4ff" />
          </mesh>
        </group>
        {/* Extravehicular Glove */}
        <group position={[-0.32, -0.84, 0.05]} onClick={(e) => { e.stopPropagation(); onSelectRegion("hand_left"); }}>
          <mesh material={createSuitMaterial("hand_left")}>
            <boxGeometry args={[0.09, 0.16, 0.12]} />
          </mesh>
          {/* Glove Wrist Ring */}
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.03, 16]} />
            <meshStandardMaterial color="#00aaff" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ─── 6. RIGHT ARM & GLOVE ─── */}
      <group position={[0.48, 2.15, 0]}>
        {/* Shoulder Joint */}
        <mesh position={[0, 0, 0]}>
          <sphereGeometry args={[0.12, 16, 16]} />
          <meshStandardMaterial color="#00d4ff" metalness={0.8} />
        </mesh>
        {/* Upper Arm & Elbow */}
        <group onClick={(e) => { e.stopPropagation(); onSelectRegion("arm_right"); }}>
          <mesh position={[0.14, -0.28, 0]} rotation={[0, 0, -0.25]} material={createSuitMaterial("arm_right")}>
            <capsuleGeometry args={[0.09, 0.44, 8, 16]} />
          </mesh>
          {/* Forearm */}
          <mesh position={[0.26, -0.58, 0.04]} rotation={[0, 0, -0.15]} material={createSuitMaterial("arm_right")}>
            <capsuleGeometry args={[0.08, 0.36, 8, 16]} />
          </mesh>
        </group>
        {/* Glove */}
        <group position={[0.32, -0.84, 0.05]} onClick={(e) => { e.stopPropagation(); onSelectRegion("hand_right"); }}>
          <mesh material={createSuitMaterial("hand_right")}>
            <boxGeometry args={[0.09, 0.16, 0.12]} />
          </mesh>
          <mesh position={[0, 0.08, 0]}>
            <cylinderGeometry args={[0.085, 0.085, 0.03, 16]} />
            <meshStandardMaterial color="#ff2d55" metalness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ─── 7. HIPS & LOWER TORSO ASSEMBLY (LTA) ─── */}
      <group position={[0, 1.15, 0]} onClick={(e) => { e.stopPropagation(); onSelectRegion("hips"); }}>
        <mesh material={createSuitMaterial("hips")}>
          <cylinderGeometry args={[0.28, 0.26, 0.28, 24]} />
        </mesh>
      </group>

      {/* ─── 8. LEFT LEG & TRACTION BOOT ─── */}
      <group position={[-0.18, 1.0, 0]}>
        <group onClick={(e) => { e.stopPropagation(); onSelectRegion("leg_left"); }}>
          {/* Thigh Segment */}
          <mesh position={[0, -0.32, 0]} material={createSuitMaterial("leg_left")}>
            <capsuleGeometry args={[0.115, 0.52, 8, 16]} />
          </mesh>
          {/* Knee Rotary Joint */}
          <mesh position={[0, -0.62, 0.02]}>
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial color="#00d4ff" metalness={0.8} />
          </mesh>
          {/* Lower Shin / Gaiter */}
          <mesh position={[0, -0.92, 0]} material={createSuitMaterial("leg_left")}>
            <capsuleGeometry args={[0.105, 0.48, 8, 16]} />
          </mesh>
        </group>
        {/* Boot */}
        <group position={[0, -1.22, 0.06]} onClick={(e) => { e.stopPropagation(); onSelectRegion("feet"); }}>
          <mesh material={createSuitMaterial("feet")}>
            <boxGeometry args={[0.18, 0.16, 0.32]} />
          </mesh>
          {/* Heavy Traction Sole */}
          <mesh position={[0, -0.09, 0]}>
            <boxGeometry args={[0.2, 0.04, 0.34]} />
            <meshStandardMaterial color="#030812" roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ─── 9. RIGHT LEG & TRACTION BOOT ─── */}
      <group position={[0.18, 1.0, 0]}>
        <group onClick={(e) => { e.stopPropagation(); onSelectRegion("leg_right"); }}>
          {/* Thigh */}
          <mesh position={[0, -0.32, 0]} material={createSuitMaterial("leg_right")}>
            <capsuleGeometry args={[0.115, 0.52, 8, 16]} />
          </mesh>
          {/* Knee */}
          <mesh position={[0, -0.62, 0.02]}>
            <sphereGeometry args={[0.11, 16, 16]} />
            <meshStandardMaterial color="#00d4ff" metalness={0.8} />
          </mesh>
          {/* Lower Shin */}
          <mesh position={[0, -0.92, 0]} material={createSuitMaterial("leg_right")}>
            <capsuleGeometry args={[0.105, 0.48, 8, 16]} />
          </mesh>
        </group>
        {/* Boot */}
        <group position={[0, -1.22, 0.06]} onClick={(e) => { e.stopPropagation(); onSelectRegion("feet"); }}>
          <mesh material={createSuitMaterial("feet")}>
            <boxGeometry args={[0.18, 0.16, 0.32]} />
          </mesh>
          <mesh position={[0, -0.09, 0]}>
            <boxGeometry args={[0.2, 0.04, 0.34]} />
            <meshStandardMaterial color="#030812" roughness={0.9} />
          </mesh>
        </group>
      </group>

      {/* ─── 10. 3D HOTSPOT PINS (Interactive Physiological Markers) ─── */}
      {showHotspots && (
        <>
          <HotspotPin
            position={[0, 2.76, 0.28]}
            label="Brain / Cognitive"
            value={`${stress}%`}
            color={getVitalColor(stress, 50, 75)}
            active={selectedRegion === "head"}
            onClick={() => onSelectRegion("head")}
          />
          <HotspotPin
            position={[-0.1, 2.05, 0.38]}
            label="Heart Rate"
            value={`${hr} BPM`}
            color={getVitalColor(hr, 95, 115)}
            active={selectedRegion === "chest"}
            onClick={() => onSelectRegion("chest")}
          />
          <HotspotPin
            position={[0.12, 2.05, 0.38]}
            label="SpO2 / Lungs"
            value={`${spo2}%`}
            color={getVitalColor(100 - spo2, 4, 8)}
            active={selectedRegion === "chest"}
            onClick={() => onSelectRegion("chest")}
          />
          <HotspotPin
            position={[0, 2.1, -0.52]}
            label="PLSS O2 Loop"
            value={`${suitPress} kPa`}
            color="#00ff88"
            active={selectedRegion === "plss"}
            onClick={() => onSelectRegion("plss")}
          />
          <HotspotPin
            position={[-0.8, 1.3, 0.1]}
            label="Glove Sensors"
            value="34.8 kPa"
            color="#00d4ff"
            active={selectedRegion === "hand_left"}
            onClick={() => onSelectRegion("hand_left")}
          />
          <HotspotPin
            position={[0, -0.22, 0.24]}
            label="Footbed Load"
            value="42.1 kPa"
            color="#00ff88"
            active={selectedRegion === "feet"}
            onClick={() => onSelectRegion("feet")}
          />
        </>
      )}

      {/* ─── 11. GROUND PROJECTION HUD ─── */}
      <mesh position={[0, -0.32, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <ringGeometry args={[0.65, 1.2, 32]} />
        <meshBasicMaterial color="#00d4ff" transparent opacity={0.12} wireframe />
      </mesh>
    </group>
  );
}

// ─── Main Scene Export ───────────────────────────────────────────────────
export function CrewAnatomyScene({
  member,
  mode = "temperature",
  selectedRegion,
  onSelectRegion,
  xRay = false,
  showHotspots = true,
  autoRotate = true,
  height = 560,
}: {
  member: CrewMember | null;
  mode?: PhysiologicalMode;
  selectedRegion: BodyRegionId | null;
  onSelectRegion: (id: BodyRegionId) => void;
  xRay?: boolean;
  showHotspots?: boolean;
  autoRotate?: boolean;
  height?: number | string;
}) {
  return (
    <div style={{ width: "100%", height, position: "relative", borderRadius: 12, overflow: "hidden", background: "radial-gradient(ellipse at 50% 35%, #08172c 0%, #020409 75%)", border: "1px solid rgba(0,212,255,0.2)" }}>
      <Canvas dpr={[1, 2]}>
        <PerspectiveCamera makeDefault position={[0, 1.4, 4.4]} fov={38} />
        
        {/* Lights */}
        <ambientLight intensity={0.65} />
        <directionalLight position={[4, 6, 5]} intensity={1.4} color="#ffffff" />
        <directionalLight position={[-4, 2, -3]} intensity={0.6} color="#00d4ff" />
        <directionalLight position={[0, -4, 2]} intensity={0.25} color="#9b5de5" />

        {/* 3D Astronaut Digital Twin */}
        <AstronautSpacesuit
          member={member}
          mode={mode}
          selectedRegion={selectedRegion}
          onSelectRegion={onSelectRegion}
          xRay={xRay}
          showHotspots={showHotspots}
        />

        {/* Interactive Orbit Controls */}
        <OrbitControls
          enablePan={true}
          enableZoom={true}
          minDistance={1.8}
          maxDistance={7.5}
          target={[0, 0.6, 0]}
          autoRotate={autoRotate}
          autoRotateSpeed={0.5}
        />
      </Canvas>

      {/* Floating 3D HUD Watermark */}
      <div style={{ position: "absolute", bottom: 12, left: 16, fontFamily: "var(--font-mono)", fontSize: 8.5, color: "rgba(0,212,255,0.6)", pointerEvents: "none", letterSpacing: "0.15em" }}>
        DIGITAL TWIN · 360° ORBIT / RAYCAST ACTIVE · {mode.toUpperCase()} OVERLAY
      </div>
    </div>
  );
}

export default CrewAnatomyScene;
