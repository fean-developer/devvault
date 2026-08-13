import { describe, expect, it } from 'vitest';
import { HttpVaultClient } from './index.js';

describe('Vault capability checks', () => {
  it('reads lifecycle facts from a valid 503 health response', async () => {
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async () => new Response(JSON.stringify({ initialized: false, sealed: true }), { status: 503 }),
    });

    await expect(client.health()).resolves.toEqual({ initialized: false, sealed: true });
  });

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

  it('uses read-only capability inspection with the configured Vault token', async () => {
    const requests: Array<{ path: string; method: string; token: string | null }> = [];
    const client = new HttpVaultClient({
      address: 'http://vault',
      token: 'test-token',
      fetchImpl: async (input, init) => {
        const request = new Request(String(input), init);
        requests.push({ path: new URL(request.url).pathname, method: request.method, token: request.headers.get('x-vault-token') });
        return new Response(JSON.stringify({ capabilities: { 'secret/data/projects/project-a/development': ['read'] } }), { status: 200 });
      },
    });

    await expect(client.checkCapabilities('secret/data/projects/project-a/development')).resolves.toEqual(['read']);
    expect(requests).toEqual([{ path: '/v1/sys/capabilities-self', method: 'POST', token: 'test-token' }]);
  });
});