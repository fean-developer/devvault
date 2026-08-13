import type {
  BackendCapabilities,
  BackendDetection,
  BackendValidation,
  VaultBackend,
  VaultHealth,
} from '@devvault/core';

export interface RemoteVaultApi {
  health(): Promise<{ initialized: boolean; sealed: boolean }>;
  validateKvV2(mount: string): Promise<boolean>;
  checkCapabilities(path: string): Promise<string[]>;
}

export interface RemoteVaultBackendOptions {
  address: string;
  client: RemoteVaultApi;
  kvMount?: string;
  capabilityPath?: string;
}

export class RemoteVaultBackend implements VaultBackend {
  readonly address: string;
  private readonly options: RemoteVaultBackendOptions;

  constructor(options: RemoteVaultBackendOptions) {
    this.options = options;
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
    const kvMount = this.options.kvMount ?? 'secret';
    const capabilityPath = this.options.capabilityPath ?? 'secret/data/projects';
    let kvValid = false;
    let policyValid = false;
    if (health.reachable && !health.sealed && health.initialized) {
      try {
        kvValid = await this.client.validateKvV2(kvMount);
        policyValid = (await this.client.checkCapabilities(capabilityPath)).includes('read');
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