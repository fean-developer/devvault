import { mkdtemp, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { findProjectConfig, loadProjectConfig, parseProjectConfig } from './index.js';

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
});