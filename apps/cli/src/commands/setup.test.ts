import { describe, expect, it } from 'vitest';
import { runSetupCommand, sanitizeSetupResult, type SetupCommandDependencies } from './setup.js';

function dependencies(): SetupCommandDependencies {
  return {
    stateStore: {
      acquireLock: async () => ({ release: async () => undefined }),
      load: async () => ({ status: 'missing' }),
      save: async () => ({ status: 'saved', previousStateRetained: false }),
    },
    dependencyChecker: {
      check: async () => ({ capabilities: {}, blockers: [], warnings: [], metadata: {} }),
    },
    consent: { request: async () => 'denied' },
  };
}

describe('setup command', () => {
  it('uses read-only orchestration for --check', async () => {
    let mutatingRuns = 0;
    const result = await runSetupCommand({
      ...dependencies(),
      steps: [{
        id: 'mutating-step',
        mutating: true,
        requiresConsent: true,
        run: async () => { mutatingRuns += 1; return { status: 'completed', metadata: {} }; },
      }],
    }, { check: true });

    expect(result.status).toBe('DEGRADED');
    expect(result.pendingSteps).toEqual(['mutating-step']);
    expect(mutatingRuns).toBe(0);
  });

  it('maps denied consent to BLOCKED and --yes to approved mutation', async () => {
    const step = {
      id: 'mutating-step',
      mutating: true,
      requiresConsent: true,
      run: async () => ({ status: 'completed' as const, metadata: {} }),
    };
    const blocked = await runSetupCommand({ ...dependencies(), steps: [step] }, {});
    const approved = await runSetupCommand({ ...dependencies(), steps: [step] }, { yes: true });

    expect(blocked.status).toBe('BLOCKED');
    expect(approved.status).toBe('READY');
  });

  it('returns a sanitizable result shape for JSON consumers without sensitive metadata', async () => {
    const result = await runSetupCommand({
      ...dependencies(),
      steps: [{
        id: 'safe-step',
        mutating: false,
        requiresConsent: false,
        run: async () => ({ status: 'completed' as const, metadata: { token: 'must-not-output' } }),
      }],
    }, { json: true });

    expect(result.status).toBe('READY');
    expect(sanitizeSetupResult(result).metadata).toEqual({ nonInteractive: false, yes: false });
    expect(JSON.stringify(sanitizeSetupResult(result))).not.toContain('must-not-output');
  });
});