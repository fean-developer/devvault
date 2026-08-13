import { sanitizeSetupMetadata } from './setup-state.js';
import type { BackendSelector, SetupValidator } from './setup-ports.js';
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
    if (allowStart && preferredBackend !== 'remote-vault' && this.dependencies.localLifecycle) {
      const detection = await this.dependencies.localBackend.detect();
      if (!detection.available) {
        try {
          await this.dependencies.localLifecycle.start();
        } catch {
          return this.result('FAILED', 'unavailable', 'local-docker', ['The local DevVault environment could not be started.']);
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
    return { status: 'READY', lifecycle: 'ready', backend: selection.backend.kind(), blockers: [], warnings: [], metadata: validatedMetadata };
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
    return { status, lifecycle, backend, blockers, warnings: [], metadata: {} };
  }

  private safeMetadata(metadata: Record<string, string | number | boolean | null>) {
    try {
      return sanitizeSetupMetadata(metadata);
    } catch {
      return {};
    }
  }
}