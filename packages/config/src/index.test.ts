import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { classifyEnvironmentContext, findProjectConfig, findProjectRoot, loadProjectConfig, parseProjectConfig, resolveEnvironmentContext, resolveProjectConfig, setActiveEnvironment } from './index.js';

describe('projectConfigSchema', () => {
  it('classifies environment context independently from Vault lifecycle', () => {
    const config = parseProjectConfig({
      version: 1,
      project: 'my-api',
      environment: 'development',
      vault: { mount: 'secret', path: 'projects/my-api/development' },
      runtime: { mappings: {} },
    });

    expect(classifyEnvironmentContext({})).toBe('NOT_SELECTED');
    expect(classifyEnvironmentContext({ selectedEnvironment: 'development' })).toBe('SELECTED');
    expect(classifyEnvironmentContext({ selectedEnvironment: 'development', config })).toBe('CONFIGURED');
    expect(classifyEnvironmentContext({ selectedEnvironment: 'development', invalid: true })).toBe('INVALID');
  });

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

  it('rejects corrupted active context instead of selecting a guessed environment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-context-corrupt-'));
    await mkdir(join(root, 'environments', 'development'), { recursive: true });
    await writeFile(join(root, 'environments', 'development', 'devvault.yaml'), [
      'version: 1', 'project: my-api', 'environment: development', 'vault:', '  mount: secret', '  path: projects/my-api/development', 'runtime:', '  mappings: {}',
    ].join('\n'));
    await mkdir(join(root, '.devvault'), { recursive: true });
    await writeFile(join(root, '.devvault/context.json'), '{"environment":"development","token":"must-not-be-accepted"}\n');

    await expect(resolveProjectConfig(root)).rejects.toThrow('Active environment context is invalid.');
  });

  it('writes only the strict context schema and leaves no temporary context file', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-context-write-'));

    await setActiveEnvironment(root, 'development');

    await expect(readFile(join(root, '.devvault/context.json'), 'utf8')).resolves.toBe('{\n  "environment": "development"\n}\n');
    await expect(readFile(join(root, '.devvault/context.json.tmp'), 'utf8')).rejects.toThrow();
  });

  it('adds the context directory to gitignore idempotently', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-gitignore-'));

    await setActiveEnvironment(root, 'development');
    await setActiveEnvironment(root, 'production');

    const contents = await readFile(join(root, '.gitignore'), 'utf8');
    expect(contents.split(/\r?\n/).filter((line) => line === '.devvault/')).toHaveLength(1);
  });

  it('returns selected context without configuration in diagnostic mode', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-selected-'));
    await setActiveEnvironment(root, 'staging');

    await expect(resolveEnvironmentContext(root, undefined, { mode: 'diagnostic' })).resolves.toMatchObject({
      environment: 'staging',
      state: 'SELECTED',
    });
  });

  it('fails selected-only context before configuration-required access', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-selected-required-'));
    await setActiveEnvironment(root, 'staging');

    await expect(resolveProjectConfig(root)).rejects.toMatchObject({ code: 'ENVIRONMENT_NOT_CONFIGURED' });
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

    const resolved = await resolveProjectConfig(root, 'production');
    expect(resolved.environment).toBe('production');
    expect(resolved.config.vault.path).toBe('projects/my-api/production');
    await expect(readFile(join(root, '.devvault/context.json'), 'utf8')).resolves.toContain('development');
  });

  it('keeps the new model explicit when legacy and multi-environment files coexist', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-coexistence-'));
    await writeFile(join(root, 'devvault.yaml'), [
      'version: 1', 'project: legacy-api', 'environment: development', 'vault:', '  mount: secret', '  path: projects/legacy-api/development', 'runtime:', '  mappings: {}',
    ].join('\n'));
    await mkdir(join(root, 'environments', 'production'), { recursive: true });
    await writeFile(join(root, 'environments', 'production', 'devvault.yaml'), [
      'version: 1', 'project: modern-api', 'environment: production', 'vault:', '  mount: secret', '  path: projects/modern-api/production', 'runtime:', '  mappings: {}',
    ].join('\n'));
    await setActiveEnvironment(root, 'production');

    await expect(resolveProjectConfig(root)).resolves.toMatchObject({
      environment: 'production',
      config: { project: 'modern-api' },
    });
  });

  it('fails without explicit or active environment in the new model', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-no-environment-'));
    await mkdir(join(root, 'environments', 'production'), { recursive: true });
    await writeFile(join(root, 'environments', 'production', 'devvault.yaml'), [
      'version: 1', 'project: my-api', 'environment: production', 'vault:', '  mount: secret', '  path: projects/my-api/production', 'runtime:', '  mappings: {}',
    ].join('\n'));

    await expect(resolveProjectConfig(root)).rejects.toThrow('No environment selected.');
  });

  it('loads legacy configuration without merging it with a new model', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-legacy-'));
    await writeFile(join(root, 'devvault.yaml'), [
      'version: 1', 'project: legacy-api', 'environment: development', 'vault:', '  mount: secret', '  path: projects/legacy-api/development', 'runtime:', '  mappings: {}',
    ].join('\n'));

    await expect(resolveProjectConfig(root)).resolves.toMatchObject({
      environment: 'development',
      config: { project: 'legacy-api' },
    });
  });

  it('rejects explicit alternate environments for legacy configuration', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-legacy-explicit-'));
    await writeFile(join(root, 'devvault.yaml'), [
      'version: 1', 'project: legacy-api', 'environment: development', 'vault:', '  mount: secret', '  path: projects/legacy-api/development', 'runtime:', '  mappings: {}',
    ].join('\n'));

    await expect(resolveProjectConfig(root, 'production')).rejects.toMatchObject({ code: 'ENVIRONMENT_INVALID' });
  });
});