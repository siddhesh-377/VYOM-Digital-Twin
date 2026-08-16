import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';

class MissionSnapshotManager {
  private snapshots: any[] = [];

  constructor() {
    eventBus.subscribe('CLOCK_TICK', this.onTick);
  }

  private onTick = (payload: { tickCount: number }) => {
    if (payload.tickCount % 600 !== 0) return; // Take snapshot every few seconds of real time
    
    const store = useMissionStore.getState();
    const snapshot = {
      missionDay: store.missionDay,
      timestamp: Date.now(),
      health: store.telemetry?.overallHealth ?? 100,
      objectiveProgress: store.objectiveProgress,
      activeThreatsCount: store.activeThreats.length,
      telemetry: {
        power: store.telemetry?.power.batteryPercent,
        thermal: store.telemetry?.thermal.cpuTempC,
      }
    };
    
    this.snapshots.push(snapshot);
  };

  getSnapshots() {
    return this.snapshots;
  }
}

export const missionSnapshotManager = new MissionSnapshotManager();
