import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';
import type { ThreatScenario } from '../types/mission';

class ThreatEngine {
  constructor() {
    eventBus.subscribe('ENVIRONMENT_CHANGE', this.onEnvironmentChange);
  }

  private onEnvironmentChange = (env: any) => {
    // Probabilistically spawn threats based on environment
    const store = useMissionStore.getState();
    if (store.activeThreats.length > 0) return; // Only one threat at a time for prototype

    if (env.solarActivityLevel > 8 && Math.random() < 0.2) {
      this.triggerThreat(
        'solar-flare',
        'Coronal Mass Ejection',
        'X-class solar flare impacting spacecraft shielding. Extreme radiation detected.',
        { solar: 3.0, radiation: 2.5, thermal: 1.5 }
      );
    } else if (env.debrisDensity > 6 && Math.random() < 0.1) {
      this.triggerThreat(
        'debris',
        'Orbital Debris Conjunction',
        'High-velocity micro-debris impact detected on port solar array.',
        { debris: 2.5, attitude: 3.5, power: 1.0 }
      );
    }
  };

  triggerThreat(type: string, name: string, description: string, effects: Record<string, number>) {
    const store = useMissionStore.getState();
    const threat: ThreatScenario = {
      id: `threat-${Date.now()}`,
      type: type as any,
      name,
      description,
      active: true,
      severity: 'critical',
      startedAt: Date.now(),
      effects,
    };
    
    store.addThreat(threat);
    eventBus.publish('THREAT_DETECTED', threat);
  }
}

export const threatEngine = new ThreatEngine();
