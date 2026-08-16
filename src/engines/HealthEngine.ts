import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';

function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

class HealthEngine {
  constructor() {
    eventBus.subscribe('CLOCK_TICK', this.onTick);
  }

  private onTick = (payload: { simDelta: number, tickCount: number }) => {
    const store = useMissionStore.getState();
    const t = store.telemetry;
    if (!t) return;

    const currentHealth = t.overallHealth ?? 100;

    let healthDrop = 0;

    // Component-level degradation based on limits
    if (t.thermal.cpuTempC > 75) healthDrop += 0.05;
    if (t.power.voltageV < 22) healthDrop += 0.08;
    if (t.comm.signalDbm < -100) healthDrop += 0.02;
    if (t.attitude.reactionWheelRpm > 6000) healthDrop += 0.03;

    // Apply environmental effects (radiation)
    if (store.environment.radiationLevel > 50) {
      healthDrop += (store.environment.radiationLevel - 50) * 0.001;
    }

    // Recover slowly if nominal
    let newHealth = currentHealth;
    if (healthDrop > 0) {
      newHealth -= healthDrop * (payload.simDelta / 1000);
    } else if (store.activeThreats.length === 0) {
      newHealth += 0.02 * (payload.simDelta / 1000);
    }

    newHealth = clamp(newHealth, 0, 100);
    
    if (Math.abs(newHealth - currentHealth) > 0.1) {
      store.updateStats({ minHealth: Math.min(store.stats.minHealth, newHealth) });
      eventBus.publish('HEALTH_UPDATE', newHealth);
    }
  };
}

export const healthEngine = new HealthEngine();
