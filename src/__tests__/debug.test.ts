import { describe, it, expect, vi } from 'vitest';
import { eventBus } from '../engines/MissionEventBus';
import { healthEngine } from '../engines/HealthEngine';
import { useMissionStore } from '../store/missionStore';

describe('debug postmortem', () => {
  it('checks subscription after dispatch', () => {
    useMissionStore.getState().resetMission();
    const updates: number[] = [];
    const unsub = eventBus.subscribe('HEALTH_UPDATE', (p: number) => updates.push(p));
    useMissionStore.setState({
      telemetry: {
        ...useMissionStore.getState().telemetry,
        overallHealth: 98.5,
        thermal: { ...useMissionStore.getState().telemetry.thermal, cpuTempC: 85 },
      },
    });
    eventBus.publish('CLOCK_TICK', { simDelta: 10000, tickCount: 1 });
    console.log('updates:', updates);
    const cbs = (eventBus as any).listeners['CLOCK_TICK'];
    console.log('CLOCK_TICK count:', cbs?.length, 'cb0===onTick:', cbs?.[0] === (healthEngine as any).onTick);
    console.log('telemetry after:', useMissionStore.getState().telemetry.thermal.cpuTempC, 'minHealth:', useMissionStore.getState().stats.minHealth);
    unsub();
  });
});