import { useState, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import type { BlackBoxEvent } from '../../types/mission';

const SEVERITY_COLORS: Record<string, string> = {
  nominal: 'var(--nominal)',
  warning: 'var(--warning)',
  critical: 'var(--critical)',
  info: 'var(--info)',
};

const TYPE_ICONS: Record<string, string> = {
  telemetry: '≋',
  ai: '◉',
  threat: '⚡',
  command: '▶',
  failure: '✕',
  recovery: '✓',
  milestone: '★',
  user: '◈',
};

export function BlackBoxScreen() {
  const blackBox = useMissionStore((s) => s.blackBox);
  const missionDay = useMissionStore((s) => s.missionDay);
  const [filterType, setFilterType] = useState<string>('all');
  const [filterSeverity, setFilterSeverity] = useState<string>('all');
  const [search, setSearch] = useState('');

  const filtered = useMemo(() => {
    return blackBox
      .filter((e) => filterType === 'all' || e.eventType === filterType)
      .filter((e) => filterSeverity === 'all' || e.severity === filterSeverity)
      .filter((e) => !search || e.description.toLowerCase().includes(search.toLowerCase()))
      .slice()
      .reverse();
  }, [blackBox, filterType, filterSeverity, search]);

  const typeFilters = ['all', 'ai', 'threat', 'milestone', 'recovery', 'command', 'failure'];
  const severityFilters = ['all', 'nominal', 'warning', 'critical'];

  function formatTime(ts: number) {
    const d = new Date(ts);
    return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}:${String(d.getSeconds()).padStart(2, '0')}`;
  }

  return (
    <div style={{
      width: '100%', height: '100%', display: 'flex', flexDirection: 'column',
      background: '#020409', paddingBottom: 56, overflow: 'hidden',
    }}>
      {/* Header */}
      <div style={{
        padding: '16px 24px', borderBottom: '1px solid rgba(0,212,255,0.08)',
        background: 'rgba(5,12,25,0.9)',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 12 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.2em', marginBottom: 4 }}>
              MISSION BLACK BOX · {blackBox.length} EVENTS · IMMUTABLE LOG
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#fff' }}>
              MISSION HISTORY
            </div>
          </div>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12, color: '#00d4ff' }}>
            MISSION DAY {Math.floor(missionDay)}
          </div>
        </div>

        {/* Search */}
        <input
          type="text"
          placeholder="Search events…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          style={{
            width: '100%', maxWidth: 400, padding: '8px 14px',
            background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(0,212,255,0.15)',
            borderRadius: 6, color: '#fff', fontFamily: 'var(--font-mono)', fontSize: 11,
            outline: 'none', marginBottom: 12,
          }}
        />

        {/* Filters */}
        <div style={{ display: 'flex', gap: 16, flexWrap: 'wrap' }}>
          <div style={{ display: 'flex', gap: 6 }}>
            {typeFilters.map((f) => (
              <button key={f} onClick={() => setFilterType(f)} style={{
                padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
                background: filterType === f ? 'rgba(0,212,255,0.15)' : 'transparent',
                border: `1px solid ${filterType === f ? 'rgba(0,212,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 3, color: filterType === f ? '#00d4ff' : 'rgba(255,255,255,0.4)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {f === 'all' ? 'ALL' : `${TYPE_ICONS[f] || ''} ${f.toUpperCase()}`}
              </button>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 6 }}>
            {severityFilters.map((f) => (
              <button key={f} onClick={() => setFilterSeverity(f)} style={{
                padding: '4px 10px', fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.08em',
                background: filterSeverity === f ? `${SEVERITY_COLORS[f] || 'rgba(0,212,255,0.15)'}20` : 'transparent',
                border: `1px solid ${filterSeverity === f ? (SEVERITY_COLORS[f] || '#00d4ff') + '50' : 'rgba(255,255,255,0.08)'}`,
                borderRadius: 3, color: filterSeverity === f ? (SEVERITY_COLORS[f] || '#00d4ff') : 'rgba(255,255,255,0.4)',
                cursor: 'pointer', transition: 'all 0.15s',
              }}>
                {f.toUpperCase()}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* Events list */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '12px 24px' }}>
        <AnimatePresence>
          {filtered.map((event, i) => (
            <motion.div
              key={event.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i < 10 ? i * 0.03 : 0 }}
              className={`log-entry ${event.severity}`}
              style={{
                borderLeftColor: SEVERITY_COLORS[event.severity] ?? 'var(--info)',
                marginBottom: 4,
              }}
            >
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 12, marginBottom: 3 }}>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,212,255,0.6)', minWidth: 80 }}>
                  DAY {Math.floor(event.missionDay)}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.3)' }}>
                  {formatTime(event.timestamp)}
                </span>
                <span style={{
                  fontFamily: 'var(--font-mono)', fontSize: 8, padding: '1px 6px',
                  background: 'rgba(0,0,0,0.4)', border: '1px solid rgba(255,255,255,0.06)',
                  borderRadius: 2, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.08em',
                }}>
                  {TYPE_ICONS[event.eventType]} {event.eventType.toUpperCase()}
                </span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.25)' }}>
                  {event.source}
                </span>
                {event.severity !== 'nominal' && (
                  <span style={{
                    fontFamily: 'var(--font-mono)', fontSize: 8,
                    color: SEVERITY_COLORS[event.severity],
                    marginLeft: 'auto',
                  }}>
                    {event.severity.toUpperCase()}
                  </span>
                )}
              </div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.8)', lineHeight: 1.5 }}>
                {event.description}
              </div>
            </motion.div>
          ))}
        </AnimatePresence>

        {filtered.length === 0 && (
          <div style={{ textAlign: 'center', padding: 60, fontFamily: 'var(--font-mono)', color: 'rgba(255,255,255,0.2)', fontSize: 12 }}>
            {blackBox.length === 0 ? 'No events recorded yet — begin mission to populate black box' : 'No events match current filters'}
          </div>
        )}
      </div>

      {/* Footer */}
      <div style={{
        padding: '8px 24px', borderTop: '1px solid rgba(255,255,255,0.04)',
        fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.2)',
        display: 'flex', justifyContent: 'space-between',
      }}>
        <span>SHOWING {filtered.length} OF {blackBox.length} EVENTS</span>
        <span>BLACK BOX · IMMUTABLE ONCE RECORDED · SIMULATION MODE</span>
      </div>
    </div>
  );
}
