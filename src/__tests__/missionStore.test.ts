import { describe, it, expect, beforeEach } from 'vitest';
import { useMissionStore } from '../store/missionStore';

// Store state is reset between tests so engine singletons always see a clean slate.
function reset() {
  useMissionStore.getState().resetMission();
}

describe('missionStore', () => {
  beforeEach(() => {
    reset();
  });

  it('starts with active status and default telemetry', () => {
    const s = useMissionStore.getState();
    expect(s.status).toBe('active');
    expect(s.telemetry.overallHealth).toBe(98.5);
    expect(s.missionDay).toBe(0.0);
  });

  it('addThreat sets status to threatened and counts it', () => {
    const store = useMissionStore.getState();
    store.addThreat({
      id: 't1', type: 'solar-flare' as any, name: 'Solar Flare',
      description: 'd', active: true, severity: 'critical',
      startedAt: Date.now(), effects: {},
    });
    const s = useMissionStore.getState();
    expect(s.activeThreats).toHaveLength(1);
    expect(s.status).toBe('threatened');
    expect(s.stats.threatsEncountered).toBe(1);
  });

  it('mitigateThreat clears active threats and restores status', () => {
    const store = useMissionStore.getState();
    store.addThreat({
      id: 't1', type: 'debris' as any, name: 'Debris', description: 'd',
      active: true, severity: 'critical', startedAt: Date.now(), effects: {},
    });
    useMissionStore.getState().mitigateThreat('t1');
    const s = useMissionStore.getState();
    expect(s.activeThreats).toHaveLength(0);
    expect(s.threatHistory).toHaveLength(1);
    expect(s.status).toBe('active');
  });

  it('mitigateThreat for unknown id is a no-op', () => {
    const before = useMissionStore.getState().threatHistory.length;
    useMissionStore.getState().mitigateThreat('nope');
    expect(useMissionStore.getState().threatHistory.length).toBe(before);
  });

  it('tickMission advances missionDay by sim delta', () => {
    const store = useMissionStore.getState();
    store.setTimeMultiplier(2);
    store.tickMission(60 * 60 * 24 * 1000); // 1 real day at 2x
    expect(useMissionStore.getState().missionDay).toBeCloseTo(2, 3);
    expect(useMissionStore.getState().elapsedRealMs).toBe(60 * 60 * 24 * 1000);
  });

  it('tickMission is ignored after completion', () => {
    const store = useMissionStore.getState();
    store.completeMission();
    const day = useMissionStore.getState().missionDay;
    useMissionStore.getState().tickMission(1000);
    expect(useMissionStore.getState().missionDay).toBe(day);
  });

  it('completeMilestone marks a milestone done', () => {
    useMissionStore.getState().completeMilestone('m3');
    const m = useMissionStore.getState().milestones.find((x) => x.id === 'm3');
    expect(m?.completed).toBe(true);
    expect(m?.completedAt).toBeTruthy();
  });

  it('setObjectiveProgress rejects NaN', () => {
    useMissionStore.getState().setObjectiveProgress(NaN);
    expect(useMissionStore.getState().objectiveProgress).toBe(0);
  });

  it('pushTelemetry updates telemetry and stats', () => {
    const before = useMissionStore.getState().stats.maxHealth;
    useMissionStore.getState().pushTelemetry({
      ...useMissionStore.getState().telemetry,
      overallHealth: before + 1,
    });
    expect(useMissionStore.getState().telemetry.overallHealth).toBe(before + 1);
    expect(useMissionStore.getState().stats.maxHealth).toBe(before + 1);
  });

  it('completeMission transitions to completion screen', () => {
    useMissionStore.getState().completeMission();
    const s = useMissionStore.getState();
    expect(s.status).toBe('completed');
    expect(s.screen).toBe('completion');
    expect(s.objectiveProgress).toBe(100);
  });

  it('startMission builds mission-specific milestones', () => {
    useMissionStore.getState().startMission();
    const s = useMissionStore.getState();
    expect(s.status).toBe('active');
    expect(s.missionDay).toBe(0);
    expect(s.milestones.length).toBeGreaterThan(0);
    expect(s.objectiveProgress).toBe(0);
  });

  it('archiveMission persists to archivedMissions', () => {
    const store = useMissionStore.getState();
    store.archiveMission();
    expect(useMissionStore.getState().archivedMissions.length).toBeGreaterThan(0);
  });
});