import { createServer } from 'node:net';
import { execFile } from 'node:child_process';
import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { basename, join } from 'node:path';
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
  const paths: string[] = [];
  const server = createServer((socket) => {
    socket.once('data', (data) => {
      requests += 1;
      const requestLine = data.toString('utf8').split('\r\n', 1)[0] ?? '';
      const requestPath = requestLine.split(' ')[1] ?? '';
      paths.push(requestPath);
      const response = requestPath.includes('/metadata/')
        ? JSON.stringify({ data: { keys: ['database'] } })
          : requestPath.includes('/data/') && requestPath.includes('/development')
          ? JSON.stringify({ data: { data: { database: { username: 'dev-user', password: 'dev-password-marker' }, api: { key: 'dev-api-marker' } } } })
            : requestPath.includes('/data/') && requestPath.includes('/production')
            ? JSON.stringify({ data: { data: { database: { username: 'prod-user', password: 'prod-password-marker' }, api: { key: 'prod-api-marker' } } } })
            : '{}';
      const status = requestPath.includes('/metadata/') || requestPath.includes('/data/') ? '200 OK' : '404 Not Found';
      socket.end(`HTTP/1.1 ${status}\r\nContent-Type: application/json\r\nContent-Length: ${Buffer.byteLength(response)}\r\nConnection: close\r\n\r\n${response}`);
    });
  });
  return new Promise<{ address: string; requests: () => number; paths: () => string[]; close: () => Promise<void> }>((resolve) => {
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      if (!address || typeof address === 'string') throw new Error('Vault stub did not bind to a TCP port.');
      resolve({
        address: `http://127.0.0.1:${address.port}`,
        requests: () => requests,
        paths: () => [...paths],
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

  it('isolates runtime mappings and Vault paths across environment switches and overrides', async () => {
    const root = await mkdtemp(join(tmpdir(), 'devvault-real-runtime-'));
    const vault = await startVaultStub();
    const project = basename(root).toLowerCase().replace(/[^a-z0-9-]/g, '-');
    const child = 'process.stdout.write(JSON.stringify({ username: process.env.DATABASE_USERNAME, password: process.env.DATABASE_PASSWORD, api: process.env.API_KEY, devOnly: process.env.DEV_ONLY, prodOnly: process.env.PROD_ONLY }));';
    const env = { VAULT_ADDR: vault.address };
    try {
      await runCli(root, ['environment', 'set', 'development']);
      await runCli(root, ['init-project']);
      await runCli(root, ['environment', 'set', 'production']);
      await runCli(root, ['init-project']);
      await writeFile(join(root, 'environments', 'development', 'devvault.yaml'), [
        'version: 1', `project: ${project}`, 'environment: development', 'vault:', '  mount: secret', `  path: projects/${project}/development`, 'runtime:', '  mappings:', '    DATABASE_USERNAME: database.username', '    DATABASE_PASSWORD: database.password', '    API_KEY: api.key', '    DEV_ONLY: api.key',
      ].join('\n'));
      await writeFile(join(root, 'environments', 'production', 'devvault.yaml'), [
        'version: 1', `project: ${project}`, 'environment: production', 'vault:', '  mount: secret', `  path: projects/${project}/production`, 'runtime:', '  mappings:', '    DATABASE_USERNAME: database.username', '    DATABASE_PASSWORD: database.password', '    API_KEY: api.key', '    PROD_ONLY: api.key',
      ].join('\n'));

      await runCli(root, ['environment', 'set', 'development']);
      const development = await runCli(root, ['run', '--', process.execPath, '-e', child], env);
      expect(JSON.parse(development.stdout)).toEqual({ username: 'dev-user', password: 'dev-password-marker', api: 'dev-api-marker', devOnly: 'dev-api-marker' });
      expect(JSON.parse(development.stdout)).not.toHaveProperty('prodOnly');

      await runCli(root, ['environment', 'set', 'production']);
      const production = await runCli(root, ['run', '--', process.execPath, '-e', child], env);
      expect(JSON.parse(production.stdout)).toEqual({ username: 'prod-user', password: 'prod-password-marker', api: 'prod-api-marker', prodOnly: 'prod-api-marker' });
      expect(JSON.parse(production.stdout)).not.toHaveProperty('devOnly');

      await runCli(root, ['environment', 'set', 'development']);
      const override = await runCli(root, ['run', '--environment', 'production', '--', process.execPath, '-e', child], env);
      expect(JSON.parse(override.stdout)).toEqual({ username: 'prod-user', password: 'prod-password-marker', api: 'prod-api-marker', prodOnly: 'prod-api-marker' });
      expect(JSON.parse(override.stdout)).not.toHaveProperty('devOnly');
      await expect(runCli(root, ['environment', 'current'])).resolves.toMatchObject({ stdout: expect.stringContaining('Environment: development') });

      const developmentConfig = await readFile(join(root, 'environments', 'development', 'devvault.yaml'), 'utf8');
      const productionConfig = await readFile(join(root, 'environments', 'production', 'devvault.yaml'), 'utf8');
      const context = await readFile(join(root, '.devvault/context.json'), 'utf8');
      expect(`${developmentConfig}${productionConfig}${context}`).not.toMatch(/dev-password-marker|prod-password-marker|dev-api-marker|prod-api-marker/);
      expect(process.env.DATABASE_USERNAME).not.toBe('dev-user');
      expect(process.env.DATABASE_USERNAME).not.toBe('prod-user');
      expect(process.env.DATABASE_PASSWORD).not.toBe('dev-password-marker');
      expect(process.env.DATABASE_PASSWORD).not.toBe('prod-password-marker');
      const paths = vault.paths();
      expect(paths.filter((path) => path.includes(`/data/projects/${project}/development`))).toHaveLength(1);
      expect(paths.filter((path) => path.includes(`/data/projects/${project}/production`))).toHaveLength(2);
    } finally {
      await vault.close();
    }
  });
});
