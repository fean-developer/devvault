import { describe, expect, it } from 'vitest';
import { setSecret, getSecret, deleteSecret, listSecretKeys } from './secrets.js';
import { AuthorizationDeniedError, VaultAuthenticationError, VaultUnavailableError } from '@devvault/core';
import { VaultPermissionDeniedError } from '@devvault/core';

const config = {
  version: 1 as const,
  project: 'my-api',
  environment: 'development',
  vault: { mount: 'secret', path: 'projects/my-api/development' },
  runtime: { mappings: {} },
};

function clientWith(initial: Record<string, unknown>) {
  let data = structuredClone(initial) as Record<string, string>;
  return {
    readSecret: async () => data,
    writeSecret: async (_mount: string, _path: string, next: Record<string, string>) => {
      data = structuredClone(next);
    },
    listSecrets: async (...args: [string, string]) => {
      void args;
      return Object.keys(data);
    },
    deleteSecret: async () => undefined,
    data: () => data,
  };
}

function failingClient(error: unknown, calls: string[] = []) {
  return {
    readSecret: async (mount: string, path: string) => { calls.push(`read:${mount}:${path}`); throw error; },
    writeSecret: async () => { throw error; },
    listSecrets: async (mount: string, path: string) => { calls.push(`list:${mount}:${path}`); throw error; },
    deleteSecret: async () => { throw error; },
  };
}

describe('secret operations', () => {
  it('sets and reads nested values without replacing sibling values', async () => {
    const client = clientWith({ database: { username: 'dev' } });

    await setSecret(config, client, 'database.password', 'value');

    await expect(getSecret(config, client, 'database.password')).resolves.toBe('value');
    expect(client.data()).toEqual({ database: { username: 'dev', password: 'value' } });
  });

  it('deletes only the requested nested value', async () => {
    const client = clientWith({ database: { username: 'dev', password: 'value' } });

    await expect(deleteSecret(config, client, 'database.password')).resolves.toBe(true);
    expect(client.data()).toEqual({ database: { username: 'dev' } });
  });

  it('does not expose values through key operations', async () => {
    const client = clientWith({ database: { password: 'secret-value' } });

    await expect(client.listSecrets('secret', 'projects/my-api/development')).resolves.toEqual([
      'database',
    ]);
  });

  describe('authorization error classification', () => {
    it('getSecret maps a Vault 403 to AuthorizationDeniedError with the operation resource', async () => {
      const client = failingClient(new VaultPermissionDeniedError());

      await expect(getSecret(config, client, 'database.password')).rejects.toMatchObject({
        code: 'AUTHORIZATION_DENIED',
        operation: 'secret.get',
        project: 'my-api',
        environment: 'development',
      });
      await expect(getSecret(config, client, 'database.password')).rejects.toBeInstanceOf(AuthorizationDeniedError);
    });

    it('getSecret leaves a 401 unchanged (Session/Auth-owned)', async () => {
      const client = failingClient(new VaultAuthenticationError());
      await expect(getSecret(config, client, 'database.password')).rejects.toBeInstanceOf(VaultAuthenticationError);
    });

    it('getSecret leaves a 503 unchanged (infrastructure-owned)', async () => {
      const client = failingClient(new VaultUnavailableError());
      await expect(getSecret(config, client, 'database.password')).rejects.toBeInstanceOf(VaultUnavailableError);
    });

    it('listSecretKeys maps a Vault 403 to AuthorizationDeniedError independently of get', async () => {
      const client = failingClient(new VaultPermissionDeniedError());

      await expect(listSecretKeys(config, client)).rejects.toMatchObject({
        code: 'AUTHORIZATION_DENIED',
        operation: 'secret.list',
      });
    });

    it('a successful get does not imply list is authorized (AZM13)', async () => {
      const okThenDenied = {
        ...clientWith({ database: { password: 'value' } }),
        listSecrets: async () => { throw new VaultPermissionDeniedError(); },
      };

      await expect(getSecret(config, okThenDenied, 'database.password')).resolves.toBe('value');
      await expect(listSecretKeys(config, okThenDenied)).rejects.toBeInstanceOf(AuthorizationDeniedError);
    });

    it('uses exactly the configured mount/path for get and list (resource continuity, AZM8/AZM9)', async () => {
      const calls: string[] = [];
      const client = failingClient(new VaultPermissionDeniedError(), calls);

      await expect(getSecret(config, client, 'k')).rejects.toBeInstanceOf(AuthorizationDeniedError);
      await expect(listSecretKeys(config, client)).rejects.toBeInstanceOf(AuthorizationDeniedError);

      expect(calls).toEqual([
        `read:${config.vault.mount}:${config.vault.path}`,
        `list:${config.vault.mount}:${config.vault.path}`,
      ]);
    });

    it('setSecret maps a Vault 403 on write to AuthorizationDeniedError with no successful mutation', async () => {
      const writes: unknown[] = [];
      const client = {
        readSecret: async () => ({}),
        writeSecret: async (...args: unknown[]) => { writes.push(args); throw new VaultPermissionDeniedError(); },
        listSecrets: async () => [],
        deleteSecret: async () => undefined,
      };

      await expect(setSecret(config, client, 'database.password', 'value')).rejects.toMatchObject({
        code: 'AUTHORIZATION_DENIED',
        operation: 'secret.set',
      });
      expect(writes).toHaveLength(1);
    });

    it('setSecret leaves 401/503 unchanged (AZM5 boundary)', async () => {
      await expect(setSecret(config, {
        readSecret: async () => ({}),
        writeSecret: async () => { throw new VaultAuthenticationError(); },
        listSecrets: async () => [],
        deleteSecret: async () => undefined,
      }, 'k', 'v')).rejects.toBeInstanceOf(VaultAuthenticationError);

      await expect(setSecret(config, {
        readSecret: async () => ({}),
        writeSecret: async () => { throw new VaultUnavailableError(); },
        listSecrets: async () => [],
        deleteSecret: async () => undefined,
      }, 'k', 'v')).rejects.toBeInstanceOf(VaultUnavailableError);
    });

    it('deleteSecret maps a Vault 403 on the rewrite to AuthorizationDeniedError and never returns a value', async () => {
      const client = {
        readSecret: async () => ({ database: { password: 'value' } }),
        writeSecret: async () => { throw new VaultPermissionDeniedError(); },
        listSecrets: async () => [],
        deleteSecret: async () => undefined,
      };

      await expect(deleteSecret(config, client, 'database.password')).rejects.toMatchObject({
        code: 'AUTHORIZATION_DENIED',
        operation: 'secret.delete',
      });
    });

    it('deleteSecret still uses the data/<path> write, never the metadata delete endpoint', async () => {
      const calls: string[] = [];
      const client = {
        readSecret: async () => ({ database: { password: 'value' } }),
        writeSecret: async (mount: string, path: string) => { calls.push(`write:${mount}:${path}`); },
        listSecrets: async () => [],
        deleteSecret: async () => { calls.push('metadata-delete'); },
      };

      await expect(deleteSecret(config, client, 'database.password')).resolves.toBe(true);
      expect(calls).toEqual([`write:${config.vault.mount}:${config.vault.path}`]);
    });
  });
});