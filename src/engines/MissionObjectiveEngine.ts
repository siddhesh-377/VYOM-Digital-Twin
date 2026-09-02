import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';

class MissionObjectiveEngine {
  constructor() {
    eventBus.subscribe('CLOCK_TICK', this.onTick);
  }

  public onTick = (payload: { tickCount: number }) => {
    if (payload.tickCount % 120 !== 0) return;

    const store = useMissionStore.getState();
    const { missionDay, milestones, status } = store;
    if (status !== 'active' && status !== 'threatened' && status !== 'recovering') return;
    if (milestones.length === 0) return;

    let completedCount = 0;
    for (const m of milestones) {
      if (m.completed) {
        completedCount++;
      } else if (missionDay >= m.requiresDays) {
        store.completeMilestone(m.id);
        completedCount++;
        eventBus.publish('MILESTONE_COMPLETED', m);
      }
    }

    const milestonePct = (completedCount / milestones.length) * 100;
    const lifetimeDays = Math.max(16, (store.estimatedLifetimeYears || 1.5) * 365 * 0.5);
    const dayProgress = (missionDay / lifetimeDays) * 100;
    const combined = Math.min(100, Math.round(milestonePct * 0.7 + dayProgress * 0.3));
    
    store.setObjectiveProgress(combined);

    if (combined >= 100 && status === 'active') {
      store.completeMission();
      eventBus.publish('MISSION_COMPLETE', { finalProgress: combined });
    }
  };
}

export const missionObjectiveEngine = new MissionObjectiveEngine();
