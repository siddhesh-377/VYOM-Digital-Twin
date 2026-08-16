import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';

function noise(amp: number) { return (Math.random() - 0.5) * 2 * amp; }
function clamp(v: number, min: number, max: number) { return Math.max(min, Math.min(max, v)); }

class SpaceEnvironmentEngine {
  constructor() {
    eventBus.subscribe('CLOCK_TICK', this.onTick);
  }

  private onTick = (payload: { simDays: number, tickCount: number }) => {
    if (payload.tickCount % 300 !== 0) return;

    const store = useMissionStore.getState();
    const day = store.missionDay;
    const solarCycle = Math.sin(day / 30) * 0.5 + 0.5;
    const solarLevel = 1.5 + solarCycle * 3.5 + noise(0.2);
    const classification: 'critical' | 'warning' | 'normal' | 'low' = solarLevel > 7 ? 'critical'
      : solarLevel > 4.5 ? 'warning'
      : solarLevel > 2 ? 'normal' : 'low';

    const env = {
      solarActivityLevel: clamp(solarLevel, 0, 10),
      radiationLevel: clamp(10 + solarLevel * 5 + noise(2), 5, 100),
      magneticFieldNT: Math.round(30000 + noise(1000)),
      temperatureRangeC: [-90 - Math.round(solarLevel * 2), 120 + Math.round(solarLevel * 5)] as [number, number],
      debrisDensity: clamp(1.2 + noise(0.3), 0.1, 10),
      classification,
      dataSource: 'simulation' as const,
    };

    store.setEnvironment(env);
    eventBus.publish('ENVIRONMENT_CHANGE', env);
  };
}

export const spaceEnvironmentEngine = new SpaceEnvironmentEngine();
