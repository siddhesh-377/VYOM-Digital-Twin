import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';
import { backendWS } from '../services/BackendWebSocketService';

class MissionClockEngine {
  private rafId: number | null = null;
  private lastTimestamp: number | null = null;
  private tickCount = 0;

  start() {
    if (this.rafId !== null) return;
    this.lastTimestamp = null;
    this.tickCount = 0;
    this.rafId = requestAnimationFrame(this.loop);
  }

  stop() {
    if (this.rafId !== null) {
      cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
  }

  private loop = (timestamp: number) => {
    if (this.lastTimestamp === null) this.lastTimestamp = timestamp;
    const realDelta = timestamp - this.lastTimestamp;
    this.lastTimestamp = timestamp;
    this.tickCount++;

    const store = useMissionStore.getState();
    const simDelta = realDelta * store.timeMultiplier;

    // When the backend is connected, IT is the authoritative mission clock —
    // its CLOCK_TICK messages set store.missionDay. Adding local simulated
    // time on top would inject phantom days (at high warp the local rAF loop
    // accumulates ~7 extra days/second) and corrupt the day counter.
    const backendAuthoritative = backendWS.isConnected;

    if (store.status !== 'completed' && store.objectiveProgress < 100) {
      if (!backendAuthoritative) {
        store.tickMission(realDelta); // Local-only mode: local clock advances the mission
      }
      const currentDay = useMissionStore.getState().missionDay;
      const simDays = backendAuthoritative
        ? 0 // computed by backend; delivered via CLOCK_TICK missionDay
        : simDelta / (1000 * 60 * 60 * 24);
      eventBus.publish('CLOCK_TICK', {
        realDelta,
        simDelta,
        simDays,
        tickCount: this.tickCount,
        missionDay: currentDay,
      });
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}

export const missionClockEngine = new MissionClockEngine();
