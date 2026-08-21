import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import type { AppScreen } from '../../types/mission';

const BASE_NAV_ITEMS: { screen: AppScreen; label: string; icon: string; humanOnly?: boolean }[] = [
  { screen: 'mission-control', label: 'MISSION CONTROL', icon: '⬡' },
  { screen: 'crew', label: 'CREW VITALS', icon: '👨‍🚀', humanOnly: true },
  { screen: 'planning', label: 'PLANNING', icon: '📅' },
  { screen: 'digital-twin', label: 'DIGITAL TWIN', icon: '◈' },
  { screen: 'architecture', label: 'ARCHITECTURE', icon: '🏗️' },
  { screen: 'orbit', label: 'TRAJECTORY', icon: '○' },
  { screen: 'universe', label: 'UNIVERSE', icon: '✦' },
  { screen: 'telemetry', label: 'TELEMETRY', icon: '≋' },
  { screen: 'environment', label: 'ENVIRONMENT', icon: '◐' },
  { screen: 'scenarios', label: 'SCENARIOS', icon: '⚡' },
  { screen: 'ai', label: 'VYOM AI', icon: '◉' },
  { screen: 'mission-time', label: 'MISSION TIME', icon: '◷' },
  { screen: 'blackbox', label: 'BLACK BOX', icon: '▣' },
  { screen: 'replay', label: 'REPLAY', icon: '▶' },
  { screen: 'reports', label: 'REPORTS', icon: '≡' },
  { screen: 'archive', label: 'ARCHIVE', icon: '◫' },
];

export function Navigation() {
  const screen = useMissionStore((s) => s.screen);
  const status = useMissionStore((s) => s.status);
  const config = useMissionStore((s) => s.config);
  const missionDay = useMissionStore((s) => s.missionDay);
  const telemetry = useMissionStore((s) => s.telemetry);
  const setScreen = useMissionStore((s) => s.setScreen);

  const isWizard = screen === 'onboarding' || screen === 'budget' || screen === 'launch' || screen === 'satellite' || screen === 'launch-sequence';
  if (isWizard) return null;

  const isHumanMission = config?.type === 'human';
  const navItems = BASE_NAV_ITEMS.filter((item) => !item.humanOnly || isHumanMission);

  const healthStatus = telemetry?.healthStatus ?? 'nominal';
  const healthColor = healthStatus === 'nominal' ? 'var(--nominal)'
    : healthStatus === 'warning' ? 'var(--warning)' : 'var(--critical)';

  return (
    <motion.div
      initial={{ opacity: 0, y: 60 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0,
        zIndex: 1000,
        background: 'rgba(2,4,9,0.95)',
        borderTop: '1px solid rgba(0,212,255,0.15)',
        backdropFilter: 'blur(16px)',
        display: 'flex', alignItems: 'stretch',
        height: 56,
      }}
    >
      {/* Mission ID & Info */}
      <div style={{
        padding: '0 16px', borderRight: '1px solid rgba(0,212,255,0.12)',
        display: 'flex', alignItems: 'center', gap: 10, minWidth: 260,
      }}>
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 800, color: '#00d4ff', letterSpacing: '0.1em' }}>
              VYOM
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fff', fontWeight: 600 }}>
              {config?.name ?? 'VYOM-01'}
            </span>
          </div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 1 }}>
            <div style={{ width: 5, height: 5, borderRadius: '50%', background: healthColor, boxShadow: `0 0 6px ${healthColor}` }} />
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: healthColor }}>
              {status.toUpperCase()}
            </span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,255,136,0.8)' }}>
              · ₹{config?.budgetCrore ?? 250} Cr
            </span>
          </div>
        </div>

        {/* Quick Launch Animation & New Mission Buttons */}
        <div style={{ marginLeft: 'auto', display: 'flex', gap: 6 }}>
          <button
            onClick={() => setScreen('launch-sequence')}
            style={{
              padding: '4px 8px',
              background: 'rgba(255,140,0,0.12)',
              border: '1px solid rgba(255,140,0,0.35)',
              borderRadius: 4,
              color: '#ff8c00',
              fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
            title="Play cinematic launch animation"
          >
            🚀 LAUNCH
          </button>
          <button
            onClick={() => setScreen('onboarding')}
            style={{
              padding: '4px 8px',
              background: 'rgba(0,212,255,0.1)',
              border: '1px solid rgba(0,212,255,0.3)',
              borderRadius: 4,
              color: '#00d4ff',
              fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.08em',
              cursor: 'pointer', whiteSpace: 'nowrap',
            }}
            title="Create a new custom mission"
          >
            + NEW
          </button>
        </div>
      </div>

      {/* Nav items */}
      <div style={{
        flex: 1, display: 'flex', overflowX: 'auto',
        scrollbarWidth: 'none',
      }}>
        {navItems.map((item) => {
          const active = screen === item.screen;
          return (
            <button
              key={item.screen}
              onClick={() => setScreen(item.screen)}
              style={{
                display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                gap: 2, padding: '6px 14px',
                background: active ? 'rgba(0,212,255,0.12)' : 'transparent',
                border: 'none',
                borderTop: active ? '2px solid #00d4ff' : '2px solid transparent',
                color: active ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                cursor: 'pointer',
                transition: 'all 0.15s',
                whiteSpace: 'nowrap', flexShrink: 0,
                minWidth: 70,
              }}
              onMouseEnter={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'rgba(255,255,255,0.04)';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.85)';
                }
              }}
              onMouseLeave={(e) => {
                if (!active) {
                  (e.currentTarget as HTMLElement).style.background = 'transparent';
                  (e.currentTarget as HTMLElement).style.color = 'rgba(255,255,255,0.5)';
                }
              }}
            >
              <span style={{ fontSize: 13 }}>{item.icon}</span>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.1em' }}>{item.label}</span>
            </button>
          );
        })}
      </div>

      {/* Mission Day */}
      <div style={{
        padding: '0 16px', borderLeft: '1px solid rgba(0,212,255,0.1)',
        display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', minWidth: 120,
      }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
          MISSION DAY
        </div>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 700, color: '#00d4ff' }}>
          {String(Math.floor(missionDay)).padStart(4, '0')}
        </div>
      </div>
    </motion.div>
  );
}
