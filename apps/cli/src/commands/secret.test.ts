import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { registerSecretCommand } from './secret.js';
import type { ReturnTypeOfComposition } from '../composition-root.js';

function composition(config: { protected?: boolean }, calls: string[] = []): ReturnTypeOfComposition {
  const application = {
    load: async () => ({ ...config, environment: 'production' }),
    setSecret: async () => { calls.push('set'); },
    getSecret: async () => 'value',
    listSecrets: async () => ['database'],
    deleteSecret: async () => { calls.push('delete'); return true; },
    run: async () => 0,
  };
  return { createProjectApplication: async () => application } as unknown as ReturnTypeOfComposition;
}

describe('secret command protected environment behavior', () => {
  it('allows protected read operations without mutation confirmation', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command().exitOverride();
    registerSecretCommand(program, composition({ protected: true }));

    await program.parseAsync(['node', 'devvault', 'secret', 'list']);

    expect(write.mock.calls.flat().join('')).toBe('database\n');
    write.mockRestore();
  });

  it('allows protected get without mutation confirmation', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command().exitOverride();
    registerSecretCommand(program, composition({ protected: true }));

    await program.parseAsync(['node', 'devvault', 'secret', 'get', 'database.password']);

    expect(write.mock.calls.flat().join('')).toBe('Secret exists. Use --show to display it.\n');
    write.mockRestore();
  });

  it('requires explicit confirmation for protected deletion', async () => {
    const calls: string[] = [];
    const program = new Command().exitOverride();
    registerSecretCommand(program, composition({ protected: true }, calls));

    await expect(program.parseAsync(['node', 'devvault', 'secret', 'delete', 'database.password']))
      .rejects.toThrow('Deletion requires --yes.');
    expect(calls).toEqual([]);
  });

  it('allows protected deletion only with --yes', async () => {
    const calls: string[] = [];
    const program = new Command().exitOverride();
    registerSecretCommand(program, composition({ protected: true }, calls));

    await program.parseAsync(['node', 'devvault', 'secret', 'delete', 'database.password', '--yes']);

    expect(calls).toEqual(['delete']);
  });
});
