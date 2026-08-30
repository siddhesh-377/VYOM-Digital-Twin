/**
 * VYOM — Mission Launch & Deployment Cinematic Screen
 * Plays high-resolution launching & deployment animations with phase descriptions,
 * GSAP scroll storytelling transitions, and seamless handoff into the Universe environment.
 */

import React, { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { MissionCinematicPlayer } from '../cinematics/MissionCinematicPlayer';
import { MissionStorytellingScroll } from '../cinematics/MissionStorytellingScroll';

export function LaunchSequenceScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const config = useMissionStore((s) => s.config);
  const [viewMode, setViewMode] = useState<'cinematic' | 'story'>('cinematic');

  // Transition into Universe / Digital Twin
  const handleTransitionToUniverse = () => {
    setScreen('universe');
  };

  const handleTransitionToMissionControl = () => {
    setScreen('mission-control');
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#020409',
        overflow: 'hidden',
      }}
    >
      {/* Top Mode Selector Ribbon */}
      <div
        style={{
          position: 'absolute',
          top: 14,
          left: 20,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          background: 'rgba(5, 12, 28, 0.85)',
          border: '1px solid rgba(0, 212, 255, 0.25)',
          borderRadius: 20,
          padding: '4px 6px',
          backdropFilter: 'blur(10px)',
        }}
      >
        <button
          onClick={() => setViewMode('cinematic')}
          style={{
            padding: '5px 12px',
            background: viewMode === 'cinematic' ? 'rgba(0, 212, 255, 0.25)' : 'transparent',
            border: `1px solid ${viewMode === 'cinematic' ? '#00d4ff' : 'transparent'}`,
            borderRadius: 14,
            color: viewMode === 'cinematic' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          🎬 CINEMATIC PLAYER
        </button>

        <button
          onClick={() => setViewMode('story')}
          style={{
            padding: '5px 12px',
            background: viewMode === 'story' ? 'rgba(0, 212, 255, 0.25)' : 'transparent',
            border: `1px solid ${viewMode === 'story' ? '#00d4ff' : 'transparent'}`,
            borderRadius: 14,
            color: viewMode === 'story' ? '#ffffff' : 'rgba(255, 255, 255, 0.5)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9,
            fontWeight: 700,
            letterSpacing: '0.08em',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
          }}
        >
          📜 STORY SCROLL
        </button>
      </div>

      {/* Main View Renderer */}
      <AnimatePresence mode="wait">
        {viewMode === 'cinematic' ? (
          <motion.div
            key="cinematic"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ width: '100%', height: '100%' }}
          >
            <MissionCinematicPlayer
              onComplete={handleTransitionToUniverse}
              onEnterUniverse={handleTransitionToUniverse}
              onEnterMissionControl={handleTransitionToMissionControl}
            />
          </motion.div>
        ) : (
          <motion.div
            key="story"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.3 }}
            style={{ width: '100%', height: '100%' }}
          >
            <MissionStorytellingScroll
              onComplete={handleTransitionToUniverse}
              onEnterUniverse={handleTransitionToUniverse}
              onEnterMissionControl={handleTransitionToMissionControl}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
