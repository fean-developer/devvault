import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { FileSetupStateStore, SetupStateLockError } from './setup-state-store.js';

const state = {
  schemaVersion: 1 as const,
  status: 'READY' as const,
  profile: 'local-bootstrap' as const,
  platform: { host: 'linux', isWsl: true, shell: 'bash' },
  backend: 'local-docker' as const,
  vaultAddress: 'http://127.0.0.1:8200',
  kvMount: 'secret',
  completedSteps: ['platform'],
  pendingSteps: [],
  updatedAt: '2026-08-13T00:00:00.000Z',
};

describe('FileSetupStateStore', () => {
  it('saves atomically and loads validated state outside a project path', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devvault-state-'));
    const store = new FileSetupStateStore({ statePath: join(directory, 'config', 'setup-state.json') });

    await expect(store.save(state)).resolves.toEqual({ status: 'saved', previousStateRetained: false });
    await expect(store.load()).resolves.toEqual({ status: 'valid', state });
    await expect(readFile(join(directory, 'config', 'setup-state.json'), 'utf8')).resolves.not.toContain('token');
  });

  it('reports missing and corrupt state without exposing file contents', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devvault-state-'));
    const statePath = join(directory, 'setup-state.json');
    const store = new FileSetupStateStore({ statePath });

    await expect(store.load()).resolves.toEqual({ status: 'missing' });
    await import('node:fs/promises').then(({ writeFile }) => writeFile(statePath, '{ invalid'));
    await expect(store.load()).resolves.toEqual({ status: 'corrupt', errorCode: 'SETUP_STATE_CORRUPT' });
  });

  it('prevents concurrent writers and releases the lock', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devvault-state-'));
    const store = new FileSetupStateStore({ statePath: join(directory, 'setup-state.json') });
    const lock = await store.acquireLock();

    await expect(store.acquireLock()).rejects.toBeInstanceOf(SetupStateLockError);
    await lock.release();
    await expect(store.acquireLock()).resolves.toBeDefined();
  });

  it('rejects forbidden state before writing', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devvault-state-'));
    const store = new FileSetupStateStore({ statePath: join(directory, 'setup-state.json') });

    await expect(store.save({ ...state, token: 'forbidden' } as never)).resolves.toEqual({
      status: 'failed',
      errorCode: 'SETUP_STATE_WRITE_FAILED',
    });
  });
});