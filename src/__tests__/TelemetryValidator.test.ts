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

  it('rejects NaN cpu temp', () => {
    const data = {
      power: { batteryPercent: 96.4 },
      thermal: { cpuTempC: NaN },
      comm: { signalDbm: -72 },
      attitude: { rollDeg: 0.12 },
    };
    expect(TelemetryValidator.validate(data)).toBe(false);
  });
});