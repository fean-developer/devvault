import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
import { promisify } from 'node:util';
import { describe, expect, it } from 'vitest';
import { KeytarCredentialStore } from '../../packages/platform/src/index.js';

const execFileAsync = promisify(execFile);
const CLI_ENTRYPOINT = join(process.cwd(), 'apps/cli/dist/index.js');

async function runCli(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  return execFileAsync(process.execPath, [CLI_ENTRYPOINT, ...args], { cwd, env: { ...process.env, ...env } });
}

async function runDiagnosticCli(cwd: string, args: string[], env: NodeJS.ProcessEnv = {}) {
  try {
    return await runCli(cwd, args, env);
  } catch (error) {
    return error as { stdout: string; stderr: string };
  }
}

function runCliWithInput(cwd: string, args: string[], env: NodeJS.ProcessEnv, stdin: string): Promise<{ stdout: string; stderr: string; code: number | null }> {
  return new Promise((resolve, reject) => {
    const child = execFile(process.execPath, [CLI_ENTRYPOINT, ...args], { cwd, env: { ...process.env, ...env } }, (error, stdout, stderr) => {
      if (error && (error as NodeJS.ErrnoException).code === undefined && !('code' in error)) {
        reject(error);
        return;
      }
      resolve({ stdout, stderr, code: (error as { code?: number } | null)?.code ?? 0 });
    });
    child.stdin?.end(stdin);
  });
}

type DenyRule = (method: string, path: string) => boolean;

function startVaultStub(deny: DenyRule = () => false) {
  let requestCount = 0;
  let mutationCount = 0;
  const tokens: string[] = [];
  const server = createServer((socket) => {
    socket.once('data', (data) => {
      requestCount += 1;
      const text = data.toString('utf8');
      const token = text.match(/x-vault-token:\s*([^\r\n]+)/i)?.[1]?.trim();
      if (token) tokens.push(token);
      const requestLine = text.split('\r\n', 1)[0] ?? '';
      const [method = '', path = ''] = requestLine.split(' ');
      if (method === 'POST' && path.includes('/data/')) mutationCount += 1;

      let status = '200 OK';
      let body = '{}';
      if (path.includes('/auth/token/lookup-self')) {
        body = JSON.stringify({ auth: { expire_time: '2026-08-28T01:00:00Z' } });
      } else if (path.includes('/sys/health')) {
        body = JSON.stringify({ initialized: true, sealed: false });
      } else if (deny(method, path)) {
        status = '403 Forbidden';
      } else if (path.includes('/metadata/')) {
        body = JSON.stringify({ data: { keys: ['database'] } });
      } else if (path.includes('/data/')) {
        body = JSON.stringify({ data: { data: { database: { username: 'dev-user', password: 'dev-password-marker' } } } });
      }
      socket.end(`HTTP/1.1 ${status}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(body)}\r\nConnection: close\r\n\r\n${body}`);
    });
  });
  return new Promise<{ address: string; requests: () => number; mutations: () => number; tokens: () => string[]; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Vault stub did not bind to a TCP port.');
      resolve({
        address: `http://127.0.0.1:${address.port}`,
        requests: () => requestCount,
        mutations: () => mutationCount,
        tokens: () => [...tokens],
        close: () => new Promise((done) => server.close(() => done())),
      });
    });
  });
}

async function seedDeveloperSession(address: string): Promise<() => Promise<void>> {
  const store = new KeytarCredentialStore();
  const key = `session:${encodeURIComponent(address)}`;
  await store.set(key, JSON.stringify({ token: 'e2e-developer-token', username: 'e2e-user', authMount: 'userpass' }));
  return () => store.delete(key);
}

async function initProject(root: string, environment: string, protectedEnvironment = false): Promise<string> {
  await runCli(root, ['environment', 'set', environment]);
  await runCli(root, ['init-project']);
  const project = basename(root).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (protectedEnvironment) {
    const configPath = join(root, 'environments', environment, 'devvault.yaml');
    const content = await readFile(configPath, 'utf8');
    await writeFile(configPath, content.replace(/^protected: false$/m, 'protected: true'));
  }
  return project;
}

describe('Production Authorization E2E flows', () => {
  it('allows a secret get when Vault authorizes the read', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-authz-get-allowed-'));
    const vault = await startVaultStub();
    const clearSession = await seedDeveloperSession(vault.address);
    try {
      await initProject(root, 'development');
      await expect(runCli(root, ['secret', 'get', 'database.password', '--show'], { VAULT_ADDR: vault.address }))
        .resolves.toMatchObject({ stdout: 'dev-password-marker\n' });
    } finally {
      await clearSession();
      await vault.close();
    }
  });

  it('denies a secret get with a safe permission-denied message and no VAULT_TOKEN fallback', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-authz-get-denied-'));
    const vault = await startVaultStub((method, path) => method === 'GET' && path.includes('/data/'));
    const clearSession = await seedDeveloperSession(vault.address);
    try {
      await initProject(root, 'development');
      const result = await runDiagnosticCli(root, ['secret', 'get', 'database.password', '--show'], { VAULT_ADDR: vault.address, VAULT_TOKEN: 'administrative-token' });

      expect(result.stderr).toMatch(/permission denied/i);
      expect(result.stderr.toLowerCase()).not.toMatch(/expired|login required|devvault start/);
      expect(vault.tokens()).toContain('e2e-developer-token');
      expect(vault.tokens()).not.toContain('administrative-token');
    } finally {
      await clearSession();
      await vault.close();
    }
  });

  it('denies secret list independently of a successful get (AZM13)', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-authz-list-denied-'));
    const vault = await startVaultStub((method, path) => method === 'LIST' && path.includes('/metadata/'));
    const clearSession = await seedDeveloperSession(vault.address);
    try {
      await initProject(root, 'development');
      await expect(runCli(root, ['secret', 'get', 'database.password', '--show'], { VAULT_ADDR: vault.address }))
        .resolves.toMatchObject({ stdout: 'dev-password-marker\n' });

      const result = await runDiagnosticCli(root, ['secret', 'list'], { VAULT_ADDR: vault.address });
      expect(result.stderr).toMatch(/permission denied/i);
    } finally {
      await clearSession();
      await vault.close();
    }
  });

  it('sends zero Vault mutation requests when protected secret set consent is declined', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-authz-set-decline-'));
    const vault = await startVaultStub();
    const clearSession = await seedDeveloperSession(vault.address);
    try {
      await initProject(root, 'development', true);
      const requestsBeforeSet = vault.mutations();

      const result = await runCliWithInput(root, ['secret', 'set', 'database.password'], { VAULT_ADDR: vault.address }, 'n\n');
      expect(result.stderr).toMatch(/protected environment mutation was not authorized/i);
      expect(vault.mutations()).toBe(requestsBeforeSet);
    } finally {
      await clearSession();
      await vault.close();
    }
  });

  it('reports permission denied when an accepted protected set is subsequently denied by Vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-authz-set-denied-'));
    const vault = await startVaultStub((method, path) => method === 'POST' && path.includes('/data/'));
    const clearSession = await seedDeveloperSession(vault.address);
    try {
      await initProject(root, 'development', true);
      const result = await runCliWithInput(root, ['secret', 'set', 'database.password', '--yes'], { VAULT_ADDR: vault.address }, 'value\n');
      expect(result.stderr).toMatch(/permission denied/i);
      expect(result.stderr.toLowerCase()).not.toMatch(/expired|login required/);
    } finally {
      await clearSession();
      await vault.close();
    }
  });

  it('sends zero Vault mutation requests when protected secret delete consent is declined', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-authz-delete-decline-'));
    const vault = await startVaultStub();
    const clearSession = await seedDeveloperSession(vault.address);
    try {
      await initProject(root, 'development', true);
      const requestsBeforeDelete = vault.mutations();

      const result = await runCliWithInput(root, ['secret', 'delete', 'database.password', '--yes'], { VAULT_ADDR: vault.address }, 'n\n');
      expect(result.stderr).toMatch(/protected environment mutation was not authorized/i);
      expect(vault.mutations()).toBe(requestsBeforeDelete);
    } finally {
      await clearSession();
      await vault.close();
    }
  });

  it('reports permission denied when an accepted protected delete is subsequently denied by Vault', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-authz-delete-denied-'));
    const vault = await startVaultStub((method, path) => method === 'POST' && path.includes('/data/'));
    const clearSession = await seedDeveloperSession(vault.address);
    try {
      await initProject(root, 'development', true);
      const result = await runCliWithInput(root, ['secret', 'delete', 'database.password', '--yes'], { VAULT_ADDR: vault.address }, 'y\n');
      expect(result.stderr).toMatch(/permission denied/i);
    } finally {
      await clearSession();
      await vault.close();
    }
  });

  it('spawns zero child processes when the run secret read is denied', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-authz-run-denied-'));
    const vault = await startVaultStub((method, path) => method === 'GET' && path.includes('/data/'));
    const clearSession = await seedDeveloperSession(vault.address);
    const marker = join(root, 'spawned.marker');
    try {
      await initProject(root, 'development');
      const result = await runDiagnosticCli(root, ['run', '--', process.execPath, '-e', `require('node:fs').writeFileSync(${JSON.stringify(marker)}, 'spawned')`], { VAULT_ADDR: vault.address });

      expect(result.stderr).toMatch(/permission denied/i);
      await expect(readFile(marker, 'utf8')).rejects.toThrow();
    } finally {
      await clearSession();
      await vault.close();
    }
  });

  it('preserves the developer session and active environment after a permission denial', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-authz-immutability-'));
    const vault = await startVaultStub((method, path) => method === 'GET' && path.includes('/data/'));
    const clearSession = await seedDeveloperSession(vault.address);
    try {
      await initProject(root, 'development');
      const before = await readFile(join(root, '.devvault/context.json'), 'utf8');

      await runDiagnosticCli(root, ['secret', 'get', 'database.password', '--show'], { VAULT_ADDR: vault.address });

      const after = await readFile(join(root, '.devvault/context.json'), 'utf8');
      expect(after).toBe(before);

      const status = await runCli(root, ['status', '--json'], { VAULT_ADDR: vault.address });
      expect(JSON.parse(status.stdout)).toMatchObject({ session: { state: 'ACTIVE' } });
    } finally {
      await clearSession();
      await vault.close();
    }
  });
});
