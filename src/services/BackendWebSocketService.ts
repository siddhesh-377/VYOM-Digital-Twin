/**
 * VYOM — Backend WebSocket Client Service
 *
 * Bridges the FastAPI backend WebSocket into the Zustand MissionStore.
 * When connected, the backend becomes the authoritative source of truth.
 * Falls back gracefully to the local SimulationEngine on disconnect.
 */

import { useMissionStore } from '../store/missionStore';

const BACKEND_WS_URL = import.meta.env.VITE_BACKEND_WS_URL ?? 'ws://localhost:8000/ws';
const BACKEND_API_URL = import.meta.env.VITE_BACKEND_API_URL ?? 'http://localhost:8000';

type ConnectionStatus = 'disconnected' | 'connecting' | 'connected' | 'failed';

class BackendWebSocketService {
  private ws: WebSocket | null = null;
  private missionId: string | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectAttempts = 0;
  private readonly MAX_RECONNECT = 5;
  private status: ConnectionStatus = 'disconnected';
  private _statusListeners: ((s: ConnectionStatus) => void)[] = [];
  private _messageCount = 0;

  /** Connect to the backend WebSocket for a mission. */
  connect(missionId: string): void {
    if (this.missionId === missionId && this.status === 'connected') return;
    this.missionId = missionId;
    this.reconnectAttempts = 0;
    this._connect();
  }

  disconnect(): void {
    if (this.reconnectTimer) clearTimeout(this.reconnectTimer);
    if (this.ws) {
      this.ws.onclose = null;
      this.ws.close();
      this.ws = null;
    }
    this._setStatus('disconnected');
    this.missionId = null;
    // Notify store that we're back to local simulation
    console.log('[VYOM WS] Disconnected from backend — local simulation active');
  }

  /** Send a message to the backend via WebSocket. */
  send(type: string, payload: unknown): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify({ type, payload }));
    }
  }

  /** Set time multiplier via WebSocket. */
  setTimeMultiplier(multiplier: number): void {
    this.send('SET_TIME_MULTIPLIER', { multiplier });
  }

  pause(): void { this.send('PAUSE', {}); }
  resume(): void { this.send('RESUME', {}); }

  get connectionStatus(): ConnectionStatus { return this.status; }
  get isConnected(): boolean { return this.status === 'connected'; }
  get messageCount(): number { return this._messageCount; }

  onStatusChange(fn: (s: ConnectionStatus) => void): () => void {
    this._statusListeners.push(fn);
    return () => { this._statusListeners = this._statusListeners.filter(l => l !== fn); };
  }

  private _connect(): void {
    if (!this.missionId) return;
    this._setStatus('connecting');

    const url = `${BACKEND_WS_URL}/${this.missionId}`;
    console.log(`[VYOM WS] Connecting to ${url}`);

    try {
      this.ws = new WebSocket(url);
    } catch {
      this._scheduleReconnect();
      return;
    }

    this.ws.onopen = () => {
      console.log('[VYOM WS] Connected to backend — authoritative mode active');
      this._setStatus('connected');
      this.reconnectAttempts = 0;
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._messageCount++;
        this._handleMessage(msg);
      } catch (e) {
        console.warn('[VYOM WS] Failed to parse message', e);
      }
    };

    this.ws.onerror = () => {
      // Will be followed by onclose
    };

    this.ws.onclose = () => {
      console.log('[VYOM WS] Connection closed');
      this.ws = null;
      if (this.status !== 'disconnected') {
        this._scheduleReconnect();
      }
    };
  }

  private _handleMessage(msg: { type: string; payload: unknown }): void {
    const store = useMissionStore.getState();
    const { type, payload } = msg;

    switch (type) {
      case 'CONNECTED':
        console.log('[VYOM WS] Mission connected:', payload);
        break;

      case 'TELEMETRY_UPDATE':
        // Backend telemetry is authoritative — push directly into store
        if (payload && typeof payload === 'object') {
          const t = payload as any;
          // Ensure crew is preserved from existing store if not provided by backend
          if (!t.crew || t.crew.length === 0) {
            t.crew = store.crew;
          }
          store.pushTelemetry(t);
        }
        break;

      case 'CLOCK_TICK': {
        const p = payload as any;
        if (typeof p?.missionDay === 'number') {
          // Use backend's authoritative mission day
          // We patch missionDay directly since tickMission uses real delta
          useMissionStore.setState({ missionDay: p.missionDay });
        }
        if (typeof p?.objectiveProgress === 'number') {
          store.setObjectiveProgress(p.objectiveProgress);
        }
        if (p?.missionPhase) {
          useMissionStore.setState({ missionPhase: p.missionPhase });
        }
        if (p?.status && p.status !== store.status) {
          if (p.status === 'completed') store.completeMission();
        }
        break;
      }
      
      case 'INCIDENT_UPDATE': {
        const inc = payload as any;
        if (inc && inc.id) {
          const current = store.incidents;
          const exists = current.findIndex(i => i.id === inc.id);
          if (exists >= 0) {
            const next = [...current];
            next[exists] = inc;
            useMissionStore.setState({ incidents: next });
          } else {
            useMissionStore.setState({ incidents: [...current, inc] });
          }
        }
        break;
      }
      
      case 'DAILY_SUMMARY': {
        if (payload) {
          useMissionStore.setState({ dailySummaries: [...store.dailySummaries, payload as any] });
        }
        break;
      }

      case 'AI_ANALYSIS':
        if (payload && typeof payload === 'object') {
          store.setAIAnalysis(payload as any);
        }
        break;

      case 'THREAT_DETECTED':
        if (payload && typeof payload === 'object') {
          const t = payload as any;
          // Only add if not already in active threats
          const existing = store.activeThreats.find(th => th.id === t.id);
          if (!existing) {
            store.addThreat({
              id: t.id,
              type: t.type,
              name: t.name,
              description: t.description,
              active: true,
              severity: t.severity,
              startedAt: t.startedAt,
              effects: t.effects || {},
            });
          }
        }
        break;

      case 'THREAT_MITIGATED': {
        const p = payload as any;
        if (p?.id) store.mitigateThreat(p.id);
        break;
      }

      case 'THREAT_UPDATE':
        // Full threats list from backend — sync store
        if (Array.isArray(payload)) {
          const activeFaults = payload.filter((f: any) => f.active);
          // Remove mitigated threats from store
          const storeActive = store.activeThreats;
          storeActive.forEach(st => {
            if (!activeFaults.find((f: any) => f.id === st.id)) {
              store.mitigateThreat(st.id);
            }
          });
          // Add new threats
          activeFaults.forEach((f: any) => {
            if (!storeActive.find(st => st.id === f.id)) {
              store.addThreat({
                id: f.id, type: f.type, name: f.name, description: f.description,
                active: true, severity: f.severity, startedAt: f.startedAt, effects: f.effects || {},
              });
            }
          });
        }
        break;

      case 'BLACKBOX_EVENT':
        if (payload && typeof payload === 'object') {
          const ev = payload as any;
          store.logEvent({
            id: ev.id,
            timestamp: ev.timestamp,
            missionDay: ev.missionDay,
            eventType: ev.eventType,
            severity: ev.severity,
            description: ev.description,
            source: ev.source,
            immutable: true,
          });
        }
        break;

      case 'SUBSYSTEM_HEALTH':
        if (payload && typeof payload === 'object') {
          const p = payload as any;
          const currentSat = store.satellite;
          if (currentSat && p.subsystems) {
            store.setSatelliteConfig({
              ...currentSat,
              subsystems: p.subsystems,
            });
          }
        }
        break;

      case 'ENVIRONMENT_UPDATE':
        if (payload && typeof payload === 'object') {
          // Merge so a partial payload never wipes out default fields (e.g. temperatureRangeC)
          store.setEnvironment({ ...store.environment, ...(payload as any) });
        }
        break;

      case 'COMMAND_UPDATE': {
        const p = payload as any;
        if (p?.id && p?.status === 'COMPLETE') {
          store.completeAction(p.id, p.result ?? 'Executed');
        }
        break;
      }

      case 'ANOMALY_UPDATE':
        // Frontend can use this for additional anomaly visualization
        // Currently handled through AI_ANALYSIS
        break;

      default:
        break;
    }
  }

  private _scheduleReconnect(): void {
    this._setStatus('connecting');
    if (this.reconnectAttempts >= this.MAX_RECONNECT) {
      this._setStatus('failed');
      console.warn('[VYOM WS] Max reconnect attempts reached. Staying in local mode.');
      return;
    }
    const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 10000);
    this.reconnectAttempts++;
    console.log(`[VYOM WS] Reconnecting in ${delay}ms (attempt ${this.reconnectAttempts})`);
    this.reconnectTimer = setTimeout(() => this._connect(), delay);
  }

  private _setStatus(s: ConnectionStatus): void {
    this.status = s;
    this._statusListeners.forEach(fn => fn(s));
  }
}

/** Singleton instance */
export const backendWS = new BackendWebSocketService();

/** Auto-connect when mission starts. Call this from MissionControlScreen. */
export function connectBackend(missionId: string): void {
  backendWS.connect(missionId);
}

// Map frontend UI threat IDs to backend canonical fault catalogue keys
const THREAT_ID_TO_FAULT_TYPE: Record<string, string> = {
  'solar-storm': 'solar_storm',
  'asteroid': 'solar_panel_degradation',
  'debris': 'solar_panel_degradation',
  'power-failure': 'battery_failure',
  'thermal-failure': 'thermal_overheating',
  'communication-failure': 'comm_failure',
  'attitude-failure': 'attitude_control_failure',
  'space-debris': 'solar_panel_degradation',
  'sensor-glitch': 'sensor_failure',
  'thruster-leak': 'propulsion_anomaly',
  'communication-loss': 'telemetry_loss',
};

/** Inject a fault via backend REST API. Falls back to local simulation when the threat has no backend equivalent. */
export async function injectFaultViaBackend(
  missionId: string,
  faultType: string,
  severity: number = 7.5,
): Promise<boolean> {
  const canonical = THREAT_ID_TO_FAULT_TYPE[faultType] ?? faultType.replace(/-/g, '_');
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/missions/${missionId}/faults`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fault_type: canonical, severity }),
    });
    if (!res.ok) {
      console.warn('[VYOM API] Fault injection rejected by backend:', await res.text());
    }
    return res.ok;
  } catch {
    return false;
  }
}

/** Submit a manual recovery action for an incident. */
export async function submitManualActionViaBackend(
  missionId: string,
  incidentId: string,
  actionType: string,
  params: Record<string, any> = {}
): Promise<{ success: boolean; result?: string; error?: string }> {
  try {
    const res = await fetch(`${BACKEND_API_URL}/api/missions/${missionId}/incidents/${incidentId}/manual-recovery`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ action_type: actionType, parameters: params }),
    });
    if (!res.ok) {
      const err = await res.text();
      console.warn('[VYOM API] Manual action rejected:', err);
      return { success: false, error: err };
    }
    const data = await res.json();
    return { success: true, result: data.action_result };
  } catch (e) {
    return { success: false, error: String(e) };
  }
}

/** Create + start a mission on the backend. */
export async function createAndStartMission(config: {
  id: string;
  name: string;
  type: string;
  destination: string;
  objective: string;
  budgetCrore: number;
  launchSite: { name: string; country: string; lat: number; lng: number; agency: string };
  crew?: unknown[];
}): Promise<boolean> {
  try {
    // 1. Create mission
    const createRes = await fetch(`${BACKEND_API_URL}/api/missions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config),
      signal: AbortSignal.timeout(5000),
    });
    if (!createRes.ok) {
      console.warn('[VYOM API] Create mission failed:', await createRes.text());
      return false;
    }

    // 2. Start simulation
    const startRes = await fetch(`${BACKEND_API_URL}/api/missions/${config.id}/start`, {
      method: 'POST',
      signal: AbortSignal.timeout(5000),
    });
    if (!startRes.ok) {
      console.warn('[VYOM API] Start mission failed:', await startRes.text());
      return false;
    }

    console.log(`[VYOM API] Mission ${config.id} created and started on backend`);
    return true;
  } catch (e) {
    console.warn('[VYOM API] Backend not available, using local simulation:', e);
    return false;
  }
}

/** Check if backend is reachable. */
export async function checkBackendHealth(): Promise<boolean> {
  try {
    const res = await fetch(`${BACKEND_API_URL}/health`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}
