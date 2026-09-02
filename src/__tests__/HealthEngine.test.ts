import { describe, it, expect, beforeEach } from 'vitest';
import { eventBus } from '../engines/MissionEventBus';
import { healthEngine } from '../engines/HealthEngine';
import { useMissionStore } from '../store/missionStore';

function reset() {
  useMissionStore.getState().resetMission();
}

describe('HealthEngine', () => {
  beforeEach(() => {
    reset();
  });

  it('degrades health when telemetry is out of bounds', () => {
    const updates: number[] = [];
    const unsub = eventBus.subscribe('HEALTH_UPDATE', (val: number) => updates.push(val));

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

    healthEngine.onTick({ simDelta: 10000, tickCount: 1 });

    expect(updates.length).toBe(1);
    // 0.05 + 0.08 + 0.02 + 0.03 = 0.18/s * 10s = 1.8 below 98.5
    expect(updates[0]).toBeCloseTo(96.7, 1);
    expect(useMissionStore.getState().stats.minHealth).toBeCloseTo(96.7, 1);
    unsub();
  });

  it('recovers health when nominal and no threats', () => {
    const updates: number[] = [];
    const unsub = eventBus.subscribe('HEALTH_UPDATE', (val: number) => updates.push(val));

    useMissionStore.setState({
      telemetry: { ...useMissionStore.getState().telemetry, overallHealth: 98.5 },
      activeThreats: [],
      environment: { ...useMissionStore.getState().environment, radiationLevel: 10 },
    });

    healthEngine.onTick({ simDelta: 10000, tickCount: 1 });

    expect(updates.length).toBe(1);
    expect(updates[0]).toBeCloseTo(98.7, 1);
    unsub();
  });

  it('high radiation increases health drop', () => {
    const updates: number[] = [];
    const unsub = eventBus.subscribe('HEALTH_UPDATE', (val: number) => updates.push(val));

    useMissionStore.setState({
      telemetry: { ...useMissionStore.getState().telemetry, overallHealth: 98.5 },
      environment: { ...useMissionStore.getState().environment, radiationLevel: 150 },
    });

    healthEngine.onTick({ simDelta: 10000, tickCount: 1 });

    expect(updates.length).toBe(1);
    // 0.10/s from radiation * 10s = 1.0 below 98.5
    expect(updates[0]).toBeCloseTo(97.5, 1);
    unsub();
  });

  it('clamps health to 100', () => {
    const updates: number[] = [];
    const unsub = eventBus.subscribe('HEALTH_UPDATE', (val: number) => updates.push(val));

    useMissionStore.setState({
      telemetry: { ...useMissionStore.getState().telemetry, overallHealth: 99.5 },
      activeThreats: [],
      environment: { ...useMissionStore.getState().environment, radiationLevel: 10 },
    });

    healthEngine.onTick({ simDelta: 60000, tickCount: 1 });

    expect(updates[updates.length - 1]).toBe(100);
    unsub();
  });

  it('does nothing when telemetry is missing', () => {
    const updates: number[] = [];
    const unsub = eventBus.subscribe('HEALTH_UPDATE', (val: number) => updates.push(val));
    useMissionStore.setState({ telemetry: null as any });
    expect(() => healthEngine.onTick({ simDelta: 1000, tickCount: 1 })).not.toThrow();
    expect(updates.length).toBe(0);
    unsub();
  });
});