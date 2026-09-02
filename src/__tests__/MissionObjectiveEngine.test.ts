import { describe, it, expect, beforeEach } from 'vitest';
import { eventBus } from '../engines/MissionEventBus';
import { missionObjectiveEngine } from '../engines/MissionObjectiveEngine';
import { useMissionStore } from '../store/missionStore';

function reset() {
  useMissionStore.getState().resetMission();
}

describe('MissionObjectiveEngine', () => {
  beforeEach(() => {
    reset();
  });

  it('ignores ticks that are not multiples of 120', () => {
    const milestonesCompleted: any[] = [];
    const unsub = eventBus.subscribe('MILESTONE_COMPLETED', (m) => milestonesCompleted.push(m));
    const progressBefore = useMissionStore.getState().objectiveProgress;

    missionObjectiveEngine.onTick({ tickCount: 119 });

    expect(useMissionStore.getState().objectiveProgress).toBe(progressBefore);
    expect(milestonesCompleted.length).toBe(0);
    unsub();
  });

  it('completes due milestones and updates progress', () => {
    const milestonesCompleted: any[] = [];
    const unsub = eventBus.subscribe('MILESTONE_COMPLETED', (m) => milestonesCompleted.push(m));

    useMissionStore.setState({
      status: 'active',
      missionDay: 5,
      milestones: [
        { id: 'm1', label: 'Done', completed: true, requiresDays: 0.1 },
        { id: 'm2', label: 'Due', completed: false, requiresDays: 3 },
      ],
    });

    missionObjectiveEngine.onTick({ tickCount: 120 });

    const s = useMissionStore.getState();
    expect(s.milestones.find((m) => m.id === 'm2')?.completed).toBe(true);
    expect(s.objectiveProgress).toBe(71);
    expect(milestonesCompleted.length).toBe(1);
    expect(milestonesCompleted[0].id).toBe('m2');
    unsub();
  });

  it('does not complete milestones when not in an active status', () => {
    const milestonesCompleted: any[] = [];
    const unsub = eventBus.subscribe('MILESTONE_COMPLETED', (m) => milestonesCompleted.push(m));

    useMissionStore.setState({
      status: 'configuring',
      missionDay: 50,
      milestones: [{ id: 'm1', label: 'Due', completed: false, requiresDays: 1 }],
    });

    missionObjectiveEngine.onTick({ tickCount: 120 });

    expect(useMissionStore.getState().milestones[0].completed).toBe(false);
    expect(milestonesCompleted.length).toBe(0);
    unsub();
  });

  it('fires MISSION_COMPLETE at 100% progress', () => {
    const missionsCompleted: any[] = [];
    const unsub = eventBus.subscribe('MISSION_COMPLETE', (p) => missionsCompleted.push(p));

    useMissionStore.setState({
      status: 'active',
      missionDay: 1000,
      milestones: [{ id: 'm1', label: 'Done', completed: true, requiresDays: 0.1 }],
    });

    missionObjectiveEngine.onTick({ tickCount: 120 });

    const s = useMissionStore.getState();
    expect(s.status).toBe('completed');
    expect(missionsCompleted.length).toBe(1);
    unsub();
  });
});