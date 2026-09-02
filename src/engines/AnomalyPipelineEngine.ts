/**
 * VYOM — Multi-Tier Anomaly & Incident Detection Engine (Phase 9 & 10)
 * Evaluates telemetry streams for statistical outliers (Z-score), rate-of-change spikes,
 * physical boundary thresholds, and cross-subsystem cascading failure chains.
 */

import { Telemetry, Incident, HealthStatus } from '../types/mission';
import { useMissionStore } from '../store/missionStore';
import { eventBus } from './MissionEventBus';

export interface AnomalyDetectionRule {
  id: string;
  subsystem: string;
  channel: string;
  warningThreshold?: { min?: number; max?: number };
  criticalThreshold?: { min?: number; max?: number };
  maxRateOfChangePerSec?: number;
  cascadesTo?: Array<{ subsystem: string; effect: string }>;
  description: string;
}

export const AEROSPACE_ANOMALY_RULES: AnomalyDetectionRule[] = [
  // Power / EPS
  {
    id: 'RULE-PWR-01',
    subsystem: 'Power (EPS)',
    channel: 'batteryPercent',
    warningThreshold: { min: 40.0 },
    criticalThreshold: { min: 20.0 },
    maxRateOfChangePerSec: 1.5,
    cascadesTo: [
      { subsystem: 'Thermal (TCS)', effect: 'Heater shutdown causing thermal contraction' },
      { subsystem: 'Communication', effect: 'RF TWTA amplifier forced into half-power safe mode' },
    ],
    description: 'Battery state of charge critical exhaustion below flight rule envelope',
  },
  {
    id: 'RULE-PWR-02',
    subsystem: 'Power (EPS)',
    channel: 'voltageV',
    warningThreshold: { min: 24.0 },
    criticalThreshold: { min: 22.0 },
    description: 'Main bus undervoltage risking avionics brownout',
  },

  // Thermal / TCS
  {
    id: 'RULE-THM-01',
    subsystem: 'Thermal (TCS)',
    channel: 'cpuTempC',
    warningThreshold: { max: 70.0 },
    criticalThreshold: { max: 85.0 },
    maxRateOfChangePerSec: 2.0,
    cascadesTo: [
      { subsystem: 'Avionics', effect: 'Flight computer clock throttling and task starvation' },
    ],
    description: 'Flight computer junction temperature thermal excursion',
  },
  {
    id: 'RULE-THM-02',
    subsystem: 'Thermal (TCS)',
    channel: 'batteryTempC',
    warningThreshold: { min: 5.0, max: 35.0 },
    criticalThreshold: { min: -10.0, max: 45.0 },
    description: 'Battery core temperature outside lithium electrochemical safety limits',
  },

  // ADCS / GNC
  {
    id: 'RULE-ADCS-01',
    subsystem: 'ADCS / GNC',
    channel: 'reactionWheelRpm',
    warningThreshold: { max: 5500 },
    criticalThreshold: { max: 6200 },
    cascadesTo: [
      { subsystem: 'Communication', effect: 'High body pointing jitter degrading RF SNR' },
    ],
    description: 'Reaction wheel momentum saturation approaching structural bearing limit',
  },

  // Life Support / ECLSS (Human Missions)
  {
    id: 'RULE-ECLSS-01',
    subsystem: 'Life Support (ECLSS)',
    channel: 'suitPressureKpa',
    warningThreshold: { min: 90.0 },
    criticalThreshold: { min: 70.0 },
    cascadesTo: [
      { subsystem: 'Crew Biometrics', effect: 'Hypobaric hypoxia and physiological distress' },
    ],
    description: 'Cabin environmental decompression below life support flight rules',
  },
];

class AnomalyPipelineService {
  private historyBuffer: Map<string, Array<{ val: number; time: number }>> = new Map();
  private maxHistorySamples: number = 60;
  private activeIncidents: Map<string, Incident> = new Map();
  private incidentCounter: number = 100;

  /**
   * Evaluates current telemetry packet against aerospace anomaly rules
   */
  public evaluate(telemetry: Telemetry): Incident[] {
    const newIncidents: Incident[] = [];
    const timestamp = telemetry.timestamp || Date.now();

    for (const rule of AEROSPACE_ANOMALY_RULES) {
      const val = this.extractChannelValue(telemetry, rule.channel);
      if (val === undefined || val === null) continue;

      // Track historical rolling window
      this.recordSample(rule.id, val, timestamp);

      // 1. Static Threshold Check
      let severity: 'nominal' | 'warning' | 'critical' = 'nominal';
      if (rule.criticalThreshold) {
        if (rule.criticalThreshold.min !== undefined && val < rule.criticalThreshold.min) severity = 'critical';
        if (rule.criticalThreshold.max !== undefined && val > rule.criticalThreshold.max) severity = 'critical';
      }
      if (severity === 'nominal' && rule.warningThreshold) {
        if (rule.warningThreshold.min !== undefined && val < rule.warningThreshold.min) severity = 'warning';
        if (rule.warningThreshold.max !== undefined && val > rule.warningThreshold.max) severity = 'warning';
      }

      // 2. Rate of Change Check
      if (rule.maxRateOfChangePerSec && severity === 'nominal') {
        const rate = this.calculateRateOfChange(rule.id);
        if (Math.abs(rate) > rule.maxRateOfChangePerSec) {
          severity = 'warning';
        }
      }

      // 3. Statistical Z-Score Outlier Check
      if (severity === 'nominal') {
        const zScore = this.calculateZScore(rule.id, val);
        if (Math.abs(zScore) > 3.2) {
          severity = 'warning';
        }
      }

      // 4. Incident Generation & Cascade Triggering
      if (severity !== 'nominal') {
        if (!this.activeIncidents.has(rule.id)) {
          const incId = `INC-${new Date().toISOString().slice(0, 10).replace(/-/g, '')}-${++this.incidentCounter}`;
          const cascadeText = rule.cascadesTo
            ? ` Cascades to: ${rule.cascadesTo.map((c) => `${c.subsystem} (${c.effect})`).join('; ')}`
            : '';

          const incident: Incident = {
            id: incId,
            mission_day: telemetry.missionDay || 1,
            normalized_fault_category: rule.subsystem,
            normalized_subsystem: rule.subsystem,
            severity,
            status: 'detected',
            description: `${rule.description} [${rule.channel} = ${val.toFixed(1)}].${cascadeText}`,
            detection_time: timestamp,
            recovery_mode: 'ai',
            procedures: [
              {
                id: `PROC-${rule.id}`,
                fault_type: rule.id,
                name: `Autonomous Mitigation: ${rule.subsystem}`,
                description: `Reconfigure subsystem relays and engage safe mode profile for ${rule.subsystem}`,
                steps: [
                  'Isolate non-essential loads',
                  'Cross-strap redundant secondary bus',
                  'Verify 3-sigma stabilization',
                ],
                estimated_time_s: 30,
                success_probability: 0.94,
                risk_level: severity === 'critical' ? 'high' : 'medium',
              },
            ],
            confidence: 0.96,
          };

          this.activeIncidents.set(rule.id, incident);
          newIncidents.push(incident);

          // Update store and notify
          useMissionStore.getState().addIncident(incident);
          eventBus.publish('ALERT_RAISED', {
            id: incId,
            subsystem: rule.subsystem,
            message: incident.description,
            severity,
          });
        }
      } else {
        // Auto-resolve if nominal again
        if (this.activeIncidents.has(rule.id)) {
          const resolved = this.activeIncidents.get(rule.id)!;
          resolved.status = 'resolved';
          resolved.recovery_end = timestamp;
          this.activeIncidents.delete(rule.id);
        }
      }
    }

    return newIncidents;
  }

  private extractChannelValue(t: Telemetry, channel: string): number | undefined {
    if (!t) return undefined;
    if (t.power && channel in t.power) return (t.power as any)[channel];
    if (t.thermal && channel in t.thermal) return (t.thermal as any)[channel];
    if (t.attitude && channel in t.attitude) return (t.attitude as any)[channel];
    if ((t as any).adcs && channel in (t as any).adcs) return (t as any).adcs[channel];
    if (t.comm && channel in t.comm) return (t.comm as any)[channel];
    if ((t as any).comms && channel in (t as any).comms) return (t as any).comms[channel];
    if (t.compute && channel in t.compute) return (t.compute as any)[channel];
    if ((t as any).avionics && channel in (t as any).avionics) return (t as any).avionics[channel];
    if (t.orbit && channel in t.orbit) return (t.orbit as any)[channel];
    if (t.crew && t.crew.length > 0 && channel in t.crew[0]) return (t.crew[0] as any)[channel];
    if ((t as any)[channel] !== undefined && typeof (t as any)[channel] === 'number') return (t as any)[channel];
    return undefined;
  }

  private recordSample(ruleId: string, val: number, time: number) {
    if (!this.historyBuffer.has(ruleId)) {
      this.historyBuffer.set(ruleId, []);
    }
    const samples = this.historyBuffer.get(ruleId)!;
    samples.push({ val, time });
    if (samples.length > this.maxHistorySamples) {
      samples.shift();
    }
  }

  private calculateRateOfChange(ruleId: string): number {
    const samples = this.historyBuffer.get(ruleId);
    if (!samples || samples.length < 2) return 0;
    const first = samples[0];
    const last = samples[samples.length - 1];
    const dt = (last.time - first.time) / 1000;
    if (dt <= 0) return 0;
    return (last.val - first.val) / dt;
  }

  private calculateZScore(ruleId: string, currentVal: number): number {
    const samples = this.historyBuffer.get(ruleId);
    if (!samples || samples.length < 10) return 0;
    const values = samples.map((s) => s.val);
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const variance = values.reduce((a, b) => a + Math.pow(b - mean, 2), 0) / values.length;
    const stdDev = Math.sqrt(variance);
    if (stdDev <= 1e-4) return 0;
    return (currentVal - mean) / stdDev;
  }
}

export const anomalyPipeline = new AnomalyPipelineService();
