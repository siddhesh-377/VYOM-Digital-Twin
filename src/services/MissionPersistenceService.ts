import { openDB } from 'idb';

const DB_NAME = 'VYOM_MissionDB';
const DB_VERSION = 1;

export class MissionPersistenceService {
  private static async getDB() {
    return openDB(DB_NAME, DB_VERSION, {
      upgrade(db) {
        if (!db.objectStoreNames.contains('missions')) {
          db.createObjectStore('missions', { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains('telemetry')) {
          db.createObjectStore('telemetry', { autoIncrement: true });
        }
      },
    });
  }

  static async saveMissionState(missionId: string, state: any) {
    const db = await this.getDB();
    await db.put('missions', { id: missionId, ...state, lastSaved: Date.now() });
  }

  static async loadMissionState(missionId: string) {
    const db = await this.getDB();
    return db.get('missions', missionId);
  }

  static async clearAllMissions() {
    const db = await this.getDB();
    await db.clear('missions');
    await db.clear('telemetry');
  }
}
