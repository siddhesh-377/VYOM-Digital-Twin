/**
 * VYOM — Space Path & Trajectory Renderer (Phase 4 & 11)
 * Renders observed past trajectories, instantaneous spacecraft position, multi-horizon predicted trajectories,
 * target bodies, and celestial observation vectors with distinct visual shader styling.
 */

import React, { useMemo } from 'react';
import * as THREE from 'three';
import { useMissionStore } from '../../store/missionStore';

interface SpacePathRendererProps {
  showObserved?: boolean;
  showPredicted?: boolean;
  showGroundTrack?: boolean;
  showTargetVector?: boolean;
  orbitRadius?: number;
  inclinationDeg?: number;
}

export function SpacePathRenderer({
  showObserved = true,
  showPredicted = true,
  showGroundTrack = true,
  showTargetVector = true,
  orbitRadius = 3.2,
  inclinationDeg = 51.6,
}: SpacePathRendererProps) {
  const telemetry = useMissionStore((s) => s.telemetry);
  const orbitTrail = useMissionStore((s) => s.orbitTrail);
  const config = useMissionStore((s) => s.config);

  const missionType = config?.type || 'orbital';

  // 1. Observed / Current Orbit Ellipse Geometry
  const observedOrbitGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 256;
    const r = orbitRadius;
    for (let i = 0; i <= segments; i++) {
      const angle = (i / segments) * Math.PI * 2;
      points.push(new THREE.Vector3(Math.cos(angle) * r, 0, Math.sin(angle) * r));
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [orbitRadius]);

  // 2. Predicted Trajectory (Multi-Horizon Dashed Spiral/Ellipse)
  const predictedTrajectoryGeometry = useMemo(() => {
    const points: THREE.Vector3[] = [];
    const segments = 180;
    const rStart = orbitRadius;
    const isInterplanetary = missionType === 'planetary' || missionType === 'astrophysics';

    for (let i = 0; i <= segments; i++) {
      const t = i / segments;
      const angle = t * Math.PI * (isInterplanetary ? 1.5 : 2.5);
      // If interplanetary, trajectory expands outwards towards target
      const r = isInterplanetary
        ? rStart + t * (rStart * 2.2)
        : rStart + Math.sin(t * Math.PI * 4) * 0.05;

      points.push(
        new THREE.Vector3(
          Math.cos(angle) * r,
          Math.sin(angle * 0.3) * (isInterplanetary ? 1.2 : 0.2),
          Math.sin(angle) * r
        )
      );
    }
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [orbitRadius, missionType]);

  // 3. Ground Track Geometry mapped over Earth radius 2.05
  const groundTrackGeometry = useMemo(() => {
    if (!orbitTrail || orbitTrail.length < 2) return null;
    const points = orbitTrail.slice(-120).map((pt) => {
      const phi = (90 - pt.lat) * (Math.PI / 180);
      const theta = (pt.lng + 180) * (Math.PI / 180);
      const r = 2.06;
      return new THREE.Vector3(
        -r * Math.sin(phi) * Math.cos(theta),
        r * Math.cos(phi),
        r * Math.sin(phi) * Math.sin(theta)
      );
    });
    return new THREE.BufferGeometry().setFromPoints(points);
  }, [orbitTrail]);

  // Materials
  const materials = useMemo(() => {
    return {
      observedLine: new THREE.LineBasicMaterial({
        color: '#00d4ff',
        transparent: true,
        opacity: 0.7,
        linewidth: 2,
      }),
      predictedLine: new THREE.LineDashedMaterial({
        color: '#ff9f0a',
        transparent: true,
        opacity: 0.85,
        dashSize: 0.15,
        gapSize: 0.08,
      }),
      groundTrackLine: new THREE.LineBasicMaterial({
        color: '#30d158',
        transparent: true,
        opacity: 0.6,
      }),
      targetVectorLine: new THREE.LineBasicMaterial({
        color: '#bf5af2',
        transparent: true,
        opacity: 0.8,
      }),
    };
  }, []);

  const incRad = (inclinationDeg * Math.PI) / 180;

  return (
    <group>
      {/* ── 1. Observed Orbit Path ── */}
      {showObserved && (
        <group rotation={[0, 0, incRad]}>
          <primitive object={new THREE.Line(observedOrbitGeometry, materials.observedLine)} />
        </group>
      )}

      {/* ── 2. Predicted Trajectory (Multi-Horizon) ── */}
      {showPredicted && (
        <group rotation={[0, 0, incRad]}>
          <primitive object={new THREE.Line(predictedTrajectoryGeometry, materials.predictedLine)} />
        </group>
      )}

      {/* ── 3. Geodetic Ground Track ── */}
      {showGroundTrack && groundTrackGeometry && (
        <primitive object={new THREE.Line(groundTrackGeometry, materials.groundTrackLine)} />
      )}

      {/* ── 4. Planetary Target Body or Astrophysics Observation Target ── */}
      {showTargetVector && missionType === 'planetary' && (
        <group position={[7.5, 1.8, -4.0]}>
          {/* Target Body (e.g. Moon / Mars) */}
          <mesh>
            <sphereGeometry args={[0.6, 32, 32]} />
            <meshStandardMaterial color="#c2c5cc" roughness={0.9} />
          </mesh>
          {/* Target Orbit Ring */}
          <mesh rotation={[Math.PI / 2, 0, 0]}>
            <ringGeometry args={[0.9, 0.93, 32]} />
            <meshBasicMaterial color="#bf5af2" side={THREE.DoubleSide} transparent opacity={0.6} />
          </mesh>
        </group>
      )}

      {showTargetVector && missionType === 'astrophysics' && (
        <group position={[9.0, 5.0, -8.0]}>
          {/* Observation Target Star/Nebula Indicator */}
          <mesh>
            <sphereGeometry args={[0.2, 16, 16]} />
            <meshBasicMaterial color="#ff2d55" />
          </mesh>
          <pointLight color="#ff2d55" intensity={1.5} distance={10} />
          {/* Pointing Reticle */}
          <mesh rotation={[0, Math.PI / 4, 0]}>
            <ringGeometry args={[0.4, 0.44, 16]} />
            <meshBasicMaterial color="#ff2d55" side={THREE.DoubleSide} transparent opacity={0.8} />
          </mesh>
        </group>
      )}
    </group>
  );
}
