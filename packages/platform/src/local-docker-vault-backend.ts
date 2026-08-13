import type {
  BackendCapabilities,
  BackendDetection,
  BackendValidation,
  VaultBackend,
  VaultHealth,
} from '@devvault/core';
import type { DockerDiagnostics } from './docker-diagnostics.js';
import type { DockerManager } from './index.js';

export interface LocalVaultHealthClient {
  health(): Promise<{ initialized: boolean; sealed: boolean }>;
  validateKvV2(mount: string): Promise<boolean>;
  checkCapabilities(path: string): Promise<string[]>;
}

export interface LocalDockerVaultBackendOptions {
  docker: DockerManager & { diagnose(): Promise<DockerDiagnostics> };
  vault: LocalVaultHealthClient;
  kvMount?: string;
  capabilityPath?: string;
}

export class LocalDockerVaultBackend implements VaultBackend {
  private capabilityPath: string;

  constructor(private readonly options: LocalDockerVaultBackendOptions) {
    this.capabilityPath = options.capabilityPath ?? 'secret/data/projects';
  }

  setCapabilityPath(path: string): void {
    this.capabilityPath = path;
  }

  kind(): 'local-docker' {
    return 'local-docker';
  }

  async detect(): Promise<BackendDetection> {
    const diagnostics = await this.options.docker.diagnose();
    const available = diagnostics.state === 'available' && diagnostics.vaultContainer === 'running';
    return {
      kind: 'local-docker',
      available,
      capabilities: {
        canStart: diagnostics.state === 'available',
        canConfigure: available,
        canValidateKv: available,
        canValidatePolicy: available,
      },
      detail: diagnostics.detail ?? (available ? undefined : `Vault container is ${diagnostics.vaultContainer}.`),
    };
  }

  async health(): Promise<VaultHealth> {
    try {
      const health = await this.options.vault.health();
      return { reachable: true, initialized: health.initialized, sealed: health.sealed };
    } catch {
      return { reachable: false, initialized: false, sealed: true };
    }
  }

  async validate(capabilities: BackendCapabilities): Promise<BackendValidation> {
    const health = await this.health();
    let lifecycle: BackendValidation['lifecycle'] = 'unavailable';
    const kvMount = this.options.kvMount ?? 'secret';
    const capabilityPath = this.capabilityPath;
    let kvValid = false;
    let policyValid = false;
    if (health.reachable && !health.sealed && health.initialized) {
      try {
        kvValid = await this.options.vault.validateKvV2(kvMount);
        const effectiveCapabilities = await this.options.vault.checkCapabilities(capabilityPath);
        policyValid = effectiveCapabilities.includes('read') || effectiveCapabilities.includes('root');
      } catch {
        kvValid = false;
        policyValid = false;
      }
    }
    if (health.reachable) {
      lifecycle = !health.initialized
        ? 'not-initialized'
        : health.sealed
          ? 'sealed'
          : capabilities.canValidateKv && capabilities.canValidatePolicy && kvValid && policyValid
            ? 'configured'
            : 'unsealed';
    }
    return {
      lifecycle,
      kvValid: health.reachable && !health.sealed && capabilities.canValidateKv && kvValid,
      policyValid: health.reachable && !health.sealed && capabilities.canValidatePolicy && policyValid,
    };
  }
}