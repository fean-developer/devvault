import { describe, expect, it } from 'vitest';
import { LocalVaultLifecycleAdapter } from './local-vault-lifecycle.js';

describe('LocalVaultLifecycleAdapter', () => {
  it('starts the configured local Compose file', async () => {
    let composeFile = '';
    const adapter = new LocalVaultLifecycleAdapter({
      docker: {
        composeUp: async (file) => { composeFile = file; },
        isAvailable: async () => true,
        diagnose: async () => ({ state: 'available', dockerCli: true, daemon: true, compose: true, vaultContainer: 'running' }),
      },
      vault: {
        health: async () => ({ initialized: true, sealed: false }),
        unseal: async () => undefined,
      },
      composeFile: '/workspace/infra/vault/docker-compose.yml',
    });

    await adapter.start();

    expect(composeFile).toBe('/workspace/infra/vault/docker-compose.yml');
  });

  it('maps healthy Vault lifecycle facts without adding platform rules', async () => {
    const adapter = new LocalVaultLifecycleAdapter({
      docker: {
        composeUp: async () => undefined,
        isAvailable: async () => true,
        diagnose: async () => ({ state: 'available', dockerCli: true, daemon: true, compose: true, vaultContainer: 'running' }),
      },
      vault: {
        health: async () => ({ initialized: true, sealed: true }),
        unseal: async () => undefined,
      },
      composeFile: 'compose.yml',
    });

    await expect(adapter.health()).resolves.toEqual({ reachable: true, initialized: true, sealed: true });
  });

  it('maps Vault transport failure to unavailable health', async () => {
    const adapter = new LocalVaultLifecycleAdapter({
      docker: {
        composeUp: async () => undefined,
        isAvailable: async () => true,
        diagnose: async () => ({ state: 'available', dockerCli: true, daemon: true, compose: true, vaultContainer: 'running' }),
      },
      vault: {
        health: async () => { throw new Error('connection refused'); },
        unseal: async () => undefined,
      },
      composeFile: 'compose.yml',
    });

    await expect(adapter.health()).resolves.toEqual({ reachable: false, initialized: false, sealed: true });
  });

  it('delegates unseal without persisting the key', async () => {
    let receivedKey = '';
    const adapter = new LocalVaultLifecycleAdapter({
      docker: {
        composeUp: async () => undefined,
        isAvailable: async () => true,
        diagnose: async () => ({ state: 'available', dockerCli: true, daemon: true, compose: true, vaultContainer: 'running' }),
      },
      vault: {
        health: async () => ({ initialized: true, sealed: true }),
        unseal: async (key) => { receivedKey = key; },
      },
      composeFile: 'compose.yml',
    });

    await adapter.unseal({ rootToken: 'internal-root', unsealKey: 'ephemeral-key' });

    expect(receivedKey).toBe('ephemeral-key');
  });
});