import { useState, useMemo } from 'react';
import {
  AreaChart, Area, LineChart, Line, ResponsiveContainer,
  Tooltip, XAxis, YAxis, CartesianGrid, Legend
} from 'recharts';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import jsPDF from 'jspdf';

type ReportTab = 'summary' | 'health-integrity' | 'incidents' | 'milestones' | 'blackbox';

function generateClientPDF(config: any, stats: any, blackBox: any[], crew: any[], telemetry: any) {
  const doc = new jsPDF({ orientation: 'portrait', unit: 'mm', format: 'a4' });

  const addText = (text: string, x: number, y: number, opts: any = {}) => {
    doc.setFont(opts.font || 'helvetica', opts.style || 'normal');
    doc.setFontSize(opts.size || 10);
    const [r, g, b] = opts.color || [255, 255, 255];
    doc.setTextColor(r, g, b);
    doc.text(String(text ?? ''), x, y);
  };

  // Background
  doc.setFillColor(2, 4, 9);
  doc.rect(0, 0, 210, 297, 'F');

  // Header bar
  doc.setFillColor(0, 24, 48);
  doc.rect(0, 0, 210, 36, 'F');
  doc.setDrawColor(0, 212, 255);
  doc.setLineWidth(0.4);
  doc.line(0, 36, 210, 36);

  // Title
  addText('VYOM', 14, 16, { size: 24, font: 'helvetica', style: 'bold', color: [0, 212, 255] });
  addText('OFFICIAL MISSION DOSSIER & HEALTH INTEGRITY FLIGHT REPORT', 14, 25, { size: 9, color: [0, 212, 255] });
  addText(`DOCUMENT ID: VYOM-${(config?.id ?? '001').toUpperCase()}`, 14, 31, { size: 7, color: [100, 160, 210] });

  addText(`SIMULATION ENGINE AUTHORITATIVE RECORD`, 115, 15, { size: 7, color: [100, 160, 210] });
  addText(`Generated: ${new Date().toISOString().replace('T', ' ').slice(0, 19)} UTC`, 115, 21, { size: 7, color: [130, 150, 180] });
  addText(`Classification: ${(config?.type ?? 'ORBITAL').toUpperCase()} EXPLORATION`, 115, 27, { size: 7, color: [130, 150, 180] });

  let y = 48;

  // 01: Mission Profile & Specifications
  doc.setDrawColor(0, 212, 255);
  doc.setLineWidth(0.2);
  doc.line(14, y - 3, 196, y - 3);
  addText('01 · MISSION PROFILE & FLIGHT SPECIFICATIONS', 14, y + 3, { size: 10.5, style: 'bold', color: [0, 212, 255] });
  y += 11;

  const summaryData = [
    ['Mission Name', config?.name ?? 'VYOM SPACECRAFT'],
    ['Mission Classification', (config?.type ?? 'orbital').toUpperCase()],
    ['Target Destination', (config?.destination ?? 'earth-orbit').toUpperCase().replace('-', ' ')],
    ['Primary Objective', (config?.objective ?? 'Orbital observations and planetary survey').slice(0, 70)],
    ['Budget Allocation', `INR ${config?.budgetCrore ?? 250} Crores`],
    ['Launch Complex', config?.launchSite?.name ?? 'Satish Dhawan Space Centre (SLP)'],
    ['Operating Agency', config?.launchSite?.agency ?? 'ISRO'],
  ];

  summaryData.forEach(([label, value]) => {
    addText(label + ':', 16, y, { size: 8, color: [100, 160, 200] });
    addText(value, 75, y, { size: 8, color: [220, 230, 240] });
    y += 5.5;
  });

  y += 3;

  // 02: Spacecraft Health & Integrity Profile
  doc.line(14, y - 3, 196, y - 3);
  addText('02 · HEALTH INTEGRITY & POWER PERFORMANCE', 14, y + 3, { size: 10.5, style: 'bold', color: [0, 212, 255] });
  y += 10;

  const maxH = typeof stats?.maxHealth === 'number' ? stats.maxHealth.toFixed(0) : '100';
  const minH = typeof stats?.minHealth === 'number' ? stats.minHealth.toFixed(0) : '95';
  const threats = String(stats?.threatsEncountered ?? 0);
  const aiOps = String(stats?.aiInterventions ?? 0);

  const healthData = [
    ['Spacecraft Overall Health Integrity', `${(telemetry?.overallHealth ?? 98.5).toFixed(1)}%`],
    ['Maximum Health Observed', `${maxH}%`],
    ['Minimum Health Observed', `${minH}%`],
    ['Battery State of Charge (SoC)', `${(telemetry?.power?.batteryPercent ?? 96.4).toFixed(1)}%`],
    ['Solar Array Generation', `${(telemetry?.power?.solarGenerationW ?? 260).toFixed(0)} W`],
    ['Total Power Consumption', `${(telemetry?.power?.consumptionW ?? 120).toFixed(0)} W`],
    ['Flight Computer CPU Temperature', `${(telemetry?.thermal?.cpuTempC ?? 41.8).toFixed(1)} °C`],
    ['Threats Encountered & Mitigated', `${threats} (${aiOps} Autonomous AI Interventions)`],
  ];

  healthData.forEach(([label, value]) => {
    addText(label + ':', 16, y, { size: 8, color: [100, 160, 200] });
    addText(value, 90, y, { size: 8, color: [220, 230, 240] });
    y += 5.2;
  });

  y += 4;

  // 03: Astronaut Crew (if human mission)
  if (config?.type === 'human' && crew && crew.length > 0) {
    doc.line(14, y - 3, 196, y - 3);
    addText('03 · ASTRONAUT CREW COMPLEMENT & BIOMETRICS', 14, y + 3, { size: 10.5, style: 'bold', color: [0, 255, 136] });
    y += 10;

    crew.forEach((c: any) => {
      addText(`• ${c.name ?? 'Crew Member'} [${c.role ?? 'Astronaut'}]`, 16, y, { size: 8, color: [240, 240, 255], style: 'bold' });
      addText(`HR: ${c.heartRateBpm ?? 72} BPM | SpO2: ${c.spo2Percent ?? 99}% | Rad: ${c.radiationDoseMsv ?? 0.12} mSv | Status: ${(c.status ?? 'NOMINAL').toUpperCase()}`, 88, y, { size: 7, color: [140, 200, 220] });
      y += 5;
    });

    y += 3;
  }

  // 04: Black Box Chronicle
  doc.line(14, y - 3, 196, y - 3);
  addText('04 · MISSION BLACK BOX CHRONICLE EXCERPT', 14, y + 3, { size: 10.5, style: 'bold', color: [0, 212, 255] });
  y += 10;

  const safeEvents = Array.isArray(blackBox) && blackBox.length > 0 ? blackBox.slice(-6).reverse() : [
    { missionDay: 0, eventType: 'milestone', source: 'Flight Control', description: 'Mission initiated. All telemetry channels nominal.' },
    { missionDay: 1, eventType: 'telemetry', source: 'ADCS Subsystem', description: 'Reaction wheels and attitude control locked in nominal orientation.' },
    { missionDay: 5, eventType: 'recovery', source: 'VYOM AI', description: 'Autonomous guardian monitoring active. Subsystems 100% operational.' },
  ];

  safeEvents.forEach((ev: any) => {
    const day = typeof ev.missionDay === 'number' ? Math.floor(ev.missionDay) : 0;
    const type = String(ev.eventType ?? 'milestone').toUpperCase();
    const source = String(ev.source ?? 'System');
    addText(`DAY ${day} [${type}] ${source}:`, 16, y, { size: 7, color: [120, 160, 200] });
    const desc = String(ev.description ?? '').slice(0, 75);
    addText(desc, 80, y, { size: 7, color: [190, 210, 230] });
    y += 5;
    if (y > 275) {
      doc.addPage();
      doc.setFillColor(2, 4, 9);
      doc.rect(0, 0, 210, 297, 'F');
      y = 20;
    }
  });

  // Footer
  doc.setFillColor(0, 20, 40);
  doc.rect(0, 285, 210, 12, 'F');
  doc.setDrawColor(0, 212, 255);
  doc.line(0, 285, 210, 285);
  addText('VYOM Aerospace Mission Dossier · Authorized by Simulation Engine · Authoritative Digital Twin Telemetry', 14, 292, { size: 6.5, color: [80, 140, 190] });

  const filename = `VYOM_${(config?.name ?? 'Mission').replace(/[^a-zA-Z0-9_-]/g, '_')}_Report.pdf`;
  doc.save(filename);
}

export function ReportsScreen() {
  const config = useMissionStore((s) => s.config);
  const stats = useMissionStore((s) => s.stats);
  const crew = useMissionStore((s) => s.crew);
  const telemetry = useMissionStore((s) => s.telemetry);
  const telemetryHistory = useMissionStore((s) => s.telemetryHistory);
  const blackBox = useMissionStore((s) => s.blackBox);
  const activeThreats = useMissionStore((s) => s.activeThreats);
  const missionDay = useMissionStore((s) => s.missionDay);
  const objectiveProgress = useMissionStore((s) => s.objectiveProgress);
  const milestones = useMissionStore((s) => s.milestones);
  const environment = useMissionStore((s) => s.environment);
  const aiAnalysis = useMissionStore((s) => s.aiAnalysis);
  const dailySummaries = useMissionStore((s) => s.dailySummaries);
  const incidents = useMissionStore((s) => s.incidents);

  const [activeTab, setActiveTab] = useState<ReportTab>('health-integrity');
  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isHumanMission = config?.type === 'human';

  // ── High-Accuracy Power & Battery Dataset with Real-Time Calibration ──────────
  const powerData = useMemo(() => {
    const history = telemetryHistory || [];
    if (history.length >= 3) {
      return history.slice(-60).map((t, idx) => ({
        index: idx,
        timeLabel: `T-${(history.length - idx) * 2}s`,
        batteryPercent: Math.max(0, Math.min(100, Number((t.power?.batteryPercent ?? 96.4).toFixed(1)))),
        solarWatts: Math.max(0, Math.round(t.power?.solarGenerationW ?? 260)),
        consumptionWatts: Math.max(0, Math.round(t.power?.consumptionW ?? 120)),
        voltageV: Number((t.power?.voltageV ?? 28.4).toFixed(2)),
      }));
    }

    // Fallback baseline points calibrated to current live telemetry
    const currentBat = telemetry?.power?.batteryPercent ?? 96.4;
    const currentSolar = telemetry?.power?.solarGenerationW ?? 260;
    const currentCons = telemetry?.power?.consumptionW ?? 120;
    const currentVolt = telemetry?.power?.voltageV ?? 28.4;

    return Array.from({ length: 30 }, (_, i) => {
      const step = (30 - i);
      return {
        index: i,
        timeLabel: `T-${step * 2}s`,
        batteryPercent: Math.max(0, Math.min(100, Number((currentBat + step * 0.02).toFixed(1)))),
        solarWatts: Math.max(0, Math.round(currentSolar)),
        consumptionWatts: Math.max(0, Math.round(currentCons)),
        voltageV: Number(currentVolt.toFixed(2)),
      };
    });
  }, [telemetryHistory, telemetry?.power]);

  // ── High-Accuracy Spacecraft Health & Integrity Dataset ──────────────────────
  const healthData = useMemo(() => {
    const history = telemetryHistory || [];
    if (history.length >= 3) {
      return history.slice(-60).map((t, idx) => ({
        index: idx,
        timeLabel: `T-${(history.length - idx) * 2}s`,
        healthPercent: Math.max(0, Math.min(100, Number((t.overallHealth ?? 98.5).toFixed(1)))),
        cpuTempC: Number((t.thermal?.cpuTempC ?? 41.8).toFixed(1)),
        batteryTempC: Number((t.thermal?.batteryTempC ?? 18.2).toFixed(1)),
        minHealthThreshold: 80,
      }));
    }

    const currentHealth = telemetry?.overallHealth ?? 98.5;
    const currentCpu = telemetry?.thermal?.cpuTempC ?? 41.8;
    const currentBatT = telemetry?.thermal?.batteryTempC ?? 18.2;

    return Array.from({ length: 30 }, (_, i) => {
      const offset = (30 - i) * 0.12;
      return {
        index: i,
        timeLabel: `T-${(30 - i) * 2}s`,
        healthPercent: Math.max(0, Math.min(100, Number((currentHealth - Math.sin(offset) * 0.8).toFixed(1)))),
        cpuTempC: Number((currentCpu + Math.sin(offset) * 1.2).toFixed(1)),
        batteryTempC: Number((currentBatT + Math.cos(offset) * 0.6).toFixed(1)),
        minHealthThreshold: 80,
      };
    });
  }, [telemetryHistory, telemetry?.overallHealth, telemetry?.thermal]);

  // Dual-mode PDF Generator
  const handleExportPDF = async () => {
    setGenerating(true);
    setStatusMsg('Generating Mission PDF Dossier…');

    try {
      const missionId = config?.id;
      let downloaded = false;

      if (missionId) {
        try {
          const response = await fetch(`http://localhost:8000/api/missions/${missionId}/report/pdf`);
          if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = `VYOM_${(config?.name ?? 'Mission').replace(/[^a-zA-Z0-9_-]/g, '_')}_Official_Report.pdf`;
            document.body.appendChild(a);
            a.click();
            a.remove();
            window.URL.revokeObjectURL(url);
            downloaded = true;
          }
        } catch {
          // Backend offline, fallback to client
        }
      }

      if (!downloaded) {
        generateClientPDF(config, stats, blackBox, crew, telemetry);
      }

      setStatusMsg('✓ PDF Report Exported Successfully!');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      generateClientPDF(config, stats, blackBox, crew, telemetry);
      setStatusMsg('✓ PDF Report Exported!');
      setTimeout(() => setStatusMsg(null), 3000);
    } finally {
      setGenerating(false);
    }
  };

  // Export JSON dataset
  const handleExportJSON = () => {
    const data = {
      mission: config,
      stats,
      telemetry,
      environment,
      aiAnalysis,
      milestones,
      blackBox,
      incidents,
      crew: isHumanMission ? crew : undefined,
      exportedAt: new Date().toISOString(),
    };
    const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `VYOM_${(config?.name ?? 'Mission').replace(/[^a-zA-Z0-9_-]/g, '_')}_Telemetry_Data.json`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  // Copy Executive Summary
  const handleCopySummary = () => {
    const summary = `
========================================
VYOM AEROSPACE MISSION REPORT & HEALTH DOSSIER
========================================
Mission Name: ${config?.name ?? 'VYOM-01'}
Classification: ${(config?.type ?? 'ORBITAL').toUpperCase()}
Destination: ${(config?.destination ?? 'earth-orbit').toUpperCase()}
Mission Day: ${missionDay.toFixed(2)} Days
Objective Progress: ${Math.round(objectiveProgress)}%
Overall Spacecraft Health Integrity: ${(telemetry?.overallHealth ?? 98.5).toFixed(1)}%

HEALTH & POWER TELEMETRY:
- Battery State of Charge: ${(telemetry?.power?.batteryPercent ?? 96.4).toFixed(1)}%
- Bus Voltage: ${(telemetry?.power?.voltageV ?? 28.4).toFixed(2)} V
- Solar Generation: ${(telemetry?.power?.solarGenerationW ?? 260).toFixed(0)} W
- Bus Power Draw: ${(telemetry?.power?.consumptionW ?? 120).toFixed(0)} W
- Flight Computer Temp: ${(telemetry?.thermal?.cpuTempC ?? 41.8).toFixed(1)}°C
- Battery Pack Temp: ${(telemetry?.thermal?.batteryTempC ?? 18.2).toFixed(1)}°C
- ADCS Reaction Wheel: ${(telemetry?.attitude?.reactionWheelRpm ?? 3240).toFixed(0)} RPM

OPERATIONAL AUDIT:
- Threats Encountered & Mitigated: ${stats?.threatsEncountered ?? 0}
- Autonomous AI Actions: ${stats?.aiInterventions ?? 0}
- Active Anomalies: ${aiAnalysis?.anomalyDetected ? aiAnalysis.anomalyDescription : 'None (Systems Nominal)'}

Report generated by VYOM Space Mission Digital Twin.
========================================
`.trim();

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const healthVal = telemetry?.overallHealth ?? 98.5;
  const healthColor = healthVal > 80 ? '#00ff88' : healthVal > 50 ? '#ff8c00' : '#ff2d55';
  const batteryVal = telemetry?.power?.batteryPercent ?? 96.4;
  const solarVal = telemetry?.power?.solarGenerationW ?? 260;
  const consumptionVal = telemetry?.power?.consumptionW ?? 120;
  const voltageVal = telemetry?.power?.voltageV ?? 28.4;
  const cpuTempVal = telemetry?.thermal?.cpuTempC ?? 41.8;
  const batteryTempVal = telemetry?.thermal?.batteryTempC ?? 18.2;

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#020409', paddingBottom: 80, padding: '28px',
    }}>
      <div style={{ maxWidth: 1160, margin: '0 auto' }}>
        
        {/* Top Header Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 20, flexWrap: 'wrap', gap: 16,
          borderBottom: '1px solid rgba(0,212,255,0.15)', paddingBottom: 16,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.8)', letterSpacing: '0.2em', marginBottom: 4 }}>
              MISSION REPORTING &amp; HEALTH INTEGRITY AUDIT · {(config?.type ?? 'ORBITAL').toUpperCase()}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#fff', margin: 0 }}>
              {config?.name ?? 'VYOM-01'} MISSION DOSSIER
            </h1>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleCopySummary}
              className="btn btn-sm"
              style={{ padding: '8px 14px', fontSize: 10, background: 'rgba(255,255,255,0.05)' }}
            >
              {copied ? '✓ COPIED' : '📋 COPY SUMMARY'}
            </button>
            <button
              onClick={handleExportJSON}
              className="btn btn-sm"
              style={{ padding: '8px 14px', fontSize: 10, background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
            >
              💾 JSON DATA
            </button>
            <button
              onClick={handleExportPDF}
              disabled={generating}
              className="btn btn-primary"
              style={{ padding: '9px 20px', fontSize: 10.5, letterSpacing: '0.08em', boxShadow: '0 0 20px rgba(0,212,255,0.3)' }}
            >
              {generating ? 'GENERATING PDF…' : '📄 EXPORT OFFICIAL PDF'}
            </button>
          </div>
        </div>

        {/* Status notification */}
        {statusMsg && (
          <div style={{
            padding: '8px 16px', marginBottom: 16,
            background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.35)',
            borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00d4ff',
          }}>
            {statusMsg}
          </div>
        )}

        {/* ── Sub-Tabs Navigation (Health Integrity Tab, Executive Summary, Incidents, Milestones) ── */}
        <div style={{
          display: 'flex', gap: 8, marginBottom: 20, borderBottom: '1px solid rgba(255,255,255,0.08)',
          paddingBottom: 8, overflowX: 'auto',
        }}>
          {[
            { id: 'health-integrity' as ReportTab, label: '🛡️ HEALTH & INTEGRITY AUDIT', badge: `${healthVal.toFixed(1)}%` },
            { id: 'summary' as ReportTab, label: '📑 EXECUTIVE DOSSIER', badge: `${Math.round(objectiveProgress)}%` },
            { id: 'incidents' as ReportTab, label: '⚡ INCIDENTS & RECOVERY', badge: `${stats?.threatsEncountered ?? 0}` },
            { id: 'blackbox' as ReportTab, label: '📼 BLACK BOX LOG', badge: `${blackBox.length}` },
            { id: 'milestones' as ReportTab, label: '★ FLIGHT MILESTONES', badge: `${milestones.filter(m => m.completed).length}/${milestones.length}` },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              style={{
                padding: '8px 16px',
                background: activeTab === tab.id ? 'rgba(0,212,255,0.18)' : 'rgba(5,12,25,0.6)',
                border: `1px solid ${activeTab === tab.id ? '#00d4ff' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 6,
                color: activeTab === tab.id ? '#00d4ff' : 'rgba(255,255,255,0.6)',
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                fontWeight: 700,
                letterSpacing: '0.08em',
                cursor: 'pointer',
                transition: 'all 0.2s',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
              }}
            >
              <span>{tab.label}</span>
              <span style={{
                fontSize: 8, padding: '1px 5px', borderRadius: 3,
                background: activeTab === tab.id ? '#00d4ff' : 'rgba(255,255,255,0.1)',
                color: activeTab === tab.id ? '#000' : 'rgba(255,255,255,0.7)',
                fontWeight: 800,
              }}>
                {tab.badge}
              </span>
            </button>
          ))}
        </div>

        {/* ── TAB 1: HEALTH & INTEGRITY AUDIT (Detailed Accurate Graphs) ── */}
        {activeTab === 'health-integrity' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            
            {/* Health & Power Metric Cards Row */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 20 }}>
              {[
                { label: 'SPACECRAFT INTEGRITY', value: `${healthVal.toFixed(1)}%`, sub: 'Nominal Envelope', color: healthColor },
                { label: 'BATTERY STATE OF CHARGE', value: `${batteryVal.toFixed(1)}%`, sub: `${voltageVal.toFixed(1)} VDC Bus`, color: '#00d4ff' },
                { label: 'SOLAR GENERATION', value: `${solarVal.toFixed(0)} W`, sub: 'GaAs Array Normal', color: '#00ff88' },
                { label: 'POWER CONSUMPTION', value: `${consumptionVal.toFixed(0)} W`, sub: 'All Payloads Online', color: '#ff8c00' },
                { label: 'CPU TEMPERATURE', value: `${cpuTempVal.toFixed(1)} °C`, sub: 'Max Threshold: 85°C', color: cpuTempVal > 65 ? '#ff2d55' : '#00d4ff' },
                { label: 'BATTERY PACK TEMP', value: `${batteryTempVal.toFixed(1)} °C`, sub: 'Thermal Loop Nominal', color: '#00d4ff' },
              ].map(({ label, value, sub, color }) => (
                <div key={label} style={{ padding: '12px 14px', background: 'rgba(5,12,25,0.92)', border: `1px solid ${color}33`, borderRadius: 8 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)', marginBottom: 4, letterSpacing: '0.1em' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color }}>{value}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>{sub}</div>
                </div>
              ))}
            </div>

            {/* ── 2 Main Interactive Telemetry Charts (Accurate Multi-Stream Visualization) ── */}
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
              
              {/* 1. BATTERY & POWER PROFILE GRAPH */}
              <div style={{
                padding: '18px', background: 'rgba(5,12,25,0.95)',
                border: '1px solid rgba(0,212,255,0.2)', borderRadius: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00d4ff', letterSpacing: '0.12em', fontWeight: 700 }}>
                      ⚡ BATTERY &amp; POWER PROFILE (REAL-TIME TELEMETRY)
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      Battery SoC (%) vs. Solar Generation (W) &amp; Bus Draw (W)
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#00d4ff', fontWeight: 700 }}>
                    {batteryVal.toFixed(1)}% SoC
                  </span>
                </div>

                <div style={{ width: '100%', height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={powerData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="powBatGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.35} />
                          <stop offset="95%" stopColor="#00d4ff" stopOpacity={0.0} />
                        </linearGradient>
                        <linearGradient id="powSolGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor="#00ff88" stopOpacity={0.25} />
                          <stop offset="95%" stopColor="#00ff88" stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }} />
                      <YAxis yAxisId="percentAxis" domain={[0, 100]} stroke="rgba(0,212,255,0.5)" tick={{ fontSize: 8, fill: '#00d4ff', fontFamily: 'monospace' }} unit="%" />
                      <YAxis yAxisId="wattsAxis" orientation="right" domain={[0, 400]} stroke="rgba(0,255,136,0.5)" tick={{ fontSize: 8, fill: '#00ff88', fontFamily: 'monospace' }} unit="W" />
                      <Tooltip
                        contentStyle={{ background: '#050f1e', border: '1px solid #00d4ff', fontFamily: 'monospace', fontSize: 9 }}
                        formatter={(value: any, name: any) => {
                          if (name === 'batteryPercent') return [`${value}%`, 'Battery SoC'];
                          if (name === 'solarWatts') return [`${value} W`, 'Solar Generation'];
                          if (name === 'consumptionWatts') return [`${value} W`, 'Power Draw'];
                          return [value, name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 8.5, fontFamily: 'monospace', paddingTop: 8 }} />
                      <Area yAxisId="percentAxis" name="Battery SoC (%)" type="monotone" dataKey="batteryPercent" stroke="#00d4ff" strokeWidth={2} fill="url(#powBatGrad)" dot={false} isAnimationActive={false} />
                      <Area yAxisId="wattsAxis" name="Solar Gen (W)" type="monotone" dataKey="solarWatts" stroke="#00ff88" strokeWidth={1.5} fill="url(#powSolGrad)" dot={false} isAnimationActive={false} />
                      <Line yAxisId="wattsAxis" name="Power Draw (W)" type="monotone" dataKey="consumptionWatts" stroke="#ff8c00" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="3 3" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>

              {/* 2. SPACECRAFT INTEGRITY PROFILE GRAPH */}
              <div style={{
                padding: '18px', background: 'rgba(5,12,25,0.95)',
                border: '1px solid rgba(0,255,136,0.2)', borderRadius: 10,
                boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
              }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00ff88', letterSpacing: '0.12em', fontWeight: 700 }}>
                      🛡 SPACECRAFT INTEGRITY &amp; HEALTH PROFILE
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                      Overall Health Integrity (%) vs. Thermal Stability Curve
                    </div>
                  </div>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: healthColor, fontWeight: 700 }}>
                    {healthVal.toFixed(1)}% OVERALL
                  </span>
                </div>

                <div style={{ width: '100%', height: 210 }}>
                  <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={healthData} margin={{ top: 10, right: 10, left: -20, bottom: 0 }}>
                      <defs>
                        <linearGradient id="hlthGrad" x1="0" y1="0" x2="0" y2="1">
                          <stop offset="5%" stopColor={healthColor} stopOpacity={0.4} />
                          <stop offset="95%" stopColor={healthColor} stopOpacity={0.0} />
                        </linearGradient>
                      </defs>
                      <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                      <XAxis dataKey="timeLabel" stroke="rgba(255,255,255,0.25)" tick={{ fontSize: 8, fill: 'rgba(255,255,255,0.4)', fontFamily: 'monospace' }} />
                      <YAxis yAxisId="hlthAxis" domain={[0, 100]} stroke="rgba(0,255,136,0.5)" tick={{ fontSize: 8, fill: '#00ff88', fontFamily: 'monospace' }} unit="%" />
                      <YAxis yAxisId="tempAxis" orientation="right" domain={[0, 100]} stroke="rgba(255,140,0,0.5)" tick={{ fontSize: 8, fill: '#ff8c00', fontFamily: 'monospace' }} unit="°C" />
                      <Tooltip
                        contentStyle={{ background: '#050f1e', border: `1px solid ${healthColor}`, fontFamily: 'monospace', fontSize: 9 }}
                        formatter={(value: any, name: any) => {
                          if (name === 'healthPercent') return [`${value}%`, 'Health Integrity'];
                          if (name === 'cpuTempC') return [`${value} °C`, 'CPU Junction Temp'];
                          if (name === 'batteryTempC') return [`${value} °C`, 'Battery Pack Temp'];
                          return [value, name];
                        }}
                      />
                      <Legend wrapperStyle={{ fontSize: 8.5, fontFamily: 'monospace', paddingTop: 8 }} />
                      <Area yAxisId="hlthAxis" name="Health Integrity (%)" type="monotone" dataKey="healthPercent" stroke={healthColor} strokeWidth={2} fill="url(#hlthGrad)" dot={false} isAnimationActive={false} />
                      <Line yAxisId="tempAxis" name="CPU Temp (°C)" type="monotone" dataKey="cpuTempC" stroke="#00d4ff" strokeWidth={1.5} dot={false} isAnimationActive={false} />
                      <Line yAxisId="tempAxis" name="Battery Temp (°C)" type="monotone" dataKey="batteryTempC" stroke="#ff8c00" strokeWidth={1.5} dot={false} isAnimationActive={false} strokeDasharray="2 2" />
                    </AreaChart>
                  </ResponsiveContainer>
                </div>
              </div>
            </div>

            {/* Subsystem Integrity Matrix */}
            <div style={{ padding: '18px', background: 'rgba(5,12,25,0.92)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 10, marginBottom: 20 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.8)', letterSpacing: '0.15em', marginBottom: 12 }}>
                ⚙ 8-SUBSYSTEM HEALTH INTEGRITY BREAKDOWN
              </div>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 10 }}>
                {[
                  { name: 'Electrical Power System (EPS)', health: batteryVal > 20 ? 100 : 45, metric: `${solarVal.toFixed(0)}W / ${batteryVal.toFixed(1)}% SoC`, status: 'NOMINAL' },
                  { name: 'Thermal Control System (TCS)', health: cpuTempVal < 75 ? 100 : 60, metric: `CPU: ${cpuTempVal.toFixed(1)}°C · Rad: 24.5°C`, status: 'NOMINAL' },
                  { name: 'Attitude Determination (ADCS)', health: 100, metric: `${(telemetry?.attitude?.reactionWheelRpm ?? 3240).toFixed(0)} RPM · 3-Axis Locked`, status: 'NOMINAL' },
                  { name: 'RF Telemetry & Comms (TT&C)', health: (telemetry?.comm?.signalDbm ?? -72) > -100 ? 100 : 50, metric: `${(telemetry?.comm?.signalDbm ?? -72).toFixed(0)} dBm · 8.4 Mbps`, status: 'NOMINAL' },
                  { name: 'On-Board Computer (OBC)', health: (telemetry?.compute?.cpuPercent ?? 32) < 85 ? 100 : 65, metric: `CPU Load: ${(telemetry?.compute?.cpuPercent ?? 32).toFixed(0)}%`, status: 'NOMINAL' },
                  { name: 'Propulsion & RCS Thrusters', health: 100, metric: 'Hydrazine Tank: 100% (Nominal)', status: 'NOMINAL' },
                  { name: 'Payload Scientific Instruments', health: 100, metric: 'Multi-Spectral Imager Online', status: 'NOMINAL' },
                  { name: 'Life Support / ECLSS Envelopes', health: 100, metric: 'Cabin PO2: 21.3 kPa (Safe)', status: 'NOMINAL' },
                ].map((sub) => (
                  <div key={sub.name} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', borderRadius: 6, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                      <span style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: '#fff', fontWeight: 700 }}>{sub.name}</span>
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: sub.health > 75 ? '#00ff88' : '#ff8c00', fontWeight: 700 }}>{sub.health}%</span>
                    </div>
                    <div style={{ width: '100%', height: 4, background: 'rgba(255,255,255,0.08)', borderRadius: 2, marginBottom: 6 }}>
                      <div style={{ width: `${sub.health}%`, height: '100%', background: sub.health > 75 ? '#00ff88' : '#ff8c00', borderRadius: 2 }} />
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.45)' }}>{sub.metric}</div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB 2: EXECUTIVE SUMMARY ── */}
        {activeTab === 'summary' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            {/* Executive Profile Summary */}
            <div style={{
              padding: '22px', background: 'rgba(5,12,25,0.92)',
              border: '1px solid rgba(0,212,255,0.15)', borderRadius: 10, marginBottom: 20,
            }}>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 14 }}>
                {[
                  { label: 'MISSION NAME', value: config?.name ?? 'VYOM-01' },
                  { label: 'CLASSIFICATION', value: (config?.type ?? 'ORBITAL').toUpperCase() },
                  { label: 'DESTINATION', value: (config?.destination ?? 'earth-orbit').toUpperCase().replace('-', ' ') },
                  { label: 'BUDGET ALLOCATED', value: `₹${config?.budgetCrore ?? 250} Cr` },
                  { label: 'LAUNCH COMPLEX', value: config?.launchSite?.name?.split(' ')[0] ?? 'Sriharikota' },
                  { label: 'MISSION ELAPSED', value: `DAY ${missionDay.toFixed(2)}` },
                  { label: 'OBJECTIVE PROGRESS', value: `${Math.round(objectiveProgress)}%` },
                  { label: 'HEALTH INTEGRITY', value: `${healthVal.toFixed(1)}%`, color: healthColor },
                ].map(({ label, value, color }) => (
                  <div key={label} style={{ background: 'rgba(0,0,0,0.25)', padding: '10px 12px', borderRadius: 6, border: '1px solid rgba(255,255,255,0.05)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 4, letterSpacing: '0.1em' }}>{label}</div>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: color || '#00d4ff' }}>{value}</div>
                  </div>
                ))}
              </div>

              <div style={{ marginTop: 14, paddingTop: 12, borderTop: '1px solid rgba(255,255,255,0.06)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em', marginBottom: 4 }}>PRIMARY MISSION OBJECTIVE</div>
                <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                  {config?.objective ?? 'High-resolution atmospheric telemetry & planetary multi-spectral observation.'}
                </div>
              </div>
            </div>

            {/* Astronaut Crew Biometrics (ONLY FOR HUMAN MISSIONS) */}
            {isHumanMission && crew && crew.length > 0 && (
              <div style={{
                padding: '18px 22px', background: 'rgba(0,255,136,0.04)',
                border: '1px solid rgba(0,255,136,0.2)', borderRadius: 10, marginBottom: 20,
              }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00ff88', letterSpacing: '0.15em', marginBottom: 12 }}>
                  👨‍🚀 ASTRONAUT CREW BIOMEDICAL DOSSIER
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(230px, 1fr))', gap: 12 }}>
                  {crew.map((c) => (
                    <div key={c.id} style={{ padding: '12px', background: 'rgba(0,0,0,0.35)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.07)' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#fff' }}>{c.name}</div>
                        <span style={{
                          padding: '2px 6px', borderRadius: 3,
                          background: 'rgba(0,255,136,0.15)', border: '1px solid rgba(0,255,136,0.3)',
                          fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88',
                        }}>
                          {(c.status ?? 'NOMINAL').toUpperCase()}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00ff88', marginBottom: 8 }}>{c.role}</div>
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6, fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.55)' }}>
                        <div>HR: <span style={{ color: '#fff' }}>{c.heartRateBpm} BPM</span></div>
                        <div>SpO2: <span style={{ color: '#fff' }}>{c.spo2Percent}%</span></div>
                        <div>RAD: <span style={{ color: '#fff' }}>{c.radiationDoseMsv} mSv</span></div>
                        <div>ACTIVITY: <span style={{ color: '#00d4ff' }}>{c.activity}</span></div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </motion.div>
        )}

        {/* ── TAB 3: INCIDENTS & RECOVERY ── */}
        {activeTab === 'incidents' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ padding: '18px', background: 'rgba(5,12,25,0.92)', border: '1px solid rgba(155,93,229,0.2)', borderRadius: 10, marginBottom: 20 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9b5de5', letterSpacing: '0.15em', fontWeight: 700 }}>
                  ⚡ ANOMALY INCIDENTS &amp; AI RESOLUTION AUDIT LOG
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)' }}>
                  {incidents.length} TOTAL INCIDENTS
                </div>
              </div>

              {incidents.length === 0 ? (
                <div style={{ padding: '24px', textAlign: 'center', color: 'rgba(255,255,255,0.4)', fontFamily: 'monospace', fontSize: 10 }}>
                  🛡️ No anomalies detected. Spacecraft telemetry operating 100% within flight boundaries.
                </div>
              ) : (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                  {incidents.map((inc) => (
                    <div key={inc.id} style={{ padding: '10px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 6, display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8 }}>
                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fff', fontWeight: 700 }}>{inc.id}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, padding: '1px 5px', borderRadius: 3, background: 'rgba(0,255,136,0.15)', color: '#00ff88', fontWeight: 700 }}>{inc.status.toUpperCase()}</span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)' }}>DAY {inc.mission_day}</span>
                        </div>
                        <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.7)', marginTop: 2 }}>{inc.description}</div>
                      </div>
                      <div style={{ display: 'flex', gap: 14, fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.5)' }}>
                        <span>AI TIME: <strong style={{ color: '#00d4ff' }}>{inc.ai_processing_time_s ? `${inc.ai_processing_time_s.toFixed(1)}s` : '5.0s'}</strong></span>
                        <span>VIRTUAL: <strong style={{ color: '#00ff88' }}>{inc.virtual_recovery_time_str ?? '2h 35m'}</strong></span>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Black Box Event Excerpt */}
            <div style={{ padding: '16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.1em', marginBottom: 12 }}>
                ▣ RECENT BLACK BOX IMMUTABLE EVENTS
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 200, overflowY: 'auto' }}>
                {(blackBox.length > 0 ? blackBox.slice(-8).reverse() : [
                  { id: '1', missionDay: 0, severity: 'nominal', eventType: 'milestone', description: 'Mission launched successfully.' },
                  { id: '2', missionDay: 1, severity: 'nominal', eventType: 'telemetry', description: 'Subsystem telemetry baseline nominal.' },
                ]).map((ev, i) => (
                  <div key={`${ev.id || 'bb'}-${i}`} style={{
                    padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4,
                    borderLeft: `2px solid ${ev.severity === 'critical' ? 'var(--critical)' : ev.severity === 'warning' ? 'var(--warning)' : 'var(--nominal)'}`,
                  }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(0,212,255,0.6)', marginBottom: 2 }}>
                      <span>DAY {Number(ev.missionDay || 0).toFixed(1)} · [{ev.eventType?.toUpperCase()}]</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.8)' }}>
                      {ev.description}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB: BLACK BOX IMMUTABLE LOG ── */}
        {activeTab === 'blackbox' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ padding: '18px', background: 'rgba(5,12,25,0.95)', border: '1px solid rgba(0,212,255,0.2)', borderRadius: 10 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00d4ff', letterSpacing: '0.15em', fontWeight: 700 }}>
                    📼 MISSION BLACK BOX — {blackBox.length} IMMUTABLE LOGGED EVENTS
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                    Sequential chronologically-indexed telemetry anomalies, commands, milestones, and AI actions
                  </div>
                </div>
                <button
                  onClick={handleExportJSON}
                  style={{
                    padding: '6px 12px', background: 'rgba(0,212,255,0.15)', border: '1px solid #00d4ff',
                    borderRadius: 4, color: '#00d4ff', fontFamily: 'var(--font-mono)', fontSize: 8.5, fontWeight: 700,
                    cursor: 'pointer',
                  }}
                >
                  EXPORT AUDIT JSON
                </button>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 420, overflowY: 'auto' }}>
                {(blackBox.length > 0 ? blackBox.slice().reverse() : [
                  { id: '1', timestamp: Date.now(), missionDay: 0, severity: 'nominal', eventType: 'milestone', description: 'Mission launched from Satish Dhawan Space Centre (SLP).' },
                  { id: '2', timestamp: Date.now(), missionDay: 0.1, severity: 'nominal', eventType: 'telemetry', description: 'Initial orbit insertion telemetry verified nominal.' },
                ]).map((ev, idx) => {
                  const sevColor = ev.severity === 'critical' ? '#ff2d55' : ev.severity === 'warning' ? '#ff8c00' : '#00ff88';
                  return (
                    <div
                      key={`${ev.id || 'ev'}-${idx}`}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(0,0,0,0.35)',
                        borderLeft: `3px solid ${sevColor}`,
                        borderRadius: 4,
                        display: 'flex',
                        flexDirection: 'column',
                        gap: 3,
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>
                        <span style={{ color: '#00d4ff', fontWeight: 700 }}>
                          DAY {Number(ev.missionDay || 0).toFixed(2)} · [{String(ev.eventType || 'LOG').toUpperCase()}]
                        </span>
                        <span>{new Date(ev.timestamp).toLocaleTimeString()}</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-body)', fontSize: 11.5, color: '#ffffff', lineHeight: 1.4 }}>
                        {ev.description}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </motion.div>
        )}

        {/* ── TAB 4: FLIGHT MILESTONES ── */}
        {activeTab === 'milestones' && (
          <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ duration: 0.25 }}>
            <div style={{ padding: '18px', background: 'rgba(5,12,25,0.92)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00d4ff', letterSpacing: '0.15em', marginBottom: 12 }}>
                ★ MISSION MILESTONES ROADMAP
              </div>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {milestones.map((m) => (
                  <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '10px 12px', background: 'rgba(0,0,0,0.25)', borderRadius: 6 }}>
                    <span style={{ color: m.completed ? '#00ff88' : 'rgba(255,255,255,0.25)', fontSize: 14 }}>
                      {m.completed ? '✓' : '○'}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: m.completed ? '#fff' : 'rgba(255,255,255,0.4)', fontWeight: 700 }}>
                        {m.label}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.3)', marginTop: 2 }}>
                        {m.completed ? 'MILESTONE ACHIEVED · TELEMETRY NOMINAL' : 'PENDING TRAJECTORY SCHEDULE'}
                      </div>
                    </div>
                    {m.completed && (
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, padding: '2px 6px', borderRadius: 3, background: 'rgba(0,255,136,0.15)', color: '#00ff88' }}>
                        COMPLETED
                      </span>
                    )}
                  </div>
                ))}
              </div>
            </div>
          </motion.div>
        )}

      </div>
    </div>
  );
}
