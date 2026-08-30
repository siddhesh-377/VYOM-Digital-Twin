import React, { useEffect, useRef, useState } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useMissionStore } from '../../store/missionStore';
import { getMissionCinematic } from '../../constants/missionVideos';
import { getAudioPreference, toggleAudioPreference } from '../../utils/audioPreference';

// Register GSAP plugins safely
if (typeof window !== 'undefined') {
  gsap.registerPlugin(ScrollTrigger);
}

interface MissionStorytellingScrollProps {
  onComplete: () => void;
  onEnterUniverse?: () => void;
  onEnterMissionControl?: () => void;
}

export function MissionStorytellingScroll({
  onComplete,
  onEnterUniverse,
  onEnterMissionControl,
}: MissionStorytellingScrollProps) {
  const config = useMissionStore((s) => s.config);
  const cinematic = getMissionCinematic(config?.type);

  const containerRef = useRef<HTMLDivElement | null>(null);
  const launchVideoRef = useRef<HTMLVideoElement | null>(null);
  const deployVideoRef = useRef<HTMLVideoElement | null>(null);

  const [activeChapter, setActiveChapter] = useState<number>(1);
  const [isAudioEnabled, setIsAudioEnabled] = useState<boolean>(() => getAudioPreference());

  // Handle audio toggle
  const handleToggleSound = () => {
    const next = toggleAudioPreference();
    setIsAudioEnabled(next);
    if (launchVideoRef.current) launchVideoRef.current.muted = !next;
    if (deployVideoRef.current) deployVideoRef.current.muted = !next;
  };

  // Scroll to specific section
  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  };

  // GSAP Animations & ScrollTriggers setup
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    const ctx = gsap.context(() => {
      // 1. Hero Introduction Reveal
      gsap.fromTo(
        '.story-hero-title',
        { opacity: 0, y: 30 },
        { opacity: 1, y: 0, duration: 1.0, ease: 'power3.out' }
      );

      gsap.fromTo(
        '.story-hero-sub',
        { opacity: 0, y: 20 },
        { opacity: 1, y: 0, duration: 0.9, delay: 0.2, ease: 'power3.out' }
      );

      if (!prefersReducedMotion) {
        // 2. Launch Section Reveal
        ScrollTrigger.create({
          trigger: '#story-launch-section',
          scroller: container,
          start: 'top 70%',
          end: 'bottom 30%',
          onEnter: () => {
            setActiveChapter(2);
            if (launchVideoRef.current && launchVideoRef.current.paused) {
              launchVideoRef.current.play().catch(() => {});
            }
          },
          onEnterBack: () => {
            setActiveChapter(2);
            if (launchVideoRef.current && launchVideoRef.current.paused) {
              launchVideoRef.current.play().catch(() => {});
            }
          },
          onLeave: () => {
            if (launchVideoRef.current) launchVideoRef.current.pause();
          },
          onLeaveBack: () => {
            setActiveChapter(1);
            if (launchVideoRef.current) launchVideoRef.current.pause();
          },
        });

        gsap.fromTo(
          '.story-launch-video-card',
          { opacity: 0, scale: 0.94, y: 40 },
          {
            scrollTrigger: {
              trigger: '#story-launch-section',
              scroller: container,
              start: 'top 75%',
              toggleActions: 'play none none reverse',
            },
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 1.0,
            ease: 'power2.out',
          }
        );

        gsap.fromTo(
          '.story-launch-text',
          { opacity: 0, x: -30 },
          {
            scrollTrigger: {
              trigger: '#story-launch-section',
              scroller: container,
              start: 'top 70%',
              toggleActions: 'play none none reverse',
            },
            opacity: 1,
            x: 0,
            duration: 0.9,
            ease: 'power2.out',
          }
        );

        // 3. Deployment Section Reveal
        ScrollTrigger.create({
          trigger: '#story-deploy-section',
          scroller: container,
          start: 'top 70%',
          end: 'bottom 30%',
          onEnter: () => {
            setActiveChapter(3);
            if (deployVideoRef.current && deployVideoRef.current.paused) {
              deployVideoRef.current.play().catch(() => {});
            }
          },
          onEnterBack: () => {
            setActiveChapter(3);
            if (deployVideoRef.current && deployVideoRef.current.paused) {
              deployVideoRef.current.play().catch(() => {});
            }
          },
          onLeave: () => {
            if (deployVideoRef.current) deployVideoRef.current.pause();
          },
          onLeaveBack: () => {
            setActiveChapter(2);
            if (deployVideoRef.current) deployVideoRef.current.pause();
          },
        });

        gsap.fromTo(
          '.story-deploy-video-card',
          { opacity: 0, scale: 0.94, y: 40 },
          {
            scrollTrigger: {
              trigger: '#story-deploy-section',
              scroller: container,
              start: 'top 75%',
              toggleActions: 'play none none reverse',
            },
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 1.0,
            ease: 'power2.out',
          }
        );

        gsap.fromTo(
          '.story-deploy-text',
          { opacity: 0, x: 30 },
          {
            scrollTrigger: {
              trigger: '#story-deploy-section',
              scroller: container,
              start: 'top 70%',
              toggleActions: 'play none none reverse',
            },
            opacity: 1,
            x: 0,
            duration: 0.9,
            ease: 'power2.out',
          }
        );

        // 4. Mission Deployed Final Card
        ScrollTrigger.create({
          trigger: '#story-final-section',
          scroller: container,
          start: 'top 70%',
          onEnter: () => setActiveChapter(4),
          onLeaveBack: () => setActiveChapter(3),
        });

        gsap.fromTo(
          '.story-final-card',
          { opacity: 0, scale: 0.9, y: 30 },
          {
            scrollTrigger: {
              trigger: '#story-final-section',
              scroller: container,
              start: 'top 80%',
              toggleActions: 'play none none reverse',
            },
            opacity: 1,
            scale: 1,
            y: 0,
            duration: 1.1,
            ease: 'power2.out',
          }
        );
      }
    }, container);

    const timer = setTimeout(() => {
      ScrollTrigger.refresh();
    }, 150);

    return () => {
      clearTimeout(timer);
      ctx.revert();
    };
  }, []);

  return (
    <div
      ref={containerRef}
      style={{
        width: '100%',
        height: '100%',
        overflowY: 'auto',
        overflowX: 'hidden',
        background: '#020409',
        position: 'relative',
        scrollBehavior: 'smooth',
      }}
    >
      {/* ── Fixed Background Grid & Nebula ── */}
      <div
        style={{
          position: 'fixed',
          inset: 0,
          backgroundImage:
            'radial-gradient(ellipse at 50% 20%, rgba(0,212,255,0.08) 0%, rgba(2,4,9,0.95) 75%), linear-gradient(rgba(255,255,255,0.02) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.02) 1px, transparent 1px)',
          backgroundSize: '100% 100%, 60px 60px, 60px 60px',
          pointerEvents: 'none',
          zIndex: 1,
        }}
      />

      {/* ── Left Chapter Progress Tracker ── */}
      <div
        style={{
          position: 'fixed',
          top: '50%',
          left: 24,
          transform: 'translateY(-50%)',
          zIndex: 25,
          display: 'flex',
          flexDirection: 'column',
          gap: 14,
          background: 'rgba(5, 12, 28, 0.75)',
          backdropFilter: 'blur(10px)',
          border: '1px solid rgba(0, 212, 255, 0.2)',
          borderRadius: 24,
          padding: '14px 10px',
        }}
      >
        {[
          { id: 'story-hero-section', num: 1, title: 'BRIEFING' },
          { id: 'story-launch-section', num: 2, title: 'ASCENT' },
          { id: 'story-deploy-section', num: 3, title: 'DEPLOYMENT' },
          { id: 'story-final-section', num: 4, title: 'DIGITAL TWIN' },
        ].map((ch) => {
          const isActive = activeChapter === ch.num;
          return (
            <button
              key={ch.id}
              onClick={() => scrollToSection(ch.id)}
              title={ch.title}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                padding: '4px 6px',
              }}
            >
              <div
                style={{
                  width: isActive ? 10 : 6,
                  height: isActive ? 10 : 6,
                  borderRadius: '50%',
                  background: isActive ? cinematic.accentColor : 'rgba(255,255,255,0.25)',
                  boxShadow: isActive ? `0 0 10px ${cinematic.accentColor}` : 'none',
                  transition: 'all 0.3s ease',
                }}
              />
              <span
                style={{
                  fontFamily: 'var(--font-mono)',
                  fontSize: 8.5,
                  color: isActive ? '#ffffff' : 'rgba(255,255,255,0.35)',
                  fontWeight: isActive ? 700 : 400,
                  letterSpacing: '0.1em',
                  transition: 'all 0.2s ease',
                }}
              >
                0{ch.num}
              </span>
            </button>
          );
        })}
      </div>

      {/* ── Top Right Controls Header ── */}
      <div
        style={{
          position: 'fixed',
          top: 18,
          right: 24,
          zIndex: 30,
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {/* Sound Toggle */}
        <button
          onClick={handleToggleSound}
          style={{
            padding: '6px 14px',
            background: 'rgba(5, 12, 28, 0.85)',
            border: `1px solid ${isAudioEnabled ? cinematic.accentColor : 'rgba(255,255,255,0.2)'}`,
            borderRadius: 6,
            color: isAudioEnabled ? cinematic.accentColor : 'rgba(255,255,255,0.6)',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 9.5,
            fontWeight: 700,
            letterSpacing: '0.1em',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            boxShadow: isAudioEnabled ? `0 0 15px ${cinematic.accentColor}33` : 'none',
            transition: 'all 0.2s',
          }}
        >
          {isAudioEnabled ? '🔊 SOUND ON' : '🔇 SOUND OFF'}
        </button>

        {/* Skip to Universe */}
        <button
          onClick={onComplete}
          style={{
            padding: '7px 18px',
            background: 'rgba(5, 12, 28, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.4)',
            borderRadius: 6,
            color: '#00d4ff',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
            transition: 'all 0.2s',
          }}
        >
          SKIP TO UNIVERSE ➔
        </button>
      </div>

      {/* ── 1. MISSION INTRODUCTION HERO SECTION ── */}
      <section
        id="story-hero-section"
        style={{
          minHeight: '92vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '80px 24px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 8,
            background: 'rgba(0, 212, 255, 0.1)',
            border: `1px solid ${cinematic.accentColor}`,
            borderRadius: 20,
            padding: '5px 16px',
            marginBottom: 20,
          }}
        >
          <div
            style={{
              width: 8,
              height: 8,
              borderRadius: '50%',
              background: cinematic.accentColor,
              boxShadow: `0 0 10px ${cinematic.accentColor}`,
            }}
          />
          <span
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              fontWeight: 700,
              color: '#ffffff',
              letterSpacing: '0.2em',
            }}
          >
            MISSION STORYLINE · CHAPTER 01
          </span>
        </div>

        <h1
          className="story-hero-title"
          style={{
            fontFamily: 'var(--font-display, Orbitron, sans-serif)',
            fontSize: 'clamp(32px, 6vw, 64px)',
            fontWeight: 900,
            color: '#ffffff',
            letterSpacing: '0.1em',
            lineHeight: 1.1,
            margin: '0 0 16px',
            textShadow: `0 0 50px rgba(0,212,255,0.25)`,
          }}
        >
          {config?.name || cinematic.title}
        </h1>

        <p
          className="story-hero-sub"
          style={{
            fontFamily: 'var(--font-sans, Inter, sans-serif)',
            fontSize: 'clamp(14px, 1.8vw, 18px)',
            color: 'rgba(255,255,255,0.85)',
            maxWidth: 720,
            lineHeight: 1.6,
            margin: '0 0 32px',
          }}
        >
          {cinematic.subtitle} · Destination: <strong style={{ color: cinematic.accentColor }}>{config?.destination || 'Low Earth Orbit'}</strong>
        </p>

        {/* Mission Objectives Snapshot */}
        <div
          style={{
            display: 'flex',
            flexWrap: 'wrap',
            justifyContent: 'center',
            gap: 16,
            maxWidth: 800,
            marginBottom: 40,
          }}
        >
          <div
            style={{
              background: 'rgba(5, 12, 28, 0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '12px 20px',
              textAlign: 'left',
              minWidth: 200,
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.45)' }}>
              MISSION BUDGET
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 16, fontWeight: 700, color: '#00ff88', marginTop: 4 }}>
              ₹{config?.budgetCrore ?? 350} Cr
            </div>
          </div>

          <div
            style={{
              background: 'rgba(5, 12, 28, 0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '12px 20px',
              textAlign: 'left',
              minWidth: 200,
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.45)' }}>
              PRIMARY VEHICLE
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#00d4ff', marginTop: 4 }}>
              {cinematic.title}
            </div>
          </div>

          <div
            style={{
              background: 'rgba(5, 12, 28, 0.7)',
              border: '1px solid rgba(255,255,255,0.1)',
              borderRadius: 8,
              padding: '12px 20px',
              textAlign: 'left',
              minWidth: 200,
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 8.5, color: 'rgba(255,255,255,0.45)' }}>
              LAUNCH SITE
            </div>
            <div style={{ fontFamily: 'var(--font-mono)', fontSize: 14, fontWeight: 700, color: '#ffffff', marginTop: 4 }}>
              {config?.launchSite?.name || 'SDSC Sriharikota'}
            </div>
          </div>
        </div>

        <button
          onClick={() => scrollToSection('story-launch-section')}
          style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 11,
            color: '#00d4ff',
            letterSpacing: '0.15em',
            background: 'rgba(0,212,255,0.1)',
            border: '1px solid rgba(0,212,255,0.3)',
            borderRadius: 20,
            padding: '8px 20px',
            cursor: 'pointer',
            transition: 'all 0.2s',
          }}
        >
          ▼ SCROLL TO COMMENCE LAUNCH SEQUENCE
        </button>
      </section>

      {/* ── 2. LAUNCH PHASE & VIDEO SECTION ── */}
      <section
        id="story-launch-section"
        className="story-launch-section"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 32px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 48,
            alignItems: 'center',
          }}
        >
          {/* Left Text Column */}
          <div className="story-launch-text">
            <div
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 10,
                fontWeight: 700,
                color: cinematic.accentColor,
                letterSpacing: '0.2em',
                marginBottom: 8,
              }}
            >
              {cinematic.launch.badgeLabel}
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                fontSize: 'clamp(24px, 3.5vw, 36px)',
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.2,
                margin: '0 0 16px',
              }}
            >
              {cinematic.launch.phaseTitle}
            </h2>

            <p
              style={{
                fontFamily: 'var(--font-sans, Inter, sans-serif)',
                fontSize: 15,
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}
            >
              "{cinematic.launch.description}"
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {cinematic.launch.subsystemHighlights.map((hl, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                    {hl}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => scrollToSection('story-deploy-section')}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: cinematic.accentColor,
                background: 'rgba(255,255,255,0.05)',
                border: `1px solid ${cinematic.accentColor}55`,
                borderRadius: 6,
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              PROCEED TO DEPLOYMENT PHASE ▼
            </button>
          </div>

          {/* Right Video Card */}
          <div
            className="story-launch-video-card"
            style={{
              position: 'relative',
              borderRadius: 12,
              overflow: 'hidden',
              border: '1px solid rgba(0, 212, 255, 0.3)',
              boxShadow: '0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(0,212,255,0.15)',
              background: '#040a18',
              aspectRatio: '16/9',
            }}
          >
            <video
              ref={launchVideoRef}
              src={cinematic.launch.videoUrl}
              muted={!isAudioEnabled}
              loop
              playsInline
              preload="auto"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 14,
                background: 'rgba(2,6,15,0.85)',
                backdropFilter: 'blur(6px)',
                padding: '4px 10px',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 8.5,
                color: '#00d4ff',
                letterSpacing: '0.1em',
              }}
            >
              HD LAUNCH BROADCAST FEED
            </div>
          </div>
        </div>
      </section>

      {/* ── 3. DEPLOYMENT PHASE & VIDEO SECTION ── */}
      <section
        id="story-deploy-section"
        className="story-deploy-section"
        style={{
          minHeight: '100vh',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          padding: '80px 32px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          style={{
            maxWidth: 1200,
            width: '100%',
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fit, minmax(360px, 1fr))',
            gap: 48,
            alignItems: 'center',
          }}
        >
          {/* Left Video Card */}
          <div
            className="story-deploy-video-card"
            style={{
              position: 'relative',
              borderRadius: 12,
              overflow: 'hidden',
              border: `1px solid ${cinematic.accentColor}`,
              boxShadow: `0 20px 50px rgba(0,0,0,0.6), 0 0 30px rgba(0,255,136,0.15)`,
              background: '#040a18',
              aspectRatio: '16/9',
              order: 2,
            }}
          >
            <video
              ref={deployVideoRef}
              src={cinematic.deployment.videoUrl}
              muted={!isAudioEnabled}
              loop
              playsInline
              preload="auto"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 14,
                background: 'rgba(2,6,15,0.85)',
                backdropFilter: 'blur(6px)',
                padding: '4px 10px',
                borderRadius: 4,
                fontFamily: 'var(--font-mono)',
                fontSize: 8.5,
                color: cinematic.accentColor,
                letterSpacing: '0.1em',
              }}
            >
              SPACE DEPLOYMENT TELEMETRY FEED
            </div>
          </div>

          {/* Right Text Column */}
          <div className="story-deploy-text" style={{ order: 1 }}>
            <div
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 10,
                fontWeight: 700,
                color: cinematic.accentColor,
                letterSpacing: '0.2em',
                marginBottom: 8,
              }}
            >
              {cinematic.deployment.badgeLabel}
            </div>

            <h2
              style={{
                fontFamily: 'var(--font-display, Orbitron, sans-serif)',
                fontSize: 'clamp(24px, 3.5vw, 36px)',
                fontWeight: 900,
                color: '#ffffff',
                lineHeight: 1.2,
                margin: '0 0 16px',
              }}
            >
              {cinematic.deployment.phaseTitle}
            </h2>

            <p
              style={{
                fontFamily: 'var(--font-sans, Inter, sans-serif)',
                fontSize: 15,
                color: 'rgba(255,255,255,0.85)',
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}
            >
              "{cinematic.deployment.description}"
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 28 }}>
              {cinematic.deployment.subsystemHighlights.map((hl, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: cinematic.accentColor }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                    {hl}
                  </span>
                </div>
              ))}
            </div>

            <button
              onClick={() => scrollToSection('story-final-section')}
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 10,
                color: '#00ff88',
                background: 'rgba(255,255,255,0.05)',
                border: '1px solid rgba(0,255,136,0.3)',
                borderRadius: 6,
                padding: '8px 16px',
                cursor: 'pointer',
              }}
            >
              PROCEED TO MISSION COMPLETE ▼
            </button>
          </div>
        </div>
      </section>

      {/* ── 4. MISSION DEPLOYED FINAL STATUS & CTA SECTION ── */}
      <section
        id="story-final-section"
        className="story-final-section"
        style={{
          minHeight: '85vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '60px 24px 100px',
          position: 'relative',
          zIndex: 2,
        }}
      >
        <div
          className="story-final-card"
          style={{
            maxWidth: 680,
            background: 'rgba(5, 14, 32, 0.92)',
            border: `1px solid rgba(0, 212, 255, 0.35)`,
            borderRadius: 16,
            padding: '40px 32px',
            backdropFilter: 'blur(16px)',
            boxShadow: `0 20px 60px rgba(0,0,0,0.7), 0 0 40px rgba(0,212,255,0.15)`,
          }}
        >
          <div
            style={{
              width: 14,
              height: 14,
              borderRadius: '50%',
              background: '#00ff88',
              boxShadow: '0 0 20px #00ff88',
              margin: '0 auto 16px',
            }}
          />

          <div
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              fontWeight: 700,
              color: '#00ff88',
              letterSpacing: '0.25em',
              marginBottom: 8,
            }}
          >
            DEPLOYMENT COMPLETE
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-display, Orbitron, sans-serif)',
              fontSize: 'clamp(28px, 4vw, 42px)',
              fontWeight: 900,
              color: '#ffffff',
              letterSpacing: '0.08em',
              margin: '0 0 16px',
            }}
          >
            MISSION DEPLOYED
          </h2>

          <p
            style={{
              fontFamily: 'var(--font-sans, Inter, sans-serif)',
              fontSize: 14,
              color: 'rgba(255,255,255,0.85)',
              lineHeight: 1.6,
              margin: '0 0 32px',
            }}
          >
            Spacecraft systems are stabilized and operational in orbital flight configuration. Real-time telemetry, guidance, and digital twin subsystems are active.
          </p>

          <div style={{ display: 'flex', justifyContent: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              onClick={onComplete}
              className="btn btn-primary"
              style={{
                padding: '12px 32px',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.15em',
                background: `linear-gradient(135deg, ${cinematic.accentColor}, #00d4ff)`,
                color: '#020409',
                borderRadius: 8,
                boxShadow: `0 0 30px rgba(0, 212, 255, 0.4)`,
                cursor: 'pointer',
              }}
            >
              ENTER UNIVERSE &amp; DIGITAL TWIN ➔
            </button>
            {onEnterMissionControl && (
              <button
                onClick={onEnterMissionControl}
                style={{
                  padding: '12px 24px',
                  fontSize: 12,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  background: 'rgba(255,255,255,0.06)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  color: '#ffffff',
                  borderRadius: 8,
                  cursor: 'pointer',
                }}
              >
                MISSION CONTROL ➔
              </button>
            )}
          </div>
        </div>
      </section>
    </div>
  );
}
