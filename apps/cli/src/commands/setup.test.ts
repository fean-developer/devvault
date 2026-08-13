import { describe, expect, it } from 'vitest';
import { ProfileSetupValidator, setupExitCodes, type BackendSelectionInput, type VaultBackend } from '@devvault/core';
import { Command } from 'commander';
import { registerSetupCommand, runSetupCommand, sanitizeSetupResult, type SetupCommandDependencies } from './setup.js';

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

function backend(
  lifecycle: 'configured' | 'unavailable' | 'not-initialized' | 'sealed' = 'configured',
  capabilities = { canStart: false, canConfigure: true, canValidateKv: true, canValidatePolicy: true },
  kind: 'local-docker' | 'remote-vault' = 'local-docker',
): VaultBackend {
  return {
    kind: () => kind,
    detect: async () => ({ kind, available: lifecycle !== 'unavailable', capabilities }),
    health: async () => ({ reachable: lifecycle !== 'unavailable', initialized: lifecycle !== 'not-initialized', sealed: lifecycle === 'sealed' }),
    validate: async () => ({ lifecycle, kvValid: lifecycle === 'configured' && capabilities.canValidateKv, policyValid: lifecycle === 'configured' && capabilities.canValidatePolicy }),
  };
}

function productionDependencies(overrides: Partial<SetupCommandDependencies> = {}): SetupCommandDependencies {
  const base = dependencies();
  const localBackend = backend();
  return {
    ...base,
    dependencyChecker: { check: async () => ({ capabilities: { platform: true }, blockers: [], warnings: [], metadata: { platform: 'linux' } }) },
    localBackend,
    backendSelector: { select: async ({ local, remote }: BackendSelectionInput) => {
      const localDetection = await local.detect();
      if (localDetection.available) return { backend: local, blockers: [], metadata: { selectedBackend: 'local-docker' } };
      if (remote) return { backend: remote, blockers: [], metadata: { selectedBackend: 'remote-vault' } };
      return { blockers: ['No viable Vault backend is available.'], metadata: { selectedBackend: null } };
    } },
    validator: new ProfileSetupValidator({
      collect: async (context) => ({
        capabilities: {
          platform: context.metadata.platform === 'linux',
          backend: typeof context.metadata.backend === 'string',
          'vault-lifecycle': context.metadata.vaultLifecycle === 'configured',
          kv: context.metadata.kv === true,
          'setup-state': true,
        },
        blockers: [],
        warnings: [],
        metadata: context.metadata,
      }),
    }),
    ...overrides,
  };
}

describe('setup command', () => {
  it('runs the production pipeline and returns READY only after backend and profile validation', async () => {
    const result = await runSetupCommand(productionDependencies(), { yes: true });

    expect(result.status).toBe('READY');
    expect(setupExitCodes[result.status]).toBe(0);
    expect(result.completedSteps).toEqual(['dependencies', 'start-local-vault', 'backend-selection', 'backend-readiness', 'profile-validation']);
  });

  it('registers the real Commander command and maps its public exit code', async () => {
    const program = new Command();
    registerSetupCommand(program, productionDependencies({ localBackend: backend('unavailable'), remoteBackend: undefined }));
    const previousExitCode = process.exitCode;
    process.exitCode = undefined;
    try {
      await program.parseAsync(['node', 'devvault', 'setup', '--check', '--json']);
      expect(process.exitCode).toBe(4);
    } finally {
      process.exitCode = previousExitCode;
    }
  });

  it.each([
    ['no backend', productionDependencies({ localBackend: backend('unavailable'), remoteBackend: undefined }), 'BLOCKED', 4],
    ['sealed Vault', productionDependencies({ localBackend: backend('sealed') }), 'BLOCKED', 4],
    ['uninitialized Vault', productionDependencies({ localBackend: backend('not-initialized') }), 'BLOCKED', 4],
    ['mandatory KV failure', productionDependencies({ localBackend: backend('configured', { canStart: false, canConfigure: true, canValidateKv: false, canValidatePolicy: true }) }), 'BLOCKED', 4],
  ])('never returns READY for %s', async (_name, setupDependencies, status, exitCode) => {
    const result = await runSetupCommand(setupDependencies, { yes: true });

    expect(result.status).toBe(status);
    expect(setupExitCodes[result.status]).toBe(exitCode);
  });

  it('selects an explicit remote backend when local Docker is unavailable', async () => {
    const remote = backend('configured', undefined, 'remote-vault');
    const result = await runSetupCommand(productionDependencies({
      dependencyChecker: { check: async () => ({ capabilities: { platform: true }, blockers: ['Docker daemon unavailable.'], warnings: [], metadata: { platform: 'linux' } }) },
      localBackend: backend('unavailable'),
      remoteBackend: remote,
    }), { yes: true });

    expect(result.status).toBe('READY');
    expect(result.metadata.backend).toBe('remote-vault');
  });

  it('requires consent before starting a local Vault container', async () => {
    let starts = 0;
    const setupDependencies = productionDependencies({
      startLocalVault: async () => { starts += 1; },
      dependencyChecker: { check: async () => ({ capabilities: { platform: true }, blockers: ['Vault container is stopped.'], warnings: [], metadata: { platform: 'linux', dockerState: 'available', vaultContainer: 'stopped' } }) },
    });
    const blocked = await runSetupCommand(setupDependencies, {});
    const approved = await runSetupCommand(setupDependencies, { yes: true });

    expect(blocked.status).toBe('BLOCKED');
    expect(setupExitCodes[blocked.status]).toBe(4);
    expect(starts).toBe(1);
    expect(approved.status).toBe('READY');
  });

  it('preserves validator BLOCKED and FAILED results on the production path', async () => {
    const blocked = await runSetupCommand(productionDependencies({
      validator: { validate: async () => ({ status: 'BLOCKED', capabilities: {}, blockers: ['profile blocker'], warnings: [], metadata: {} }) },
    }), { yes: true });
    const failed = await runSetupCommand(productionDependencies({
      validator: { validate: async () => ({ status: 'FAILED', capabilities: {}, blockers: [], warnings: [], metadata: {} }) },
    }), { yes: true });

    expect(blocked.status).toBe('BLOCKED');
    expect(setupExitCodes[blocked.status]).toBe(4);
    expect(failed.status).toBe('FAILED');
    expect(setupExitCodes[failed.status]).toBe(5);
  });

  it('kills blocker-to-completed mutations before final validation', async () => {
    const alwaysReady = { validate: async () => ({ status: 'READY' as const, capabilities: {}, blockers: [], warnings: [], metadata: {} }) };
    const sealedWithCapabilities = backend('sealed');
    sealedWithCapabilities.validate = async () => ({ lifecycle: 'sealed', kvValid: true, policyValid: true });
    const dependencyBlocked = await runSetupCommand(productionDependencies({
      validator: alwaysReady,
      dependencyChecker: { check: async () => ({ capabilities: {}, blockers: ['Docker unavailable'], warnings: [], metadata: { platform: 'linux' } }) },
    }), { yes: true });
    const lifecycleBlocked = await runSetupCommand(productionDependencies({
      validator: alwaysReady,
      localBackend: sealedWithCapabilities,
    }), { yes: true });
    const noBackend = await runSetupCommand(productionDependencies({
      validator: alwaysReady,
      backendSelector: { select: async () => ({ blockers: ['No viable Vault backend is available.'], metadata: { selectedBackend: null } }) },
    }), { yes: true });
    const capabilityBlocked = await runSetupCommand(productionDependencies({
      validator: alwaysReady,
      localBackend: backend('configured', { canStart: false, canConfigure: true, canValidateKv: false, canValidatePolicy: true }),
    }), { yes: true });

    expect(dependencyBlocked.status).toBe('BLOCKED');
    expect(lifecycleBlocked.status).toBe('BLOCKED');
    expect(noBackend.status).toBe('BLOCKED');
    expect(capabilityBlocked.status).toBe('BLOCKED');
  });

  it('preserves blocked and failed setup steps and does not mutate in --check', async () => {
    const blocked = await runSetupCommand({ ...productionDependencies(), steps: [{ id: 'blocked', mutating: false, requiresConsent: false, run: async () => ({ status: 'blocked' as const, metadata: {}, nextAction: 'blocked' }) }] }, { yes: true });
    const failed = await runSetupCommand({ ...productionDependencies(), steps: [{ id: 'failed', mutating: false, requiresConsent: false, run: async () => ({ status: 'failed' as const, metadata: {}, errorCode: 'failure' }) }] }, { yes: true });
    let mutations = 0;
    const checked = await runSetupCommand({ ...productionDependencies(), steps: [{ id: 'mutation', mutating: true, requiresConsent: true, run: async () => { mutations += 1; return { status: 'completed' as const, metadata: {} }; } }] }, { check: true });

    expect(blocked.status).toBe('BLOCKED');
    expect(failed.status).toBe('FAILED');
    expect(checked.status).toBe('DEGRADED');
    expect(mutations).toBe(0);
  });

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