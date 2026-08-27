import { mkdir, mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runInitProject } from './project.js';
import type { ReturnTypeOfComposition } from '../composition-root.js';

function composition(): ReturnTypeOfComposition {
  return { createVaultClient: async () => { throw new Error('Vault must not be used by this test.'); } } as ReturnTypeOfComposition;
}

describe('init-project command', () => {
  it('creates the active environment configuration from a pre-init context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-init-active-'));
    await mkdir(join(root, '.devvault'), { recursive: true });
    await writeFile(join(root, '.devvault/context.json'), '{"environment":"development"}\n');

    await runInitProject(composition(), root);

    await expect(readFile(join(root, 'environments', 'development', 'devvault.yaml'), 'utf8')).resolves.toContain('environment: development');
  });

  it('uses an explicit override without changing the active context', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-init-override-'));
    await mkdir(join(root, '.devvault'), { recursive: true });
    await writeFile(join(root, '.devvault/context.json'), '{"environment":"development"}\n');

    await runInitProject(composition(), root, { environment: 'production' });

    await expect(readFile(join(root, 'environments', 'production', 'devvault.yaml'), 'utf8')).resolves.toContain('environment: production');
    await expect(readFile(join(root, '.devvault/context.json'), 'utf8')).resolves.toContain('development');
  });

  it('rejects an existing target and force preserves another environment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-init-force-'));
    await mkdir(join(root, '.devvault'), { recursive: true });
    await writeFile(join(root, '.devvault/context.json'), '{"environment":"development"}\n');
    await runInitProject(composition(), root, { environment: 'production' });
    const production = await readFile(join(root, 'environments', 'production', 'devvault.yaml'), 'utf8');

    await expect(runInitProject(composition(), root, { environment: 'production' })).rejects.toThrow('already exists');
    await runInitProject(composition(), root, { environment: 'development' });
    await runInitProject(composition(), root, { environment: 'development', force: true });

    await expect(readFile(join(root, 'environments', 'production', 'devvault.yaml'), 'utf8')).resolves.toBe(production);
  });

  it('requires an active or explicit environment', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-init-no-env-'));

    await expect(runInitProject(composition(), root)).rejects.toThrow('No environment selected');
  });
});