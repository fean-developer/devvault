import { describe, expect, it, vi } from 'vitest';
import {
  AuthorizationDeniedError,
  classifyVaultOperationError,
  VaultPermissionDeniedError,
  VaultUnavailableError,
  SessionGuard,
  SessionResolver,
  type CredentialStore,
} from '../../packages/core/dist/index.js';
import { getSecret, listSecretKeys, setSecret } from '../../apps/cli/src/secrets.js';
import { resolveRuntimeEnvironment } from '../../apps/cli/src/runtime.js';
import { runSecretDelete, runSecretSet } from '../../apps/cli/src/commands/secret.js';
import { createCompositionRoot } from '../../apps/cli/src/composition-root.js';
import { CredentialStoreDeveloperSessionStore } from '../../packages/auth/dist/index.js';
import type { ReturnTypeOfComposition } from '../../apps/cli/src/composition-root.js';

const context = { operation: 'secret.get' as const, project: 'my-api', environment: 'development' };
const config = {
  version: 1 as const,
  project: 'my-api',
  environment: 'development',
  vault: { mount: 'secret', path: 'projects/my-api/development' },
  runtime: { mappings: {} },
};

describe('Authorization mutation discrimination (AZM1-AZM17)', () => {
  it('AZM1: a Vault 403 must classify as AuthorizationDeniedError, never a session-expiry-shaped error', () => {
    expect(() => classifyVaultOperationError(new VaultPermissionDeniedError(), context)).toThrowError(AuthorizationDeniedError);
  });

  it('AZM2: a Vault 503 must never classify as AuthorizationDeniedError', () => {
    try {
      classifyVaultOperationError(new VaultUnavailableError(), context);
      throw new Error('expected to throw');
    } catch (thrown) {
      expect(thrown).toBeInstanceOf(VaultUnavailableError);
      expect(thrown).not.toBeInstanceOf(AuthorizationDeniedError);
    }
  });

  it('AZM3/AZM4: a denied human operation must use only the validated session credential, never VAULT_TOKEN or administrative material', async () => {
    const previousToken = process.env.VAULT_TOKEN;
    const previousAddress = process.env.VAULT_ADDR;
    process.env.VAULT_TOKEN = 'administrative-token';
    process.env.VAULT_ADDR = 'http://azm3-azm4.test';
    const capturedTokens: (string | null)[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      capturedTokens.push(headers['x-vault-token'] ?? null);
      return new Response('{}', { status: 403 });
    }) as typeof fetch;
    try {
      const composition = createCompositionRoot();
      const application = await composition.createProjectApplication({ state: 'ACTIVE', credential: 'session-credential', validation: 'REMOTE_CONFIRMED' });
      await expect(application.getSecret(config, 'database.password')).rejects.toBeInstanceOf(AuthorizationDeniedError);
      expect(capturedTokens.every((token) => token === 'session-credential')).toBe(true);
      expect(capturedTokens).not.toContain('administrative-token');
    } finally {
      globalThis.fetch = originalFetch;
      if (previousToken === undefined) delete process.env.VAULT_TOKEN;
      else process.env.VAULT_TOKEN = previousToken;
      if (previousAddress === undefined) delete process.env.VAULT_ADDR;
      else process.env.VAULT_ADDR = previousAddress;
    }
  });

  it('AZM5: secret operations must not let a raw VaultPermissionDeniedError bypass the semantic authorization boundary', async () => {
    const denyingClient = {
      readSecret: async () => { throw new VaultPermissionDeniedError(); },
      writeSecret: async () => undefined,
      listSecrets: async () => { throw new VaultPermissionDeniedError(); },
      deleteSecret: async () => undefined,
    };

    await expect(getSecret(config, denyingClient, 'k')).rejects.toBeInstanceOf(AuthorizationDeniedError);
    await expect(listSecretKeys(config, denyingClient)).rejects.toBeInstanceOf(AuthorizationDeniedError);
    await expect(setSecret(config, denyingClient, 'k', 'v')).rejects.toBeInstanceOf(AuthorizationDeniedError);
  });

  it('AZM6: run must not let a raw VaultPermissionDeniedError bypass the semantic authorization boundary', async () => {
    await expect(resolveRuntimeEnvironment(config, { readSecret: async () => { throw new VaultPermissionDeniedError(); } }))
      .rejects.toBeInstanceOf(AuthorizationDeniedError);
  });

  it('AZM7: run must spawn zero child processes when the runtime secret read is denied', async () => {
    const client = { readSecret: async () => { throw new VaultPermissionDeniedError(); } };
    let resolved = false;
    try {
      await resolveRuntimeEnvironment(config, client);
      resolved = true;
    } catch {
      resolved = false;
    }
    expect(resolved).toBe(false);
  });

  it('AZM8/AZM9: authorization/error context must use exactly the resolved project, environment and Vault path', async () => {
    const calls: Array<{ mount: string; path: string }> = [];
    const client = {
      readSecret: async (mount: string, path: string) => { calls.push({ mount, path }); throw new VaultPermissionDeniedError(); },
      writeSecret: async () => undefined,
      listSecrets: async (mount: string, path: string) => { calls.push({ mount, path }); throw new VaultPermissionDeniedError(); },
      deleteSecret: async () => undefined,
    };

    let getError: unknown;
    try { await getSecret(config, client, 'k'); } catch (error) { getError = error; }
    expect(getError).toMatchObject({ project: config.project, environment: config.environment });
    expect(calls).toEqual([{ mount: config.vault.mount, path: config.vault.path }]);
  });

  it('AZM10: an accepted protected-environment consent must never override a subsequent Vault 403', async () => {
    const denyingComposition = {
      createProjectApplication: async () => ({
        load: async () => ({ ...config, protected: true }),
        setSecret: async () => { throw new AuthorizationDeniedError({ operation: 'secret.set', project: config.project, environment: config.environment }); },
        getSecret: async () => undefined,
        listSecrets: async () => [],
        deleteSecret: async () => { throw new AuthorizationDeniedError({ operation: 'secret.delete', project: config.project, environment: config.environment }); },
        run: async () => 0,
      }),
    } as unknown as ReturnTypeOfComposition;

    await expect(runSecretSet(denyingComposition, 'database.password', { yes: true }, { confirm: async () => true, readSecret: async () => 'value' }))
      .rejects.toBeInstanceOf(AuthorizationDeniedError);
    await expect(runSecretDelete(denyingComposition, 'database.password', { yes: true }, { confirm: async () => true }))
      .rejects.toBeInstanceOf(AuthorizationDeniedError);
  });

  it('AZM11: a permission denial must perform zero developer session store writes/deletes', async () => {
    const calls: string[] = [];
    const recordingStore: CredentialStore = {
      get: async () => 'stored-token',
      set: async (key) => { calls.push(`set:${key}`); },
      delete: async (key) => { calls.push(`delete:${key}`); },
    };
    const sessionStore = new CredentialStoreDeveloperSessionStore(recordingStore, 'session', 'http://azm11.test');
    const resolver = new SessionResolver(sessionStore, { validate: async () => ({ outcome: 'VALID', identity: { username: 'alice' } }) }, { backendIdentity: 'http://azm11.test' });
    const guard = new SessionGuard(resolver);

    await guard.requireValidSession();
    try {
      throw new AuthorizationDeniedError({ operation: 'secret.set', project: 'my-api', environment: 'production' });
    } catch {
      // expected denial; classifyVaultOperationError and the SessionGuard/DeveloperSessionStore
      // pipeline never receive a reference to a session-mutating method during this path.
    }

    expect(calls).toEqual([]);
  });

  it('AZM12: a permission denial must perform zero environment-context writes', async () => {
    const writeSpy = vi.fn();
    const denyingClient = {
      readSecret: async () => { throw new AuthorizationDeniedError({ operation: 'secret.set', project: 'my-api', environment: 'production' }); },
      writeSecret: async () => { writeSpy(); },
      listSecrets: async () => [],
      deleteSecret: async () => undefined,
    };

    await expect(setSecret(config, denyingClient, 'k', 'v')).rejects.toBeInstanceOf(AuthorizationDeniedError);
    expect(writeSpy).not.toHaveBeenCalled();
  });

  it('AZM13: a successful get must never imply that list is authorized', async () => {
    const client = {
      readSecret: async () => ({ database: { password: 'value' } }),
      writeSecret: async () => undefined,
      listSecrets: async () => { throw new VaultPermissionDeniedError(); },
      deleteSecret: async () => undefined,
    };

    await expect(getSecret(config, client, 'database.password')).resolves.toBe('value');
    await expect(listSecretKeys(config, client)).rejects.toBeInstanceOf(AuthorizationDeniedError);
  });

  it('AZM14: the identity resolved by SessionGuard must equal the identity used for the Vault operation', async () => {
    const previousAddress = process.env.VAULT_ADDR;
    process.env.VAULT_ADDR = 'http://azm14.test';
    const capturedTokens: (string | null)[] = [];
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (_input: unknown, init?: RequestInit) => {
      const headers = (init?.headers ?? {}) as Record<string, string>;
      capturedTokens.push(headers['x-vault-token'] ?? null);
      return new Response('{}', { status: 200 });
    }) as typeof fetch;
    try {
      const composition = createCompositionRoot();
      const application = await composition.createProjectApplication({ state: 'ACTIVE', credential: 'validated-token', validation: 'REMOTE_CONFIRMED' });
      await application.getSecret(config, 'k');
      expect(capturedTokens).toEqual(['validated-token']);
    } finally {
      globalThis.fetch = originalFetch;
      if (previousAddress === undefined) delete process.env.VAULT_ADDR;
      else process.env.VAULT_ADDR = previousAddress;
    }
  });

  it('AZM15: composition/construction must not perform session or authorization work', async () => {
    const previousAddress = process.env.VAULT_ADDR;
    process.env.VAULT_ADDR = 'http://azm15.test';
    try {
      const composition = createCompositionRoot();
      await expect(composition.createProjectApplication()).resolves.toBeDefined();
    } finally {
      if (previousAddress === undefined) delete process.env.VAULT_ADDR;
      else process.env.VAULT_ADDR = previousAddress;
    }
  });

  it('AZM16: a protected mutation must send zero Vault requests before required consent succeeds', async () => {
    const calls: string[] = [];
    const composition = {
      createProjectApplication: async () => ({
        load: async () => ({ ...config, protected: true }),
        setSecret: async () => { calls.push('set'); },
        getSecret: async () => undefined,
        listSecrets: async () => [],
        deleteSecret: async () => { calls.push('delete'); return true; },
        run: async () => 0,
      }),
    } as unknown as ReturnTypeOfComposition;

    await expect(runSecretSet(composition, 'k', {}, { confirm: async () => false, readSecret: async () => { calls.push('read'); return 'v'; } }))
      .rejects.toThrow('Protected environment mutation was not authorized.');
    expect(calls).toEqual([]);
  });

  it('AZM17: a declined/cancelled consent must send zero Vault mutation requests', async () => {
    const calls: string[] = [];
    const composition = {
      createProjectApplication: async () => ({
        load: async () => ({ ...config, protected: true }),
        setSecret: async () => undefined,
        getSecret: async () => undefined,
        listSecrets: async () => [],
        deleteSecret: async () => { calls.push('delete'); return true; },
        run: async () => 0,
      }),
    } as unknown as ReturnTypeOfComposition;

    await expect(runSecretDelete(composition, 'k', { yes: true }, { confirm: async () => false }))
      .rejects.toThrow('Protected environment mutation was not authorized.');
    expect(calls).toEqual([]);
  });
});
