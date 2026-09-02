import { describe, it, expect } from 'vitest';
import { TelemetryValidator } from '../engines/TelemetryValidator';

describe('TelemetryValidator', () => {
  it('rejects null/undefined data', () => {
    expect(TelemetryValidator.validate(null)).toBe(false);
    expect(TelemetryValidator.validate(undefined)).toBe(false);
  });

  it('accepts complete telemetry', () => {
    const data = {
      power: { batteryPercent: 96.4 },
      thermal: { cpuTempC: 41.8 },
      comm: { signalDbm: -72 },
      attitude: { rollDeg: 0.12 },
    };
    expect(TelemetryValidator.validate(data)).toBe(true);
  });

  it('rejects data missing a subsystem', () => {
    const data = {
      power: { batteryPercent: 96.4 },
      thermal: { cpuTempC: 41.8 },
      comm: { signalDbm: -72 },
      // no attitude
    };
    expect(TelemetryValidator.validate(data)).toBe(false);
  });

  it('rejects NaN battery percent', () => {
    const data = {
      power: { batteryPercent: NaN },
      thermal: { cpuTempC: 41.8 },
      comm: { signalDbm: -72 },
      attitude: { rollDeg: 0.12 },
    };
    expect(TelemetryValidator.validate(data)).toBe(false);
  });

  it('clamps battery percent between 0 and 100', () => {
    const dataOver = {
      power: { batteryPercent: 125.0 },
      thermal: { cpuTempC: 41.8 },
      comm: { signalDbm: -72 },
      attitude: { rollDeg: 0.12 },
    };
    expect(TelemetryValidator.validate(dataOver)).toBe(true);
    expect(dataOver.power.batteryPercent).toBe(100);

    const dataUnder = {
      power: { batteryPercent: -15.0 },
      thermal: { cpuTempC: 41.8 },
      comm: { signalDbm: -72 },
      attitude: { rollDeg: 0.12 },
    };
    expect(TelemetryValidator.validate(dataUnder)).toBe(true);
    expect(dataUnder.power.batteryPercent).toBe(0);
  });
});