/**
 * MissionRiskPanel — Operational Decision Support (additive component).
 * Displays mission risk calculated by the backend from identifiable factors:
 * spacecraft health, active faults, power, comms, thermal, environment,
 * RUL, objectives, propulsion and crew status. Shows score, category
 * (LOW/MODERATE/HIGH/CRITICAL), per-factor contributions with weights,
 * confidence/uncertainty, trend and an explanation of why risk changed.
 */
import { useEffect, useRef, useState } from 'react';
import { BACKEND_API_URL, backendWS } from '../../services/BackendWebSocketService';
import { useMissionStore } from '../../store/missionStore';

const CATEGORY_COLORS: Record<string, string> = {
  LOW: '#00ff88',
  MODERATE: '#ffd60a',
  HIGH: '#ff8c00',
  CRITICAL: '#ff2d55',
};

interface RiskFactor {
  name: string;
  score: number;
  weight: number;
  trend?: string;
}

interface RiskData {
  risk_score: number;
  risk_category: string;
  contributing_factors: RiskFactor[];
  confidence: number;
  trend: string;
  explanation?: string;
}

export function MissionRiskPanel() {
  const config = useMissionStore((s) => s.config);
  const connected = backendWS.isConnected;
  const [risk, setRisk] = useState<RiskData | null>(null);
  const [history, setHistory] = useState<{ day: number; score: number }[]>([]);
  const [collapsed, setCollapsed] = useState(false);
  const prevScore = useRef<number | null>(null);

  useEffect(() => {
    if (!connected || !config?.id) return;
    let cancelled = false;
    const load = () => {
      fetch(`${BACKEND_API_URL}/api/missions/${config.id}/risk`)
        .then(r => (r.ok ? r.json() : null))
        .then(d => { if (!cancelled && d) setRisk(d); })
        .catch(() => {});
      fetch(`${BACKEND_API_URL}/api/missions/${config.id}/risk/history?limit=50`)
        .then(r => (r.ok ? r.json() : []))
        .then(h => { if (!cancelled) setHistory(h); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 10000);
    return () => { cancelled = true; clearInterval(t); };
  }, [connected, config?.id]);

  if (!connected || !risk) return null;

  const col = CATEGORY_COLORS[risk.risk_category] ?? '#00d4ff';
  const delta =
    prevScore.current != null ? risk.risk_score - prevScore.current : null;

  // Explain the change from dominant factors
  const dominant = [...(risk.contributing_factors ?? [])]
    .sort((a, b) => b.score * b.weight - a.score * a.weight)
    .slice(0, 3)
    .filter(f => f.score > 5);

  // Sparkline of recent history
  const sparkPts = history.slice(-40).map((h, i, arr) => {
    const x = arr.length > 1 ? (i / (arr.length - 1)) * 100 : 50;
    const y = 30 - (Math.max(0, Math.min(100, h.score)) / 100) * 28;
    return `${x},${y}`;
  }).join(' ');

  return (
    <div style={{
      padding: '16px', background: 'rgba(5,12,25,0.92)',
      border: `1px solid ${col}55`, borderRadius: 10,
    }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em', color: 'rgba(255,255,255,0.6)' }}>
          MISSION RISK · OPERATIONAL DECISION SUPPORT
        </span>
        <span style={{
          fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 800, padding: '3px 9px',
          borderRadius: 4, background: `${col}18`, border: `1px solid ${col}`, color: col,
        }}>
          {risk.risk_category}
        </span>
      </div>

      {!collapsed && (
        <>
          {/* Score + trend */}
          <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginTop: 12 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 34, fontWeight: 900, color: col }}>
              {risk.risk_score.toFixed(1)}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>/ 100</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: risk.trend === 'degrading' ? '#ff8c00' : risk.trend === 'improving' ? '#00ff88' : 'rgba(255,255,255,0.45)' }}>
              {risk.trend === 'degrading' ? '▲ DEGRADING' : risk.trend === 'improving' ? '▼ IMPROVING' : '■ STABLE'}
              {delta != null && Math.abs(delta) > 0.5 && ` (${delta > 0 ? '+' : ''}${delta.toFixed(1)})`}
            </span>
            <span style={{ marginLeft: 'auto', fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
              CONFIDENCE ±{((1 - risk.confidence) * 100).toFixed(0)}%
            </span>
          </div>

          {/* Explanation */}
          <div style={{ marginTop: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.5)', lineHeight: 1.5 }}>
            {risk.explanation || 'Composite of identifiable factors below.'}
            {dominant.length > 0 && (
              <> Dominant contributors: <strong style={{ color: col }}>
                {dominant.map(f => f.name.replace(/_/g, ' ')).join(', ')}
              </strong>.</>
            )}
          </div>

          {/* Factor breakdown */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 12 }}>
            {(risk.contributing_factors ?? []).map((f) => {
              const fCol = f.score >= 70 ? '#ff2d55' : f.score >= 40 ? '#ff8c00' : '#00ff88';
              return (
                <div key={f.name}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 8, marginBottom: 2 }}>
                    <span style={{ color: 'rgba(255,255,255,0.55)' }}>
                      {f.name.replace(/_/g, ' ').toUpperCase()} <span style={{ color: 'rgba(255,255,255,0.25)' }}>(w {(f.weight * 100).toFixed(0)}%)</span>
                    </span>
                    <span style={{ color: fCol }}>{f.score.toFixed(0)}</span>
                  </div>
                  <div style={{ height: 4, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                    <div style={{ height: '100%', width: `${Math.min(100, f.score)}%`, background: fCol, borderRadius: 2, transition: 'width 0.4s' }} />
                  </div>
                </div>
              );
            })}
          </div>

          {/* History sparkline */}
          {sparkPts && (
            <svg viewBox="0 0 100 32" preserveAspectRatio="none" style={{ width: '100%', height: 34, marginTop: 10, background: 'rgba(0,0,0,0.25)', borderRadius: 4 }}>
              <polyline points={sparkPts} fill="none" stroke={col} strokeWidth="1" opacity="0.8" />
            </svg>
          )}

          <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.25)' }}>
            Calculated by backend RiskEngine from live simulation state — not a generic AI percentage.
          </div>
        </>
      )}
    </div>
  );
}
