import { describe, it, expect } from 'vitest';
import { SafetyValidator } from '../engines/SafetyValidator';

describe('SafetyValidator', () => {
  it('allows known safe actions', () => {
    expect(SafetyValidator.validate('Strategy Alpha-4').passed).toBe(true);
    expect(SafetyValidator.validate('Safe mode').passed).toBe(true);
    expect(SafetyValidator.validate('Thermal shunt').passed).toBe(true);
    expect(SafetyValidator.validate('Power reroute').passed).toBe(true);
  });

  it('matches safe action by substring', () => {
    expect(SafetyValidator.validate('Strategy Alpha-4: Safe Mode + Reroute').passed).toBe(true);
  });

  it('blocks unknown actions', () => {
    expect(SafetyValidator.validate('Engage orbital bombardment').passed).toBe(false);
  });

  it('blocks empty strings', () => {
    expect(SafetyValidator.validate('').passed).toBe(false);
  });
});