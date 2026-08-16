import { eventBus } from './MissionEventBus';

export type AlertType = 'info' | 'warning' | 'critical' | 'success';

export interface AlertMessage {
  id: string;
  type: AlertType;
  message: string;
  timestamp: number;
}

class AlertEngine {
  private activeAlerts: AlertMessage[] = [];

  constructor() {
    eventBus.subscribe('ALERT', this.handleAlert);
    eventBus.subscribe('THREAT_DETECTED', (t) => this.handleAlert({ type: 'critical', message: `Threat Detected: ${t.name}` }));
  }

  private handleAlert = (payload: { type: AlertType, message: string }) => {
    const alert: AlertMessage = {
      id: `alert-${Date.now()}`,
      type: payload.type,
      message: payload.message,
      timestamp: Date.now(),
    };
    this.activeAlerts.push(alert);
    
    // In a real implementation we would push this to a React context or Zustand slice specifically for UI toasts.
    console.log(`[ALERT - ${alert.type.toUpperCase()}] ${alert.message}`);
  };

  getActiveAlerts() {
    return this.activeAlerts;
  }
}

export const alertEngine = new AlertEngine();
