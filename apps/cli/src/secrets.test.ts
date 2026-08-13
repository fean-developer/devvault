import { describe, expect, it } from 'vitest';
import { setSecret, getSecret, deleteSecret } from './secrets.js';

const config = {
  version: 1 as const,
  project: 'my-api',
  environment: 'development',
  vault: { mount: 'secret', path: 'projects/my-api/development' },
  runtime: { mappings: {} },
};

function clientWith(initial: Record<string, unknown>) {
  let data = structuredClone(initial) as Record<string, string>;
  return {
    readSecret: async () => data,
    writeSecret: async (_mount: string, _path: string, next: Record<string, string>) => {
      data = structuredClone(next);
    },
    listSecrets: async (...args: [string, string]) => {
      void args;
      return Object.keys(data);
    },
    deleteSecret: async () => undefined,
    data: () => data,
  };
}

describe('secret operations', () => {
  it('sets and reads nested values without replacing sibling values', async () => {
    const client = clientWith({ database: { username: 'dev' } });

    await setSecret(config, client, 'database.password', 'value');

    await expect(getSecret(config, client, 'database.password')).resolves.toBe('value');
    expect(client.data()).toEqual({ database: { username: 'dev', password: 'value' } });
  });

  it('deletes only the requested nested value', async () => {
    const client = clientWith({ database: { username: 'dev', password: 'value' } });

    await expect(deleteSecret(config, client, 'database.password')).resolves.toBe(true);
    expect(client.data()).toEqual({ database: { username: 'dev' } });
  });

  it('does not expose values through key operations', async () => {
    const client = clientWith({ database: { password: 'secret-value' } });

    await expect(client.listSecrets('secret', 'projects/my-api/development')).resolves.toEqual([
      'database',
    ]);
  });
});