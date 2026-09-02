/**
 * VYOM — Authoritative Mission Clock Engine
 *
 * Time model: 1 real-world second = 7200 simulation seconds = 2 mission hours
 * Acceleration factor: 7200× (configurable via time warp)
 *
 * Clock is anchored to store.missionStartTime (real UTC timestamp).
 * Mission elapsed time is ALWAYS calculated from:
 *   missionElapsedSeconds = (realNow - missionStartTime) × accelerationFactor
 *
 * This means:
 *  - Survives page refresh  (missionStartTime is persisted in store)
 *  - Two browser windows see the same mission time
 *  - No accumulation errors from rAF timing jitter
 *
 * Mission deadline is strictly enforced — time clamps at totalMissionDurationDays.
 */

import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';
import { backendWS } from '../services/BackendWebSocketService';

/** Default: 1 real second = 7200 mission seconds = 2 mission hours */
export const DEFAULT_ACCELERATION = 7200;

class MissionClockEngine {
  private rafId: number | null = null;
  private lastFrameTs: number | null = null;
  private tickCount = 0;
  private missionCompleteEmitted = false;

  start() {
    if (this.rafId !== null) return;
    this.lastFrameTs = null;
    this.tickCount = 0;
    this.missionCompleteEmitted = false;
    this.rafId = requestAnimationFrame(this.loop);
    console.log('[MissionClock] Started — timestamp-based mode (7200× default)');
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  reset() {
    this.missionCompleteEmitted = false;
    // Caller must update missionStartTime in store
  }

  private loop = (frameTs: number) => {
    if (this.lastFrameTs === null) this.lastFrameTs = frameTs;
    const realDeltaMs  = frameTs - this.lastFrameTs;
    this.lastFrameTs   = frameTs;
    this.tickCount++;

    const store = useMissionStore.getState();

    // Backend WebSocket is authoritative when connected — it sends CLOCK_TICK
    // with the real mission day from the physics sim. Don't advance locally.
    if (backendWS.isConnected) {
      // Still emit a lightweight tick so engines can react to realDelta
      eventBus.publish('CLOCK_TICK', {
        realDelta: realDeltaMs,
        simDelta: 0,
        simDays: 0,
        tickCount: this.tickCount,
        missionDay: store.missionDay,
        source: 'backend',
      });
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    if (store.status === 'completed' || store.isPaused) {
      this.rafId = requestAnimationFrame(this.loop);
      return;
    }

    // ── Timestamp-based clock calculation ──────────────────────────────────
    const accel          = store.timeMultiplier > 0 ? store.timeMultiplier : DEFAULT_ACCELERATION;
    const missionStartTs = store.missionStartTime;   // real UTC ms when mission started
    const realElapsedMs  = Date.now() - missionStartTs;
    const simElapsedSecs = (realElapsedMs / 1000) * accel;
    const rawMissionDay  = simElapsedSecs / 86400;     // 86400 sim-seconds per mission-day

    const totalDays      = store.totalMissionDurationDays || 17;
    const missionDay     = Math.min(rawMissionDay, totalDays);  // hard clamp at deadline

    // Advance store mission day
    useMissionStore.setState({
      missionDay,
      elapsedRealMs: realElapsedMs,
    });

    // Emit tick event for all engines
    const simDeltaSecs = (realDeltaMs / 1000) * accel;
    const simDaysDelta = simDeltaSecs / 86400;

    eventBus.publish('CLOCK_TICK', {
      realDelta: realDeltaMs,
      simDelta:  realDeltaMs * accel,
      simDays:   simDaysDelta,
      tickCount: this.tickCount,
      missionDay,
      source: 'local',
    });

    // ── Milestone completion check ─────────────────────────────────────────
    const milestones = store.milestones;
    milestones.forEach((m) => {
      if (!m.completed && missionDay >= m.requiresDays) {
        useMissionStore.getState().completeMilestone(m.id);
      }
    });

    // ── Objective progress (based on milestones completed) ─────────────────
    const completedCount = milestones.filter((m) => m.completed || missionDay >= m.requiresDays).length;
    const progress       = milestones.length > 0 ? Math.round((completedCount / milestones.length) * 99) : Math.round((missionDay / totalDays) * 99);
    useMissionStore.getState().setObjectiveProgress(Math.min(progress, 99));

    // ── Mission completion at exact deadline ───────────────────────────────
    if (rawMissionDay >= totalDays && !this.missionCompleteEmitted) {
      this.missionCompleteEmitted = true;
      console.log(`[MissionClock] Mission reached deadline: ${totalDays} days`);

      // Mark all milestones complete
      milestones.forEach((m) => {
        if (!m.completed) useMissionStore.getState().completeMilestone(m.id);
      });

      useMissionStore.getState().setObjectiveProgress(100);

      // Log final blackbox event
      useMissionStore.getState().logEvent({
        id: `ev-mission-complete-${Date.now()}`,
        timestamp: Date.now(),
        missionDay: totalDays,
        eventType: 'milestone',
        severity: 'nominal',
        description: `MISSION COMPLETE — ${store.config?.name ?? 'VYOM Mission'} successfully completed after exactly ${totalDays.toFixed(1)} mission days. All objectives finalized.`,
        source: 'Mission Clock Engine',
        immutable: true,
      });

      // Emit to event bus and trigger completion
      eventBus.publish('MISSION_COMPLETE', { missionDay: totalDays, totalDays });
      useMissionStore.getState().completeMission();
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}

export const missionClockEngine = new MissionClockEngine();
