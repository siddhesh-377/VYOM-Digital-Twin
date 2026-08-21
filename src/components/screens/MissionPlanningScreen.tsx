import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';

export const MissionPlanningScreen: React.FC = () => {
  const { missionPhase, milestones, rulDays } = useMissionStore();
  const [objectives, setObjectives] = useState<string[]>([
    'Launch preparation',
    'Orbit insertion',
    'System deployment'
  ]);
  const [newObjective, setNewObjective] = useState('');

  const handleAddObjective = (e: React.FormEvent) => {
    e.preventDefault();
    if (newObjective.trim()) {
      setObjectives([...objectives, newObjective.trim()]);
      setNewObjective('');
    }
  };

  return (
    <div style={{
      backgroundColor: '#020409',
      color: '#ffffff',
      fontFamily: 'var(--font-mono), monospace',
      minHeight: '100vh',
      padding: '2rem'
    }}>
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
      >
        <h1 style={{ fontFamily: 'var(--font-display), sans-serif', color: '#00d4ff', marginBottom: '2rem', letterSpacing: '0.05em' }}>
          MISSION PLANNING
        </h1>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(300px, 1fr))', gap: '2rem' }}>
          {/* Status Panel */}
          <div style={{
            border: '1px solid rgba(0, 212, 255, 0.3)',
            padding: '1.5rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 212, 255, 0.05)',
            boxShadow: '0 0 15px rgba(0, 212, 255, 0.1)'
          }}>
            <h2 style={{ color: '#00ff88', marginBottom: '1.5rem', fontSize: '1.25rem', textTransform: 'uppercase' }}>
              Current Status
            </h2>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              <span>Phase:</span>
              <span style={{ color: '#00d4ff', fontWeight: 'bold' }}>{missionPhase || 'UNKNOWN'}</span>
            </div>
            <div style={{ marginBottom: '1rem', display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.1)', paddingBottom: '0.5rem' }}>
              <span>Remaining Useful Life:</span>
              <span style={{ color: '#00ff88', fontWeight: 'bold' }}>{rulDays ?? '--'} days</span>
            </div>
            
            <h3 style={{ marginTop: '2rem', marginBottom: '1rem', color: '#00ff88', fontSize: '1.1rem', textTransform: 'uppercase' }}>
              Milestones
            </h3>
            <ul style={{ listStyleType: 'none', padding: 0 }}>
              {milestones && milestones.length > 0 ? (
                milestones.map((milestone: any, index: number) => (
                  <li key={index} style={{ 
                    marginBottom: '0.75rem', 
                    borderLeft: '2px solid #00d4ff', 
                    paddingLeft: '1rem',
                    backgroundColor: 'rgba(255,255,255,0.02)',
                    padding: '0.5rem 0.5rem 0.5rem 1rem'
                  }}>
                    <div style={{ fontWeight: 'bold', color: '#fff' }}>{milestone.name}</div>
                    <div style={{ fontSize: '0.85em', color: 'rgba(255,255,255,0.6)' }}>Status: {milestone.status}</div>
                  </li>
                ))
              ) : (
                <li style={{ color: 'rgba(255,255,255,0.5)' }}>No milestones recorded.</li>
              )}
            </ul>
          </div>

          {/* Objectives Panel */}
          <div style={{
            border: '1px solid rgba(0, 255, 136, 0.3)',
            padding: '1.5rem',
            borderRadius: '8px',
            backgroundColor: 'rgba(0, 255, 136, 0.05)',
            boxShadow: '0 0 15px rgba(0, 255, 136, 0.1)'
          }}>
            <h2 style={{ color: '#00d4ff', marginBottom: '1.5rem', fontSize: '1.25rem', textTransform: 'uppercase' }}>
              Mission Objectives
            </h2>
            <ul style={{ listStyleType: 'none', padding: 0, marginBottom: '2rem' }}>
              {objectives.map((obj, i) => (
                <motion.li 
                  key={i}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.1 }}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    marginBottom: '0.75rem',
                    padding: '0.75rem',
                    backgroundColor: 'rgba(255,255,255,0.05)',
                    borderRadius: '4px',
                    border: '1px solid rgba(255,255,255,0.1)'
                  }}
                >
                  <span style={{ 
                    display: 'inline-block',
                    width: '8px',
                    height: '8px',
                    borderRadius: '50%',
                    backgroundColor: '#00ff88',
                    marginRight: '1rem',
                    boxShadow: '0 0 8px #00ff88'
                  }}></span>
                  {obj}
                </motion.li>
              ))}
            </ul>

            <form onSubmit={handleAddObjective} style={{ display: 'flex', gap: '0.5rem' }}>
              <input 
                type="text" 
                value={newObjective}
                onChange={(e) => setNewObjective(e.target.value)}
                placeholder="Add new objective..."
                style={{
                  flex: 1,
                  background: 'rgba(0,0,0,0.5)',
                  border: '1px solid rgba(0, 212, 255, 0.5)',
                  color: '#fff',
                  padding: '0.75rem',
                  fontFamily: 'inherit',
                  borderRadius: '4px',
                  outline: 'none'
                }}
                onFocus={(e) => e.target.style.borderColor = '#00d4ff'}
                onBlur={(e) => e.target.style.borderColor = 'rgba(0, 212, 255, 0.5)'}
              />
              <button 
                type="submit"
                style={{
                  background: 'rgba(0, 212, 255, 0.2)',
                  border: '1px solid #00d4ff',
                  color: '#00d4ff',
                  padding: '0 1.5rem',
                  cursor: 'pointer',
                  fontFamily: 'inherit',
                  fontWeight: 'bold',
                  borderRadius: '4px',
                  transition: 'all 0.2s ease'
                }}
                onMouseOver={(e) => {
                  e.currentTarget.style.background = '#00d4ff';
                  e.currentTarget.style.color = '#020409';
                }}
                onMouseOut={(e) => {
                  e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)';
                  e.currentTarget.style.color = '#00d4ff';
                }}
              >
                ADD
              </button>
            </form>
          </div>
        </div>
      </motion.div>
    </div>
  );
};
