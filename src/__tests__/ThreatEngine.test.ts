import { describe, it, expect, beforeEach, vi } from 'vitest';
import { eventBus } from '../engines/MissionEventBus';
import { threatEngine } from '../engines/ThreatEngine';
import { useMissionStore } from '../store/missionStore';

function reset() {
  useMissionStore.getState().resetMission();
}

describe('ThreatEngine', () => {
  beforeEach(() => {
    reset();
    vi.restoreAllMocks();
  });

  it('triggerThreat adds a threat to the store and publishes an event', () => {
    const publish = vi.spyOn(eventBus, 'publish');
    threatEngine.triggerThreat('solar-flare', 'Solar Flare', 'desc', { solar: 3.0 });

    const s = useMissionStore.getState();
    expect(s.activeThreats).toHaveLength(1);
    expect(s.activeThreats[0].type).toBe('solar-flare');
    expect(s.status).toBe('threatened');
    expect(publish).toHaveBeenCalledWith('THREAT_DETECTED', expect.objectContaining({ type: 'solar-flare' }));
  });

  it('spawns a solar threat during high solar activity', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.1); // < 0.2 threshold
    useMissionStore.setState({
      environment: { ...useMissionStore.getState().environment, solarActivityLevel: 9 },
    });

    eventBus.publish('ENVIRONMENT_CHANGE', {
      solarActivityLevel: 9,
      debrisDensity: 1,
    });

    const s = useMissionStore.getState();
    expect(s.activeThreats).toHaveLength(1);
    expect(s.activeThreats[0].type).toBe('solar-flare');
  });

  it('does not spawn debris threat when random roll is high', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.9); // > 0.1 threshold
    useMissionStore.setState({
      environment: { ...useMissionStore.getState().environment, solarActivityLevel: 1, debrisDensity: 8 },
    });

    eventBus.publish('ENVIRONMENT_CHANGE', {
      solarActivityLevel: 1,
      debrisDensity: 8,
    });

    expect(useMissionStore.getState().activeThreats).toHaveLength(0);
  });

  it('does not spawn threats when one is already active', () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.05);
    threatEngine.triggerThreat('debris', 'Debris', 'd', { debris: 1 });
    useMissionStore.setState({
      environment: { ...useMissionStore.getState().environment, solarActivityLevel: 9 },
    });

    eventBus.publish('ENVIRONMENT_CHANGE', { solarActivityLevel: 9, debrisDensity: 8 });

    expect(useMissionStore.getState().activeThreats).toHaveLength(1);
  });
});