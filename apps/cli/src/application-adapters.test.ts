import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createProjectApplicationService } from './application-adapters.js';
import { HttpVaultClient } from '@devvault/vault-client';
import { setActiveEnvironment } from '@devvault/config';

function client(calls: string[]): HttpVaultClient {
  return new HttpVaultClient({
    address: 'http://vault',
    fetchImpl: async () => {
      calls.push('vault');
      return new Response('{}', { status: 200 });
    },
  });
}

async function configuredProject(): Promise<string> {
  const root = await mkdtemp(join(tmpdir(), 'devvault-adapter-'));
  await mkdir(join(root, 'environments', 'development'), { recursive: true });
  await writeFile(join(root, 'environments', 'development', 'devvault.yaml'), [
    'version: 1',
    'project: my-api',
    'environment: development',
    'vault:',
    '  mount: secret',
    '  path: projects/my-api/development',
    'runtime:',
    '  mappings: {}',
  ].join('\n'));
  return root;
}

describe('project application environment guard', () => {
  it.each([
    ['not selected', async () => mkdtemp(join(tmpdir(), 'devvault-not-selected-'))],
    ['selected', async () => {
      const root = await mkdtemp(join(tmpdir(), 'devvault-selected-'));
      await mkdir(join(root, '.devvault'), { recursive: true });
      await writeFile(join(root, '.devvault/context.json'), '{"environment":"staging"}\n');
      return root;
    }],
    ['invalid', async () => {
      const root = await configuredProject();
      await writeFile(join(root, 'environments', 'development', 'devvault.yaml'), 'version: 1\nproject: wrong\n');
      return root;
    }],
  ])('blocks %s context before ProjectApplicationService operations or Vault', async (_state, rootFactory) => {
    const calls: string[] = [];
    const application = createProjectApplicationService(client(calls));

    await expect(application.load(await rootFactory())).rejects.toThrow();
    expect(calls).toEqual([]);
  });

  it('passes configured context as ProjectConfig without calling Vault during resolution', async () => {
    const calls: string[] = [];
    const application = createProjectApplicationService(client(calls));
    const root = await configuredProject();
    await setActiveEnvironment(root, 'development');

    await expect(application.load(root)).resolves.toMatchObject({
      project: 'my-api',
      environment: 'development',
    });
    expect(calls).toEqual([]);
  });

  it('resolves the same active context for secret and runtime application paths', async () => {
    const root = await configuredProject();
    await setActiveEnvironment(root, 'development');
    const application = createProjectApplicationService(client([]));

    await expect(application.load(root)).resolves.toMatchObject({ environment: 'development' });
    await expect(application.load(root, 'development')).resolves.toMatchObject({ environment: 'development' });
    await expect(application.load(root, 'production')).rejects.toMatchObject({ code: 'ENVIRONMENT_NOT_CONFIGURED' });
    await expect(readFile(join(root, '.devvault/context.json'), 'utf8')).resolves.toContain('development');
  });
});