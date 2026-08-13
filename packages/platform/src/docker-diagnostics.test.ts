import { describe, expect, it } from 'vitest';
import { diagnoseDocker } from './docker-diagnostics.js';

function executorThatFails(...failedArgs: string[][]) {
  return {
    run: async (_command: string, args: string[]) => {
      if (failedArgs.some((failed) => JSON.stringify(failed) === JSON.stringify(args))) {
        throw new Error('command failed');
      }
      return { stdout: args.includes('inspect') ? 'running\n' : '', stderr: '' };
    },
  };
}

describe('Docker diagnostics', () => {
  it('distinguishes missing CLI, daemon and Compose', async () => {
    await expect(diagnoseDocker(executorThatFails(['--version']))).resolves.toMatchObject({ state: 'cli-unavailable' });
    await expect(diagnoseDocker(executorThatFails(['info']))).resolves.toMatchObject({ state: 'daemon-unavailable' });
    await expect(diagnoseDocker(executorThatFails(['compose', 'version']))).resolves.toMatchObject({ state: 'compose-unavailable' });
  });

  it('reports the Vault container state', async () => {
    await expect(diagnoseDocker(executorThatFails())).resolves.toMatchObject({ state: 'available', vaultContainer: 'running' });
    await expect(diagnoseDocker({ run: async (_command, args) => {
      if (args.includes('inspect')) throw new Error('missing');
      return { stdout: '', stderr: '' };
    } })).resolves.toMatchObject({ vaultContainer: 'missing' });
  });
});