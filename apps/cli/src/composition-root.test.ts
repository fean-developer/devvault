import { describe, expect, it } from 'vitest';
import { mkdir, mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { createCompositionRoot, loadProjectContext } from './composition-root.js';

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
});