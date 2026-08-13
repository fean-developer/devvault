import { describe, expect, it } from 'vitest';
import { HttpVaultClient } from './index.js';

describe('Vault human authentication setup', () => {
  it('enables Userpass only when it is absent', async () => {
    const requests: Request[] = [];
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        return request.url.endsWith('/sys/auth')
          ? new Response(JSON.stringify({}), { status: 200 })
          : new Response(null, { status: 204 });
      },
    });

    await client.ensureUserpass();

    expect(requests).toHaveLength(2);
    expect(requests[1].url).toBe('http://vault/v1/sys/auth/userpass');
    expect(await requests[1].json()).toMatchObject({ type: 'userpass' });
  });

  it('creates a Userpass user with explicit policies and TTL', async () => {
    let request: Request | undefined;
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return new Response(null, { status: 204 });
      },
    });

    await client.createUserpassUser('alice', 'password', ['devvault-my-api-development-developer']);

    expect(request?.url).toBe('http://vault/v1/auth/userpass/users/alice');
    expect(await request?.json()).toEqual({
      password: 'password',
      token_policies: ['devvault-my-api-development-developer'],
      token_ttl: '1h',
    });
  });
});