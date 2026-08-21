import { describe, it, expect } from 'vitest';
import { SafetyValidator } from '../engines/SafetyValidator';

describe('SafetyValidator', () => {
  it('allows known safe actions', () => {
    expect(SafetyValidator.validate('Strategy Alpha-4')).toBe(true);
    expect(SafetyValidator.validate('Safe mode')).toBe(true);
    expect(SafetyValidator.validate('Thermal shunt')).toBe(true);
    expect(SafetyValidator.validate('Power reroute')).toBe(true);
  });

  it('matches safe action by substring', () => {
    expect(SafetyValidator.validate('Strategy Alpha-4: Safe Mode + Reroute')).toBe(true);
  });

  it('blocks unknown actions', () => {
    expect(SafetyValidator.validate('Engage orbital bombardment')).toBe(false);
  });

  it('blocks empty strings', () => {
    expect(SafetyValidator.validate('')).toBe(false);
  });
});