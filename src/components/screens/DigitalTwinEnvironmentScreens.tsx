import { useState, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion, AnimatePresence } from 'framer-motion';
import { LineChart, Line, ResponsiveContainer, YAxis, Tooltip } from 'recharts';
import { useMissionStore } from '../../store/missionStore';
import { DynamicSpacecraftModel } from '../three/DynamicSpacecraftModel';
import { StarField } from '../three/SpaceScene';

export function DigitalTwinScreen() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const satellite = useMissionStore((s) => s.satellite);
  const config = useMissionStore((s) => s.config);
  const aiAnalysis = useMissionStore((s) => s.aiAnalysis);
  const incidents = useMissionStore((s) => s.incidents);
  const telemetryHistory = useMissionStore((s) => s.telemetryHistory);
  const selectedSubsystem = useMissionStore((s) => s.selectedSubsystem);
  const setSelectedSubsystem = useMissionStore((s) => s.setSelectedSubsystem);

  const health = telemetry?.overallHealth ?? 100;
  const healthColor = health > 75 ? '#00ff88' : health > 45 ? '#ff9f0a' : '#ff3b30';

  const subsystemsList = useMemo(() => {
    return satellite?.subsystems || [
      { name: 'Power (EPS)', health: 98, status: 'nominal' as const, temperature: 22 },
      { name: 'Thermal (TCS)', health: 96, status: 'nominal' as const, temperature: 20 },
      { name: 'ADCS / Guidance', health: 99, status: 'nominal' as const, temperature: 18 },
      { name: 'Communication', health: 100, status: 'nominal' as const, temperature: 24 },
      { name: 'Propulsion', health: 98, status: 'nominal' as const, temperature: 23 },
      { name: 'Flight Avionics', health: 100, status: 'nominal' as const, temperature: 22 },
    ];
  }, [satellite?.subsystems]);

  const activeSub = useMemo(() => {
    if (!selectedSubsystem) return subsystemsList[0];
    return subsystemsList.find((s) => s.name.toLowerCase().includes(selectedSubsystem.toLowerCase())) || subsystemsList[0];
  }, [selectedSubsystem, subsystemsList]);

  const subHistoryData = useMemo(() => {
    return telemetryHistory.slice(-40).map((t, idx) => ({
      idx,
      temp: t.thermal ? (t.thermal.cpuTempC + (idx % 3) * 0.2) : 22,
      health: t.overallHealth ?? 100,
    }));
  }, [telemetryHistory]);

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#02040a', paddingBottom: 56 }}>
      {/* ── Left 60%: 3D Interactive Spacecraft Twin ── */}
      <div style={{ flex: '0 0 60%', position: 'relative' }}>
        <Canvas gl={{ antialias: true }} camera={{ position: [0, 1.5, 4.5], fov: 42 }}>
          <ambientLight intensity={0.4} />
          <directionalLight position={[6, 5, 5]} intensity={1.8} color="#fff8e8" />
          <pointLight position={[-6, -3, -4]} intensity={0.5} color="#00e5ff" />
          <StarField />
          <DynamicSpacecraftModel
            modelType={satellite?.type as any}
            scale={1.6}
            interactive={true}
            selectedSubsystem={selectedSubsystem}
            onSelectSubsystem={(name) => setSelectedSubsystem(name)}
          />
          <OrbitControls enablePan={true} enableZoom={true} enableRotate={true} minDistance={1.8} maxDistance={10} />
        </Canvas>

        {/* State HUD Overlay */}
        <div style={{ position: 'absolute', top: 20, left: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: '#00e5ff', letterSpacing: '0.15em', marginBottom: 6 }}>
            SPACECRAFT DIGITAL TWIN · REAL-TIME STATE SYNC
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <div style={{
              width: 48, height: 48, borderRadius: '50%', border: `3px solid ${healthColor}`,
              display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'rgba(0,0,0,0.5)',
              boxShadow: `0 0 10px ${healthColor}44`,
            }}>
              <span style={{ fontFamily: 'var(--font-display, sans-serif)', fontSize: 13, fontWeight: 700, color: healthColor }}>
                {Math.round(health)}%
              </span>
            </div>
            <div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
                {config?.name?.toUpperCase() || 'SPACECRAFT TWIN'}
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 13, fontWeight: 700, color: healthColor }}>
                {telemetry?.healthStatus?.toUpperCase() ?? 'NOMINAL FLIGHT ENVELOPE'}
              </div>
            </div>
          </div>
        </div>

        {/* Click Instruction Bar */}
        <div style={{
          position: 'absolute', bottom: 16, left: '50%', transform: 'translateX(-50%)',
          background: 'rgba(4, 8, 16, 0.85)', backdropFilter: 'blur(8px)',
          padding: '6px 14px', borderRadius: 20, border: '1px solid rgba(255,255,255,0.1)',
          fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,255,255,0.5)',
        }}>
          🖱️ CLICK ANY SUBSYSTEM MESH TO INSPECT TELEMETRY & HEALTH
        </div>
      </div>

      {/* ── Right 40%: Deep Subsystem Inspector & Diagnostics ── */}
      <div style={{
        flex: 1, borderLeft: '1px solid rgba(0, 229, 255, 0.12)',
        background: 'rgba(4, 8, 16, 0.95)', padding: '24px', overflowY: 'auto',
        display: 'flex', flexDirection: 'column', gap: 16,
      }}>
        <div>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: '#00e5ff', letterSpacing: '0.15em' }}>
            SUBSYSTEM DIGITAL HIERARCHY
          </div>
          <div style={{ fontSize: 18, fontWeight: 700, color: '#fff', marginTop: 2 }}>
            {activeSub.name}
          </div>
        </div>

        {/* Selected Subsystem Detail Card */}
        <div style={{
          background: 'rgba(0, 229, 255, 0.04)', border: '1px solid rgba(0, 229, 255, 0.25)',
          borderRadius: 8, padding: '16px',
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
            <span style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>Operational Metrics</span>
            <span style={{
              fontSize: 9, fontWeight: 700, padding: '2px 8px', borderRadius: 4,
              background: activeSub.health > 75 ? 'rgba(0,255,136,0.15)' : 'rgba(255,59,48,0.2)',
              color: activeSub.health > 75 ? '#00ff88' : '#ff3b30',
              border: `1px solid ${activeSub.health > 75 ? '#00ff88' : '#ff3b30'}`,
            }}>
              HEALTH: {activeSub.health.toFixed(1)}%
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10, marginTop: 10 }}>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: 6 }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>TEMPERATURE</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#00e5ff', fontFamily: 'var(--font-mono, monospace)' }}>
                {activeSub.temperature.toFixed(1)}°C
              </div>
            </div>
            <div style={{ background: 'rgba(0,0,0,0.3)', padding: '8px 10px', borderRadius: 6 }}>
              <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>STATUS</div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#00ff88', fontFamily: 'var(--font-mono, monospace)' }}>
                {activeSub.status.toUpperCase()}
              </div>
            </div>
          </div>

          {/* Historical Mini Chart */}
          <div style={{ marginTop: 14 }}>
            <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)', marginBottom: 4 }}>
              REAL-TIME TEMPERATURE PROFILE (°C)
            </div>
            <div style={{ height: 75 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={subHistoryData}>
                  <YAxis hide domain={['auto', 'auto']} />
                  <Tooltip contentStyle={{ background: '#02040a', borderColor: '#00e5ff', fontSize: 10 }} />
                  <Line type="monotone" dataKey="temp" stroke="#00e5ff" strokeWidth={2} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Subsystems List */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div style={{ fontSize: 9, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.4)' }}>
            ALL SPACECRAFT SUBSYSTEMS
          </div>
          {subsystemsList.map((sub) => {
            const isSelected = activeSub.name === sub.name;
            const subColor = sub.health > 75 ? '#00ff88' : sub.health > 45 ? '#ff9f0a' : '#ff3b30';
            return (
              <div
                key={sub.name}
                onClick={() => setSelectedSubsystem(sub.name)}
                style={{
                  background: isSelected ? 'rgba(0, 229, 255, 0.12)' : 'rgba(255,255,255,0.03)',
                  border: isSelected ? '1px solid #00e5ff' : '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 6, padding: '10px 14px', cursor: 'pointer',
                  display: 'flex', justifyContent: 'space-between', alignItems: 'center',
                  transition: 'all 0.2s ease',
                }}
              >
                <div>
                  <div style={{ fontSize: 11, fontWeight: 600, color: '#fff' }}>{sub.name}</div>
                  <div style={{ fontSize: 8, color: 'rgba(255,255,255,0.4)', fontFamily: 'var(--font-mono, monospace)' }}>
                    Temp: {sub.temperature.toFixed(1)}°C
                  </div>
                </div>
                <div style={{ fontSize: 12, fontWeight: 700, color: subColor, fontFamily: 'var(--font-mono, monospace)' }}>
                  {sub.health.toFixed(0)}%
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

export function EnvironmentScreen() {
  const environment = useMissionStore((s) => s.environment);
  const missionDay = useMissionStore((s) => s.missionDay);

  const envClass = environment.classification;
  const envColor = envClass === 'critical' ? '#ff3b30' : envClass === 'warning' ? '#ff9f0a' : '#00ff88';

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#02040a', padding: '32px', paddingBottom: 80 }}>
      <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: '#00e5ff', letterSpacing: '0.2em', marginBottom: 6 }}>
        SPACE ENVIRONMENT · LIVE FLUX MONITORING · MISSION DAY {Math.floor(missionDay)}
      </div>
      <div style={{ fontSize: 24, fontWeight: 800, color: '#fff', marginBottom: 24 }}>
        ENVIRONMENTAL FLUX & RADIATION ENVELOPE
      </div>

      {/* Classification badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 12,
        padding: '12px 20px', marginBottom: 28,
        background: `rgba(${envColor === '#ff3b30' ? '255,59,48' : envColor === '#ff9f0a' ? '255,159,10' : '0,255,136'},0.1)`,
        border: `1px solid ${envColor}`, borderRadius: 8,
      }}>
        <div style={{ width: 10, height: 10, borderRadius: '50%', background: envColor, boxShadow: `0 0 10px ${envColor}` }} />
        <div>
          <div style={{ fontSize: 8, fontFamily: 'var(--font-mono, monospace)', color: 'rgba(255,255,255,0.4)' }}>CURRENT SPACE WEATHER</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: envColor }}>{envClass.toUpperCase()}</div>
        </div>
      </div>

      {/* Environment metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 16, marginBottom: 28 }}>
        {[
          { label: 'SOLAR ACTIVITY', value: environment.solarActivityLevel.toFixed(2), unit: '/10', max: 10, color: '#ff9f0a' },
          { label: 'RADIATION LEVEL', value: environment.radiationLevel.toFixed(1), unit: 'μSv/h', max: 100, color: '#ff3b30' },
          { label: 'MAGNETIC FIELD', value: (environment.magneticFieldNT / 1000).toFixed(1), unit: 'mT', max: 50, color: '#00e5ff' },
          { label: 'DEBRIS DENSITY', value: environment.debrisDensity.toFixed(2), unit: '/10', max: 10, color: '#bf5af2' },
        ].map(({ label, value, unit, max, color }) => (
          <div key={label} style={{
            padding: '16px', background: 'rgba(4,8,16,0.9)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 8,
          }}>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 8 }}>{label}</div>
            <div style={{ fontSize: 26, fontWeight: 700, color, marginBottom: 4 }}>
              {value}<span style={{ fontSize: 12, fontWeight: 400, opacity: 0.7 }}>{unit}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <div style={{
                height: '100%', width: `${(parseFloat(value) / max) * 100}%`,
                background: color, borderRadius: 2, transition: 'width 0.8s ease',
              }} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
