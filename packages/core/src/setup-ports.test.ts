import { describe, expect, it } from 'vitest';
import type { SetupStep } from './setup-steps.js';
import type { ConsentService, DependencyChecker, SetupOrchestrator } from './setup-ports.js';

describe('setup ports', () => {
  it('represents check mode as a non-mutating step pipeline', async () => {
    const calls: string[] = [];
    const step: SetupStep = {
      id: 'check-platform',
      mutating: false,
      requiresConsent: false,
      run: async (context) => {
        calls.push(context.mode);
        return { status: 'completed', metadata: {} };
      },
    };

    await step.run({ mode: 'check', profile: 'local-bootstrap', metadata: {} });

    expect(calls).toEqual(['check']);
    expect(step.mutating).toBe(false);
    expect(step.requiresConsent).toBe(false);
  });

  it('keeps dependency, consent and orchestration contracts structural', () => {
    const dependencyChecker: DependencyChecker = { check: async () => ({ capabilities: {}, blockers: [], warnings: [], metadata: {} }) };
    const consentService: ConsentService = { request: async () => 'approved' };
    const orchestrator: SetupOrchestrator = {
      setup: async () => ({ status: 'READY', completedSteps: [], pendingSteps: [], blockers: [], warnings: [], metadata: {} }),
      check: async () => ({ status: 'READY', completedSteps: [], pendingSteps: [], blockers: [], warnings: [], metadata: {} }),
      repair: async () => ({ status: 'READY', completedSteps: [], pendingSteps: [], blockers: [], warnings: [], metadata: {} }),
    };

    expect(dependencyChecker).toBeDefined();
    expect(consentService).toBeDefined();
    expect(orchestrator).toBeDefined();
  });
});