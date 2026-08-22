/**
 * OrbitalTrackingPanel — additive panel for the Trajectory tab.
 * Live orbital state (real TLE-propagated or clearly-labeled SIMULATED),
 * daily orbital-history replay, and planned-vs-actual trajectory deviation.
 * Does not modify any existing Trajectory tab behavior or layout.
 */
import { useEffect, useMemo, useState } from 'react';
import { BACKEND_API_URL, backendWS } from '../../services/BackendWebSocketService';
import { useMissionStore } from '../../store/missionStore';

interface OrbitalState {
  satellite?: string;
  norad_id?: string;
  latitude_deg: number;
  longitude_deg: number;
  altitude_km: number;
  velocity_kms: number;
  position_eci_km: number[];
  velocity_eci_kms: number[];
  timestamp: number;
  data_source: string;
  data_quality: string;
  reference_frame: string;
  provenance_note?: string;
  orbital_elements?: Record<string, number>;
}

interface DailyHistory {
  mission_day: number;
  point_count: number;
  ground_track: { lat: number; lng: number; alt?: number }[];
}

export function OrbitalTrackingPanel() {
  const config = useMissionStore((s) => s.config);
  const missionDay = useMissionStore((s) => s.missionDay);
  const missionId = config?.id;
  const connected = backendWS.isConnected;

  const [satellites, setSatellites] = useState<{ name: string; norad_id: string }[]>([]);
  const [selectedNoradId, setSelectedNoradId] = useState<string>('');
  const [state, setState] = useState<OrbitalState | null>(null);
  const [days, setDays] = useState<DailyHistory[]>([]);
  const [replayDay, setReplayDay] = useState<number | null>(null);
  const [replayPath, setReplayPath] = useState<DailyHistory | null>(null);
  const [deviation, setDeviation] = useState<Record<string, any> | null>(null);
  const [collapsed, setCollapsed] = useState(false);

  // Load selectable real satellites once
  useEffect(() => {
    if (!connected) return;
    fetch(`${BACKEND_API_URL}/api/orbital/satellites`)
      .then(r => r.json())
      .then(d => setSatellites(d.satellites ?? []))
      .catch(() => {});
  }, [connected]);

  // Poll current orbital state
  useEffect(() => {
    if (!connected || !missionId) return;
    let cancelled = false;
    const load = () => {
      const q = selectedNoradId ? `?norad_id=${selectedNoradId}` : '';
      fetch(`${BACKEND_API_URL}/api/orbital/state/${missionId}${q}`)
        .then(r => r.json())
        .then(d => { if (!cancelled) setState(d); })
        .catch(() => {});
    };
    load();
    const t = setInterval(load, 5000);
    return () => { cancelled = true; clearInterval(t); };
  }, [connected, missionId, selectedNoradId]);

  // Load recorded daily history
  useEffect(() => {
    if (!connected || !missionId) return;
    fetch(`${BACKEND_API_URL}/api/orbital/daily-history/${missionId}`)
      .then(r => r.json())
      .then(d => setDays(d.days ?? []))
      .catch(() => {});
  }, [connected, missionId, Math.floor(missionDay)]);

  // Fetch a specific day's path for replay
  useEffect(() => {
    if (replayDay == null || !missionId) { setReplayPath(null); return; }
    fetch(`${BACKEND_API_URL}/api/orbital/daily-history/${missionId}?day=${replayDay}`)
      .then(r => (r.ok ? r.json() : null))
      .then(setReplayPath)
      .catch(() => setReplayPath(null));
  }, [replayDay, missionId]);

  // Planned-vs-actual deviation
  useEffect(() => {
    if (!connected || !missionId) return;
    const t = setInterval(() => {
      fetch(`${BACKEND_API_URL}/api/missions/${missionId}/trajectory/deviation`)
        .then(r => (r.ok ? r.json() : null))
        .then(setDeviation)
        .catch(() => {});
    }, 10000);
    return () => clearInterval(t);
  }, [connected, missionId]);

  const isReal = state?.data_source === 'tle-propagated';
  const sourceBadgeColor = isReal ? '#00ff88' : '#ff8c00';
  const sourceLabel = isReal ? `TLE-PROPAGATED · ${state?.satellite ?? ''}` : 'SIMULATED (MISSION MODEL)';

  // SVG equirectangular ground-track plot for replay / live state
  const trackPoints = useMemo(() => {
    const pts = replayPath?.ground_track ?? [];
    return pts.map((p) => ({
      x: ((p.lng + 180) / 360) * 100,
      y: ((90 - p.lat) / 180) * 100,
    }));
  }, [replayPath]);

  if (!connected) return null;

  return (
    <div style={{
      position: 'absolute', bottom: 20, left: 20, zIndex: 10, width: 340,
      background: 'rgba(5,15,30,0.94)', border: '1px solid rgba(0,212,255,0.25)',
      borderRadius: 12, padding: collapsed ? '10px 16px' : '16px 18px',
      backdropFilter: 'blur(14px)', maxHeight: '52vh', overflowY: 'auto',
    }}>
      <div
        onClick={() => setCollapsed(!collapsed)}
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', cursor: 'pointer' }}
      >
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00d4ff', letterSpacing: '0.15em' }}>
          ORBITAL DATA TRACKING &amp; DAILY REPLAY
        </span>
        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)' }}>
          {collapsed ? '▾' : '▴'}
        </span>
      </div>

      {!collapsed && (
        <>
          {/* Data source selector */}
          <div style={{ marginTop: 10 }}>
            <select
              value={selectedNoradId}
              onChange={(e) => setSelectedNoradId(e.target.value)}
              style={{
                width: '100%', padding: '6px 8px', background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(0,212,255,0.3)', borderRadius: 5,
                color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 9, outline: 'none',
              }}
            >
              <option value="">MISSION SIMULATION (simulated)</option>
              {satellites.map((s) => (
                <option key={s.norad_id} value={s.norad_id}>
                  {s.name} — REAL TLE (NORAD {s.norad_id})
                </option>
              ))}
            </select>
          </div>

          {/* Provenance badge */}
          {state && (
            <div style={{
              marginTop: 8, padding: '5px 8px', borderRadius: 4,
              background: `${sourceBadgeColor}14`, border: `1px solid ${sourceBadgeColor}`,
              color: sourceBadgeColor, fontFamily: 'var(--font-mono)', fontSize: 8,
            }}>
              DATA SOURCE: {sourceLabel}
            </div>
          )}

          {/* Live coordinates */}
          {state && (
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 5, marginTop: 8 }}>
              {[
                { label: 'LATITUDE', value: `${state.latitude_deg.toFixed(2)}°` },
                { label: 'LONGITUDE', value: `${state.longitude_deg.toFixed(2)}°` },
                { label: 'ALTITUDE', value: `${state.altitude_km.toFixed(1)} km` },
                { label: 'VELOCITY', value: `${state.velocity_kms.toFixed(3)} km/s` },
                { label: 'X (ECI)', value: `${Number(state.position_eci_km?.[0] ?? 0).toFixed(0)} km` },
                { label: 'Y (ECI)', value: `${Number(state.position_eci_km?.[1] ?? 0).toFixed(0)} km` },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '4px 7px', background: 'rgba(0,0,0,0.28)', borderRadius: 4 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.35)' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#fff' }}>{value}</div>
                </div>
              ))}
            </div>
          )}
          {state && (
            <div style={{ marginTop: 5, fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.3)' }}>
              FRAME: {state.reference_frame} · UTC EPOCH ms · {isReal ? 'near-real-time TLE mean elements — NOT spacecraft telemetry' : 'not real telemetry'}
            </div>
          )}

          {/* Daily replay */}
          <div style={{ marginTop: 12 }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.38)', marginBottom: 4 }}>
              DAILY ORBITAL HISTORY ({days.length} days recorded)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 4 }}>
              {days.map((d) => (
                <button
                  key={d.mission_day}
                  onClick={() => setReplayDay(replayDay === d.mission_day ? null : d.mission_day)}
                  style={{
                    padding: '3px 7px', cursor: 'pointer', borderRadius: 3,
                    background: replayDay === d.mission_day ? 'rgba(0,212,255,0.25)' : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${replayDay === d.mission_day ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
                    color: replayDay === d.mission_day ? '#fff' : 'rgba(255,255,255,0.45)',
                    fontFamily: 'var(--font-mono)', fontSize: 8,
                  }}
                >
                  D{d.mission_day}
                </button>
              ))}
              {days.length === 0 && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.25)' }}>
                  Complete Day 1 to record daily paths
                </span>
              )}
            </div>

            {/* Ground-track mini map */}
            {(trackPoints.length > 0 || state) && (
              <div style={{ marginTop: 8, position: 'relative', height: 110, background: 'rgba(0,0,0,0.35)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <svg viewBox="0 0 100 100" preserveAspectRatio="none" style={{ width: '100%', height: '100%' }}>
                  {/* equator + meridian guides */}
                  <line x1="0" y1="50" x2="100" y2="50" stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
                  <line x1="50" y1="0" x2="50" y2="100" stroke="rgba(255,255,255,0.08)" strokeWidth="0.3" />
                  {trackPoints.length > 1 && (
                    <polyline
                      points={trackPoints.map(p => `${p.x},${p.y}`).join(' ')}
                      fill="none" stroke="#00ff88" strokeWidth="0.7" opacity="0.85"
                    />
                  )}
                  {/* live position */}
                  {state && (() => {
                    const x = ((state.longitude_deg + 180) / 360) * 100;
                    const y = ((90 - state.latitude_deg) / 180) * 100;
                    return <circle cx={x} cy={y} r="1.4" fill="#00d4ff" />;
                  })()}
                </svg>
                <div style={{ position: 'absolute', bottom: 3, right: 6, fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.35)' }}>
                  {replayPath ? `DAY ${replayDay} REPLAY · ${replayPath.point_count} pts · SIMULATED PATH` : 'LIVE GROUND TRACK (equirectangular)'}
                </div>
              </div>
            )}
          </div>

          {/* Planned vs actual */}
          {deviation && deviation.nearest_planned_waypoint != null && (
            <div style={{ marginTop: 10, padding: '7px 9px', background: 'rgba(0,0,0,0.28)', borderRadius: 5 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.35)', marginBottom: 2 }}>
                PLANNED VS ACTUAL DEVIATION
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9 }}>
                <span style={{ color: deviation.on_track ? '#00ff88' : '#ff8c00' }}>
                  {deviation.on_track ? 'ON TRACK' : 'OFF TRACK'}
                </span>
                <span style={{ color: '#fff' }}>
                  pos Δ {Number(deviation.position_deviation_km).toFixed(1)} km · vel Δ {Number(deviation.velocity_deviation_kms).toFixed(3)} km/s
                </span>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
