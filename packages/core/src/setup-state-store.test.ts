import { describe, expect, it } from 'vitest';
import type { SetupStateStore } from './setup-state-store.js';

describe('SetupStateStore contract', () => {
  it('represents valid, missing and corrupt state without filesystem assumptions', async () => {
    const store: SetupStateStore = {
      acquireLock: async () => ({ release: async () => undefined }),
      load: async () => ({ status: 'missing' }),
      save: async () => ({ status: 'saved', previousStateRetained: true }),
    };
    const lock = await store.acquireLock();
    const loaded = await store.load();
    const saved = await store.save({
      schemaVersion: 1,
      status: 'READY',
      profile: 'local-bootstrap',
      platform: { host: 'linux', isWsl: true, shell: 'bash' },
      backend: 'local-docker',
      vaultAddress: 'http://127.0.0.1:8200',
      kvMount: 'secret',
      completedSteps: ['platform'],
      pendingSteps: [],
      updatedAt: '2026-08-12T00:00:00.000Z',
    });

    expect(loaded).toEqual({ status: 'missing' });
    expect(saved).toEqual({ status: 'saved', previousStateRetained: true });
    await expect(lock.release()).resolves.toBeUndefined();
  });

  it('defines non-destructive repair semantics and explicit failure results', () => {
    const failure: Awaited<ReturnType<SetupStateStore['save']>> = {
      status: 'failed',
      errorCode: 'SETUP_STATE_RENAME_FAILED',
    };
    expect(failure.status).toBe('failed');
    expect(failure.errorCode).toBe('SETUP_STATE_RENAME_FAILED');
  });
});