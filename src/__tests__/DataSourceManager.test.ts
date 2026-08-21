import { describe, it, expect } from 'vitest';
import { DataSourceManager } from '../engines/DataSourceManager';

describe('DataSourceManager', () => {
  it('returns historical telemetry array', async () => {
    const result = await DataSourceManager.getHistoricalTelemetry(0, 1000);
    expect(Array.isArray(result)).toBe(true);
    expect(result).toEqual([]);
  });
});