import { execFile } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { promisify } from 'node:util';
import { afterEach, describe, expect, it } from 'vitest';
import { createDeveloperPolicy, HttpVaultClient } from '../../packages/vault-client/src/index.js';
import { resolveRuntimeEnvironment } from '../../apps/cli/src/runtime.js';
import { getSecret, listSecretKeys, setSecret } from '../../apps/cli/src/secrets.js';

const execFileAsync = promisify(execFile);
const containers: string[] = [];

async function startVault(): Promise<{ address: string; rootToken: string; container: string }> {
  const container = `devvault-secret-list-${randomBytes(8).toString('hex')}`;
  const rootToken = randomBytes(24).toString('base64url');
  containers.push(container);
  await execFileAsync('docker', [
    'run', '-d', '--rm', '--name', container, '-p', '127.0.0.1::8200',
    '-e', `VAULT_DEV_ROOT_TOKEN_ID=${rootToken}`,
    '-e', 'VAULT_DEV_LISTEN_ADDRESS=0.0.0.0:8200',
    'hashicorp/vault:1.20.4',
  ]);
  const { stdout } = await execFileAsync('docker', ['port', container, '8200/tcp']);
  const port = stdout.trim().match(/:(\d+)$/)?.[1];
  if (!port) throw new Error('Disposable Vault did not expose an HTTP port.');
  const address = `http://127.0.0.1:${port}`;
  for (let attempt = 0; attempt < 40; attempt += 1) {
    try {
      await execFileAsync('docker', ['exec', container, 'sh', '-c', 'VAULT_ADDR=http://127.0.0.1:8200 vault status -format=json']);
      return { address, rootToken, container };
    } catch {
      // Vault is still starting.
    }
    await new Promise((resolve) => setTimeout(resolve, 250));
  }
  throw new Error('Disposable Vault did not become ready.');
}

afterEach(async () => {
  await Promise.all(containers.splice(0).map(async (container) => {
    await execFileAsync('docker', ['rm', '-f', container]).catch(() => undefined);
  }));
});

describe('real Vault KV v2 logical secret listing', () => {
  it('lists dotted document keys without values while preserving get and runtime injection', async () => {
    const vault = await startVault();
    const root = new HttpVaultClient({ address: vault.address, token: vault.rootToken });
    const config = {
      version: 1 as const,
      project: 'secret-list-e2e',
      environment: 'development',
      vault: { mount: 'secret', path: 'projects/secret-list-e2e/development' },
      runtime: { mappings: { DATABASE_PASSWORD: 'database.password' } },
    };
    const username = 'secret-list-user';
    const password = randomBytes(24).toString('base64url');

    await root.ensureKvV2('secret');
    await root.putPolicy('secret-list-e2e-developer', createDeveloperPolicy(config));
    await root.ensureUserpass();
    await root.createUserpassUser(username, password, ['secret-list-e2e-developer']);
    const session = await root.loginUserpass('userpass', username, password);
    const developer = new HttpVaultClient({ address: vault.address, token: session.token });

    await setSecret(config, developer, 'database.password', 'synthetic-password');
    await setSecret(config, developer, 'database.username', 'synthetic-user');

    const keys = await listSecretKeys(config, developer);
    expect(keys).toEqual(['database.password', 'database.username']);
    expect(keys.join('\n')).not.toContain('synthetic-password');
    expect(keys.join('\n')).not.toContain('synthetic-user');
    await expect(getSecret(config, developer, 'database.password')).resolves.toBe('synthetic-password');
    await expect(resolveRuntimeEnvironment(config, developer, {})).resolves.toMatchObject({ DATABASE_PASSWORD: 'synthetic-password' });
  }, 30000);
});