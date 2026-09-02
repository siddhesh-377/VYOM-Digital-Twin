import { useEffect, useMemo } from 'react';
import { Canvas } from '@react-three/fiber';
import { OrbitControls, PerspectiveCamera } from '@react-three/drei';
import { motion } from 'framer-motion';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMissionStore } from '../../store/missionStore';
import { SatelliteModel, OrbitLine } from '../three/SatelliteScene';
import { StarField } from '../three/SpaceScene';
import { startSimulationEngine } from '../../engines/SimulationEngine';
import { backendWS } from '../../services/BackendWebSocketService';

function TelemetryChart({
  data,
  dataKey,
  color,
  label,
  unit,
  isAlert,
  minVal,
  maxVal,
}: {
  data: any[];
  dataKey: string;
  color: string;
  label: string;
  unit: string;
  isAlert?: boolean;
  minVal?: number;
  maxVal?: number;
}) {
  const currentVal = data && data.length > 0 ? data[data.length - 1]?.[dataKey] : undefined;
  const displayVal = typeof currentVal === 'number' ? currentVal.toFixed(1) : '--';
  const strokeCol = isAlert ? 'var(--critical)' : color;

  // Unique gradient ID
  const gradId = `grad-${label.replace(/[^a-zA-Z0-9]/g, '-')}`;

  return (
    <div style={{
      padding: '14px 16px', background: 'rgba(5,12,25,0.85)',
      border: `1px solid ${isAlert ? 'rgba(255,45,85,0.45)' : 'rgba(0,212,255,0.12)'}`,
      borderRadius: 8, transition: 'all 0.3s ease',
      animation: isAlert ? 'threat-alert 1.2s ease-in-out infinite' : 'none',
      display: 'flex', flexDirection: 'column',
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)' }}>
          {label}
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: strokeCol }}>
          {displayVal} <span style={{ fontSize: 9, fontWeight: 400, opacity: 0.7 }}>{unit}</span>
        </span>
      </div>

      <div style={{ width: '100%', height: 75, minHeight: 75 }}>
        <ResponsiveContainer width="100%" height="100%">
          <AreaChart data={data} margin={{ top: 4, right: 0, left: 0, bottom: 0 }}>
            <defs>
              <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
                <stop offset="5%" stopColor={strokeCol} stopOpacity={0.3} />
                <stop offset="95%" stopColor={strokeCol} stopOpacity={0} />
              </linearGradient>
            </defs>
            <YAxis domain={[minVal ?? 'auto', maxVal ?? 'auto']} hide />
            <Area
              type="monotone"
              dataKey={dataKey}
              stroke={strokeCol}
              strokeWidth={1.5}
              fill={`url(#${gradId})`}
              dot={false}
              isAnimationActive={false}
            />
            <Tooltip
              contentStyle={{ background: '#050f1e', border: '1px solid rgba(0,212,255,0.3)', fontFamily: 'var(--font-mono)', fontSize: 9, padding: '4px 8px' }}
              formatter={(val: any) => [`${typeof val === 'number' ? val.toFixed(2) : val} ${unit}`, label]}
              labelFormatter={() => ''}
            />
          </AreaChart>
        </ResponsiveContainer>
      </div>
    </div>
  );
}

function GaugeChart({
  value,
  max,
  label,
  unit,
  color,
}: {
  value: number;
  max: number;
  label: string;
  unit: string;
  color: string;
}) {
  const safeVal = typeof value === 'number' && !isNaN(value) ? value : 0;
  const safeMax = max > 0 ? max : 100;
  const pct = Math.max(0, Math.min(100, (safeVal / safeMax) * 100));

  const r = 36;
  const arc = (pct / 100) * 270;
  const startAngle = -135 * (Math.PI / 180);
  const endAngle = startAngle + (arc * Math.PI) / 180;
  const x1 = 50 + r * Math.cos(startAngle);
  const y1 = 50 + r * Math.sin(startAngle);
  const x2 = 50 + r * Math.cos(endAngle);
  const y2 = 50 + r * Math.sin(endAngle);
  const largeArc = arc > 180 ? 1 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '10px 6px' }}>
      <svg width={92} height={76} viewBox="0 0 100 80">
        {/* Background Arc */}
        <path
          d={`M ${50 + r * Math.cos((-135 * Math.PI) / 180)} ${50 + r * Math.sin((-135 * Math.PI) / 180)} A ${r} ${r} 0 1 1 ${50 + r * Math.cos((135 * Math.PI) / 180)} ${50 + r * Math.sin((135 * Math.PI) / 180)}`}
          fill="none"
          stroke="rgba(255,255,255,0.07)"
          strokeWidth={6}
          strokeLinecap="round"
        />
        {/* Filled Arc */}
        {arc > 0 && (
          <path
            d={`M ${x1} ${y1} A ${r} ${r} 0 ${largeArc} 1 ${x2} ${y2}`}
            fill="none"
            stroke={color}
            strokeWidth={6}
            strokeLinecap="round"
            style={{ filter: `drop-shadow(0 0 4px ${color})`, transition: 'all 0.3s ease' }}
          />
        )}
        <text
          x={50}
          y={50}
          textAnchor="middle"
          fill={color}
          style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700 }}
        >
          {safeVal.toFixed(safeVal < 10 && safeVal % 1 !== 0 ? 1 : 0)}
        </text>
        <text
          x={50}
          y={62}
          textAnchor="middle"
          fill="rgba(255,255,255,0.4)"
          style={{ fontFamily: 'var(--font-mono)', fontSize: 8 }}
        >
          {unit}
        </text>
      </svg>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.45)', marginTop: -2 }}>
        {label}
      </div>
    </div>
  );
}

export function TelemetryScreen() {
  const telemetry = useMissionStore((s) => s.telemetry);
  const telemetryHistory = useMissionStore((s) => s.telemetryHistory);
  const activeThreats = useMissionStore((s) => s.activeThreats);
  const config = useMissionStore((s) => s.config);
  const missionDay = useMissionStore((s) => s.missionDay);

  // Auto-start simulation engine and ensure websocket connection
  useEffect(() => {
    startSimulationEngine();
    if (config?.id && !backendWS.isConnected) {
      backendWS.connect(config.id);
    }
  }, [config?.id]);

  // Construct guaranteed time-series datasets with historical fallback
  const { powerData, thermalData, commData, attitudeData, computeData, orbitData } = useMemo(() => {
    const rawHistory = telemetryHistory && telemetryHistory.length > 0 ? telemetryHistory.slice(-60) : [];

    // Fallback baseline points if history is just starting
    const history = rawHistory.length >= 5
      ? rawHistory
      : Array.from({ length: 25 }, (_, i) => {
          const t = i / 25;
          return {
            missionDay: 0.1 * t,
            timestamp: Date.now() - (25 - i) * 1000,
            power: {
              batteryPercent: parseFloat((96.5 - (24 - i) * 0.01).toFixed(1)),
              voltageV: 28.6,
              currentA: 4.2,
              solarGenerationW: 280,
              consumptionW: 140,
            },
            thermal: {
              cpuTempC: 41.8,
              batteryTempC: 18.2,
              payloadTempC: 32.5,
              externalTempC: -15.0,
            },
            comm: {
              signalDbm: -72,
              dataRateMbps: 8.4,
              packetsPerSec: 240,
              latencyMs: 340,
              uptime: 100,
            },
            attitude: {
              rollDeg: 0.12,
              pitchDeg: -0.08,
              yawDeg: 0.04,
              angularVelDegs: 0.01,
              reactionWheelRpm: 3240,
            },
            compute: {
              cpuPercent: 32,
              memoryPercent: 48,
              storagePercent: 12.5,
            },
            orbit: {
              altitudeKm: 650 + Math.sin(i * 0.1) * 2,
              velocityKms: 7.66 + Math.cos(i * 0.1) * 0.01,
              accelerationMs2: 8.09,
              gForce: 1.0,
              latitudeDeg: 13.7,
              longitudeDeg: 80.2,
              inclinationDeg: 51.6,
              periodMin: 97.5,
              apogeeKm: 652,
              perigeeKm: 648,
              semiMajorAxisKm: 7028,
              eccentricity: 0.001,
              trueAnomalyDeg: 45,
              atmosphericLayer: 'Exosphere' as const,
              atmosphericDensityKgM3: 1e-12,
              atmosphericDragN: 0.002,
            },
            overallHealth: 98.5,
            healthStatus: 'nominal' as const,
            dataSource: 'simulation' as const,
          };
        });

    return {
      powerData: history.map((t, i) => ({
        i,
        battery: t.power?.batteryPercent ?? 96.4,
        solar: t.power?.solarGenerationW ?? 260,
        voltage: t.power?.voltageV ?? 28.6,
        consumption: t.power?.consumptionW ?? 120,
      })),
      thermalData: history.map((t, i) => ({
        i,
        cpu: t.thermal?.cpuTempC ?? 41.8,
        battery: t.thermal?.batteryTempC ?? 18.2,
        payload: t.thermal?.payloadTempC ?? 32.5,
        external: t.thermal?.externalTempC ?? -15.0,
      })),
      commData: history.map((t, i) => ({
        i,
        signal: t.comm?.signalDbm ?? -72,
        rate: t.comm?.dataRateMbps ?? 8.4,
      })),
      attitudeData: history.map((t, i) => ({
        i,
        rpm: t.attitude?.reactionWheelRpm ?? 3240,
        roll: t.attitude?.rollDeg ?? 0.12,
      })),
      computeData: history.map((t, i) => ({
        i,
        cpuLoad: t.compute?.cpuPercent ?? 32,
        memory: t.compute?.memoryPercent ?? 48,
      })),
      orbitData: history.map((t, i) => ({
        i,
        altitude: t.orbit?.altitudeKm ?? 650,
        velocity: t.orbit?.velocityKms ?? 7.66,
      })),
    };
  }, [telemetryHistory]);

  const hasThreat = activeThreats && activeThreats.length > 0;
  const batteryPct = telemetry?.power?.batteryPercent ?? 96.4;
  const isBatteryLow = batteryPct < 25;
  const cpuTemp = telemetry?.thermal?.cpuTempC ?? 41.8;
  const isThermalHigh = cpuTemp > 75;
  const signalDbm = telemetry?.comm?.signalDbm ?? -72;
  const isSignalLow = signalDbm < -95;
  const busVoltage = telemetry?.power?.voltageV ?? 28.6;

  return (
    <div style={{
      width: '100%', height: '100%', display: 'grid',
      gridTemplateColumns: '1fr 360px',
      background: '#020409', overflow: 'hidden',
      paddingBottom: 56,
    }}>
      {/* LEFT — Dynamic Live Charts & Gauges */}
      <div style={{ padding: '20px 24px', overflowY: 'auto' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 18, flexWrap: 'wrap', gap: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: 'rgba(0,212,255,0.7)', marginBottom: 4 }}>
              LIVE TELEMETRY STREAM · 60Hz AUTHORITATIVE TWIN
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 24, fontWeight: 700, color: '#fff', margin: 0 }}>
              {config?.name ?? 'VYOM-01'} SENSOR TELEMETRY
            </h1>
          </div>

          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <div style={{
              padding: '4px 10px', background: 'rgba(0,255,136,0.1)',
              border: '1px solid rgba(0,255,136,0.3)', borderRadius: 4,
              fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00ff88',
              display: 'flex', alignItems: 'center', gap: 6,
            }}>
              <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', animation: 'pulse-dot 1.5s infinite' }} />
              STREAM ACTIVE
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00d4ff' }}>
              DAY {missionDay.toFixed(2)}
            </div>
          </div>
        </div>

        {/* Anomaly Banner if threat active */}
        {hasThreat && (
          <div style={{
            padding: '8px 16px', background: 'rgba(255,45,85,0.15)',
            border: '1px solid #ff2d55', borderRadius: 6,
            fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ff2d55',
            marginBottom: 16, display: 'flex', alignItems: 'center', gap: 8,
            animation: 'threat-alert 1s ease-in-out infinite',
          }}>
            <span>⚠</span>
            <span>TELEMETRY ANOMALY IN PROGRESS · {activeThreats.length} ACTIVE EVENT{activeThreats.length > 1 ? 'S' : ''} DETECTED</span>
          </div>
        )}

        {/* Live Gauges Row */}
        <div style={{
          display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(110px, 1fr))',
          background: 'rgba(5,15,30,0.85)', border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: 10, marginBottom: 18,
        }}>
          <GaugeChart
            value={batteryPct}
            max={100}
            label="BATTERY"
            unit="%"
            color={isBatteryLow ? '#ff2d55' : batteryPct > 50 ? '#00ff88' : '#ff8c00'}
          />
          <GaugeChart
            value={busVoltage}
            max={36}
            label="BUS VOLT"
            unit="V"
            color={busVoltage < 22 ? '#ff2d55' : '#00d4ff'}
          />
          <GaugeChart
            value={cpuTemp}
            max={100}
            label="CPU TEMP"
            unit="°C"
            color={isThermalHigh ? '#ff2d55' : '#00d4ff'}
          />
          <GaugeChart
            value={telemetry?.comm?.dataRateMbps ?? 8.4}
            max={20}
            label="DATA RATE"
            unit="Mbps"
            color="#00ff88"
          />
          <GaugeChart
            value={telemetry?.attitude?.reactionWheelRpm ?? 3240}
            max={6000}
            label="RCS WHEEL"
            unit="RPM"
            color="#00d4ff"
          />
          <GaugeChart
            value={telemetry?.compute?.cpuPercent ?? 32}
            max={100}
            label="CPU LOAD"
            unit="%"
            color="#9b5de5"
          />
        </div>

        {/* Time-series Live Charts Grid (6 Subsystems) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 14, marginBottom: 18 }}>
          <TelemetryChart
            data={powerData}
            dataKey="battery"
            color="#00ff88"
            label="BATTERY STATE OF CHARGE"
            unit="%"
            isAlert={isBatteryLow}
            minVal={0}
            maxVal={100}
          />
          <TelemetryChart
            data={powerData}
            dataKey="solar"
            color="#00d4ff"
            label="SOLAR ARRAY GENERATION"
            unit="W"
            minVal={0}
          />
          <TelemetryChart
            data={thermalData}
            dataKey="cpu"
            color="#ff8c00"
            label="CPU CORE TEMPERATURE"
            unit="°C"
            isAlert={isThermalHigh}
          />
          <TelemetryChart
            data={thermalData}
            dataKey="payload"
            color="#9b5de5"
            label="PAYLOAD SENSOR TEMP"
            unit="°C"
          />
          <TelemetryChart
            data={commData}
            dataKey="signal"
            color="#00d4ff"
            label="CARRIER SIGNAL SNR"
            unit="dBm"
            isAlert={isSignalLow}
          />
          <TelemetryChart
            data={commData}
            dataKey="rate"
            color="#00ff88"
            label="DOWNLINK THROUGHPUT"
            unit="Mbps"
          />
        </div>

        {/* Flight Kinematics & Link Budget Box */}
        <div style={{
          padding: '16px 20px', background: 'rgba(5,15,30,0.85)',
          border: '1px solid rgba(0,212,255,0.12)', borderRadius: 10,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.15em', marginBottom: 12 }}>
            FLIGHT KINEMATICS &amp; RF LINK BUDGET
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 12 }}>
            {[
              { label: 'ORBITAL VELOCITY', value: `${(telemetry?.orbit?.velocityKms ?? 7.66).toFixed(3)} km/s` },
              { label: 'ORBIT ALTITUDE', value: `${(telemetry?.orbit?.altitudeKm ?? 650.0).toFixed(1)} km` },
              { label: 'GRAV. ACCELERATION', value: `${(telemetry?.orbit?.accelerationMs2 ?? 8.09).toFixed(2)} m/s²` },
              { label: 'ATMOSPHERIC LAYER', value: telemetry?.orbit?.atmosphericLayer ?? 'Exosphere' },
              { label: 'COMM PACKETS / SEC', value: `${telemetry?.comm?.packetsPerSec ?? 240} pkts/s` },
              { label: 'ROUND-TRIP LATENCY', value: `${(telemetry?.comm?.latencyMs ?? 340).toFixed(0)} ms` },
              { label: 'COMM UPTIME', value: `${(telemetry?.comm?.uptime ?? 100.0).toFixed(1)}%` },
              { label: 'SPACECRAFT HEALTH', value: `${(telemetry?.overallHealth ?? 98.5).toFixed(1)}%` },
            ].map(({ label, value }) => (
              <div key={label} style={{ background: 'rgba(0,0,0,0.25)', padding: '8px 10px', borderRadius: 6 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, fontWeight: 700, color: '#00d4ff' }}>{value}</div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* RIGHT — 3D Digital Twin Viewer */}
      <div style={{ borderLeft: '1px solid rgba(0,212,255,0.1)', position: 'relative', background: '#020409' }}>
        <Canvas gl={{ antialias: true }} dpr={[1, 2]}>
          <PerspectiveCamera makeDefault position={[0, 0.5, 4]} fov={40} />
          <ambientLight intensity={0.2} />
          <directionalLight position={[4, 3, 4]} intensity={1.2} color="#fff5e8" />
          <directionalLight position={[-3, -1, -3]} intensity={0.3} color="#aaccff" />
          <StarField />
          <SatelliteModel scale={1.5} />
          <OrbitLine radius={3.2} inclination={51.6} />
          <OrbitControls enableZoom={true} enablePan={false} autoRotate autoRotateSpeed={0.4} />
        </Canvas>

        <div style={{
          position: 'absolute', top: 16, left: 16,
          fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em',
        }}>
          DIGITAL TWIN · REAL-TIME SYNC
        </div>

        <div style={{
          position: 'absolute', bottom: 16, right: 16,
          fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.3)',
        }}>
          DRAG TO ROTATE · SCROLL TO ZOOM
        </div>
      </div>
    </div>
  );
}

