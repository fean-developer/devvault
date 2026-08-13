import { describe, expect, it } from 'vitest';
import {
  VaultAuthenticationError,
  VaultPermissionDeniedError,
} from '@devvault/core';
import { HttpVaultClient } from './index.js';

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status });
}

describe('HttpVaultClient', () => {
  it('reads KV v2 data and sends the token header', async () => {
    let request: Request | undefined;
    const client = new HttpVaultClient({
      address: 'http://127.0.0.1:8200/',
      token: 'test-token',
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return response(200, { data: { data: { password: 'value' } } });
      },
    });

    await expect(client.readSecret('secret', 'projects/my-api/development')).resolves.toEqual({
      password: 'value',
    });
    expect(request?.url).toBe(
      'http://127.0.0.1:8200/v1/secret/data/projects/my-api/development',
    );
    expect(request?.headers.get('x-vault-token')).toBe('test-token');
  });

  it('treats a missing KV path as empty data for first writes', async () => {
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async () => response(404, { errors: ['missing'] }),
    });

    await expect(client.readSecret('secret', 'projects/my-api/development')).resolves.toEqual({});
  });

  it('treats a missing metadata path as an empty list', async () => {
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async () => response(404, { errors: ['missing'] }),
    });

    await expect(client.listSecrets('secret', 'projects/my-api/development')).resolves.toEqual([]);
  });

  it('maps unauthorized and forbidden responses without exposing response bodies', async () => {
    const unauthorized = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async () => response(401, { errors: ['token value must not escape'] }),
    });
    const forbidden = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async () => response(403, { errors: ['secret-value'] }),
    });

    await expect(unauthorized.health()).rejects.toBeInstanceOf(VaultAuthenticationError);
    await expect(forbidden.health()).rejects.toBeInstanceOf(VaultPermissionDeniedError);
    await expect(forbidden.health()).rejects.not.toThrow('secret-value');
  });

  it('maps transport failures to an unavailable error', async () => {
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async () => {
        throw new TypeError('connection refused');
      },
    });

    await expect(client.health()).rejects.toThrow('Vault is unavailable.');
  });

  it('sends an unseal key only to the local Vault endpoint and does not expose it on failure', async () => {
    let request: Request | undefined;
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return response(503, { errors: ['unseal-key-must-not-escape'] });
      },
    });

    await expect(client.unseal('ephemeral-unseal-key')).rejects.toThrow('Vault returned HTTP 503.');
    expect(request?.url).toBe('http://vault/v1/sys/unseal');
    expect(request?.method).toBe('POST');
    expect(await request?.json()).toEqual({ key: 'ephemeral-unseal-key' });
  });

  it('initializes Vault with one share and threshold and returns bootstrap material', async () => {
    let request: Request | undefined;
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return response(200, { root_token: 'root-token', keys: ['unseal-key'] });
      },
    });

    await expect(client.initialize()).resolves.toEqual({ rootToken: 'root-token', unsealKey: 'unseal-key' });
    expect(request?.method).toBe('PUT');
    expect(await request?.json()).toEqual({ secret_shares: 1, secret_threshold: 1 });
  });

  it('enables KV v2 only when the mount is absent', async () => {
    const requests: Request[] = [];
    const client = new HttpVaultClient({
      address: 'http://vault',
      token: 'token',
      fetchImpl: async (input, init) => {
        const request = new Request(input, init);
        requests.push(request);
        return request.url.endsWith('/sys/mounts')
          ? response(200, {})
          : new Response(null, { status: 204 });
      },
    });

    await client.ensureKvV2('secret');

    expect(requests).toHaveLength(2);
    expect(requests[1].method).toBe('POST');
    expect(await requests[1].json()).toEqual({ type: 'kv', options: { version: '2' } });
  });

  it('writes an ACL policy through the Vault API', async () => {
    let request: Request | undefined;
    const client = new HttpVaultClient({
      address: 'http://vault',
      fetchImpl: async (input, init) => {
        request = new Request(input, init);
        return new Response(null, { status: 204 });
      },
    });

    await client.putPolicy('devvault-my-api-development', 'path "secret/data/*" {}');

    expect(request?.url).toBe('http://vault/v1/sys/policies/acl/devvault-my-api-development');
    expect(await request?.json()).toEqual({ policy: 'path "secret/data/*" {}' });
  });
});