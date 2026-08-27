import { mkdir, mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { runEnvironmentCurrent, runEnvironmentList, runEnvironmentSet } from './environment.js';

describe('environment commands', () => {
  it('selects an unconfigured environment before init-project without Vault access', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-environment-command-'));
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runEnvironmentSet('development', root);

    expect(await readFile(join(root, '.devvault/context.json'), 'utf8')).toContain('development');
    expect(write.mock.calls.flat().join('')).toContain('State: SELECTED');
    write.mockRestore();
  });

  it('reports selected and configured states without querying Vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-environment-state-'));
    await runEnvironmentSet('staging', root);
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runEnvironmentCurrent(root);
    expect(write.mock.calls.flat().join('')).toContain('State: SELECTED');
    write.mockRestore();
  });

  it('does not create a nested context below an established project', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-environment-ancestor-'));
    const nested = join(root, 'src', 'api');
    await mkdir(join(root, 'environments', 'development'), { recursive: true });
    await mkdir(nested, { recursive: true });

    await runEnvironmentSet('development', nested);

    await expect(readFile(join(root, '.devvault/context.json'), 'utf8')).resolves.toContain('development');
    await expect(readFile(join(nested, '.devvault/context.json'), 'utf8')).rejects.toThrow();
  });

  it('lists a selected environment that is not configured', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-environment-list-'));
    await runEnvironmentSet('staging', root);
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);

    await runEnvironmentList(root);

    expect(write.mock.calls.flat().join('')).toContain('staging SELECTED NOT_CONFIGURED ACTIVE');
    write.mockRestore();
  });
});