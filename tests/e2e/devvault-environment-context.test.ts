import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';

const execFileAsync = promisify(execFile);

async function runCli(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return execFileAsync(process.execPath, [join(process.cwd(), 'apps/cli/dist/index.js'), ...args], {
    cwd,
    env: { ...process.env, ...env },
  });
}

function startVaultStub() {
  let requests = 0;
  const server = createServer((socket) => {
    socket.once('data', (data) => {
      requests += 1;
      const requestLine = data.toString('utf8').split('\r\n', 1)[0] ?? '';
      const response = requestLine.includes('/metadata/')
        ? JSON.stringify({ data: { keys: ['database'] } })
        : '{}';
      const status = requestLine.includes('/metadata/') ? '200 OK' : '404 Not Found';
      socket.end(`HTTP/1.1 ${status}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(response)}\r\nConnection: close\r\n\r\n${response}`);
    });
  });
  return new Promise<{ address: string; requests: () => number; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Vault stub did not bind to a TCP port.');
      resolve({
        address: `http://127.0.0.1:${address.port}`,
        requests: () => requests,
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

describe('real CLI environment context flow', () => {
  it('runs first-time selection, initialization, switching and explicit override', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-real-context-'));
    const vault = await startVaultStub();
    try {
      await expect(runCli(root, ['environment', 'set', 'development'])).resolves.toMatchObject({ stdout: expect.stringContaining('State: SELECTED') });
      await expect(runCli(root, ['init-project'])).resolves.toMatchObject({ stdout: expect.stringContaining('environments/development/devvault.yaml') });
      await expect(runCli(root, ['environment', 'current'])).resolves.toMatchObject({ stdout: expect.stringContaining('State: CONFIGURED') });
      await expect(runCli(root, ['environment', 'list'])).resolves.toMatchObject({ stdout: expect.stringContaining('development CONFIGURED ACTIVE') });
      await expect(runCli(root, ['secret', 'list'], { VAULT_ADDR: vault.address })).resolves.toMatchObject({ stdout: 'database\n' });

      await expect(runCli(root, ['environment', 'set', 'production'])).resolves.toMatchObject({ stdout: expect.stringContaining('State: SELECTED') });
      await expect(runCli(root, ['init-project'])).resolves.toMatchObject({ stdout: expect.stringContaining('environments/production/devvault.yaml') });
      await expect(runCli(root, ['secret', 'list'], { VAULT_ADDR: vault.address })).resolves.toMatchObject({ stdout: 'database\n' });
      await expect(runCli(root, ['secret', 'list', '--environment', 'development'], { VAULT_ADDR: vault.address })).resolves.toMatchObject({ stdout: 'database\n' });
      await expect(readFile(join(root, '.devvault/context.json'), 'utf8')).resolves.toContain('production');
      expect(vault.requests()).toBe(3);
    } finally {
      await vault.close();
    }
  });

  it('blocks selected-only secret access before contacting Vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-real-selected-'));
    const vault = await startVaultStub();
    try {
      await runCli(root, ['environment', 'set', 'staging']);
      await expect(runCli(root, ['secret', 'list'], { VAULT_ADDR: vault.address })).rejects.toMatchObject({
        stderr: expect.stringContaining("Environment 'staging' is selected but not configured"),
      });
      expect(vault.requests()).toBe(0);
    } finally {
      await vault.close();
    }
  });
});
