import { describe, expect, it } from 'vitest';
import { resolveRuntimeEnvironment, launchProcess } from './runtime.js';

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
});