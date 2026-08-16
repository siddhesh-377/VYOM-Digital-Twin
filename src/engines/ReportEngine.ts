import { useMissionStore } from '../store/missionStore';
import { blackBoxRecorder } from './BlackBoxRecorder';
import { missionSnapshotManager } from './MissionSnapshotManager';

class ReportEngine {
  gatherMissionData() {
    const store = useMissionStore.getState();
    const events = blackBoxRecorder.getEvents();
    const snapshots = missionSnapshotManager.getSnapshots();

    return {
      config: store.config,
      finalStatus: store.status,
      totalMissionDays: store.missionDay,
      health: store.telemetry?.overallHealth ?? 100,
      milestones: store.milestones,
      events,
      snapshots,
      telemetryHistory: store.telemetryHistory,
      orbitTrail: store.orbitTrail,
      aiInterventions: store.stats.aiInterventions,
    };
  }
}

export const reportEngine = new ReportEngine();
