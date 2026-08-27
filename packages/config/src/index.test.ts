import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findProjectConfig, findProjectRoot, loadProjectConfig, parseProjectConfig, resolveProjectConfig, setActiveEnvironment } from './index.js';

describe('projectConfigSchema', () => {
  it('accepts non-sensitive project configuration', () => {
    expect(
      parseProjectConfig({
        version: 1,
        project: 'my-api',
        environment: 'development',
        vault: { mount: 'secret', path: 'projects/my-api/development' },
        runtime: { mappings: { DATABASE_URL: 'database.url' } },
      }).project,
    ).toBe('my-api');
  });

  it('rejects an invalid project name', () => {
    expect(() =>
      parseProjectConfig({
        version: 1,
        project: 'My API',
        environment: 'development',
        vault: { mount: 'secret', path: 'projects/my-api/development' },
        runtime: { mappings: {} },
      }),
    ).toThrow();
  });

  it('rejects secret-like fields in the project file', () => {
    expect(() =>
      parseProjectConfig({
        version: 1,
        project: 'my-api',
        environment: 'development',
        token: 'vault-token',
        vault: { mount: 'secret', path: 'projects/my-api/development' },
        runtime: { mappings: {} },
      }),
    ).toThrow();
  });

  it('rejects literal values instead of secret references', () => {
    expect(() =>
      parseProjectConfig({
        version: 1,
        project: 'my-api',
        environment: 'development',
        vault: { mount: 'secret', path: 'projects/my-api/development' },
        runtime: { mappings: { DATABASE_PASSWORD: '123456' } },
      }),
    ).toThrow();
  });

  it('rejects a Vault path that points to another project', () => {
    expect(() => parseProjectConfig({
      version: 1,
      project: 'my-api',
      environment: 'development',
      vault: { mount: 'secret', path: 'projects/other-api/development' },
      runtime: { mappings: {} },
    })).toThrow('Vault path must be projects/my-api/development.');
  });

  it('finds and loads configuration from a parent directory', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-config-'));
    const nested = join(root, 'src', 'feature');
    await writeFile(
      join(root, 'devvault.yaml'),
      [
        'version: 1',
        'project: my-api',
        'environment: development',
        'vault:',
        '  mount: secret',
        '  path: projects/my-api/development',
        'runtime:',
        '  mappings:',
        '    DATABASE_URL: database.url',
      ].join('\n'),
    );

    await expect(findProjectConfig(nested)).resolves.toBe(join(root, 'devvault.yaml'));
    await expect(loadProjectConfig(nested)).resolves.toMatchObject({ project: 'my-api' });
  });

  it('fails with a safe message when configuration is absent', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devvault-empty-'));

    await expect(findProjectConfig(directory)).rejects.toThrow('Could not find devvault.yaml');
  });

  it('uses the current directory as a candidate root only when explicitly allowed', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devvault-candidate-'));

    await expect(findProjectRoot(directory)).rejects.toThrow('Could not find devvault.yaml');
    await expect(findProjectRoot(directory, true)).resolves.toBe(directory);
  });

  it('prefers an established DevVault ancestor over a nested candidate root', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-ancestor-'));
    const nested = join(root, 'src', 'api');
    await mkdir(join(root, 'environments'), { recursive: true });
    await mkdir(nested, { recursive: true });

    await expect(findProjectRoot(nested, true)).resolves.toBe(root);
  });

  it('rejects an ambiguous nested project root before persistence', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-ambiguous-'));
    const nested = join(root, 'nested');
    await mkdir(join(root, 'environments'), { recursive: true });
    await mkdir(join(nested, 'environments'), { recursive: true });

    await expect(findProjectRoot(nested, true)).rejects.toThrow('Project root is ambiguous');
  });

  it('resolves explicit environment before active context without changing context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-environments-'));
    for (const environment of ['development', 'production']) {
      await mkdir(join(root, 'environments', environment), { recursive: true });
      await writeFile(join(root, 'environments', environment, 'devvault.yaml'), [
        'version: 1', 'project: my-api', `environment: ${environment}`, 'vault:', '  mount: secret', `  path: projects/my-api/${environment}`, 'runtime:', '  mappings: {}',
      ].join('\n'));
    }
    await setActiveEnvironment(root, 'development');

    await expect(resolveProjectConfig(root, 'production')).resolves.toMatchObject({ environment: 'production' });
    await expect(readFile(join(root, '.devvault/context.json'), 'utf8')).resolves.toContain('development');
  });

  it('fails without explicit or active environment in the new model', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-no-environment-'));
    await mkdir(join(root, 'environments', 'production'), { recursive: true });
    await writeFile(join(root, 'environments', 'production', 'devvault.yaml'), [
      'version: 1', 'project: my-api', 'environment: production', 'vault:', '  mount: secret', '  path: projects/my-api/production', 'runtime:', '  mappings: {}',
    ].join('\n'));

    await expect(resolveProjectConfig(root)).rejects.toThrow('No environment selected.');
  });
});