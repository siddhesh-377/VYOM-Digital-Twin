import { Incident } from '../types/mission';
import { useMissionStore } from '../store/missionStore';

export class IncidentTracker {
  static getActiveIncidents(): Incident[] {
    const { incidents } = useMissionStore.getState();
    return incidents ? incidents.filter((incident: Incident) => incident.status !== 'resolved') : [];
  }

  static getIncidentDurationMs(incident: Incident): number {
    return Date.now() - incident.detection_time;
  }

  static getRecoveryProgress(incident: Incident): number {
    switch (incident.status) {
      case 'resolved': return 100;
      case 'recovering': return 75;
      case 'diagnosed': return 50;
      case 'investigating': return 25;
      case 'unresolved': return 0;
      default: return 0;
    }
  }
}
