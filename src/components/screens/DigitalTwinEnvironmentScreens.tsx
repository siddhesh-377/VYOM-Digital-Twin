import { Canvas } from '@react-three/fiber';
import { OrbitControls } from '@react-three/drei';
import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { SatelliteModel } from '../three/SatelliteScene';
import { StarField } from '../three/SpaceScene';

export function DigitalTwinScreen() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const satellite = useMissionStore((s) => s.satellite);
  const aiAnalysis = useMissionStore((s) => s.aiAnalysis);
  const activeThreats = useMissionStore((s) => s.activeThreats);

  const health = telemetry?.overallHealth ?? 100;
  const healthColor = health > 70 ? '#00ff88' : health > 40 ? '#ff8c00' : '#ff2d55';

  return (
    <div style={{ width: '100%', height: '100%', display: 'flex', background: '#020409', paddingBottom: 56 }}>
      {/* 3D Twin - large */}
      <div style={{ flex: '0 0 60%', position: 'relative' }}>
        <Canvas gl={{ antialias: true }} dpr={[1, 2]} camera={{ position: [0, 0.5, 4], fov: 40 }}>
          <ambientLight intensity={activeThreats.length > 0 ? 0.05 : 0.2} />
          <directionalLight
            position={[4, 3, 4]} intensity={1.2}
            color={activeThreats.some((t) => t.type === 'solar-storm') ? '#ff8c00' : '#fff5e8'}
          />
          <directionalLight position={[-3, -1, -3]} intensity={0.3} color="#aaccff" />
          <StarField />
          <SatelliteModel interactive={true} scale={1.8} />
          <OrbitControls enablePan={false} minDistance={2} maxDistance={8} />
        </Canvas>

        {/* State overlay */}
        <div style={{ position: 'absolute', top: 20, left: 20 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.5)', letterSpacing: '0.12em', marginBottom: 12 }}>
            DIGITAL TWIN · LIVE STATE SYNC · SIMULATION
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <svg width={60} height={60} style={{ transform: 'rotate(-90deg)' }}>
              <circle cx={30} cy={30} r={24} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth={4} />
              <circle cx={30} cy={30} r={24} fill="none" stroke={healthColor}
                strokeWidth={4}
                strokeDasharray={`${(health / 100) * 150.8} ${150.8 - (health / 100) * 150.8}`}
                strokeLinecap="round"
                style={{ filter: `drop-shadow(0 0 4px ${healthColor})`, transition: 'all 1s ease' }} />
              <text x={30} y={30} textAnchor="middle" dominantBaseline="middle" fill={healthColor}
                style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, transform: 'rotate(90deg)', transformOrigin: '30px 30px' }}>
                {Math.round(health)}%
              </text>
            </svg>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>SPACECRAFT HEALTH</div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: healthColor }}>
                {telemetry?.healthStatus?.toUpperCase() ?? 'AWAITING'}
              </div>
            </div>
          </div>
        </div>

        {/* Threat indicator */}
        {activeThreats.length > 0 && (
          <div style={{
            position: 'absolute', top: 20, right: 20,
            padding: '10px 16px', background: 'rgba(255,45,85,0.15)',
            border: '1px solid rgba(255,45,85,0.4)', borderRadius: 8,
            fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ff2d55',
            animation: 'threat-alert 1s ease-in-out infinite',
          }}>
            ⚡ {activeThreats[0]?.name}
          </div>
        )}

        <div style={{
          position: 'absolute', bottom: 20, left: '50%', transform: 'translateX(-50%)',
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.2)',
        }}>
          DRAG TO ROTATE · SCROLL TO ZOOM · STATE SYNCED WITH TELEMETRY
        </div>
      </div>

      {/* Right panel: subsystem state */}
      <div style={{
        flex: 1, borderLeft: '1px solid rgba(0,212,255,0.08)',
        background: 'rgba(5,12,25,0.95)', padding: '24px', overflowY: 'auto',
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.2em', marginBottom: 20 }}>
          SUBSYSTEM STATE
        </div>

        {(satellite?.subsystems ?? []).map((sub) => {
          // Apply threat damage to subsystems
          const threat = activeThreats[0];
          let health = sub.health;
          if (threat?.type === 'power-failure' && sub.name === 'Power Subsystem') health = Math.max(20, health - 40);
          if (threat?.type === 'thermal-failure' && sub.name === 'Thermal Control') health = Math.max(20, health - 50);
          if (threat?.type === 'communication-failure' && sub.name === 'Communication') health = Math.max(10, health - 60);
          if (threat?.type === 'attitude-failure' && sub.name === 'ADCS') health = Math.max(15, health - 55);
          if (threat?.type === 'solar-storm') health = Math.max(60, health - 20);

          const hColor = health > 70 ? '#00ff88' : health > 40 ? '#ff8c00' : '#ff2d55';
          const hStatus = health > 70 ? 'NOMINAL' : health > 40 ? 'WARNING' : 'CRITICAL';

          return (
            <div key={sub.name} style={{
              padding: '14px 16px', marginBottom: 8,
              background: health < 40 ? 'rgba(255,45,85,0.06)' : health < 70 ? 'rgba(255,140,0,0.06)' : 'rgba(0,0,0,0.3)',
              border: `1px solid ${health < 40 ? 'rgba(255,45,85,0.2)' : health < 70 ? 'rgba(255,140,0,0.15)' : 'rgba(255,255,255,0.05)'}`,
              borderRadius: 8, transition: 'all 0.5s',
              animation: health < 40 ? 'threat-alert 2s ease-in-out infinite' : 'none',
            }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#fff' }}>{sub.name}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: hColor }}>{hStatus}</span>
              </div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ flex: 1, height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
                  <div style={{ height: '100%', width: `${health}%`, background: hColor, borderRadius: 2, transition: 'width 0.8s ease' }} />
                </div>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: hColor, minWidth: 36 }}>{Math.round(health)}%</span>
              </div>
              {telemetry && (
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                  TEMP: {(sub.temperature + (telemetry.thermal.cpuTempC - 42) * 0.3).toFixed(1)}°C
                </div>
              )}
            </div>
          );
        })}

        {/* AI status */}
        {aiAnalysis.anomalyDetected && (
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            style={{
              marginTop: 16, padding: '14px 16px',
              background: 'rgba(155,93,229,0.1)',
              border: '1px solid rgba(155,93,229,0.3)',
              borderRadius: 8, animation: 'ai-pulse 2s ease-in-out infinite',
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9b5de5', marginBottom: 6 }}>
              VYOM AI · {aiAnalysis.phase.toUpperCase()}
            </div>
            <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.7)', lineHeight: 1.5 }}>
              {aiAnalysis.anomalyDescription}
            </div>
          </motion.div>
        )}
      </div>
    </div>
  );
}

export function EnvironmentScreen() {
  const environment = useMissionStore((s) => s.environment);
  const missionDay = useMissionStore((s) => s.missionDay);

  const envClass = environment.classification;
  const envColor = envClass === 'critical' ? '#ff2d55' : envClass === 'warning' ? '#ff8c00' : envClass === 'low' ? '#00ff88' : '#00d4ff';

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#020409', paddingBottom: 56, padding: '32px' }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.2em', marginBottom: 6 }}>
        SPACE ENVIRONMENT · SIMULATION · MISSION DAY {Math.floor(missionDay)}
      </div>
      <div style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#fff', marginBottom: 28 }}>
        ENVIRONMENTAL CONDITIONS
      </div>

      {/* Classification badge */}
      <div style={{
        display: 'inline-flex', alignItems: 'center', gap: 12,
        padding: '14px 24px', marginBottom: 32,
        background: `rgba(${envColor === '#ff2d55' ? '255,45,85' : envColor === '#ff8c00' ? '255,140,0' : '0,212,255'},0.1)`,
        border: `1px solid ${envColor}40`,
        borderRadius: 10,
      }}>
        <div style={{ width: 12, height: 12, borderRadius: '50%', background: envColor, boxShadow: `0 0 12px ${envColor}` }} />
        <div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>CURRENT CLASSIFICATION</div>
          <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: envColor }}>{envClass.toUpperCase()}</div>
        </div>
      </div>

      {/* Environment metrics */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 16, marginBottom: 32 }}>
        {[
          { label: 'SOLAR ACTIVITY', value: environment.solarActivityLevel.toFixed(2), unit: '/10', max: 10, color: '#ff8c00' },
          { label: 'RADIATION LEVEL', value: environment.radiationLevel.toFixed(1), unit: 'μSv/h', max: 100, color: '#ff2d55' },
          { label: 'MAGNETIC FIELD', value: (environment.magneticFieldNT / 1000).toFixed(1), unit: 'mT', max: 50, color: '#00d4ff' },
          { label: 'DEBRIS DENSITY', value: environment.debrisDensity.toFixed(2), unit: '/10', max: 10, color: '#9b5de5' },
        ].map(({ label, value, unit, max, color }) => (
          <div key={label} style={{
            padding: '20px', background: 'rgba(5,12,25,0.9)',
            border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 10 }}>{label}</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 32, fontWeight: 700, color, marginBottom: 4 }}>
              {value}<span style={{ fontSize: 14, fontWeight: 400, opacity: 0.7 }}>{unit}</span>
            </div>
            <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
              <div style={{
                height: '100%', width: `${(parseFloat(value) / max) * 100}%`,
                background: color, borderRadius: 2,
                transition: 'width 0.8s ease', opacity: 0.8,
              }} />
            </div>
          </div>
        ))}
      </div>

      {/* Temperature range */}
      <div style={{ padding: '20px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 10, marginBottom: 16 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', marginBottom: 12 }}>THERMAL ENVIRONMENT RANGE</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 24 }}>
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>MIN</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#5dade2' }}>
              {environment.temperatureRangeC[0].toFixed(0)}°C
            </div>
          </div>
          <div style={{ flex: 1, height: 8, borderRadius: 4, background: 'linear-gradient(90deg, #5dade2, #ff2d55)', opacity: 0.6 }} />
          <div style={{ textAlign: 'center' }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 4 }}>MAX</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#ff2d55' }}>
              {environment.temperatureRangeC[1].toFixed(0)}°C
            </div>
          </div>
        </div>
      </div>

      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.2)', textAlign: 'center' }}>
        SIMULATION MODE · Environmental conditions driven by VYOM SpaceEnvironmentEngine · Not real space weather data
      </div>
    </div>
  );
}
