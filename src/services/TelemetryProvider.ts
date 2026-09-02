/**
 * VYOM — Real-Time Telemetry Provider Architecture (Phase 2 & 14)
 * Coordinates data streams from Supabase Realtime, FastAPI WebSocket 10Hz physics server,
 * Local Simulation Engine, and Historical Replay with state detection (LIVE / SIMULATION / REPLAY / STALE).
 */

import { supabase, isSupabaseConfigured } from './supabaseClient';
import { backendWS } from './BackendWebSocketService';
import { useMissionStore } from '../store/missionStore';
import { Telemetry, DataSource } from '../types/mission';

export type TelemetryDataMode = 'live' | 'simulation' | 'replay' | 'prediction';
export type TelemetryConnectionState = 'LIVE' | 'SIMULATED' | 'REPLAY' | 'STALE' | 'DISCONNECTED';

export interface TelemetryPacket {
  spacecraftId: string;
  missionId: string;
  timestamp: number;
  mode: TelemetryDataMode;
  quality: 'good' | 'degraded' | 'stale' | 'invalid';
  telemetry: Telemetry;
}

export interface TelemetryChannelReading {
  spacecraftId: string;
  subsystem: string;
  channel: string;
  value: number;
  unit: string;
  timestamp: number;
  quality: 'good' | 'degraded' | 'stale';
  source: TelemetryDataMode;
}

class TelemetryProviderService {
  private activeMode: TelemetryDataMode = 'simulation';
  private connectionState: TelemetryConnectionState = 'SIMULATED';
  private lastPacketTimestamp: number = Date.now();
  private staleTimeoutMs: number = 5000;
  private watchdogInterval: ReturnType<typeof setInterval> | null = null;
  private supabaseSubscription: any = null;
  private listeners: Set<(packet: TelemetryPacket) => void> = new Set();
  private stateListeners: Set<(state: TelemetryConnectionState) => void> = new Set();

  constructor() {
    this.startWatchdog();
  }

  public init(missionId: string) {
    if (isSupabaseConfigured() && supabase) {
      this.subscribeSupabase(missionId);
    }
  }

  public setMode(mode: TelemetryDataMode) {
    this.activeMode = mode;
    this.updateConnectionState();
  }

  public getMode(): TelemetryDataMode {
    return this.activeMode;
  }

  public getConnectionState(): TelemetryConnectionState {
    return this.connectionState;
  }

  public getLastTimestamp(): number {
    return this.lastPacketTimestamp;
  }

  public subscribe(callback: (packet: TelemetryPacket) => void): () => void {
    this.listeners.add(callback);
    return () => this.listeners.delete(callback);
  }

  public onStateChange(callback: (state: TelemetryConnectionState) => void): () => void {
    this.stateListeners.add(callback);
    return () => this.stateListeners.delete(callback);
  }

  /**
   * Called when new telemetry arrives from WebSocket, Supabase, or Local Engine
   */
  public ingestTelemetry(telemetry: Telemetry, sourceOverride?: TelemetryDataMode) {
    this.lastPacketTimestamp = Date.now();
    const mode = sourceOverride || this.activeMode;
    const isStale = false;

    const packet: TelemetryPacket = {
      spacecraftId: useMissionStore.getState().config?.id || 'primary-spacecraft',
      missionId: useMissionStore.getState().config?.id || 'primary-mission',
      timestamp: telemetry.timestamp || Date.now(),
      mode,
      quality: isStale ? 'stale' : 'good',
      telemetry,
    };

    // Update Zustand store
    useMissionStore.getState().updateTelemetry(telemetry);

    // Notify all listeners
    this.listeners.forEach((fn) => fn(packet));

    if (this.connectionState === 'STALE' || this.connectionState === 'DISCONNECTED') {
      this.updateConnectionState();
    }
  }

  private subscribeSupabase(missionId: string) {
    if (!supabase) return;
    try {
      if (this.supabaseSubscription) {
        supabase.removeChannel(this.supabaseSubscription);
      }

      this.supabaseSubscription = supabase
        .channel(`mission-telemetry-${missionId}`)
        .on(
          'postgres_changes',
          { event: 'INSERT', schema: 'public', table: 'telemetry_readings' },
          (payload) => {
            if (payload.new) {
              const reading = payload.new;
              this.lastPacketTimestamp = Date.now();
              // If live feed received, update mode
              if (reading.source === 'live' && this.activeMode !== 'live') {
                this.setMode('live');
              }
            }
          }
        )
        .subscribe((status) => {
          console.info(`📡 [VYOM Telemetry] Supabase subscription status: ${status}`);
        });
    } catch (err) {
      console.warn('⚠️ [VYOM Telemetry] Failed to subscribe to Supabase channel:', err);
    }
  }

  private startWatchdog() {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    this.watchdogInterval = setInterval(() => {
      const elapsed = Date.now() - this.lastPacketTimestamp;
      const isPaused = useMissionStore.getState().isPaused;

      if (!isPaused && elapsed > this.staleTimeoutMs) {
        if (this.connectionState !== 'STALE' && this.connectionState !== 'DISCONNECTED') {
          this.setConnectionState('STALE');
        }
      } else if (this.connectionState === 'STALE' && elapsed <= this.staleTimeoutMs) {
        this.updateConnectionState();
      }
    }, 1000);
  }

  private setConnectionState(newState: TelemetryConnectionState) {
    if (this.connectionState !== newState) {
      this.connectionState = newState;
      this.stateListeners.forEach((fn) => fn(newState));
    }
  }

  private updateConnectionState() {
    const isWsConnected = backendWS.isConnected;
    if (this.activeMode === 'live') {
      this.setConnectionState('LIVE');
    } else if (this.activeMode === 'replay') {
      this.setConnectionState('REPLAY');
    } else if (this.activeMode === 'simulation') {
      this.setConnectionState('SIMULATED');
    } else if (!isWsConnected && !isSupabaseConfigured()) {
      this.setConnectionState('SIMULATED');
    } else {
      this.setConnectionState('LIVE');
    }
  }

  public cleanup() {
    if (this.watchdogInterval) clearInterval(this.watchdogInterval);
    if (this.supabaseSubscription && supabase) {
      supabase.removeChannel(this.supabaseSubscription);
    }
    this.listeners.clear();
    this.stateListeners.clear();
  }
}

export const telemetryProvider = new TelemetryProviderService();
