import { describe, expect, it } from 'vitest';
import { resolveRuntimeEnvironment, launchProcess } from './runtime.js';
import { registerRunCommand } from './commands/run.js';
import { Command } from 'commander';
import type { ReturnTypeOfComposition } from './composition-root.js';

const config = {
  version: 1 as const,
  project: 'my-api',
  environment: 'development',
  vault: { mount: 'secret', path: 'projects/my-api/development' },
  runtime: { mappings: { TEST_SECRET: 'database.password' } },
};

describe('runtime', () => {
  it('maps Vault values into a child environment without creating files', async () => {
    const environment = await resolveRuntimeEnvironment(config, {
      readSecret: async () => ({ database: { password: 'hello-devvault' } }),
    }, { EXISTING: 'kept' });

    expect(environment).toEqual({ EXISTING: 'kept', TEST_SECRET: 'hello-devvault' });
  });

  it('fails when a configured mapping is absent', async () => {
    await expect(resolveRuntimeEnvironment(config, {
      readSecret: async () => ({ database: {} }),
    })).rejects.toThrow('Secret not found for environment mapping: TEST_SECRET');
  });

  it('returns the child process exit code', async () => {
    await expect(launchProcess(process.execPath, ['-e', 'process.exit(7)'], process.env))
      .resolves.toBe(7);
  });

  it('rejects when the command does not exist', async () => {
    await expect(launchProcess('__devvault_command_that_does_not_exist__', [], process.env))
      .rejects.toBeInstanceOf(Error);
  });

  it('requires the shared session guard before retrieving secrets or starting a process', async () => {
    const calls: string[] = [];
    const application = {
      load: async () => config,
      run: async () => { calls.push('run'); return 0; },
    };
    const composition = {
      createProjectApplication: async () => application,
      requireValidSession: async () => { calls.push('session'); },
    } as unknown as ReturnTypeOfComposition;
    const program = new Command().exitOverride();
    registerRunCommand(program, composition);

    await program.parseAsync(['node', 'devvault', 'run', '--', process.execPath, '-e', 'process.exit(0)']);

    expect(calls).toEqual(['session', 'run']);
  });

  it('blocks process execution when the shared session guard rejects', async () => {
    const calls: string[] = [];
    const application = {
      load: async () => config,
      run: async () => { calls.push('run'); return 0; },
    };
    const composition = {
      createProjectApplication: async () => application,
      requireValidSession: async () => { throw new Error('SESSION_EXPIRED'); },
    } as unknown as ReturnTypeOfComposition;
    const program = new Command().exitOverride();
    registerRunCommand(program, composition);

    await expect(program.parseAsync(['node', 'devvault', 'run', '--', process.execPath])).rejects.toThrow('SESSION_EXPIRED');
    expect(calls).toEqual([]);
  });
});