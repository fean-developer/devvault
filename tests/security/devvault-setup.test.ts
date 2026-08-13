import { access, mkdtemp, readdir, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { runSetupCommand, sanitizeSetupResult, type SetupCommandDependencies } from '../../apps/cli/src/commands/setup.js';
import { validateSetupState } from '../../packages/core/src/setup-state.js';
import { FileSetupStateStore } from '../../packages/platform/src/setup-state-store.js';
import { RemoteVaultBackend } from '../../packages/platform/src/remote-vault-backend.js';

const validState = {
  schemaVersion: 1 as const,
  status: 'READY' as const,
  profile: 'local-bootstrap' as const,
  platform: { host: 'linux', isWsl: true, shell: 'zsh' },
  backend: 'local-docker' as const,
  vaultAddress: 'http://127.0.0.1:8200',
  kvMount: 'secret',
  completedSteps: ['dependencies'],
  pendingSteps: [],
  updatedAt: '2026-08-13T00:00:00.000Z',
};

function commandDependencies(statePath: string): SetupCommandDependencies {
  return {
    stateStore: new FileSetupStateStore({ statePath }),
    dependencyChecker: {
      check: async () => ({
        capabilities: { platform: true },
        blockers: [],
        warnings: [],
        metadata: { platform: 'linux' },
      }),
    },
    consent: { request: async () => 'denied' },
  };
}

describe('Phase 0 setup security acceptance', () => {
  it('rejects every forbidden credential category from setup state', () => {
    const forbiddenFields = [
      'password',
      'token',
      'secretId',
      'authorization',
      'unsealKey',
      'recoveryKey',
      'rootCredential',
      'secretValue',
    ];

    for (const field of forbiddenFields) {
      expect(() => validateSetupState({ ...validState, [field]: 'credential-value' })).toThrow();
    }
  });

  it('keeps credentials out of state, JSON, errors and temporary files', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devvault-security-'));
    const statePath = join(directory, 'config', 'setup-state.json');
    const credentials = ['password=s3cr3t', 'token=abc123', 'SecretID=private-id', 'authorization=Bearer abc'];
    const store = new FileSetupStateStore({ statePath });

    await expect(store.save(validState)).resolves.toMatchObject({ status: 'saved' });
    const stored = await readFile(statePath, 'utf8');
    expect(credentials.every((credential) => !stored.includes(credential))).toBe(true);

    const sanitized = sanitizeSetupResult({
      status: 'FAILED',
      completedSteps: [],
      pendingSteps: [],
      blockers: credentials,
      warnings: credentials,
      metadata: { password: 'secret-value', token: 'token-value', safe: 'ok' },
    });
    const serialized = JSON.stringify(sanitized);
    expect(credentials.every((credential) => !serialized.includes(credential))).toBe(true);
    expect(serialized).not.toContain('secret-value');
    expect(serialized).not.toContain('token-value');

    expect(() => validateSetupState({ ...validState, lastErrorCode: 'token=abc123' })).toThrow();
    expect(await readdir(join(directory, 'config'))).toEqual(['setup-state.json']);
  });

  it('rejects credential-bearing remote URLs without exposing the credential', () => {
    const address = 'https://developer:password@vault.example.test?token=abc123';
    let error: unknown;
    try {
      new RemoteVaultBackend({
        address,
        client: { health: async () => ({ initialized: true, sealed: false }) },
      });
    } catch (caught) {
      error = caught;
    }

    expect(error).toBeInstanceOf(Error);
    expect((error as Error).message).not.toContain('password');
    expect((error as Error).message).not.toContain('abc123');
  });

  it('runs setup without creating project secret files', async () => {
    const projectDirectory = await mkdtemp(join(tmpdir(), 'devvault-project-'));
    const statePath = join(projectDirectory, 'user-config', 'setup-state.json');
    const result = await runSetupCommand(commandDependencies(statePath), { check: true, json: true });

    expect(['BLOCKED', 'FAILED']).toContain(result.status);
    for (const filename of ['.env', '.env.local', '.env.development', 'secrets.json', 'secrets.yaml']) {
      await expect(access(join(projectDirectory, filename))).rejects.toThrow();
    }
    expect(await readdir(projectDirectory)).toEqual([]);
  });
});
