import { describe, expect, it } from 'vitest';
import {
  canTransitionSetupResult,
  evaluateSetupResult,
  readinessProfiles,
  setupExitCodes,
} from './setup-model.js';

describe('setup result model', () => {
  it('defines stable exit codes for every result', () => {
    expect(setupExitCodes).toEqual({ READY: 0, DEGRADED: 3, BLOCKED: 4, FAILED: 5 });
  });

  it('does not hide mandatory capability failures as degraded', () => {
    expect(evaluateSetupResult('local-bootstrap', {
      platform: true,
      backend: true,
      'vault-lifecycle': true,
      kv: false,
      'setup-state': true,
      presentation: false,
    })).toBe('BLOCKED');
  });

  it('returns degraded only for optional capability failures', () => {
    expect(evaluateSetupResult('local-bootstrap', {
      platform: true,
      backend: true,
      'vault-lifecycle': true,
      kv: true,
      'setup-state': true,
      presentation: false,
    })).toBe('DEGRADED');
  });

  it('keeps profiles explicit and distinct', () => {
    expect(readinessProfiles['developer-runtime'].mandatory).toContain('credential-store');
    expect(readinessProfiles['remote-check'].mandatory).toContain('remote-endpoint');
  });

  it('allows retry and repair transitions without restricting recovery', () => {
    expect(canTransitionSetupResult('FAILED', 'READY')).toBe(true);
    expect(canTransitionSetupResult('BLOCKED', 'READY')).toBe(true);
    expect(canTransitionSetupResult('DEGRADED', 'READY')).toBe(true);
  });
});