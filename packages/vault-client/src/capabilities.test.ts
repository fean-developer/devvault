import { describe, expect, it } from 'vitest';
import { HttpVaultClient } from './index.js';

describe('Vault capability checks', () => {
  it('returns the effective capabilities for a path', async () => {
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async (_input, init) => {
        expect(await new Request('http://vault', init).json()).toEqual({
          paths: ['secret/data/projects/my-api/development/database'],
        });
        return new Response(JSON.stringify({
          capabilities: {
            'secret/data/projects/my-api/development/database': ['read'],
          },
        }), { status: 200 });
      },
    });

    await expect(client.checkCapabilities('secret/data/projects/my-api/development/database'))
      .resolves.toEqual(['read']);
  });

  it('validates an existing KV v2 mount without mutating Vault', async () => {
    const methods: string[] = [];
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async (input, init) => {
        methods.push(`${init?.method ?? 'GET'} ${String(input)}`);
        return new Response(JSON.stringify({ 'secret/': { type: 'kv', options: { version: '2' } } }), { status: 200 });
      },
    });

    await expect(client.validateKvV2('secret')).resolves.toBe(true);
    expect(methods).toEqual(['GET http://vault/v1/sys/mounts']);
  });
});