import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';
import { SafetyValidator } from './SafetyValidator';

class AutonomousController {
  constructor() {
    eventBus.subscribe('AI_RECOMMENDATION', this.handleRecommendation);
  }

  private handleRecommendation = (payload: { threatId: string, action: string }) => {
    const store = useMissionStore.getState();
    const mode = store.controlMode;

    if (mode === 'manual') {
      eventBus.publish('ALERT', { type: 'warning', message: `Manual intervention required for threat: ${payload.action}` });
      return;
    }

    // Autonomous Mode
    if (SafetyValidator.validate(payload.action)) {
      this.executeAction(payload.threatId, payload.action);
    } else {
      eventBus.publish('ALERT', { type: 'critical', message: `AI action ${payload.action} blocked by SafetyValidator.` });
    }
  };

  executeAction(threatId: string, action: string) {
    const store = useMissionStore.getState();
    eventBus.publish('AUTONOMOUS_ACTION', { threatId, action });
    
    // Simulate recovery
    setTimeout(() => {
      store.mitigateThreat(threatId);
      store.setAIAnalysis({
        ...store.aiAnalysis,
        anomalyDetected: false,
        phase: 'monitoring',
        anomalyDescription: 'Systems Nominal',
        riskLevel: 'low',
        recoverySecondsRemaining: 0,
      });
      eventBus.publish('ALERT', { type: 'success', message: `Autonomous Action Executed: Threat neutralized.` });
    }, 2000);
  }
}

export const autonomousController = new AutonomousController();
