import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';

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
    const solarLevel = 1.5 + solarCycle * 3.5;
    const classification: 'critical' | 'warning' | 'normal' | 'low' = solarLevel > 7 ? 'critical'
      : solarLevel > 4.5 ? 'warning'
      : solarLevel > 2 ? 'normal' : 'low';

    const env = {
      solarActivityLevel: clamp(solarLevel, 0, 10),
      radiationLevel: clamp(10 + solarLevel * 5, 5, 100),
      magneticFieldNT: 31200,
      temperatureRangeC: [-90 - Math.round(solarLevel * 2), 120 + Math.round(solarLevel * 5)] as [number, number],
      debrisDensity: 1.2,
      classification,
      dataSource: 'simulation' as const,
    };

    store.setEnvironment(env);
    eventBus.publish('ENVIRONMENT_CHANGE', env);
  };
}

export const spaceEnvironmentEngine = new SpaceEnvironmentEngine();
