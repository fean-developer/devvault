import { sanitizeSetupMetadata } from './setup-state.js';
import type { BackendSelector, ConsentService, SetupValidator } from './setup-ports.js';
import type { SetupStateStore } from './setup-state-store.js';
import { validateSetupState } from './setup-state.js';
import type { VaultBackend } from './vault-backend.js';
import {
  type DeveloperLifecycleService,
  type LocalBootstrapMaterialStore,
  type EphemeralSecretInput,
  type ProjectContextProvider,
  type DeveloperSessionStore,
  type LifecycleBackendKind,
  type LifecycleResult,
  type LocalLifecyclePort,
  type StartInput,
  type StatusInput,
  type LifecycleProgressEvent,
} from './developer-lifecycle-ports.js';

export interface DeveloperLifecycleDependencies {
  backendSelector: BackendSelector;
  localBackend: VaultBackend;
  remoteBackend?: VaultBackend;
  localLifecycle?: LocalLifecyclePort;
  bootstrapStore?: LocalBootstrapMaterialStore;
  /** @deprecated retained for compatibility with older test fixtures. */
  secretInput?: EphemeralSecretInput;
  validator?: SetupValidator;
  stateStore: SetupStateStore;
  consent: ConsentService;
  projectContext?: ProjectContextProvider;
  sessionStore?: DeveloperSessionStore;
}

export class DefaultDeveloperLifecycleService implements DeveloperLifecycleService {
  constructor(private readonly dependencies: DeveloperLifecycleDependencies) {}

  async start(input: StartInput): Promise<LifecycleResult> {
    return this.execute(input.mode, input.preferredBackend, true, input.progress);
  }

  async status(input: StatusInput): Promise<LifecycleResult> {
    return this.execute('non-interactive', input.preferredBackend, false);
  }

  private async execute(
    mode: StartInput['mode'],
    preferredBackend?: LifecycleBackendKind,
    allowStart = true,
    progress?: (event: LifecycleProgressEvent) => void,
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
      return await this.executeLocked(mode, preferredBackend, allowStart, progress);
    } finally {
      await lock?.release();
    }
  }

  private async executeLocked(
    mode: StartInput['mode'],
    preferredBackend: LifecycleBackendKind | undefined,
    allowStart: boolean,
    progress?: (event: LifecycleProgressEvent) => void,
  ): Promise<LifecycleResult> {
    progress?.({ phase: 'environment', state: 'start', message: 'Starting local environment' });
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
    progress?.({ phase: 'environment', state: 'complete', message: 'Local environment started' });
    progress?.({ phase: 'vault', state: 'start', message: 'Installing and configuring Vault' });

    const selection = await this.dependencies.backendSelector.select({
      local: this.dependencies.localBackend,
      remote: this.dependencies.remoteBackend,
      preferred: preferredBackend,
    });
    if (!selection.backend) {
      return this.result('BLOCKED', 'unavailable', null, selection.blockers);
    }

    if (selection.backend.kind() === 'local-docker' && this.dependencies.projectContext && 'setCapabilityPath' in selection.backend) {
      const project = await this.dependencies.projectContext.load();
      if (project && (!project.state || project.state === 'CONFIGURED')) {
        (selection.backend as { setCapabilityPath(path: string): void }).setCapabilityPath(`secret/data/projects/${project.name}/${project.environment}/_doctor`);
      }
    }

    if (selection.backend.kind() === 'local-docker' && this.dependencies.bootstrapStore && this.dependencies.localLifecycle?.useBootstrapMaterial) {
      const material = await this.dependencies.bootstrapStore.load();
      if (material) this.dependencies.localLifecycle.useBootstrapMaterial(material);
    }

    let validation = await this.validate(selection.backend);
    if (validation.lifecycle === 'sealed') {
      if (selection.backend.kind() !== 'local-docker') {
        return this.result('BLOCKED', 'sealed', selection.backend.kind(), ['The remote Vault requires operator action.']);
      }
      if (!this.dependencies.bootstrapStore || !this.dependencies.localLifecycle) {
        return this.result('BLOCKED', 'sealed', 'local-docker', ['The local Vault bootstrap material is unavailable.']);
      }
      try {
        const material = await this.dependencies.bootstrapStore.load();
        if (!material) return this.result('BLOCKED', 'sealed', 'local-docker', ['The local Vault bootstrap material is unavailable.']);
        await this.dependencies.localLifecycle.unseal(material);
      } catch {
        return this.result('BLOCKED', 'sealed', 'local-docker', ['The local Vault could not be unlocked.']);
      }
      validation = await this.validate(selection.backend);
    }

    if (validation.lifecycle === 'not-initialized' && selection.backend.kind() === 'local-docker') {
      if (!this.dependencies.bootstrapStore || !this.dependencies.localLifecycle) {
        return this.result('BLOCKED', 'not-initialized', 'local-docker', ['The local Vault bootstrap boundary is unavailable.']);
      }
      const consent = await this.dependencies.consent.request({
        actionId: 'initialize-local-vault',
        summary: 'Initialize the owned local DevVault environment.',
        mutating: true,
        required: true,
      });
      if (consent !== 'approved') return this.result('BLOCKED', 'not-initialized', 'local-docker', ['Consent was not granted to initialize the local DevVault environment.']);
      const localLifecycle = this.dependencies.localLifecycle;
      if (!localLifecycle.initialize) return this.result('BLOCKED', 'not-initialized', 'local-docker', ['The local Vault initialization capability is unavailable.']);
      try {
        const material = await localLifecycle.initialize();
        await this.dependencies.bootstrapStore.save(material);
        await this.dependencies.localLifecycle.unseal(material);
        validation = await this.validate(selection.backend);
      } catch {
        return this.result('FAILED', 'not-initialized', 'local-docker', ['The local Vault could not be initialized.']);
      }
    }

    if (validation.lifecycle !== 'sealed' && validation.lifecycle !== 'not-initialized' && selection.backend.kind() === 'local-docker' && this.dependencies.localLifecycle?.configure && this.dependencies.projectContext) {
      try {
        const project = await this.dependencies.projectContext.load();
        if (project && (!project.state || project.state === 'CONFIGURED')) {
          await this.dependencies.localLifecycle.configure(project);
        }
        validation = { lifecycle: 'configured', kvValid: true, policyValid: true };
      } catch {
        return this.result('FAILED', validation.lifecycle, 'local-docker', ['The local DevVault environment could not be configured.']);
      }
    }

    if (validation.lifecycle === 'unsealed' && (!validation.kvValid || !validation.policyValid) && selection.backend.kind() === 'local-docker' && this.dependencies.localLifecycle?.configure && this.dependencies.projectContext) {
      const consent = await this.dependencies.consent.request({
        actionId: 'configure-local-vault',
        summary: 'Configure the local DevVault development backend.',
        mutating: true,
        required: true,
      });
      if (consent !== 'approved') return this.result('BLOCKED', 'unsealed', 'local-docker', ['Consent was not granted to configure the local DevVault environment.']);
      try {
        const project = await this.dependencies.projectContext.load();
        if (!project || project.state === 'SELECTED' || project.state === 'INVALID') {
          return this.result('BLOCKED', 'unsealed', 'local-docker', ['Project context is not configured for the local DevVault environment.']);
        }
        await this.dependencies.localLifecycle.configure(project);
        validation = { lifecycle: 'configured', kvValid: true, policyValid: true };
      } catch {
        return this.result('FAILED', 'unsealed', 'local-docker', ['The local DevVault environment could not be configured.']);
      }
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
    progress?.({ phase: 'vault', state: 'complete', message: 'Vault ready' });
    progress?.({ phase: 'secrets', state: 'start', message: 'Configuring secret store' });
    if (validation.lifecycle === 'configured' && selection.backend.kind() === 'local-docker' && this.dependencies.bootstrapStore && this.dependencies.localLifecycle?.ensureDeveloperSession && this.dependencies.projectContext && this.dependencies.sessionStore) {
      const material = await this.dependencies.bootstrapStore.load();
      if (material) {
        try {
          const project = await this.dependencies.projectContext.load();
          if (project && (!project.state || project.state === 'CONFIGURED')) {
            const session = await this.dependencies.localLifecycle.ensureDeveloperSession(material, project);
            await this.dependencies.bootstrapStore.save(session.material);
            await this.dependencies.sessionStore.set('session', session.token);
          }
        } catch {
          return this.result('FAILED', 'configured', 'local-docker', ['The local developer session could not be prepared.']);
        }
      }
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
    progress?.({ phase: 'secrets', state: 'complete', message: 'Secret storage ready' });
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