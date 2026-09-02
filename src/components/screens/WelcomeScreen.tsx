import React, { useRef, useEffect, useState, useLayoutEffect } from 'react';
import { gsap } from 'gsap';
import { ScrollTrigger } from 'gsap/ScrollTrigger';
import { useMissionStore } from '../../store/missionStore';
import type { MissionType } from '../../types/mission';
import { MISSION_PROFILES } from '../../types/missionProfiles';

gsap.registerPlugin(ScrollTrigger);

// Editorial Mission Profiles Showcase Data
const EDITORIAL_MISSIONS: {
  num: string;
  key: MissionType;
  category: string;
  title: string;
  subtitle: string;
  description: string;
  orbit: string;
  altitude: string;
  inclination: string;
  payload: string;
  color: string;
}[] = [
  {
    num: '01',
    key: 'orbital',
    category: 'EARTH OBSERVATION',
    title: 'CartoSat-3D',
    subtitle: 'Earth-Facing Multispectral Telemetry & Coverage',
    description: 'Monitor Earth-facing missions and understand spacecraft state, coverage and mission events with sub-meter spatial fidelity.',
    orbit: 'Sun-Synchronous (SSO)',
    altitude: '650 km',
    inclination: '97.5°',
    payload: 'Multispectral Panchromatic Imager & Hyperspectral Sounder',
    color: '#00d4ff',
  },
  {
    num: '02',
    key: 'astrophysics',
    category: 'COMMUNICATION',
    title: 'AstroSat-Next',
    subtitle: 'Deep Space Relay & Phased Array Network',
    description: 'Visualize communication-oriented missions and monitor spacecraft operational state across high-bandwidth RF ground links.',
    orbit: 'Lagrange L2 Halo Orbit',
    altitude: '1,500,000 km',
    inclination: '0.0°',
    payload: 'Dual Reflector Phased Array & X-Ray Polarimeter',
    color: '#9b5de5',
  },
  {
    num: '03',
    key: 'planetary',
    category: 'DEEP SPACE',
    title: 'Mangalyaan-II',
    subtitle: 'Long-Duration Cruise & Mars Aerocentric Insertion',
    description: 'Explore long-duration missions where distance, time and limited communication windows increase operational complexity.',
    orbit: 'Mars Aerocentric Elliptical',
    altitude: '3,800 km',
    inclination: '14.2°',
    payload: 'Methane Gas Sensor & Surface Radar Sounder',
    color: '#ff8c00',
  },
  {
    num: '04',
    key: 'human',
    category: 'AUTONOMOUS EXPLORATION',
    title: 'Gaganyaan-H1',
    subtitle: 'Crewed Spacecraft & Intelligent Closed-Loop Control',
    description: 'Simulate intelligent mission operations where systems must respond dynamically to changing conditions and onboard events.',
    orbit: 'Low Earth Orbit (LEO)',
    altitude: '400 km',
    inclination: '51.6°',
    payload: 'Pressurized Crew Module & Closed-Loop Ammonia ECLSS',
    color: '#00ff88',
  },
];

export function WelcomeScreen() {
  const setScreen        = useMissionStore((s) => s.setScreen);
  const startMission     = useMissionStore((s) => s.startMission);
  const setMissionConfig = useMissionStore((s) => s.setMissionConfig);
  const telemetry        = useMissionStore((s) => s.telemetry);

  const comp = useRef<HTMLDivElement | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const navRef = useRef<HTMLElement | null>(null);
  const earthContainerRef = useRef<HTMLDivElement | null>(null);
  const progressRef = useRef<HTMLDivElement | null>(null);

  const [activeTab, setActiveTab] = useState<'observe' | 'analyze' | 'simulate' | 'command'>('observe');

  // Autoplay locked rotating Earth video
  useEffect(() => {
    const v = videoRef.current;
    if (!v) return;
    v.muted = true;
    v.play().catch(() => {});
  }, []);

  // GSAP Animation System with clean context
  useLayoutEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    if (prefersReducedMotion) return;

    const ctx = gsap.context(() => {
      // 0. Top minimal scroll progress indicator
      if (progressRef.current && comp.current) {
        gsap.to(progressRef.current, {
          width: '100%',
          ease: 'none',
          scrollTrigger: {
            trigger: comp.current,
            start: 'top top',
            end: 'bottom bottom',
            scrub: 0.1,
          },
        });
      }

      // 0b. Navbar scroll styling
      ScrollTrigger.create({
        start: 'top -80',
        end: 99999,
        toggleClass: {
          className: 'nav-scrolled',
          targets: navRef.current,
        },
      });

      // 1. HERO ENTRANCE (Line-by-line typography page load timeline)
      const heroTl = gsap.timeline({ defaults: { ease: 'power3.out' } });

      heroTl
        .from('.hero-eyebrow', { opacity: 0, y: -20, duration: 0.8, delay: 0.2 })
        .from('.hero-title-line', {
          yPercent: 105,
          duration: 1.0,
          stagger: 0.12,
          ease: 'power4.out',
        }, '-=0.5')
        .from('.hero-quote', { opacity: 0, y: 20, duration: 0.8 }, '-=0.6')
        .from('.hero-desc', { opacity: 0, y: 24, duration: 0.8 }, '-=0.5')
        .from('.hero-cta-wrap', { opacity: 0, y: 20, duration: 0.8 }, '-=0.5')
        .from('.hero-meta', { opacity: 0, duration: 1 }, '-=0.4')
        .from('.hero-scroll-indicator', { opacity: 0, y: -10, duration: 0.8 }, '-=0.4')
        .from(earthContainerRef.current, { opacity: 0, duration: 1.4, ease: 'power2.out' }, '-=1.2');

      // Parallax on hero content & contained earth as user scrolls away (NO ZOOM)
      gsap.to('.hero-left-content', {
        y: -100,
        opacity: 0.2,
        ease: 'none',
        scrollTrigger: {
          trigger: '#sec-hero',
          start: 'top top',
          end: 'bottom top',
          scrub: true,
        },
      });

      if (earthContainerRef.current) {
        gsap.to(earthContainerRef.current, {
          y: -40,
          opacity: 0.45,
          ease: 'none',
          scrollTrigger: {
            trigger: '#sec-hero',
            start: 'top top',
            end: 'bottom top',
            scrub: true,
          },
        });
      }

      // 2. PINNED SECTION: WHAT IS VYOM? (ABOUT)
      const whatTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#sec-what-is-vyom',
          start: 'top top',
          end: '+=1500',
          pin: true,
          pinSpacing: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      });

      whatTl
        .fromTo('#what-eyebrow', { opacity: 0.4, y: -10 }, { opacity: 1, y: 0, duration: 0.4 })
        .fromTo('#what-title', { opacity: 0.5, y: 25 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.2')
        .fromTo('#what-statement', { opacity: 0.3, y: 20 }, { opacity: 1, y: 0, duration: 0.6 })
        .fromTo('#what-supporting', { opacity: 0.3, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.2')
        .fromTo('.what-pillar-word', { opacity: 0.25, y: 20, scale: 0.95 }, { opacity: 1, y: 0, scale: 1, stagger: 0.3, duration: 0.8 })
        .fromTo('#what-final-line', { opacity: 0.3, y: 20 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.2');

      // 3. PINNED SECTION: WHAT IS A DIGITAL TWIN?
      const twinTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#sec-digital-twin',
          start: 'top top',
          end: '+=1600',
          pin: true,
          pinSpacing: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      });

      twinTl
        .fromTo('#twin-headline', { opacity: 0.4, y: 25 }, { opacity: 1, y: 0, duration: 0.6 })
        .fromTo('#twin-explainer', { opacity: 0.3, y: 20 }, { opacity: 1, y: 0, duration: 0.6 }, '-=0.2')
        .fromTo('#flow-node-1', { opacity: 0.3, x: -15 }, { opacity: 1, x: 0, duration: 0.6 })
        .fromTo('#flow-arrow-1', { opacity: 0.3 }, { opacity: 1, duration: 0.4 })
        .fromTo('#flow-node-2', { opacity: 0.3, x: -15 }, { opacity: 1, x: 0, duration: 0.6 })
        .fromTo('#flow-arrow-2', { opacity: 0.3 }, { opacity: 1, duration: 0.4 })
        .fromTo('#flow-node-3', { opacity: 0.3, x: -15 }, { opacity: 1, x: 0, duration: 0.6 })
        .fromTo('#flow-arrow-3', { opacity: 0.3 }, { opacity: 1, duration: 0.4 })
        .fromTo('#flow-node-4', { opacity: 0.3, x: -15 }, { opacity: 1, x: 0, duration: 0.6 })
        .fromTo('#flow-arrow-4', { opacity: 0.3 }, { opacity: 1, duration: 0.4 })
        .fromTo('#flow-node-5', { opacity: 0.3, x: -15 }, { opacity: 1, x: 0, duration: 0.6 })
        .fromTo('#twin-supporting-text', { opacity: 0.3, y: 20 }, { opacity: 1, y: 0, duration: 0.8 }, '-=0.2');

      // 4. PINNED SECTION: 02 PROBLEM STATEMENT (STEPPED 8-STEP SCROLL SEQUENCE)
      const whyTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#sec-problem-statement',
          start: 'top top',
          end: '+=2000',
          pin: true,
          pinSpacing: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      });

      whyTl
        // STEP 1: "02 PROBLEM STATEMENT" reveals
        .fromTo('#why-eyebrow', { opacity: 0.4, y: -10 }, { opacity: 1, y: 0, duration: 0.4 })
        // STEP 2: "SPACE MISSIONS" moves upward into view
        .fromTo('#why-head-line1', { opacity: 0.5, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.2')
        // STEP 3: "ARE COMPLEX." follows
        .fromTo('#why-head-line2', { opacity: 0.5, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.3')
        // STEP 4: The supporting paragraph appears
        .fromTo('#why-statement', { opacity: 0.2, y: 20 }, { opacity: 1, y: 0, duration: 0.7 }, '-=0.1')
        // STEP 5: Problem 01 appears
        .fromTo('#why-card-1', { opacity: 0.2, y: 30, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.8 })
        // STEP 6: Problem 02 appears
        .fromTo('#why-card-2', { opacity: 0.2, y: 30, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.8 }, '-=0.3')
        // STEP 7: Problem 03 appears
        .fromTo('#why-card-3', { opacity: 0.2, y: 30, scale: 0.96 }, { opacity: 1, y: 0, scale: 1, duration: 0.8 }, '-=0.3')
        // STEP 8: "VYOM CONNECTS THE MISSION." becomes the final visual statement
        .fromTo('#why-resolution', { opacity: 0.2, y: 20, scale: 0.97 }, { opacity: 1, y: 0, scale: 1, duration: 1.0 });

      // 5. PINNED SECTION: 03 ARCHITECTURE (HOW VYOM CONNECTS THE MISSION)
      const worksTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#sec-architecture',
          start: 'top top',
          end: '+=1800',
          pin: true,
          pinSpacing: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      });

      worksTl
        .fromTo('#works-eyebrow', { opacity: 0.4, y: -10 }, { opacity: 1, y: 0, duration: 0.4 })
        .fromTo('#works-heading', { opacity: 0.5, y: 20 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.2')
        .fromTo('#works-subtext', { opacity: 0.3, y: 15 }, { opacity: 1, y: 0, duration: 0.5 }, '-=0.2')
        .fromTo('#works-indicator-bar', { scaleX: 0.1, transformOrigin: 'left' }, { scaleX: 1, duration: 0.8 })
        .fromTo('#step-card-01', { opacity: 0.3, y: 25 }, { opacity: 1, y: 0, duration: 0.8 })
        .fromTo('#step-card-02', { opacity: 0.3, y: 25 }, { opacity: 1, y: 0, duration: 0.8 })
        .fromTo('#step-card-03', { opacity: 0.3, y: 25 }, { opacity: 1, y: 0, duration: 0.8 })
        .fromTo('#step-card-04', { opacity: 0.3, y: 25 }, { opacity: 1, y: 0, duration: 0.8 })
        .to(['#step-card-01', '#step-card-02', '#step-card-03', '#step-card-04'], { opacity: 1, duration: 0.5 });

      // 6. MISSION DIGITAL TWIN READOUT REVEAL
      gsap.from('.twin-spec-item', {
        opacity: 0,
        y: 35,
        duration: 0.8,
        stagger: 0.1,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '#sec-mission-twin-view',
          start: 'top 75%',
          once: true,
        },
      });

      // 7. MISSION TYPES REVEAL
      gsap.from('.mission-panel-row', {
        opacity: 0,
        y: 45,
        duration: 0.8,
        stagger: 0.18,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '#sec-mission-types',
          start: 'top 75%',
          once: true,
        },
      });

      // 8. MISSION CONTROL TRANSITION (FROM OBSERVATION TO COMMAND)
      const mcTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#sec-mission-control',
          start: 'top 70%',
          end: 'bottom 60%',
          scrub: 0.6,
        },
      });

      mcTl
        .from('#mc-eyebrow', { opacity: 0, y: -20, duration: 0.5 })
        .from('#mc-line-obs', { yPercent: 40, opacity: 0, duration: 1 })
        .to('#mc-line-obs', { yPercent: -20, duration: 1 })
        .from('#mc-line-cmd', { yPercent: 40, opacity: 0, duration: 1 }, '-=0.5')
        .from('#mc-description', { opacity: 0, y: 30, duration: 0.8 })
        .from('#mc-cta-box', { opacity: 0, scale: 0.95, duration: 0.8 });

      // 9. VYOM AI REVEAL
      gsap.from('.ai-reveal', {
        opacity: 0,
        y: 40,
        duration: 0.9,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '#sec-vyom-ai',
          start: 'top 75%',
          once: true,
        },
      });

      // 10. PINNED SECTION: THE DIGITAL TWIN LOOP
      const loopTl = gsap.timeline({
        scrollTrigger: {
          trigger: '#sec-twin-loop',
          start: 'top top',
          end: '+=1600',
          pin: true,
          scrub: 0.8,
          anticipatePin: 1,
        },
      });

      loopTl
        .from('#loop-node-01', { opacity: 0, scale: 0.8, duration: 0.8 })
        .from('#loop-arrow-01', { opacity: 0, y: -10, duration: 0.4 })
        .from('#loop-node-02', { opacity: 0, scale: 0.8, duration: 0.8 })
        .from('#loop-arrow-02', { opacity: 0, y: -10, duration: 0.4 })
        .from('#loop-node-03', { opacity: 0, scale: 0.8, duration: 0.8 })
        .from('#loop-arrow-03', { opacity: 0, y: -10, duration: 0.4 })
        .from('#loop-node-04', { opacity: 0, scale: 0.8, duration: 0.8 })
        .from('#loop-arrow-04', { opacity: 0, y: -10, duration: 0.4 })
        .from('#loop-node-05', { opacity: 0, scale: 0.8, duration: 0.8 })
        .from('#loop-arrow-05', { opacity: 0, y: -10, duration: 0.4 })
        .from('#loop-node-06', { opacity: 0, scale: 0.8, duration: 0.8 })
        .from('#loop-final-statement', { opacity: 0, y: 30, duration: 1.2 });

      // 11. FINAL HORIZON REVEAL
      gsap.from('.final-reveal', {
        opacity: 0,
        y: 40,
        duration: 1,
        stagger: 0.15,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: '#sec-final',
          start: 'top 80%',
          once: true,
        },
      });

      ScrollTrigger.refresh();
    }, comp);

    return () => ctx.revert();
  }, []);

  const handleLaunchDirect = (type: MissionType) => {
    const profile = MISSION_PROFILES[type];
    if (profile) setMissionConfig(profile.defaultConfig);
    startMission();
    setScreen('mission-control');
  };

  const handleCreateMission = (type: MissionType) => {
    const profile = MISSION_PROFILES[type];
    if (profile) setMissionConfig(profile.defaultConfig);
    setScreen('onboarding');
  };

  const scrollToSection = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;

    // For GSAP-pinned sections, getBoundingClientRect is not reliable.
    // Find the ScrollTrigger whose trigger element matches and use its documented start scroll position.
    const triggers = ScrollTrigger.getAll();
    const matchingTrigger = triggers.find((st) => st.trigger === el);

    if (matchingTrigger) {
      // scroll to the pixel position where this pin starts
      window.scrollTo({ top: matchingTrigger.start, behavior: 'smooth' });
    } else {
      // Non-pinned section: reliable offsetTop walk
      let top = 0;
      let node: HTMLElement | null = el;
      while (node) {
        top += node.offsetTop;
        node = node.offsetParent as HTMLElement | null;
      }
      window.scrollTo({ top: Math.max(0, top - 72), behavior: 'smooth' });
    }
  };


  // Deterministic stable telemetry values for Section 6
  const safeBattery = telemetry?.power?.batteryPercent != null && !isNaN(telemetry.power.batteryPercent)
    ? Math.max(0, Math.min(100, telemetry.power.batteryPercent)).toFixed(1)
    : '96.4';
  const safeVoltage = telemetry?.power?.voltageV != null && !isNaN(telemetry.power.voltageV)
    ? telemetry.power.voltageV.toFixed(1)
    : '28.6';
  const safeAltitude = telemetry?.orbit?.altitudeKm != null && !isNaN(telemetry.orbit.altitudeKm)
    ? telemetry.orbit.altitudeKm.toFixed(1)
    : '650.0';
  const safeVelocity = telemetry?.orbit?.velocityKms != null && !isNaN(telemetry.orbit.velocityKms)
    ? telemetry.orbit.velocityKms.toFixed(2)
    : '7.62';
  const safeSignal = telemetry?.comm?.signalDbm != null && !isNaN(telemetry.comm.signalDbm)
    ? `${telemetry.comm.signalDbm.toFixed(0)} dBm`
    : '-72 dBm';

  return (
    <div
      ref={comp}
      className="vyom-landing-root"
      style={{
        width: '100%',
        minHeight: '100vh',
        backgroundColor: '#020409',
        color: '#f0f4fc',
        fontFamily: 'var(--font-sans, "Inter", sans-serif)',
        overflowX: 'hidden',
        position: 'relative',
      }}
    >
      {/* ── Scoped Editorial Stylesheet ────────────────────────────── */}
      <style>{`
        /* Typography scale & masks */
        .overflow-line-mask {
          overflow: hidden;
          display: block;
        }

        /* Frosted Navbar with ScrollTrigger transition */
        .landing-nav {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          z-index: 1000;
          box-sizing: border-box;
          padding: 24px clamp(20px, 4vw, 56px);
          display: flex;
          align-items: center;
          justify-content: space-between;
          background: transparent;
          transition: background 0.4s ease, border-color 0.4s ease, backdrop-filter 0.4s ease, padding 0.3s ease;
        }
        .landing-nav.nav-scrolled {
          background: rgba(2, 4, 9, 0.85);
          backdrop-filter: blur(16px);
          -webkit-backdrop-filter: blur(16px);
          border-bottom: 1px solid rgba(255, 255, 255, 0.08);
          padding: 16px clamp(20px, 4vw, 56px);
        }

        /* Hero Section Grid: Left Content (50-52%), Right Contained Earth (48-50%) */
        .hero-section {
          width: 100%;
          min-height: 100svh;
          display: grid;
          grid-template-columns: minmax(0, 1.1fr) minmax(0, 0.9fr);
          align-items: center;
          gap: clamp(24px, 3.5vw, 56px);
          padding: clamp(90px, 12vh, 120px) clamp(24px, 5vw, 80px) clamp(36px, 5vh, 60px);
          box-sizing: border-box;
          position: relative;
          overflow: hidden;
          background: #020409;
        }

        .overflow-line-mask {
          display: block;
          overflow: visible;
        }

        .hero-left-content {
          position: relative;
          z-index: 2;
          width: 100%;
          overflow: visible;
          display: flex;
          flex-direction: column;
          justify-content: center;
          pointer-events: auto;
        }

        /* Earth Container: Contained within the right half of the hero (NO ZOOM) */
        .earth-hero-wrapper {
          position: relative;
          width: 100%;
          max-width: 600px;
          aspect-ratio: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          margin: 0 auto;
          pointer-events: none;
          z-index: 1;
        }
        .earth-hero-video {
          width: 100%;
          height: 100%;
          object-fit: contain;
          object-position: center center;
          display: block;
          filter: contrast(1.04) brightness(0.98);
        }
        .earth-hero-vignette {
          position: absolute;
          inset: -4%;
          background: radial-gradient(circle at center, transparent 48%, rgba(2,4,9,0.3) 72%, #020409 98%);
          pointer-events: none;
        }

        /* Problem Statement Card hover */
        .why-card {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: 36px 28px;
          background: rgba(3, 8, 18, 0.55);
          transition: border-color 0.3s ease, background 0.3s ease, transform 0.3s ease, box-shadow 0.3s ease;
        }
        .why-card:hover {
          border-color: rgba(0, 212, 255, 0.4);
          background: rgba(4, 12, 28, 0.85);
          transform: translateY(-4px);
          box-shadow: 0 12px 32px rgba(0, 212, 255, 0.08);
        }

        /* General Section Containers */
        .editorial-section {
          width: 100%;
          box-sizing: border-box;
          padding: clamp(90px, 14vh, 160px) clamp(20px, 6vw, 84px);
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          position: relative;
        }
        .pinned-section {
          width: 100%;
          min-height: 100vh;
          box-sizing: border-box;
          padding: clamp(80px, 12vh, 140px) clamp(20px, 6vw, 84px);
          display: flex;
          align-items: center;
          justify-content: center;
          border-top: 1px solid rgba(255, 255, 255, 0.05);
          position: relative;
        }
        .section-inner {
          max-width: 1240px;
          margin: 0 auto;
          width: 100%;
          box-sizing: border-box;
        }

        /* Architecture Flow Node */
        .flow-node-box {
          border: 1px solid rgba(0, 212, 255, 0.25);
          background: rgba(0, 212, 255, 0.04);
          border-radius: 6px;
          padding: 24px 20px;
          text-align: center;
          min-width: 180px;
          box-sizing: border-box;
          transition: border-color 0.3s ease, background 0.3s ease;
        }
        .flow-node-box:hover {
          border-color: rgba(0, 212, 255, 0.6);
          background: rgba(0, 212, 255, 0.08);
        }

        /* Missions Responsive Panel Row */
        .mission-panel-row {
          border: 1px solid rgba(255, 255, 255, 0.08);
          border-radius: 8px;
          padding: clamp(20px, 3vw, 36px) clamp(20px, 3.5vw, 40px);
          background: rgba(3, 8, 18, 0.65);
          display: grid;
          grid-template-columns: 60px 1.4fr 1.1fr auto;
          align-items: center;
          gap: clamp(16px, 2.5vw, 36px);
          transition: border-color 0.25s ease, background 0.25s ease, transform 0.25s ease;
          cursor: pointer;
        }
        .mission-panel-row:hover {
          border-color: rgba(255, 255, 255, 0.24);
          background: rgba(5, 14, 30, 0.88);
          transform: translateY(-2px);
        }

        /* Loop Node Pill */
        .loop-pill {
          border: 1px solid rgba(255, 255, 255, 0.12);
          border-radius: 4px;
          padding: 14px 28px;
          font-family: var(--font-editorial, 'Syne', sans-serif);
          font-size: clamp(16px, 2vw, 24px);
          letter-spacing: 0.15em;
          color: #f0f4fc;
          background: rgba(255, 255, 255, 0.02);
          transition: all 0.3s ease;
        }
        .loop-pill:hover {
          border-color: #00d4ff;
          color: #00d4ff;
          background: rgba(0, 212, 255, 0.08);
        }

        /* Breakpoints & Responsive Stack */
        @media (max-width: 1100px) {
          .landing-sub-brand,
          .landing-sub-brand-sep {
            display: none !important;
          }
        }

        @media (max-width: 900px) {
          .hero-section {
            grid-template-columns: 1fr;
            padding: 100px 24px 60px;
            gap: 36px;
          }
          .hero-left-content {
            max-width: 100%;
          }
          .earth-hero-wrapper {
            max-width: min(440px, 85vw);
            margin: 16px auto 0 auto;
          }
          .flow-container {
            flex-direction: column !important;
            gap: 16px !important;
          }
          .flow-arrow-graphic {
            transform: rotate(90deg);
            margin: 4px auto !important;
          }
          .mission-panel-row {
            grid-template-columns: 50px 1fr auto;
          }
          .mission-panel-meta {
            display: none;
          }
        }

        @media (max-width: 768px) {
          .landing-nav-links {
            display: none !important;
          }
          .works-grid-process {
            grid-template-columns: 1fr !important;
          }
          .why-grid-problems {
            grid-template-columns: 1fr !important;
          }
          .twin-spec-grid {
            grid-template-columns: 1fr 1fr !important;
          }
        }

        @media (max-width: 540px) {
          .twin-spec-grid {
            grid-template-columns: 1fr !important;
          }
          .mission-panel-row {
            grid-template-columns: 1fr;
            gap: 12px;
          }
        }
      `}</style>

      {/* ── Subtle Top Scroll Progress Indicator ──────────────────── */}
      <div
        ref={progressRef}
        style={{
          position: 'fixed',
          top: 0,
          left: 0,
          height: 2,
          backgroundColor: '#00d4ff',
          zIndex: 9999,
          width: '0%',
          pointerEvents: 'none',
          boxShadow: '0 0 8px rgba(0, 212, 255, 0.8)',
        }}
      />

      {/* ── Minimal Editorial Navigation ────────────────────────────── */}
      <nav ref={navRef} className="landing-nav">
        <div style={{ display: 'flex', alignItems: 'center', gap: 14 }}>
          <span
            style={{
              fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
              fontSize: 19,
              fontWeight: 800,
              letterSpacing: '0.22em',
              color: '#ffffff',
            }}
          >
            VYOM
          </span>
          <span
            className="landing-sub-brand-sep"
            style={{
              width: 1,
              height: 14,
              backgroundColor: 'rgba(255,255,255,0.18)',
            }}
          />
          <span
            className="landing-sub-brand"
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 9,
              letterSpacing: '0.14em',
              color: 'rgba(255,255,255,0.4)',
              textTransform: 'uppercase',
            }}
          >
            Digital Space Mission Twin
          </span>
        </div>

        <div className="landing-nav-links" style={{ display: 'flex', alignItems: 'center', gap: 28 }}>
          <button
            onClick={() => scrollToSection('sec-what-is-vyom')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.14em', transition: 'color 0.2s ease' }}
          >
            01 ABOUT
          </button>
          <button
            onClick={() => scrollToSection('sec-demo')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.14em', transition: 'color 0.2s ease' }}
          >
            02 DEMO
          </button>
          <button
            onClick={() => scrollToSection('sec-architecture')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.14em', transition: 'color 0.2s ease' }}
          >
            03 ARCHITECTURE
          </button>
          <button
            onClick={() => scrollToSection('sec-missions')}
            style={{ background: 'none', border: 'none', color: 'rgba(255,255,255,0.7)', cursor: 'pointer', fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.14em', transition: 'color 0.2s ease' }}
          >
            04 MISSIONS
          </button>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <button
            onClick={() => setScreen('onboarding')}
            style={{
              background: '#ffffff',
              color: '#020409',
              border: 'none',
              borderRadius: 3,
              padding: '9px 18px',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              fontWeight: 700,
              letterSpacing: '0.12em',
              cursor: 'pointer',
              transition: 'all 0.2s ease',
            }}
          >
            CREATE MISSION
          </button>
        </div>
      </nav>

      {/* ==============================================================
          01 HERO — "ENTER VYOM" (FULL SCREEN 2-COLUMN COMPOSITION)
          ============================================================== */}
      <section id="sec-hero" className="hero-section">
        {/* Left Editorial Narrative (45–50%) */}
        <div className="hero-left-content">
          <div
            className="hero-eyebrow"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              letterSpacing: '0.24em',
              color: 'rgba(0, 212, 255, 0.85)',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            <span style={{ width: 6, height: 6, borderRadius: '50%', backgroundColor: '#00d4ff' }} />
            VYOM
          </div>

          <h1
            style={{
              margin: '0 0 20px 0',
              fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
              fontSize: 'clamp(24px, 3.8vw, 62px)',
              fontWeight: 800,
              lineHeight: 0.98,
              letterSpacing: '-0.03em',
              color: '#f0f4fc',
            }}
          >
            <span className="overflow-line-mask">
              <span className="hero-title-line" style={{ display: 'inline-block', whiteSpace: 'nowrap', paddingRight: '0.15em' }}>
                INTELLIGENT
              </span>
            </span>
            <span className="overflow-line-mask">
              <span className="hero-title-line" style={{ display: 'inline-block', whiteSpace: 'nowrap', paddingRight: '0.15em' }}>
                DIGITAL
              </span>
            </span>
            <span className="overflow-line-mask">
              <span className="hero-title-line" style={{ display: 'inline-block', whiteSpace: 'nowrap', paddingRight: '0.15em' }}>
                SPACE
              </span>
            </span>
            <span className="overflow-line-mask">
              <span className="hero-title-line" style={{ display: 'inline-block', whiteSpace: 'nowrap', paddingRight: '0.15em' }}>
                MISSION
              </span>
            </span>
            <span className="overflow-line-mask">
              <span className="hero-title-line" style={{ display: 'inline-block', whiteSpace: 'nowrap', paddingRight: '0.15em', color: 'rgba(255,255,255,0.48)' }}>
                TWIN
              </span>
            </span>
          </h1>

          <div
            className="hero-quote"
            style={{
              fontFamily: 'var(--font-serif, "Cormorant Garamond", serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(17px, 1.8vw, 24px)',
              lineHeight: 1.4,
              color: 'rgba(240, 244, 252, 0.9)',
              marginBottom: 16,
              borderLeft: '2px solid rgba(0, 212, 255, 0.5)',
              paddingLeft: 16,
            }}
          >
            "Observe. Analyze. Simulate. Command."
          </div>

          <p
            className="hero-desc"
            style={{
              fontFamily: 'var(--font-sans, "Inter", sans-serif)',
              fontSize: 'clamp(14px, 1.1vw, 16px)',
              lineHeight: 1.65,
              color: 'rgba(255, 255, 255, 0.65)',
              maxWidth: 540,
              margin: '0 0 32px 0',
              fontWeight: 300,
            }}
          >
            VYOM transforms complex space missions into an intelligent digital environment for real-time monitoring, simulation and mission intelligence.
          </p>

          <div className="hero-cta-wrap" style={{ display: 'flex', alignItems: 'center', gap: 16, flexWrap: 'wrap' }}>
            <button
              onClick={() => setScreen('onboarding')}
              style={{
                backgroundColor: '#f0f4fc',
                color: '#020409',
                border: 'none',
                borderRadius: 4,
                padding: '14px 28px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 11,
                fontWeight: 700,
                letterSpacing: '0.14em',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              CREATE MISSION
            </button>

            <button
              onClick={() => scrollToSection('sec-demo')}
              style={{
                backgroundColor: 'transparent',
                color: '#f0f4fc',
                border: '1px solid rgba(255, 255, 255, 0.28)',
                borderRadius: 4,
                padding: '14px 24px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 11,
                fontWeight: 600,
                letterSpacing: '0.14em',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              02 DEMO ↓
            </button>
          </div>

          <div
            className="hero-meta"
            style={{
              marginTop: 40,
              display: 'flex',
              alignItems: 'center',
              gap: 24,
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 9.5,
              letterSpacing: '0.14em',
              color: 'rgba(255, 255, 255, 0.35)',
              textTransform: 'uppercase',
            }}
          >
            <div>DIGITAL SPACE MISSION SYSTEM</div>
            <div style={{ width: 4, height: 4, borderRadius: '50%', backgroundColor: 'rgba(255,255,255,0.2)' }} />
            <div>REAL-TIME MISSION INTELLIGENCE</div>
          </div>

          <div
            className="hero-scroll-indicator"
            style={{
              marginTop: 28,
              display: 'flex',
              alignItems: 'center',
              gap: 8,
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 9,
              letterSpacing: '0.18em',
              color: 'rgba(0, 212, 255, 0.7)',
              cursor: 'pointer',
            }}
            onClick={() => scrollToSection('sec-what-is-vyom')}
          >
            <span>SCROLL TO EXPLORE</span>
            <span style={{ fontSize: 13 }}>↓</span>
          </div>
        </div>

        {/* Right Locked Earth Video Container (50–55%) */}
        <div ref={earthContainerRef} className="earth-hero-wrapper">
          <video
            ref={videoRef}
            src="/animations/Landing page rotating earth.mp4"
            autoPlay
            loop
            muted
            playsInline
            className="earth-hero-video"
          />
          <div className="earth-hero-vignette" />
        </div>
      </section>

      {/* ==============================================================
          02 WHAT IS VYOM? (PINNED SCRUBBED TIMELINE)
          ============================================================== */}
      <section id="sec-what-is-vyom" className="pinned-section">
        <div className="section-inner" style={{ textAlign: 'center', maxWidth: 960 }}>
          <div
            id="what-eyebrow"
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10,
              letterSpacing: '0.24em',
              color: 'rgba(0, 212, 255, 0.85)',
              textTransform: 'uppercase',
              marginBottom: 16,
            }}
          >
            01 · ABOUT VYOM
          </div>

          <div
            id="what-title"
            style={{
              fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
              fontSize: 'clamp(44px, 7vw, 96px)',
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: '-0.03em',
              color: '#f0f4fc',
              marginBottom: 40,
            }}
          >
            WHAT IS<br />
            <span style={{ color: '#00d4ff' }}>VYOM?</span>
          </div>

          <div
            id="what-statement"
            style={{
              fontFamily: 'var(--font-serif, "Cormorant Garamond", serif)',
              fontSize: 'clamp(24px, 3.2vw, 44px)',
              lineHeight: 1.25,
              color: '#ffffff',
              marginBottom: 24,
              fontStyle: 'italic',
            }}
          >
            "VYOM is an intelligent digital space mission twin designed to bring the mission environment into a single interactive system."
          </div>

          <p
            id="what-supporting"
            style={{
              fontFamily: 'var(--font-sans, "Inter", sans-serif)',
              fontSize: 'clamp(14px, 1.2vw, 18px)',
              lineHeight: 1.7,
              color: 'rgba(255, 255, 255, 0.65)',
              maxWidth: 720,
              margin: '0 auto 48px auto',
              fontWeight: 300,
            }}
          >
            It connects mission visualization, spacecraft telemetry, simulation, mission status and AI-assisted analysis into one unified operational experience.
          </p>

          {/* Capability Stats Row */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(4, 1fr)',
            gap: 20,
            margin: '0 auto 40px auto',
            maxWidth: 880,
          }}>
            {[
              { value: '4', unit: 'MISSION TYPES', label: 'Earth Obs · Deep Space · Comm · Crewed', color: '#00d4ff' },
              { value: '7200×', unit: 'TIME DILATION', label: 'Mission days per real-world minute', color: '#9b5de5' },
              { value: '100%', unit: 'DETERMINISTIC', label: 'Physics-based telemetry engine', color: '#00ff88' },
              { value: 'AI', unit: 'COPILOT', label: 'Conversational mission intelligence', color: '#ff8c00' },
            ].map(({ value, unit, label, color }) => (
              <div key={unit} style={{
                background: 'rgba(255,255,255,0.03)',
                border: '1px solid rgba(255,255,255,0.08)',
                borderRadius: 8,
                padding: '20px 16px',
                textAlign: 'center',
              }}>
                <div style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 'clamp(28px, 3.5vw, 44px)', fontWeight: 800, color, lineHeight: 1, marginBottom: 4 }}>{value}</div>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.5)', marginBottom: 8 }}>{unit}</div>
                <div style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 11, color: 'rgba(255,255,255,0.35)', lineHeight: 1.4 }}>{label}</div>
              </div>
            ))}
          </div>

          {/* Four Pillars */}
          <div style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 'clamp(16px, 4vw, 56px)',
            flexWrap: 'wrap',
            marginBottom: 32,
          }}>
            <div className="what-pillar-word" style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 'clamp(22px, 3.2vw, 48px)', fontWeight: 800, letterSpacing: '0.08em', color: '#00d4ff' }}>OBSERVE.</div>
            <div className="what-pillar-word" style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 'clamp(22px, 3.2vw, 48px)', fontWeight: 800, letterSpacing: '0.08em', color: '#9b5de5' }}>ANALYZE.</div>
            <div className="what-pillar-word" style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 'clamp(22px, 3.2vw, 48px)', fontWeight: 800, letterSpacing: '0.08em', color: '#ff8c00' }}>SIMULATE.</div>
            <div className="what-pillar-word" style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 'clamp(22px, 3.2vw, 48px)', fontWeight: 800, letterSpacing: '0.08em', color: '#00ff88' }}>COMMAND.</div>
          </div>

          {/* Key Capabilities List */}
          <div style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(3, 1fr)',
            gap: 12,
            maxWidth: 900,
            margin: '0 auto 32px auto',
            textAlign: 'left',
          }}>
            {[
              { icon: '◎', label: 'REAL-TIME 3D ORBIT', desc: 'Live spacecraft position, pass windows and orbital parameters rendered in real-time 3D.' },
              { icon: '⚡', label: 'TELEMETRY ENGINE', desc: 'Physics-based power, thermal, attitude and propulsion telemetry — no random jitter.' },
              { icon: '⬡', label: 'DIGITAL TWIN', desc: 'A synchronized model of your mission environment updated every simulation tick.' },
              { icon: '◈', label: 'THREAT DETECTION', desc: 'Space weather, micrometeorite impact, attitude anomaly and fuel depletion alerts.' },
              { icon: '∿', label: 'MISSION AI', desc: 'Conversational copilot that interprets telemetry and answers mission questions.' },
              { icon: '⊞', label: 'MISSION ARCHIVE', desc: 'Full black-box recording and post-mission replay for every completed mission.' },
            ].map(({ icon, label, desc }) => (
              <div key={label} style={{
                background: 'rgba(0,212,255,0.03)',
                border: '1px solid rgba(0,212,255,0.1)',
                borderRadius: 6,
                padding: '14px 16px',
              }}>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 16, color: '#00d4ff', marginBottom: 6 }}>{icon}</div>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, letterSpacing: '0.16em', color: '#00d4ff', marginBottom: 6 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 11.5, color: 'rgba(255,255,255,0.5)', lineHeight: 1.55 }}>{desc}</div>
              </div>
            ))}
          </div>

          <div id="what-final-line" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, letterSpacing: '0.18em', color: 'rgba(255, 255, 255, 0.35)', textTransform: 'uppercase' }}>
            From raw mission data to meaningful mission intelligence.
          </div>
        </div>
      </section>

      {/* ==============================================================
          03 WHAT IS A DIGITAL TWIN? (PINNED TECHNICAL GRAPHIC FLOW)
          ============================================================== */}
      <section id="sec-digital-twin" className="pinned-section">
        <div className="section-inner" style={{ maxWidth: 1100 }}>
          <div style={{ textAlign: 'center', marginBottom: 40 }}>
            <h2
              id="twin-headline"
              style={{
                fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                fontSize: 'clamp(34px, 5.2vw, 76px)',
                fontWeight: 800,
                lineHeight: 0.98,
                letterSpacing: '-0.03em',
                color: '#f0f4fc',
                margin: '0 0 20px 0',
              }}
            >
              WHAT IS<br />
              <span style={{ color: '#00d4ff' }}>A DIGITAL TWIN?</span>
            </h2>

            <p
              id="twin-explainer"
              style={{
                fontFamily: 'var(--font-sans, "Inter", sans-serif)',
                fontSize: 'clamp(14px, 1.15vw, 17px)',
                lineHeight: 1.68,
                color: 'rgba(255, 255, 255, 0.72)',
                maxWidth: 820,
                margin: '0 auto',
                fontWeight: 300,
              }}
            >
              "A digital twin is a digital representation of a real-world system that can be continuously updated using data from its physical counterpart."
              <br /><br />
              In VYOM, the digital twin represents the mission environment by connecting spacecraft state, telemetry, mission events and operational context.
            </p>
          </div>

          {/* Architecture Pipeline Graphic */}
          <div
            className="flow-container"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              margin: '0 auto 36px auto',
              flexWrap: 'wrap',
            }}
          >
            <div id="flow-node-1" className="flow-node-box">
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginBottom: 4 }}>
                01 PHYSICAL
              </div>
              <div style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 15, fontWeight: 700, color: '#f0f4fc' }}>
                REAL MISSION
              </div>
            </div>

            <div id="flow-arrow-1" className="flow-arrow-graphic" style={{ color: 'rgba(0, 212, 255, 0.5)', fontSize: 16, fontFamily: 'monospace' }}>
              →
            </div>

            <div id="flow-node-2" className="flow-node-box">
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginBottom: 4 }}>
                02 INGESTION
              </div>
              <div style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 15, fontWeight: 700, color: '#00d4ff' }}>
                MISSION DATA
              </div>
            </div>

            <div id="flow-arrow-2" className="flow-arrow-graphic" style={{ color: 'rgba(0, 212, 255, 0.5)', fontSize: 16, fontFamily: 'monospace' }}>
              →
            </div>

            <div id="flow-node-3" className="flow-node-box">
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginBottom: 4 }}>
                03 SPATIAL MODEL
              </div>
              <div style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 15, fontWeight: 700, color: '#9b5de5' }}>
                DIGITAL REPR.
              </div>
            </div>

            <div id="flow-arrow-3" className="flow-arrow-graphic" style={{ color: 'rgba(0, 212, 255, 0.5)', fontSize: 16, fontFamily: 'monospace' }}>
              →
            </div>

            <div id="flow-node-4" className="flow-node-box">
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.12em', marginBottom: 4 }}>
                04 EVALUATION
              </div>
              <div style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 15, fontWeight: 700, color: '#ff8c00' }}>
                ANALYSIS
              </div>
            </div>

            <div id="flow-arrow-4" className="flow-arrow-graphic" style={{ color: 'rgba(0, 255, 136, 0.5)', fontSize: 16, fontFamily: 'monospace' }}>
              →
            </div>

            <div id="flow-node-5" className="flow-node-box" style={{ borderColor: 'rgba(0, 255, 136, 0.4)', background: 'rgba(0, 255, 136, 0.05)' }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(0,255,136,0.6)', letterSpacing: '0.12em', marginBottom: 4 }}>
                05 ACTION
              </div>
              <div style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 15, fontWeight: 700, color: '#00ff88' }}>
                DECISION
              </div>
            </div>
          </div>

          <div
            id="twin-supporting-text"
            style={{
              textAlign: 'center',
              fontFamily: 'var(--font-serif, "Cormorant Garamond", serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(19px, 2vw, 26px)',
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.88)',
            }}
          >
            "VYOM turns mission data into mission context."
          </div>
        </div>
      </section>

      {/* ==============================================================
          02 PROBLEM STATEMENT (SPACE MISSIONS ARE COMPLEX)
          ============================================================== */}
      <section id="sec-problem-statement" className="pinned-section" style={{ background: '#020409' }}>
        <div id="sec-why-vyom" className="section-inner" style={{ maxWidth: 1160 }}>
          <div style={{ textAlign: 'center', marginBottom: 36 }}>
            <div
              id="why-eyebrow"
              style={{
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 10.5,
                letterSpacing: '0.24em',
                color: 'rgba(255, 77, 77, 0.9)',
                textTransform: 'uppercase',
                marginBottom: 12,
              }}
            >
              02 · PROBLEM STATEMENT
            </div>
            <h2
              id="why-headline"
              style={{
                fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                fontSize: 'clamp(34px, 4.8vw, 76px)',
                fontWeight: 800,
                lineHeight: 0.96,
                letterSpacing: '-0.03em',
                color: '#f0f4fc',
                margin: '0 0 16px 0',
              }}
            >
              <div id="why-head-line1">SPACE MISSIONS</div>
              <div id="why-head-line2" style={{ color: '#ff4d4d' }}>ARE COMPLEX.</div>
            </h2>

            <p
              id="why-statement"
              style={{
                fontFamily: 'var(--font-sans, "Inter", sans-serif)',
                fontSize: 'clamp(14px, 1.15vw, 17px)',
                lineHeight: 1.65,
                color: 'rgba(255, 255, 255, 0.72)',
                maxWidth: 820,
                margin: '0 auto',
                fontWeight: 300,
              }}
            >
              Modern space missions generate enormous amounts of data across spacecraft systems, telemetry streams, mission events and operational tools. Yet having more data does not automatically create better mission awareness — it can increase cognitive load and slow down critical decision-making.
            </p>
          </div>

          {/* Impact Stats */}
          <div style={{ display: 'flex', justifyContent: 'center', gap: 40, marginBottom: 40, flexWrap: 'wrap' }}>
            {[
              { stat: '>12', label: 'SEPARATE SYSTEMS', sub: 'in a typical mission ground segment', color: '#ff4d4d' },
              { stat: '3–7×', label: 'CONTEXT SWITCH PENALTY', sub: 'cognitive overhead switching between tools', color: '#ff8c00' },
              { stat: '40%', label: 'DECISION LATENCY', sub: 'of critical response time lost to data correlation', color: '#00d4ff' },
            ].map(({ stat, label, sub, color }) => (
              <div key={label} style={{ textAlign: 'center', minWidth: 180 }}>
                <div style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 'clamp(32px, 4.5vw, 60px)', fontWeight: 800, color, lineHeight: 1, marginBottom: 6 }}>{stat}</div>
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, letterSpacing: '0.18em', color: 'rgba(255,255,255,0.6)', marginBottom: 4 }}>{label}</div>
                <div style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 11, color: 'rgba(255,255,255,0.35)', maxWidth: 200 }}>{sub}</div>
              </div>
            ))}
          </div>

          <div
            className="why-grid-problems"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, 1fr)',
              gap: 24,
              marginBottom: 40,
            }}
          >
            {/* Problem 01 */}
            <div id="why-card-1" className="why-card why-card-01">
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#ff4d4d', letterSpacing: '0.14em', marginBottom: 12 }}>
                01 — DISCONNECTED DATA
              </div>
              <h3 style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 20, fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>
                Fragmented Systems
              </h3>
              <p style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255, 255, 255, 0.65)', margin: '0 0 12px 0' }}>
                Mission information is distributed across telemetry servers, orbit propagators, ground station software, and scheduling tools — creating gaps in situational awareness.
              </p>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,77,77,0.6)', letterSpacing: '0.12em' }}>
                IMPACT: Delayed anomaly detection · Missed correlations
              </div>
            </div>

            {/* Problem 02 */}
            <div id="why-card-2" className="why-card why-card-02">
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#ff8c00', letterSpacing: '0.14em', marginBottom: 12 }}>
                02 — LIMITED CONTEXT
              </div>
              <h3 style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 20, fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>
                Raw Data Silos
              </h3>
              <p style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255, 255, 255, 0.65)', margin: '0 0 12px 0' }}>
                Telemetry values surface raw numbers — voltage drops, attitude drift, battery readings — without the mission context to understand their significance or urgency.
              </p>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,140,0,0.6)', letterSpacing: '0.12em' }}>
                IMPACT: Misread anomalies · Incorrect severity triage
              </div>
            </div>

            {/* Problem 03 */}
            <div id="why-card-3" className="why-card why-card-03">
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#00d4ff', letterSpacing: '0.14em', marginBottom: 12 }}>
                03 — SLOW DECISION MAKING
              </div>
              <h3 style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 20, fontWeight: 700, margin: '0 0 12px 0', color: '#ffffff' }}>
                Operational Latency
              </h3>
              <p style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 13.5, lineHeight: 1.65, color: 'rgba(255, 255, 255, 0.65)', margin: '0 0 12px 0' }}>
                When conditions change rapidly — eclipse transitions, thermal excursions, orbital debris conjunctions — operators need pre-correlated context and decision-ready outputs, not raw data.
              </p>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(0,212,255,0.6)', letterSpacing: '0.12em' }}>
                IMPACT: Response delays · Suboptimal resource allocation
              </div>
            </div>
          </div>

          <div
            id="why-resolution"
            style={{
              textAlign: 'center',
              borderTop: '1px solid rgba(255, 255, 255, 0.08)',
              paddingTop: 32,
            }}
          >
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, letterSpacing: '0.2em', color: 'rgba(0, 212, 255, 0.8)', textTransform: 'uppercase', marginBottom: 10 }}>
              THE RESOLUTION
            </div>
            <div style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 'clamp(26px, 3.8vw, 52px)', fontWeight: 800, color: '#f0f4fc', marginBottom: 10 }}>
              VYOM CONNECTS THE MISSION.
            </div>
            <p style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 14, color: 'rgba(255, 255, 255, 0.65)', maxWidth: 680, margin: '0 auto 20px auto' }}>
              VYOM unifies spacecraft telemetry, digital-twin visualization, threat intelligence, and AI-assisted analysis into one coherent mission environment — so operators see the mission, not just the data.
            </p>
            <button
              onClick={() => scrollToSection('sec-demo')}
              style={{
                background: 'rgba(0,212,255,0.1)',
                border: '1px solid rgba(0,212,255,0.35)',
                borderRadius: 4,
                padding: '10px 24px',
                color: '#00d4ff',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 10,
                letterSpacing: '0.16em',
                cursor: 'pointer',
              }}
            >
              SEE DEMO ↓
            </button>
          </div>
        </div>
      </section>

      {/* ==============================================================
          03 ARCHITECTURE (HOW VYOM CONNECTS THE MISSION)
          ============================================================== */}
      <section id="sec-architecture" className="pinned-section">
        <div id="sec-how-it-works" className="section-inner" style={{ maxWidth: 1180 }}>
          <div style={{ textAlign: 'center', marginBottom: 32 }}>
            <div id="works-eyebrow" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5, letterSpacing: '0.24em', color: 'rgba(0, 212, 255, 0.85)', textTransform: 'uppercase', marginBottom: 8 }}>
              03 · ARCHITECTURE
            </div>
            <h2
              id="works-heading"
              style={{
                fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                fontSize: 'clamp(34px, 4.8vw, 72px)',
                fontWeight: 800,
                lineHeight: 0.98,
                letterSpacing: '-0.03em',
                color: '#f0f4fc',
                margin: '0 0 16px 0',
              }}
            >
              HOW VYOM<br />
              CONNECTS THE<br />
              <span style={{ color: '#00d4ff' }}>MISSION.</span>
            </h2>
            <p
              id="works-subtext"
              style={{
                fontFamily: 'var(--font-sans, "Inter", sans-serif)',
                fontSize: 'clamp(14px, 1.1vw, 17px)',
                lineHeight: 1.65,
                color: 'rgba(255, 255, 255, 0.7)',
                maxWidth: 760,
                margin: '0 auto 28px auto',
                fontWeight: 300,
              }}
            >
              "VYOM connects physical mission data with a continuously evolving digital representation of the mission environment."
            </p>
          </div>

          {/* Conceptual System Pipeline Flow */}
          <div
            id="works-indicator-bar"
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 10.5,
              letterSpacing: '0.14em',
              color: 'rgba(255, 255, 255, 0.45)',
              marginBottom: 40,
              flexWrap: 'wrap',
            }}
          >
            <span>SPACECRAFT</span>
            <span style={{ color: '#00d4ff' }}>↓</span>
            <span>TELEMETRY</span>
            <span style={{ color: '#00d4ff' }}>↓</span>
            <span style={{ color: '#00d4ff' }}>DIGITAL TWIN</span>
            <span style={{ color: '#00d4ff' }}>↓</span>
            <span>ANALYSIS</span>
            <span style={{ color: '#00d4ff' }}>↓</span>
            <span>MISSION INTELLIGENCE</span>
            <span style={{ color: '#00ff88' }}>↓</span>
            <span style={{ color: '#00ff88' }}>MISSION CONTROL</span>
          </div>

          <div
            className="works-grid-process"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 20,
            }}
          >
            {/* Step 01 */}
            <div
              id="step-card-01"
              style={{
                border: '1px solid rgba(0, 212, 255, 0.25)',
                borderRadius: 8,
                padding: '30px 20px',
                background: 'rgba(0, 212, 255, 0.03)',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#00d4ff', letterSpacing: '0.16em', marginBottom: 12 }}>
                01 — OBSERVE
              </div>
              <h4 style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 19, fontWeight: 700, margin: '0 0 10px 0', color: '#ffffff' }}>
                State Capture
              </h4>
              <p style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 13, lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
                Capture and visualize mission state, spacecraft information and telemetry in real time.
              </p>
            </div>

            {/* Step 02 */}
            <div
              id="step-card-02"
              style={{
                border: '1px solid rgba(155, 93, 229, 0.25)',
                borderRadius: 8,
                padding: '32px 22px',
                background: 'rgba(155, 93, 229, 0.03)',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#9b5de5', letterSpacing: '0.16em', marginBottom: 12 }}>
                02 — ANALYZE
              </div>
              <h4 style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 20, fontWeight: 700, margin: '0 0 10px 0', color: '#ffffff' }}>
                Operational Insight
              </h4>
              <p style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 13, lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
                Transform complex telemetry streams into meaningful operational insights and health metrics.
              </p>
            </div>

            {/* Step 03 */}
            <div
              id="step-card-03"
              style={{
                border: '1px solid rgba(255, 140, 0, 0.25)',
                borderRadius: 8,
                padding: '32px 22px',
                background: 'rgba(255, 140, 0, 0.03)',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#ff8c00', letterSpacing: '0.16em', marginBottom: 12 }}>
                03 — SIMULATE
              </div>
              <h4 style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 20, fontWeight: 700, margin: '0 0 10px 0', color: '#ffffff' }}>
                Scenario Testing
              </h4>
              <p style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 13, lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
                Explore mission scenarios and evaluate physical outcomes in the digital twin before acting.
              </p>
            </div>

            {/* Step 04 */}
            <div
              id="step-card-04"
              style={{
                border: '1px solid rgba(0, 255, 136, 0.25)',
                borderRadius: 8,
                padding: '32px 22px',
                background: 'rgba(0, 255, 136, 0.03)',
              }}
            >
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, color: '#00ff88', letterSpacing: '0.16em', marginBottom: 12 }}>
                04 — COMMAND
              </div>
              <h4 style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 20, fontWeight: 700, margin: '0 0 10px 0', color: '#ffffff' }}>
                Executable Action
              </h4>
              <p style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 13, lineHeight: 1.6, color: 'rgba(255, 255, 255, 0.6)', margin: 0 }}>
                Bring the resulting intelligence directly into the unified Mission Control execution workflow.
              </p>
            </div>
          </div>
        </div>
      </section>

      {/* ==============================================================
          06 MISSION DIGITAL TWIN (SEE THE MISSION)
          ============================================================== */}
      <section id="sec-mission-twin-view" className="editorial-section">
        <div className="section-inner">
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 48, alignItems: 'center', marginBottom: 48 }}>
            <div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.2em', color: 'rgba(0, 212, 255, 0.8)', textTransform: 'uppercase', marginBottom: 12 }}>
                SPATIAL ENVIRONMENT
              </div>
              <h2
                style={{
                  fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                  fontSize: 'clamp(36px, 5.5vw, 76px)',
                  fontWeight: 800,
                  lineHeight: 0.98,
                  letterSpacing: '-0.03em',
                  color: '#f0f4fc',
                  margin: '0 0 20px 0',
                }}
              >
                SEE THE<br />
                <span style={{ color: '#00d4ff' }}>MISSION.</span>
              </h2>
              <p
                style={{
                  fontFamily: 'var(--font-sans, "Inter", sans-serif)',
                  fontSize: 15,
                  lineHeight: 1.65,
                  color: 'rgba(255, 255, 255, 0.6)',
                  margin: 0,
                  fontWeight: 300,
                }}
              >
                VYOM creates an interactive mission environment where spacecraft, mission state and operational data can be understood spatially.
              </p>
            </div>

            <div
              style={{
                border: '1px solid rgba(255, 255, 255, 0.08)',
                borderRadius: 8,
                padding: '24px 28px',
                background: 'rgba(3, 8, 18, 0.7)',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 11,
              }}
            >
              <div style={{ color: 'rgba(255,255,255,0.4)', marginBottom: 8, letterSpacing: '0.12em' }}>
                COORDINATE PROJECTION STANDARD
              </div>
              <div style={{ color: '#f0f4fc', lineHeight: 1.8 }}>
                <div>r = R_Earth + Altitude_km</div>
                <div>v = √(μ / r) · Instantaneous Keplerian Velocity</div>
                <div>J2 Zonal Harmonic Secular Drift Compensated</div>
              </div>
            </div>
          </div>

          {/* Restrained Telemetry Grid — 100% Deterministic & Stable */}
          <div
            className="twin-spec-grid"
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(4, 1fr)',
              gap: 16,
            }}
          >
            <div className="twin-spec-item" style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6, padding: '20px 18px', background: 'rgba(2, 4, 9, 0.6)' }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4 }}>
                MISSION STATUS
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14, fontWeight: 700, color: '#00ff88' }}>
                NOMINAL OPERATIONS
              </div>
            </div>

            <div className="twin-spec-item" style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6, padding: '20px 18px', background: 'rgba(2, 4, 9, 0.6)' }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4 }}>
                SPACECRAFT ALTITUDE
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 16, fontWeight: 700, color: '#f0f4fc' }}>
                {safeAltitude} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>KM</span>
              </div>
            </div>

            <div className="twin-spec-item" style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6, padding: '20px 18px', background: 'rgba(2, 4, 9, 0.6)' }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4 }}>
                ORBITAL VELOCITY
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 16, fontWeight: 700, color: '#f0f4fc' }}>
                {safeVelocity} <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.4)' }}>KM/S</span>
              </div>
            </div>

            <div className="twin-spec-item" style={{ border: '1px solid rgba(0, 212, 255, 0.3)', borderRadius: 6, padding: '20px 18px', background: 'rgba(0, 212, 255, 0.03)' }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: '#00d4ff', letterSpacing: '0.14em', marginBottom: 4 }}>
                BATTERY STATE (SoC)
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 16, fontWeight: 700, color: '#00d4ff' }}>
                {safeBattery}% <span style={{ fontSize: 10, color: 'rgba(255,255,255,0.5)' }}>({safeVoltage}V)</span>
              </div>
            </div>

            <div className="twin-spec-item" style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6, padding: '20px 18px', background: 'rgba(2, 4, 9, 0.6)' }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4 }}>
                SIGNAL LINK
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14, fontWeight: 700, color: '#f0f4fc' }}>
                {safeSignal}
              </div>
            </div>

            <div className="twin-spec-item" style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6, padding: '20px 18px', background: 'rgba(2, 4, 9, 0.6)' }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4 }}>
                TIME DILATION FACTOR
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14, fontWeight: 700, color: '#f0f4fc' }}>
                7,200× (2 HRS/SEC)
              </div>
            </div>

            <div className="twin-spec-item" style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6, padding: '20px 18px', background: 'rgba(2, 4, 9, 0.6)' }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4 }}>
                MISSION TIME
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14, fontWeight: 700, color: '#00ff88' }}>
                T+ 00:04:12:40
              </div>
            </div>

            <div className="twin-spec-item" style={{ border: '1px solid rgba(255, 255, 255, 0.08)', borderRadius: 6, padding: '20px 18px', background: 'rgba(2, 4, 9, 0.6)' }}>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: 'rgba(255,255,255,0.4)', letterSpacing: '0.14em', marginBottom: 4 }}>
                BLACK BOX LEDGER
              </div>
              <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 14, fontWeight: 700, color: '#f0f4fc' }}>
                IMMUTABLE AUDIT
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==============================================================
          02 DEMO — LIVE INTERFACE SHOWCASE
          ============================================================== */}
      <section id="sec-demo" className="editorial-section" style={{ background: 'linear-gradient(180deg, #020409 0%, #050c19 50%, #020409 100%)' }}>
        <div className="section-inner" style={{ maxWidth: 1200 }}>
          {/* Eyebrow + Heading */}
          <div style={{ textAlign: 'center', marginBottom: 56 }}>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5, letterSpacing: '0.24em', color: 'rgba(0,212,255,0.85)', textTransform: 'uppercase', marginBottom: 12 }}>
              02 · DEMO
            </div>
            <h2 style={{
              fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
              fontSize: 'clamp(36px, 5.5vw, 80px)',
              fontWeight: 800,
              lineHeight: 0.96,
              letterSpacing: '-0.03em',
              color: '#f0f4fc',
              margin: '0 0 16px 0',
            }}>
              EXPERIENCE<br />
              <span style={{ color: '#00d4ff' }}>THE TWIN.</span>
            </h2>
            <p style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 15, lineHeight: 1.7, color: 'rgba(255,255,255,0.55)', maxWidth: 640, margin: '0 auto', fontWeight: 300 }}>
              VYOM provides a complete mission intelligence environment — from launch to mission end. Explore what each phase of the system looks like.
            </p>
          </div>

          {/* Demo Feature Cards — 2-column grid */}
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, 1fr)', gap: 20, marginBottom: 48 }}>
            {[
              {
                num: '01',
                title: 'MISSION CREATION',
                subtitle: 'Configure your spacecraft in 4 steps',
                desc: 'Choose a mission type, configure your satellite, select a launch site, and set mission objectives. VYOM builds your digital twin automatically.',
                tags: ['Satellite Config', 'Mission Type', 'Launch Site', 'Objectives'],
                color: '#00d4ff',
                icon: '◎',
              },
              {
                num: '02',
                title: 'REAL-TIME TELEMETRY',
                subtitle: 'Physics-based spacecraft state',
                desc: 'Monitor battery, solar power, thermal state, attitude, fuel, and signal in real time. Every value is driven by orbital physics — not simulated randomness.',
                tags: ['Power Systems', 'Thermal Control', 'ADCS', 'Propulsion'],
                color: '#00ff88',
                icon: '⚡',
              },
              {
                num: '03',
                title: '3D ORBITAL VIEW',
                subtitle: 'Live orbit propagation in WebGL',
                desc: 'Visualize spacecraft position in its orbital plane with real-time ground track, eclipse entry/exit, apogee/perigee, and pass predictions.',
                tags: ['J2 Propagation', 'Ground Track', 'Eclipse Model', 'Coverage'],
                color: '#9b5de5',
                icon: '◈',
              },
              {
                num: '04',
                title: 'THREAT & AI ENGINE',
                subtitle: 'Intelligent mission hazard detection',
                desc: 'VYOM monitors for space weather, attitude anomalies, battery depletion, debris conjunctions, and thermal excursions — then explains what it means and what to do.',
                tags: ['Space Weather', 'Anomaly Detection', 'AI Copilot', 'Decision Support'],
                color: '#ff8c00',
                icon: '∿',
              },
            ].map(({ num, title, subtitle, desc, tags, color, icon }) => (
              <div key={num} style={{
                background: 'rgba(5,12,25,0.8)',
                border: `1px solid ${color}22`,
                borderRadius: 12,
                padding: '28px 26px',
                position: 'relative',
                overflow: 'hidden',
                transition: 'border-color 0.25s ease',
              }}>
                {/* Accent glow strip */}
                <div style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 2, background: `linear-gradient(90deg, transparent, ${color}, transparent)`, opacity: 0.5 }} />

                <div style={{ display: 'flex', alignItems: 'flex-start', gap: 16, marginBottom: 16 }}>
                  <div style={{ fontFamily: 'monospace', fontSize: 28, color, lineHeight: 1, minWidth: 36 }}>{icon}</div>
                  <div>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.16em', marginBottom: 4 }}>MODULE {num}</div>
                    <div style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 20, fontWeight: 800, color: '#f0f4fc', marginBottom: 2 }}>{title}</div>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9.5, color, letterSpacing: '0.12em' }}>{subtitle}</div>
                  </div>
                </div>

                <p style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 13, lineHeight: 1.65, color: 'rgba(255,255,255,0.55)', margin: '0 0 18px 0' }}>{desc}</p>

                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
                  {tags.map((tag) => (
                    <span key={tag} style={{
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 8.5,
                      letterSpacing: '0.12em',
                      color: color,
                      background: `${color}14`,
                      border: `1px solid ${color}30`,
                      borderRadius: 3,
                      padding: '3px 8px',
                    }}>{tag}</span>
                  ))}
                </div>
              </div>
            ))}
          </div>

          {/* Mission Flow Timeline */}
          <div style={{
            background: 'rgba(0,212,255,0.04)',
            border: '1px solid rgba(0,212,255,0.12)',
            borderRadius: 10,
            padding: '28px 32px',
            marginBottom: 48,
          }}>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9.5, letterSpacing: '0.2em', color: 'rgba(0,212,255,0.7)', marginBottom: 20 }}>MISSION LIFECYCLE OVERVIEW</div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 0, overflowX: 'auto', paddingBottom: 4 }}>
              {[
                { phase: 'CONFIGURE', label: 'Mission Setup', color: '#00d4ff' },
                { phase: 'LAUNCH', label: 'Orbital Insertion', color: '#9b5de5' },
                { phase: 'OPERATE', label: 'Live Twin + Telemetry', color: '#00ff88' },
                { phase: 'ANALYZE', label: 'Threats + AI Insights', color: '#ff8c00' },
                { phase: 'CONCLUDE', label: 'Archive + Replay', color: '#ffffff' },
              ].map(({ phase, label, color }, idx, arr) => (
                <div key={phase} style={{ display: 'flex', alignItems: 'center', flex: 1, minWidth: 120 }}>
                  <div style={{ textAlign: 'center', flex: 1 }}>
                    <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 9, letterSpacing: '0.14em', color, marginBottom: 6, fontWeight: 700 }}>{phase}</div>
                    <div style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 10.5, color: 'rgba(255,255,255,0.4)' }}>{label}</div>
                  </div>
                  {idx < arr.length - 1 && (
                    <div style={{ fontFamily: 'monospace', color: 'rgba(255,255,255,0.2)', fontSize: 16, paddingBottom: 12, flexShrink: 0, margin: '0 4px' }}>→</div>
                  )}
                </div>
              ))}
            </div>
          </div>

          {/* CTA */}
          <div style={{ textAlign: 'center' }}>
            <p style={{ fontFamily: 'var(--font-serif, "Cormorant Garamond", serif)', fontStyle: 'italic', fontSize: 'clamp(18px, 2vw, 26px)', color: 'rgba(255,255,255,0.7)', marginBottom: 28 }}>
              "The best way to understand VYOM is to run a mission."
            </p>
            <button
              onClick={() => setScreen('onboarding')}
              style={{
                backgroundColor: '#00d4ff',
                color: '#020409',
                border: 'none',
                borderRadius: 4,
                padding: '16px 40px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.16em',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              CREATE MISSION →
            </button>
          </div>
        </div>
      </section>

      {/* ==============================================================
          04 MISSIONS (EVERY MISSION HAS A STORY)
          ============================================================== */}
      <section id="sec-missions" className="editorial-section">
        <div id="sec-mission-types" className="section-inner">
          <div style={{ marginBottom: 48 }}>
            <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10.5, letterSpacing: '0.24em', color: 'rgba(0, 212, 255, 0.85)', textTransform: 'uppercase', marginBottom: 12 }}>
              04 · MISSIONS
            </div>
            <h2
              style={{
                fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                fontSize: 'clamp(36px, 5.5vw, 76px)',
                fontWeight: 800,
                lineHeight: 0.98,
                letterSpacing: '-0.03em',
                color: '#f0f4fc',
                margin: 0,
              }}
            >
              EVERY MISSION<br />
              <span style={{ color: '#00d4ff' }}>HAS A STORY.</span>
            </h2>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            {EDITORIAL_MISSIONS.map((m) => (
              <div
                key={m.num}
                className="mission-panel-row"
                onClick={() => handleCreateMission(m.key)}
              >
                <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 15, fontWeight: 700, color: m.color, letterSpacing: '0.1em' }}>
                  {m.num}
                </div>

                <div>
                  <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 8.5, color: m.color, letterSpacing: '0.16em', textTransform: 'uppercase', marginBottom: 4 }}>
                    {m.category}
                  </div>
                  <div style={{ fontFamily: 'var(--font-editorial, "Syne", sans-serif)', fontSize: 22, fontWeight: 800, color: '#ffffff', letterSpacing: '-0.01em', marginBottom: 4 }}>
                    {m.title}
                  </div>
                  <div style={{ fontFamily: 'var(--font-sans, "Inter", sans-serif)', fontSize: 13, color: 'rgba(255, 255, 255, 0.55)', lineHeight: 1.5 }}>
                    {m.description}
                  </div>
                </div>

                <div className="mission-panel-meta" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, color: 'rgba(255, 255, 255, 0.45)', lineHeight: 1.7 }}>
                  <div>ORBIT: <span style={{ color: '#fff' }}>{m.orbit}</span></div>
                  <div>ALT: <span style={{ color: '#fff' }}>{m.altitude}</span> · INC: <span style={{ color: '#fff' }}>{m.inclination}</span></div>
                  <div>PAYLOAD: <span style={{ color: 'rgba(255,255,255,0.7)' }}>{m.payload.substring(0, 32)}...</span></div>
                </div>

                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCreateMission(m.key);
                    }}
                    style={{
                      background: 'rgba(255,255,255,0.06)',
                      border: '1px solid rgba(255,255,255,0.18)',
                      borderRadius: 3,
                      padding: '8px 16px',
                      color: '#fff',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 10,
                      fontWeight: 600,
                      letterSpacing: '0.1em',
                      cursor: 'pointer',
                    }}
                  >
                    CONFIG →
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      handleLaunchDirect(m.key);
                    }}
                    style={{
                      background: m.color,
                      border: 'none',
                      borderRadius: 3,
                      padding: '8px 16px',
                      color: '#020409',
                      fontFamily: 'var(--font-mono, monospace)',
                      fontSize: 10,
                      fontWeight: 700,
                      letterSpacing: '0.1em',
                      cursor: 'pointer',
                    }}
                  >
                    LAUNCH
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ==============================================================
          08 MISSION CONTROL (FROM OBSERVATION TO COMMAND)
          ============================================================== */}
      <section
        id="sec-mission-control"
        className="editorial-section"
        style={{
          backgroundColor: '#000000',
          minHeight: '80vh',
          display: 'flex',
          alignItems: 'center',
        }}
      >
        <div className="section-inner" style={{ textAlign: 'center', maxWidth: 960 }}>
          <div
            id="mc-eyebrow"
            style={{
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 11,
              letterSpacing: '0.24em',
              color: 'rgba(0, 212, 255, 0.9)',
              textTransform: 'uppercase',
              marginBottom: 24,
            }}
          >
            MISSION INTELLIGENCE
          </div>

          <h2
            style={{
              fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
              fontSize: 'clamp(44px, 7.5vw, 108px)',
              fontWeight: 800,
              lineHeight: 0.92,
              letterSpacing: '-0.04em',
              color: '#f0f4fc',
              margin: '0 0 32px 0',
            }}
          >
            <div id="mc-line-obs">FROM OBSERVATION</div>
            <div id="mc-line-cmd" style={{ color: '#00d4ff' }}>TO ACTION.</div>
          </h2>

          <p
            id="mc-description"
            style={{
              fontFamily: 'var(--font-serif, "Cormorant Garamond", serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(19px, 2vw, 28px)',
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.85)',
              maxWidth: 720,
              margin: '0 auto 44px auto',
            }}
          >
            "VYOM brings mission visualization, telemetry, analysis and decision support into a unified operational environment."
          </p>

          <div id="mc-cta-box">
            <button
              onClick={() => setScreen('onboarding')}
              style={{
                backgroundColor: '#00d4ff',
                color: '#020409',
                border: 'none',
                borderRadius: 4,
                padding: '16px 36px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.16em',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              INITIALIZE MISSION →
            </button>
          </div>
        </div>
      </section>

      {/* ==============================================================
          09 VYOM AI (MISSION DATA BECOMES MISSION INTELLIGENCE)
          ============================================================== */}
      <section id="sec-vyom-ai" className="editorial-section">
        <div className="section-inner">
          <div style={{ display: 'grid', gridTemplateColumns: 'minmax(320px, 1.1fr) minmax(320px, 0.9fr)', gap: 56, alignItems: 'center' }}>
            <div>
              <div className="ai-reveal" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.22em', color: '#9b5de5', textTransform: 'uppercase', marginBottom: 12 }}>
                AUTONOMOUS COPILOT
              </div>
              <h2
                className="ai-reveal"
                style={{
                  fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
                  fontSize: 'clamp(36px, 5.2vw, 76px)',
                  fontWeight: 800,
                  lineHeight: 0.96,
                  letterSpacing: '-0.03em',
                  color: '#f0f4fc',
                  margin: '0 0 24px 0',
                }}
              >
                MISSION DATA<br />
                BECOMES<br />
                <span style={{ color: '#9b5de5' }}>MISSION<br />INTELLIGENCE.</span>
              </h2>

              <p
                className="ai-reveal"
                style={{
                  fontFamily: 'var(--font-sans, "Inter", sans-serif)',
                  fontSize: 15,
                  lineHeight: 1.7,
                  color: 'rgba(255, 255, 255, 0.65)',
                  margin: '0 0 32px 0',
                  fontWeight: 300,
                }}
              >
                VYOM AI acts as an intelligent layer over mission information, helping operators interpret telemetry, identify important changes and access mission context through natural interaction.
              </p>

              <div
                className="ai-reveal"
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 16,
                  fontFamily: 'var(--font-mono, monospace)',
                  fontSize: 11,
                  letterSpacing: '0.18em',
                  color: 'rgba(255, 255, 255, 0.45)',
                  textTransform: 'uppercase',
                }}
              >
                <span style={{ color: '#9b5de5' }}>ASK</span>
                <span>·</span>
                <span>UNDERSTAND</span>
                <span>·</span>
                <span>ANALYZE</span>
                <span>·</span>
                <span style={{ color: '#00ff88' }}>RESPOND</span>
              </div>
            </div>

            {/* Aerospace-grade interaction preview */}
            <div
              className="ai-reveal"
              style={{
                border: '1px solid rgba(155, 93, 229, 0.3)',
                borderRadius: 8,
                padding: '28px 24px',
                background: 'rgba(8, 4, 18, 0.75)',
                fontFamily: 'var(--font-mono, monospace)',
              }}
            >
              <div style={{ fontSize: 9.5, color: 'rgba(255,255,255,0.35)', letterSpacing: '0.14em', marginBottom: 20 }}>
                VYOM CONVERSATIONAL INTERACTION PREVIEW
              </div>

              <div style={{ marginBottom: 18 }}>
                <div style={{ fontSize: 9, color: 'rgba(0, 212, 255, 0.7)', letterSpacing: '0.1em', marginBottom: 4 }}>
                  OPERATOR PROMPT:
                </div>
                <div style={{ fontSize: 13, color: '#f0f4fc', background: 'rgba(255,255,255,0.04)', padding: '10px 14px', borderRadius: 4 }}>
                  "What is the current mission status?"
                </div>
              </div>

              <div>
                <div style={{ fontSize: 9, color: '#9b5de5', letterSpacing: '0.1em', marginBottom: 4 }}>
                  VYOM AI REASONING (0.24s):
                </div>
                <div style={{ fontSize: 13, lineHeight: 1.6, color: 'rgba(255,255,255,0.85)', background: 'rgba(155, 93, 229, 0.08)', borderLeft: '2px solid #9b5de5', padding: '12px 14px', borderRadius: '0 4px 4px 0' }}>
                  "Mission status is nominal. Battery remains within the expected operational range ({safeBattery}%) and spacecraft telemetry is being received normally across Ground Station DSN-01."
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ==============================================================
          10 THE DIGITAL TWIN LOOP (CINEMATIC SCROLLTHROUGH)
          ============================================================== */}
      <section id="sec-twin-loop" className="pinned-section">
        <div className="section-inner" style={{ textAlign: 'center', maxWidth: 840 }}>
          <div style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 10, letterSpacing: '0.24em', color: 'rgba(0, 212, 255, 0.8)', textTransform: 'uppercase', marginBottom: 28 }}>
            THE CONTINUOUS OPERATIONAL CYCLE
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12, marginBottom: 36 }}>
            <div id="loop-node-01" className="loop-pill">OBSERVE</div>
            <div id="loop-arrow-01" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>↓</div>

            <div id="loop-node-02" className="loop-pill">UNDERSTAND</div>
            <div id="loop-arrow-02" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>↓</div>

            <div id="loop-node-03" className="loop-pill">SIMULATE</div>
            <div id="loop-arrow-03" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>↓</div>

            <div id="loop-node-04" className="loop-pill">DECIDE</div>
            <div id="loop-arrow-04" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>↓</div>

            <div id="loop-node-05" className="loop-pill">ACT</div>
            <div id="loop-arrow-05" style={{ color: 'rgba(255,255,255,0.3)', fontSize: 14 }}>↓</div>

            <div id="loop-node-06" className="loop-pill" style={{ borderColor: '#00ff88', color: '#00ff88' }}>LEARN</div>
          </div>

          <div
            id="loop-final-statement"
            style={{
              fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
              fontSize: 'clamp(28px, 4.5vw, 64px)',
              fontWeight: 800,
              lineHeight: 1.0,
              letterSpacing: '-0.02em',
              color: '#ffffff',
            }}
          >
            THE MISSION<br />
            <span style={{ color: 'rgba(255,255,255,0.35)' }}>CONTINUES.</span>
          </div>
        </div>
      </section>

      {/* ==============================================================
          11 FINAL CTA & TECHNICAL HORIZON
          ============================================================== */}
      <section
        id="sec-final"
        className="editorial-section"
        style={{
          backgroundColor: '#010206',
          minHeight: '90vh',
          display: 'flex',
          alignItems: 'center',
          borderTop: '1px solid rgba(255, 255, 255, 0.08)',
        }}
      >
        <div className="section-inner" style={{ textAlign: 'center', maxWidth: 940 }}>
          <div className="final-reveal" style={{ fontFamily: 'var(--font-mono, monospace)', fontSize: 11, letterSpacing: '0.24em', color: 'rgba(255, 255, 255, 0.4)', textTransform: 'uppercase', marginBottom: 20 }}>
            VYOM · INTELLIGENT SPACE MISSION SYSTEM
          </div>

          <h2
            className="final-reveal"
            style={{
              fontFamily: 'var(--font-editorial, "Syne", sans-serif)',
              fontSize: 'clamp(40px, 6.8vw, 92px)',
              fontWeight: 800,
              lineHeight: 0.95,
              letterSpacing: '-0.035em',
              color: '#f0f4fc',
              margin: '0 0 28px 0',
            }}
          >
            THE FUTURE<br />
            OF SPACE MISSIONS<br />
            <span style={{ color: '#00d4ff' }}>IS INTELLIGENT.</span>
          </h2>

          <p
            className="final-reveal"
            style={{
              fontFamily: 'var(--font-serif, "Cormorant Garamond", serif)',
              fontStyle: 'italic',
              fontSize: 'clamp(20px, 2.2vw, 32px)',
              lineHeight: 1.5,
              color: 'rgba(255, 255, 255, 0.8)',
              maxWidth: 700,
              margin: '0 auto 44px auto',
            }}
          >
            "Build a clearer picture of the mission.<br />
            Understand what is happening.<br />
            Explore what could happen next."
          </p>

          <div className="final-reveal" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 18, flexWrap: 'wrap', marginBottom: 72 }}>
            <button
              onClick={() => setScreen('onboarding')}
              style={{
                backgroundColor: '#ffffff',
                color: '#020409',
                border: 'none',
                borderRadius: 4,
                padding: '16px 36px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                fontWeight: 800,
                letterSpacing: '0.16em',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              ENTER VYOM →
            </button>

            <button
              onClick={() => scrollToSection('sec-what-is-vyom')}
              style={{
                backgroundColor: 'transparent',
                color: '#f0f4fc',
                border: '1px solid rgba(255, 255, 255, 0.24)',
                borderRadius: 4,
                padding: '16px 32px',
                fontFamily: 'var(--font-mono, monospace)',
                fontSize: 12,
                fontWeight: 600,
                letterSpacing: '0.14em',
                cursor: 'pointer',
                transition: 'all 0.25s ease',
              }}
            >
              EXPLORE VYOM ↑
            </button>
          </div>

          {/* Editorial Technical Footer */}
          <div
            className="final-reveal"
            style={{
              borderTop: '1px solid rgba(255, 255, 255, 0.06)',
              paddingTop: 36,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              fontFamily: 'var(--font-mono, monospace)',
              fontSize: 9.5,
              letterSpacing: '0.14em',
              color: 'rgba(255, 255, 255, 0.3)',
              flexWrap: 'wrap',
              gap: 16,
            }}
          >
            <div>VYOM PLATFORM · BUILD 2026.09-LOCKED</div>
            <div>KEPLERIAN & J2 TWO-BODY PROPAGATION</div>
            <div>ISO-9241 AEROSPACE HUMAN-MACHINE TELEMETRY</div>
          </div>
        </div>
      </section>
    </div>
  );
}
