import { eventBus } from './MissionEventBus';
import { useMissionStore } from '../store/missionStore';

class MissionConfigEngine {
  processOnboarding(data: any) {
    const store = useMissionStore.getState();
    const config = {
      id: `VYOM-${Date.now()}`,
      name: data.name || 'CUSTOM-01',
      type: data.type || 'orbital',
      destination: data.destination || 'earth-orbit',
      objective: data.objective || 'Default orbital mission',
      budgetCrore: data.budgetCrore || 250,
      launchSite: data.launchSite || { name: 'Satish Dhawan Space Centre (SLP)', country: 'India', lat: 13.72, lng: 80.23, agency: 'ISRO' },
      createdAt: Date.now(),
    };
    
    const lifetimeYears = data.destination === 'lunar-surface' ? 0.05 : 1.5;
    
    store.setMissionConfig(config);
    store.setEstimates(lifetimeYears, 99.2, 94);
    
    eventBus.publish('MISSION_CONFIG_UPDATED', config);
    return config;
  }
}

export const missionConfigEngine = new MissionConfigEngine();
