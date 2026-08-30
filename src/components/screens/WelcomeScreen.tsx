import React, { useRef, useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import type { MissionType } from '../../types/mission';
import { MISSION_PROFILES } from '../../types/missionProfiles';
import { MISSION_CINEMATICS } from '../../constants/missionVideos';

export function WelcomeScreen() {
  const setScreen = useMissionStore((s) => s.setScreen);
  const startMission = useMissionStore((s) => s.startMission);
  const setMissionProfile = useMissionStore((s) => s.setMissionProfile);

  const [activeTab, setActiveTab] = useState<'overview' | 'vision' | 'missions'>('overview');
  const [selectedPreviewMission, setSelectedPreviewMission] = useState<MissionType>('human');
  const videoRef = useRef<HTMLVideoElement | null>(null);

  // Ensure video plays smoothly
  useEffect(() => {
    if (videoRef.current) {
      videoRef.current.playbackRate = 1.0;
      videoRef.current.play().catch(() => {
        // Autoplay policy fallback
      });
    }
  }, []);

  const handleBeginMission = (missionType?: MissionType) => {
    if (missionType) {
      setMissionProfile(missionType);
    }
    setScreen('onboarding');
  };

  const handleQuickStart = (missionType?: MissionType) => {
    if (missionType) {
      setMissionProfile(missionType);
    }
    startMission();
    setScreen('mission-control');
  };

  return (
    <div style={{
      width: '100%',
      height: '100%',
      position: 'relative',
      background: '#020409',
      overflowX: 'hidden',
      overflowY: 'auto',
      userSelect: 'none',
      scrollBehavior: 'smooth',
      color: '#ffffff',
    }}>
      {/* ── 1. Hero Background Video: Rotating Earth ── */}
      <div style={{
        position: 'fixed',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
        overflow: 'hidden',
        pointerEvents: 'none',
      }}>
        <video
          ref={videoRef}
          src="/animations/Landing page rotating earth.mp4"
          autoPlay
          loop
          muted
          playsInline
          controls={false}
          style={{
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            objectPosition: 'center',
            display: 'block',
          }}
        />
        {/* Subtle dark radial & linear overlay for maximum text sharpness & contrast */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, rgba(2,4,9,0.3) 0%, rgba(2,4,9,0.7) 65%, rgba(2,4,9,0.95) 100%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(2,4,9,0.5) 0%, transparent 25%, transparent 75%, rgba(2,4,9,0.95) 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── 2. Top Status Bar / Header ── */}
      <header style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: 64,
        zIndex: 20,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: '0 28px',
        background: 'rgba(2, 6, 14, 0.75)',
        backdropFilter: 'blur(12px)',
        borderBottom: '1px solid rgba(0, 212, 255, 0.15)',
      }}>
        {/* Brand */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{
            fontFamily: 'var(--font-display, Orbitron, sans-serif)',
            fontSize: 20,
            fontWeight: 900,
            letterSpacing: '0.18em',
            color: '#00d4ff',
            textShadow: '0 0 16px rgba(0,212,255,0.4)',
          }}>
            VYOM
          </div>
          <div style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9,
            padding: '2px 8px',
            borderRadius: 4,
            background: 'rgba(0, 255, 136, 0.12)',
            border: '1px solid rgba(0, 255, 136, 0.3)',
            color: '#00ff88',
            letterSpacing: '0.1em',
            fontWeight: 600,
          }}>
            DIGITAL TWIN v2.2
          </div>
        </div>

        {/* Navigation Tabs */}
        <div style={{ display: 'flex', gap: 8 }}>
          {[
            { id: 'overview', label: 'OVERVIEW' },
            { id: 'vision', label: 'VISION & OBJECTIVE' },
            { id: 'missions', label: 'MISSION PROFILES' },
          ].map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              style={{
                background: activeTab === tab.id ? 'rgba(0, 212, 255, 0.18)' : 'transparent',
                border: activeTab === tab.id ? '1px solid #00d4ff' : '1px solid transparent',
                borderRadius: 6,
                padding: '6px 14px',
                color: activeTab === tab.id ? '#00d4ff' : 'rgba(255, 255, 255, 0.65)',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 10,
                fontWeight: 600,
                letterSpacing: '0.12em',
                cursor: 'pointer',
                transition: 'all 0.2s ease',
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* Action Header Button */}
        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => setScreen('universe')}
            style={{
              padding: '7px 16px',
              background: 'rgba(255, 255, 255, 0.06)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 6,
              color: '#ffffff',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              fontWeight: 600,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
          >
            🌌 UNIVERSE
          </button>
          <button
            onClick={() => handleBeginMission()}
            style={{
              padding: '7px 18px',
              background: 'rgba(0, 212, 255, 0.15)',
              border: '1.5px solid #00d4ff',
              borderRadius: 6,
              color: '#00d4ff',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              boxShadow: '0 0 15px rgba(0, 212, 255, 0.25)',
              transition: 'all 0.2s',
            }}
          >
            LAUNCH MISSION →
          </button>
        </div>
      </header>

      {/* ── 3. Main Hero Content Container ── */}
      <main style={{
        position: 'relative',
        zIndex: 10,
        minHeight: '100vh',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: '100px 24px 80px',
        maxWidth: 1200,
        margin: '0 auto',
      }}>
        {/* Active Tab View */}
        <AnimatePresence mode="wait">
          {activeTab === 'overview' && (
            <motion.div
              key="overview"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5, ease: 'easeOut' }}
              style={{
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                textAlign: 'center',
                width: '100%',
              }}
            >
              {/* Badge */}
              <div style={{
                display: 'inline-flex',
                alignItems: 'center',
                gap: 10,
                padding: '6px 18px',
                borderRadius: 20,
                background: 'rgba(5, 14, 30, 0.8)',
                backdropFilter: 'blur(8px)',
                border: '1px solid rgba(0, 212, 255, 0.3)',
                marginBottom: 24,
                boxShadow: '0 0 20px rgba(0, 212, 255, 0.15)',
              }}>
                <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88', boxShadow: '0 0 8px #00ff88' }} />
                <span style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 10,
                  fontWeight: 600,
                  letterSpacing: '0.2em',
                  color: '#00d4ff',
                }}>
                  AUTONOMOUS DIGITAL TWIN PLATFORM
                </span>
              </div>

              {/* Main VYOM Heading */}
              <h1 style={{
                fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                fontSize: 'clamp(52px, 10vw, 110px)',
                fontWeight: 900,
                letterSpacing: '0.12em',
                lineHeight: 1,
                margin: 0,
                color: '#ffffff',
                textShadow: '0 0 40px rgba(0,212,255,0.4), 0 0 80px rgba(0,212,255,0.2)',
                position: 'relative',
              }}>
                VYOM
                <div style={{
                  position: 'absolute',
                  bottom: -8,
                  left: '50%',
                  transform: 'translateX(-50%)',
                  width: '50%',
                  height: 3,
                  background: 'linear-gradient(90deg, transparent, #00d4ff, transparent)',
                  boxShadow: '0 0 12px #00d4ff',
                }} />
              </h1>

              {/* Subtitle Verbatim */}
              <h2 style={{
                fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                fontSize: 'clamp(14px, 2.2vw, 22px)',
                fontWeight: 600,
                letterSpacing: '0.15em',
                color: '#00d4ff',
                textTransform: 'uppercase',
                marginTop: 24,
                marginBottom: 16,
                maxWidth: 900,
                lineHeight: 1.4,
                textShadow: '0 0 20px rgba(0,212,255,0.3)',
              }}>
                Intelligent Digital Space Mission Twin &amp; Autonomous Mission Control
              </h2>

              {/* Short Description Verbatim */}
              <p style={{
                fontFamily: 'var(--font-body, Space Grotesk, sans-serif)',
                fontSize: 'clamp(13px, 1.4vw, 17px)',
                color: 'rgba(255, 255, 255, 0.85)',
                lineHeight: 1.7,
                maxWidth: 780,
                margin: '0 0 36px',
                textShadow: '0 2px 8px rgba(0,0,0,0.8)',
              }}>
                Observe, analyze and simulate spacecraft missions through a real-time digital representation of mission systems, telemetry and trajectories.
              </p>

              {/* Call to Actions */}
              <div style={{
                display: 'flex',
                gap: 16,
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                marginBottom: 48,
              }}>
                <button
                  onClick={() => handleBeginMission()}
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    padding: '16px 36px',
                    background: 'rgba(0, 212, 255, 0.18)',
                    border: '1.5px solid #00d4ff',
                    borderRadius: 8,
                    color: '#00d4ff',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    boxShadow: '0 0 30px rgba(0, 212, 255, 0.3)',
                    backdropFilter: 'blur(8px)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 212, 255, 0.3)';
                    e.currentTarget.style.boxShadow = '0 0 45px rgba(0, 212, 255, 0.5)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(0, 212, 255, 0.18)';
                    e.currentTarget.style.boxShadow = '0 0 30px rgba(0, 212, 255, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  CREATE MISSION →
                </button>

                <button
                  onClick={() => handleQuickStart('human')}
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 13,
                    fontWeight: 700,
                    letterSpacing: '0.16em',
                    textTransform: 'uppercase',
                    padding: '16px 32px',
                    background: 'rgba(255, 255, 255, 0.08)',
                    border: '1px solid rgba(255, 255, 255, 0.3)',
                    borderRadius: 8,
                    color: '#ffffff',
                    cursor: 'pointer',
                    transition: 'all 0.25s ease',
                    backdropFilter: 'blur(8px)',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.15)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.6)';
                    e.currentTarget.style.transform = 'translateY(-2px)';
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
                    e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
                    e.currentTarget.style.transform = 'translateY(0)';
                  }}
                >
                  QUICK LAUNCH DEMO 🚀
                </button>
              </div>

              {/* Live Orbital Metric Strip */}
              <div style={{
                display: 'flex',
                gap: 32,
                alignItems: 'center',
                justifyContent: 'center',
                flexWrap: 'wrap',
                background: 'rgba(5, 12, 25, 0.85)',
                backdropFilter: 'blur(12px)',
                padding: '12px 28px',
                borderRadius: 10,
                border: '1px solid rgba(0, 212, 255, 0.2)',
                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.5)',
              }}>
                {[
                  { label: 'SIMULATION ENGINE', value: '10 HZ DIGITAL TWIN' },
                  { label: 'MISSION HORIZON', value: '365 DAYS' },
                  { label: 'SPACECRAFT PROFILES', value: '4 ARCHITECTURES' },
                  { label: 'AI GUARDIAN', value: 'AUTONOMOUS RECOVERY' },
                ].map(({ label, value }) => (
                  <div key={label} style={{ textAlign: 'center' }}>
                    <div style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 8.5,
                      letterSpacing: '0.15em',
                      color: 'rgba(255, 255, 255, 0.45)',
                      marginBottom: 3,
                    }}>
                      {label}
                    </div>
                    <div style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 11,
                      letterSpacing: '0.1em',
                      color: '#00d4ff',
                      fontWeight: 700,
                    }}>
                      {value}
                    </div>
                  </div>
                ))}
              </div>
            </motion.div>
          )}

          {/* Vision & Objective Tab */}
          {activeTab === 'vision' && (
            <motion.div
              key="vision"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 28,
                maxWidth: 960,
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 12 }}>
                <h3 style={{
                  fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: '#00d4ff',
                  margin: 0,
                }}>
                  STRATEGIC FOUNDATION
                </h3>
                <p style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '0.1em',
                  marginTop: 6,
                }}>
                  VYOM AEROSPACE DIGITAL TWIN FRAMEWORK
                </p>
              </div>

              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))', gap: 24 }}>
                {/* VISION CARD */}
                <div style={{
                  background: 'rgba(5, 14, 30, 0.85)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(0, 212, 255, 0.35)',
                  borderRadius: 12,
                  padding: '28px 24px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,212,255,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'rgba(0,212,255,0.15)',
                      border: '1px solid #00d4ff',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      🔭
                    </div>
                    <div>
                      <h4 style={{
                        fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                        fontSize: 18,
                        fontWeight: 800,
                        letterSpacing: '0.15em',
                        color: '#00d4ff',
                        margin: 0,
                      }}>
                        VISION
                      </h4>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                        MISSION HORIZON
                      </div>
                    </div>
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-body, Space Grotesk, sans-serif)',
                    fontSize: 15,
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: 1.7,
                    margin: 0,
                  }}>
                    "To create an intelligent digital mission environment where spacecraft, telemetry, trajectories and mission events converge into one continuously evolving digital twin."
                  </p>
                </div>

                {/* OBJECTIVE CARD */}
                <div style={{
                  background: 'rgba(5, 14, 30, 0.85)',
                  backdropFilter: 'blur(16px)',
                  border: '1px solid rgba(0, 255, 136, 0.35)',
                  borderRadius: 12,
                  padding: '28px 24px',
                  boxShadow: '0 12px 40px rgba(0,0,0,0.6), inset 0 0 30px rgba(0,255,136,0.06)',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 16,
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                    <div style={{
                      width: 36, height: 36, borderRadius: 8,
                      background: 'rgba(0,255,136,0.15)',
                      border: '1px solid #00ff88',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontSize: 18,
                    }}>
                      🎯
                    </div>
                    <div>
                      <h4 style={{
                        fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                        fontSize: 18,
                        fontWeight: 800,
                        letterSpacing: '0.15em',
                        color: '#00ff88',
                        margin: 0,
                      }}>
                        OBJECTIVE
                      </h4>
                      <div style={{ fontFamily: 'var(--font-mono)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.1em' }}>
                        OPERATIONAL IMPACT
                      </div>
                    </div>
                  </div>
                  <p style={{
                    fontFamily: 'var(--font-body, Space Grotesk, sans-serif)',
                    fontSize: 15,
                    color: 'rgba(255, 255, 255, 0.9)',
                    lineHeight: 1.7,
                    margin: 0,
                  }}>
                    "To help mission teams monitor spacecraft health, understand anomalies, predict mission behavior and evaluate decisions through real-time visualization, analytics and simulation."
                  </p>
                </div>
              </div>

              {/* Bottom return CTA */}
              <div style={{ textAlign: 'center', marginTop: 12 }}>
                <button
                  onClick={() => setActiveTab('missions')}
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 11,
                    fontWeight: 700,
                    letterSpacing: '0.15em',
                    padding: '12px 28px',
                    background: 'rgba(0, 212, 255, 0.12)',
                    border: '1px solid #00d4ff',
                    borderRadius: 6,
                    color: '#00d4ff',
                    cursor: 'pointer',
                  }}
                >
                  EXPLORE MISSION ARCHITECTURES →
                </button>
              </div>
            </motion.div>
          )}

          {/* Mission Profiles Tab */}
          {activeTab === 'missions' && (
            <motion.div
              key="missions"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              transition={{ duration: 0.5 }}
              style={{
                width: '100%',
                display: 'flex',
                flexDirection: 'column',
                gap: 20,
                maxWidth: 1080,
              }}
            >
              <div style={{ textAlign: 'center', marginBottom: 6 }}>
                <h3 style={{
                  fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                  fontSize: 26,
                  fontWeight: 800,
                  letterSpacing: '0.12em',
                  color: '#00d4ff',
                  margin: 0,
                }}>
                  FOUR MISSION PROFILES
                </h3>
                <p style={{
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 11,
                  color: 'rgba(255,255,255,0.5)',
                  letterSpacing: '0.1em',
                  marginTop: 4,
                }}>
                  EACH ARCHITECTURE HAS DEDICATED CINEMATICS, SPACECRAFT 3D TWIN &amp; TELEMETRY DYNAMICS
                </p>
              </div>

              {/* 4 Cards Grid */}
              <div style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))',
                gap: 16,
              }}>
                {(['human', 'orbital', 'planetary', 'astrophysics'] as MissionType[]).map((type) => {
                  const c = MISSION_CINEMATICS[type];
                  const p = MISSION_PROFILES[type];
                  const isSel = selectedPreviewMission === type;
                  const icon = type === 'human' ? '👨‍🚀' : type === 'orbital' ? '🛰' : type === 'planetary' ? '🪐' : '🔭';
                  return (
                    <div
                      key={type}
                      onClick={() => setSelectedPreviewMission(type)}
                      style={{
                        background: isSel ? 'rgba(5, 20, 42, 0.9)' : 'rgba(5, 12, 25, 0.75)',
                        backdropFilter: 'blur(12px)',
                        border: `1.5px solid ${isSel ? c.accentColor : 'rgba(255,255,255,0.1)'}`,
                        borderRadius: 10,
                        padding: '18px 16px',
                        cursor: 'pointer',
                        transition: 'all 0.25s ease',
                        boxShadow: isSel ? `0 0 25px ${c.accentColor}33` : 'none',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                      }}
                    >
                      <div>
                        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
                          <span style={{ fontSize: 24 }}>{icon}</span>
                          <span style={{
                            fontFamily: 'var(--font-mono)',
                            fontSize: 8,
                            padding: '2px 6px',
                            borderRadius: 3,
                            background: `${c.accentColor}22`,
                            border: `1px solid ${c.accentColor}`,
                            color: c.accentColor,
                            fontWeight: 700,
                          }}>
                            {c.modelType.toUpperCase().replace('_', ' ')}
                          </span>
                        </div>
                        <h4 style={{
                          fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                          fontSize: 14,
                          fontWeight: 700,
                          color: '#fff',
                          margin: '0 0 6px',
                          letterSpacing: '0.05em',
                        }}>
                          {c.title}
                        </h4>
                        <p style={{
                          fontFamily: 'var(--font-body)',
                          fontSize: 11,
                          color: 'rgba(255,255,255,0.7)',
                          lineHeight: 1.5,
                          margin: '0 0 12px',
                        }}>
                          {p?.description || c.subtitle}
                        </p>
                      </div>

                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleBeginMission(type);
                        }}
                        style={{
                          width: '100%',
                          padding: '8px 0',
                          background: `${c.accentColor}22`,
                          border: `1px solid ${c.accentColor}`,
                          borderRadius: 6,
                          color: c.accentColor,
                          fontFamily: 'var(--font-mono)',
                          fontSize: 10,
                          fontWeight: 700,
                          letterSpacing: '0.1em',
                          cursor: 'pointer',
                          transition: 'all 0.2s',
                        }}
                      >
                        SELECT &amp; LAUNCH →
                      </button>
                    </div>
                  );
                })}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </main>

      {/* ── 4. Bottom Footer ── */}
      <footer style={{
        position: 'relative',
        zIndex: 20,
        padding: '16px 32px',
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        background: 'rgba(2, 6, 14, 0.85)',
        backdropFilter: 'blur(12px)',
        borderTop: '1px solid rgba(0, 212, 255, 0.1)',
        fontFamily: 'var(--font-mono, monospace)',
        fontSize: 9,
        color: 'rgba(255, 255, 255, 0.4)',
        letterSpacing: '0.1em',
      }}>
        <div>VYOM SIMULATION ENGINE · GROUNDED AEROSPACE INTELLIGENCE</div>
        <div style={{ display: 'flex', gap: 16 }}>
          <span>LATENCY: 12 MS</span>
          <span>WEBSOCKET: 10 HZ</span>
          <span>MISSION CLOCK: SINGLE SOURCE OF TRUTH</span>
        </div>
      </footer>
    </div>
  );
}
