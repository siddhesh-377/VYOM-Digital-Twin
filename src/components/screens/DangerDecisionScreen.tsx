import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import {
  DangerScenario,
  ResponseOption,
  SimulationExecutionProgress,
  SimulationHistoryRecord,
  DANGER_SCENARIOS_LIBRARY,
} from '../../engines/DangerDecisionEngine';

export const DangerDecisionScreen: React.FC = () => {
  const telemetry = useMissionStore((s) => s.telemetry);
  const config = useMissionStore((s) => s.config);
  const activeThreats = useMissionStore((s) => s.activeThreats);

  // Active scenario & tabs
  const [activeScenario, setActiveScenario] = useState<DangerScenario>(DANGER_SCENARIOS_LIBRARY[0]);
  const [selectedOptionId, setSelectedOptionId] = useState<string>(activeScenario.options[0].id);
  const [activeTab, setActiveTab] = useState<'strategies' | 'decision-tree' | 'history'>('strategies');
  const [viewingWhyOption, setViewingWhyOption] = useState<ResponseOption | null>(null);

  // Branching simulation execution state
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [simProgress, setSimProgress] = useState<SimulationExecutionProgress | null>(null);
  const [historyRecords, setHistoryRecords] = useState<SimulationHistoryRecord[]>([
    {
      id: 'rec-001',
      timestamp: 'T+04:12:30',
      scenarioName: 'Crew Oxygen System Degradation',
      category: 'ECLSS & Crew Life Support',
      selectedOptionKey: 'A',
      selectedOptionName: 'Activate Redundant Cryogenic O2 Supply',
      finalOutcome: 'SUCCESS',
      initialSuccessProb: 88,
      finalHealth: 96.5,
      crewSafetyScore: 98,
      durationSec: 30,
    },
    {
      id: 'rec-002',
      timestamp: 'T+02:18:15',
      scenarioName: 'Battery Bank A Thermal Runaway',
      category: 'Power & Energy Systems',
      selectedOptionKey: 'A',
      selectedOptionName: 'Electrically Isolate Bank A & Divert Glycol',
      finalOutcome: 'SUCCESS',
      initialSuccessProb: 91,
      finalHealth: 94.0,
      crewSafetyScore: 99,
      durationSec: 15,
    },
  ]);

  // Criticality countdown timer
  const [countdownSec, setCountdownSec] = useState<number>(activeScenario.timeToCriticalitySec);

  useEffect(() => {
    setCountdownSec(activeScenario.timeToCriticalitySec);
    setSelectedOptionId(activeScenario.options[0].id);
    setSimProgress(null);
    setIsSimulating(false);
  }, [activeScenario]);

  useEffect(() => {
    if (isSimulating || simProgress?.isComplete) return;
    const timer = setInterval(() => {
      setCountdownSec((prev) => (prev > 0 ? prev - 1 : 0));
    }, 1000);
    return () => clearInterval(timer);
  }, [isSimulating, simProgress]);

  const selectedOption = activeScenario.options.find((o) => o.id === selectedOptionId) || activeScenario.options[0];
  const recommendedOption = activeScenario.options.find((o) => o.isRecommended) || activeScenario.options[0];

  // ─── Execute Branching Simulation ──────────────────────────────────────────
  const handleExecuteSimulation = (opt: ResponseOption) => {
    setIsSimulating(true);
    const steps = [
      {
        stageName: 'STAGE 1/5: Command Dispatch & Hardware Actuation',
        details: `Transmitting real-time command sequence: [${opt.name.substring(0, 40)}…]. Telemetry verification active.`,
        prob: { success: opt.successProbability, partial: Math.max(0, 100 - opt.successProbability - 5), unstable: 3, failure: 2 },
        health: 72,
        hr: 118,
        spo2: 91,
        stress: 78,
      },
      {
        stageName: 'STAGE 2/5: Cross-Subsystem Pressure & Power Transition',
        details: `Subsystem ${activeScenario.affectedSubsystem} responding to commanded state change. Monitoring transient stability.`,
        prob: {
          success: opt.simulatedOutcome === 'SUCCESS' ? opt.successProbability + 4 : opt.successProbability - 10,
          partial: 25,
          unstable: opt.simulatedOutcome === 'UNSTABLE' ? 45 : 8,
          failure: opt.simulatedOutcome === 'FAILURE' ? 40 : 5,
        },
        health: opt.simulatedOutcome === 'SUCCESS' ? 84 : 64,
        hr: opt.simulatedOutcome === 'SUCCESS' ? 102 : 122,
        spo2: opt.simulatedOutcome === 'SUCCESS' ? 94 : 88,
        stress: opt.simulatedOutcome === 'SUCCESS' ? 58 : 84,
      },
      {
        stageName: 'STAGE 3/5: Digital Twin Physiological Feedback Loop',
        details: `Astronaut anatomical digital twin assimilating oxygenation/thermal response. Cardiorespiratory curve updating.`,
        prob: {
          success: opt.simulatedOutcome === 'SUCCESS' ? 92 : opt.successProbability - 15,
          partial: opt.simulatedOutcome === 'PARTIAL SUCCESS' ? 65 : 12,
          unstable: opt.simulatedOutcome === 'UNSTABLE' ? 60 : 4,
          failure: opt.simulatedOutcome === 'FAILURE' ? 65 : 4,
        },
        health: opt.simulatedOutcome === 'SUCCESS' ? 92 : 55,
        hr: opt.simulatedOutcome === 'SUCCESS' ? 86 : 130,
        spo2: opt.simulatedOutcome === 'SUCCESS' ? 97 : 85,
        stress: opt.simulatedOutcome === 'SUCCESS' ? 40 : 90,
      },
      {
        stageName: 'STAGE 4/5: Secondary Load Balancing & Envelope Convergence',
        details: `Thermal, power, and environmental buffers equilibrating across adjacent compartments.`,
        prob: {
          success: opt.simulatedOutcome === 'SUCCESS' ? 96 : 10,
          partial: opt.simulatedOutcome === 'PARTIAL SUCCESS' ? 85 : 8,
          unstable: opt.simulatedOutcome === 'UNSTABLE' ? 78 : 2,
          failure: opt.simulatedOutcome === 'FAILURE' ? 88 : 2,
        },
        health: opt.predictedMetrics.finalHealth - 2,
        hr: opt.predictedMetrics.crewHeartRateBpm + 4,
        spo2: opt.predictedMetrics.crewSpo2Percent - 0.5,
        stress: opt.predictedMetrics.crewStressIndex + 5,
      },
      {
        stageName: 'STAGE 5/5: Monte Carlo Verification & Final Equilibrium',
        details: opt.outcomeNarrative,
        prob: {
          success: opt.simulatedOutcome === 'SUCCESS' ? 98 : 4,
          partial: opt.simulatedOutcome === 'PARTIAL SUCCESS' ? 92 : 6,
          unstable: opt.simulatedOutcome === 'UNSTABLE' ? 86 : 4,
          failure: opt.simulatedOutcome === 'FAILURE' ? 94 : 2,
        },
        health: opt.predictedMetrics.finalHealth,
        hr: opt.predictedMetrics.crewHeartRateBpm,
        spo2: opt.predictedMetrics.crewSpo2Percent,
        stress: opt.predictedMetrics.crewStressIndex,
      },
    ];

    let currentStep = 0;
    const interval = setInterval(() => {
      if (currentStep < steps.length) {
        const s = steps[currentStep];
        setSimProgress({
          step: currentStep + 1,
          totalSteps: steps.length,
          stageName: s.stageName,
          details: s.details,
          elapsedSec: (currentStep + 1) * 1.2,
          probabilityDistribution: s.prob,
          liveSubsystemHealth: s.health,
          liveCrewHeartRate: s.hr,
          liveCrewSpo2: s.spo2,
          liveCrewStress: s.stress,
          isComplete: currentStep === steps.length - 1,
          finalOutcome: currentStep === steps.length - 1 ? opt.simulatedOutcome : undefined,
        });
        currentStep++;
      } else {
        clearInterval(interval);
        setIsSimulating(false);
        // Log to history
        const newRecord: SimulationHistoryRecord = {
          id: `rec-${Date.now().toString().slice(-4)}`,
          timestamp: `T+06:${Math.floor(Math.random() * 50)}:${Math.floor(Math.random() * 50)}`,
          scenarioName: activeScenario.name,
          category: activeScenario.category,
          selectedOptionKey: opt.key,
          selectedOptionName: opt.name,
          finalOutcome: opt.simulatedOutcome,
          initialSuccessProb: opt.successProbability,
          finalHealth: opt.predictedMetrics.finalHealth,
          crewSafetyScore: opt.predictedMetrics.crewSpo2Percent,
          durationSec: parseInt(opt.executionTime) || 30,
        };
        setHistoryRecords((prev) => [newRecord, ...prev]);
      }
    }, 1100);
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        background: 'radial-gradient(ellipse at 50% 20%, #031424 0%, #010712 60%, #000206 100%)',
        paddingBottom: 56,
        overflow: 'hidden',
      }}
    >
      {/* ─── TOP COMMAND & INCIDENT SELECTOR HEADER ─── */}
      <div
        style={{
          padding: '12px 24px',
          borderBottom: '1px solid rgba(255,45,85,0.3)',
          background: 'rgba(6,2,8,0.95)',
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexShrink: 0,
          boxShadow: '0 4px 24px rgba(255,45,85,0.15)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              padding: '4px 10px',
              background: 'rgba(255,45,85,0.2)',
              border: '1px solid #ff2d55',
              borderRadius: 4,
              fontFamily: 'var(--font-display)',
              fontSize: 10,
              fontWeight: 900,
              color: '#ff2d55',
              letterSpacing: '0.15em',
              animation: 'threat-alert 1.2s ease-in-out infinite',
            }}
          >
            ⚠️ DANGER SIMULATION &amp; DECISION SUPPORT
          </div>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 16, fontWeight: 800, color: '#fff', letterSpacing: '0.08em' }}>
              {activeScenario.name}
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.5)' }}>
              AUTOMATIC EMERGENCY DETECTION · MULTI-STRATEGY MONTE CARLO EVALUATION · BRANCHING PREDICTIONS
            </div>
          </div>
        </div>

        {/* Right Header Toolbar: Scenario Switcher & Criticality Countdown */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Emergency Scenario Selector */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, background: 'rgba(0,18,34,0.7)', padding: '4px 10px', borderRadius: 6, border: '1px solid rgba(0,240,255,0.2)' }}>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00f0ff', fontWeight: 700 }}>SELECT INCIDENT:</span>
            <select
              value={activeScenario.id}
              onChange={(e) => {
                const sc = DANGER_SCENARIOS_LIBRARY.find((s) => s.id === e.target.value);
                if (sc) setActiveScenario(sc);
              }}
              style={{
                background: 'rgba(0,0,0,0.6)',
                color: '#fff',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 8.5,
                padding: '3px 8px',
                cursor: 'pointer',
                outline: 'none',
              }}
            >
              {DANGER_SCENARIOS_LIBRARY.map((sc) => (
                <option key={sc.id} value={sc.id}>
                  [{sc.code}] {sc.name}
                </option>
              ))}
            </select>
          </div>

          {/* Time to Criticality Countdown */}
          <div
            style={{
              padding: '6px 12px',
              background: countdownSec < 60 ? 'rgba(255,45,85,0.25)' : 'rgba(255,149,0,0.2)',
              border: `1px solid ${countdownSec < 60 ? '#ff2d55' : '#ff9500'}`,
              borderRadius: 6,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
            }}
          >
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>TIME BEFORE CRITICAL</span>
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 900, color: countdownSec < 60 ? '#ff2d55' : '#ff9500' }}>
              ⏱ T-MINUS {formatSeconds(countdownSec)}
            </span>
          </div>

          {/* Navigation View Mode Tabs */}
          <div style={{ display: 'flex', background: 'rgba(0,18,34,0.6)', padding: 3, borderRadius: 6, border: '1px solid rgba(255,255,255,0.1)' }}>
            {[
              { key: 'strategies', label: 'STRATEGIES & SIM', icon: '⚡' },
              { key: 'decision-tree', label: 'DECISION TREE / WHAT-IF', icon: '🌲' },
              { key: 'history', label: 'HISTORY LOG', icon: '📜' },
            ].map((t) => (
              <button
                key={t.key}
                onClick={() => setActiveTab(t.key as any)}
                style={{
                  padding: '4px 10px',
                  borderRadius: 4,
                  border: 'none',
                  background: activeTab === t.key ? 'rgba(0,240,255,0.25)' : 'transparent',
                  color: activeTab === t.key ? '#00f0ff' : 'rgba(255,255,255,0.5)',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 8.5,
                  fontWeight: 700,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 4,
                }}
              >
                <span>{t.icon}</span> {t.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* ─── MAIN WORKSPACE CONTENT ─── */}
      <div style={{ flex: 1, display: 'flex', overflow: 'hidden' }}>
        {activeTab === 'strategies' && (
          <div style={{ flex: 1, display: 'grid', gridTemplateColumns: '320px 1fr 340px', overflow: 'hidden' }}>
            {/* ─── LEFT COLUMN: INCIDENT TELEMETRY & DIGITAL TWIN MAPPING ─── */}
            <div
              style={{
                borderRight: '1px solid rgba(0,240,255,0.12)',
                background: 'rgba(2,8,18,0.75)',
                padding: '16px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
                overflowY: 'auto',
              }}
            >
              {/* Emergency Status Banner */}
              <div
                style={{
                  padding: '10px 12px',
                  background: 'rgba(255,45,85,0.15)',
                  border: '1px solid #ff2d55',
                  borderRadius: 6,
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 4 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#ff2d55', fontWeight: 700 }}>SEVERITY: {activeScenario.severity}</span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ffcc' }}>{activeScenario.category}</span>
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.75)', lineHeight: 1.4 }}>
                  {activeScenario.description}
                </div>
              </div>

              {/* Affected Target Callout */}
              <div style={{ padding: '10px 12px', background: 'rgba(0,24,44,0.6)', border: '1px solid rgba(0,240,255,0.2)', borderRadius: 6 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00f0ff', marginBottom: 3 }}>AFFECTED DIGITAL TWIN TARGET:</div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                  {activeScenario.affectedSubsystem}
                </div>
                {activeScenario.affectedCrewRegion && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginTop: 4 }}>
                    <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#ff2d55', boxShadow: '0 0 8px #ff2d55' }} />
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#ff2d55', fontWeight: 700 }}>
                      ASTRONAUT REGION: {activeScenario.affectedCrewRegion.toUpperCase()} (RESPIRATORY/PULMONARY)
                    </span>
                  </div>
                )}
              </div>

              {/* Incident Telemetry Snapshot */}
              <div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00f0ff', letterSpacing: '0.12em', marginBottom: 8, fontWeight: 700 }}>
                  EMERGENCY TELEMETRY SNAPSHOT
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                  {activeScenario.telemetrySnapshot.map((t) => {
                    const col = t.status === 'critical' ? '#ff2d55' : t.status === 'warning' ? '#ff9500' : '#00ffcc';
                    return (
                      <div
                        key={t.label}
                        style={{
                          padding: '6px 8px',
                          background: 'rgba(0,14,28,0.5)',
                          borderRadius: 4,
                          border: `1px solid ${col}33`,
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                        }}
                      >
                        <div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.6)' }}>{t.label}</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.3)' }}>NOMINAL: {t.nominal}</div>
                        </div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: col }}>
                          {t.value} <span style={{ fontSize: 7.5, fontWeight: 400 }}>{t.unit}</span>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* Available Consumables & Emergency Buffers */}
              <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 12 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00f0ff', letterSpacing: '0.12em', marginBottom: 8, fontWeight: 700 }}>
                  AVAILABLE VEHICLE RESERVES
                </div>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                  <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>O2 RESERVES</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#00ffcc' }}>
                      {activeScenario.availableResources.o2Kg} kg ({activeScenario.availableResources.o2Percent}%)
                    </div>
                  </div>
                  <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>BATTERY STORAGE</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#ff9500' }}>
                      {activeScenario.availableResources.batteryWh} Wh ({activeScenario.availableResources.batteryPercent}%)
                    </div>
                  </div>
                  <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>RCS PROPELLANT</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#ff2d55' }}>
                      {activeScenario.availableResources.propellantKg} kg
                    </div>
                  </div>
                  <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.3)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.06)' }}>
                    <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>SOLAR GEN</span>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, fontWeight: 700, color: '#00f0ff' }}>
                      {activeScenario.availableResources.powerW} W
                    </div>
                  </div>
                </div>
              </div>
            </div>

            {/* ─── CENTER COLUMN: RESPONSE STRATEGIES & COMPARISON CARDS ─── */}
            <div style={{ padding: '16px 20px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 14 }}>
              {/* AI Highest-Ranked Recommendation Box */}
              <div
                style={{
                  padding: '14px 18px',
                  background: 'linear-gradient(135deg, rgba(0,240,255,0.12) 0%, rgba(0,18,34,0.9) 100%)',
                  border: '1px solid #00f0ff',
                  borderRadius: 8,
                  boxShadow: '0 0 24px rgba(0,240,255,0.2)',
                  position: 'relative',
                }}
              >
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 6 }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{ padding: '3px 8px', background: '#00f0ff', color: '#000', borderRadius: 4, fontFamily: 'var(--font-display)', fontSize: 9, fontWeight: 900 }}>
                      AI TOP RECOMMENDATION
                    </span>
                    <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: '#fff' }}>
                      Option {recommendedOption.key} — {recommendedOption.name}
                    </span>
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ffcc', fontWeight: 700 }}>
                    AI CONFIDENCE: {recommendedOption.simulationConfidence}%
                  </div>
                </div>

                {/* Recommendation Summary Metric Row */}
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8, margin: '10px 0' }}>
                  <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.4)', borderRadius: 4, border: '1px solid rgba(0,255,136,0.3)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.4)' }}>SUCCESS PROBABILITY</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 900, color: '#00ff88' }}>
                      {recommendedOption.successProbability}%
                    </div>
                  </div>
                  <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.4)', borderRadius: 4, border: '1px solid rgba(255,45,85,0.3)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.4)' }}>FAILURE PROBABILITY</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 900, color: '#ff2d55' }}>
                      {recommendedOption.failureProbability}%
                    </div>
                  </div>
                  <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.4)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.4)' }}>ESTIMATED TIME</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#00f0ff' }}>
                      {recommendedOption.executionTime}
                    </div>
                  </div>
                  <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.4)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.4)' }}>ASTRONAUT SAFETY</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, fontWeight: 700, color: '#00ffcc' }}>
                      {recommendedOption.astronautSafetyImpact}
                    </div>
                  </div>
                  <div style={{ padding: '6px 8px', background: 'rgba(0,0,0,0.4)', borderRadius: 4, border: '1px solid rgba(255,255,255,0.1)' }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.4)' }}>PRIMARY RISK</div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#ff9500', lineHeight: 1.2 }}>
                      {recommendedOption.sideEffects.substring(0, 32)}…
                    </div>
                  </div>
                </div>

                {/* Mission Controller Safety Notice */}
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 6 }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.45)' }}>
                    🛡️ AI never automatically executes hazardous actions. Final authorization and execution authority remains with the Mission Controller.
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(0,240,255,0.7)' }}>
                    * AI simulation estimates based on the current simulated mission state
                  </span>
                </div>
              </div>

              {/* 3 to 5 Response Options Cards */}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00f0ff', letterSpacing: '0.15em', fontWeight: 700 }}>
                    GENERATED RESPONSE STRATEGIES ({activeScenario.options.length} OPTIONS)
                  </span>
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>
                    Select an option below to inspect trade-offs and launch branching simulation
                  </span>
                </div>

                {activeScenario.options.map((opt) => {
                  const isSelected = selectedOptionId === opt.id;
                  const isRec = opt.isRecommended;

                  return (
                    <motion.div
                      key={opt.id}
                      whileHover={{ scale: 1.008 }}
                      onClick={() => setSelectedOptionId(opt.id)}
                      style={{
                        padding: '14px 16px',
                        background: isSelected ? 'rgba(0,34,58,0.92)' : 'rgba(0,18,34,0.6)',
                        border: `1px solid ${isSelected ? '#00f0ff' : isRec ? 'rgba(0,240,255,0.4)' : 'rgba(255,255,255,0.08)'}`,
                        borderRadius: 8,
                        boxShadow: isSelected ? '0 0 20px rgba(0,240,255,0.25)' : 'none',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                      }}
                    >
                      {/* Header Row */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 6 }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span
                            style={{
                              width: 22,
                              height: 22,
                              borderRadius: 4,
                              background: isRec ? '#00f0ff' : 'rgba(255,255,255,0.1)',
                              color: isRec ? '#000' : '#fff',
                              fontFamily: 'var(--font-display)',
                              fontSize: 11,
                              fontWeight: 900,
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                            }}
                          >
                            {opt.key}
                          </span>
                          <span style={{ fontFamily: 'var(--font-display)', fontSize: 13, fontWeight: 700, color: isSelected ? '#00f0ff' : '#fff' }}>
                            {opt.name}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#00ff88', fontWeight: 700 }}>
                            SUCCESS: {opt.successProbability}%
                          </span>
                          <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#ff2d55' }}>
                            FAIL: {opt.failureProbability}%
                          </span>
                        </div>
                      </div>

                      {/* Explanation & Objective */}
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.7)', lineHeight: 1.4, marginBottom: 8 }}>
                        {opt.explanation}
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00ffcc', marginBottom: 10 }}>
                        🎯 OBJECTIVE: {opt.expectedObjective}
                      </div>

                      {/* Probability Bar */}
                      <div style={{ marginBottom: 10 }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.4)', marginBottom: 3 }}>
                          <span>SUCCESS ({opt.successProbability}%)</span>
                          <span>FAILURE ({opt.failureProbability}%)</span>
                        </div>
                        <div style={{ width: '100%', height: 5, background: 'rgba(255,45,85,0.4)', borderRadius: 3, overflow: 'hidden' }}>
                          <div style={{ width: `${opt.successProbability}%`, height: '100%', background: 'linear-gradient(90deg, #00ff88, #00d4ff)' }} />
                        </div>
                      </div>

                      {/* Attribute Pills */}
                      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)', gap: 6, marginBottom: 10 }}>
                        <div style={{ padding: '4px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.35)' }}>EXECUTION TIME</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00f0ff', fontWeight: 700 }}>{opt.executionTime}</div>
                        </div>
                        <div style={{ padding: '4px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.35)' }}>ASTRONAUT SAFETY</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00ffcc', fontWeight: 700 }}>{opt.astronautSafetyImpact}</div>
                        </div>
                        <div style={{ padding: '4px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.35)' }}>MISSION IMPACT</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: opt.missionImpact === 'Low' ? '#00ff88' : '#ff9500', fontWeight: 700 }}>{opt.missionImpact}</div>
                        </div>
                        <div style={{ padding: '4px 6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.35)' }}>CONFIDENCE</div>
                          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#9b5de5', fontWeight: 700 }}>{opt.simulationConfidence}%</div>
                        </div>
                      </div>

                      {/* Action Button & Why This Option Trigger */}
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', borderTop: '1px solid rgba(255,255,255,0.06)', paddingTop: 8 }}>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setViewingWhyOption(opt);
                          }}
                          style={{
                            padding: '3px 8px',
                            background: 'transparent',
                            border: '1px solid rgba(0,240,255,0.3)',
                            borderRadius: 4,
                            color: '#00f0ff',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 7.5,
                            cursor: 'pointer',
                          }}
                        >
                          ⚖ WHY THIS OPTION? (AI ANALYSIS)
                        </button>

                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            setSelectedOptionId(opt.id);
                            handleExecuteSimulation(opt);
                          }}
                          disabled={isSimulating}
                          style={{
                            padding: '5px 14px',
                            background: isRec ? '#00f0ff' : 'rgba(0,240,255,0.25)',
                            border: '1px solid #00f0ff',
                            borderRadius: 4,
                            color: isRec ? '#000' : '#fff',
                            fontFamily: 'var(--font-display)',
                            fontSize: 8.5,
                            fontWeight: 900,
                            cursor: isSimulating ? 'wait' : 'pointer',
                            boxShadow: isRec ? '0 0 12px rgba(0,240,255,0.4)' : 'none',
                          }}
                        >
                          {isSimulating && selectedOptionId === opt.id ? 'SIMULATING…' : `EXECUTE DECISION ${opt.key}`}
                        </button>
                      </div>
                    </motion.div>
                  );
                })}
              </div>
            </div>

            {/* ─── RIGHT COLUMN: LIVE BRANCHING SIMULATION MONITOR ─── */}
            <div
              style={{
                borderLeft: '1px solid rgba(0,240,255,0.12)',
                background: 'rgba(2,8,18,0.85)',
                padding: '16px 14px',
                display: 'flex',
                flexDirection: 'column',
                gap: 12,
                overflowY: 'auto',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00f0ff', letterSpacing: '0.15em', fontWeight: 700 }}>
                BRANCHING SIMULATION MONITOR
              </div>

              {simProgress ? (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
                  {/* Stage Header */}
                  <div style={{ padding: '10px 12px', background: 'rgba(0,24,44,0.8)', border: '1px solid rgba(0,240,255,0.3)', borderRadius: 6 }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00f0ff', marginBottom: 2 }}>
                      <span>{simProgress.stageName}</span>
                      <span>{simProgress.step}/{simProgress.totalSteps}</span>
                    </div>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#fff', lineHeight: 1.35, marginTop: 4 }}>
                      {simProgress.details}
                    </div>
                  </div>

                  {/* Outcome Classification Badge */}
                  {simProgress.isComplete && simProgress.finalOutcome && (
                    <motion.div
                      initial={{ scale: 0.9, opacity: 0 }}
                      animate={{ scale: 1, opacity: 1 }}
                      style={{
                        padding: '10px 12px',
                        background:
                          simProgress.finalOutcome === 'SUCCESS'
                            ? 'rgba(0,255,136,0.15)'
                            : simProgress.finalOutcome === 'PARTIAL SUCCESS'
                            ? 'rgba(255,149,0,0.15)'
                            : 'rgba(255,45,85,0.2)',
                        border: `1px solid ${
                          simProgress.finalOutcome === 'SUCCESS' ? '#00ff88' : simProgress.finalOutcome === 'PARTIAL SUCCESS' ? '#ff9500' : '#ff2d55'
                        }`,
                        borderRadius: 6,
                        textAlign: 'center',
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.5)' }}>SIMULATION OUTCOME:</div>
                      <div
                        style={{
                          fontFamily: 'var(--font-display)',
                          fontSize: 16,
                          fontWeight: 900,
                          color:
                            simProgress.finalOutcome === 'SUCCESS'
                              ? '#00ff88'
                              : simProgress.finalOutcome === 'PARTIAL SUCCESS'
                              ? '#ff9500'
                              : '#ff2d55',
                          letterSpacing: '0.1em',
                          margin: '3px 0',
                        }}
                      >
                        {simProgress.finalOutcome}
                      </div>
                    </motion.div>
                  )}

                  {/* Probability Distribution Meters */}
                  <div style={{ padding: '10px 12px', background: 'rgba(0,18,34,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00f0ff', marginBottom: 6 }}>
                      LIVE PROBABILITY DISTRIBUTION
                    </div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
                      {[
                        { label: 'SUCCESS', val: simProgress.probabilityDistribution.success, col: '#00ff88' },
                        { label: 'PARTIAL SUCCESS', val: simProgress.probabilityDistribution.partial, col: '#ff9500' },
                        { label: 'UNSTABLE', val: simProgress.probabilityDistribution.unstable, col: '#ff6b35' },
                        { label: 'FAILURE', val: simProgress.probabilityDistribution.failure, col: '#ff2d55' },
                      ].map((p) => (
                        <div key={p.label}>
                          <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.6)' }}>
                            <span>{p.label}</span>
                            <span style={{ color: p.col, fontWeight: 700 }}>{p.val}%</span>
                          </div>
                          <div style={{ width: '100%', height: 3, background: 'rgba(255,255,255,0.06)', borderRadius: 2 }}>
                            <div style={{ width: `${p.val}%`, height: '100%', background: p.col, borderRadius: 2, transition: 'width 0.4s ease' }} />
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  {/* Simulated Physiological Digital Twin Readings */}
                  <div style={{ padding: '10px 12px', background: 'rgba(0,18,34,0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 6 }}>
                    <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00f0ff', marginBottom: 6 }}>
                      SIMULATED ASTRONAUT PHYSIOLOGICAL RESPONSE
                    </div>
                    <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 6 }}>
                      <div style={{ padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.4)' }}>HEART RATE</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#ff2d55' }}>
                          {simProgress.liveCrewHeartRate} BPM
                        </div>
                      </div>
                      <div style={{ padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.4)' }}>BLOOD SpO2</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#00ffcc' }}>
                          {simProgress.liveCrewSpo2}%
                        </div>
                      </div>
                      <div style={{ padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.4)' }}>STRESS INDEX</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#ff9500' }}>
                          {simProgress.liveCrewStress}/100
                        </div>
                      </div>
                      <div style={{ padding: '6px', background: 'rgba(0,0,0,0.3)', borderRadius: 4 }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 6.5, color: 'rgba(255,255,255,0.4)' }}>SPACECRAFT HEALTH</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#00ff88' }}>
                          {simProgress.liveSubsystemHealth.toFixed(1)}%
                        </div>
                      </div>
                    </div>
                  </div>

                  {/* Contingency Fallback Alert if Strategy Failed */}
                  {simProgress.isComplete && (simProgress.finalOutcome === 'UNSTABLE' || simProgress.finalOutcome === 'FAILURE') && selectedOption.contingencyFallback && (
                    <motion.div
                      initial={{ opacity: 0, y: 8 }}
                      animate={{ opacity: 1, y: 0 }}
                      style={{
                        padding: '10px 12px',
                        background: 'rgba(255,45,85,0.2)',
                        border: '1px solid #ff2d55',
                        borderRadius: 6,
                      }}
                    >
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#ff2d55', fontWeight: 900, marginBottom: 2 }}>
                        🚨 CONTINGENCY REROUTE RECOMMENDED
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: '#fff', lineHeight: 1.3, marginBottom: 6 }}>
                        {selectedOption.contingencyFallback.recommendation}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00ffcc', marginBottom: 6 }}>
                        <span>NEW SUCCESS PROBABILITY: {selectedOption.contingencyFallback.newSuccessProbability}%</span>
                        <span style={{ color: '#ff2d55' }}>NEW FAIL: {selectedOption.contingencyFallback.newFailureProbability}%</span>
                      </div>
                      <button
                        onClick={() => {
                          const fallbackOpt = activeScenario.options[0];
                          setSelectedOptionId(fallbackOpt.id);
                          handleExecuteSimulation(fallbackOpt);
                        }}
                        style={{
                          width: '100%',
                          padding: '5px 10px',
                          background: '#ff2d55',
                          color: '#fff',
                          border: 'none',
                          borderRadius: 4,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 8,
                          fontWeight: 700,
                          cursor: 'pointer',
                        }}
                      >
                        EXECUTE CONTINGENCY FALLBACK NOW
                      </button>
                    </motion.div>
                  )}
                </div>
              ) : (
                <div style={{ padding: '24px 16px', textAlign: 'center', background: 'rgba(0,18,34,0.4)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.06)' }}>
                  <div style={{ fontSize: 24, marginBottom: 8 }}>⚡</div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 11, fontWeight: 700, color: '#fff', marginBottom: 4 }}>
                    READY TO SIMULATE DECISION
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.45)', lineHeight: 1.4, marginBottom: 12 }}>
                    Selected Strategy: <span style={{ color: '#00f0ff' }}>Option {selectedOption.key}</span> ({selectedOption.successProbability}% Success Probability)
                  </div>
                  <button
                    onClick={() => handleExecuteSimulation(selectedOption)}
                    style={{
                      padding: '6px 16px',
                      background: 'rgba(0,240,255,0.2)',
                      border: '1px solid #00f0ff',
                      borderRadius: 4,
                      color: '#00f0ff',
                      fontFamily: 'var(--font-display)',
                      fontSize: 9,
                      fontWeight: 700,
                      cursor: 'pointer',
                      boxShadow: '0 0 12px rgba(0,240,255,0.3)',
                    }}
                  >
                    RUN 5-STAGE BRANCHING SIMULATION
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* ─── TAB 2: DECISION TREE & WHAT-IF COMPARISON ─── */}
        {activeTab === 'decision-tree' && (
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: '#00f0ff', letterSpacing: '0.1em', marginBottom: 4 }}>
                WHAT-IF SIMULATION &amp; DECISION TREE COMPARATOR
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.5)' }}>
                Compare multiple command decisions side-by-side before committing. Evaluate diverging timelines and resource drains.
              </div>
            </div>

            {/* Visual Decision Tree Vector Canvas */}
            <div style={{ background: 'rgba(3,14,28,0.7)', borderRadius: 8, border: '1px solid rgba(0,240,255,0.2)', padding: 16 }}>
              <svg viewBox="0 0 1000 360" style={{ width: '100%', height: 'auto', maxHeight: 360 }}>
                {/* Root Node: Emergency */}
                <g transform="translate(40, 140)">
                  <rect width={160} height={80} rx={6} fill="rgba(255,45,85,0.2)" stroke="#ff2d55" strokeWidth={1.5} />
                  <text x={80} y={24} textAnchor="middle" fill="#ff2d55" fontFamily="var(--font-display)" fontSize="9" fontWeight="900">
                    EMERGENCY TRIGGER
                  </text>
                  <text x={80} y={42} textAnchor="middle" fill="#fff" fontFamily="var(--font-mono)" fontSize="8" fontWeight="700">
                    {activeScenario.code}
                  </text>
                  <text x={80} y={60} textAnchor="middle" fill="rgba(255,255,255,0.6)" fontFamily="var(--font-mono)" fontSize="7">
                    Critical in {formatSeconds(activeScenario.timeToCriticalitySec)}
                  </text>
                </g>

                {/* Branches to Options */}
                {activeScenario.options.map((opt, i) => {
                  const targetY = 50 + i * 110;
                  const isSelected = selectedOptionId === opt.id;
                  const col = opt.isRecommended ? '#00ff88' : opt.successProbability > 50 ? '#00d4ff' : '#ff2d55';

                  return (
                    <g key={opt.id}>
                      {/* Connecting Line */}
                      <path
                        d={`M 200 180 C 260 180, 260 ${targetY + 40}, 320 ${targetY + 40}`}
                        fill="none"
                        stroke={isSelected ? '#00f0ff' : 'rgba(255,255,255,0.2)'}
                        strokeWidth={isSelected ? 2.5 : 1}
                        strokeDasharray={isSelected ? 'none' : '4,4'}
                      />

                      {/* Option Node */}
                      <g
                        transform={`translate(320, ${targetY})`}
                        onClick={() => setSelectedOptionId(opt.id)}
                        style={{ cursor: 'pointer' }}
                      >
                        <rect
                          width={280}
                          height={80}
                          rx={6}
                          fill={isSelected ? 'rgba(0,34,58,0.95)' : 'rgba(0,18,34,0.7)'}
                          stroke={isSelected ? '#00f0ff' : col}
                          strokeWidth={isSelected ? 2 : 1}
                        />
                        <text x={12} y={22} fill={col} fontFamily="var(--font-display)" fontSize="9" fontWeight="900">
                          OPTION {opt.key}: {opt.name.substring(0, 32)}…
                        </text>
                        <text x={12} y={40} fill="rgba(255,255,255,0.7)" fontFamily="var(--font-mono)" fontSize="7.5">
                          Success: {opt.successProbability}% | Fail: {opt.failureProbability}% | Time: {opt.executionTime}
                        </text>
                        <text x={12} y={58} fill="rgba(255,255,255,0.5)" fontFamily="var(--font-mono)" fontSize="7">
                          Safety: {opt.astronautSafetyImpact} | Impact: {opt.missionImpact}
                        </text>
                        {opt.isRecommended && (
                          <rect x={200} y={10} width={68} height={14} rx={3} fill="#00ff88" opacity={0.2} stroke="#00ff88" />
                        )}
                        {opt.isRecommended && (
                          <text x={234} y={20} textAnchor="middle" fill="#00ff88" fontFamily="var(--font-mono)" fontSize="6.5" fontWeight="700">
                            ★ RECOMMENDED
                          </text>
                        )}
                      </g>

                      {/* Outcome Branch */}
                      <path
                        d={`M 600 ${targetY + 40} L 680 ${targetY + 40}`}
                        fill="none"
                        stroke={col}
                        strokeWidth={1.5}
                      />

                      {/* Predicted Outcome Node */}
                      <g transform={`translate(680, ${targetY})`}>
                        <rect
                          width={260}
                          height={80}
                          rx={6}
                          fill="rgba(0,0,0,0.5)"
                          stroke={opt.simulatedOutcome === 'SUCCESS' ? '#00ff88' : opt.simulatedOutcome === 'PARTIAL SUCCESS' ? '#ff9500' : '#ff2d55'}
                          strokeWidth={1}
                        />
                        <text
                          x={12}
                          y={22}
                          fill={opt.simulatedOutcome === 'SUCCESS' ? '#00ff88' : opt.simulatedOutcome === 'PARTIAL SUCCESS' ? '#ff9500' : '#ff2d55'}
                          fontFamily="var(--font-display)"
                          fontSize="9"
                          fontWeight="900"
                        >
                          OUTCOME: {opt.simulatedOutcome}
                        </text>
                        <text x={12} y={40} fill="rgba(255,255,255,0.8)" fontFamily="var(--font-mono)" fontSize="7">
                          Final Health: {opt.predictedMetrics.finalHealth}% | SpO2: {opt.predictedMetrics.crewSpo2Percent}%
                        </text>
                        <text x={12} y={56} fill="rgba(255,255,255,0.6)" fontFamily="var(--font-mono)" fontSize="7">
                          Delay: +{opt.predictedMetrics.timelineDelayMin}m | HR: {opt.predictedMetrics.crewHeartRateBpm} BPM
                        </text>
                      </g>
                    </g>
                  );
                })}
              </svg>
            </div>

            {/* Side-by-Side Strategy Comparison Table */}
            <div style={{ background: 'rgba(0,18,34,0.6)', borderRadius: 8, border: '1px solid rgba(255,255,255,0.08)', padding: 14 }}>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#00f0ff', letterSpacing: '0.12em', marginBottom: 10, fontWeight: 700 }}>
                SIDE-BY-SIDE METRICS COMPARISON
              </div>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontFamily: 'var(--font-mono)', fontSize: 8 }}>
                <thead>
                  <tr style={{ borderBottom: '1px solid rgba(0,240,255,0.2)', color: 'rgba(255,255,255,0.5)', textAlign: 'left' }}>
                    <th style={{ padding: '8px' }}>OPTION</th>
                    <th style={{ padding: '8px' }}>SUCCESS PROB</th>
                    <th style={{ padding: '8px' }}>EXECUTION TIME</th>
                    <th style={{ padding: '8px' }}>CREW SAFETY</th>
                    <th style={{ padding: '8px' }}>PREDICTED HEALTH</th>
                    <th style={{ padding: '8px' }}>CONSUMABLES DRAIN</th>
                    <th style={{ padding: '8px' }}>ACTION</th>
                  </tr>
                </thead>
                <tbody>
                  {activeScenario.options.map((opt) => (
                    <tr
                      key={opt.id}
                      style={{
                        borderBottom: '1px solid rgba(255,255,255,0.04)',
                        background: selectedOptionId === opt.id ? 'rgba(0,240,255,0.1)' : 'transparent',
                      }}
                    >
                      <td style={{ padding: '8px', color: '#fff', fontWeight: 700 }}>
                        Option {opt.key} — {opt.name.substring(0, 30)}…
                      </td>
                      <td style={{ padding: '8px', color: '#00ff88', fontWeight: 700 }}>{opt.successProbability}%</td>
                      <td style={{ padding: '8px', color: '#00f0ff' }}>{opt.executionTime}</td>
                      <td style={{ padding: '8px', color: '#00ffcc' }}>{opt.astronautSafetyImpact}</td>
                      <td style={{ padding: '8px', color: '#00ff88' }}>{opt.predictedMetrics.finalHealth}%</td>
                      <td style={{ padding: '8px', color: 'rgba(255,255,255,0.6)' }}>
                        O2: {opt.predictedMetrics.o2ConsumptionKg}kg / Batt: {opt.predictedMetrics.batteryConsumptionWh}Wh
                      </td>
                      <td style={{ padding: '8px' }}>
                        <button
                          onClick={() => {
                            setSelectedOptionId(opt.id);
                            setActiveTab('strategies');
                            handleExecuteSimulation(opt);
                          }}
                          style={{
                            padding: '4px 8px',
                            background: 'rgba(0,240,255,0.2)',
                            border: '1px solid #00f0ff',
                            borderRadius: 4,
                            color: '#00f0ff',
                            fontFamily: 'var(--font-mono)',
                            fontSize: 7.5,
                            cursor: 'pointer',
                          }}
                        >
                          TEST DECISION
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}

        {/* ─── TAB 3: SIMULATION HISTORY & LESSONS LEARNED ─── */}
        {activeTab === 'history' && (
          <div style={{ flex: 1, padding: '20px 24px', overflowY: 'auto', display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-display)', fontSize: 15, fontWeight: 800, color: '#00f0ff', letterSpacing: '0.1em', marginBottom: 4 }}>
                SIMULATION INCIDENT HISTORY &amp; BLACK BOX DECISION ARCHIVE
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.5)' }}>
                Immutable audit trail of detected emergencies, selected commander responses, simulated outcomes, and lessons learned.
              </div>
            </div>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {historyRecords.map((rec) => {
                const col = rec.finalOutcome === 'SUCCESS' ? '#00ff88' : rec.finalOutcome === 'PARTIAL SUCCESS' ? '#ff9500' : '#ff2d55';
                return (
                  <div
                    key={rec.id}
                    style={{
                      padding: '12px 16px',
                      background: 'rgba(0,18,34,0.6)',
                      border: `1px solid ${col}44`,
                      borderRadius: 6,
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                    }}
                  >
                    <div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 2 }}>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.4)' }}>{rec.timestamp}</span>
                        <span style={{ fontFamily: 'var(--font-display)', fontSize: 12, fontWeight: 700, color: '#fff' }}>
                          {rec.scenarioName}
                        </span>
                        <span style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00f0ff' }}>[{rec.category}]</span>
                      </div>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.6)' }}>
                        Action: <span style={{ color: '#fff' }}>Option {rec.selectedOptionKey} — {rec.selectedOptionName}</span>
                      </div>
                    </div>

                    <div style={{ display: 'flex', gap: 16, alignItems: 'center' }}>
                      <div style={{ textAlign: 'right' }}>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7, color: 'rgba(255,255,255,0.4)' }}>HEALTH / SAFETY</div>
                        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: '#00ffcc', fontWeight: 700 }}>
                          {rec.finalHealth}% / {rec.crewSafetyScore}%
                        </div>
                      </div>

                      <div
                        style={{
                          padding: '4px 10px',
                          borderRadius: 4,
                          background: `${col}22`,
                          border: `1px solid ${col}`,
                          color: col,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 9,
                          fontWeight: 900,
                        }}
                      >
                        {rec.finalOutcome}
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>

      {/* ─── MODAL: "WHY THIS OPTION?" DETAILED AI RATIONALE ─── */}
      <AnimatePresence>
        {viewingWhyOption && (
          <div
            style={{
              position: 'fixed',
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              background: 'rgba(0,4,12,0.85)',
              backdropFilter: 'blur(8px)',
              zIndex: 2000,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              padding: 20,
            }}
          >
            <motion.div
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              style={{
                width: '100%',
                maxWidth: 600,
                background: '#041224',
                border: '1px solid #00f0ff',
                borderRadius: 8,
                padding: 20,
                boxShadow: '0 0 40px rgba(0,240,255,0.3)',
                display: 'flex',
                flexDirection: 'column',
                gap: 14,
              }}
            >
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start' }}>
                <div>
                  <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: '#00f0ff' }}>
                    WHY OPTION {viewingWhyOption.key}? — AI DECISION ANALYSIS
                  </div>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.6)' }}>
                    {viewingWhyOption.name}
                  </div>
                </div>
                <button
                  onClick={() => setViewingWhyOption(null)}
                  style={{ background: 'transparent', border: 'none', color: '#fff', fontSize: 16, cursor: 'pointer' }}
                >
                  ✕
                </button>
              </div>

              {/* Rationale Narrative */}
              <div style={{ padding: '10px 12px', background: 'rgba(0,24,44,0.7)', borderRadius: 6, border: '1px solid rgba(0,240,255,0.2)' }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00f0ff', marginBottom: 3 }}>RANKING RATIONALE:</div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: '#fff', lineHeight: 1.4 }}>
                  {viewingWhyOption.whyThisOption.rankingRationale}
                </div>
              </div>

              {/* Positive Factors & Trade-offs */}
              <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 10 }}>
                <div style={{ padding: '10px 12px', background: 'rgba(0,255,136,0.06)', border: '1px solid rgba(0,255,136,0.3)', borderRadius: 6 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#00ff88', fontWeight: 700, marginBottom: 6 }}>
                    ✓ KEY POSITIVE FACTORS
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                    {viewingWhyOption.whyThisOption.positiveFactors.map((f, i) => (
                      <li key={i}>{f}</li>
                    ))}
                  </ul>
                </div>

                <div style={{ padding: '10px 12px', background: 'rgba(255,45,85,0.06)', border: '1px solid rgba(255,45,85,0.3)', borderRadius: 6 }}>
                  <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: '#ff2d55', fontWeight: 700, marginBottom: 6 }}>
                    ⚠ RISK TRADE-OFFS
                  </div>
                  <ul style={{ margin: 0, paddingLeft: 16, fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.8)', lineHeight: 1.4 }}>
                    {viewingWhyOption.whyThisOption.riskTradeoffs.map((r, i) => (
                      <li key={i}>{r}</li>
                    ))}
                  </ul>
                </div>
              </div>

              <button
                onClick={() => {
                  setSelectedOptionId(viewingWhyOption.id);
                  setViewingWhyOption(null);
                  handleExecuteSimulation(viewingWhyOption);
                }}
                style={{
                  padding: '8px',
                  background: '#00f0ff',
                  color: '#000',
                  border: 'none',
                  borderRadius: 4,
                  fontFamily: 'var(--font-display)',
                  fontSize: 9.5,
                  fontWeight: 900,
                  cursor: 'pointer',
                }}
              >
                COMMIT &amp; SIMULATE OPTION {viewingWhyOption.key}
              </button>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
};

export default DangerDecisionScreen;
