import { sanitizeSetupMetadata } from './setup-state.js';
import type { BackendSelector, ConsentService, SetupValidator } from './setup-ports.js';
import type { SetupStateStore } from './setup-state-store.js';
import { validateSetupState } from './setup-state.js';
import type { VaultBackend } from './vault-backend.js';
import {
  type DeveloperLifecycleService,
  type EphemeralSecretInput,
  type LifecycleBackendKind,
  type LifecycleResult,
  type LocalLifecyclePort,
  type StartInput,
  type StatusInput,
} from './developer-lifecycle-ports.js';

export interface DeveloperLifecycleDependencies {
  backendSelector: BackendSelector;
  localBackend: VaultBackend;
  remoteBackend?: VaultBackend;
  localLifecycle?: LocalLifecyclePort;
  secretInput?: EphemeralSecretInput;
  validator?: SetupValidator;
  stateStore: SetupStateStore;
  consent: ConsentService;
}

export class DefaultDeveloperLifecycleService implements DeveloperLifecycleService {
  constructor(private readonly dependencies: DeveloperLifecycleDependencies) {}

  async start(input: StartInput): Promise<LifecycleResult> {
    return this.execute(input.mode, input.preferredBackend);
  }

  async status(input: StatusInput): Promise<LifecycleResult> {
    return this.execute('non-interactive', input.preferredBackend, false);
  }

  private async execute(
    mode: StartInput['mode'],
    preferredBackend?: LifecycleBackendKind,
    allowStart = true,
  ): Promise<LifecycleResult> {
    let lock;
    if (allowStart) {
      try {
        lock = await this.dependencies.stateStore.acquireLock();
        const state = await this.dependencies.stateStore.load();
        if (state.status === 'corrupt') return this.result('FAILED', 'unavailable', null, ['Lifecycle setup state is corrupt.']);
      } catch {
        return this.result('FAILED', 'unavailable', null, ['Lifecycle setup state could not be accessed.']);
      }
    }

    try {
      return await this.executeLocked(mode, preferredBackend, allowStart);
    } finally {
      await lock?.release();
    }
  }

  private async executeLocked(
    mode: StartInput['mode'],
    preferredBackend: LifecycleBackendKind | undefined,
    allowStart: boolean,
  ): Promise<LifecycleResult> {
    if (allowStart && preferredBackend !== 'remote-vault' && this.dependencies.localLifecycle) {
      const detection = await this.dependencies.localBackend.detect();
      if (!detection.available) {
        const consent = await this.dependencies.consent.request({
          actionId: 'start-local-vault',
          summary: 'Start the owned local DevVault environment.',
          mutating: true,
          required: true,
        });
        if (consent !== 'approved') return this.result('BLOCKED', 'unavailable', 'local-docker', ['Consent was not granted to start the local DevVault environment.']);
        try {
          await this.dependencies.localLifecycle.start();
        } catch {
          return this.result('BLOCKED', 'unavailable', 'local-docker', ['The local DevVault environment could not be started.']);
        }
      }
    }

    const selection = await this.dependencies.backendSelector.select({
      local: this.dependencies.localBackend,
      remote: this.dependencies.remoteBackend,
      preferred: preferredBackend,
    });
    if (!selection.backend) {
      return this.result('BLOCKED', 'unavailable', null, selection.blockers);
    }

    let validation = await this.validate(selection.backend);
    if (validation.lifecycle === 'sealed') {
      if (selection.backend.kind() !== 'local-docker') {
        return this.result('BLOCKED', 'sealed', selection.backend.kind(), ['The remote Vault requires operator action.']);
      }
      if (mode !== 'interactive' || !this.dependencies.secretInput || !this.dependencies.localLifecycle) {
        return this.result('BLOCKED', 'sealed', 'local-docker', ['The local Vault is sealed and requires interactive operator action.']);
      }
      const consent = await this.dependencies.consent.request({
        actionId: 'unseal-local-vault',
        summary: 'Unlock the owned local DevVault environment.',
        mutating: true,
        required: true,
      });
      if (consent !== 'approved') return this.result('BLOCKED', 'sealed', 'local-docker', ['Consent was not granted to unlock the local DevVault environment.']);
      try {
        const key = await this.dependencies.secretInput.read('Unlock the local DevVault: ');
        await this.dependencies.localLifecycle.unseal(key);
      } catch {
        return this.result('BLOCKED', 'sealed', 'local-docker', ['The local Vault could not be unlocked.']);
      }
      validation = await this.validate(selection.backend);
    }

    const metadata = {
      backend: selection.backend.kind(),
      vaultLifecycle: validation.lifecycle,
      kv: validation.kvValid,
      policy: validation.policyValid,
    };
    const validatedMetadata = this.safeMetadata(metadata);
    if (validation.lifecycle === 'not-initialized') {
      return { status: 'BLOCKED', lifecycle: validation.lifecycle, backend: selection.backend.kind(), blockers: ['The local Vault requires first-time operator initialization.'], warnings: [], metadata: validatedMetadata };
    }
    if (validation.lifecycle === 'unavailable') {
      return { status: 'BLOCKED', lifecycle: validation.lifecycle, backend: selection.backend.kind(), blockers: ['The selected Vault backend is unavailable.'], warnings: [], metadata: validatedMetadata };
    }
    if (!validation.kvValid || !validation.policyValid) {
      return { status: 'BLOCKED', lifecycle: validation.lifecycle, backend: selection.backend.kind(), blockers: ['Mandatory local DevVault capabilities are unavailable.'], warnings: [], metadata: validatedMetadata };
    }
    if (this.dependencies.validator) {
      const report = await this.dependencies.validator.validate({
        mode: 'setup',
        profile: selection.backend.kind() === 'remote-vault' ? 'remote-check' : 'local-bootstrap',
        metadata: validatedMetadata,
      });
      if (report.status !== 'READY') {
        return {
          status: report.status,
          lifecycle: validation.lifecycle,
          backend: selection.backend.kind(),
          blockers: report.blockers,
          warnings: report.warnings,
          metadata: this.safeMetadata(report.metadata),
        };
      }
    }
    const result = { status: 'READY' as const, lifecycle: 'ready' as const, backend: selection.backend.kind(), blockers: [], warnings: [], metadata: validatedMetadata };
    return this.persistResult(result);
  }

  private async validate(backend: VaultBackend) {
    const detection = await backend.detect();
    if (!detection.available) {
      return { lifecycle: 'unavailable' as const, kvValid: false, policyValid: false };
    }
    return backend.validate(detection.capabilities);
  }

  private result(
    status: LifecycleResult['status'],
    lifecycle: LifecycleResult['lifecycle'],
    backend: LifecycleResult['backend'],
    blockers: string[],
  ): LifecycleResult {
    const result = { status, lifecycle, backend, blockers, warnings: [], metadata: {} };
    return result;
  }

  private async persistResult(result: LifecycleResult): Promise<LifecycleResult> {
    const state = validateSetupState({
      schemaVersion: 1,
      status: result.status,
      profile: result.backend === 'remote-vault' ? 'remote-check' : 'local-bootstrap',
      platform: { host: String(result.metadata.platform ?? 'unknown'), isWsl: result.metadata.isWsl === true, shell: String(result.metadata.shell ?? 'unknown') },
      backend: result.backend,
      vaultAddress: typeof result.metadata.vaultAddress === 'string' ? result.metadata.vaultAddress : null,
      kvMount: typeof result.metadata.kvMount === 'string' ? result.metadata.kvMount : null,
      completedSteps: result.status === 'READY' ? ['lifecycle-start'] : [],
      pendingSteps: result.status === 'READY' ? [] : ['lifecycle-start'],
      updatedAt: new Date().toISOString(),
    });
    const saved = await this.dependencies.stateStore.save(state);
    return saved.status === 'saved' ? result : this.result('FAILED', result.lifecycle, result.backend, ['Lifecycle setup state could not be saved.']);
  }

  private safeMetadata(metadata: Record<string, string | number | boolean | null>) {
    try {
      return sanitizeSetupMetadata(metadata);
    } catch {
      return {};
    }
  }
}