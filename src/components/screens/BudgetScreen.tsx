import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';

function calcLifetime(budget: number, type: string): { lifetime: number; reliability: number; reserve: number; riskLevel: string } {
  // VYOM Simulation Engine estimates
  const baseLifetimes: Record<string, number> = {
    orbital: 7, planetary: 10, human: 1.5, astrophysics: 12,
  };
  const base = baseLifetimes[type] || 7;
  const budgetFactor = Math.log10(Math.max(budget, 10)) / Math.log10(1000);
  const lifetime = parseFloat((base * (0.6 + budgetFactor * 0.9)).toFixed(1));
  const reliability = parseFloat(Math.min(99.4, 78 + budgetFactor * 18).toFixed(1));
  const reserve = parseFloat(Math.min(98, 65 + budgetFactor * 26).toFixed(1));
  const riskLevel = budget < 50 ? 'HIGH' : budget < 150 ? 'MEDIUM' : budget < 500 ? 'LOW' : 'VERY LOW';
  return { lifetime, reliability, reserve, riskLevel };
}

const PRESETS = [50, 150, 250, 500, 850, 1200];

export function BudgetScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const config = useMissionStore((s) => s.config);
  const setMissionConfig = useMissionStore((s) => s.setMissionConfig);
  const setEstimates = useMissionStore((s) => s.setEstimates);

  const [budget, setBudget] = useState(config?.budgetCrore && config.budgetCrore > 0 ? config.budgetCrore : 250);
  const estimates = calcLifetime(budget, config?.type ?? 'orbital');

  const handleProceed = useCallback(() => {
    if (!config) return;
    setMissionConfig({ ...config, budgetCrore: budget });
    setEstimates(estimates.lifetime, estimates.reliability, estimates.reserve);
    setScreen('launch');
  }, [budget, config, estimates, setEstimates, setMissionConfig, setScreen]);

  const sliderPct = Math.min(100, Math.max(0, (budget / 1500) * 100));

  const riskColor = estimates.riskLevel === 'HIGH' ? 'var(--critical)'
    : estimates.riskLevel === 'MEDIUM' ? 'var(--warning)'
    : estimates.riskLevel === 'LOW' ? 'var(--nominal)'
    : '#00d4ff';

  return (
    <div style={{
      width: '100%', height: '100%', overflowY: 'auto',
      background: '#020409',
      display: 'flex', flexDirection: 'column', alignItems: 'center',
      padding: '40px 24px 80px 24px',
    }}>
      {/* Stars background */}
      <div style={{
        position: 'fixed', inset: 0, pointerEvents: 'none',
        background: 'radial-gradient(ellipse at 70% 30%, rgba(0,212,255,0.03) 0%, transparent 60%)',
      }} />

      {/* Header */}
      <motion.div initial={{ opacity: 0, y: -20 }} animate={{ opacity: 1, y: 0 }} style={{ textAlign: 'center', marginBottom: 36 }}>
        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.25em', color: 'rgba(0,212,255,0.6)', marginBottom: 8 }}>
          STEP 03 OF 05 · BUDGET &amp; LIFETIME ESTIMATION
        </div>
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(22px, 4vw, 36px)', fontWeight: 700, color: '#fff', letterSpacing: '0.08em' }}>
          ALLOCATE MISSION BUDGET
        </h1>
        <p style={{ marginTop: 8, color: 'rgba(255,255,255,0.5)', fontSize: 13 }}>
          Target Spacecraft: <span style={{ color: '#00d4ff', fontFamily: 'var(--font-mono)' }}>{config?.name ?? 'CUSTOM-MISSION'}</span> · Category: <span style={{ color: '#00ff88', textTransform: 'uppercase', fontFamily: 'var(--font-mono)' }}>{config?.type ?? 'ORBITAL'}</span>
        </p>
      </motion.div>

      <motion.div
        initial={{ opacity: 0, y: 20 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
        style={{ width: '100%', maxWidth: 720 }}
      >
        {/* Budget display */}
        <div style={{
          textAlign: 'center', marginBottom: 36, padding: '24px',
          background: 'rgba(5,15,30,0.8)', border: '1px solid rgba(0,212,255,0.2)',
          borderRadius: 14,
        }}>
          <div style={{ fontFamily: 'var(--font-mono)', fontSize: 10, letterSpacing: '0.2em', color: 'rgba(255,255,255,0.4)', marginBottom: 8 }}>
            PROGRAM BUDGET ALLOCATION (INR CRORES)
          </div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 64px)', fontWeight: 900, color: '#00d4ff', lineHeight: 1 }}>
              ₹
            </span>
            <input
              type="number"
              min={10}
              max={2500}
              value={budget}
              onChange={(e) => setBudget(Math.max(10, Math.min(2500, Number(e.target.value) || 10)))}
              style={{
                fontFamily: 'var(--font-display)', fontSize: 'clamp(36px, 6vw, 64px)',
                fontWeight: 900, color: '#00d4ff',
                background: 'transparent', border: 'none',
                borderBottom: '2px solid rgba(0,212,255,0.4)',
                textAlign: 'center', width: '220px', outline: 'none',
              }}
            />
            <span style={{ fontFamily: 'var(--font-display)', fontSize: 'clamp(24px, 4vw, 40px)', fontWeight: 700, color: 'rgba(0,212,255,0.7)' }}>
              Cr
            </span>
          </div>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 10,
            color: 'rgba(255,255,255,0.3)', marginTop: 8,
            letterSpacing: '0.08em',
          }}>
            Approx. ${((budget * 10) / 83.5).toFixed(1)} Million USD · Simulation Factor: {sliderPct.toFixed(0)}%
          </div>
        </div>

        {/* Slider */}
        <div style={{ marginBottom: 28, padding: '0 4px' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.35)' }}>
            <span>₹10 Cr (Micro)</span>
            <span>₹500 Cr (Standard)</span>
            <span>₹1,500 Cr (Flagship)</span>
          </div>
          <input
            type="range" min={10} max={1500} step={10} value={budget}
            onChange={(e) => setBudget(Number(e.target.value))}
            style={{
              width: '100%', height: '8px', appearance: 'none', background: 'rgba(255,255,255,0.1)',
              borderRadius: 4, cursor: 'pointer', outline: 'none',
            }}
          />
        </div>

        {/* Presets */}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 32, flexWrap: 'wrap' }}>
          {PRESETS.map((p) => (
            <button
              key={p}
              onClick={() => setBudget(p)}
              style={{
                fontFamily: 'var(--font-mono)', fontSize: 11, letterSpacing: '0.08em',
                padding: '8px 16px',
                background: budget === p ? 'rgba(0,212,255,0.2)' : 'rgba(5,15,30,0.7)',
                border: `1px solid ${budget === p ? '#00d4ff' : 'rgba(255,255,255,0.1)'}`,
                borderRadius: 6, color: budget === p ? '#00d4ff' : 'rgba(255,255,255,0.6)',
                cursor: 'pointer', transition: 'all 0.2s',
              }}
            >
              ₹{p} Cr
            </button>
          ))}
        </div>

        {/* Simulation Estimates Grid */}
        <div style={{
          background: 'rgba(5,15,30,0.85)', border: '1px solid rgba(0,212,255,0.15)',
          borderRadius: 12, padding: '24px 28px', marginBottom: 28,
        }}>
          <div style={{
            fontFamily: 'var(--font-mono)', fontSize: 9, letterSpacing: '0.15em',
            color: 'rgba(0,212,255,0.6)', marginBottom: 20,
            display: 'flex', alignItems: 'center', gap: 8,
          }}>
            <span style={{ width: 6, height: 6, borderRadius: '50%', background: '#00d4ff', display: 'inline-block' }} />
            VYOM SIMULATION ENGINE · DERIVED MISSION METRICS
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(140px, 1fr))', gap: 20 }}>
            {[
              { label: 'PROJECTED LIFETIME', value: `${estimates.lifetime} YRS`, sub: `${config?.type?.toUpperCase() ?? 'ORBITAL'} BUS` },
              { label: 'SUCCESS RELIABILITY', value: `${estimates.reliability}%`, sub: 'MISSION INTEGRITY' },
              { label: 'RESOURCE RESERVE', value: `${estimates.reserve}%`, sub: 'POWER & FUEL MARGIN' },
              { label: 'RISK PROFILE', value: <span style={{ color: riskColor }}>{estimates.riskLevel}</span>, sub: 'MISSION RISK CLASS' },
            ].map(({ label, value, sub }) => (
              <div key={label} style={{ padding: '12px', background: 'rgba(0,0,0,0.3)', borderRadius: 6 }}>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, letterSpacing: '0.12em', color: 'rgba(255,255,255,0.35)', marginBottom: 4 }}>
                  {label}
                </div>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, fontWeight: 700, color: '#fff', lineHeight: 1.1 }}>
                  {value}
                </div>
                <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8, color: 'rgba(255,255,255,0.25)', marginTop: 4 }}>
                  {sub}
                </div>
              </div>
            ))}
          </div>

          {/* Lifecycle Bar */}
          <div style={{ marginTop: 24 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.35)', marginBottom: 6 }}>
              <span>MISSION LIFECYCLE HORIZON</span>
              <span style={{ color: '#00d4ff' }}>{estimates.lifetime} YEARS OPERATIONAL</span>
            </div>
            <div style={{ display: 'flex', gap: 3, alignItems: 'flex-end', height: 28 }}>
              {Array.from({ length: 24 }, (_, i) => {
                const fraction = i / 24;
                const active = fraction <= (estimates.lifetime / 15);
                return (
                  <div key={i} style={{
                    flex: 1, height: active ? `${30 + fraction * 70}%` : '20%',
                    background: active ? '#00d4ff' : 'rgba(255,255,255,0.08)',
                    borderRadius: 2,
                    transition: 'all 0.3s ease',
                  }} />
                );
              })}
            </div>
          </div>
        </div>

        {/* Navigation buttons */}
        <div style={{ display: 'flex', gap: 12 }}>
          <button
            onClick={() => setScreen('onboarding')}
            style={{
              padding: '14px 24px',
              background: 'rgba(255,255,255,0.05)',
              border: '1px solid rgba(255,255,255,0.15)',
              borderRadius: 6, color: 'rgba(255,255,255,0.6)',
              fontFamily: 'var(--font-mono)', fontSize: 11, cursor: 'pointer',
            }}
          >
            ← BACK TO IDENTITY
          </button>
          <button onClick={handleProceed} className="btn btn-primary btn-lg" style={{ flex: 1 }}>
            CHOOSE LAUNCH LOCATION (STEP 04) →
          </button>
        </div>
      </motion.div>
    </div>
  );
}
