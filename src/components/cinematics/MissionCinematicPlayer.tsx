import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { getMissionCinematic, MissionPhaseDetail } from '../../constants/missionVideos';
import { getAudioPreference, setAudioPreference } from '../../utils/audioPreference';

interface MissionCinematicPlayerProps {
  onComplete: () => void;
  onEnterUniverse?: () => void;
  onEnterMissionControl?: () => void;
}

export function MissionCinematicPlayer({
  onComplete,
  onEnterUniverse,
  onEnterMissionControl,
}: MissionCinematicPlayerProps) {
  const config = useMissionStore((s) => s.config);
  const cinematic = getMissionCinematic(config?.type);

  const [currentPhase, setCurrentPhase] = useState<'launch' | 'deploy' | 'completed'>('launch');
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(() => getAudioPreference());
  const [audioPromptVisible, setAudioPromptVisible] = useState<boolean>(false);
  const [simAltitudeKm, setSimAltitudeKm] = useState<number>(0);
  const [simVelocityKms, setSimVelocityKms] = useState<number>(0);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);

  const launchVideoRef = useRef<HTMLVideoElement | null>(null);
  const deployVideoRef = useRef<HTMLVideoElement | null>(null);

  // Active mission phase details
  const activePhaseData: MissionPhaseDetail = currentPhase === 'launch' ? cinematic.launch : cinematic.deployment;

  // Toggle Sound with session persistence
  const toggleSound = (enable?: boolean) => {
    const nextState = enable !== undefined ? enable : !isAudioEnabled;
    setIsAudioEnabled(nextState);
    setAudioPreference(nextState);
    setAudioPromptVisible(false);

    const activeVideo = currentPhase === 'launch' ? launchVideoRef.current : deployVideoRef.current;
    if (activeVideo) {
      activeVideo.muted = !nextState;
      if (nextState) {
        activeVideo.volume = 0.85; // Clean, non-distorted cinematic volume
        activeVideo.play().catch(() => {
          // If browser rejects unmuting without user click
        });
      }
    }
  };

  // Launch video completes -> transition to deployment
  const handleLaunchEnded = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPhase('deploy');
      setIsTransitioning(false);
      if (deployVideoRef.current) {
        deployVideoRef.current.currentTime = 0;
        deployVideoRef.current.muted = !isAudioEnabled;
        if (isAudioEnabled) deployVideoRef.current.volume = 0.85;
        deployVideoRef.current.play().catch(() => {
          // Fallback if browser requires interaction
          deployVideoRef.current!.muted = true;
          deployVideoRef.current!.play().catch(() => {});
        });
      }
    }, 400);
  }, [isAudioEnabled]);

  // Deployment video completes -> transition to mission environment
  const handleDeployEnded = useCallback(() => {
    setCurrentPhase('completed');
    setTimeout(() => {
      onComplete();
    }, 1200);
  }, [onComplete]);

  // Initial video setup on mount
  useEffect(() => {
    const video = launchVideoRef.current;
    if (video) {
      video.muted = !isAudioEnabled;
      if (isAudioEnabled) video.volume = 0.85;
      video.play().catch(() => {
        // Autoplay policy prevented audio, start muted and show subtle audio toggle
        video.muted = true;
        video.play().catch(() => {});
        if (isAudioEnabled) {
          setAudioPromptVisible(true);
        }
      });
    }
  }, []);

  // Update real-time trajectory simulation telemetry
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.duration) {
      const ratio = video.currentTime / video.duration;
      if (currentPhase === 'launch') {
        const alt = Math.min(650, ratio * 380 + video.currentTime * 10);
        const vel = Math.min(7.8, ratio * 7.4 + 0.4);
        setSimAltitudeKm(Math.round(alt));
        setSimVelocityKms(parseFloat(vel.toFixed(2)));
      } else {
        const alt = 650 + Math.sin(video.currentTime * 0.2) * 5;
        const vel = 7.66 + Math.cos(video.currentTime * 0.1) * 0.04;
        setSimAltitudeKm(Math.round(alt));
        setSimVelocityKms(parseFloat(vel.toFixed(2)));
      }
    }
  };

  const handleSkipSequence = () => {
    if (launchVideoRef.current) launchVideoRef.current.pause();
    if (deployVideoRef.current) deployVideoRef.current.pause();
    onComplete();
  };

  return (
    <div style={{
      position: 'relative',
      width: '100%',
      height: '100%',
      background: '#020409',
      overflow: 'hidden',
      userSelect: 'none',
      color: '#ffffff',
    }}>
      {/* ── 1. Video Layer: Seamless Launch & Deployment Media ── */}
      <div style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        zIndex: 1,
      }}>
        {/* Launch Video Element */}
        <video
          ref={launchVideoRef}
          src={cinematic.launch.videoUrl}
          playsInline
          muted={!isAudioEnabled}
          autoPlay
          controls={false}
          onEnded={handleLaunchEnded}
          onTimeUpdate={handleTimeUpdate}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: currentPhase === 'launch' && !isTransitioning ? 1 : 0,
            transition: 'opacity 0.4s ease-in-out',
            pointerEvents: 'none',
          }}
        />

        {/* Deployment Video Element */}
        <video
          ref={deployVideoRef}
          src={cinematic.deployment.videoUrl}
          playsInline
          muted={!isAudioEnabled}
          controls={false}
          onEnded={handleDeployEnded}
          onTimeUpdate={handleTimeUpdate}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: currentPhase === 'deploy' && !isTransitioning ? 1 : 0,
            transition: 'opacity 0.4s ease-in-out',
            pointerEvents: 'none',
          }}
        />

        {/* Subtle cinematic vignette for text readability */}
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(2,4,9,0.4) 75%, rgba(2,4,9,0.85) 100%)',
          pointerEvents: 'none',
        }} />
        <div style={{
          position: 'absolute',
          inset: 0,
          background: 'linear-gradient(to bottom, rgba(2,4,9,0.6) 0%, transparent 20%, transparent 80%, rgba(2,4,9,0.85) 100%)',
          pointerEvents: 'none',
        }} />
      </div>

      {/* ── 2. Top Bar: Mission Info & Sound Controls ── */}
      <div style={{
        position: 'absolute',
        top: 24,
        left: 24,
        right: 24,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        zIndex: 10,
      }}>
        {/* Mission & Phase Indicator Badge */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: 12,
          padding: '8px 18px',
          background: 'rgba(5, 14, 30, 0.85)',
          backdropFilter: 'blur(12px)',
          border: `1px solid ${cinematic.accentColor}55`,
          borderRadius: 8,
          boxShadow: '0 8px 32px rgba(0,0,0,0.5)',
        }}>
          <div style={{
            width: 8,
            height: 8,
            borderRadius: '50%',
            background: currentPhase === 'launch' ? '#ff9f0a' : '#00ff88',
            boxShadow: `0 0 10px ${currentPhase === 'launch' ? '#ff9f0a' : '#00ff88'}`,
            animation: 'pulse 1.5s infinite ease-in-out',
          }} />
          <div style={{ display: 'flex', flexDirection: 'column' }}>
            <span style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.15em',
              color: 'rgba(255,255,255,0.6)',
            }}>
              MISSION: <strong style={{ color: '#ffffff' }}>{cinematic.title.toUpperCase()}</strong>
            </span>
            <span style={{
              fontFamily: 'var(--font-display, Orbitron, sans-serif)',
              fontSize: 12,
              fontWeight: 800,
              letterSpacing: '0.12em',
              color: cinematic.accentColor,
              marginTop: 2,
            }}>
              PHASE: {currentPhase === 'launch' ? 'LAUNCH / ASCENT' : 'SPACECRAFT DEPLOYMENT'}
            </span>
          </div>
        </div>

        {/* Minimal Audio & Sequence Controls */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          {/* Autoplay Audio Enable Notification Pill if needed */}
          {audioPromptVisible && (
            <button
              onClick={() => toggleSound(true)}
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: '0.12em',
                padding: '8px 16px',
                background: 'rgba(0, 212, 255, 0.25)',
                border: '1px solid #00d4ff',
                borderRadius: 6,
                color: '#00d4ff',
                cursor: 'pointer',
                boxShadow: '0 0 16px rgba(0, 212, 255, 0.3)',
                animation: 'bounce 2s infinite ease-in-out',
              }}
            >
              🔊 CLICK TO ENABLE MISSION AUDIO
            </button>
          )}

          {/* Sound Toggle Button */}
          <button
            onClick={() => toggleSound()}
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              padding: '8px 16px',
              background: isAudioEnabled ? 'rgba(0, 255, 136, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${isAudioEnabled ? '#00ff88' : 'rgba(255,255,255,0.25)'}`,
              borderRadius: 6,
              color: isAudioEnabled ? '#00ff88' : 'rgba(255,255,255,0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
              backdropFilter: 'blur(8px)',
            }}
            title={isAudioEnabled ? 'Mute Mission Audio' : 'Unmute Mission Audio'}
          >
            {isAudioEnabled ? '🔊 SOUND ON' : '🔇 SOUND OFF'}
          </button>
        </div>
      </div>

      {/* ── 3. Bottom Information Panel & Skip Button ── */}
      <div style={{
        position: 'absolute',
        bottom: 28,
        left: 24,
        right: 24,
        display: 'flex',
        alignItems: 'flex-end',
        justifyContent: 'space-between',
        zIndex: 10,
        gap: 20,
      }}>
        {/* Mission Description Card */}
        <div style={{
          maxWidth: 620,
          background: 'rgba(5, 14, 30, 0.88)',
          backdropFilter: 'blur(16px)',
          border: `1px solid ${cinematic.accentColor}44`,
          borderRadius: 10,
          padding: '20px 24px',
          boxShadow: '0 12px 40px rgba(0, 0, 0, 0.7)',
        }}>
          <div style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            marginBottom: 8,
          }}>
            <span style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 9,
              padding: '2px 8px',
              borderRadius: 4,
              background: `${cinematic.accentColor}25`,
              border: `1px solid ${cinematic.accentColor}`,
              color: cinematic.accentColor,
              fontWeight: 700,
              letterSpacing: '0.15em',
            }}>
              {currentPhase === 'launch' ? 'STAGE 1: ASCENT' : 'STAGE 2: ORBITAL DEPLOYMENT'}
            </span>
            <div style={{ width: 1, height: 12, background: 'rgba(255,255,255,0.2)' }} />
            <span style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 9,
              color: 'rgba(255,255,255,0.5)',
              letterSpacing: '0.1em',
            }}>
              ALT: {simAltitudeKm} KM · VEL: {simVelocityKms} KM/S
            </span>
          </div>

          <p style={{
            fontFamily: 'var(--font-body, Space Grotesk, sans-serif)',
            fontSize: 'clamp(12px, 1.2vw, 15px)',
            color: '#ffffff',
            lineHeight: 1.6,
            margin: 0,
            fontWeight: 400,
          }}>
            {activePhaseData.description}
          </p>
        </div>

        {/* Skip Sequence Unobtrusive Button */}
        <button
          onClick={handleSkipSequence}
          style={{
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: '0.14em',
            textTransform: 'uppercase',
            padding: '12px 24px',
            background: 'rgba(5, 14, 30, 0.85)',
            border: '1px solid rgba(255, 255, 255, 0.3)',
            borderRadius: 6,
            color: 'rgba(255, 255, 255, 0.85)',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            backdropFilter: 'blur(8px)',
            whiteSpace: 'nowrap',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
          onMouseEnter={(e) => {
            e.currentTarget.style.borderColor = '#00d4ff';
            e.currentTarget.style.color = '#00d4ff';
            e.currentTarget.style.background = 'rgba(0, 212, 255, 0.15)';
          }}
          onMouseLeave={(e) => {
            e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.3)';
            e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
            e.currentTarget.style.background = 'rgba(5, 14, 30, 0.85)';
          }}
        >
          SKIP SEQUENCE ➔
        </button>
      </div>
    </div>
  );
}
