import type {
  BackendCapabilities,
  BackendDetection,
  BackendValidation,
  VaultBackend,
  VaultHealth,
} from '@devvault/core';

export interface RemoteVaultApi {
  health(): Promise<{ initialized: boolean; sealed: boolean }>;
}

export interface RemoteVaultBackendOptions {
  address: string;
  client: RemoteVaultApi;
}

export class RemoteVaultBackend implements VaultBackend {
  readonly address: string;

  constructor(options: RemoteVaultBackendOptions) {
    this.address = validateRemoteAddress(options.address);
    this.client = options.client;
  }

  private readonly client: RemoteVaultApi;

  kind(): 'remote-vault' {
    return 'remote-vault';
  }

  async detect(): Promise<BackendDetection> {
    try {
      await this.client.health();
      return {
        kind: 'remote-vault',
        available: true,
        capabilities: {
          canStart: false,
          canConfigure: false,
          canValidateKv: true,
          canValidatePolicy: true,
        },
      };
    } catch {
      return {
        kind: 'remote-vault',
        available: false,
        capabilities: {
          canStart: false,
          canConfigure: false,
          canValidateKv: false,
          canValidatePolicy: false,
        },
        detail: 'Remote Vault is unavailable.',
      };
    }
  }

  async health(): Promise<VaultHealth> {
    try {
      const health = await this.client.health();
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

function validateRemoteAddress(address: string): string {
  let parsed: URL;
  try {
    parsed = new URL(address);
  } catch {
    throw new Error('Remote Vault address is invalid.');
  }
  if (!['http:', 'https:'].includes(parsed.protocol) || parsed.username || parsed.password || parsed.search || parsed.hash) {
    throw new Error('Remote Vault address must not contain credentials or query parameters.');
  }
  return parsed.toString().replace(/\/$/, '');
}