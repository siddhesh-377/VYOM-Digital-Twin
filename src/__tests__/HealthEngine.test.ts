import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus } from '../engines/MissionEventBus';
import { healthEngine } from '../engines/HealthEngine';
import { useMissionStore } from '../store/missionStore';

function reset() {
  useMissionStore.getState().resetMission();
}

describe('HealthEngine', () => {
  beforeEach(() => {
    reset();
    vi.restoreAllMocks();
  });

  it('degrades health when telemetry is out of bounds', () => {
    const publish = vi.spyOn(eventBus, 'publish');
    useMissionStore.setState({
      telemetry: {
        ...useMissionStore.getState().telemetry,
        overallHealth: 98.5,
        thermal: { ...useMissionStore.getState().telemetry.thermal, cpuTempC: 85 },
        power: { ...useMissionStore.getState().telemetry.power, voltageV: 20 },
        comm: { ...useMissionStore.getState().telemetry.comm, signalDbm: -115 },
        attitude: { ...useMissionStore.getState().telemetry.attitude, reactionWheelRpm: 6500 },
      },
    });

    eventBus.publish('CLOCK_TICK', { simDelta: 10000, tickCount: 1 });

    const updates = publish.mock.calls
      .filter(([name]) => name === 'HEALTH_UPDATE')
      .map(([, payload]) => payload);
    expect(updates.length).toBe(1);
    // 0.05 + 0.08 + 0.02 + 0.03 = 0.18/s * 10s = 1.8 below 98.5
    expect(updates[0]).toBeCloseTo(96.7, 1);
    expect(useMissionStore.getState().stats.minHealth).toBeCloseTo(96.7, 1);
  });

  it('recovers health when nominal and no threats', () => {
    const publish = vi.spyOn(eventBus, 'publish');
    useMissionStore.setState({
      telemetry: { ...useMissionStore.getState().telemetry, overallHealth: 98.5 },
      activeThreats: [],
      environment: { ...useMissionStore.getState().environment, radiationLevel: 10 },
    });

    eventBus.publish('CLOCK_TICK', { simDelta: 10000, tickCount: 1 });

    const updates = publish.mock.calls
      .filter(([name]) => name === 'HEALTH_UPDATE')
      .map(([, payload]) => payload);
    expect(updates.length).toBe(1);
    expect(updates[0]).toBeCloseTo(98.7, 1);
  });

  it('high radiation increases health drop', () => {
    const publish = vi.spyOn(eventBus, 'publish');
    useMissionStore.setState({
      telemetry: { ...useMissionStore.getState().telemetry, overallHealth: 98.5 },
      environment: { ...useMissionStore.getState().environment, radiationLevel: 150 },
    });

    eventBus.publish('CLOCK_TICK', { simDelta: 10000, tickCount: 1 });

    const updates = publish.mock.calls
      .filter(([name]) => name === 'HEALTH_UPDATE')
      .map(([, payload]) => payload);
    // 0.10/s from radiation * 10s = 1.0 below 98.5
    expect(updates[0]).toBeCloseTo(97.5, 1);
  });

  it('clamps health to 100', () => {
    const publish = vi.spyOn(eventBus, 'publish');
    useMissionStore.setState({
      telemetry: { ...useMissionStore.getState().telemetry, overallHealth: 99.5 },
      activeThreats: [],
      environment: { ...useMissionStore.getState().environment, radiationLevel: 10 },
    });

    eventBus.publish('CLOCK_TICK', { simDelta: 60000, tickCount: 1 });

    const updates = publish.mock.calls
      .filter(([name]) => name === 'HEALTH_UPDATE')
      .map(([, payload]) => payload);
    expect(updates[updates.length - 1]).toBe(100);
  });

  it('does nothing when telemetry is missing', () => {
    const publish = vi.spyOn(eventBus, 'publish');
    useMissionStore.setState({ telemetry: null as any });
    expect(() => eventBus.publish('CLOCK_TICK', { simDelta: 1000, tickCount: 1 })).not.toThrow();
    expect(publish).not.toHaveBeenCalledWith('HEALTH_UPDATE', expect.anything());
  });
});