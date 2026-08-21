import { describe, it, expect, vi } from 'vitest';
import { eventBus } from '../engines/MissionEventBus';
import { alertEngine } from '../engines/AlertEngine';

describe('AlertEngine', () => {
  it('records ALERT events', () => {
    const countBefore = alertEngine.getActiveAlerts().length;
    eventBus.publish('ALERT', { type: 'warning', message: 'Low fuel' });
    const alerts = alertEngine.getActiveAlerts();
    expect(alerts.length).toBe(countBefore + 1);
    const last = alerts[alerts.length - 1];
    expect(last.type).toBe('warning');
    expect(last.message).toBe('Low fuel');
    expect(last.id).toMatch(/^alert-/);
  });

  it('records critical alerts for detected threats', () => {
    const countBefore = alertEngine.getActiveAlerts().length;
    eventBus.publish('THREAT_DETECTED', { name: 'Solar Flare' });
    const alerts = alertEngine.getActiveAlerts();
    expect(alerts.length).toBe(countBefore + 1);
    const last = alerts[alerts.length - 1];
    expect(last.type).toBe('critical');
    expect(last.message).toContain('Solar Flare');
  });
});