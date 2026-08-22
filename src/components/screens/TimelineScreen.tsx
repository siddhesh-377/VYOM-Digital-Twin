/**
 * TimelineScreen — interactive Mission Timeline.
 * Navigate from Mission Day 0 to the final mission day; click any event to
 * inspect its full historical context (audit fields, incident resolution
 * timeline, daily summary). All data comes from the backend event database.
 */
import { useCallback, useEffect, useState } from 'react';
import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { BACKEND_API_URL, backendWS } from '../../services/BackendWebSocketService';

interface TimelineEvent {
  id: string;
  type: string;
  mission_day: number;
  timestamp: number;
  description: string;
  severity: string;
  status?: string;
  details?: Record<string, any>;
}

interface FullEvent extends Record<string, any> {
  id: string;
  eventType?: string;
  severity?: string;
  description?: string;
  incidentId?: string;
}

const SEV_COLORS: Record<string, string> = {
  critical: '#ff2d55',
  warning: '#ff8c00',
  nominal: '#00ff88',
  info: '#00d4ff',
  success: '#00ff88',
};

export function TimelineScreen() {
  const missionDay = useMissionStore((s) => s.missionDay);
  const config = useMissionStore((s) => s.config);
  const missionId = config?.id;
  const totalDays = Math.max(0, Math.floor(missionDay));

  const [selectedDay, setSelectedDay] = useState(0);
  const [events, setEvents] = useState<TimelineEvent[]>([]);
  const [loading, setLoading] = useState(false);
  const [detail, setDetail] = useState<FullEvent | null>(null);
  const [incidentTimeline, setIncidentTimeline] = useState<Record<string, any> | null>(null);
  const [daySummary, setDaySummary] = useState<Record<string, any> | null>(null);

  // Load events whenever the selected day or mission changes
  const loadDay = useCallback(async () => {
    if (!missionId || !backendWS.isConnected) return;
    setLoading(true);
    try {
      const res = await fetch(`${BACKEND_API_URL}/api/missions/${missionId}/timeline/day/${selectedDay}`);
      setEvents(res.ok ? await res.json() : []);
    } catch {
      setEvents([]);
    }
    setLoading(false);
    try {
      const res2 = await fetch(`${BACKEND_API_URL}/api/missions/${missionId}/timeline/daily-summaries/${selectedDay}`);
      setDaySummary(res2.ok ? await res2.json() : null);
    } catch {
      setDaySummary(null);
    }
  }, [missionId, selectedDay]);

  useEffect(() => { loadDay(); }, [loadDay]);

  const openDetail = useCallback(async (ev: TimelineEvent) => {
    if (!missionId) return;
    setIncidentTimeline(null);
    if (ev.type !== 'blackbox' || !ev.id) { setDetail(ev as FullEvent); return; }
    try {
      const res = await fetch(`${BACKEND_API_URL}/api/missions/${missionId}/blackbox?limit=2000`);
      const all: FullEvent[] = await res.json();
      const full = all.find(e => e.id === ev.id) ?? (ev as FullEvent);
      setDetail(full);
      if (full.incidentId) {
        const r2 = await fetch(`${BACKEND_API_URL}/api/missions/${missionId}/incidents/${full.incidentId}/timeline`);
        if (r2.ok) setIncidentTimeline(await r2.json());
      }
    } catch {
      setDetail(ev as FullEvent);
    }
  }, [missionId]);

  const dayMarks = Array.from({ length: totalDays + 1 }, (_, i) => i);

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#020409', padding: '28px 28px 80px' }}>
      <div style={{ maxWidth: 1100, margin: '0 auto' }}>
        {/* Header */}
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.25em', color: 'rgba(0,212,255,0.7)', marginBottom: 4 }}>
            COMPLETE MISSION HISTORY · DAY 0 TO FINAL DAY · SOURCE: BLACK BOX EVENT DATABASE
          </div>
          <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#fff', margin: 0 }}>
            INTERACTIVE MISSION TIMELINE
          </h1>
        </div>

        {!backendWS.isConnected && (
          <div style={{
            padding: '12px 16px', marginBottom: 18,
            background: 'rgba(255,140,0,0.08)', border: '1px solid rgba(255,140,0,0.3)', borderRadius: 8,
            fontFamily: 'var(--font-mono)', fontSize: 10, color: '#ff8c00',
          }}>
            Backend not connected — historical timeline requires the VYOM backend event database.
          </div>
        )}

        {/* Day scrubber */}
        <div style={{
          padding: '20px', marginBottom: 20,
          background: 'rgba(5,12,25,0.92)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 10,
        }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 10 }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.45)', letterSpacing: '0.15em' }}>
              SELECT MISSION DAY
            </span>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 30, fontWeight: 800, color: '#00d4ff' }}>
              DAY {String(selectedDay).padStart(3, '0')}
              <span style={{ fontSize: 13, color: 'rgba(255,255,255,0.35)' }}> / {totalDays}</span>
            </span>
          </div>

          {/* Day buttons */}
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 5 }}>
            {dayMarks.map(d => (
              <button
                key={d}
                onClick={() => setSelectedDay(d)}
                style={{
                  minWidth: 38, padding: '5px 6px', cursor: 'pointer', borderRadius: 4, transition: 'all 0.15s',
                  background: d === selectedDay ? 'rgba(0,212,255,0.25)' : 'rgba(0,0,0,0.3)',
                  border: `1px solid ${d === selectedDay ? '#00d4ff' : 'rgba(255,255,255,0.08)'}`,
                  color: d === selectedDay ? '#fff' : 'rgba(255,255,255,0.45)',
                  fontFamily: 'var(--font-mono)', fontSize: 9,
                }}
              >
                D{d}
              </button>
            ))}
            {totalDays === 0 && (
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)' }}>
                Mission Day 0 — advance mission time to record more days
              </span>
            )}
          </div>
        </div>

        {/* Daily summary context */}
        {daySummary && (
          <div style={{
            padding: '14px 16px', marginBottom: 16,
            background: 'rgba(0,212,255,0.04)', border: '1px solid rgba(0,212,255,0.15)', borderRadius: 8,
            display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: 10,
          }}>
            {(() => {
              const s = daySummary.summary_json ?? {};
              const ms = s.mission_state ?? {};
              const env = s.environment ?? {};
              const risk = s.risk ?? {};
              return [
                { label: 'AVG HEALTH', value: `${Number(ms.health_avg ?? 100).toFixed(1)}%` },
                { label: 'ENV CLASS', value: String(env.classification ?? 'nominal').toUpperCase() },
                { label: 'AVG ALTITUDE', value: `${Number((s.orbital_state ?? {}).avg_altitude ?? 0).toFixed(0)} km` },
                { label: 'AVG VELOCITY', value: `${Number((s.orbital_state ?? {}).avg_velocity ?? 0).toFixed(2)} km/s` },
                { label: 'RISK AVG', value: Number(risk.avg_risk_score ?? 0).toFixed(1) },
              ].map(({ label, value }) => (
                <div key={label}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.32)' }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#fff' }}>{value}</div>
                </div>
              ));
            })()}
          </div>
        )}

        {/* Events for selected day */}
        <div style={{
          background: 'rgba(5,12,25,0.92)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 10,
          padding: '18px', minHeight: 200,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00d4ff', letterSpacing: '0.15em', marginBottom: 12 }}>
            EVENTS ON DAY {selectedDay} {loading && '· LOADING…'} ({events.length})
          </div>
          {!loading && events.length === 0 && (
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.3)', padding: '24px 0', textAlign: 'center' }}>
              No recorded events on this day.
            </div>
          )}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            {events.map((ev, i) => {
              const col = SEV_COLORS[ev.severity] ?? '#00d4ff';
              return (
                <motion.button
                  key={`${ev.id}-${i}`}
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.03 }}
                  onClick={() => openDetail(ev)}
                  style={{
                    textAlign: 'left', padding: '10px 14px', cursor: 'pointer', transition: 'all 0.15s',
                    background: 'rgba(0,0,0,0.25)', border: `1px solid ${col}33`, borderRadius: 7,
                  }}
                >
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8, minWidth: 0 }}>
                      <span style={{ width: 7, height: 7, borderRadius: '50%', background: col, boxShadow: `0 0 6px ${col}`, flexShrink: 0 }} />
                      <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: col, letterSpacing: '0.1em', flexShrink: 0 }}>
                        {String(ev.type).toUpperCase()}
                      </span>
                      <span style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.85)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                        {ev.description}
                      </span>
                    </div>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.3)', flexShrink: 0 }}>
                      {new Date(ev.timestamp).toLocaleTimeString()} · D{Number(ev.mission_day).toFixed(2)}
                    </span>
                  </div>
                </motion.button>
              );
            })}
          </div>
        </div>
      </div>

      {/* ── Event detail drawer ── */}
      {detail && (
        <div
          onClick={() => setDetail(null)}
          style={{
            position: 'fixed', inset: 0, zIndex: 1200,
            background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
            display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 24,
          }}
        >
          <motion.div
            initial={{ scale: 0.94, y: 14 }} animate={{ scale: 1, y: 0 }}
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%', maxWidth: 620, maxHeight: '82vh', overflowY: 'auto',
              background: '#050c19', border: '1px solid rgba(0,212,255,0.4)', borderRadius: 12, padding: 22,
            }}
          >
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.2em', color: '#00d4ff' }}>
                HISTORICAL CONTEXT
              </span>
              <button onClick={() => setDetail(null)} style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.4)', cursor: 'pointer', fontSize: 15 }}>✕</button>
            </div>

            <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#fff', marginBottom: 10, lineHeight: 1.4 }}>
              {detail.description}
            </div>

            {/* Audit grid */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(160px, 1fr))', gap: 8, marginBottom: 14 }}>
              {[
                { label: 'EVENT ID', value: detail.id },
                { label: 'SEVERITY', value: String(detail.severity ?? '—').toUpperCase() },
                { label: 'SOURCE', value: detail.source ?? '—' },
                { label: 'SUBSYSTEM', value: detail.subsystem ?? '—' },
                { label: 'MISSION DAY', value: String(detail.missionDay ?? detail.mission_day ?? '—') },
                { label: 'OPERATOR', value: detail.operator ?? '—' },
                { label: 'NORMALIZED FAULT', value: detail.normalizedFault ?? '—' },
                { label: 'RESULT', value: detail.result ?? '—' },
                { label: 'PROCEDURE/CMD', value: detail.commandProcedure ?? '—' },
                { label: 'INCIDENT ID', value: detail.incidentId ?? '—' },
              ].map(({ label, value }) => (
                <div key={label} style={{ padding: '7px 9px', background: 'rgba(0,0,0,0.3)', borderRadius: 5, border: '1px solid rgba(255,255,255,0.05)' }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.3)', marginBottom: 2 }}>{label}</div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 600, color: '#ddeeff', wordBreak: 'break-all' }}>{value}</div>
                </div>
              ))}
            </div>

            {detail.rawError && (
              <div style={{ padding: '10px 12px', background: 'rgba(255,45,85,0.06)', border: '1px solid rgba(255,45,85,0.25)', borderRadius: 6, marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#ff2d55', marginBottom: 3 }}>RAW ERROR (PRESERVED)</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'rgba(255,255,255,0.65)' }}>{detail.rawError}</div>
              </div>
            )}

            {/* Incident resolution timeline */}
            {incidentTimeline && (
              <div style={{ padding: '12px 14px', background: 'rgba(155,93,229,0.06)', border: '1px solid rgba(155,93,229,0.3)', borderRadius: 6, marginBottom: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9b5de5', letterSpacing: '0.12em', marginBottom: 8 }}>
                  INCIDENT RESOLUTION TIMELINE (BACKEND-AUTHORITATIVE)
                </div>
                {[
                  ['Detection', incidentTimeline.detection_time_ms],
                  ['Diagnosis', incidentTimeline.diagnosis_time_ms],
                  ['Decision', incidentTimeline.decision_time_ms],
                  ['Recovery start', incidentTimeline.recovery_start_time_ms],
                  ['Recovery end', incidentTimeline.recovery_end_time_ms],
                ].map(([label, t]: [string, any]) => (
                  <div key={label} style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.55)', padding: '2px 0' }}>
                    <span>{label}</span>
                    <span>{t ? new Date(t).toLocaleTimeString() : '— pending'}</span>
                  </div>
                ))}
                {incidentTimeline.total_resolution_ms != null && (
                  <div style={{ marginTop: 6, fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: '#00ff88' }}>
                    TOTAL RESOLUTION: {(incidentTimeline.total_resolution_ms / 1000).toFixed(2)}s
                  </div>
                )}
              </div>
            )}

            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.25)' }}>
              Source: Black Box event database (append-only, hash-chained)
              {detail.eventHash ? ` · hash ${String(detail.eventHash).slice(0, 12)}…` : ''}
            </div>
          </motion.div>
        </div>
      )}
    </div>
  );
}
