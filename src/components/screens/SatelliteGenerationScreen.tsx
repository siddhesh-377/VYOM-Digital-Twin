import { useState, useEffect } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { SatelliteModel } from '../three/SatelliteScene';
import { StarField } from '../three/SpaceScene';
import type { MissionType, SatelliteConfig } from '../../types/mission';
import { createAndStartMission } from '../../services/BackendWebSocketService';

function generateSatelliteConfig(type: MissionType, budget: number): SatelliteConfig {
  const isHighBudget = budget >= 400;
  const isMedBudget = budget >= 150;

  const configs: Record<MissionType, Partial<SatelliteConfig>> = {
    orbital: {
      type: 'Earth Observation Satellite Bus',
      body: 'Dual-deployable gallium arsenide solar wings with nadir optical bay',
      solarPanels: isHighBudget ? 6 : isMedBudget ? 4 : 2,
      batteryCapacityWh: isHighBudget ? 1600 : isMedBudget ? 1000 : 500,
      antennaGainDb: isHighBudget ? 28 : 22,
      payloadType: isHighBudget ? 'Multi-spectral imaging array + Synthetic Aperture Radar (SAR)' : 'Multi-spectral optical imager',
      propulsionType: isMedBudget ? 'Hydrazine monopropellant + Hall effect micro-thrusters' : 'Cold gas attitude thrusters',
      thermalControl: 'Multi-layer insulation (MLI) blankets + active heat pipe radiators',
      redundancy: isHighBudget ? 3 : isMedBudget ? 2 : 1,
    },
    planetary: {
      type: 'Deep-Space Planetary Probe Bus',
      body: 'Reinforced aeroshell with high-gain steerable dish & magnetometer boom',
      solarPanels: 6,
      batteryCapacityWh: 2000,
      antennaGainDb: 42,
      payloadType: 'Laser altimeter + mass spectrometer suite + surface radar',
      propulsionType: 'Hypergolic bipropellant main engine + Xenon ion propulsion',
      thermalControl: 'Radioisotope heater units (RHU) + louvers',
      redundancy: 3,
    },
    human: {
      type: 'Crewed Lunar Command & Service Module',
      body: 'Pressurized crew module with redundant environmental life support (ECLSS)',
      solarPanels: 4,
      batteryCapacityWh: 6000,
      antennaGainDb: 36,
      payloadType: 'Autonomous life support, Lunar rover, seismic array & sample recovery',
      propulsionType: 'Bipropellant orbital maneuvering system + 16 RCS thrusters',
      thermalControl: 'Dual active liquid ammonia cooling loops + sublimator',
      redundancy: 3,
    },
    astrophysics: {
      type: 'Deep Space Astronomical Observatory',
      body: 'Precision 3-axis sun-shielded telescope bus with cryogenic cooler',
      solarPanels: 4,
      batteryCapacityWh: 1400,
      antennaGainDb: 32,
      payloadType: isHighBudget ? 'Cryogenic Infrared Telescope + UV Spectrograph & Coronagraph' : 'Wide-field space telescope + high-res spectrometer',
      propulsionType: 'Electric colloid micro-thrusters + 4 reaction wheels',
      thermalControl: '5-layer Kapton deployable sunshield + active cryocoolers',
      redundancy: isHighBudget ? 3 : 2,
    },
  };

  const base = configs[type] || configs.orbital;

  return {
    type: base.type!,
    body: base.body!,
    solarPanels: base.solarPanels!,
    batteryCapacityWh: base.batteryCapacityWh!,
    antennaGainDb: base.antennaGainDb!,
    payloadType: base.payloadType!,
    propulsionType: base.propulsionType!,
    thermalControl: base.thermalControl!,
    redundancy: base.redundancy!,
    subsystems: [
      { name: 'Power & Solar Subsystem', health: 100, status: 'nominal', temperature: 18.2 },
      { name: 'Thermal Radiators & MLI', health: 100, status: 'nominal', temperature: 24.5 },
      { name: 'ADCS (Reaction Wheels)', health: 100, status: 'nominal', temperature: 34.8 },
      { name: 'High-Gain Deep Comms', health: 100, status: 'nominal', temperature: 28.0 },
      { name: 'Primary Scientific Payload', health: 100, status: 'nominal', temperature: 32.5 },
      { name: 'Propulsion & Micro-Thrusters', health: 100, status: 'nominal', temperature: 15.0 },
      { name: 'On-Board Autonomous OBC', health: 100, status: 'nominal', temperature: 41.8 },
    ],
    dataSource: 'model-estimate',
  };
}

const SUBSYSTEM_ICONS: Record<string, string> = {
  'Power & Solar Subsystem': '⚡',
  'Thermal Radiators & MLI': '🌡',
  'ADCS (Reaction Wheels)': '🎯',
  'High-Gain Deep Comms': '📡',
  'Primary Scientific Payload': '🔭',
  'Propulsion & Micro-Thrusters': '🚀',
  'On-Board Autonomous OBC': '💻',
};

export function SatelliteGenerationScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const config = useMissionStore((s) => s.config);
  const setSatelliteConfig = useMissionStore((s) => s.setSatelliteConfig);
  const startMission = useMissionStore((s) => s.startMission);
  const logEvent = useMissionStore((s) => s.logEvent);

  const [generating, setGenerating] = useState(true);
  const [satConfig, setSatConfig] = useState<SatelliteConfig | null>(null);
  const [selectedSubsystem, setSelectedSubsystem] = useState<string | null>(null);

  useEffect(() => {
    const type = config?.type ?? 'orbital';
    const budget = config?.budgetCrore ?? 250;
    const timer = setTimeout(() => {
      const sat = generateSatelliteConfig(type, budget);
      setSatConfig(sat);
      setSatelliteConfig(sat);
      setGenerating(false);
    }, 1200);
    return () => clearTimeout(timer);
  }, [config, setSatelliteConfig]);

  const handleLaunch = async () => {
    const store = useMissionStore.getState();
    const c = store.config;
    const missionId = c?.id ?? `VYOM-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
    
    if (!c?.id) {
        useMissionStore.setState((s) => ({ config: { ...(s.config as any), id: missionId } }));
    }

    startMission();

    await createAndStartMission({
      id: missionId,
      name: c?.name ?? 'CUSTOM MISSION',
      type: c?.type ?? 'orbital',
      destination: c?.destination ?? 'earth-orbit',
      objective: c?.objective ?? 'Mission Objectives',
      budgetCrore: c?.budgetCrore ?? 250,
      launchSite: c?.launchSite ?? { name: 'SDSC', country: 'India', lat: 13.7, lng: 80.2, agency: 'ISRO' },
      crew: store.crew,
    });

    logEvent({
      id: `ev-launch-${Date.now()}`,
      timestamp: Date.now(),
      missionDay: 0,
      eventType: 'milestone',
      severity: 'nominal',
      description: `Mission "${c?.name}" initiated. Spacecraft launched from ${c?.launchSite?.name ?? 'Sriharikota'}. Budget: ₹${c?.budgetCrore ?? 250} Cr.`,
      source: 'Launch Operations',
      immutable: true,
    });
    setScreen('launch-sequence');
  };

  return (
    <div style={{ width: '100%', height: '100%', background: '#020409', display: 'flex', position: 'relative', overflow: 'hidden' }}>
      {/* 3D Satellite Viewer */}
      <div style={{ flex: '1 1 50%', position: 'relative', height: '100%', minHeight: 300 }}>
        <Canvas
          style={{ width: '100%', height: '100%' }}
          gl={{ antialias: true }}
          dpr={[1, 2]}
          camera={{ position: [0, 0.3, 3], fov: 45 }}
        >
          <ambientLight intensity={0.25} />
          <directionalLight position={[3, 3, 3]} intensity={1.2} color="#fff5e8" />
          <directionalLight position={[-3, -1, -2]} intensity={0.3} color="#aaccff" />
          <StarField />
          {!generating && <SatelliteModel interactive={true} scale={1.7} />}
          <OrbitControls enablePan={false} minDistance={1.5} maxDistance={6} />
        </Canvas>

        {/* Generation overlay */}
        {generating && (
          <div style={{
            position: 'absolute', inset: 0,
            display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
            background: 'rgba(2,4,9,0.85)', zIndex: 10,
          }}>
            <div style={{
              width: 50, height: 50, borderRadius: '50%',
              border: '2px solid rgba(0,212,255,0.2)',
              borderTopColor: '#00d4ff',
              animation: 'spin 1s linear infinite',
              marginBottom: 20,
            }} />
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, color: '#00d4ff', letterSpacing: '0.15em', marginBottom: 6 }}>
              SYNTHESIZING SPACECRAFT TWIN
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.5)' }}>
              Applying budget (₹{config?.budgetCrore ?? 250} Cr) &amp; {config?.type?.toUpperCase()} profile…
            </div>
          </div>
        )}

        <div style={{ position: 'absolute', bottom: 20, left: 20, fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.1em', color: 'rgba(255,255,255,0.35)', background: 'rgba(0,0,0,0.5)', padding: '4px 8px', borderRadius: 4 }}>
          3D DIGITAL TWIN · DRAG TO ROTATE · SCROLL TO ZOOM
        </div>
      </div>

      {/* Right Scrollable Details Panel */}
      <div style={{
        flex: '1 1 50%', maxWidth: '620px', height: '100%',
        overflowY: 'scroll',
        background: 'rgba(5,12,25,0.96)',
        borderLeft: '1px solid rgba(0,212,255,0.18)',
        display: 'flex', flexDirection: 'column',
        position: 'relative',
      }}>
        {/* Scrollable Content */}
        <div style={{ padding: '32px 32px 120px 32px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'rgba(0,212,255,0.7)', marginBottom: 8 }}>
            STEP 05 OF 05 · SPACECRAFT CONFIGURATION &amp; LAUNCH READINESS
          </div>

          {generating ? (
            <div>
              <div style={{ height: 32, background: 'rgba(255,255,255,0.05)', borderRadius: 4, marginBottom: 16, animation: 'pulse 1.5s ease infinite' }} />
              <div style={{ height: 20, width: '60%', background: 'rgba(255,255,255,0.05)', borderRadius: 4 }} />
            </div>
          ) : satConfig && (
            <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.4 }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4, flexWrap: 'wrap', gap: 8 }}>
                <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: '#fff', letterSpacing: '0.05em' }}>
                  {config?.name ?? 'CUSTOM SPACECRAFT'}
                </h1>
                <div style={{ display: 'flex', gap: 6 }}>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 8px',
                    background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.3)',
                    borderRadius: 4, color: '#00d4ff',
                  }}>
                    ₹{config?.budgetCrore ?? 250} Cr
                  </span>
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 9, padding: '3px 8px',
                    background: 'rgba(0,255,136,0.12)', border: '1px solid rgba(0,255,136,0.3)',
                    borderRadius: 4, color: '#00ff88', textTransform: 'uppercase',
                  }}>
                    {config?.destination?.replace('-', ' ') ?? 'TARGET'}
                  </span>
                </div>
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00ff88', marginBottom: 6 }}>
                {satConfig.type}
              </div>
              <p style={{ color: 'rgba(255,255,255,0.6)', fontSize: 12, lineHeight: 1.5, marginBottom: 20 }}>
                {satConfig.body}
              </p>

              {/* Specs grid */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginBottom: 20 }}>
                {[
                  { label: 'SOLAR ARRAYS', value: `${satConfig.solarPanels} GaAs panels` },
                  { label: 'BATTERY STORAGE', value: `${satConfig.batteryCapacityWh} Wh Li-ion` },
                  { label: 'ANTENNA GAIN', value: `${satConfig.antennaGainDb} dBi X-Band` },
                  { label: 'REDUNDANCY', value: `Level ${satConfig.redundancy} Dual-Fault` },
                  { label: 'PROPULSION', value: satConfig.propulsionType },
                  { label: 'THERMAL SYSTEM', value: satConfig.thermalControl },
                ].map(({ label, value }) => (
                  <div key={label} style={{
                    padding: '10px 12px',
                    background: 'rgba(0,0,0,0.35)', border: '1px solid rgba(255,255,255,0.07)',
                    borderRadius: 6,
                  }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.4)', marginBottom: 2 }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00d4ff' }}>{value}</div>
                  </div>
                ))}
              </div>

              {/* Payload */}
              <div style={{
                padding: '12px 14px', marginBottom: 20,
                background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.2)',
                borderRadius: 8,
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.15em', color: 'rgba(0,212,255,0.8)', marginBottom: 4 }}>
                  PRIMARY SCIENTIFIC PAYLOAD
                </div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: '#fff', lineHeight: 1.4 }}>{satConfig.payloadType}</div>
              </div>

              {/* Subsystems */}
              <div style={{ marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.45)' }}>
                    SUBSYSTEM INTEGRITY &amp; READINESS
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88' }}>ALL SYSTEMS GO</span>
                </div>
                {satConfig.subsystems.map((sub) => (
                  <div
                    key={sub.name}
                    onClick={() => setSelectedSubsystem(selectedSubsystem === sub.name ? null : sub.name)}
                    style={{
                      display: 'flex', alignItems: 'center', gap: 10,
                      padding: '8px 10px', marginBottom: 4,
                      background: 'rgba(0,0,0,0.3)',
                      border: '1px solid rgba(255,255,255,0.05)',
                      borderRadius: 6, cursor: 'pointer',
                    }}
                  >
                    <span style={{ fontSize: 13 }}>{SUBSYSTEM_ICONS[sub.name] ?? '▪'}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff', flex: 1 }}>{sub.name}</span>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                      <div style={{ width: 50, height: 4, background: 'rgba(255,255,255,0.1)', borderRadius: 2 }}>
                        <div style={{ width: `${sub.health}%`, height: '100%', background: '#00ff88', borderRadius: 2 }} />
                      </div>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00ff88' }}>100%</span>
                    </div>
                  </div>
                ))}
              </div>

              {/* Launch Complex Notice */}
              <div style={{ padding: '10px 14px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6, marginBottom: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.6)' }}>
                  <span>SPACEPORT: {config?.launchSite?.name ?? 'Satish Dhawan Space Centre'}</span>
                  <span style={{ color: '#00ff88' }}>T-0 FLIGHT READY</span>
                </div>
              </div>
            </motion.div>
          )}
        </div>

        {/* Sticky Launch Action Bar at Bottom */}
        <div style={{
          position: 'sticky', bottom: 0, left: 0, right: 0,
          background: 'rgba(2,4,9,0.96)', borderTop: '1px solid rgba(0,212,255,0.25)',
          padding: '16px 32px', backdropFilter: 'blur(16px)',
          display: 'flex', gap: 12, alignItems: 'center', zIndex: 100,
        }}>
          <button
            onClick={() => setScreen('launch')}
            style={{
              padding: '14px 20px', background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)', borderRadius: 6,
              color: 'rgba(255,255,255,0.7)', fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
            }}
          >
            ← BACK
          </button>
          <button
            onClick={handleLaunch}
            disabled={generating}
            className="btn btn-primary btn-lg"
            style={{
              flex: 1, fontSize: 13, padding: '16px 24px',
              boxShadow: '0 0 30px rgba(0,212,255,0.3)',
              cursor: generating ? 'not-allowed' : 'pointer',
              opacity: generating ? 0.5 : 1,
            }}
          >
            🚀 INITIALIZE &amp; LAUNCH "{config?.name?.toUpperCase() ?? 'MISSION'}"
          </button>
        </div>
      </div>
    </div>
  );
}
