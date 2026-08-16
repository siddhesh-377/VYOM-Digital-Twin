import { missionClockEngine } from './MissionClockEngine';
import { missionConfigEngine } from './MissionConfigEngine';
import { telemetryEngine } from './TelemetryEngine';
import { spaceEnvironmentEngine } from './SpaceEnvironmentEngine';
import { orbitEngine } from './OrbitEngine';
import { threatEngine } from './ThreatEngine';
import { healthEngine } from './HealthEngine';
import { digitalTwinEngine } from './DigitalTwinEngine';
import { vyomAIEngine } from './VYOMAIEngine';
import { autonomousController } from './AutonomousController';
import { missionObjectiveEngine } from './MissionObjectiveEngine';
import { alertEngine } from './AlertEngine';
import { blackBoxRecorder } from './BlackBoxRecorder';
import { missionSnapshotManager } from './MissionSnapshotManager';
import { missionSimulationEngine } from './MissionSimulationEngine';

export function initializeEngines() {
  // Ensure all engines are instantiated and their constructors (which subscribe to EventBus) are run.
  missionSimulationEngine.start();
  console.log('VYOM Mission Engines Initialized.');
  console.log({
    missionClockEngine,
    missionConfigEngine,
    telemetryEngine,
    spaceEnvironmentEngine,
    orbitEngine,
    threatEngine,
    healthEngine,
    digitalTwinEngine,
    vyomAIEngine,
    autonomousController,
    missionObjectiveEngine,
    alertEngine,
    blackBoxRecorder,
    missionSnapshotManager,
    missionSimulationEngine,
  });
}
