import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompositionRoot, loadProjectContext } from './composition-root.js';
import { AuthorizationDeniedError, CredentialStore, SessionGuard, SessionResolver } from '@devvault/core';
import { CredentialStoreDeveloperSessionStore } from '@devvault/auth';
import { setActiveEnvironment } from '@devvault/config';

describe('composition root', () => {
  it('exposes the lifecycle service through the application boundary', () => {
    const composition = createCompositionRoot();

    expect(composition.lifecycleService).toBeDefined();
    expect(typeof composition.lifecycleService.start).toBe('function');
    expect(typeof composition.lifecycleService.status).toBe('function');
  });

  it('uses the shared resolver and returns no project context until configuration is valid', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-composition-context-'));
    await mkdir(join(root, '.devvault'), { recursive: true });
    await writeFile(join(root, '.devvault/context.json'), '{"environment":"staging"}\n');
    await expect(loadProjectContext(root)).resolves.toBeNull();

    await mkdir(join(root, 'environments', 'staging'), { recursive: true });
    await writeFile(join(root, 'environments', 'staging', 'devvault.yaml'), [
      'version: 1', 'project: my-api', 'environment: staging', 'vault:', '  mount: secret', '  path: projects/my-api/staging', 'runtime:', '  mappings: {}',
    ].join('\n'));
    const resolverCalls: string[] = [];
    await expect(loadProjectContext(root, async (directory, environment, options) => {
      resolverCalls.push(`${directory}:${environment ?? 'active'}:${options?.mode ?? 'required'}`);
      return {
        projectRoot: root,
        environment: 'staging',
        state: 'CONFIGURED',
        configPath: join(root, 'environments/staging/devvault.yaml'),
        config: {
          version: 1,
          project: 'my-api',
          environment: 'staging',
          vault: { mount: 'secret', path: 'projects/my-api/staging' },
          runtime: { mappings: {} },
        },
      };
    })).resolves.toEqual({ name: 'my-api', environment: 'staging' });
    expect(resolverCalls).toEqual([`${root}:active:diagnostic`]);

    await writeFile(join(root, 'environments', 'staging', 'devvault.yaml'), 'version: 1\nproject: wrong\n');
    await expect(loadProjectContext(root)).resolves.toBeNull();
  });

  it('exposes session guard and diagnostics without treating VAULT_TOKEN as a developer session', async () => {
    const previous = process.env.VAULT_TOKEN;
    const previousAddress = process.env.VAULT_ADDR;
    process.env.VAULT_TOKEN = 'administrative-token';
    process.env.VAULT_ADDR = 'http://session-source-isolation.test';
    try {
      const composition = createCompositionRoot();
      expect(composition.requireValidSession).toBeDefined();
      expect(composition.sessionDiagnostics).toBeDefined();
      const session = await composition.sessionDiagnostics?.observe();
      expect(session?.state).not.toBe('ACTIVE');
    } finally {
      if (previous === undefined) delete process.env.VAULT_TOKEN;
      else process.env.VAULT_TOKEN = previous;
      if (previousAddress === undefined) delete process.env.VAULT_ADDR;
      else process.env.VAULT_ADDR = previousAddress;
    }
  });

  it('constructs project applications without requiring a developer session', async () => {
    const previousAddress = process.env.VAULT_ADDR;
    process.env.VAULT_ADDR = 'http://composition-boundary.test';
    try {
      const composition = createCompositionRoot();
      await expect(composition.createProjectApplication()).resolves.toBeDefined();
    } finally {
      if (previousAddress === undefined) delete process.env.VAULT_ADDR;
      else process.env.VAULT_ADDR = previousAddress;
    }
  });

  it('uses only the validated session credential as the Vault token, never VAULT_TOKEN (AZM3/AZM4/AZM14)', async () => {
    const previousToken = process.env.VAULT_TOKEN;
    const previousAddress = process.env.VAULT_ADDR;
    process.env.VAULT_TOKEN = 'administrative-token';
    process.env.VAULT_ADDR = 'http://composition-credential-isolation.test';
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
      const config = {
        version: 1 as const,
        project: 'my-api',
        environment: 'development',
        vault: { mount: 'secret', path: 'projects/my-api/development' },
        runtime: { mappings: {} },
      };

      await expect(application.getSecret(config, 'database.password')).rejects.toBeInstanceOf(AuthorizationDeniedError);

      expect(capturedTokens.length).toBeGreaterThan(0);
      expect(capturedTokens).toContain('session-credential');
      expect(capturedTokens).not.toContain('administrative-token');
      expect(capturedTokens.every((token) => token === 'session-credential')).toBe(true);
    } finally {
      globalThis.fetch = originalFetch;
      if (previousToken === undefined) delete process.env.VAULT_TOKEN;
      else process.env.VAULT_TOKEN = previousToken;
      if (previousAddress === undefined) delete process.env.VAULT_ADDR;
      else process.env.VAULT_ADDR = previousAddress;
    }
  });

  it('performs zero developer session store writes/deletes when an operation is denied (AZM11)', async () => {
    const calls: string[] = [];
    const recordingStore: CredentialStore = {
      get: async (key) => { calls.push(`get:${key}`); return 'stored-token'; },
      set: async (key) => { calls.push(`set:${key}`); },
      delete: async (key) => { calls.push(`delete:${key}`); },
    };
    const sessionStore = new CredentialStoreDeveloperSessionStore(recordingStore, 'session', 'http://azm11.test');
    const resolver = new SessionResolver(sessionStore, { validate: async () => ({ outcome: 'VALID', identity: { username: 'alice' } }) }, { backendIdentity: 'http://azm11.test' });
    const guard = new SessionGuard(resolver);

    const session = await guard.requireValidSession();
    try {
      throw new AuthorizationDeniedError({ operation: 'secret.set', project: 'my-api', environment: 'production' });
    } catch (error) {
      expect(error).toBeInstanceOf(AuthorizationDeniedError);
    }

    expect(session.state).toBe('ACTIVE');
    expect(calls.filter((call) => call.startsWith('set:') || call.startsWith('delete:'))).toEqual([]);
  });

  it('performs zero environment-context writes when a protected secret set is denied (AZM12)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-composition-env-immutability-'));
    await mkdir(join(root, 'environments', 'production'), { recursive: true });
    await writeFile(join(root, 'environments', 'production', 'devvault.yaml'), [
      'version: 1', 'project: my-api', 'environment: production', 'protected: true', 'vault:', '  mount: secret', '  path: projects/my-api/production', 'runtime:', '  mappings: {}',
    ].join('\n'));
    await setActiveEnvironment(root, 'production');
    const before = await readFile(join(root, '.devvault/context.json'), 'utf8');

    const config = {
      version: 1 as const,
      project: 'my-api',
      protected: true,
      environment: 'production',
      vault: { mount: 'secret', path: 'projects/my-api/production' },
      runtime: { mappings: {} },
    };
    const denyingClient = {
      readSecret: async () => { throw new AuthorizationDeniedError({ operation: 'secret.set', project: 'my-api', environment: 'production' }); },
      writeSecret: async () => undefined,
      listSecrets: async () => [],
      deleteSecret: async () => undefined,
    };
    const { setSecret } = await import('./secrets.js');

    await expect(setSecret(config, denyingClient, 'database.password', 'value')).rejects.toBeInstanceOf(AuthorizationDeniedError);

    const after = await readFile(join(root, '.devvault/context.json'), 'utf8');
    expect(after).toBe(before);
  });
});