import React, { useState, useEffect, useRef, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { useMissionStore } from '../../store/missionStore';
import { getMissionCinematic, MissionPhaseDetail } from '../../constants/missionVideos';

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
  const [isPlaying, setIsPlaying] = useState<boolean>(true);
  const [isMuted, setIsMuted] = useState<boolean>(true);
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [progress, setProgress] = useState<number>(0);
  const [currentTimeStr, setCurrentTimeStr] = useState<string>('00:00');
  const [durationStr, setDurationStr] = useState<string>('00:00');
  const [videoError, setVideoError] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState<boolean>(false);
  const [autoplayBlocked, setAutoplayBlocked] = useState<boolean>(false);
  const [simAltitudeKm, setSimAltitudeKm] = useState<number>(0);
  const [simVelocityKms, setSimVelocityKms] = useState<number>(0);

  const launchVideoRef = useRef<HTMLVideoElement | null>(null);
  const deployVideoRef = useRef<HTMLVideoElement | null>(null);
  const activePhaseData: MissionPhaseDetail = currentPhase === 'launch' ? cinematic.launch : cinematic.deployment;

  // Formatting helper
  const formatTime = (secs: number) => {
    if (isNaN(secs) || secs < 0) return '00:00';
    const m = Math.floor(secs / 60);
    const s = Math.floor(secs % 60);
    return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
  };

  // Switch video to deployment when launch video completes
  const handleLaunchEnded = useCallback(() => {
    setIsTransitioning(true);
    setTimeout(() => {
      setCurrentPhase('deploy');
      setIsTransitioning(false);
      if (deployVideoRef.current) {
        deployVideoRef.current.currentTime = 0;
        deployVideoRef.current.playbackRate = playbackSpeed;
        deployVideoRef.current.play().catch(() => {
          setAutoplayBlocked(true);
        });
      }
    }, 450);
  }, [playbackSpeed]);

  // When deployment finishes, mark completed and offer handoff
  const handleDeployEnded = useCallback(() => {
    setCurrentPhase('completed');
    // Brief cinematic pause then trigger handoff
    setTimeout(() => {
      onComplete();
    }, 1800);
  }, [onComplete]);

  // Manage video speed changes
  useEffect(() => {
    if (launchVideoRef.current) launchVideoRef.current.playbackRate = playbackSpeed;
    if (deployVideoRef.current) deployVideoRef.current.playbackRate = playbackSpeed;
  }, [playbackSpeed]);

  // Manage mute/unmute
  useEffect(() => {
    if (launchVideoRef.current) launchVideoRef.current.muted = isMuted;
    if (deployVideoRef.current) deployVideoRef.current.muted = isMuted;
  }, [isMuted]);

  // Attempt initial playback of launch video
  useEffect(() => {
    if (launchVideoRef.current) {
      launchVideoRef.current.playbackRate = playbackSpeed;
      launchVideoRef.current.muted = true; // start muted to comply with browser policies
      launchVideoRef.current
        .play()
        .then(() => {
          setIsPlaying(true);
          setAutoplayBlocked(false);
        })
        .catch(() => {
          setAutoplayBlocked(true);
          setIsPlaying(false);
        });
    }
  }, []);

  // Update telemetry and progress indicator
  const handleTimeUpdate = (e: React.SyntheticEvent<HTMLVideoElement>) => {
    const video = e.currentTarget;
    if (video.duration) {
      const p = (video.currentTime / video.duration) * 100;
      setProgress(p);
      setCurrentTimeStr(formatTime(video.currentTime));
      setDurationStr(formatTime(video.duration));

      // Aesthetic real-time telemetry simulation along the trajectory
      if (currentPhase === 'launch') {
        const alt = Math.min(650, (video.currentTime / video.duration) * 350 + (video.currentTime * 12));
        const vel = Math.min(7.8, (video.currentTime / video.duration) * 7.5 + 0.3);
        setSimAltitudeKm(Math.round(alt));
        setSimVelocityKms(parseFloat(vel.toFixed(2)));
      } else {
        const alt = 650 + Math.sin(video.currentTime * 0.2) * 5;
        const vel = 7.66 + Math.cos(video.currentTime * 0.1) * 0.05;
        setSimAltitudeKm(Math.round(alt));
        setSimVelocityKms(parseFloat(vel.toFixed(2)));
      }
    }
  };

  const handlePlayPause = () => {
    const activeVideo = currentPhase === 'launch' ? launchVideoRef.current : deployVideoRef.current;
    if (!activeVideo) return;

    if (activeVideo.paused) {
      activeVideo.play().then(() => {
        setIsPlaying(true);
        setAutoplayBlocked(false);
      }).catch(() => {
        setAutoplayBlocked(true);
      });
    } else {
      activeVideo.pause();
      setIsPlaying(false);
    }
  };

  const handleSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const activeVideo = currentPhase === 'launch' ? launchVideoRef.current : deployVideoRef.current;
    if (!activeVideo || !activeVideo.duration) return;

    const rect = e.currentTarget.getBoundingClientRect();
    const pos = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width));
    activeVideo.currentTime = pos * activeVideo.duration;
  };

  const handleSkipToNextPhase = () => {
    if (currentPhase === 'launch') {
      if (launchVideoRef.current) launchVideoRef.current.pause();
      handleLaunchEnded();
    } else {
      if (deployVideoRef.current) deployVideoRef.current.pause();
      handleDeployEnded();
    }
  };

  return (
    <div
      style={{
        width: '100%',
        height: '100%',
        position: 'relative',
        background: '#020409',
        overflow: 'hidden',
        userSelect: 'none',
        display: 'flex',
        flexDirection: 'column',
      }}
    >
      {/* ── Background Video Layers ── */}
      <div style={{ position: 'absolute', inset: 0, zIndex: 1, overflow: 'hidden' }}>
        {/* Launch Video Element */}
        <video
          ref={launchVideoRef}
          src={cinematic.launch.videoUrl}
          playsInline
          muted={isMuted}
          preload="metadata"
          onTimeUpdate={currentPhase === 'launch' ? handleTimeUpdate : undefined}
          onEnded={handleLaunchEnded}
          onError={() => setVideoError(`Unable to decode launch video: ${cinematic.launch.videoUrl}`)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: currentPhase === 'launch' && !isTransitioning ? 1 : 0,
            filter: isTransitioning ? 'blur(10px) brightness(0.7)' : 'none',
            transition: 'opacity 0.6s ease, filter 0.6s ease',
            pointerEvents: 'none',
          }}
        />

        {/* Deployment Video Element (Preloaded) */}
        <video
          ref={deployVideoRef}
          src={cinematic.deployment.videoUrl}
          playsInline
          muted={isMuted}
          preload="auto"
          onTimeUpdate={currentPhase === 'deploy' ? handleTimeUpdate : undefined}
          onEnded={handleDeployEnded}
          onError={() => setVideoError(`Unable to decode deployment video: ${cinematic.deployment.videoUrl}`)}
          style={{
            position: 'absolute',
            inset: 0,
            width: '100%',
            height: '100%',
            objectFit: 'cover',
            opacity: currentPhase === 'deploy' && !isTransitioning ? 1 : 0,
            filter: isTransitioning ? 'blur(10px) brightness(0.7)' : 'none',
            transition: 'opacity 0.6s ease, filter 0.6s ease',
            pointerEvents: 'none',
          }}
        />
      </div>

      {/* Cinematic Sci-Fi Vignette & Subtle Grid Overlay */}
      <div
        style={{
          position: 'absolute',
          inset: 0,
          pointerEvents: 'none',
          zIndex: 2,
          background: 'radial-gradient(ellipse at center, transparent 40%, rgba(2,4,9,0.45) 75%, rgba(2,4,9,0.92) 100%)',
        }}
      />
      <div
        className="scan-overlay"
        style={{ position: 'absolute', inset: 0, pointerEvents: 'none', zIndex: 2, opacity: 0.5 }}
      />

      {/* Corner HUD framing brackets */}
      {['tl', 'tr', 'bl', 'br'].map((pos) => (
        <div
          key={pos}
          style={{
            position: 'absolute',
            top: pos.startsWith('t') ? 16 : 'auto',
            bottom: pos.startsWith('b') ? 16 : 'auto',
            left: pos.endsWith('l') ? 16 : 'auto',
            right: pos.endsWith('r') ? 16 : 'auto',
            width: 28,
            height: 28,
            borderTop: pos.startsWith('t') ? `2px solid ${cinematic.accentColor}` : 'none',
            borderBottom: pos.startsWith('b') ? `2px solid ${cinematic.accentColor}` : 'none',
            borderLeft: pos.endsWith('l') ? `2px solid ${cinematic.accentColor}` : 'none',
            borderRight: pos.endsWith('r') ? `2px solid ${cinematic.accentColor}` : 'none',
            pointerEvents: 'none',
            zIndex: 4,
            opacity: 0.75,
          }}
        />
      ))}

      {/* ── Top Header Ribbon: Mission Identity & Phase Stepper ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 24px',
          background: 'linear-gradient(180deg, rgba(2,6,15,0.9) 0%, rgba(2,6,15,0.4) 70%, transparent 100%)',
          backdropFilter: 'blur(8px)',
        }}
      >
        {/* Left: Mission Title & Target */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <div
            style={{
              width: 10,
              height: 10,
              borderRadius: '50%',
              background: cinematic.accentColor,
              boxShadow: `0 0 12px ${cinematic.accentColor}`,
            }}
          />
          <div>
            <div
              style={{
                fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                fontSize: 14,
                fontWeight: 800,
                color: '#ffffff',
                letterSpacing: '0.15em',
                lineHeight: 1.1,
              }}
            >
              {config?.name || cinematic.title}
            </div>
            <div
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9,
                color: 'rgba(255,255,255,0.5)',
                letterSpacing: '0.12em',
                marginTop: 2,
              }}
            >
              {cinematic.subtitle.toUpperCase()} · {config?.destination || 'EARTH ORBIT'}
            </div>
          </div>
        </div>

        {/* Center: Phase Stepper Badge */}
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: 12,
            background: 'rgba(5, 12, 28, 0.75)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 20,
            padding: '6px 16px',
          }}
        >
          {/* Phase 1: Launch */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: currentPhase === 'launch' ? cinematic.accentColor : '#00ff88',
                boxShadow: currentPhase === 'launch' ? `0 0 8px ${cinematic.accentColor}` : 'none',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: currentPhase === 'launch' ? '#ffffff' : 'rgba(255,255,255,0.45)',
              }}
            >
              01 LAUNCH
            </span>
          </div>

          <div style={{ width: 14, height: 1, background: 'rgba(255,255,255,0.2)' }} />

          {/* Phase 2: Deployment */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: currentPhase === 'deploy' ? cinematic.accentColor : currentPhase === 'completed' ? '#00ff88' : 'rgba(255,255,255,0.2)',
                boxShadow: currentPhase === 'deploy' ? `0 0 8px ${cinematic.accentColor}` : 'none',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: currentPhase === 'deploy' ? '#ffffff' : 'rgba(255,255,255,0.45)',
              }}
            >
              02 DEPLOYMENT
            </span>
          </div>

          <div style={{ width: 14, height: 1, background: 'rgba(255,255,255,0.2)' }} />

          {/* Phase 3: Universe */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <div
              style={{
                width: 6,
                height: 6,
                borderRadius: '50%',
                background: currentPhase === 'completed' ? '#00ff88' : 'rgba(255,255,255,0.2)',
              }}
            />
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9,
                fontWeight: 700,
                letterSpacing: '0.1em',
                color: currentPhase === 'completed' ? '#00ff88' : 'rgba(255,255,255,0.45)',
              }}
            >
              03 UNIVERSE
            </span>
          </div>
        </div>

        {/* Right: Quick Skip / Enter Button */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <button
            onClick={onComplete}
            style={{
              padding: '6px 14px',
              background: 'rgba(255, 255, 255, 0.08)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              borderRadius: 4,
              color: 'rgba(255, 255, 255, 0.85)',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.1em',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.background = 'rgba(0, 212, 255, 0.2)';
              e.currentTarget.style.borderColor = '#00d4ff';
              e.currentTarget.style.color = '#00d4ff';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.background = 'rgba(255, 255, 255, 0.08)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
              e.currentTarget.style.color = 'rgba(255, 255, 255, 0.85)';
            }}
          >
            SKIP MISSION ANIMATION ➔
          </button>
        </div>
      </div>

      {/* ── Center Content: Phase Overlay & Aerospace HUD ── */}
      <div
        style={{
          flex: 1,
          position: 'relative',
          zIndex: 4,
          display: 'flex',
          flexDirection: 'column',
          justifyContent: 'space-between',
          padding: '20px 32px',
          pointerEvents: 'none',
        }}
      >
        {/* Left Side: Live Telemetry telemetry box */}
        <motion.div
          initial={{ opacity: 0, x: -30 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.6, delay: 0.2 }}
          style={{
            maxWidth: 280,
            background: 'rgba(5, 12, 25, 0.82)',
            backdropFilter: 'blur(10px)',
            border: '1px solid rgba(0, 212, 255, 0.2)',
            borderRadius: 8,
            padding: '12px 16px',
            pointerEvents: 'auto',
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8.5,
                fontWeight: 700,
                color: cinematic.accentColor,
                letterSpacing: '0.15em',
              }}
            >
              LIVE ASCENT TELEMETRY
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 8,
                color: '#00ff88',
                fontWeight: 700,
              }}
            >
              ● NOMINAL
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '8px 12px' }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.45)' }}>
                ALTITUDE
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                {simAltitudeKm} <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>km</span>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.45)' }}>
                VELOCITY
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 13, fontWeight: 700, color: '#ffffff' }}>
                {simVelocityKms} <span style={{ fontSize: 8, color: 'rgba(255,255,255,0.5)' }}>km/s</span>
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.45)' }}>
                GUIDANCE LOCK
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#00ff88' }}>
                ACTIVE
              </div>
            </div>

            <div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 7.5, color: 'rgba(255,255,255,0.45)' }}>
                SIGNAL LINK
              </div>
              <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, fontWeight: 700, color: '#00d4ff' }}>
                -68 dBm
              </div>
            </div>
          </div>
        </motion.div>

        {/* Autoplay Blocked Fallback Trigger */}
        {autoplayBlocked && (
          <div
            style={{
              alignSelf: 'center',
              background: 'rgba(2, 6, 18, 0.95)',
              border: `1px solid ${cinematic.accentColor}`,
              borderRadius: 8,
              padding: '16px 28px',
              textAlign: 'center',
              boxShadow: `0 0 30px rgba(0, 212, 255, 0.3)`,
              pointerEvents: 'auto',
            }}
          >
            <div style={{ fontFamily: 'var(--font-display)', fontSize: 14, fontWeight: 800, color: '#ffffff', marginBottom: 6 }}>
              READY TO COMMENCE CINEMATIC LAUNCH
            </div>
            <p style={{ fontFamily: 'var(--font-mono)', fontSize: 10, color: 'rgba(255,255,255,0.7)', marginBottom: 12 }}>
              Click below to initiate the mission launch and deployment sequence.
            </p>
            <button
              onClick={handlePlayPause}
              style={{
                padding: '8px 24px',
                background: cinematic.accentColor,
                border: 'none',
                borderRadius: 4,
                color: '#020409',
                fontFamily: 'var(--font-mono)',
                fontSize: 11,
                fontWeight: 800,
                letterSpacing: '0.1em',
                cursor: 'pointer',
              }}
            >
              ▶ BEGIN MISSION SEQUENCE
            </button>
          </div>
        )}

        {/* Bottom Left: Mission Phase Description Card */}
        <AnimatePresence mode="wait">
          <motion.div
            key={currentPhase}
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            transition={{ duration: 0.5 }}
            style={{
              maxWidth: 580,
              background: 'rgba(4, 10, 24, 0.88)',
              backdropFilter: 'blur(14px)',
              border: `1px solid rgba(0, 212, 255, 0.25)`,
              borderLeft: `4px solid ${cinematic.accentColor}`,
              borderRadius: '0 8px 8px 0',
              padding: '16px 22px',
              pointerEvents: 'auto',
              boxShadow: '0 10px 30px rgba(0,0,0,0.5)',
            }}
          >
            <div
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 9,
                fontWeight: 700,
                color: cinematic.accentColor,
                letterSpacing: '0.2em',
                marginBottom: 4,
              }}
            >
              MISSION PHASE
            </div>

            <div
              style={{
                fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                fontSize: 'clamp(16px, 2.5vw, 22px)',
                fontWeight: 900,
                color: '#ffffff',
                letterSpacing: '0.08em',
                lineHeight: 1.15,
                marginBottom: 8,
              }}
            >
              {activePhaseData.phaseTitle}
            </div>

            <p
              style={{
                fontFamily: 'var(--font-sans, Inter, sans-serif)',
                fontSize: 'clamp(12px, 1.2vw, 13.5px)',
                color: 'rgba(255, 255, 255, 0.85)',
                lineHeight: 1.5,
                margin: 0,
              }}
            >
              "{activePhaseData.description}"
            </p>

            {/* Subsystem checkpoints */}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 12 }}>
              {activePhaseData.subsystemHighlights.map((sub, idx) => (
                <span
                  key={idx}
                  style={{
                    fontFamily: 'var(--font-mono, monospace)',
                    fontSize: 8,
                    color: 'rgba(255, 255, 255, 0.75)',
                    background: 'rgba(255, 255, 255, 0.06)',
                    border: '1px solid rgba(255, 255, 255, 0.1)',
                    borderRadius: 3,
                    padding: '2px 7px',
                  }}
                >
                  ✓ {sub}
                </span>
              ))}
            </div>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* ── Bottom Controls Bar ── */}
      <div
        style={{
          position: 'relative',
          zIndex: 5,
          background: 'linear-gradient(0deg, rgba(2,6,15,0.95) 0%, rgba(2,6,15,0.7) 70%, transparent 100%)',
          backdropFilter: 'blur(10px)',
          padding: '12px 24px 20px',
          display: 'flex',
          flexDirection: 'column',
          gap: 10,
        }}
      >
        {/* Progress Bar & Scrubber */}
        <div
          onClick={handleSeek}
          style={{
            width: '100%',
            height: 6,
            background: 'rgba(255,255,255,0.15)',
            borderRadius: 3,
            cursor: 'pointer',
            position: 'relative',
            overflow: 'hidden',
          }}
        >
          <div
            style={{
              width: `${progress}%`,
              height: '100%',
              background: `linear-gradient(90deg, #00d4ff, ${cinematic.accentColor})`,
              boxShadow: `0 0 10px ${cinematic.accentColor}`,
              transition: 'width 0.1s linear',
            }}
          />
        </div>

        {/* Controls Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
          {/* Play/Pause, Phase Jump, Mute, Speed */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {/* Play/Pause Button */}
            <button
              onClick={handlePlayPause}
              style={{
                padding: '6px 14px',
                background: isPlaying ? 'rgba(255, 140, 0, 0.15)' : 'rgba(0, 212, 255, 0.2)',
                border: `1px solid ${isPlaying ? '#ff8c00' : '#00d4ff'}`,
                borderRadius: 4,
                color: isPlaying ? '#ff8c00' : '#00d4ff',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                fontWeight: 700,
                cursor: 'pointer',
              }}
            >
              {isPlaying ? '❚❚ PAUSE' : '▶ PLAY'}
            </button>

            {/* Mute Toggle */}
            <button
              onClick={() => setIsMuted(!isMuted)}
              style={{
                padding: '6px 12px',
                background: 'rgba(255,255,255,0.06)',
                border: '1px solid rgba(255,255,255,0.15)',
                borderRadius: 4,
                color: isMuted ? 'rgba(255,255,255,0.5)' : '#00ff88',
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                cursor: 'pointer',
              }}
            >
              {isMuted ? '🔇 MUTED' : '🔊 AUDIO'}
            </button>

            {/* Speed Selector */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 6 }}>
              <span style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.45)' }}>
                SPEED:
              </span>
              {[1, 2].map((spd) => (
                <button
                  key={spd}
                  onClick={() => setPlaybackSpeed(spd)}
                  style={{
                    padding: '3px 8px',
                    background: playbackSpeed === spd ? 'rgba(0,212,255,0.25)' : 'transparent',
                    border: `1px solid ${playbackSpeed === spd ? '#00d4ff' : 'rgba(255,255,255,0.12)'}`,
                    borderRadius: 3,
                    color: playbackSpeed === spd ? '#00d4ff' : 'rgba(255,255,255,0.5)',
                    fontFamily: 'var(--font-mono)',
                    fontSize: 9,
                    cursor: 'pointer',
                  }}
                >
                  {spd}×
                </button>
              ))}
            </div>

            {/* Timer readout */}
            <span style={{ fontFamily: 'var(--font-mono)', fontSize: 9.5, color: 'rgba(255,255,255,0.6)', marginLeft: 8 }}>
              {currentTimeStr} / {durationStr}
            </span>
          </div>

          {/* Right Action: Next Phase / Enter Universe */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            {currentPhase === 'launch' ? (
              <button
                onClick={handleSkipToNextPhase}
                style={{
                  padding: '7px 18px',
                  background: 'rgba(0, 212, 255, 0.15)',
                  border: '1px solid #00d4ff',
                  borderRadius: 4,
                  color: '#00d4ff',
                  fontFamily: 'var(--font-mono)',
                  fontSize: 10,
                  fontWeight: 700,
                  letterSpacing: '0.1em',
                  cursor: 'pointer',
                }}
              >
                PROCEED TO DEPLOYMENT ➔
              </button>
            ) : (
              <button
                onClick={onComplete}
                className="btn btn-primary"
                style={{
                  padding: '8px 22px',
                  fontSize: 11,
                  letterSpacing: '0.12em',
                  boxShadow: `0 0 25px rgba(0, 212, 255, 0.4)`,
                  background: `linear-gradient(135deg, ${cinematic.accentColor}, #00d4ff)`,
                  color: '#020409',
                  fontWeight: 800,
                }}
              >
                ENTER UNIVERSE & DIGITAL TWIN ➔
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
