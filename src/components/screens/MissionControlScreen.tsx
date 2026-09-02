/**
 * VYOM — Mission Control Screen
 *
 * Layout:
 *   ┌─────────────────────────────────────────────────────────────────┐
 *   │  TOP STATUS BAR  (Mission clock, health, threats, controls)     │
 *   ├──────────────┬─────────────────────────────┬────────────────────┤
 *   │  LEFT PANEL  │   3D DIGITAL TWIN (center)  │  RIGHT PANEL       │
 *   │  (health,    │   + subsystem clickable      │  (live telemetry)  │
 *   │   AI widget, │   + HUD overlays             │                    │
 *   │   danger)    │                              │                    │
 *   ├─────────────────────────────────────────────────────────────────┤
 *   │  BOTTOM NAV: 01 TELEMETRY | 02 VYOM AI | 03 DANGER | 04 CREW  │
 *   │             | 05 UNIVERSE | 06 REPORTS & BLACKBOX | 07 ARCH    │
 *   └─────────────────────────────────────────────────────────────────┘
 */

import React, { useState, useMemo, useEffect } from 'react';
import { Canvas }             from '@react-three/fiber';
import { PerspectiveCamera, OrbitControls } from '@react-three/drei';
import { LineChart, Line, ResponsiveContainer } from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore }   from '../../store/missionStore';
import { backendWS }         from '../../services/BackendWebSocketService';
import { DynamicSpacecraftModel } from '../three/DynamicSpacecraftModel';
import { HealthRing }        from '../ui/HealthRing';
import { TelemetryMini }     from '../ui/TelemetryMini';
import { StarField }         from '../three/SpaceScene';
import { threatEngine }      from '../../engines/ThreatEngine';

// ── Nav Tab IDs ──────────────────────────────────────────────────────────────
type MCTab = 'telemetry' | 'ai' | 'danger' | 'crew' | 'universe' | 'reports' | 'architecture';

const WARP_SPEEDS = [
  { val: 7200,     label: '1× (2h/s)' },
  { val: 36000,    label: '5×'        },
  { val: 72000,    label: '10×'       },
  { val: 360000,   label: '50×'       },
  { val: 720000,   label: '100×'      },
  { val: 25000000, label: 'DEMO'      },
];

/** Exported utility — used by MissionTimeScreen */
export function formatElapsed(missionDay: number): string {
  const h = Math.floor(missionDay * 24);
  const m = Math.floor((missionDay * 24 * 60) % 60);
  const s = Math.floor((missionDay * 24 * 3600) % 60);
  return `${String(Math.floor(missionDay)).padStart(4, '0')}d ${String(h % 24).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`;
}

function formatMissionTime(missionDay: number) {
  const totalH   = missionDay * 24;
  const d        = Math.floor(missionDay);
  const h        = Math.floor(totalH % 24);
  const m        = Math.floor((totalH * 60) % 60);
  const s        = Math.floor((totalH * 3600) % 60);
  return {
    day:   String(d).padStart(4, '0'),
    hms:   `${String(h).padStart(2,'0')}:${String(m).padStart(2,'0')}:${String(s).padStart(2,'0')}`,
  };
}

// ── Bottom nav tab definition ─────────────────────────────────────────────────
function getNavTabs(isHuman: boolean): { id: MCTab; num: string; label: string; screen?: string }[] {
  const tabs: { id: MCTab; num: string; label: string; screen?: string }[] = [
    { id: 'telemetry',    num: '01', label: 'TELEMETRY' },
    { id: 'ai',           num: '02', label: 'VYOM AI',          screen: 'ai' },
    { id: 'danger',       num: '03', label: 'DANGER',           screen: 'scenarios' },
    { id: 'crew',         num: '04', label: 'CREW',             screen: 'crew' },
    { id: 'universe',     num: '05', label: 'UNIVERSE',         screen: 'universe' },
    { id: 'reports',      num: '06', label: 'REPORTS & BLACKBOX', screen: 'blackbox' },
    { id: 'architecture', num: '07', label: 'ARCHITECTURE',     screen: 'architecture' },
  ];
  if (!isHuman) return tabs.filter((t) => t.id !== 'crew');
  return tabs;
}

export function MissionControlScreen() {
  const config           = useMissionStore((s) => s.config);
  const missionDay       = useMissionStore((s) => s.missionDay);
  const status           = useMissionStore((s) => s.status);
  const telemetry        = useMissionStore((s) => s.telemetry);
  const aiAnalysis       = useMissionStore((s) => s.aiAnalysis);
  const crew             = useMissionStore((s) => s.crew);
  const activeThreats    = useMissionStore((s) => s.activeThreats);
  const objectiveProgress= useMissionStore((s) => s.objectiveProgress);
  const telemetryHistory = useMissionStore((s) => s.telemetryHistory);
  const timeMultiplier   = useMissionStore((s) => s.timeMultiplier);
  const totalDays        = useMissionStore((s) => s.totalMissionDurationDays);
  const setTimeMultiplier= useMissionStore((s) => s.setTimeMultiplier);
  const setScreen        = useMissionStore((s) => s.setScreen);

  const [wsStatus, setWsStatus]         = useState<'disconnected'|'connecting'|'connected'|'failed'>('disconnected');
  const [selectedSubsystem, setSelectedSubsystem] = useState<string | null>(null);
  const [activeTab, setActiveTab]       = useState<MCTab>('telemetry');

  useEffect(() => {
    if (config?.id) backendWS.connect(config.id);
    const unsub = backendWS.onStatusChange(setWsStatus);
    return () => unsub();
  }, [config?.id]);

  const isHumanMission = config?.type === 'human';
  const health         = telemetry?.overallHealth ?? 100;
  const healthStatus   = telemetry?.healthStatus ?? 'nominal';
  const statusColor    = healthStatus === 'nominal' ? '#00ff88' : healthStatus === 'warning' ? '#ff8c00' : '#ff2d55';
  const { day, hms }   = formatMissionTime(missionDay);
  const rawBat = telemetry?.power?.batteryPercent;
  const batteryPct = typeof rawBat === 'number' && !isNaN(rawBat) ? Math.max(0, Math.min(100, rawBat)) : 96.4;
  const powerHistory = telemetryHistory.slice(-60).map((t, i) => {
    const v = t.power?.batteryPercent;
    return { i, v: typeof v === 'number' && !isNaN(v) ? Math.max(0, Math.min(100, v)) : 96.4 };
  });

  // Live telemetry derived values
  const lat       = (telemetry?.orbit?.latitudeDeg ?? 12.84).toFixed(2);
  const lon       = (telemetry?.orbit?.longitudeDeg ?? 77.62).toFixed(2);
  const altKm     = (telemetry?.orbit?.altitudeKm ?? 650.0).toFixed(1);
  const velKms    = (telemetry?.orbit?.velocityKms ?? 7.62).toFixed(2);
  const signalDbm = (telemetry?.comm?.signalDbm ?? -72).toFixed(0);

  const handleWarpChange = (val: number) => {
    setTimeMultiplier(val);
    if (backendWS.isConnected) backendWS.setTimeMultiplier(val);
  };

  const handleTabClick = (tab: { id: MCTab; screen?: string }) => {
    if (tab.screen) {
      setScreen(tab.screen as any);
    } else {
      setActiveTab(tab.id);
    }
  };

  const navTabs = getNavTabs(isHumanMission);

  // Subsystem details
  const subsystemDetails = useMemo(() => {
    if (!selectedSubsystem) return null;
    const name = selectedSubsystem.toLowerCase();
    if (name.includes('power') || name.includes('eps') || name.includes('solar')) {
      return {
        title: 'ELECTRICAL POWER SYSTEM (EPS)',
        health: Math.round(batteryPct),
        status: batteryPct < 30 ? 'CRITICAL' : 'NOMINAL',
        metrics: [
          { k: 'Bus Voltage', v: `${telemetry?.power.voltageV.toFixed(1) ?? '28.0'} V` },
          { k: 'Solar Generation', v: `${telemetry?.power.solarGenerationW.toFixed(0) ?? '850'} W` },
          { k: 'Load Demand', v: `${telemetry?.power.consumptionW.toFixed(0) ?? '410'} W` },
          { k: 'Battery State', v: `${batteryPct.toFixed(1)} %` },
        ],
        alerts: activeThreats.filter((t) => t.id.includes('power') || t.id.includes('battery')),
      };
    }
    if (name.includes('thermal') || name.includes('tcs')) {
      return {
        title: 'THERMAL CONTROL SYSTEM (TCS)',
        health: telemetry ? Math.max(0, Math.round(100 - (telemetry.thermal.cpuTempC - 45) * 1.5)) : 96,
        status: telemetry && telemetry.thermal.cpuTempC > 70 ? 'WARNING' : 'NOMINAL',
        metrics: [
          { k: 'Core CPU Temp', v: `${telemetry?.thermal.cpuTempC.toFixed(1) ?? '42.5'} °C` },
          { k: 'Battery Pack Temp', v: `${telemetry?.thermal.batteryTempC.toFixed(1) ?? '21.0'} °C` },
          { k: 'Payload Temp', v: `${telemetry?.thermal.payloadTempC.toFixed(1) ?? '15.4'} °C` },
          { k: 'Skin Radiator Temp', v: `${telemetry?.thermal.externalTempC.toFixed(0) ?? '-45'} °C` },
        ],
        alerts: activeThreats.filter((t) => t.id.includes('thermal') || t.id.includes('solar')),
      };
    }
    if (name.includes('comm') || name.includes('antenna') || name.includes('rf')) {
      return {
        title: 'COMMUNICATIONS & RF (HGA)',
        health: telemetry && telemetry.comm.signalDbm < -95 ? 42 : 99,
        status: telemetry && telemetry.comm.signalDbm < -90 ? 'WARNING' : 'NOMINAL',
        metrics: [
          { k: 'Carrier Signal', v: `${telemetry?.comm.signalDbm.toFixed(0) ?? '-72'} dBm` },
          { k: 'Downlink Rate', v: `${telemetry?.comm.dataRateMbps.toFixed(1) ?? '150.0'} Mbps` },
          { k: 'Packet Error Rate', v: '0.002 %' },
          { k: 'Antenna Pointing', v: 'DSN Locked' },
        ],
        alerts: activeThreats.filter((t) => t.id.includes('comm') || t.id.includes('signal')),
      };
    }
    return {
      title: 'SCIENCE PAYLOAD & AVIONICS (OBC)',
      health: 97,
      status: 'NOMINAL',
      metrics: [
        { k: 'Instrument State', v: 'Active Scanning' },
        { k: 'Signal-to-Noise', v: '48.2 dB' },
        { k: 'Science Storage Buffer', v: '1.4 TB / 4.0 TB' },
        { k: 'Real-time Telemetry Ingest', v: '10 Hz Active' },
      ],
      alerts: activeThreats,
    };
  }, [selectedSubsystem, telemetry, activeThreats]);

  const progressPct = Math.min((missionDay / (totalDays || 17)) * 100, 100);

  return (
    <div style={{
      width: '100%', height: '100%',
      display: 'grid',
      gridTemplateColumns: '290px 1fr 300px',
      gridTemplateRows: '52px 1fr 46px',
      background: '#020409',
      overflow: 'hidden',
      color: '#fff',
      fontFamily: 'var(--font-sans, system-ui, sans-serif)',
    }}>

      {/* ══ TOP STATUS BAR ══════════════════════════════════════════════════ */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'rgba(2,4,9,0.98)',
        borderBottom: '1px solid rgba(0,212,255,0.12)',
        display: 'flex', alignItems: 'center',
        padding: '0 16px', gap: 10, zIndex: 10,
      }}>
        {/* Brand → back to welcome */}
        <button
          onClick={() => setScreen('welcome')}
          style={{
            background: 'none', border: 'none', cursor: 'pointer',
            fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 900,
            color: '#00d4ff', letterSpacing: '0.2em',
            display: 'flex', alignItems: 'center', gap: 6,
          }}
        >
          VYOM
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 7, padding: '2px 4px', borderRadius: 2,
            background: wsStatus === 'connected' ? 'rgba(155,93,229,0.2)' : 'rgba(0,255,136,0.1)',
            border: `1px solid ${wsStatus === 'connected' ? '#9b5de5' : 'rgba(0,255,136,0.3)'}`,
            color: wsStatus === 'connected' ? '#9b5de5' : '#00ff88',
          }}>
            {wsStatus === 'connected' ? 'LIVE BACKEND' : 'LOCAL SIM'}
          </div>
        </button>

        <div style={{ width: 1, height: 18, background: 'rgba(255,255,255,0.08)' }} />

        {/* Mission identity */}
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: '#fff', letterSpacing: '0.06em' }}>
          {config?.name ?? 'VYOM-01'}
        </div>
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 6px',
          background: isHumanMission ? 'rgba(0,255,136,0.12)' : 'rgba(0,212,255,0.12)',
          border: `1px solid ${isHumanMission ? '#00ff88' : '#00d4ff'}`,
          borderRadius: 3, color: isHumanMission ? '#00ff88' : '#00d4ff',
        }}>
          {isHumanMission ? '👨‍🚀 CREWED' : config?.type?.toUpperCase() ?? 'ORBITAL'}
        </div>

        {/* Target */}
        <div style={{
          fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 8px',
          background: 'rgba(0,212,255,0.06)', border: '1px solid rgba(0,212,255,0.18)', borderRadius: 4,
          color: '#00d4ff',
        }}>
          ↗ {config?.destination?.toUpperCase().replace(/-/g, ' ') ?? 'EARTH ORBIT'}
        </div>

        {/* Status dot */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
          <div style={{ width: 5, height: 5, borderRadius: '50%', background: statusColor, boxShadow: `0 0 8px ${statusColor}` }} />
          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: statusColor }}>{status.toUpperCase()}</span>
        </div>

        {/* Threat badge */}
        {activeThreats.length > 0 && (
          <div style={{
            padding: '3px 8px', background: 'rgba(255,45,85,0.15)',
            border: '1px solid rgba(255,45,85,0.5)', borderRadius: 4,
            fontFamily: 'var(--font-mono)', fontSize: 8, color: '#ff2d55',
            animation: 'threat-alert 1s ease-in-out infinite',
          }}>
            ⚠ {activeThreats.length} THREAT
          </div>
        )}

        {/* Mission Clock — prominent center piece */}
        <div style={{
          marginLeft: 'auto', marginRight: 'auto',
          display: 'flex', flexDirection: 'column', alignItems: 'center',
          padding: '3px 18px',
          background: 'rgba(0,212,255,0.06)',
          border: '1px solid rgba(0,212,255,0.18)',
          borderRadius: 6,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(0,212,255,0.5)', letterSpacing: '0.2em' }}>
            MISSION ELAPSED
          </div>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 18, fontWeight: 700, color: '#00d4ff', letterSpacing: '0.04em', lineHeight: 1 }}>
              DAY {day}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.06em' }}>
              {hms}
            </span>
          </div>
          {/* Progress bar */}
          <div style={{ width: 140, height: 2, background: 'rgba(255,255,255,0.1)', borderRadius: 1, marginTop: 3 }}>
            <div style={{ width: `${progressPct}%`, height: '100%', background: 'linear-gradient(90deg, #00d4ff, #00ff88)', borderRadius: 1, transition: 'width 1s ease' }} />
          </div>
        </div>

        {/* Warp & New Mission — right side */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            onClick={() => setScreen('onboarding')}
            style={{
              padding: '4px 10px', background: 'rgba(0,212,255,0.08)',
              border: '1px solid rgba(0,212,255,0.3)', borderRadius: 4,
              color: '#00d4ff', fontFamily: 'var(--font-mono)', fontSize: 8,
              cursor: 'pointer',
            }}
          >
            + NEW MISSION
          </button>
          <div style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            {WARP_SPEEDS.map((sp) => (
              <button key={sp.val}
                onClick={() => handleWarpChange(sp.val)}
                style={{
                  fontFamily: 'var(--font-mono)', fontSize: 7.5, padding: '3px 5px',
                  background: timeMultiplier === sp.val ? 'rgba(0,212,255,0.25)' : 'transparent',
                  border: `1px solid ${timeMultiplier === sp.val ? '#00d4ff' : 'rgba(255,255,255,0.08)'}`,
                  borderRadius: 3, color: timeMultiplier === sp.val ? '#00d4ff' : 'rgba(255,255,255,0.35)',
                  cursor: 'pointer',
                }}
              >
                {sp.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ LEFT PANEL ═══════════════════════════════════════════════════════ */}
      <div style={{
        background: 'rgba(5,12,25,0.94)', borderRight: '1px solid rgba(0,212,255,0.07)',
        padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 10,
      }}>
        {/* Health Ring */}
        <div style={{ textAlign: 'center', padding: '4px 0 8px' }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.3)', marginBottom: 5 }}>
            SPACECRAFT HEALTH
          </div>
          <HealthRing value={health} />
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: statusColor, marginTop: 3 }}>
            {healthStatus.toUpperCase()}
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

        {/* Crew vitals or Payload status */}
        {isHumanMission && crew.length > 0 ? (
          <div style={{
            padding: '9px', background: 'rgba(0,255,136,0.04)',
            border: '1px solid rgba(0,255,136,0.18)', borderRadius: 8,
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00ff88', letterSpacing: '0.1em' }}>
                👨‍🚀 CREW ({crew.length})
              </span>
              <button onClick={() => setScreen('crew')} style={{ background: 'none', border: 'none', color: '#00d4ff', fontFamily: 'var(--font-mono)', fontSize: 7.5, cursor: 'pointer' }}>
                HUD →
              </button>
            </div>
            {crew.slice(0, 3).map((c) => (
              <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 3 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#fff' }}>{c.name.split(' ').slice(-1)[0]}</span>
                <div style={{ display: 'flex', gap: 8 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88' }}>{c.heartRateBpm} BPM</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00d4ff' }}>{c.spo2Percent}%</span>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{
            padding: '9px', background: 'rgba(0,212,255,0.03)',
            border: '1px solid rgba(0,212,255,0.12)', borderRadius: 8,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00d4ff', letterSpacing: '0.1em', marginBottom: 3 }}>🛰 PAYLOAD SUITE</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fff' }}>Autonomous Scanning</div>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 4 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>Instruments: Nominal</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88' }}>SNR: 48 dB</span>
            </div>
          </div>
        )}

        {/* Objective progress */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 3 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.12em' }}>OBJECTIVE PROGRESS</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00d4ff', fontWeight: 700 }}>{Math.round(objectiveProgress)}%</span>
          </div>
          <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.08)', borderRadius: 2 }}>
            <div style={{ height: '100%', width: `${Math.max(2, objectiveProgress)}%`, background: 'linear-gradient(90deg, #00d4ff, #00ff88)', borderRadius: 2, transition: 'width 0.8s ease' }} />
          </div>
          <div style={{ fontFamily: 'var(--font-body)', fontSize: 9.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.4, marginTop: 4 }}>
            {config?.objective ?? 'Mission objectives active.'}
          </div>
        </div>

        <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

        {/* AI Guardian */}
        <div
          onClick={() => setScreen('ai')}
          style={{
            padding: '9px', cursor: 'pointer',
            background: aiAnalysis.anomalyDetected ? 'rgba(155,93,229,0.12)' : 'rgba(0,0,0,0.2)',
            border: `1px solid ${aiAnalysis.anomalyDetected ? '#9b5de5' : 'rgba(255,255,255,0.06)'}`,
            borderRadius: 8,
          }}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 5 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#9b5de5', animation: 'ai-pulse 2s ease-in-out infinite' }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#9b5de5', letterSpacing: '0.12em' }}>VYOM AI</span>
            </div>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#9b5de5' }}>OPEN →</span>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: aiAnalysis.anomalyDetected ? '#ff8c00' : 'rgba(255,255,255,0.6)', lineHeight: 1.3 }}>
            {aiAnalysis.anomalyDetected ? `[${aiAnalysis.phase?.toUpperCase()}] ${aiAnalysis.anomalyDescription}` : 'Neural kernel nominal'}
          </div>
        </div>

        {/* Quick danger triggers */}
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 5 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,45,85,0.7)', letterSpacing: '0.12em' }}>⚡ DANGER SIM</span>
            <button onClick={() => setScreen('scenarios')} style={{ background: 'none', border: 'none', color: '#ff2d55', fontFamily: 'var(--font-mono)', fontSize: 7.5, cursor: 'pointer' }}>
              ALL →
            </button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 3 }}>
            {[
              { id: 'solar-storm',   label: '☀️ SOLAR' },
              { id: 'space-debris',  label: '💥 DEBRIS' },
              { id: 'battery-drain', label: '🔋 POWER' },
              { id: 'signal-loss',   label: '📡 COMMS' },
            ].map((t) => (
              <button
                key={t.id}
                onClick={() => threatEngine.triggerThreat(t.id, t.label, `${t.label} anomaly`, { [t.id.replace('-', '_')]: 5 })}
                style={{
                  padding: '5px 3px', background: 'rgba(255,45,85,0.06)',
                  border: '1px solid rgba(255,45,85,0.22)', borderRadius: 4,
                  color: '#ff2d55', fontFamily: 'var(--font-mono)', fontSize: 7.5,
                  cursor: 'pointer',
                }}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ══ CENTER: 3D DIGITAL TWIN ═══════════════════════════════════════════ */}
      <div style={{ position: 'relative', background: '#020409', overflow: 'hidden' }}>
        <Canvas gl={{ antialias: true }} dpr={[1, 2]}>
          <PerspectiveCamera makeDefault position={[0, 0.5, 4]} fov={40} />
          <ambientLight intensity={0.3} />
          <directionalLight position={[4, 3, 4]} intensity={1.4} color="#fff5e8" />
          <directionalLight position={[-3, -1, -3]} intensity={0.4} color="#aaccff" />
          <StarField />
          <DynamicSpacecraftModel
            scale={1.4}
            interactive
            selectedSubsystem={selectedSubsystem}
            onSelectSubsystem={(name) => setSelectedSubsystem(name)}
          />
          <OrbitControls enableZoom enablePan maxDistance={10} minDistance={1.2} />
        </Canvas>

        {/* Top-left HUD */}
        <div style={{
          position: 'absolute', top: 14, left: 14,
          fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,212,255,0.65)',
          background: 'rgba(2,4,9,0.7)', padding: '3px 8px', borderRadius: 4,
          backdropFilter: 'blur(4px)',
        }}>
          DIGITAL TWIN · {config?.name ?? 'VYOM-01'} · CLICK TO INSPECT
        </div>

        {/* Subsystem ribbon */}
        <div style={{
          position: 'absolute', top: 14, right: 14,
          display: 'flex', gap: 5,
          background: 'rgba(2,6,14,0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0,212,255,0.22)', borderRadius: 6, padding: '3px 8px',
          zIndex: 5,
        }}>
          {['Power', 'Thermal', 'Comms', 'Propulsion', 'Payload'].map((sub) => {
            const active = selectedSubsystem?.toLowerCase().includes(sub.toLowerCase());
            return (
              <button
                key={sub}
                onClick={() => setSelectedSubsystem(active ? null : sub)}
                style={{
                  background: active ? 'rgba(0,212,255,0.28)' : 'transparent',
                  border: `1px solid ${active ? '#00d4ff' : 'transparent'}`,
                  borderRadius: 3, padding: '2px 7px',
                  color: active ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                  fontFamily: 'var(--font-mono)', fontSize: 7.5, fontWeight: 700,
                  cursor: 'pointer',
                }}
              >
                {sub.toUpperCase()}
              </button>
            );
          })}
        </div>

        {/* Subsystem diagnostic popover */}
        <AnimatePresence>
          {subsystemDetails && (
            <motion.div
              key="diag"
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 20 }}
              style={{
                position: 'absolute', top: 50, right: 14, width: 268,
                background: 'rgba(5,14,30,0.94)', backdropFilter: 'blur(16px)',
                border: '1px solid #00d4ff', borderRadius: 8, padding: '12px',
                boxShadow: '0 8px 32px rgba(0,0,0,0.8), 0 0 20px rgba(0,212,255,0.15)',
                zIndex: 15,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 7 }}>
                <span style={{ fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 800, color: '#00d4ff', letterSpacing: '0.06em' }}>
                  {subsystemDetails.title}
                </span>
                <button onClick={() => setSelectedSubsystem(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.5)', cursor: 'pointer', fontSize: 13 }}>✕</button>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>INTEGRITY:</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, fontWeight: 700, color: subsystemDetails.health > 70 ? '#00ff88' : '#ff3b30' }}>
                  {subsystemDetails.health}% · {subsystemDetails.status}
                </span>
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 3, marginBottom: 8 }}>
                {subsystemDetails.metrics.map((m) => (
                  <div key={m.k} style={{ display: 'flex', justifyContent: 'space-between', background: 'rgba(0,0,0,0.3)', padding: '3px 7px', borderRadius: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>{m.k}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#fff', fontWeight: 600 }}>{m.v}</span>
                  </div>
                ))}
              </div>
              {subsystemDetails.alerts.length > 0 ? (
                <div style={{ padding: '5px', background: 'rgba(255,45,85,0.12)', border: '1px solid #ff2d55', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: '#ff2d55' }}>
                  ⚠ {subsystemDetails.alerts[0].name}
                </div>
              ) : (
                <div style={{ padding: '4px 7px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.28)', borderRadius: 4, fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88', textAlign: 'center' }}>
                  ✓ All metrics nominal
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Active Threat flash */}
        {activeThreats.length > 0 && (
          <div style={{
            position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%,-50%)',
            fontFamily: 'var(--font-display)', fontSize: 12, color: '#ff2d55',
            letterSpacing: '0.2em', animation: 'data-flash 0.8s ease-in-out infinite',
            pointerEvents: 'none', background: 'rgba(0,0,0,0.7)', padding: '7px 14px',
            borderRadius: 6, border: '1px solid #ff2d55',
          }}>
            ⚠ {activeThreats[0]?.name}
          </div>
        )}

        {/* Live coordinates ribbon */}
        <div style={{
          position: 'absolute', bottom: 14, left: 14,
          background: 'rgba(2,6,14,0.85)', backdropFilter: 'blur(8px)',
          border: '1px solid rgba(0,212,255,0.22)', borderRadius: 6,
          padding: '5px 10px', display: 'flex', gap: 12, alignItems: 'center',
          fontFamily: 'var(--font-mono)', fontSize: 8.5,
        }}>
          <div><span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 3 }}>LAT:</span><span style={{ color: '#00d4ff', fontWeight: 700 }}>{lat}°</span></div>
          <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.12)' }} />
          <div><span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 3 }}>LON:</span><span style={{ color: '#00d4ff', fontWeight: 700 }}>{lon}°</span></div>
          <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.12)' }} />
          <div><span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 3 }}>ALT:</span><span style={{ color: '#00ff88', fontWeight: 700 }}>{altKm} km</span></div>
          <div style={{ width: 1, height: 10, background: 'rgba(255,255,255,0.12)' }} />
          <div><span style={{ color: 'rgba(255,255,255,0.35)', marginRight: 3 }}>VEL:</span><span style={{ color: '#ff9f0a', fontWeight: 700 }}>{velKms} km/s</span></div>
        </div>

        {/* Signal bottom right */}
        {telemetry && (
          <div style={{
            position: 'absolute', bottom: 14, right: 14, display: 'flex', alignItems: 'center', gap: 6,
            background: 'rgba(2,6,14,0.85)', backdropFilter: 'blur(8px)',
            border: '1px solid rgba(0,212,255,0.18)', borderRadius: 6, padding: '5px 10px',
          }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: '#00d4ff', animation: 'pulse-dot 2s ease-in-out infinite' }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(0,212,255,0.9)' }}>
              {signalDbm} dBm · {telemetry.orbit.phaseDesc ?? 'Nominal'}
            </span>
          </div>
        )}
      </div>

      {/* ══ RIGHT PANEL: LIVE TELEMETRY ══════════════════════════════════════ */}
      <div style={{
        background: 'rgba(5,12,25,0.94)', borderLeft: '1px solid rgba(0,212,255,0.07)',
        padding: '12px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 9,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.35)' }}>
          LIVE TELEMETRY STREAM
        </div>

        {telemetry && (
          <>
            {/* Power */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em', marginBottom: 4 }}>⚡ POWER</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <TelemetryMini label="BATTERY" value={batteryPct.toFixed(1)} unit="%" status={batteryPct < 25 ? 'critical' : batteryPct < 40 ? 'warning' : undefined} />
                <TelemetryMini label="BUS VOLT" value={telemetry.power.voltageV.toFixed(1)} unit="V" status={telemetry.power.voltageV < 22 ? 'critical' : undefined} />
                <TelemetryMini label="SOLAR GEN" value={telemetry.power.solarGenerationW.toFixed(0)} unit="W" />
                <TelemetryMini label="LOAD DRAW" value={telemetry.power.consumptionW.toFixed(0)} unit="W" />
              </div>
            </div>

            {/* Battery history chart */}
            <div style={{ height: 40 }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={powerHistory}>
                  <Line type="monotone" dataKey="v" stroke="#00d4ff" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                </LineChart>
              </ResponsiveContainer>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

            {/* Thermal */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em', marginBottom: 4 }}>🌡 THERMAL</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <TelemetryMini label="CPU TEMP" value={telemetry.thermal.cpuTempC.toFixed(1)} unit="°C" status={telemetry.thermal.cpuTempC > 80 ? 'critical' : telemetry.thermal.cpuTempC > 65 ? 'warning' : undefined} />
                <TelemetryMini label="BAT TEMP" value={telemetry.thermal.batteryTempC.toFixed(1)} unit="°C" />
                <TelemetryMini label="PAYLOAD T" value={telemetry.thermal.payloadTempC.toFixed(1)} unit="°C" />
                <TelemetryMini label="EXT TEMP" value={telemetry.thermal.externalTempC.toFixed(0)} unit="°C" />
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

            {/* Orbit */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em', marginBottom: 4 }}>
                {isHumanMission ? '○ TRAJECTORY' : '○ ORBIT'}
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <TelemetryMini label="ALTITUDE" value={telemetry.orbit.altitudeKm.toFixed(1)} unit="km" />
                <TelemetryMini label="VELOCITY" value={telemetry.orbit.velocityKms.toFixed(2)} unit="km/s" />
                <TelemetryMini label="ACCEL" value={(telemetry.orbit.accelerationMs2 ?? 8.09).toFixed(2)} unit="m/s²" />
                <TelemetryMini label="G-FORCE" value={(telemetry.orbit.gForce ?? 0.82).toFixed(2)} unit="g" />
              </div>
            </div>

            <div style={{ height: 1, background: 'rgba(255,255,255,0.05)' }} />

            {/* Comms & Attitude */}
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em', marginBottom: 4 }}>📡 COMMS & ATTITUDE</div>
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 4 }}>
                <TelemetryMini label="SIGNAL" value={telemetry.comm.signalDbm.toFixed(0)} unit="dBm" status={telemetry.comm.signalDbm < -95 ? 'critical' : undefined} />
                <TelemetryMini label="RATE" value={telemetry.comm.dataRateMbps.toFixed(1)} unit="Mbps" />
                <TelemetryMini label="ROLL" value={telemetry.attitude.rollDeg.toFixed(2)} unit="°" />
                <TelemetryMini label="PITCH" value={telemetry.attitude.pitchDeg.toFixed(2)} unit="°" />
              </div>
            </div>
          </>
        )}
      </div>

      {/* ══ BOTTOM NAVIGATION ════════════════════════════════════════════════ */}
      <div style={{
        gridColumn: '1 / -1',
        background: 'rgba(2,4,9,0.98)',
        borderTop: '1px solid rgba(0,212,255,0.12)',
        display: 'flex', alignItems: 'stretch',
        zIndex: 10,
        overflow: 'hidden',
      }}>
        {navTabs.map((tab, idx) => {
          const isActive = activeTab === tab.id && !tab.screen;
          return (
            <button
              key={tab.id}
              onClick={() => handleTabClick(tab)}
              style={{
                flex: 1,
                background: isActive ? 'rgba(0,212,255,0.1)' : 'transparent',
                border: 'none',
                borderTop: isActive ? '2px solid #00d4ff' : '2px solid transparent',
                borderRight: idx < navTabs.length - 1 ? '1px solid rgba(255,255,255,0.05)' : 'none',
                color: isActive ? '#00d4ff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                padding: '0 4px',
                transition: 'all 0.2s',
              }}
              onMouseEnter={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'rgba(0,212,255,0.05)'; }}
              onMouseLeave={(e) => { if (!isActive) (e.currentTarget as HTMLElement).style.background = 'transparent'; }}
            >
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: isActive ? 'rgba(0,212,255,0.6)' : 'rgba(255,255,255,0.2)', letterSpacing: '0.1em' }}>
                {tab.num}
              </span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 600, letterSpacing: '0.08em', lineHeight: 1 }}>
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
