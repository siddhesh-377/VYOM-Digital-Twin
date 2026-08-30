import React, { useEffect, useRef } from 'react';
import gsap from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useMissionStore } from '../../store/missionStore';
import { getMissionCinematic } from '../../constants/missionVideos';

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

  // GSAP Animations & ScrollTriggers setup
  useEffect(() => {
    // Check if user prefers reduced motion
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      // 1. Hero Introduction Reveal
      gsap.from('.story-hero-title', {
        opacity: 0,
        y: 40,
        duration: 1.2,
        ease: 'power3.out',
      });

      gsap.from('.story-hero-sub', {
        opacity: 0,
        y: 20,
        duration: 1,
        delay: 0.3,
        ease: 'power3.out',
      });

      // 2. Launch Section Reveal & Video Scale
      ScrollTrigger.create({
        trigger: '.story-launch-section',
        start: 'top 80%',
        end: 'bottom 20%',
        onEnter: () => {
          if (launchVideoRef.current && launchVideoRef.current.paused) {
            launchVideoRef.current.play().catch(() => {});
          }
        },
        onLeave: () => {
          if (launchVideoRef.current) launchVideoRef.current.pause();
        },
        onEnterBack: () => {
          if (launchVideoRef.current && launchVideoRef.current.paused) {
            launchVideoRef.current.play().catch(() => {});
          }
        },
        onLeaveBack: () => {
          if (launchVideoRef.current) launchVideoRef.current.pause();
        },
      });

      gsap.from('.story-launch-video-card', {
        scrollTrigger: {
          trigger: '.story-launch-section',
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        },
        opacity: 0,
        scale: 0.92,
        y: 50,
        duration: 1.2,
        ease: 'power2.out',
      });

      gsap.from('.story-launch-text', {
        scrollTrigger: {
          trigger: '.story-launch-section',
          start: 'top 70%',
          toggleActions: 'play none none reverse',
        },
        opacity: 0,
        x: -40,
        duration: 1,
        ease: 'power2.out',
      });

      // 3. Deployment Section Reveal & Video Scale
      ScrollTrigger.create({
        trigger: '.story-deploy-section',
        start: 'top 80%',
        end: 'bottom 20%',
        onEnter: () => {
          if (deployVideoRef.current && deployVideoRef.current.paused) {
            deployVideoRef.current.play().catch(() => {});
          }
        },
        onLeave: () => {
          if (deployVideoRef.current) deployVideoRef.current.pause();
        },
        onEnterBack: () => {
          if (deployVideoRef.current && deployVideoRef.current.paused) {
            deployVideoRef.current.play().catch(() => {});
          }
        },
        onLeaveBack: () => {
          if (deployVideoRef.current) deployVideoRef.current.pause();
        },
      });

      gsap.from('.story-deploy-video-card', {
        scrollTrigger: {
          trigger: '.story-deploy-section',
          start: 'top 75%',
          toggleActions: 'play none none reverse',
        },
        opacity: 0,
        scale: 0.92,
        y: 50,
        duration: 1.2,
        ease: 'power2.out',
      });

      gsap.from('.story-deploy-text', {
        scrollTrigger: {
          trigger: '.story-deploy-section',
          start: 'top 70%',
          toggleActions: 'play none none reverse',
        },
        opacity: 0,
        x: 40,
        duration: 1,
        ease: 'power2.out',
      });

      // 4. Mission Deployed Final Card
      gsap.from('.story-final-card', {
        scrollTrigger: {
          trigger: '.story-final-section',
          start: 'top 80%',
          toggleActions: 'play none none reverse',
        },
        opacity: 0,
        scale: 0.85,
        y: 30,
        duration: 1.2,
        ease: 'back.out(1.4)',
      });
    }, containerRef);

    return () => {
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

      {/* Floating Skip Header */}
      <div
        style={{
          position: 'fixed',
          top: 20,
          right: 24,
          zIndex: 20,
          display: 'flex',
          gap: 12,
        }}
      >
        <button
          onClick={onComplete}
          style={{
            padding: '8px 18px',
            background: 'rgba(5, 12, 28, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.3)',
            borderRadius: 6,
            color: '#00d4ff',
            fontFamily: 'var(--font-mono, monospace)',
            fontSize: 10,
            fontWeight: 700,
            letterSpacing: '0.12em',
            backdropFilter: 'blur(8px)',
            cursor: 'pointer',
            boxShadow: '0 4px 20px rgba(0,0,0,0.5)',
          }}
        >
          SKIP TO UNIVERSE ➔
        </button>
      </div>

      {/* ── 1. MISSION INTRODUCTION HERO SECTION ── */}
      <section
        style={{
          minHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          textAlign: 'center',
          padding: '60px 24px',
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
            MISSION BRIEFING & DEPLOYMENT
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
            color: 'rgba(255,255,255,0.7)',
            maxWidth: 700,
            lineHeight: 1.6,
            margin: '0 0 32px',
          }}
        >
          {cinematic.subtitle} · Destination: <strong style={{ color: '#ffffff' }}>{config?.destination || 'Low Earth Orbit'}</strong>
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

        <div style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(0,212,255,0.7)', letterSpacing: '0.15em' }}>
          ▼ SCROLL TO COMMENCE LAUNCH SEQUENCE
        </div>
      </section>

      {/* ── 2. LAUNCH PHASE & VIDEO SECTION ── */}
      <section
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
                color: 'rgba(255,255,255,0.8)',
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}
            >
              "{cinematic.launch.description}"
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cinematic.launch.subsystemHighlights.map((hl, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: '#00ff88' }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                    {hl}
                  </span>
                </div>
              ))}
            </div>
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
              muted
              loop
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 14,
                background: 'rgba(2,6,15,0.8)',
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
              muted
              loop
              playsInline
              preload="metadata"
              style={{ width: '100%', height: '100%', objectFit: 'cover' }}
            />
            <div
              style={{
                position: 'absolute',
                bottom: 12,
                left: 14,
                background: 'rgba(2,6,15,0.8)',
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
                color: 'rgba(255,255,255,0.8)',
                lineHeight: 1.6,
                margin: '0 0 24px',
              }}
            >
              "{cinematic.deployment.description}"
            </p>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {cinematic.deployment.subsystemHighlights.map((hl, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <div style={{ width: 6, height: 6, borderRadius: '50%', background: cinematic.accentColor }} />
                  <span style={{ fontFamily: 'var(--font-mono)', fontSize: 11, color: 'rgba(255,255,255,0.85)' }}>
                    {hl}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ── 4. MISSION DEPLOYED FINAL STATUS & CTA SECTION ── */}
      <section
        className="story-final-section"
        style={{
          minHeight: '80vh',
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
            background: 'rgba(5, 14, 32, 0.9)',
            border: `1px solid rgba(0, 212, 255, 0.3)`,
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
              color: 'rgba(255,255,255,0.8)',
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
                boxShadow: `0 0 30px rgba(0, 212, 255, 0.4)`,
              }}
            >
              ENTER UNIVERSE & DIGITAL TWIN ➔
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
