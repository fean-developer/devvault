import { describe, expect, it } from 'vitest';
import { DefaultDeveloperLifecycleService } from './developer-lifecycle.js';
import type { BackendCapabilities, BackendDetection, BackendValidation, VaultBackend } from './vault-backend.js';
import type { SetupStateStore } from './setup-state-store.js';
import type { ConsentService } from './setup-ports.js';

function lifecycleInfrastructure() {
  const stateStore: SetupStateStore = {
    acquireLock: async () => ({ release: async () => undefined }),
    load: async () => ({ status: 'missing' }),
    save: async () => ({ status: 'saved', previousStateRetained: false }),
  };
  const consent: ConsentService = {
    request: async () => 'approved',
  };
  return {
    stateStore,
    consent,
  };
}

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
    const service = new DefaultDeveloperLifecycleService({ ...lifecycleInfrastructure(), backendSelector: createSelector(backend), localBackend: backend });

    await expect(service.start({ mode: 'interactive' })).resolves.toMatchObject({ status: 'READY', backend: 'local-docker' });
  });

  it('keeps global lifecycle independent when project-aware context is unavailable', async () => {
    const calls: string[] = [];
    const backend = createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true });
    const service = new DefaultDeveloperLifecycleService({
      ...lifecycleInfrastructure(),
      backendSelector: createSelector(backend),
      localBackend: backend,
      projectContext: { load: async () => null },
      localLifecycle: {
        start: async () => undefined,
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        unseal: async () => undefined,
        configure: async () => { calls.push('configure'); },
        ensureDeveloperSession: async () => { calls.push('session'); return { token: 'token', material: { rootToken: 'root', unsealKey: 'key' } }; },
      },
      bootstrapStore: { load: async () => ({ rootToken: 'root', unsealKey: 'key' }), save: async () => { calls.push('save'); } },
      sessionStore: { set: async () => { calls.push('session-store'); } },
    });

    await expect(service.start({ mode: 'interactive' })).resolves.toMatchObject({ status: 'READY', lifecycle: 'ready' });
    expect(calls).toEqual([]);
  });

  it('passes configured project context to project-aware lifecycle operations', async () => {
    const calls: string[] = [];
    const backend = createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true });
    const project = { name: 'my-api', environment: 'production' };
    const service = new DefaultDeveloperLifecycleService({
      ...lifecycleInfrastructure(),
      backendSelector: createSelector(backend),
      localBackend: backend,
      projectContext: { load: async () => project },
      localLifecycle: {
        start: async () => undefined,
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        unseal: async () => undefined,
        configure: async (value) => { calls.push(`configure:${value.name}/${value.environment}`); },
        ensureDeveloperSession: async (_material, value) => { calls.push(`session:${value.name}/${value.environment}`); return { token: 'token', material: { rootToken: 'root', unsealKey: 'key' } }; },
      },
      bootstrapStore: { load: async () => ({ rootToken: 'root', unsealKey: 'key' }), save: async () => { calls.push('save'); } },
      sessionStore: { set: async () => { calls.push('session-store'); } },
    });

    await expect(service.start({ mode: 'interactive' })).resolves.toMatchObject({ status: 'READY' });
    expect(calls).toEqual(['configure:my-api/production', 'session:my-api/production', 'save', 'session-store']);
  });

  it('ignores selected but unconfigured project context for project-aware lifecycle work', async () => {
    const calls: string[] = [];
    const backend = createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true });
    const service = new DefaultDeveloperLifecycleService({
      ...lifecycleInfrastructure(),
      backendSelector: createSelector(backend),
      localBackend: backend,
      projectContext: { load: async () => ({ name: 'my-api', environment: 'staging', state: 'SELECTED' as const }) },
      localLifecycle: {
        start: async () => undefined,
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        unseal: async () => undefined,
        configure: async (value) => { calls.push(`configure:${value.name}/${value.environment}`); },
        ensureDeveloperSession: async (_material, value) => { calls.push(`session:${value.name}/${value.environment}`); return { token: 'token', material: { rootToken: 'root', unsealKey: 'key' } }; },
      },
      bootstrapStore: { load: async () => ({ rootToken: 'root', unsealKey: 'key' }), save: async () => { calls.push('save'); } },
      sessionStore: { set: async () => { calls.push('session-store'); } },
    });

    await expect(service.start({ mode: 'interactive' })).resolves.toMatchObject({ status: 'READY' });
    expect(calls).toEqual([]);
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
      ...lifecycleInfrastructure(),
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
    const service = new DefaultDeveloperLifecycleService({ ...lifecycleInfrastructure(), backendSelector: createSelector(backend), localBackend: backend });

    await expect(service.start({ mode: 'interactive' })).resolves.toMatchObject({
      status: 'BLOCKED',
      lifecycle: 'not-initialized',
    });
  });

  it('initializes, stores bootstrap material, unseals and configures an owned local Vault', async () => {
    const calls: string[] = [];
    let validationCalls = 0;
    const backend = createBackend('local-docker', { lifecycle: 'not-initialized', kvValid: false, policyValid: true });
    const infrastructure = lifecycleInfrastructure();
    const localBackend = {
      ...backend,
      validate: async () => {
        calls.push('validate');
        validationCalls += 1;
        return validationCalls === 1
          ? { lifecycle: 'not-initialized' as const, kvValid: false, policyValid: false }
          : validationCalls === 2
            ? { lifecycle: 'unsealed' as const, kvValid: false, policyValid: true }
            : { lifecycle: 'configured' as const, kvValid: true, policyValid: true };
      },
    };
    const service = new DefaultDeveloperLifecycleService({
      ...infrastructure,
      backendSelector: createSelector(localBackend),
      localBackend,
      localLifecycle: {
        start: async () => undefined,
        initialize: async () => { calls.push('initialize'); return { rootToken: 'internal-root', unsealKey: 'internal-unseal' }; },
        unseal: async () => { calls.push('unseal'); },
        configure: async () => { calls.push('configure'); },
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
      },
      bootstrapStore: {
        load: async () => null,
        save: async () => { calls.push('save'); },
      },
      projectContext: { load: async () => ({ name: 'build-local-runner', environment: 'development' }) },
    });

    const result = await service.start({ mode: 'non-interactive' });

    expect(result.status).toBe('READY');
    expect(calls).toEqual(['validate', 'initialize', 'save', 'unseal', 'validate', 'configure']);
  });

  it('requires consent before starting a stopped local backend', async () => {
    let consentCalls = 0;
    let startCalls = 0;
    const backend = createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true }, false);
    const infrastructure = lifecycleInfrastructure();
    infrastructure.consent = { request: async () => { consentCalls += 1; return 'denied' as const; } };
    const service = new DefaultDeveloperLifecycleService({
      ...infrastructure,
      backendSelector: createSelector(backend),
      localBackend: backend,
      localLifecycle: {
        start: async () => { startCalls += 1; },
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        unseal: async () => undefined,
      },
    });

    const result = await service.start({ mode: 'interactive' });

    expect(result.status).toBe('BLOCKED');
    expect(consentCalls).toBe(1);
    expect(startCalls).toBe(0);
  });

  it('persists only allowlisted lifecycle metadata after READY', async () => {
    let savedState: unknown;
    const infrastructure = lifecycleInfrastructure();
    infrastructure.stateStore = {
      ...infrastructure.stateStore,
      save: async (state) => { savedState = state; return { status: 'saved', previousStateRetained: false }; },
    };
    const backend = createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true });
    const service = new DefaultDeveloperLifecycleService({ ...infrastructure, backendSelector: createSelector(backend), localBackend: backend });

    await expect(service.start({ mode: 'interactive' })).resolves.toMatchObject({ status: 'READY' });
    expect(savedState).toMatchObject({ status: 'READY', backend: 'local-docker', completedSteps: ['lifecycle-start'] });
    expect(savedState).not.toHaveProperty('token');
    expect(savedState).not.toHaveProperty('unsealKey');
  });

  it('keeps status read-only', async () => {
    let startCalls = 0;
    let unsealCalls = 0;
    const backend = createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true }, false);
    const service = new DefaultDeveloperLifecycleService({
      ...lifecycleInfrastructure(),
      backendSelector: createSelector(backend),
      localBackend: backend,
      localLifecycle: {
        start: async () => { startCalls += 1; },
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        unseal: async () => { unsealCalls += 1; },
      },
    });

    const result = await service.status({});

    expect(result.status).toBe('BLOCKED');
    expect(startCalls).toBe(0);
    expect(unsealCalls).toBe(0);
  });

  it('maps a local start failure to BLOCKED without persisting state', async () => {
    let saveCalls = 0;
    const backend = createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true }, false);
    const infrastructure = lifecycleInfrastructure();
    infrastructure.stateStore = {
      ...infrastructure.stateStore,
      save: async () => { saveCalls += 1; return { status: 'saved', previousStateRetained: false }; },
    };
    const service = new DefaultDeveloperLifecycleService({
      ...infrastructure,
      backendSelector: createSelector(backend),
      localBackend: backend,
      localLifecycle: {
        start: async () => { throw new Error('docker unavailable'); },
        health: async () => ({ reachable: false, initialized: false, sealed: true }),
        unseal: async () => undefined,
      },
    });

    await expect(service.start({ mode: 'interactive' })).resolves.toMatchObject({ status: 'BLOCKED', lifecycle: 'unavailable' });
    expect(saveCalls).toBe(0);
  });

  it('returns FAILED when lifecycle state is corrupt before any mutation', async () => {
    let startCalls = 0;
    const backend = createBackend('local-docker', { lifecycle: 'configured', kvValid: true, policyValid: true });
    const service = new DefaultDeveloperLifecycleService({
      ...lifecycleInfrastructure(),
      stateStore: {
        acquireLock: async () => ({ release: async () => undefined }),
        load: async () => ({ status: 'corrupt', errorCode: 'SETUP_STATE_CORRUPT' }),
        save: async () => ({ status: 'saved', previousStateRetained: false }),
      },
      backendSelector: createSelector(backend),
      localBackend: backend,
      localLifecycle: {
        start: async () => { startCalls += 1; },
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        unseal: async () => undefined,
      },
    });

    await expect(service.start({ mode: 'interactive' })).resolves.toMatchObject({ status: 'FAILED' });
    expect(startCalls).toBe(0);
  });

  it('unseals a local Vault from the internal bootstrap store without developer input', async () => {
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
      ...lifecycleInfrastructure(),
      backendSelector: createSelector(backend),
      localBackend: backend,
      localLifecycle: {
        start: async () => undefined,
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        unseal: async (material) => { unsealedKey = material.unsealKey; },
      },
      bootstrapStore: {
        load: async () => ({ rootToken: 'internal-root', unsealKey: 'internal-unseal' }),
        save: async () => undefined,
      },
    });

    const result = await service.start({ mode: 'interactive' });
    expect(result.status).toBe('READY');
    expect(unsealedKey).toBe('internal-unseal');
    expect(result).not.toHaveProperty('internal-root');
    expect(result).not.toHaveProperty('internal-unseal');
  });

  it('blocks sealed non-interactive execution without calling unseal', async () => {
    let unsealCalled = false;
    const backend = createBackend('local-docker', { lifecycle: 'sealed', kvValid: false, policyValid: false });
    const service = new DefaultDeveloperLifecycleService({
      ...lifecycleInfrastructure(),
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
      ...lifecycleInfrastructure(),
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