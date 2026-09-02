import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import type { ArchivedMission } from '../../types/mission';

const STATUS_COLORS: Record<string, string> = {
  completed: '#00d4ff',
  active: '#00ff88',
  archived: '#9b5de5',
};

export function ArchiveScreen() {
  const archivedMissions = useMissionStore((s) => s.archivedMissions);
  const loadArchivedMission = useMissionStore((s) => s.loadArchivedMission);
  const setScreen = useMissionStore((s) => s.setScreen);
  const resetMission = useMissionStore((s) => s.resetMission);

  const handleNewMission = () => {
    resetMission();
    setScreen('welcome');
  };

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#020409', paddingBottom: 56,
    }}>
      <div style={{ padding: '32px' }}>
        {/* Header */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 32 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.2em', marginBottom: 6 }}>
              MISSION ARCHIVE · {archivedMissions.length} MISSIONS STORED
            </div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 28, fontWeight: 700, color: '#fff' }}>
              ARCHIVE
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            <button
              onClick={() => {
                resetMission();
                setScreen('welcome');
              }}
              className="btn"
              style={{ color: 'rgba(255,255,255,0.65)', borderColor: 'rgba(255,255,255,0.18)' }}
            >
              ← BACK TO VYOM
            </button>
            <button onClick={handleNewMission} className="btn btn-primary">
              + NEW MISSION
            </button>
          </div>
        </div>

        {/* Mission cards */}
        {archivedMissions.length === 0 ? (
          <motion.div
            initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            style={{ textAlign: 'center', padding: 80, color: 'rgba(255,255,255,0.2)' }}
          >
            <div style={{ fontSize: 48, marginBottom: 16 }}>◫</div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, marginBottom: 8 }}>No missions archived</div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 12 }}>Complete a mission to see it here</div>
            <button onClick={handleNewMission} className="btn btn-primary" style={{ marginTop: 32 }}>
              BEGIN YOUR FIRST MISSION
            </button>
          </motion.div>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 20 }}>
            {archivedMissions.slice().reverse().map((mission: ArchivedMission, i) => {
              const date = new Date(mission.completedAt);
              const statusColor = STATUS_COLORS[mission.status] ?? '#00d4ff';
              return (
                <motion.div
                  key={mission.config.id}
                  initial={{ opacity: 0, y: 20 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ delay: i * 0.08 }}
                  style={{
                    padding: '24px', cursor: 'pointer',
                    background: 'rgba(5,12,25,0.9)',
                    border: '1px solid rgba(0,212,255,0.1)',
                    borderRadius: 12, transition: 'all 0.2s',
                  }}
                  whileHover={{ borderColor: 'rgba(0,212,255,0.35)', y: -4 }}
                >
                  {/* Mission ID + status */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color: '#fff' }}>
                      {mission.config.name}
                    </div>
                    <div style={{
                      padding: '3px 10px',
                      background: `${statusColor}15`,
                      border: `1px solid ${statusColor}40`,
                      borderRadius: 4,
                      fontFamily: 'var(--font-mono)', fontSize: 9, color: statusColor,
                      letterSpacing: '0.1em',
                    }}>
                      {mission.status.toUpperCase()}
                    </div>
                  </div>

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(0,212,255,0.5)', marginBottom: 4 }}>
                    {mission.config.type.toUpperCase()} MISSION
                  </div>
                  <p style={{ fontFamily: 'var(--font-body)', fontSize: 12, color: 'rgba(255,255,255,0.45)', lineHeight: 1.5, marginBottom: 16 }}>
                    {mission.config.objective?.slice(0, 80)}{(mission.config.objective?.length ?? 0) > 80 ? '…' : ''}
                  </p>

                  {/* Stats */}
                  <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 8, marginBottom: 16 }}>
                    {[
                      { label: 'OBJECTIVE', value: `${mission.objectiveProgress.toFixed(0)}%` },
                      { label: 'THREATS', value: String(mission.stats.threatsEncountered) },
                      { label: 'AI OPS', value: String(mission.stats.aiInterventions) },
                    ].map(({ label, value }) => (
                      <div key={label} style={{ textAlign: 'center', padding: '8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.25)', marginBottom: 2 }}>{label}</div>
                        <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 700, color: '#00d4ff' }}>{value}</div>
                      </div>
                    ))}
                  </div>

                  {/* Disposition */}
                  {mission.disposition && (
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.3)', marginBottom: 12 }}>
                      DISPOSITION: {mission.disposition.replace('-', ' ').toUpperCase()}
                    </div>
                  )}

                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.2)', marginBottom: 12 }}>
                    {date.toLocaleDateString()} · {mission.config.launchSite?.name}
                  </div>

                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      onClick={() => loadArchivedMission(mission.config.id)}
                      className="btn btn-sm"
                      style={{ flex: 1 }}
                    >
                      VIEW REPLAY
                    </button>
                  </div>
                </motion.div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
