import React, { useEffect, useRef, useState, useCallback } from 'react';

interface InteractiveEarthBackgroundProps {
  /** Total number of frames (default: 200) */
  totalFrames?: number;
  /** Frame filename format (default: (i) => `/earth-frames/ezgif-frame-${String(i).padStart(3, '0')}.jpg`) */
  getFrameUrl?: (index: number) => string;
  /** Auto rotation speed in frames per second (default: 18) */
  autoRotateSpeed?: number;
  /** Whether auto-rotation is initially active (default: true) */
  autoRotate?: boolean;
  /** Opacity of the canvas (default: 1) */
  opacity?: number;
  /** Show interactive control HUD badge (default: true) */
  showHud?: boolean;
  /** Subtle dark overlay for UI readability (default: true) */
  showVignette?: boolean;
  /** Custom style overrides */
  style?: React.CSSProperties;
  /** Custom class name */
  className?: string;
  /** Callback when current frame changes */
  onFrameChange?: (frame: number) => void;
}

export const InteractiveEarthBackground: React.FC<InteractiveEarthBackgroundProps> = ({
  totalFrames = 200,
  getFrameUrl = (i: number) => `/earth-frames/ezgif-frame-${String(i).padStart(3, '0')}.jpg`,
  autoRotateSpeed = 18,
  autoRotate = true,
  opacity = 1,
  showHud = true,
  showVignette = true,
  style,
  className,
  onFrameChange,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  
  // Image cache array
  const imagesRef = useRef<(HTMLImageElement | null)[]>(new Array(totalFrames).fill(null));
  const loadedCountRef = useRef<number>(0);
  const [loadedProgress, setLoadedProgress] = useState<number>(0);
  const [isFullyLoaded, setIsFullyLoaded] = useState<boolean>(false);

  // Animation state
  const currentFrameRef = useRef<number>(1);
  const targetFrameRef = useRef<number>(1);
  const lastDrawnFrameRef = useRef<number>(-1);
  const isAutoRotatingRef = useRef<boolean>(autoRotate);
  const [isAutoRotating, setIsAutoRotating] = useState<boolean>(autoRotate);
  const [displayFrame, setDisplayFrame] = useState<number>(1);

  // Interaction tracking
  const isDraggingRef = useRef<boolean>(false);
  const dragStartXRef = useRef<number>(0);
  const dragStartFrameRef = useRef<number>(1);
  const lastInteractionTimeRef = useRef<number>(Date.now());
  const velocityRef = useRef<number>(0);
  const lastMouseXRef = useRef<number>(0);
  const lastMouseTimeRef = useRef<number>(Date.now());

  // ── Helper: Safe frame index (1 to totalFrames cyclic) ──────────────────────
  const normalizeFrame = useCallback((frame: number) => {
    let f = Math.round(frame);
    while (f < 1) f += totalFrames;
    while (f > totalFrames) f -= totalFrames;
    return f;
  }, [totalFrames]);

  // ── Progressive Image Preloader ─────────────────────────────────────────────
  useEffect(() => {
    let isCancelled = false;

    // Step 1: Preload initial hero frame (Frame 1) immediately
    const firstImg = new Image();
    firstImg.src = getFrameUrl(1);
    firstImg.onload = () => {
      if (!isCancelled) {
        imagesRef.current[0] = firstImg;
        loadedCountRef.current = 1;
        setLoadedProgress(1 / totalFrames);
        drawFrame(1);
      }
    };

    // Step 2: Preload decimated keyframes (every 5th frame) for instant scrubbing
    const keyframeIndices: number[] = [];
    for (let i = 1; i <= totalFrames; i += 5) {
      if (i !== 1) keyframeIndices.push(i);
    }

    keyframeIndices.forEach((idx) => {
      const img = new Image();
      img.src = getFrameUrl(idx);
      img.onload = () => {
        if (!isCancelled) {
          imagesRef.current[idx - 1] = img;
          loadedCountRef.current += 1;
          setLoadedProgress(loadedCountRef.current / totalFrames);
        }
      };
    });

    // Step 3: Progressively preload remaining frames in background batches
    let currentBatchIdx = 2;
    const preloadBatch = () => {
      if (isCancelled || currentBatchIdx > totalFrames) {
        if (!isCancelled) setIsFullyLoaded(true);
        return;
      }

      const batchSize = 8;
      let batchLoaded = 0;
      const targetEnd = Math.min(totalFrames, currentBatchIdx + batchSize);

      for (let i = currentBatchIdx; i <= targetEnd; i++) {
        if (!imagesRef.current[i - 1]) {
          const img = new Image();
          img.src = getFrameUrl(i);
          img.onload = () => {
            if (!isCancelled) {
              imagesRef.current[i - 1] = img;
              loadedCountRef.current += 1;
              setLoadedProgress(loadedCountRef.current / totalFrames);
            }
          };
        }
      }

      currentBatchIdx += batchSize;
      if (typeof window !== 'undefined') {
        if ('requestIdleCallback' in window) {
          (window as any).requestIdleCallback(preloadBatch, { timeout: 300 });
        } else {
          setTimeout(preloadBatch, 40);
        }
      }
    };

    // Kick off progressive background loader after brief delay
    const timer = setTimeout(preloadBatch, 100);

    return () => {
      isCancelled = true;
      clearTimeout(timer);
    };
  }, [totalFrames, getFrameUrl]);

  // ── Canvas Rendering Engine (Aspect-Ratio Cover) ───────────────────────────
  const drawFrame = useCallback((frameNumber: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const normFrame = normalizeFrame(frameNumber);
    let img = imagesRef.current[normFrame - 1];

    // If target frame not loaded yet, find closest available loaded frame
    if (!img || !img.complete || img.naturalWidth === 0) {
      let closestDist = Infinity;
      let closestImg: HTMLImageElement | null = null;
      for (let offset = 1; offset <= 20; offset++) {
        const left = normalizeFrame(normFrame - offset);
        const right = normalizeFrame(normFrame + offset);
        if (imagesRef.current[left - 1]?.complete) {
          closestImg = imagesRef.current[left - 1];
          break;
        }
        if (imagesRef.current[right - 1]?.complete) {
          closestImg = imagesRef.current[right - 1];
          break;
        }
      }
      if (closestImg) img = closestImg;
      else if (imagesRef.current[0]?.complete) img = imagesRef.current[0];
    }

    if (!img || !img.complete) return;

    const cw = canvas.width;
    const ch = canvas.height;
    const iw = img.naturalWidth || 1280;
    const ih = img.naturalHeight || 720;

    // Calculate 'object-fit: cover' centered dimensions
    const canvasAspect = cw / ch;
    const imageAspect = iw / ih;

    let renderW = cw;
    let renderH = ch;
    let renderX = 0;
    let renderY = 0;

    if (canvasAspect > imageAspect) {
      // Canvas is wider than image aspect
      renderW = cw;
      renderH = cw / imageAspect;
      renderX = 0;
      renderY = (ch - renderH) / 2;
    } else {
      // Canvas is taller than image aspect
      renderH = ch;
      renderW = ch * imageAspect;
      renderX = (cw - renderW) / 2;
      renderY = 0;
    }

    ctx.clearRect(0, 0, cw, ch);
    ctx.drawImage(img, renderX, renderY, renderW, renderH);
    lastDrawnFrameRef.current = normFrame;

    if (onFrameChange) onFrameChange(normFrame);
  }, [normalizeFrame, onFrameChange]);

  // ── Handle Canvas Resize with High-DPI Support ────────────────────────────
  const handleResize = useCallback(() => {
    const canvas = canvasRef.current;
    const container = containerRef.current;
    if (!canvas || !container) return;

    const rect = container.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    canvas.width = Math.round(rect.width * dpr);
    canvas.height = Math.round(rect.height * dpr);

    drawFrame(currentFrameRef.current);
  }, [drawFrame]);

  useEffect(() => {
    handleResize();
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [handleResize]);

  // ── Main Animation Loop (requestAnimationFrame) ───────────────────────────
  useEffect(() => {
    let animationFrameId: number;
    let lastTime = performance.now();

    const animate = (time: number) => {
      const delta = (time - lastTime) / 1000;
      lastTime = time;

      // 1. Auto-rotation progression (when not dragging and after interaction cooldown)
      const now = Date.now();
      const idleTime = now - lastInteractionTimeRef.current;
      const isIdle = idleTime > 1500;

      if (isAutoRotatingRef.current && !isDraggingRef.current) {
        if (isIdle) {
          // Normal auto-spin speed
          targetFrameRef.current += autoRotateSpeed * delta;
        } else if (Math.abs(velocityRef.current) > 0.05) {
          // Inertia damping after drag release
          targetFrameRef.current += velocityRef.current * delta * 60;
          velocityRef.current *= 0.92; // Friction
        }
      } else if (!isDraggingRef.current && Math.abs(velocityRef.current) > 0.05) {
        // Inertia damping when auto-rotate is paused
        targetFrameRef.current += velocityRef.current * delta * 60;
        velocityRef.current *= 0.92;
      }

      // 2. Smooth spring interpolation to target frame
      const frameDiff = targetFrameRef.current - currentFrameRef.current;
      if (Math.abs(frameDiff) > 0.01) {
        currentFrameRef.current += frameDiff * Math.min(1, delta * 20);
      } else {
        currentFrameRef.current = targetFrameRef.current;
      }

      // 3. Render if frame changed
      const normFrame = normalizeFrame(currentFrameRef.current);
      if (normFrame !== lastDrawnFrameRef.current) {
        drawFrame(normFrame);
        setDisplayFrame(normFrame);
      }

      animationFrameId = requestAnimationFrame(animate);
    };

    animationFrameId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationFrameId);
  }, [autoRotateSpeed, drawFrame, normalizeFrame]);

  // ── Mouse & Touch Drag Handlers ───────────────────────────────────────────
  const handlePointerDown = (e: React.PointerEvent) => {
    // Only drag on primary mouse click or touch
    if (e.button !== 0) return;
    isDraggingRef.current = true;
    dragStartXRef.current = e.clientX;
    dragStartFrameRef.current = targetFrameRef.current;
    lastMouseXRef.current = e.clientX;
    lastMouseTimeRef.current = Date.now();
    velocityRef.current = 0;
    lastInteractionTimeRef.current = Date.now();
  };

  const handlePointerMove = (e: React.PointerEvent) => {
    if (!isDraggingRef.current) return;
    const now = Date.now();
    const dt = Math.max(1, now - lastMouseTimeRef.current);
    const deltaX = e.clientX - dragStartXRef.current;
    const instantDx = e.clientX - lastMouseXRef.current;

    // Sensitivity: Dragging full screen width rotates ~200 frames (360 degrees)
    const containerW = containerRef.current?.clientWidth || window.innerWidth;
    const frameShift = (deltaX / containerW) * totalFrames * 1.2;

    targetFrameRef.current = dragStartFrameRef.current - frameShift;
    velocityRef.current = (-instantDx / containerW) * totalFrames * (16 / dt);

    lastMouseXRef.current = e.clientX;
    lastMouseTimeRef.current = now;
    lastInteractionTimeRef.current = now;
  };

  const handlePointerUp = () => {
    isDraggingRef.current = false;
    lastInteractionTimeRef.current = Date.now();
  };

  // ── Mouse Wheel Scrubbing ──────────────────────────────────────────────────
  const handleWheel = (e: React.WheelEvent) => {
    const delta = e.deltaY || e.deltaX;
    if (Math.abs(delta) < 2) return;
    
    // Smooth frame shift on wheel
    const step = delta > 0 ? 2.5 : -2.5;
    targetFrameRef.current += step;
    lastInteractionTimeRef.current = Date.now();
  };

  const toggleAutoRotate = () => {
    const nextState = !isAutoRotating;
    setIsAutoRotating(nextState);
    isAutoRotatingRef.current = nextState;
  };

  return (
    <div
      ref={containerRef}
      className={`interactive-earth-container ${className || ''}`}
      style={{
        position: 'absolute',
        inset: 0,
        width: '100%',
        height: '100%',
        overflow: 'hidden',
        background: '#020409',
        userSelect: 'none',
        ...style,
      }}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={handlePointerUp}
      onPointerCancel={handlePointerUp}
      onWheel={handleWheel}
    >
      {/* High-Performance 2D Canvas */}
      <canvas
        ref={canvasRef}
        style={{
          width: '100%',
          height: '100%',
          display: 'block',
          opacity,
          cursor: isDraggingRef.current ? 'grabbing' : 'grab',
          transition: 'opacity 0.5s ease',
        }}
      />

      {/* Atmospheric Depth & Cosmic Vignette (Preserves Text & HUD Readability) */}
      {showVignette && (
        <>
          {/* Radial cosmic vignette */}
          <div
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              background: 'radial-gradient(ellipse at center, rgba(2,4,9,0.05) 0%, rgba(2,4,9,0.4) 60%, rgba(2,4,9,0.85) 100%)',
            }}
          />
          {/* Scanline CRT overlay */}
          <div
            className="scan-overlay"
            style={{
              position: 'absolute',
              inset: 0,
              pointerEvents: 'none',
              opacity: 0.45,
            }}
          />
          {/* Bottom horizon gradient for control bars */}
          <div
            style={{
              position: 'absolute',
              bottom: 0,
              left: 0,
              right: 0,
              height: 160,
              pointerEvents: 'none',
              background: 'linear-gradient(to top, rgba(2,4,9,0.92) 0%, rgba(2,4,9,0) 100%)',
            }}
          />
        </>
      )}

      {/* Subtle Floating Interactive HUD Badge */}
      {showHud && (
        <div
          style={{
            position: 'absolute',
            bottom: 24,
            right: 28,
            zIndex: 10,
            display: 'flex',
            alignItems: 'center',
            gap: 10,
            padding: '6px 12px',
            background: 'rgba(5, 12, 25, 0.85)',
            border: '1px solid rgba(0, 212, 255, 0.25)',
            borderRadius: 6,
            backdropFilter: 'blur(8px)',
            boxShadow: '0 4px 20px rgba(0, 0, 0, 0.6)',
            pointerEvents: 'auto',
          }}
        >
          {/* Pulsing indicator */}
          <div
            style={{
              width: 6,
              height: 6,
              borderRadius: '50%',
              background: isAutoRotating ? '#00ff88' : '#00d4ff',
              boxShadow: `0 0 8px ${isAutoRotating ? '#00ff88' : '#00d4ff'}`,
              animation: isAutoRotating ? 'pulse-dot 2s ease-in-out infinite' : 'none',
            }}
          />

          {/* Status info */}
          <div style={{ display: 'flex', flexDirection: 'column', gap: 1 }}>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 8,
                letterSpacing: '0.15em',
                color: 'rgba(255, 255, 255, 0.4)',
                textTransform: 'uppercase',
              }}
            >
              Earth Digital Twin · 360° Rotation
            </span>
            <span
              style={{
                fontFamily: 'var(--font-mono)',
                fontSize: 9.5,
                fontWeight: 700,
                color: '#00d4ff',
                letterSpacing: '0.08em',
              }}
            >
              FRAME {String(displayFrame).padStart(3, '0')} / {totalFrames}
            </span>
          </div>

          {/* Toggle Auto/Manual Button */}
          <button
            onClick={(e) => {
              e.stopPropagation();
              toggleAutoRotate();
            }}
            style={{
              fontFamily: 'var(--font-mono)',
              fontSize: 8,
              fontWeight: 700,
              letterSpacing: '0.1em',
              padding: '3px 8px',
              marginLeft: 4,
              background: isAutoRotating ? 'rgba(0, 212, 255, 0.15)' : 'rgba(255, 255, 255, 0.08)',
              border: `1px solid ${isAutoRotating ? '#00d4ff' : 'rgba(255, 255, 255, 0.2)'}`,
              borderRadius: 3,
              color: isAutoRotating ? '#00d4ff' : 'rgba(255, 255, 255, 0.7)',
              cursor: 'pointer',
              transition: 'all 0.2s',
            }}
            title="Click to toggle auto-rotation / drag to scrub"
          >
            {isAutoRotating ? 'AUTO' : 'DRAGGABLE'}
          </button>

          {/* Mini preloading bar if still loading in background */}
          {!isFullyLoaded && loadedProgress < 0.99 && (
            <div
              style={{
                position: 'absolute',
                bottom: -1,
                left: 0,
                right: 0,
                height: 2,
                background: 'rgba(0, 212, 255, 0.2)',
                borderRadius: '0 0 6px 6px',
                overflow: 'hidden',
              }}
            >
              <div
                style={{
                  width: `${loadedProgress * 100}%`,
                  height: '100%',
                  background: '#00d4ff',
                  transition: 'width 0.3s ease',
                }}
              />
            </div>
          )}
        </div>
      )}
    </div>
  );
};
