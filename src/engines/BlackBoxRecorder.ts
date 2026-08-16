import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';
import type { BlackBoxEvent } from '../types/mission';

const TYPE_MAP: Record<string, BlackBoxEvent['eventType']> = {
  TELEMETRY: 'telemetry',
  ENVIRONMENT: 'telemetry',
  THREAT: 'threat',
  AI_ANOMALY: 'ai',
  AUTONOMOUS_ACTION: 'command',
  MILESTONE: 'milestone',
};

const SEVERITY_MAP: Record<string, BlackBoxEvent['severity']> = {
  info: 'nominal',
  success: 'nominal',
  warning: 'warning',
  critical: 'critical',
};

class BlackBoxRecorder {
  private events: BlackBoxEvent[] = [];

  constructor() {
    eventBus.subscribe('TELEMETRY_UPDATE', (data) => this.record('TELEMETRY', 'info', 'Telemetry logged (internal)'));
    eventBus.subscribe('THREAT_DETECTED', (t) => this.record('THREAT', 'critical', `Threat Detected: ${t.name}`));
    eventBus.subscribe('AI_ANOMALY', (ai) => this.record('AI_ANOMALY', 'warning', `AI Detected Anomaly: ${ai.anomalyDescription}`));
    eventBus.subscribe('AUTONOMOUS_ACTION', (act) => this.record('AUTONOMOUS_ACTION', 'info', `Autonomous Action Executed: ${act.action}`));
    eventBus.subscribe('MISSION_COMPLETE', () => this.record('MILESTONE', 'success', 'Mission Complete'));
    eventBus.subscribe('ENVIRONMENT_CHANGE', (env) => this.record('ENVIRONMENT', 'info', `Environment classification: ${env.classification}`));
  }

  record(type: string, severity: 'info' | 'warning' | 'critical' | 'success', description: string) {
    // Only record unique significant events to avoid spamming the log (except for specific cases)
    if (type === 'TELEMETRY' || type === 'ENVIRONMENT') {
      if (Math.random() > 0.05) return; // Sample these lightly for the prototype to avoid huge memory usage
    }

    const store = useMissionStore.getState();
    const event: BlackBoxEvent = {
      id: `bb-${Date.now()}`,
      missionDay: store.missionDay,
      timestamp: Date.now(),
      eventType: TYPE_MAP[type] ?? 'telemetry',
      severity: SEVERITY_MAP[severity] ?? 'nominal',
      description,
      source: 'System',
      immutable: true,
    };

    this.events.push(event);
    store.logEvent(event); // Push to the store for UI rendering
  }

  getEvents() {
    return this.events;
  }
}

export const blackBoxRecorder = new BlackBoxRecorder();
