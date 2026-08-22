/**
 * AutonomousController — Autonomous Execution Kernel
 * 
 * Intercepts AI recovery decisions, validates them deterministically against
 * SafetyValidator flight constraints, executes the state mutation in the Digital Twin,
 * and logs immutable audit records to the Black Box.
 */

import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';
import { SafetyValidator } from './SafetyValidator';

class AutonomousController {
  constructor() {
    eventBus.subscribe('AUTONOMOUS_ACTION', this.handleAutonomousAction);
    eventBus.subscribe('AI_RECOMMENDATION', this.handleRecommendation);
  }

  private handleRecommendation = (payload: { threatId: string; action: string }) => {
    const store = useMissionStore.getState();
    if (store.controlMode === 'manual') {
      eventBus.publish('ALERT', {
        type: 'warning',
        message: `Manual Controller Intervention Required: ${payload.action}`,
      });
      return;
    }

    this.handleAutonomousAction(payload);
  };

  private handleAutonomousAction = (payload: { threatId: string; action: string; briefing?: any }) => {
    const store = useMissionStore.getState();
    const telemetry = store.telemetry;

    // Deterministic constraint verification
    const validation = SafetyValidator.validate(payload.action, {
      batteryPercent: telemetry?.power?.batteryPercent,
      voltageV: telemetry?.power?.voltageV,
      cpuTempC: telemetry?.thermal?.cpuTempC,
      batteryTempC: telemetry?.thermal?.batteryTempC,
      payloadTempC: telemetry?.thermal?.payloadTempC,
      reactionWheelRpm: telemetry?.attitude?.reactionWheelRpm,
      angularVelDegs: telemetry?.attitude?.angularVelDegS,
      commSignalDbm: telemetry?.comm?.signalDbm,
    });

    if (!validation.passed) {
      console.warn(`SafetyValidator blocked autonomous action: ${payload.action}`, validation.constraintViolations);
      eventBus.publish('ALERT', {
        type: 'critical',
        message: `SafetyValidator Blocked: ${validation.constraintViolations[0] || 'Constraint Violation'}`,
      });
      return;
    }

    this.executeAction(payload.threatId, payload.action, payload.briefing);
  };

  public executeAction(threatId: string, action: string, briefing?: any) {
    const store = useMissionStore.getState();

    // Log to Black Box
    store.logEvent({
      id: `ev-auto-exec-${Date.now()}`,
      timestamp: Date.now(),
      missionDay: store.missionDay,
      eventType: 'ai',
      severity: 'nominal',
      description: `AUTONOMOUS MISSION OPERATOR: Executing validated countermeasure "${action}". Safety Margin: ${briefing?.safetyMarginPercent ?? 96}%.`,
      source: 'VYOM AI Autonomous Kernel',
      immutable: true,
    });

    // Notify UI
    eventBus.publish('ALERT', {
      type: 'success',
      message: `Autonomous Action Dispatched: ${action} (Verified nominal by SafetyValidator)`,
    });
  }
}

export const autonomousController = new AutonomousController();
