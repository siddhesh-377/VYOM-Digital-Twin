import React, { useState, useEffect, useRef, useMemo, useCallback } from 'react';
import { Canvas, useFrame } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import * as THREE from 'three';
import { useMissionStore } from '../../store/missionStore';
import { StarField } from '../three/SpaceScene';

// ─── PROCEDURAL HIGH-RESOLUTION TEXTURE GENERATORS ─────────────────────────────

// Generate High-Resolution Equirectangular Earth Surface Texture
function createProceduralEarthTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 2048;
  canvas.height = 1024;
  const ctx = canvas.getContext('2d')!;

  // Deep Ocean Gradient
  const oceanGrad = ctx.createLinearGradient(0, 0, 0, canvas.height);
  oceanGrad.addColorStop(0, '#0a2342');
  oceanGrad.addColorStop(0.5, '#051937');
  oceanGrad.addColorStop(1, '#0a2342');
  ctx.fillStyle = oceanGrad;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Continental Shapes & Biomes (Procedural geography approximation)
  function drawContinent(cx: number, cy: number, rx: number, ry: number, baseColor: string, detailColor: string) {
    ctx.fillStyle = baseColor;
    ctx.beginPath();
    for (let angle = 0; angle < Math.PI * 2; angle += 0.08) {
      const r = 1 + Math.sin(angle * 5) * 0.15 + Math.cos(angle * 8) * 0.1;
      const x = cx + Math.cos(angle) * rx * r;
      const y = cy + Math.sin(angle) * ry * r;
      if (angle === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();

    // Biome vegetation / mountain highlights
    ctx.fillStyle = detailColor;
    ctx.beginPath();
    for (let angle = 0; angle < Math.PI * 2; angle += 0.12) {
      const r = 0.6 + Math.sin(angle * 7) * 0.1;
      const x = cx + Math.cos(angle) * (rx * 0.6) * r;
      const y = cy + Math.sin(angle) * (ry * 0.6) * r;
      if (angle === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fill();
  }

  // Eurasia & India
  drawContinent(1300, 360, 340, 160, '#2d5a27', '#4f772d');
  drawContinent(1380, 480, 90, 80, '#588157', '#38b000'); // Indian subcontinent

  // Africa & Sahara
  drawContinent(1050, 520, 180, 210, '#c28d4b', '#283618');

  // Americas
  drawContinent(520, 360, 200, 150, '#31572c', '#4f772d'); // North America
  drawContinent(640, 640, 140, 200, '#132a13', '#38b000'); // South America (Amazon rainforest)

  // Australia
  drawContinent(1680, 680, 120, 90, '#bc6c25', '#dda15e');

  // Polar Ice Caps
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, 45);
  ctx.fillRect(0, canvas.height - 55, canvas.width, 55);

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.ClampToEdgeWrapping;
  return texture;
}

// Generate Realistic Earth Cloud Map
function createProceduralCloudTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 512;
  const ctx = canvas.getContext('2d')!;

  ctx.fillStyle = 'rgba(0,0,0,0)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Cloud bands & swirling cyclone patterns
  ctx.fillStyle = 'rgba(255, 255, 255, 0.45)';
  for (let i = 0; i < 45; i++) {
    const x = Math.random() * canvas.width;
    const y = 80 + Math.random() * (canvas.height - 160);
    const r = 25 + Math.random() * 60;
    const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
    grad.addColorStop(0, 'rgba(255,255,255,0.7)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.3)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  return texture;
}

// Generate High-Efficiency Triple-Junction Solar Cell Texture
function createSolarCellTexture(): THREE.CanvasTexture {
  const canvas = document.createElement('canvas');
  canvas.width = 256;
  canvas.height = 256;
  const ctx = canvas.getContext('2d')!;

  // Deep Gallium Arsenide blue
  ctx.fillStyle = '#081329';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Photovoltaic cell grid lines
  ctx.strokeStyle = '#1e3a8a';
  ctx.lineWidth = 1.5;
  for (let x = 0; x < canvas.width; x += 16) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, canvas.height);
    ctx.stroke();
  }
  for (let y = 0; y < canvas.height; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y);
    ctx.lineTo(canvas.width, y);
    ctx.stroke();
  }

  // Silver conductor busbars
  ctx.strokeStyle = '#94a3b8';
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.moveTo(64, 0);
  ctx.lineTo(64, canvas.height);
  ctx.moveTo(192, 0);
  ctx.lineTo(192, canvas.height);
  ctx.stroke();

  const texture = new THREE.CanvasTexture(canvas);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(4, 2);
  return texture;
}

// ─── SYNTHESIZED WEB AUDIO ENGINE ─────────────────────────────────────────────

class SpaceAudioSynthesizer {
  private ctx: AudioContext | null = null;
  private isMuted: boolean = false;

  constructor() {
    // Initialized on first user interaction
  }

  private initCtx() {
    try {
      if (!this.ctx && typeof window !== 'undefined') {
        const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
        if (AudioCtx) {
          this.ctx = new AudioCtx();
        }
      }
      if (this.ctx && this.ctx.state === 'suspended') {
        this.ctx.resume();
      }
    } catch (e) {
      console.warn('AudioContext initialization failed:', e);
    }
  }

  setMuted(muted: boolean) {
    this.isMuted = muted;
  }

  // Deep rocket engine roar
  playRocketRoar(intensity: number = 1) {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();
      const filter = this.ctx.createBiquadFilter();

      osc.type = 'sawtooth';
      osc.frequency.setValueAtTime(45, this.ctx.currentTime);
      osc.frequency.exponentialRampToValueAtTime(80, this.ctx.currentTime + 3);

      filter.type = 'lowpass';
      filter.frequency.setValueAtTime(180, this.ctx.currentTime);

      gain.gain.setValueAtTime(0.01, this.ctx.currentTime);
      gain.gain.linearRampToValueAtTime(0.12 * intensity, this.ctx.currentTime + 0.8);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 4);

      osc.connect(filter);
      filter.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 4.2);
    } catch {
      // Ignore audio sandbox errors
    }
  }

  // Telemetry chirp ping
  playTelemetryPing() {
    if (this.isMuted) return;
    this.initCtx();
    if (!this.ctx) return;

    try {
      const osc = this.ctx.createOscillator();
      const gain = this.ctx.createGain();

      osc.type = 'sine';
      osc.frequency.setValueAtTime(880, this.ctx.currentTime);
      osc.frequency.setValueAtTime(1760, this.ctx.currentTime + 0.08);

      gain.gain.setValueAtTime(0.04, this.ctx.currentTime);
      gain.gain.exponentialRampToValueAtTime(0.001, this.ctx.currentTime + 0.25);

      osc.connect(gain);
      gain.connect(this.ctx.destination);

      osc.start();
      osc.stop(this.ctx.currentTime + 0.3);
    } catch {
      // Ignore
    }
  }
}

const audioSynth = new SpaceAudioSynthesizer();

// ─── 3D HARDWARE & ENVIRONMENT SUB-COMPONENTS ─────────────────────────────────

// Realistic Coastal Spaceport Launch Facility (Scene 1 & 2)
function SpaceportEnvironment({ padSteam = true }: { padSteam?: boolean }) {
  const steamRef = useRef<THREE.Points>(null);

  const steamGeo = useMemo(() => {
    const geo = new THREE.BufferGeometry();
    const count = 180;
    const positions = new Float32Array(count * 3);
    for (let i = 0; i < count; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 5;
      positions[i * 3 + 1] = Math.random() * 6 - 2;
      positions[i * 3 + 2] = (Math.random() - 0.5) * 5;
    }
    geo.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    return geo;
  }, []);

  useFrame((_, delta) => {
    if (steamRef.current && padSteam) {
      const pos = steamRef.current.geometry.attributes.position as THREE.BufferAttribute;
      for (let i = 0; i < pos.count; i++) {
        let y = pos.getY(i) + delta * 2.2;
        if (y > 6.5) y = -2;
        pos.setY(i, y);
      }
      pos.needsUpdate = true;
    }
  });

  return (
    <group position={[0, -2.6, 0]}>
      {/* Heavy Reinforced Concrete Launch Table */}
      <mesh position={[0, -0.6, 0]}>
        <cylinderGeometry args={[8.5, 9.8, 1.2, 32]} />
        <meshStandardMaterial color="#1e293b" roughness={0.9} metalness={0.25} />
      </mesh>

      {/* Flame Deflector Trench */}
      <mesh position={[0, -0.1, 0]}>
        <cylinderGeometry args={[2.4, 2.6, 0.5, 24]} />
        <meshStandardMaterial color="#0b0f19" roughness={1} />
      </mesh>

      {/* Umbilical Service Tower with Truss Lattice */}
      <group position={[3.2, 4.2, -1.8]}>
        <mesh position={[0, 0, 0]}>
          <boxGeometry args={[1.4, 11, 1.4]} />
          <meshStandardMaterial color="#991b1b" metalness={0.6} roughness={0.4} />
        </mesh>
        {/* Retractable Gantry Umbilicals */}
        {[-2.5, 0.2, 3.2].map((yOffset, idx) => (
          <group key={idx} position={[-1.3, yOffset, 0.8]} rotation={[0, 0, -0.12]}>
            <mesh>
              <boxGeometry args={[2.0, 0.28, 0.35]} />
              <meshStandardMaterial color="#f1f5f9" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Cryogenic Supply Lines */}
            <mesh position={[0, -0.2, 0]} rotation={[0, 0, Math.PI / 2]}>
              <cylinderGeometry args={[0.04, 0.04, 1.9, 8]} />
              <meshStandardMaterial color="#38bdf8" metalness={0.9} />
            </mesh>
          </group>
        ))}
      </group>

      {/* Lightning Protection Masts (4x surrounding pad) */}
      {[
        [-5.5, -4],
        [5.5, -4],
        [-5.5, 4],
        [5.5, 4],
      ].map(([x, z], i) => (
        <group key={i} position={[x, 3.5, z]}>
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.08, 0.25, 9, 8]} />
            <meshStandardMaterial color="#cbd5e1" metalness={0.9} roughness={0.2} />
          </mesh>
          <mesh position={[0, 4.6, 0]}>
            <coneGeometry args={[0.08, 0.6, 8]} />
            <meshStandardMaterial color="#dc2626" />
          </mesh>
        </group>
      ))}

      {/* Cryogenic Boil-off Vapor Particles */}
      {padSteam && (
        <points ref={steamRef} geometry={steamGeo}>
          <pointsMaterial size={0.4} color="#e0f2fe" transparent opacity={0.4} depthWrite={false} />
        </points>
      )}
    </group>
  );
}

// Ultra-Realistic Multi-Stage Heavy Launch Vehicle (ISRO/Falcon Heavy Class)
function RealisticLaunchVehicle({
  altitude = 0,
  stage = 1, // 1: Full Stack, 2: Upper Stage Only, 3: Fairing Separating, 4: Satellite Detached
  engineFiring = false,
  flameIntensity = 1,
  showTransonicVapor = false,
}: {
  altitude?: number;
  stage?: number;
  engineFiring?: boolean;
  flameIntensity?: number;
  showTransonicVapor?: boolean;
}) {
  const flameCoreRef = useRef<THREE.Mesh>(null);
  const shockDiamondsRef = useRef<THREE.Group>(null);
  const vaporRef = useRef<THREE.Mesh>(null);

  useFrame((state) => {
    if (flameCoreRef.current && engineFiring) {
      const flicker = flameIntensity * (0.95 + Math.sin(state.clock.elapsedTime * 45) * 0.12);
      flameCoreRef.current.scale.set(flicker, flicker * (1.2 + Math.cos(state.clock.elapsedTime * 35) * 0.25), flicker);
    }
    if (shockDiamondsRef.current && engineFiring) {
      shockDiamondsRef.current.position.y = -3.8 - Math.sin(state.clock.elapsedTime * 30) * 0.1;
    }
    if (vaporRef.current && showTransonicVapor) {
      const vScale = 1 + Math.sin(state.clock.elapsedTime * 20) * 0.08;
      vaporRef.current.scale.set(vScale, 1, vScale);
    }
  });

  return (
    <group position={[0, altitude, 0]}>
      {/* ── STAGE 1 CORE & BOOSTERS ── */}
      {stage === 1 && (
        <group>
          {/* Core Booster Fuselage */}
          <mesh position={[0, 0, 0]}>
            <cylinderGeometry args={[0.75, 0.75, 5.8, 32]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.4} roughness={0.25} />
          </mesh>

          {/* ISRO / VYOM Insignia Bands */}
          <mesh position={[0, 1.4, 0]}>
            <cylinderGeometry args={[0.755, 0.755, 0.5, 32]} />
            <meshStandardMaterial color="#0284c7" metalness={0.6} roughness={0.3} />
          </mesh>
          <mesh position={[0, -1.8, 0]}>
            <cylinderGeometry args={[0.755, 0.755, 0.25, 32]} />
            <meshStandardMaterial color="#f97316" metalness={0.5} roughness={0.3} />
          </mesh>

          {/* Dual Solid Rocket Boosters (Strap-ons) */}
          {[-1.15, 1.15].map((xOffset, idx) => (
            <group key={idx} position={[xOffset, -0.6, 0]}>
              <mesh position={[0, 0, 0]}>
                <cylinderGeometry args={[0.36, 0.36, 4.8, 24]} />
                <meshStandardMaterial color="#ffffff" metalness={0.3} roughness={0.2} />
              </mesh>
              {/* Aerodynamic Canted Nosecone */}
              <mesh position={[0, 2.65, 0]} rotation={[0, 0, idx === 0 ? 0.08 : -0.08]}>
                <coneGeometry args={[0.36, 0.7, 24]} />
                <meshStandardMaterial color="#0f172a" metalness={0.7} roughness={0.2} />
              </mesh>
              {/* Booster Nozzle */}
              <mesh position={[0, -2.6, 0]} rotation={[Math.PI, 0, 0]}>
                <coneGeometry args={[0.3, 0.45, 16]} />
                <meshStandardMaterial color="#1e293b" metalness={0.9} roughness={0.15} />
              </mesh>
            </group>
          ))}

          {/* Core Vikas Engine Bells (Dual Cluster) */}
          {[-0.22, 0.22].map((xOffset, idx) => (
            <mesh key={idx} position={[xOffset, -3.1, 0]} rotation={[Math.PI, 0, 0]}>
              <coneGeometry args={[0.26, 0.55, 20]} />
              <meshStandardMaterial color="#334155" metalness={0.9} roughness={0.1} />
            </mesh>
          ))}
        </group>
      )}

      {/* ── STAGE 2 CRYOGENIC UPPER STAGE ── */}
      {stage <= 2 && (
        <group position={[0, stage === 1 ? 3.6 : 0, 0]}>
          {/* Carbon Fiber Interstage Grid Ring */}
          <mesh position={[0, -0.5, 0]}>
            <cylinderGeometry args={[0.73, 0.73, 0.6, 32]} />
            <meshStandardMaterial color="#090d16" metalness={0.8} roughness={0.3} />
          </mesh>

          {/* Cryogenic LOX/LH2 Tank */}
          <mesh position={[0, 0.65, 0]}>
            <cylinderGeometry args={[0.73, 0.73, 1.7, 32]} />
            <meshStandardMaterial color="#f8fafc" metalness={0.35} roughness={0.25} />
          </mesh>

          {/* Cryogenic Vacuum Engine Bell (Niobium with glowing thermal tint) */}
          <mesh position={[0, -0.95, 0]} rotation={[Math.PI, 0, 0]}>
            <coneGeometry args={[0.46, 0.75, 24]} />
            <meshStandardMaterial color="#475569" metalness={0.9} roughness={0.1} />
          </mesh>
        </group>
      )}

      {/* ── PAYLOAD FAIRING & SATELLITE BAY ── */}
      {stage <= 3 && (
        <group position={[0, stage === 1 ? 5.6 : stage === 2 ? 2.0 : 0.8, 0]}>
          {stage === 3 ? (
            // Fairing halves separating in orbit
            <group>
              <mesh position={[-0.85, 0, 0]} rotation={[0, 0, 0.45]}>
                <coneGeometry args={[0.75, 2.0, 24, 1, false, 0, Math.PI]} />
                <meshStandardMaterial color="#f8fafc" metalness={0.4} roughness={0.2} side={THREE.DoubleSide} />
              </mesh>
              <mesh position={[0.85, 0, 0]} rotation={[0, 0, -0.45]}>
                <coneGeometry args={[0.75, 2.0, 24, 1, false, Math.PI, Math.PI]} />
                <meshStandardMaterial color="#f8fafc" metalness={0.4} roughness={0.2} side={THREE.DoubleSide} />
              </mesh>
            </group>
          ) : (
            // Intact Biconic Payload Fairing
            <group>
              <mesh position={[0, 0, 0]}>
                <coneGeometry args={[0.75, 2.0, 32]} />
                <meshStandardMaterial color="#f8fafc" metalness={0.4} roughness={0.2} />
              </mesh>
              {/* Fairing Mission Decal Ring */}
              <mesh position={[0, -0.6, 0]}>
                <cylinderGeometry args={[0.752, 0.752, 0.2, 32]} />
                <meshStandardMaterial color="#0284c7" metalness={0.6} roughness={0.2} />
              </mesh>
            </group>
          )}
        </group>
      )}

      {/* ── TRANSONIC MACH 1 VAPOR CONE (Prandtl-Glauert Singularity) ── */}
      {showTransonicVapor && (
        <mesh ref={vaporRef} position={[0, 4.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <ringGeometry args={[0.75, 2.4, 32]} />
          <meshBasicMaterial color="#e0f2fe" transparent opacity={0.55} side={THREE.DoubleSide} depthWrite={false} />
        </mesh>
      )}

      {/* ── VOLUMETRIC MULTI-LAYERED EXHAUST PLUME WITH SHOCK DIAMONDS ── */}
      {engineFiring && (
        <group position={[0, stage === 1 ? -3.6 : -1.4, 0]}>
          {/* Main Fire Core */}
          <mesh ref={flameCoreRef}>
            <coneGeometry args={[stage === 1 ? 0.75 : 0.48, stage === 1 ? 4.8 : 2.8, 20]} />
            <meshBasicMaterial color="#ff6b00" transparent opacity={0.9} />
          </mesh>

          {/* Inner Supersonic Jet Core */}
          <mesh position={[0, -0.3, 0]}>
            <coneGeometry args={[stage === 1 ? 0.38 : 0.22, stage === 1 ? 2.8 : 1.5, 16]} />
            <meshBasicMaterial color="#00f0ff" transparent opacity={0.95} />
          </mesh>

          {/* Standing Mach Shock Diamonds */}
          <group ref={shockDiamondsRef}>
            {[0, -0.6, -1.2, -1.8].map((y, idx) => (
              <mesh key={idx} position={[0, y, 0]}>
                <octahedronGeometry args={[0.18 - idx * 0.03]} />
                <meshBasicMaterial color="#ffffff" transparent opacity={0.9} />
              </mesh>
            ))}
          </group>

          {/* Volumetric Dynamic Light Glow */}
          <pointLight color="#ff7700" intensity={6} distance={20} />
        </group>
      )}
    </group>
  );
}

// Ultra-Detailed Sentinel-EO Multispectral Satellite Model
function SentinelSatelliteDetailed({
  solarDeployPct = 100, // 0 - 100%
  isDigitalTwin = false,
  isScanning = false,
}: {
  solarDeployPct?: number;
  isDigitalTwin?: boolean;
  isScanning?: boolean;
}) {
  const panelAngle = (solarDeployPct / 100) * (Math.PI / 2);
  const scanBeamRef = useRef<THREE.Mesh>(null);
  const solarCellTexture = useMemo(() => createSolarCellTexture(), []);

  useFrame((state) => {
    if (scanBeamRef.current && isScanning) {
      const mat = scanBeamRef.current.material as THREE.MeshBasicMaterial;
      mat.opacity = 0.38 + Math.sin(state.clock.elapsedTime * 6) * 0.12;
    }
  });

  const baseMat = isDigitalTwin
    ? new THREE.MeshStandardMaterial({ color: '#00d4ff', wireframe: true, emissive: '#00d4ff', emissiveIntensity: 0.9 })
    : new THREE.MeshStandardMaterial({ color: '#e2e8f0', metalness: 0.85, roughness: 0.2 });

  const goldMliMat = isDigitalTwin
    ? new THREE.MeshStandardMaterial({ color: '#9b5de5', wireframe: true, emissive: '#9b5de5', emissiveIntensity: 0.7 })
    : new THREE.MeshStandardMaterial({ color: '#d97706', metalness: 0.95, roughness: 0.15 });

  const solarMat = isDigitalTwin
    ? new THREE.MeshStandardMaterial({ color: '#00ff88', wireframe: true, emissive: '#00ff88', emissiveIntensity: 0.6 })
    : new THREE.MeshStandardMaterial({ map: solarCellTexture, metalness: 0.75, roughness: 0.2 });

  return (
    <group>
      {/* ── CENTRAL BUS & MULTI-LAYER INSULATION (MLI) ── */}
      <mesh material={baseMat} position={[0, 0, 0]}>
        <boxGeometry args={[1.2, 1.5, 1.2]} />
      </mesh>

      {/* Gold Multi-Layer Insulation Blankets on Sunward & Nadir faces */}
      <mesh material={goldMliMat} position={[0, 0.1, 0.61]}>
        <boxGeometry args={[1.05, 1.25, 0.04]} />
      </mesh>
      <mesh material={goldMliMat} position={[0, 0.1, -0.61]}>
        <boxGeometry args={[1.05, 1.25, 0.04]} />
      </mesh>

      {/* ── MULTISPECTRAL OPTICAL INSTRUMENT (MSI) APERTURE ── */}
      <group position={[0, -0.78, 0]}>
        {/* Optical Baffle Barrel */}
        <mesh rotation={[Math.PI, 0, 0]}>
          <cylinderGeometry args={[0.34, 0.42, 0.35, 24]} />
          <meshStandardMaterial color="#0a0e17" metalness={0.95} roughness={0.05} />
        </mesh>
        {/* Anti-Reflective Sapphire Optical Lens */}
        <mesh position={[0, -0.18, 0]}>
          <circleGeometry args={[0.3, 24]} />
          <meshStandardMaterial color="#00e5ff" emissive="#00e5ff" emissiveIntensity={0.8} metalness={1} roughness={0} />
        </mesh>
      </group>

      {/* ── HIGH GAIN X-BAND PARABOLIC DISH ANTENNA ── */}
      <group position={[0, 0.85, -0.25]} rotation={[0.35, 0, 0]}>
        <mesh>
          <sphereGeometry args={[0.32, 20, 20, 0, Math.PI * 2, 0, Math.PI * 0.45]} />
          <meshStandardMaterial color="#f8fafc" metalness={0.85} roughness={0.15} side={THREE.DoubleSide} />
        </mesh>
        <mesh position={[0, 0.18, 0]}>
          <cylinderGeometry args={[0.02, 0.02, 0.35, 8]} />
          <meshStandardMaterial color="#94a3b8" metalness={0.9} />
        </mesh>
      </group>

      {/* ── STAR TRACKERS & REACTION WHEEL HOUSINGS ── */}
      <group position={[0.62, 0.4, 0]} rotation={[0, 0, -Math.PI / 4]}>
        <mesh>
          <cylinderGeometry args={[0.08, 0.1, 0.22, 16]} />
          <meshStandardMaterial color="#0f172a" />
        </mesh>
      </group>

      {/* ── DUAL DEPLOYABLE GAAS SOLAR ARRAY WINGS ── */}
      {/* Left Wing */}
      <group position={[-0.6, 0, 0]} rotation={[0, 0, Math.PI / 2 - panelAngle]}>
        <group position={[-1.35, 0, 0]}>
          <mesh material={solarMat}>
            <boxGeometry args={[2.5, 0.95, 0.04]} />
          </mesh>
          {/* Motorized Hinge Truss */}
          <mesh material={baseMat} position={[1.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.45, 8]} />
          </mesh>
        </group>
      </group>

      {/* Right Wing */}
      <group position={[0.6, 0, 0]} rotation={[0, 0, -Math.PI / 2 + panelAngle]}>
        <group position={[1.35, 0, 0]}>
          <mesh material={solarMat}>
            <boxGeometry args={[2.5, 0.95, 0.04]} />
          </mesh>
          <mesh material={baseMat} position={[-1.3, 0, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.04, 0.04, 0.45, 8]} />
          </mesh>
        </group>
      </group>

      {/* ── MULTISPECTRAL SWATH SCAN BEAM (Scene 6) ── */}
      {isScanning && (
        <group position={[0, -0.9, 0]}>
          {/* Holographic Focused Scan Cone */}
          <mesh ref={scanBeamRef} position={[0, -2.8, 0]}>
            <coneGeometry args={[2.4, 5.6, 4, 1, true]} />
            <meshBasicMaterial color="#00ffcc" transparent opacity={0.35} side={THREE.DoubleSide} depthWrite={false} />
          </mesh>
          {/* Surface Footprint Multi-Band Classification Grid */}
          <mesh position={[0, -5.6, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[3.6, 3.6]} />
            <meshBasicMaterial color="#00ff88" wireframe transparent opacity={0.7} />
          </mesh>
        </group>
      )}
    </group>
  );
}

// Photorealistic Earth Globe with Rayleigh Atmosphere & Cloud Layers
function PhotorealisticEarthGlobe({ isScanning = false }: { isScanning?: boolean }) {
  const earthRef = useRef<THREE.Mesh>(null);
  const cloudsRef = useRef<THREE.Mesh>(null);

  const earthTexture = useMemo(() => createProceduralEarthTexture(), []);
  const cloudTexture = useMemo(() => createProceduralCloudTexture(), []);

  useFrame((_, delta) => {
    if (earthRef.current) earthRef.current.rotation.y += delta * 0.035;
    if (cloudsRef.current) cloudsRef.current.rotation.y += delta * 0.05;
  });

  return (
    <group position={[0, -18.5, 0]}>
      {/* High-Resolution Planetary Sphere */}
      <mesh ref={earthRef}>
        <sphereGeometry args={[16, 64, 64]} />
        <meshStandardMaterial
          map={earthTexture}
          roughness={0.65}
          metalness={0.15}
        />
      </mesh>

      {/* Dynamic Swirling Cloud Layer */}
      <mesh ref={cloudsRef}>
        <sphereGeometry args={[16.14, 64, 64]} />
        <meshStandardMaterial
          map={cloudTexture}
          transparent
          opacity={0.45}
          roughness={0.9}
          depthWrite={false}
        />
      </mesh>

      {/* Atmospheric Rayleigh Scattering Glow (Cyan/Sky-Blue Horizon) */}
      <mesh>
        <sphereGeometry args={[16.38, 64, 64]} />
        <meshBasicMaterial
          color="#00d4ff"
          transparent
          opacity={0.18}
          side={THREE.BackSide}
        />
      </mesh>
    </group>
  );
}

// ─── SCENE CONFIGURATIONS ─────────────────────────────────────────────────────

interface SceneConfig {
  id: number;
  title: string;
  subtitle: string;
  durationMs: number;
  phaseLabel: string;
}

const SCENES: SceneConfig[] = [
  {
    id: 1,
    title: 'SCENE 1 · LAUNCH PREPARATION',
    subtitle: 'Satish Dhawan Space Centre (SDSC) · Launch Complex Pad 2 · Pre-Flight Checks',
    durationMs: 7500,
    phaseLabel: 'TERMINAL COUNTDOWN',
  },
  {
    id: 2,
    title: 'SCENE 2 · IGNITION & POWERED LIFTOFF',
    subtitle: 'T-00:00:00 · Vikas Cryogenic Core & Solid Boosters Firing · Tower Cleared',
    durationMs: 8500,
    phaseLabel: 'POWERED LIFTOFF',
  },
  {
    id: 3,
    title: 'SCENE 3 · ATMOSPHERIC ASCENT & STAGING',
    subtitle: 'Transonic Mach 1 Vapor Shock · Max-Q Dynamic Pressure · Stage 1 Separation',
    durationMs: 8500,
    phaseLabel: 'STAGE 1 MECO & SEPARATION',
  },
  {
    id: 4,
    title: 'SCENE 4 · ORBITAL INSERTION & DEPLOYMENT',
    subtitle: 'Low Earth Orbit (650 km) · Aerodynamic Fairing Jettison · Solar Array Unfurling',
    durationMs: 8500,
    phaseLabel: 'SATELLITE DEPLOYMENT',
  },
  {
    id: 5,
    title: 'SCENE 5 · DIGITAL TWIN SYNCHRONIZATION',
    subtitle: 'Physical Spacecraft to Authoritative VYOM Twin Telemetry Lock (60 Hz)',
    durationMs: 8500,
    phaseLabel: 'TWIN HANDSHAKE (60Hz)',
  },
  {
    id: 6,
    title: 'SCENE 6 · EARTH OBSERVATION & SWATH SCAN',
    subtitle: 'Multispectral VNIR/SWIR Swath Scanning · Real-Time Biome & Agricultural Audit',
    durationMs: 9500,
    phaseLabel: 'MULTISPECTRAL SCIENCE ACTIVE',
  },
  {
    id: 7,
    title: 'SCENE 7 · MISSION CONTROL HANDOVER',
    subtitle: 'All Telemetry Nominal · Trajectory Locked · Flight Operations Engaged',
    durationMs: 8000,
    phaseLabel: 'MISSION CONTROL ENGAGED',
  },
];

// ─── MAIN LAUNCH SEQUENCE SCREEN ──────────────────────────────────────────────

export function LaunchSequenceScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const config = useMissionStore((s) => s.config);

  const [activeSceneIdx, setActiveSceneIdx] = useState(0);
  const [isPlaying, setIsPlaying] = useState(true);
  const [speed, setSpeed] = useState(1);
  const [showHUD, setShowHUD] = useState(true);
  const [isAudioMuted, setIsAudioMuted] = useState(false);
  const [cameraMode, setCameraMode] = useState<'cinematic' | 'rocketcam' | 'nadir'>('cinematic');

  const currentScene = SCENES[activeSceneIdx];

  // Sound triggers on scene transitions
  useEffect(() => {
    if (activeSceneIdx === 1) {
      audioSynth.playRocketRoar(1.2);
    } else if (activeSceneIdx === 2) {
      audioSynth.playRocketRoar(0.9);
    } else if (activeSceneIdx >= 3) {
      audioSynth.playTelemetryPing();
    }
  }, [activeSceneIdx]);

  const toggleAudio = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    audioSynth.setMuted(next);
  };

  // Auto-progress through scenes
  useEffect(() => {
    if (!isPlaying) return;

    const timer = setTimeout(() => {
      if (activeSceneIdx < SCENES.length - 1) {
        setActiveSceneIdx((prev) => prev + 1);
      } else {
        setIsPlaying(false);
      }
    }, currentScene.durationMs / speed);

    return () => clearTimeout(timer);
  }, [activeSceneIdx, isPlaying, speed, currentScene.durationMs]);

  // Compute live telemetry HUD values per scene
  const sceneTelemetry = useMemo(() => {
    switch (activeSceneIdx) {
      case 0:
        return {
          timeCode: 'T - 00:00:10',
          altitude: '0.00 km',
          velocity: '0.00 km/s (Mach 0.0)',
          dynamicQ: '0.0 kPa',
          fuel: '100% LOX / RP-1',
          stage: 'PRE-LAUNCH HOLD',
          health: '100% NOMINAL',
        };
      case 1:
        return {
          timeCode: 'T + 00:00:06',
          altitude: '0.62 km',
          velocity: '0.15 km/s (Mach 0.45)',
          dynamicQ: '9.8 kPa',
          fuel: '98% PROPELLANT',
          stage: 'STAGE 1 BOOSTERS ACTIVE',
          health: '100% NOMINAL',
        };
      case 2:
        return {
          timeCode: 'T + 00:02:40',
          altitude: '88.5 km',
          velocity: '2.52 km/s (Mach 7.4)',
          dynamicQ: '36.2 kPa (MAX-Q PASSED)',
          fuel: '42% VACUUM STAGE',
          stage: 'STAGE 2 CRYOGENIC IGNITION',
          health: '100% NOMINAL',
        };
      case 3:
        return {
          timeCode: 'T + 00:08:50',
          altitude: '650.0 km',
          velocity: '7.66 km/s (27,576 km/h)',
          dynamicQ: '0.0 kPa (ORBITAL VACUUM)',
          fuel: 'RCS HYDRAZINE 100%',
          stage: 'SATELLITE SEPARATION LOCKED',
          health: '100% NOMINAL',
        };
      case 4:
        return {
          timeCode: 'T + 00:12:00',
          altitude: '650.2 km',
          velocity: '7.66 km/s',
          dynamicQ: '60 Hz TELEMETRY SYNC',
          fuel: 'SOLAR BUS 260W (98.4%)',
          stage: 'DIGITAL TWIN AUTHORITATIVE',
          health: '100% SYNCHRONIZED',
        };
      case 5:
        return {
          timeCode: 'T + 00:24:30',
          altitude: '650.0 km (LEO SUN-SYNC)',
          velocity: '7.66 km/s',
          dynamicQ: 'SWATH 290 KM · 13 BANDS',
          fuel: 'SOLAR BUS 290W',
          stage: 'MULTISPECTRAL IMAGING ACTIVE',
          health: '100% NOMINAL',
        };
      case 6:
      default:
        return {
          timeCode: 'T + 00:30:00',
          altitude: '650.0 km',
          velocity: '7.66 km/s',
          dynamicQ: 'DOWNLINK 28.4 Mbps',
          fuel: 'BATTERY 98.4%',
          stage: 'OPERATIONAL FLIGHT PHASE',
          health: '100% FULLY OPERATIONAL',
        };
    }
  }, [activeSceneIdx]);

  const handleEnterMissionControl = () => {
    setScreen('mission-control');
  };

  return (
    <div style={{
      width: '100vw', height: '100vh',
      background: '#020409', position: 'relative',
      overflow: 'hidden', userSelect: 'none',
    }}>
      {/* ── 3D GRAPHICS VIEWPORT ── */}
      <Canvas gl={{ antialias: true, powerPreference: 'high-performance' }} dpr={[1, 2]}>
        <PerspectiveCamera
          makeDefault
          position={
            cameraMode === 'rocketcam'
              ? [0, 4.5, 1.2]
              : cameraMode === 'nadir'
              ? [0, 5, 0.1]
              : activeSceneIdx === 0
              ? [3.8, 1.2, 5.8]
              : activeSceneIdx === 1
              ? [4.8, 0.6, 6.8]
              : activeSceneIdx === 2
              ? [0, -1.2, 7.5]
              : activeSceneIdx === 3
              ? [0, 0.5, 5.2]
              : activeSceneIdx === 4
              ? [1.4, 0.9, 4.4]
              : activeSceneIdx === 5
              ? [0, 1.6, 6.2]
              : [0, 0.8, 4.6]
          }
          fov={activeSceneIdx <= 2 ? 44 : 36}
        />
        <ambientLight intensity={activeSceneIdx <= 2 ? 0.4 : 0.25} />
        <directionalLight position={[6, 9, 6]} intensity={1.6} color="#fff8ee" />
        <directionalLight position={[-5, -2, -5]} intensity={0.45} color="#7dd3fc" />

        <StarField />

        {/* ── SCENE 1: LAUNCH PREPARATION ── */}
        {activeSceneIdx === 0 && (
          <group>
            <SpaceportEnvironment padSteam={true} />
            <RealisticLaunchVehicle altitude={0.4} stage={1} engineFiring={false} />
            <pointLight position={[2.5, 4, 3]} color="#00d4ff" intensity={2.5} distance={12} />
          </group>
        )}

        {/* ── SCENE 2: IGNITION & LIFTOFF ── */}
        {activeSceneIdx === 1 && (
          <group>
            <SpaceportEnvironment padSteam={true} />
            <RealisticLaunchVehicle altitude={1.6} stage={1} engineFiring={true} flameIntensity={1.4} />
          </group>
        )}

        {/* ── SCENE 3: ASCENT & STAGING ── */}
        {activeSceneIdx === 2 && (
          <group>
            <RealisticLaunchVehicle altitude={0} stage={2} engineFiring={true} flameIntensity={1.2} showTransonicVapor={true} />
            {/* Spent Stage 1 booster falling away below */}
            <group position={[0, -5.5, 0]} rotation={[0.25, 0, 0.12]}>
              <RealisticLaunchVehicle altitude={0} stage={1} engineFiring={false} />
            </group>
          </group>
        )}

        {/* ── SCENE 4: ORBITAL DEPLOYMENT ── */}
        {activeSceneIdx === 3 && (
          <group>
            <PhotorealisticEarthGlobe isScanning={false} />
            <group position={[0, 0.5, 0]}>
              <SentinelSatelliteDetailed solarDeployPct={85} isDigitalTwin={false} isScanning={false} />
            </group>
          </group>
        )}

        {/* ── SCENE 5: DIGITAL TWIN SYNCHRONIZATION ── */}
        {activeSceneIdx === 4 && (
          <group>
            <PhotorealisticEarthGlobe isScanning={false} />
            <group position={[0, 0.5, 0]}>
              <SentinelSatelliteDetailed solarDeployPct={100} isDigitalTwin={true} isScanning={false} />
            </group>
          </group>
        )}

        {/* ── SCENE 6: EARTH OBSERVATION SWATH SCAN ── */}
        {activeSceneIdx === 5 && (
          <group>
            <PhotorealisticEarthGlobe isScanning={true} />
            <group position={[0, 1.2, 0]}>
              <SentinelSatelliteDetailed solarDeployPct={100} isDigitalTwin={false} isScanning={true} />
            </group>
          </group>
        )}

        {/* ── SCENE 7: MISSION CONTROL HANDOVER ── */}
        {activeSceneIdx === 6 && (
          <group>
            <PhotorealisticEarthGlobe isScanning={true} />
            <group position={[0, 0.6, 0]}>
              <SentinelSatelliteDetailed solarDeployPct={100} isDigitalTwin={false} isScanning={false} />
            </group>
          </group>
        )}

        <OrbitControls
          enableZoom={true}
          enablePan={false}
          autoRotate={activeSceneIdx >= 3 && cameraMode === 'cinematic'}
          autoRotateSpeed={0.35}
        />
      </Canvas>

      {/* ── AEROSPACE GLASS COCKPIT HUD OVERLAYS ── */}
      {showHUD && (
        <div style={{
          position: 'absolute', inset: 0, pointerEvents: 'none',
          display: 'flex', flexDirection: 'column', justifyContent: 'space-between',
          padding: 24,
        }}>
          {/* Top Mission Banner & Live Readouts */}
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', flexWrap: 'wrap', gap: 14 }}>
            {/* Mission Identifier & Status */}
            <div style={{
              background: 'rgba(2,6,15,0.88)', padding: '12px 18px', borderRadius: 8,
              border: '1px solid rgba(0,212,255,0.25)', backdropFilter: 'blur(12px)',
              pointerEvents: 'auto',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 900, color: '#00d4ff', letterSpacing: '0.15em' }}>
                  VYOM
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fff', fontWeight: 600 }}>
                  {config?.name ?? 'EARTH OBSERVATION MISSION'}
                </span>
                <span style={{
                  padding: '2px 6px', borderRadius: 3,
                  background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.4)',
                  fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88',
                }}>
                  {currentScene.phaseLabel}
                </span>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)' }}>
                {currentScene.subtitle}
              </div>
            </div>

            {/* Quick Audio & Camera Selector */}
            <div style={{
              display: 'flex', alignItems: 'center', gap: 8,
              background: 'rgba(2,6,15,0.88)', padding: '6px 10px', borderRadius: 8,
              border: '1px solid rgba(0,212,255,0.2)', backdropFilter: 'blur(12px)',
              pointerEvents: 'auto',
            }}>
              <button
                onClick={toggleAudio}
                style={{
                  padding: '4px 8px', background: isAudioMuted ? 'rgba(255,45,85,0.15)' : 'rgba(0,255,136,0.15)',
                  border: `1px solid ${isAudioMuted ? '#ff2d55' : '#00ff88'}`,
                  borderRadius: 4, color: isAudioMuted ? '#ff2d55' : '#00ff88',
                  fontFamily: 'var(--font-mono)', fontSize: 8.5, cursor: 'pointer',
                }}
              >
                {isAudioMuted ? '🔇 MUTE' : '🔊 AUDIO'}
              </button>

              <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.15)' }} />

              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>CAM:</span>
              {(['cinematic', 'rocketcam', 'nadir'] as const).map((cam) => (
                <button
                  key={cam}
                  onClick={() => setCameraMode(cam)}
                  style={{
                    padding: '3px 6px',
                    background: cameraMode === cam ? 'rgba(0,212,255,0.25)' : 'transparent',
                    border: `1px solid ${cameraMode === cam ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
                    borderRadius: 3, color: cameraMode === cam ? '#00d4ff' : 'rgba(255,255,255,0.45)',
                    fontFamily: 'var(--font-mono)', fontSize: 8, cursor: 'pointer',
                  }}
                >
                  {cam.toUpperCase()}
                </button>
              ))}
            </div>

            {/* Live Flight Telemetry Box */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(4, minmax(85px, 1fr))', gap: 8,
              background: 'rgba(2,6,15,0.88)', padding: '10px 14px', borderRadius: 8,
              border: '1px solid rgba(0,212,255,0.2)', backdropFilter: 'blur(12px)',
            }}>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>MISSION CLOCK</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#00d4ff' }}>{sceneTelemetry.timeCode}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>ALTITUDE</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff' }}>{sceneTelemetry.altitude}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>VELOCITY</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#fff' }}>{sceneTelemetry.velocity}</div>
              </div>
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.35)' }}>HEALTH STATUS</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#00ff88' }}>{sceneTelemetry.health}</div>
              </div>
            </div>
          </div>

          {/* Center Cinematic Title Flash */}
          <AnimatePresence mode="wait">
            <motion.div
              key={activeSceneIdx}
              initial={{ opacity: 0, scale: 0.92, y: 12 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 1.06 }}
              transition={{ duration: 0.7 }}
              style={{ textAlign: 'center', pointerEvents: 'none', maxWidth: 750, margin: '0 auto' }}
            >
              <div style={{
                fontFamily: 'var(--font-display)', fontSize: 14,
                letterSpacing: '0.35em', color: '#00d4ff',
                marginBottom: 6, textShadow: '0 0 25px rgba(0,212,255,0.6)',
              }}>
                {currentScene.title}
              </div>
              <div style={{
                fontFamily: 'var(--font-body)', fontSize: 13.5,
                color: 'rgba(255,255,255,0.9)', textShadow: '0 2px 12px rgba(0,0,0,0.9)',
              }}>
                {currentScene.subtitle}
              </div>
            </motion.div>
          </AnimatePresence>

          {/* Bottom Floating Control Deck & Timeline Stepper */}
          <div style={{ pointerEvents: 'auto', display: 'flex', flexDirection: 'column', gap: 10, maxWidth: 980, margin: '0 auto', width: '100%' }}>
            {/* Timeline Stepper for all 7 Scenes */}
            <div style={{
              display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 6,
              background: 'rgba(2,6,15,0.92)', padding: '8px 10px', borderRadius: 8,
              border: '1px solid rgba(0,212,255,0.2)', backdropFilter: 'blur(12px)',
            }}>
              {SCENES.map((scene, idx) => {
                const isActive = idx === activeSceneIdx;
                const isPassed = idx < activeSceneIdx;
                return (
                  <button
                    key={scene.id}
                    onClick={() => setActiveSceneIdx(idx)}
                    style={{
                      padding: '6px 4px',
                      background: isActive ? 'rgba(0,212,255,0.2)' : isPassed ? 'rgba(0,255,136,0.08)' : 'transparent',
                      border: `1px solid ${isActive ? '#00d4ff' : isPassed ? 'rgba(0,255,136,0.3)' : 'rgba(255,255,255,0.08)'}`,
                      borderRadius: 4, cursor: 'pointer',
                      display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2,
                      transition: 'all 0.2s',
                    }}
                  >
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 8,
                      color: isActive ? '#00d4ff' : isPassed ? '#00ff88' : 'rgba(255,255,255,0.4)',
                      fontWeight: 700, letterSpacing: '0.08em',
                    }}>
                      0{scene.id}
                    </span>
                    <span style={{
                      fontFamily: 'var(--font-mono)', fontSize: 7,
                      color: isActive ? '#fff' : 'rgba(255,255,255,0.45)',
                      whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 95,
                    }}>
                      {scene.phaseLabel.split(' ')[0]}
                    </span>
                  </button>
                );
              })}
            </div>

            {/* Playback Controls, Speed Selectors & Exit to Mission Control */}
            <div style={{
              display: 'flex', alignItems: 'center', justifyContent: 'space-between',
              background: 'rgba(2,6,15,0.92)', padding: '8px 16px', borderRadius: 8,
              border: '1px solid rgba(0,212,255,0.15)', backdropFilter: 'blur(12px)',
              flexWrap: 'wrap', gap: 10,
            }}>
              {/* Play / Pause / Speed */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  style={{
                    padding: '5px 14px', background: isPlaying ? 'rgba(255,140,0,0.15)' : 'rgba(0,212,255,0.2)',
                    border: `1px solid ${isPlaying ? '#ff8c00' : '#00d4ff'}`,
                    borderRadius: 4, color: isPlaying ? '#ff8c00' : '#00d4ff',
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
                </button>

                <div style={{ width: 1, height: 16, background: 'rgba(255,255,255,0.1)' }} />

                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)' }}>SPEED:</span>
                {[1, 2, 5].map((s) => (
                  <button
                    key={s}
                    onClick={() => setSpeed(s)}
                    style={{
                      padding: '3px 8px',
                      background: speed === s ? 'rgba(0,212,255,0.2)' : 'transparent',
                      border: `1px solid ${speed === s ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
                      borderRadius: 3, color: speed === s ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                      fontFamily: 'var(--font-mono)', fontSize: 9, cursor: 'pointer',
                    }}
                  >
                    {s}×
                  </button>
                ))}
              </div>

              {/* Enter Mission Control Button */}
              <button
                onClick={handleEnterMissionControl}
                className="btn btn-primary"
                style={{
                  padding: '8px 24px', fontSize: 11, letterSpacing: '0.12em',
                  boxShadow: '0 0 25px rgba(0,212,255,0.4)',
                }}
              >
                ENTER MISSION CONTROL →
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
