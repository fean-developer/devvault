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
}

export interface LocalDockerVaultBackendOptions {
  docker: DockerManager & { diagnose(): Promise<DockerDiagnostics> };
  vault: LocalVaultHealthClient;
}

export class LocalDockerVaultBackend implements VaultBackend {
  constructor(private readonly options: LocalDockerVaultBackendOptions) {}

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
    if (health.reachable) {
      lifecycle = !health.initialized
        ? 'not-initialized'
        : health.sealed
          ? 'sealed'
          : capabilities.canValidateKv && capabilities.canValidatePolicy
            ? 'configured'
            : 'unsealed';
    }
    return {
      lifecycle,
      kvValid: health.reachable && !health.sealed && capabilities.canValidateKv,
      policyValid: health.reachable && !health.sealed && capabilities.canValidatePolicy,
    };
  }
}