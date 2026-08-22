/**
 * WhatIfComparison — Mission What-If / Scenario Comparison (additive).
 * Creates a baseline from the live simulation state and compares alternative
 * failure scenarios. All outcome metrics are computed by the backend
 * ScenarioEngine from the actual state snapshot — no hardcoded results.
 */
import { useState } from 'react';
import { BACKEND_API_URL, backendWS } from '../../services/BackendWebSocketService';
import { useMissionStore } from '../../store/missionStore';

const PRESETS = [
  { id: 'power-failure', label: 'POWER FAILURE', faults: [{ fault_type: 'battery_failure', severity: 7 }] },
  { id: 'propulsion-failure', label: 'PROPULSION FAILURE', faults: [{ fault_type: 'propulsion_anomaly', severity: 6 }] },
  { id: 'comm-blackout', label: 'COMM BLACKOUT', faults: [{ fault_type: 'telemetry_loss', severity: 6 }] },
  { id: 'software-failure', label: 'SOFTWARE/SENSOR FAILURE', faults: [{ fault_type: 'sensor_failure', severity: 6 }] },
  { id: 'environmental', label: 'ENVIRONMENTAL (SOLAR STORM)', faults: [{ fault_type: 'solar_storm', severity: 7 }] },
];

const METRIC_LABELS: Record<string, string> = {
  mission_success: 'MISSION SUCCESS',
  final_health: 'SPACECRAFT HEALTH',
  crew_safety: 'CREW SAFETY',
  trajectory_deviation: 'TRAJECTORY DEVIATION',
  resource_consumption: 'RESOURCE CONSUMPTION',
  recovery_time_estimate: 'RECOVERY TIME',
  risk_score: 'RISK',
};

export function WhatIfComparison() {
  const config = useMissionStore((s) => s.config);
  const connected = backendWS.isConnected;
  const [selected, setSelected] = useState<string[]>(['power-failure']);
  const [running, setRunning] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const toggle = (id: string) =>
    setSelected(prev => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);

  const run = async () => {
    if (!config?.id || selected.length === 0) return;
    setRunning(true);
    setError(null);
    try {
      const scenarios = PRESETS.filter(p => selected.includes(p.id))
        .map(p => ({ name: p.id, fault_injections: p.faults, duration_days: 10 }));
      const res = await fetch(`${BACKEND_API_URL}/api/missions/${config.id}/scenarios/compare`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(scenarios),
      });
      if (!res.ok) throw new Error(await res.text());
      setResult(await res.json());
    } catch (e) {
      setError(String(e));
    }
    setRunning(false);
  };

  if (!connected) return null;

  const comparison = result?.comparison;
  const metrics = comparison?.metrics ?? [];
  const baseline = comparison?.baseline ?? {};
  const scenarioResults: any[] = result?.scenarios ?? [];

  return (
    <div style={{ marginTop: 20, padding: '16px', background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(155,93,229,0.3)', borderRadius: 8 }}>
      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9b5de5', letterSpacing: '0.1em', marginBottom: 10 }}>
        ⚖ MISSION WHAT-IF / SCENARIO COMPARISON (BACKEND SIMULATION)
      </div>

      {/* Preset selector */}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 10 }}>
        {PRESETS.map(p => (
          <button
            key={p.id}
            onClick={() => toggle(p.id)}
            style={{
              padding: '5px 9px', cursor: 'pointer', borderRadius: 4,
              background: selected.includes(p.id) ? 'rgba(155,93,229,0.22)' : 'rgba(0,0,0,0.3)',
              border: `1px solid ${selected.includes(p.id) ? '#9b5de5' : 'rgba(255,255,255,0.1)'}`,
              color: selected.includes(p.id) ? '#c99cff' : 'rgba(255,255,255,0.45)',
              fontFamily: 'var(--font-mono)', fontSize: 8,
            }}
          >
            {p.label}
          </button>
        ))}
      </div>

      <button
        onClick={run}
        disabled={running || selected.length === 0}
        style={{
          width: '100%', padding: '9px', cursor: running || selected.length === 0 ? 'wait' : 'pointer',
          background: 'rgba(155,93,229,0.18)', border: '1px solid #9b5de5', borderRadius: 6,
          color: '#c99cff', fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700,
        }}
      >
        {running ? 'SIMULATING SCENARIOS…' : `▶ RUN COMPARISON (${selected.length} SCENARIO${selected.length === 1 ? '' : 'S'})`}
      </button>

      {error && (
        <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#ff2d55' }}>
          {error}
        </div>
      )}

      {/* Comparison table */}
      {comparison && (
        <div style={{ marginTop: 12, overflowX: 'auto' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)' }}>
            <thead>
              <tr>
                <th style={thStyle}>METRIC</th>
                <th style={thStyle}>BASELINE</th>
                {scenarioResults.map(s => (
                  <th key={s.scenario_id} style={thStyle}>
                    {(s.name ?? s.scenario_id).replace(/-/g, ' ').toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {metrics.map((m: string) => (
                <tr key={m}>
                  <td style={tdStyle}>{METRIC_LABELS[m] ?? m}</td>
                  <td style={tdStyle}>{formatMetric(m, baseline[m])}</td>
                  {scenarioResults.map(s => {
                    const r = s.result ?? s;
                    const status = r.status?.[m];
                    const col = status === 'better' ? '#00ff88' : status === 'worse' ? '#ff2d55' : 'rgba(255,255,255,0.6)';
                    return (
                      <td key={s.scenario_id} style={{ ...tdStyle, color: col }}>
                        {formatMetric(m, r[m])}
                        {status && status !== 'same' ? ` ${status === 'better' ? '▲' : '▼'}` : ''}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

const thStyle: React.CSSProperties = {
  textAlign: 'left', padding: '5px 8px', fontSize: 7.5,
  color: '#9b5de5', borderBottom: '1px solid rgba(155,93,229,0.25)',
  letterSpacing: '0.08em',
};

const tdStyle: React.CSSProperties = {
  padding: '5px 8px', fontSize: 9, color: 'rgba(255,255,255,0.75)',
  borderBottom: '1px solid rgba(255,255,255,0.04)',
};

function formatMetric(metric: string, value: any): string {
  if (typeof value === 'boolean') return value ? 'YES' : 'NO';
  if (value == null) return '—';
  if (metric === 'final_health' || metric === 'resource_consumption' || metric === 'risk_score')
    return `${Number(value).toFixed(1)}%`;
  if (metric === 'trajectory_deviation') return `${Number(value).toFixed(1)} km`;
  if (metric === 'recovery_time_estimate') return `${Number(value).toFixed(1)} d est.`;
  return String(value);
}
