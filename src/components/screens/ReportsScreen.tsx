import { useState, useMemo } from 'react';
import { AreaChart, Area, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { useMissionStore } from '../../store/missionStore';
import jsPDF from 'jspdf';

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
  addText('OFFICIAL MISSION DOSSIER & FLIGHT REPORT', 14, 25, { size: 9.5, color: [0, 212, 255] });
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

  // 02: Astronaut Crew (if human mission)
  if (config?.type === 'human' && crew && crew.length > 0) {
    doc.line(14, y - 3, 196, y - 3);
    addText('02 · ASTRONAUT CREW COMPLEMENT & BIOMETRICS', 14, y + 3, { size: 10.5, style: 'bold', color: [0, 255, 136] });
    y += 10;

    crew.forEach((c: any) => {
      addText(`• ${c.name ?? 'Crew Member'} [${c.role ?? 'Astronaut'}]`, 16, y, { size: 8, color: [240, 240, 255], style: 'bold' });
      addText(`HR: ${c.heartRateBpm ?? 72} BPM | SpO2: ${c.spo2Percent ?? 99}% | Rad: ${c.radiationDoseMsv ?? 0.12} mSv | Status: ${(c.status ?? 'NOMINAL').toUpperCase()}`, 88, y, { size: 7, color: [140, 200, 220] });
      y += 5;
    });

    y += 3;
  }

  // 03: Spacecraft Health & Performance
  doc.line(14, y - 3, 196, y - 3);
  addText(config?.type === 'human' ? '03 · SPACECRAFT HEALTH & PERFORMANCE' : '02 · SPACECRAFT HEALTH & PERFORMANCE', 14, y + 3, { size: 10.5, style: 'bold', color: [0, 212, 255] });
  y += 10;

  const maxH = typeof stats?.maxHealth === 'number' ? stats.maxHealth.toFixed(0) : '100';
  const minH = typeof stats?.minHealth === 'number' ? stats.minHealth.toFixed(0) : '95';
  const threats = String(stats?.threatsEncountered ?? 0);
  const aiOps = String(stats?.aiInterventions ?? 0);
  const distance = typeof stats?.totalDistanceKm === 'number' ? `${(stats.totalDistanceKm / 1000).toFixed(0)} thousand km` : '384.4 thousand km';

  const healthData = [
    ['Maximum Health Integrity', `${maxH}%`],
    ['Minimum Health Observed', `${minH}%`],
    ['Spaceflight Threats Mitigated', threats],
    ['Autonomous AI Interventions', aiOps],
    ['Simulated Trajectory Distance', distance],
    ['Overall Spacecraft Health', `${(telemetry?.overallHealth ?? 98.5).toFixed(1)}%`],
  ];

  healthData.forEach(([label, value]) => {
    addText(label + ':', 16, y, { size: 8, color: [100, 160, 200] });
    addText(value, 90, y, { size: 8, color: [220, 230, 240] });
    y += 5.2;
  });

  y += 3;

  // 04: Black Box Excerpt
  doc.line(14, y - 3, 196, y - 3);
  addText(config?.type === 'human' ? '04 · MISSION BLACK BOX CHRONICLE EXCERPT' : '03 · MISSION BLACK BOX CHRONICLE EXCERPT', 14, y + 3, { size: 10.5, style: 'bold', color: [0, 212, 255] });
  y += 10;

  const safeEvents = Array.isArray(blackBox) && blackBox.length > 0 ? blackBox.slice(-7).reverse() : [
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
  const threatHistory = useMissionStore((s) => s.threatHistory);
  const missionDay = useMissionStore((s) => s.missionDay);
  const objectiveProgress = useMissionStore((s) => s.objectiveProgress);
  const milestones = useMissionStore((s) => s.milestones);
  const environment = useMissionStore((s) => s.environment);
  const aiAnalysis = useMissionStore((s) => s.aiAnalysis);
  const dailySummaries = useMissionStore((s) => s.dailySummaries);

  const [generating, setGenerating] = useState(false);
  const [copied, setCopied] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const isHumanMission = config?.type === 'human';

  // Build telemetry chart datasets with fallback points if history is small
  const powerData = useMemo(() => {
    if (telemetryHistory && telemetryHistory.length > 5) {
      return telemetryHistory.slice(-60).map((t, i) => ({
        i,
        battery: t.power?.batteryPercent ?? 96,
        solar: t.power?.solarGenerationW ?? 260,
      }));
    }
    return Array.from({ length: 20 }, (_, i) => ({
      i,
      battery: 95 + Math.sin(i * 0.3) * 3,
      solar: 240 + Math.cos(i * 0.4) * 20,
    }));
  }, [telemetryHistory]);

  const healthData = useMemo(() => {
    if (telemetryHistory && telemetryHistory.length > 5) {
      return telemetryHistory.slice(-60).map((t, i) => ({
        i,
        health: t.overallHealth ?? 98.5,
      }));
    }
    return Array.from({ length: 20 }, (_, i) => ({
      i,
      health: 98 + Math.sin(i * 0.2) * 1.5,
    }));
  }, [telemetryHistory]);

  // Dual-mode PDF Generator (Backend API first, client jsPDF fallback)
  const handleExportPDF = async () => {
    setGenerating(true);
    setStatusMsg('Generating Mission PDF Dossier…');

    try {
      const missionId = config?.id;
      let downloaded = false;

      if (missionId) {
        try {
          // Attempt backend PDF download
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
          // Backend was not reached, will proceed to client generation
        }
      }

      if (!downloaded) {
        // Safe client-side jsPDF generation
        generateClientPDF(config, stats, blackBox, crew, telemetry);
      }

      setStatusMsg('✓ PDF Report Exported Successfully!');
      setTimeout(() => setStatusMsg(null), 3000);
    } catch (err) {
      console.error('PDF Generation Error:', err);
      // Emergency fallback
      generateClientPDF(config, stats, blackBox, crew, telemetry);
      setStatusMsg('✓ PDF Report Exported!');
      setTimeout(() => setStatusMsg(null), 3000);
    } finally {
      setGenerating(false);
    }
  };

  // Export complete JSON dataset
  const handleExportJSON = () => {
    const data = {
      mission: config,
      stats,
      telemetry,
      environment,
      aiAnalysis,
      milestones,
      blackBox,
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
VYOM AEROSPACE MISSION REPORT
========================================
Mission Name: ${config?.name ?? 'VYOM-01'}
Classification: ${(config?.type ?? 'ORBITAL').toUpperCase()}
Destination: ${(config?.destination ?? 'earth-orbit').toUpperCase()}
Mission Day: ${missionDay.toFixed(2)} Days
Objective Progress: ${Math.round(objectiveProgress)}%
Overall Spacecraft Health: ${(telemetry?.overallHealth ?? 98.5).toFixed(1)}%

FLIGHT METRICS:
- Threats Mitigated: ${stats?.threatsEncountered ?? 0}
- AI Autonomous Operations: ${stats?.aiInterventions ?? 0}
- Battery Level: ${(telemetry?.power?.batteryPercent ?? 96.4).toFixed(1)}%
- Solar Generation: ${(telemetry?.power?.solarGenerationW ?? 260).toFixed(0)} W
- Power Draw: ${(telemetry?.power?.consumptionW ?? 120).toFixed(0)} W
- CPU Temperature: ${(telemetry?.thermal?.cpuTempC ?? 41.8).toFixed(1)}°C
- Altitude: ${(telemetry?.orbit?.altitudeKm ?? 650).toFixed(1)} km
- Velocity: ${(telemetry?.orbit?.velocityKms ?? 7.66).toFixed(2)} km/s

ENVIRONMENT:
- Solar Activity Index: ${environment?.solarActivityLevel?.toFixed(1) ?? '2.4'}/10
- Radiation: ${environment?.radiationLevel?.toFixed(0) ?? '14'} μSv/h
- Environment Class: ${(environment?.classification ?? 'NORMAL').toUpperCase()}

Report generated by VYOM Digital Twin Platform.
========================================
`.trim();

    navigator.clipboard.writeText(summary);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const healthVal = telemetry?.overallHealth ?? 98.5;
  const healthColor = healthVal > 80 ? 'var(--nominal)' : healthVal > 50 ? 'var(--warning)' : 'var(--critical)';

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#020409', paddingBottom: 80, padding: '28px',
    }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header Bar */}
        <div style={{
          display: 'flex', alignItems: 'center', justifyContent: 'space-between',
          marginBottom: 24, flexWrap: 'wrap', gap: 16,
          borderBottom: '1px solid rgba(0,212,255,0.12)', paddingBottom: 16,
        }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.2em', marginBottom: 4 }}>
              MISSION REPORTING &amp; TELEMETRY DOSSIER · {(config?.type ?? 'ORBITAL').toUpperCase()}
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#fff', margin: 0 }}>
              {config?.name ?? 'VYOM-01'} EXECUTIVE REPORT
            </h1>
          </div>

          {/* Action Buttons */}
          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            <button
              onClick={handleCopySummary}
              className="btn btn-sm"
              style={{ padding: '9px 14px', fontSize: 10, background: 'rgba(255,255,255,0.05)' }}
            >
              {copied ? '✓ COPIED SUMMARY' : '📋 COPY BRIEFING'}
            </button>
            <button
              onClick={handleExportJSON}
              className="btn btn-sm"
              style={{ padding: '9px 14px', fontSize: 10, background: 'rgba(0,212,255,0.1)', color: '#00d4ff', border: '1px solid rgba(0,212,255,0.3)' }}
            >
              💾 EXPORT JSON
            </button>
            <button
              onClick={handleExportPDF}
              disabled={generating}
              className="btn btn-primary"
              style={{ padding: '10px 22px', fontSize: 11, letterSpacing: '0.1em', boxShadow: '0 0 25px rgba(0,212,255,0.3)' }}
            >
              {generating ? 'GENERATING PDF…' : '📄 EXPORT PDF REPORT'}
            </button>
          </div>
        </div>

        {/* Status notification */}
        {statusMsg && (
          <div style={{
            padding: '8px 16px', marginBottom: 20,
            background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.35)',
            borderRadius: 6, fontFamily: 'var(--font-mono)', fontSize: 11, color: '#00d4ff',
          }}>
            {statusMsg}
          </div>
        )}

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

        {/* Telemetry Charts Grid */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Power & Solar Chart */}
          <div style={{ padding: '16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.1em' }}>⚡ BATTERY &amp; POWER PROFILE</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00d4ff' }}>{(telemetry?.power?.batteryPercent ?? 96.4).toFixed(1)}% CHARGED</span>
            </div>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={powerData}>
                  <defs>
                    <linearGradient id="rgPow" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00d4ff" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00d4ff" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="battery" stroke="#00d4ff" strokeWidth={1.5} fill="url(#rgPow)" dot={false} isAnimationActive={false} />
                  <Tooltip contentStyle={{ background: '#050f1e', border: '1px solid #00d4ff30', fontFamily: 'var(--font-mono)', fontSize: 9 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Health Trend Chart */}
          <div style={{ padding: '16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 10 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,255,136,0.7)', letterSpacing: '0.1em' }}>🛡 SPACECRAFT INTEGRITY PROFILE</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00ff88' }}>{healthVal.toFixed(1)}% OVERALL</span>
            </div>
            <div style={{ height: 120 }}>
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={healthData}>
                  <defs>
                    <linearGradient id="rgHlth" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#00ff88" stopOpacity={0.25} />
                      <stop offset="95%" stopColor="#00ff88" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <Area type="monotone" dataKey="health" stroke="#00ff88" strokeWidth={1.5} fill="url(#rgHlth)" dot={false} isAnimationActive={false} />
                  <Tooltip contentStyle={{ background: '#050f1e', border: '1px solid #00ff8830', fontFamily: 'var(--font-mono)', fontSize: 9 }} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        </div>

        {/* Subsystems & Environmental Overview */}
        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, marginBottom: 20 }}>
          {/* Subsystems Health Grid */}
          <div style={{ padding: '16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.1em', marginBottom: 12 }}>
              ⚙ SUBSYSTEM HEALTH &amp; INTEGRITY MATRIX
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 8 }}>
              {[
                { name: 'Power & Solar Bus', health: 100, temp: 18.2 },
                { name: 'Thermal Control / Radiators', health: 100, temp: 24.5 },
                { name: 'ADCS Reaction Wheels', health: 100, temp: 34.8 },
                { name: 'High-Gain Deep Comms', health: 100, temp: 28.0 },
                { name: 'On-Board Computer (OBC)', health: 100, temp: 41.8 },
                { name: 'Propulsion Thrusters', health: 100, temp: 15.0 },
                { name: 'Scientific Payload Array', health: 100, temp: 32.5 },
                { name: 'Life Support / Cabin ECLSS', health: 100, temp: 21.0 },
              ].map((sub) => (
                <div key={sub.name} style={{ padding: '8px 10px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 4 }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#fff' }}>{sub.name}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00ff88' }}>{sub.health}%</span>
                  </div>
                  <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.1)', borderRadius: 1.5 }}>
                    <div style={{ width: `${sub.health}%`, height: '100%', background: '#00ff88', borderRadius: 1.5 }} />
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Space Environment & Telemetry Parameters */}
          <div style={{ padding: '16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.1em', marginBottom: 12 }}>
              ◐ SPACE WEATHER &amp; ENVIRONMENT AUDIT
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                ['Solar Activity Level', `${environment?.solarActivityLevel?.toFixed(1) ?? '2.4'} / 10`],
                ['Radiation Level', `${environment?.radiationLevel?.toFixed(0) ?? '14'} μSv/h`],
                ['Magnetic Field', `${environment?.magneticFieldNT?.toFixed(0) ?? '31200'} nT`],
                ['Space Debris Density', `${environment?.debrisDensity?.toFixed(1) ?? '1.2'} / 10`],
                ['Environmental State', (environment?.classification ?? 'NORMAL').toUpperCase()],
                ['Threats Encountered', String(stats?.threatsEncountered ?? 0)],
                ['AI Interventions Executed', String(stats?.aiInterventions ?? 0)],
                ['Active Anomaly', aiAnalysis?.anomalyDetected ? aiAnalysis.anomalyDescription : 'None (Systems Nominal)'],
              ].map(([l, v]) => (
                <div key={l} style={{ display: 'flex', justifyContent: 'space-between', padding: '4px 0', borderBottom: '1px solid rgba(255,255,255,0.04)' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.45)' }}>{l}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00d4ff', fontWeight: 600 }}>{v}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Daily Summaries Intelligence */}
        {dailySummaries && dailySummaries.length > 0 && (
          <div style={{ padding: '16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 8, marginBottom: 20 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.1em', marginBottom: 12 }}>
              📅 DAILY INTELLIGENCE SUMMARIES
            </div>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 12 }}>
              {[...dailySummaries].reverse().slice(0, 3).map((ds) => (
                <div key={ds.mission_day} style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.05)', borderRadius: 6 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, color: '#fff', fontWeight: 700 }}>DAY {ds.mission_day}</span>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00d4ff' }}>{ds.environment_classification.toUpperCase()}</span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.6)', marginBottom: 8 }}>
                    {ds.incidents_count} Incidents • {ds.critical_events} Critical Events
                  </div>
                  <div style={{ display: 'flex', gap: 10, fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
                    <span>THREATS: {ds.incidents_count}</span>
                    <span>DISTANCE: {(ds.distance_traveled_km / 1000).toFixed(1)}k km</span>
                    <span>AVG HEALTH: {ds.health_avg.toFixed(1)}%</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Milestones and Black Box Excerpt */}
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1.2fr', gap: 16 }}>
          {/* Milestones List */}
          <div style={{ padding: '16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.1em', marginBottom: 12 }}>
              ★ MISSION MILESTONES ROADMAP
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {milestones.map((m) => (
                <div key={m.id} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span style={{ color: m.completed ? '#00ff88' : 'rgba(255,255,255,0.25)', fontSize: 11 }}>
                    {m.completed ? '✓' : '○'}
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: m.completed ? '#fff' : 'rgba(255,255,255,0.4)' }}>
                    {m.label}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Black Box Event Excerpt */}
          <div style={{ padding: '16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(0,212,255,0.1)', borderRadius: 8 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.1em', marginBottom: 12 }}>
              ▣ RECENT BLACK BOX IMMUTABLE EVENTS
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 180, overflowY: 'auto' }}>
              {(blackBox.length > 0 ? blackBox.slice(-6).reverse() : [
                { id: '1', missionDay: 0, severity: 'nominal', eventType: 'milestone', description: 'Mission launched successfully.' },
                { id: '2', missionDay: 1, severity: 'nominal', eventType: 'telemetry', description: 'Subsystem telemetry baseline nominal.' },
              ]).map((ev) => (
                <div key={ev.id} style={{
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
        </div>
      </div>
    </div>
  );
}

