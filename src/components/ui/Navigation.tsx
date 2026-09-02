import { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import type { AppScreen } from '../../types/mission';

function formatMissionElapsed(day: number): string {
  const totalSecs = Math.floor(day * 86400);
  const d = Math.floor(totalSecs / 86400);
  const h = Math.floor((totalSecs % 86400) / 3600);
  const m = Math.floor((totalSecs % 3600) / 60);
  const s = totalSecs % 60;
  return `${d}d ${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
}

const BASE_NAV_ITEMS: { screen: AppScreen; label: string; icon: string; humanOnly?: boolean }[] = [
  { screen: 'mission-control', label: 'MISSION CONTROL', icon: '⬡' },
  { screen: 'crew', label: 'CREW VITALS', icon: '👨‍🚀', humanOnly: true },
  { screen: 'digital-twin', label: 'DIGITAL TWIN', icon: '◈' },
  { screen: 'orbit', label: 'TRAJECTORY', icon: '○' },
  { screen: 'universe', label: 'UNIVERSE', icon: '✦' },
  { screen: 'telemetry', label: 'TELEMETRY', icon: '≋' },
  { screen: 'environment', label: 'ENVIRONMENT', icon: '◐' },
  { screen: 'scenarios', label: 'DANGER SIM', icon: '⚡' },
  { screen: 'danger-decision', label: 'DECISION TREE', icon: '⚠️' },
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

  const [isMobileMenuOpen, setIsMobileMenuOpen] = useState(false);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth < 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  const isHiddenScreen = screen === 'welcome' || screen === 'mission-control' || screen === 'onboarding' || screen === 'budget' || screen === 'launch' || screen === 'satellite' || screen === 'launch-sequence';
  if (isHiddenScreen) return null;

  const isHumanMission = config?.type === 'human';
  const navItems = BASE_NAV_ITEMS.filter((item) => !item.humanOnly || isHumanMission);

  const healthStatus = telemetry?.healthStatus ?? 'nominal';
  const healthColor = healthStatus === 'nominal' ? 'var(--nominal, #00ff88)'
    : healthStatus === 'warning' ? 'var(--warning, #ff9f0a)' : 'var(--critical, #ff3b30)';

  return (
    <>
      <motion.nav
        initial={{ opacity: 0, y: 60 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        style={{
          position: 'fixed', bottom: 0, left: 0, right: 0,
          zIndex: 1000,
          background: 'rgba(2, 4, 9, 0.95)',
          borderTop: '1px solid rgba(0, 212, 255, 0.15)',
          backdropFilter: 'blur(16px)',
          display: 'flex', alignItems: 'stretch',
          height: isMobile ? 50 : 56,
        }}
      >
        {/* Mission ID & Status Brand */}
        <div style={{
          padding: isMobile ? '0 10px' : '0 16px',
          borderRight: '1px solid rgba(0, 212, 255, 0.12)',
          display: 'flex', alignItems: 'center', gap: 8,
          minWidth: isMobile ? 'auto' : 240,
          flexShrink: 0,
        }}>
          <div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span style={{ fontFamily: 'var(--font-display)', fontSize: isMobile ? 12 : 13, fontWeight: 800, color: '#00d4ff', letterSpacing: '0.1em' }}>
                VYOM
              </span>
              {!isMobile && (
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#fff', fontWeight: 600 }}>
                  {config?.name ?? 'VYOM-01'}
                </span>
              )}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginTop: 1 }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: healthColor, boxShadow: `0 0 6px ${healthColor}` }} />
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: healthColor, fontWeight: 700 }}>
                {status.toUpperCase()}
              </span>
            </div>
          </div>

          {/* Quick Action Button for Mobile or Desktop */}
          {!isMobile ? (
            <div style={{ marginLeft: 'auto', display: 'flex', gap: 4 }}>
              <button
                onClick={() => setScreen('launch-sequence')}
                style={{
                  padding: '3px 6px', background: 'rgba(255,140,0,0.12)',
                  border: '1px solid rgba(255,140,0,0.35)', borderRadius: 4,
                  color: '#ff8c00', fontFamily: 'var(--font-mono)', fontSize: 7.5,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
                title="Play launch sequence"
              >
                🚀 LAUNCH
              </button>
              <button
                onClick={() => setScreen('onboarding')}
                style={{
                  padding: '3px 6px', background: 'rgba(0,212,255,0.1)',
                  border: '1px solid rgba(0,212,255,0.3)', borderRadius: 4,
                  color: '#00d4ff', fontFamily: 'var(--font-mono)', fontSize: 7.5,
                  cursor: 'pointer', whiteSpace: 'nowrap',
                }}
                title="New mission wizard"
              >
                + NEW
              </button>
            </div>
          ) : (
            <button
              onClick={() => setIsMobileMenuOpen(!isMobileMenuOpen)}
              style={{
                padding: '4px 8px', background: isMobileMenuOpen ? 'rgba(0,212,255,0.25)' : 'rgba(255,255,255,0.08)',
                border: `1px solid ${isMobileMenuOpen ? '#00d4ff' : 'rgba(255,255,255,0.2)'}`,
                borderRadius: 4, color: '#00d4ff', fontSize: 10, cursor: 'pointer',
                fontFamily: 'var(--font-mono)', fontWeight: 700,
              }}
            >
              ☰ TABS
            </button>
          )}
        </div>

        {/* Scrollable Navigation Tabs */}
        <div style={{
          flex: 1, display: 'flex', overflowX: 'auto',
          scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch',
        }}>
          {navItems.map((item) => {
            const active = screen === item.screen;
            return (
              <button
                key={item.screen}
                onClick={() => {
                  setScreen(item.screen);
                  setIsMobileMenuOpen(false);
                }}
                style={{
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  gap: 1, padding: isMobile ? '4px 10px' : '6px 14px',
                  background: active ? 'rgba(0,212,255,0.15)' : 'transparent',
                  border: 'none',
                  borderTop: active ? '2px solid #00d4ff' : '2px solid transparent',
                  color: active ? '#00d4ff' : 'rgba(255,255,255,0.6)',
                  cursor: 'pointer', transition: 'all 0.15s',
                  whiteSpace: 'nowrap', flexShrink: 0,
                  minWidth: isMobile ? 55 : 68,
                }}
              >
                <span style={{ fontSize: isMobile ? 11 : 13 }}>{item.icon}</span>
                <span style={{ fontFamily: 'var(--font-mono)', fontSize: isMobile ? 7 : 8, letterSpacing: '0.06em' }}>{item.label}</span>
              </button>
            );
          })}
        </div>

        {/* Mission Day Counter (Desktop) */}
        {!isMobile && (
          <div style={{
            padding: '0 16px', borderLeft: '1px solid rgba(0,212,255,0.1)',
            display: 'flex', flexDirection: 'column', justifyContent: 'center', alignItems: 'flex-end', minWidth: 100,
            flexShrink: 0,
          }}>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>
              DAY {String(Math.floor(missionDay)).padStart(3, '0')}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00d4ff' }}>
              {formatMissionElapsed(missionDay)}
            </div>
          </div>
        )}
      </motion.nav>

      {/* ── Mobile Grid Menu Drawer Modal ── */}
      <AnimatePresence>
        {isMobile && isMobileMenuOpen && (
          <motion.div
            initial={{ opacity: 0, y: 100 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 100 }}
            transition={{ duration: 0.25 }}
            style={{
              position: 'fixed', bottom: 52, left: 0, right: 0,
              maxHeight: '65vh', overflowY: 'auto',
              background: 'rgba(4, 10, 22, 0.98)',
              borderTop: '1px solid #00d4ff',
              backdropFilter: 'blur(20px)',
              padding: '16px', zIndex: 999,
              display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 8,
              boxShadow: '0 -10px 40px rgba(0,0,0,0.8)',
            }}
          >
            <div style={{ gridColumn: '1 / -1', display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#00d4ff', fontWeight: 700, letterSpacing: '0.1em' }}>
                ALL MISSION TABS
              </span>
              <button
                onClick={() => setIsMobileMenuOpen(false)}
                style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 14, cursor: 'pointer' }}
              >
                ✕
              </button>
            </div>

            {navItems.map((item) => {
              const active = screen === item.screen;
              return (
                <button
                  key={item.screen}
                  onClick={() => {
                    setScreen(item.screen);
                    setIsMobileMenuOpen(false);
                  }}
                  style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    padding: '10px 12px', borderRadius: 6,
                    background: active ? 'rgba(0, 212, 255, 0.2)' : 'rgba(255, 255, 255, 0.04)',
                    border: `1px solid ${active ? '#00d4ff' : 'rgba(255, 255, 255, 0.1)'}`,
                    color: active ? '#00d4ff' : '#ffffff',
                    fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 600,
                    textAlign: 'left', cursor: 'pointer',
                  }}
                >
                  <span style={{ fontSize: 14 }}>{item.icon}</span>
                  <span>{item.label}</span>
                </button>
              );
            })}
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
