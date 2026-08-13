import type { LocalBootstrapMaterial, LocalLifecyclePort } from '@devvault/core';
import type { DockerManager } from './index.js';
import { createApplicationPolicy, createDeveloperPolicy } from '@devvault/vault-client';

export interface LocalVaultLifecycleClient {
  health(): Promise<{ initialized: boolean; sealed: boolean }>;
  ensureKvV2?(mount: string): Promise<void>;
  putPolicy?(name: string, policy: string): Promise<void>;
  initialize?(): Promise<LocalBootstrapMaterial>;
  unseal(key: string): Promise<void>;
  setToken?(token: string): void;
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

  async unseal(material: LocalBootstrapMaterial): Promise<void> {
    this.options.vault.setToken?.(material.rootToken);
    await this.options.vault.unseal(material.unsealKey);
  }

  async configure(project: { name: string; environment: string }): Promise<void> {
    if (!this.options.vault.ensureKvV2) throw new Error('Vault KV configuration is unavailable.');
    if (!this.options.vault.putPolicy) throw new Error('Vault policy configuration is unavailable.');
    await this.options.vault.ensureKvV2('secret');
    const policyInput = { project: project.name, environment: project.environment };
    await this.options.vault.putPolicy(`devvault-${project.name}-${project.environment}-developer`, createDeveloperPolicy(policyInput));
    await this.options.vault.putPolicy(`devvault-${project.name}-${project.environment}-application`, createApplicationPolicy(policyInput));
  }

  async initialize(): Promise<LocalBootstrapMaterial> {
    if (!this.options.vault.initialize) throw new Error('Vault initialization is unavailable.');
    const material = await this.options.vault.initialize();
    this.options.vault.setToken?.(material.rootToken);
    return material;
  }

  useBootstrapMaterial(material: LocalBootstrapMaterial): void {
    this.options.vault.setToken?.(material.rootToken);
  }
}