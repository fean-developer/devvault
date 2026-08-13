import { describe, expect, it } from 'vitest';
import { DefaultDeveloperLifecycleService } from './developer-lifecycle.js';
import type { BackendCapabilities, BackendDetection, BackendValidation, VaultBackend } from './vault-backend.js';

function createBackend(kind: 'local-docker' | 'remote-vault', validation: BackendValidation, available = true): VaultBackend {
  const capabilities: BackendCapabilities = {
    canStart: kind === 'local-docker',
    canConfigure: kind === 'local-docker',
    canValidateKv: true,
    canValidatePolicy: true,
  };
  const detection: BackendDetection = { kind, available, capabilities };
  return {
    kind: () => kind,
    detect: async () => detection,
    health: async () => ({ reachable: available, initialized: validation.lifecycle !== 'not-initialized', sealed: validation.lifecycle === 'sealed' }),
    validate: async () => validation,
  };
}

function createSelector(localBackend: VaultBackend, remoteBackend?: VaultBackend) {
  return {
    select: async (input: { preferred?: 'local-docker' | 'remote-vault' }) => {
      const backend = input.preferred === 'remote-vault' ? remoteBackend : localBackend;
      return backend
        ? { backend, blockers: [], metadata: { selectedBackend: backend.kind() } }
        : { blockers: ['No viable Vault backend is available.'], metadata: { selectedBackend: null } };
    },
  };
}

describe('DefaultDeveloperLifecycleService', () => {
  it('returns READY for an already configured local backend', async () => {
    const backend = createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true });
    const service = new DefaultDeveloperLifecycleService({ backendSelector: createSelector(backend), localBackend: backend });

    await expect(service.start({ mode: 'interactive' })).resolves.toMatchObject({ status: 'READY', backend: 'local-docker' });
  });

  it('starts an unavailable local backend before validating it', async () => {
    let started = false;
    const backend: VaultBackend = {
      ...createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true }, false),
      detect: async () => ({
        kind: 'local-docker',
        available: started,
        capabilities: { canStart: true, canConfigure: true, canValidateKv: true, canValidatePolicy: true },
      }),
    };
    const service = new DefaultDeveloperLifecycleService({
      backendSelector: createSelector(backend),
      localBackend: backend,
      localLifecycle: {
        start: async () => { started = true; },
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        unseal: async () => undefined,
      },
    });

    const result = await service.start({ mode: 'interactive' });
    expect(started).toBe(true);
    expect(result.status).toBe('READY');
  });

  it('blocks an uninitialized Vault without initializing or persisting credentials', async () => {
    const backend = createBackend('local-docker', { lifecycle: 'not-initialized', kvValid: false, policyValid: false });
    const service = new DefaultDeveloperLifecycleService({ backendSelector: createSelector(backend), localBackend: backend });

    await expect(service.start({ mode: 'interactive' })).resolves.toMatchObject({
      status: 'BLOCKED',
      lifecycle: 'not-initialized',
    });
  });

  it('unseals a local Vault only with interactive ephemeral input', async () => {
    let unsealedKey = '';
    let validationCalls = 0;
    const backend: VaultBackend = {
      ...createBackend('local-docker', { lifecycle: 'sealed', kvValid: false, policyValid: false }),
      validate: async () => {
        validationCalls += 1;
        return validationCalls === 1
          ? { lifecycle: 'sealed', kvValid: false, policyValid: false }
          : { lifecycle: 'configured', kvValid: true, policyValid: true };
      },
    };
    const service = new DefaultDeveloperLifecycleService({
      backendSelector: createSelector(backend),
      localBackend: backend,
      localLifecycle: {
        start: async () => undefined,
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        unseal: async (key) => { unsealedKey = key; },
      },
      secretInput: { read: async () => 'ephemeral-key' },
    });

    const result = await service.start({ mode: 'interactive' });
    expect(result.status).toBe('READY');
    expect(unsealedKey).toBe('ephemeral-key');
    expect(result).not.toHaveProperty('ephemeral-key');
  });

  it('blocks sealed non-interactive execution without calling unseal', async () => {
    let unsealCalled = false;
    const backend = createBackend('local-docker', { lifecycle: 'sealed', kvValid: false, policyValid: false });
    const service = new DefaultDeveloperLifecycleService({
      backendSelector: createSelector(backend),
      localBackend: backend,
      localLifecycle: {
        start: async () => undefined,
        health: async () => ({ reachable: true, initialized: true, sealed: true }),
        unseal: async () => { unsealCalled = true; },
      },
      secretInput: { read: async () => 'unused' },
    });

    const result = await service.start({ mode: 'non-interactive' });
    expect(result).toMatchObject({ status: 'BLOCKED', lifecycle: 'sealed' });
    expect(unsealCalled).toBe(false);
  });

  it('keeps remote Vault sealed handling read-only', async () => {
    const local = createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true }, false);
    const remote = createBackend('remote-vault', { lifecycle: 'sealed', kvValid: false, policyValid: false });
    const service = new DefaultDeveloperLifecycleService({
      backendSelector: createSelector(local, remote),
      localBackend: local,
      remoteBackend: remote,
      localLifecycle: {
        start: async () => undefined,
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        unseal: async () => { throw new Error('must not run'); },
      },
      secretInput: { read: async () => 'unused' },
    });

    await expect(service.start({ mode: 'non-interactive', preferredBackend: 'remote-vault' })).resolves.toMatchObject({
      status: 'BLOCKED',
      backend: 'remote-vault',
      lifecycle: 'sealed',
    });
  });
});