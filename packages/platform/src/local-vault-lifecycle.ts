import type { LocalLifecyclePort } from '@devvault/core';
import type { DockerManager } from './index.js';

export interface LocalVaultLifecycleClient {
  health(): Promise<{ initialized: boolean; sealed: boolean }>;
  unseal(key: string): Promise<void>;
}

export interface LocalVaultLifecycleOptions {
  docker: DockerManager;
  vault: LocalVaultLifecycleClient;
  composeFile: string;
}

export class LocalVaultLifecycleAdapter implements LocalLifecyclePort {
  constructor(private readonly options: LocalVaultLifecycleOptions) {}

  async start(): Promise<void> {
    await this.options.docker.composeUp(this.options.composeFile);
  }

  async health(): Promise<{ reachable: boolean; initialized: boolean; sealed: boolean }> {
    try {
      const health = await this.options.vault.health();
      return { reachable: true, initialized: health.initialized, sealed: health.sealed };
    } catch {
      return { reachable: false, initialized: false, sealed: true };
    }
  }

  async unseal(key: string): Promise<void> {
    await this.options.vault.unseal(key);
  }
}