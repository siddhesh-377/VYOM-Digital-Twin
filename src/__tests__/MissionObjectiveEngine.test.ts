import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus } from '../engines/MissionEventBus';
import { missionObjectiveEngine } from '../engines/MissionObjectiveEngine';
import { useMissionStore } from '../store/missionStore';

function reset() {
  useMissionStore.getState().resetMission();
}

describe('MissionObjectiveEngine', () => {
  beforeEach(() => {
    reset();
    vi.restoreAllMocks();
  });

  it('ignores ticks that are not multiples of 120', () => {
    const publish = vi.spyOn(eventBus, 'publish');
    const progressBefore = useMissionStore.getState().objectiveProgress;
    eventBus.publish('CLOCK_TICK', { tickCount: 119 });
    expect(useMissionStore.getState().objectiveProgress).toBe(progressBefore);
    expect(publish).not.toHaveBeenCalledWith('MILESTONE_COMPLETED', expect.anything());
  });

  it('completes due milestones and updates progress', () => {
    const publish = vi.spyOn(eventBus, 'publish');
    useMissionStore.setState({
      status: 'active',
      missionDay: 5,
      milestones: [
        { id: 'm1', label: 'Done', completed: true, requiresDays: 0.1 },
        { id: 'm2', label: 'Due', completed: false, requiresDays: 3 },
      ],
    });

    eventBus.publish('CLOCK_TICK', { tickCount: 120 });

    const s = useMissionStore.getState();
    expect(s.milestones.find((m) => m.id === 'm2')?.completed).toBe(true);
    // milestonePct = 2/2*100 = 100; dayProgress = 5/273.75*100 = 1.83
    // combined = round(100*0.7 + 1.83*0.3) = round(70.55) = 71
    expect(s.objectiveProgress).toBe(71);
    expect(publish).toHaveBeenCalledWith('MILESTONE_COMPLETED', expect.objectContaining({ id: 'm2' }));
  });

  it('does not complete milestones when not in an active status', () => {
    const publish = vi.spyOn(eventBus, 'publish');
    useMissionStore.setState({
      status: 'configuring',
      missionDay: 50,
      milestones: [{ id: 'm1', label: 'Due', completed: false, requiresDays: 1 }],
    });

    eventBus.publish('CLOCK_TICK', { tickCount: 120 });

    expect(useMissionStore.getState().milestones[0].completed).toBe(false);
    expect(publish).not.toHaveBeenCalledWith('MILESTONE_COMPLETED', expect.anything());
  });

  it('fires MISSION_COMPLETE at 100% progress', () => {
    const publish = vi.spyOn(eventBus, 'publish');
    useMissionStore.setState({
      status: 'active',
      missionDay: 100,
      milestones: [{ id: 'm1', label: 'Done', completed: true, requiresDays: 0.1 }],
    });

    eventBus.publish('CLOCK_TICK', { tickCount: 120 });

    const s = useMissionStore.getState();
    expect(s.status).toBe('completed');
    expect(publish).toHaveBeenCalledWith('MISSION_COMPLETE', expect.anything());
  });
});