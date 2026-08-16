import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { threatEngine } from '../../engines/ThreatEngine';
import { backendWS, injectFaultViaBackend } from '../../services/BackendWebSocketService';

const RISK_COLORS: Record<string, string> = {
  low:      '#00ff88',
  medium:   '#ff8c00',
  high:     '#ff2d55',
  critical: '#ff2d55',
};

const PHASE_LABELS: Record<string, string> = {
  ingesting:   'INGESTING',
  diagnosing:  'DIAGNOSING',
  predicting:  'PREDICTING',
  optimizing:  'OPTIMIZING',
  executing:   'EXECUTING',
  verifying:   'VERIFYING',
  monitoring:  'MONITORING',
};

const DEFAULT_9_STEPS = [
  { step: 1, phase: 'ingesting',  title: 'Telemetry Ingestion & Sensor Anomaly Isolation',         detail: 'Real-time 10Hz telemetry stream. Kalman filter extracting variance bounds across 12 channels.', status: 'complete', confidence: 99.4 },
  { step: 2, phase: 'diagnosing', title: 'Anomaly Correlation & Subsystem Affinity Mapping',        detail: 'Correlating anomaly signals and performing cross-subsystem affinity grouping.', status: 'complete', confidence: 97.2 },
  { step: 3, phase: 'diagnosing', title: 'Root Cause Classification (Rule-Based Engineering Logic)', detail: 'Pattern-matching against 7 aerospace fault classes. Best-fit root cause identified.', status: 'complete', confidence: 94.8 },
  { step: 4, phase: 'predicting', title: 'Monte Carlo Failure Projection (5,000 runs)',              detail: 'State progression simulated. Nominal predicted time to degradation: 6.2 minutes.', status: 'complete', confidence: 91.5 },
  { step: 5, phase: 'optimizing', title: 'Multi-Strategy Countermeasure Optimization',               detail: 'Evaluating all candidate mitigation strategies. Optimal sequence selected via expected-loss minimization.', status: 'complete', confidence: 98.1 },
  { step: 6, phase: 'executing',  title: 'Command Generation',                                       detail: 'Synthesizing ordered command queue for spacecraft state mutation.', status: 'complete', confidence: 99.0 },
  { step: 7, phase: 'executing',  title: 'Safety Constraint Validation',                             detail: 'Checking power, thermal, and mode constraints before command dispatch.', status: 'complete', confidence: 99.8 },
  { step: 8, phase: 'executing',  title: 'Autonomous Command Execution',                             detail: 'Commands dispatched to digital twin. Spacecraft state update in progress.', status: 'complete', confidence: 99.9 },
  { step: 9, phase: 'verifying',  title: 'Telemetry Recovery Verification',                          detail: 'Monitoring telemetry for 10 consecutive nominal ticks before confirming recovery.', status: 'complete', confidence: 100.0 },
];

export function AIScreen() {
  const ai           = useMissionStore((s) => s.aiAnalysis);
  const activeThreats = useMissionStore((s) => s.activeThreats);
  const controlMode  = useMissionStore((s) => s.controlMode);
  const setControlMode = useMissionStore((s) => s.setControlMode);
  const config       = useMissionStore((s) => s.config);
  const stats        = useMissionStore((s) => s.stats);

  const riskColor = RISK_COLORS[ai.riskLevel ?? 'low'];
  const isActive  = ai.anomalyDetected || activeThreats.length > 0;
  const isBackendConnected = backendWS.isConnected;

  // ── Reasoning Steps ─────────────────────────────────────────────────────────
  // Use real backend steps if present, else use fallback 9-step defaults
  const backendSteps = (ai as any).reasoningSteps;
  const hasBackendSteps = Array.isArray(backendSteps) && backendSteps.length > 0;

  const stepsToShow: {
    step: number; phase: string; title: string; detail: string;
    status: 'pending' | 'running' | 'complete'; confidence: number;
  }[] = hasBackendSteps
    ? backendSteps.map((s: any) => ({
        step:       s.step,
        phase:      s.phase ?? 'executing',
        title:      s.title,
        detail:     s.detail,
        status:     s.status === 'running' ? 'running' : s.status === 'complete' ? 'complete' : 'pending',
        confidence: s.confidence ?? 0,
      }))
    : DEFAULT_9_STEPS.map((s) => {
        // Animate based on current ai.phase when no anomaly detected
        if (!isActive) return { ...s, status: 'complete' as const };
        const phases = ['ingesting', 'diagnosing', 'predicting', 'optimizing', 'executing', 'verifying'];
        const phaseIdx  = phases.indexOf(s.phase);
        const activeIdx = phases.indexOf(ai.phase ?? 'monitoring');
        if (phaseIdx < activeIdx) return { ...s, status: 'complete' as const };
        if (phaseIdx === activeIdx) return { ...s, status: 'running' as const };
        return { ...s, status: 'pending' as const };
      });

  // ── Fault Injection ──────────────────────────────────────────────────────────
  const handleTestDiagnostic = async (faultType: string, name: string, desc: string, effects: any) => {
    if (isBackendConnected && config?.id) {
      const ok = await injectFaultViaBackend(config.id, faultType, 7.5);
      if (!ok) threatEngine.triggerThreat(faultType, name, desc, effects);
    } else {
      threatEngine.triggerThreat(faultType, name, desc, effects);
    }
  };

  // ── Evidence channels from backend ──────────────────────────────────────────
  const evidenceChannels: string[] = (ai as any).evidenceChannels ?? [];

  return (
    <div style={{ width: '100%', height: '100%', overflowY: 'auto', background: '#020409', padding: '28px 28px 80px' }}>
      <div style={{ maxWidth: 1200, margin: '0 auto' }}>

        {/* ── Header ── */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24, flexWrap: 'wrap', gap: 16 }}>
          <div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.25em', color: 'rgba(155,93,229,0.8)', marginBottom: 4 }}>
              AUTONOMOUS GUARDIAN · 9-STEP DIAGNOSTIC & MITIGATION ENGINE
            </div>
            <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 26, fontWeight: 700, color: '#fff', margin: 0 }}>
              VYOM AI NEURAL DIAGNOSTIC KERNEL
            </h1>
          </div>

          <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>
            {/* Backend source badge */}
            <div style={{
              padding: '4px 10px', borderRadius: 4,
              background: isBackendConnected ? 'rgba(155,93,229,0.15)' : 'rgba(0,0,0,0.3)',
              border: `1px solid ${isBackendConnected ? '#9b5de5' : 'rgba(255,255,255,0.15)'}`,
              fontFamily: 'var(--font-mono)', fontSize: 8.5,
              color: isBackendConnected ? '#9b5de5' : 'rgba(255,255,255,0.4)',
              display: 'flex', alignItems: 'center', gap: 5,
            }}>
              <div style={{ width: 5, height: 5, borderRadius: '50%', background: isBackendConnected ? '#9b5de5' : 'rgba(255,255,255,0.3)', animation: isBackendConnected ? 'ai-pulse 2s infinite' : 'none' }} />
              {isBackendConnected ? 'LIVE BACKEND AI' : 'LOCAL AI SIM'}
            </div>

            <button
              onClick={() => handleTestDiagnostic('thermal_overheating', 'Thermal Cascade', 'Thermal spike in primary CPU array exceeding bounds.', { thermal: 2.5 })}
              style={{ background: 'rgba(155,93,229,0.15)', border: '1px solid #9b5de5', borderRadius: 6, color: '#9b5de5', fontSize: 10, padding: '8px 16px', fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              🧪 TRIGGER THERMAL ANOMALY
            </button>
            <button
              onClick={() => handleTestDiagnostic('battery_failure', 'Power Bus Drop', 'Sudden voltage ripple detected on main bus.', { power: 1.8 })}
              style={{ background: 'rgba(255,140,0,0.15)', border: '1px solid #ff8c00', borderRadius: 6, color: '#ff8c00', fontSize: 10, padding: '8px 16px', fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              ⚡ TRIGGER POWER FAULT
            </button>
            <button
              onClick={() => handleTestDiagnostic('comm_failure', 'Comm Blackout', 'Signal degradation below acquisition threshold.', { comm: 2.0 })}
              style={{ background: 'rgba(0,212,255,0.12)', border: '1px solid rgba(0,212,255,0.4)', borderRadius: 6, color: '#00d4ff', fontSize: 10, padding: '8px 16px', fontFamily: 'var(--font-mono)', cursor: 'pointer', transition: 'all 0.2s' }}
            >
              📡 TRIGGER COMM FAULT
            </button>
          </div>
        </div>

        {/* ── Active Anomaly Alert Banner ── */}
        <AnimatePresence>
          {isActive && (
            <motion.div
              initial={{ opacity: 0, y: -12 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -12 }}
              style={{
                padding: '14px 20px', marginBottom: 20,
                background: `${riskColor}12`, border: `1px solid ${riskColor}66`,
                borderRadius: 10, display: 'flex', alignItems: 'flex-start', gap: 16,
              }}
            >
              <div style={{ fontSize: 20, lineHeight: 1 }}>⚠</div>
              <div style={{ flex: 1 }}>
                <div style={{ display: 'flex', gap: 14, alignItems: 'center', marginBottom: 4, flexWrap: 'wrap' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: riskColor, letterSpacing: '0.12em' }}>
                    {(ai.riskLevel ?? 'medium').toUpperCase()} RISK
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.7)' }}>
                    {ai.anomalyDescription}
                  </span>
                </div>
                {ai.predictedFailure && (
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.45)' }}>
                    PREDICTED: {ai.predictedFailure}
                    {ai.timeToFailureMin > 0 && (
                      <span style={{ color: riskColor, marginLeft: 12 }}>
                        ⏱ T-{ai.timeToFailureMin.toFixed(1)} MIN
                      </span>
                    )}
                  </div>
                )}
              </div>
              {typeof ai.probability === 'number' && ai.probability > 0 && (
                <div style={{ textAlign: 'right', flexShrink: 0 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 20, fontWeight: 900, color: riskColor }}>
                    {ai.probability.toFixed(1)}%
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)' }}>
                    PROBABILITY
                  </div>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Top Stats Row ── */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: 12, marginBottom: 24 }}>
          {[
            { label: 'AI INTERVENTIONS', value: String(stats.aiInterventions), color: '#9b5de5' },
            { label: 'THREATS ENCOUNTERED', value: String(stats.threatsEncountered), color: '#ff8c00' },
            { label: 'CONFIDENCE LEVEL', value: ai.confidence > 0 ? `${ai.confidence.toFixed(1)}%` : '—', color: '#00ff88' },
            { label: 'CONTROL MODE', value: controlMode.toUpperCase(), color: '#00d4ff' },
          ].map(({ label, value, color }) => (
            <div key={label} style={{ padding: '12px 16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(255,255,255,0.07)', borderRadius: 8 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.35)', marginBottom: 4, letterSpacing: '0.12em' }}>{label}</div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 20, fontWeight: 700, color }}>{value}</div>
            </div>
          ))}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 340px', gap: 20, alignItems: 'start' }}>

          {/* ── Left: 9-Step Pipeline ── */}
          <div style={{ padding: '24px', background: 'rgba(5,12,25,0.95)', border: '1px solid rgba(155,93,229,0.25)', borderRadius: 12 }}>
            <div style={{ marginBottom: 18 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9b5de5', letterSpacing: '0.2em', marginBottom: 4 }}>
                EXPLAINABLE AI · 9-STEP DIAGNOSTIC & MITIGATION PIPELINE
              </div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 18, fontWeight: 700, color: '#fff' }}>
                HOW VYOM AI PROCESSES & NEUTRALIZES THREATS
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {stepsToShow.map((step, idx) => {
                const isRunning  = step.status === 'running';
                const isComplete = step.status === 'complete';
                const isPending  = step.status === 'pending';
                const borderCol = isRunning ? '#9b5de5' : isComplete ? 'rgba(0,255,136,0.35)' : 'rgba(255,255,255,0.06)';
                const bgCol     = isRunning ? 'rgba(155,93,229,0.12)' : isComplete ? 'rgba(0,255,136,0.03)' : 'rgba(0,0,0,0.2)';
                const phaseTag  = PHASE_LABELS[step.phase] ?? step.phase.toUpperCase();

                return (
                  <motion.div
                    key={step.step}
                    layout
                    initial={{ opacity: 0 }}
                    animate={{ opacity: 1 }}
                    transition={{ delay: idx * 0.04 }}
                    style={{ padding: '12px 16px', background: bgCol, border: `1px solid ${borderCol}`, borderRadius: 8, display: 'flex', alignItems: 'center', gap: 14 }}
                  >
                    {/* Step number bubble */}
                    <div style={{
                      width: 30, height: 30, borderRadius: '50%', flexShrink: 0,
                      background: isComplete ? 'rgba(0,255,136,0.18)' : isRunning ? 'rgba(155,93,229,0.28)' : 'rgba(255,255,255,0.04)',
                      border: `1px solid ${isComplete ? '#00ff88' : isRunning ? '#9b5de5' : 'rgba(255,255,255,0.1)'}`,
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700,
                      color: isComplete ? '#00ff88' : isRunning ? '#9b5de5' : 'rgba(255,255,255,0.3)',
                    }}>
                      {isComplete ? '✓' : String(step.step).padStart(2, '0')}
                    </div>

                    {/* Content */}
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, padding: '1px 5px', borderRadius: 2, background: 'rgba(255,255,255,0.06)', color: 'rgba(255,255,255,0.35)', letterSpacing: '0.1em' }}>
                          {phaseTag}
                        </span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: isComplete ? '#fff' : isRunning ? '#9b5de5' : 'rgba(255,255,255,0.4)', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>
                          {step.title}
                        </span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'rgba(255,255,255,0.38)', lineHeight: 1.4 }}>
                        {step.detail}
                      </div>
                    </div>

                    {/* Right metric */}
                    {isComplete && step.confidence > 0 && (
                      <div style={{ textAlign: 'right', flexShrink: 0 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#00ff88' }}>
                          {step.confidence.toFixed(1)}%
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.3)' }}>CERTAINTY</div>
                      </div>
                    )}
                    {isRunning && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#9b5de5', animation: 'ai-pulse 1.2s ease-in-out infinite', flexShrink: 0 }}>
                        PROCESSING…
                      </div>
                    )}
                    {isPending && (
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.2)', flexShrink: 0 }}>
                        QUEUED
                      </div>
                    )}
                  </motion.div>
                );
              })}
            </div>
          </div>

          {/* ── Right: Intel Panel ── */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>

            {/* Control Mode */}
            <div style={{ padding: '16px', background: 'rgba(5,12,25,0.92)', border: '1px solid rgba(155,93,229,0.2)', borderRadius: 10 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9b5de5', letterSpacing: '0.1em', marginBottom: 8 }}>FLIGHT CONTROL ARBITRATION</div>
              <div style={{ fontFamily: 'var(--font-body)', fontSize: 11, color: 'rgba(255,255,255,0.6)', marginBottom: 12, lineHeight: 1.4 }}>
                {controlMode === 'autonomous' ? 'Full autonomous intervention — AI mitigates threats without operator confirmation.' : 'Manual command mode — all actions require ground operator sign-off.'}
              </div>
              <div style={{ display: 'flex', gap: 6 }}>
                {(['autonomous', 'manual'] as const).map((mode) => (
                  <button key={mode} onClick={() => setControlMode(mode)} style={{
                    flex: 1, padding: '8px', cursor: 'pointer', transition: 'all 0.2s', borderRadius: 6,
                    background: controlMode === mode ? (mode === 'autonomous' ? 'rgba(155,93,229,0.25)' : 'rgba(0,212,255,0.2)') : 'rgba(0,0,0,0.3)',
                    border: `1px solid ${controlMode === mode ? (mode === 'autonomous' ? '#9b5de5' : '#00d4ff') : 'rgba(255,255,255,0.1)'}`,
                    color: controlMode === mode ? (mode === 'autonomous' ? '#9b5de5' : '#00d4ff') : 'rgba(255,255,255,0.4)',
                    fontFamily: 'var(--font-mono)', fontSize: 9,
                  }}>
                    {mode === 'autonomous' ? '◉ AUTONOMOUS' : '◈ MANUAL'}
                  </button>
                ))}
              </div>
            </div>

            {/* Mitigation Strategy */}
            {isActive && ai.recommendedAction && (
              <div style={{ padding: '16px', background: 'rgba(155,93,229,0.08)', border: '1px solid rgba(155,93,229,0.3)', borderRadius: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#9b5de5', letterSpacing: '0.1em', marginBottom: 8 }}>SELECTED STRATEGY</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#fff', lineHeight: 1.4 }}>
                  {ai.recommendedAction}
                </div>
                
                {ai.actions && ai.actions.length > 0 && (
                  <div style={{ marginTop: 16 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(155,93,229,0.7)', letterSpacing: '0.1em', marginBottom: 8 }}>EXECUTED COMMANDS</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {ai.actions.map((act: any, i: number) => (
                        <div key={i} style={{ padding: '8px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(155,93,229,0.15)', borderRadius: 6, display: 'flex', alignItems: 'flex-start', gap: 10 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: act.validated ? '#00ff88' : '#ff8c00', marginTop: 2 }}>
                            {act.validated ? '✓' : '⧖'}
                          </div>
                          <div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: '#fff', fontWeight: 700 }}>
                              {act.type}
                            </div>
                            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.4)', marginTop: 2 }}>
                              {JSON.stringify(act.params)}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Evidence Channels */}
            {evidenceChannels.length > 0 && (
              <div style={{ padding: '16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.1em', marginBottom: 10 }}>EVIDENCE CHANNELS</div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                  {evidenceChannels.map((ch: string) => (
                    <span key={ch} style={{
                      padding: '3px 8px', borderRadius: 3, fontFamily: 'var(--font-mono)', fontSize: 8.5,
                      background: 'rgba(255,45,85,0.12)', border: '1px solid rgba(255,45,85,0.3)', color: '#ff2d55',
                    }}>
                      {ch.replace(/_/g, ' ').toUpperCase()}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* Active threats */}
            {activeThreats.length > 0 && (
              <div style={{ padding: '16px', background: 'rgba(5,12,25,0.9)', border: '1px solid rgba(255,45,85,0.25)', borderRadius: 10 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#ff2d55', letterSpacing: '0.1em', marginBottom: 10 }}>
                  ACTIVE FAULTS ({activeThreats.length})
                </div>
                {activeThreats.map((t) => (
                  <div key={t.id} style={{ padding: '8px 10px', background: 'rgba(255,45,85,0.07)', border: '1px solid rgba(255,45,85,0.2)', borderRadius: 6, marginBottom: 6 }}>
                    <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, color: '#fff', fontWeight: 700 }}>{t.name}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.45)', marginTop: 2 }}>{t.description}</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#ff2d55', marginTop: 3, letterSpacing: '0.1em' }}>
                      SEVERITY: {t.severity?.toUpperCase?.() ?? 'HIGH'}
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Nominal state */}
            {!isActive && (
              <div style={{ padding: '20px', background: 'rgba(0,255,136,0.04)', border: '1px solid rgba(0,255,136,0.2)', borderRadius: 10, textAlign: 'center' }}>
                <div style={{ fontSize: 28, marginBottom: 8 }}>🛡</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 700, color: '#00ff88' }}>ALL SYSTEMS NOMINAL</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', marginTop: 4 }}>
                  Neural diagnostic kernel monitoring · No anomalies detected
                </div>
              </div>
            )}

            {/* Data source label */}
            <div style={{ padding: '8px 12px', background: 'rgba(0,0,0,0.3)', border: '1px solid rgba(255,255,255,0.06)', borderRadius: 6 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.3)', letterSpacing: '0.1em' }}>
                DATA SOURCE: <span style={{ color: isBackendConnected ? '#9b5de5' : 'rgba(255,255,255,0.4)' }}>
                  {(ai as any).dataSource ?? (isBackendConnected ? 'backend-ai' : 'local-simulation')}
                </span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
