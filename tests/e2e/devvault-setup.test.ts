import { mkdtemp } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import {
  ProfileSetupValidator,
  StepSetupOrchestrator,
  type SetupStateStore,
  type SetupStep,
} from '../../packages/core/src/index.js';
import { PlatformDependencyChecker } from '../../packages/platform/src/setup-dependencies.js';
import { FileSetupStateStore } from '../../packages/platform/src/setup-state-store.js';
import { RemoteVaultBackend } from '../../packages/platform/src/remote-vault-backend.js';

async function stateStore(): Promise<SetupStateStore> {
  const directory = await mkdtemp(join(tmpdir(), 'devvault-e2e-'));
  return new FileSetupStateStore({ statePath: join(directory, 'config', 'setup-state.json') });
}

function context(mode: 'setup' | 'check' | 'repair' = 'setup') {
  return { mode, profile: 'local-bootstrap' as const, metadata: { platform: 'linux' } };
}

describe('Phase 0 setup readiness scenarios', () => {
  it('performs clean setup and preserves state on repeated setup', async () => {
    const store = await stateStore();
    const calls: string[] = [];
    const steps: SetupStep[] = [{
      id: 'configure-backend',
      mutating: false,
      requiresConsent: false,
      run: async () => { calls.push('configure'); return { status: 'completed', metadata: { backend: 'local-docker' } }; },
    }];
    const orchestrator = new StepSetupOrchestrator(store, { request: async () => 'approved' });

    const first = await orchestrator.setup(context(), steps);
    const second = await orchestrator.setup(context(), steps);

    expect(first.status).toBe('READY');
    expect(second.status).toBe('READY');
    expect(calls).toEqual(['configure']);
  });

  it('repairs an interrupted setup without destructive backend operations', async () => {
    const store = await stateStore();
    const calls: string[] = [];
    let interrupted = true;
    const steps: SetupStep[] = [
      {
        id: 'detect-backend',
        mutating: false,
        requiresConsent: false,
        run: async () => { calls.push('detect'); return { status: 'completed', metadata: {} }; },
      },
      {
        id: 'validate-kv',
        mutating: false,
        requiresConsent: false,
        run: async () => {
          calls.push('validate');
          if (interrupted) return { status: 'failed', metadata: {}, errorCode: 'KV_CHECK_FAILED' };
          return { status: 'completed', metadata: {} };
        },
      },
      {
        id: 'destructive-reset',
        mutating: true,
        requiresConsent: true,
        run: async () => { calls.push('reset'); return { status: 'completed', metadata: {} }; },
      },
    ];
    const orchestrator = new StepSetupOrchestrator(store, { request: async () => 'denied' });

    const failed = await orchestrator.setup(context(), steps);
    interrupted = false;
    const repaired = await orchestrator.repair(context('repair'), steps);

    expect(failed.status).toBe('FAILED');
    expect(repaired.status).toBe('BLOCKED');
    expect(calls).toEqual(['detect', 'validate', 'validate']);
    expect(calls).not.toContain('reset');
  });

  it('returns BLOCKED for Docker/Desktop policy restrictions and denied consent', async () => {
    const dependencyChecker = new PlatformDependencyChecker({
      platformSignals: { platform: 'linux' },
      diagnoseDocker: async () => ({ state: 'available', vaultContainer: 'running' }),
    });
    const report = await dependencyChecker.check({ profile: 'local-bootstrap', metadata: { dockerDesktopRequired: true } });
    expect(report.blockers).toContain('Docker Desktop installation or modification is blocked by policy.');

    const store = await stateStore();
    const orchestrator = new StepSetupOrchestrator(store, { request: async () => 'denied' });
    const result = await orchestrator.setup(context(), [{
      id: 'start-vault',
      mutating: true,
      requiresConsent: true,
      run: async () => ({ status: 'completed', metadata: {} }),
    }]);
    expect(result.status).toBe('BLOCKED');
  });

  it('keeps remote-check read-only and evaluates its mandatory profile', async () => {
    const calls: string[] = [];
    const backend = new RemoteVaultBackend({
      address: 'https://vault.example.test',
      client: {
        health: async () => { calls.push('health'); return { initialized: true, sealed: false }; },
        validateKvV2: async () => { calls.push('kv'); return true; },
        checkCapabilities: async () => { calls.push('capabilities'); return ['read']; },
      },
    });
    const detection = await backend.detect();
    const validation = await backend.validate(detection.capabilities);
    const report = await new ProfileSetupValidator({
      collect: async () => ({
        capabilities: {
          platform: true,
          'remote-endpoint': true,
          'trust-configuration': true,
          'vault-lifecycle': validation.lifecycle === 'configured',
          'requested-capabilities': validation.kvValid && validation.policyValid,
          'setup-state': true,
        },
        blockers: [],
        warnings: [],
        metadata: { backend: 'remote-vault' },
      }),
    }).validate({ mode: 'check', profile: 'remote-check', metadata: {} });

    expect(report.status).toBe('READY');
    expect(backend.kind()).toBe('remote-vault');
    expect(calls).toEqual(['health', 'health', 'kv', 'capabilities']);
  });
});
