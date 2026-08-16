import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';

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

    if (store.status !== 'completed' && store.objectiveProgress < 100) {
      const simDays = simDelta / (1000 * 60 * 60 * 24);
      store.tickMission(realDelta); // Only updates real time in store
      eventBus.publish('CLOCK_TICK', { realDelta, simDelta, simDays, tickCount: this.tickCount });
    }

    this.rafId = requestAnimationFrame(this.loop);
  };
}

export const missionClockEngine = new MissionClockEngine();
