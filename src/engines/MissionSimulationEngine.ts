import { missionClockEngine } from './MissionClockEngine';

class MissionSimulationEngine {
  start() {
    missionClockEngine.start();
  }

  stop() {
    missionClockEngine.stop();
  }
}

export const missionSimulationEngine = new MissionSimulationEngine();
