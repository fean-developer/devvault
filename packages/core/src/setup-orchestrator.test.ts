import { describe, expect, it } from 'vitest';
import { StepSetupOrchestrator } from './setup-orchestrator.js';
import type { SetupStateStore } from './setup-state-store.js';

function store() {
  const saves: unknown[] = [];
  const locks: string[] = [];
  const value: SetupStateStore = {
    acquireLock: async () => ({ release: async () => { locks.push('release'); } }),
    load: async () => ({ status: 'missing' }),
    save: async (state) => { saves.push(state); return { status: 'saved', previousStateRetained: true }; },
  };
  return { value, saves, locks };
}

describe('StepSetupOrchestrator', () => {
  it('executes steps in order, requests consent and persists completed steps', async () => {
    const state = store();
    const calls: string[] = [];
    const orchestrator = new StepSetupOrchestrator(state.value, { request: async () => 'approved' });
    const result = await orchestrator.setup({ mode: 'setup', profile: 'local-bootstrap', metadata: { platform: 'linux' } }, [
      { id: 'detect', mutating: false, requiresConsent: false, run: async () => { calls.push('detect'); return { status: 'completed', metadata: {} }; } },
      { id: 'start', mutating: true, requiresConsent: true, run: async () => { calls.push('start'); return { status: 'completed', metadata: { backend: 'local-docker' } }; } },
    ]);

    expect(result.status).toBe('READY');
    expect(calls).toEqual(['detect', 'start']);
    expect(state.saves).toHaveLength(2);
    expect(state.locks).toEqual(['release']);
  });

  it('keeps check mode read-only and reports mutating steps as pending', async () => {
    const state = store();
    const calls: string[] = [];
    const result = await new StepSetupOrchestrator(state.value, { request: async () => 'approved' }).check({
      profile: 'local-bootstrap', metadata: {},
    }, [{ id: 'mutate', mutating: true, requiresConsent: true, run: async () => { calls.push('run'); return { status: 'completed', metadata: {} }; } }]);

    expect(result.status).toBe('DEGRADED');
    expect(result.pendingSteps).toEqual(['mutate']);
    expect(calls).toEqual([]);
    expect(state.saves).toEqual([]);
    expect(state.locks).toEqual([]);
  });

  it('blocks when consent is denied and repairs by skipping completed state', async () => {
    const state = store();
    const result = await new StepSetupOrchestrator(state.value, { request: async () => 'denied' }).setup({
      mode: 'setup', profile: 'local-bootstrap', metadata: {},
    }, [{ id: 'mutate', mutating: true, requiresConsent: true, run: async () => ({ status: 'completed', metadata: {} }) }]);

    expect(result.status).toBe('BLOCKED');
    expect(result.pendingSteps).toEqual(['mutate']);
  });

  it('acquires the writer lock before loading state and maps lock errors to FAILED', async () => {
    const order: string[] = [];
    const state: SetupStateStore = {
      acquireLock: async () => { order.push('lock'); return { release: async () => undefined }; },
      load: async () => { order.push('load'); return { status: 'missing' }; },
      save: async () => ({ status: 'saved', previousStateRetained: true }),
    };
    const result = await new StepSetupOrchestrator(state, { request: async () => 'approved' }).setup({
      mode: 'setup', profile: 'local-bootstrap', metadata: {},
    }, []);
    expect(order).toEqual(['lock', 'load']);
    expect(result.status).toBe('READY');

    const locked = await new StepSetupOrchestrator({
      ...state,
      acquireLock: async () => { throw new Error('locked'); },
    }, { request: async () => 'approved' }).setup({ mode: 'setup', profile: 'local-bootstrap', metadata: {} }, []);
    expect(locked.status).toBe('FAILED');
  });

  it('maps a failed setup step to FAILED instead of continuing as ready', async () => {
    const state = store();
    const result = await new StepSetupOrchestrator(state.value, { request: async () => 'approved' }).setup({
      mode: 'setup', profile: 'local-bootstrap', metadata: {},
    }, [{
      id: 'failed-step',
      mutating: false,
      requiresConsent: false,
      run: async () => ({ status: 'failed', metadata: {}, errorCode: 'STEP_FAILED' }),
    }]);

    expect(result.status).toBe('FAILED');
    expect(result.blockers).toContain('STEP_FAILED');
  });
});