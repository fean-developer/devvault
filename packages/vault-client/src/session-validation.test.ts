import { describe, expect, it } from 'vitest';
import { VaultSessionValidator } from './session-validation.js';

function response(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { 'content-type': 'application/json' } });
}

describe('Vault session validation', () => {
  it('returns valid without exposing the token or raw response', async () => {
    const validator = new VaultSessionValidator({
      address: 'http://vault.test',
      fetchImpl: async (_input, init) => {
        expect(init?.headers).toMatchObject({ 'x-vault-token': 'secret-token' });
        return response(200, { auth: { client_token: 'secret-token', expire_time: '2026-08-28T01:00:00Z' } });
      },
    });

    const result = await validator.validate('secret-token');

    expect(result).toEqual({ outcome: 'VALID', expiresAt: '2026-08-28T01:00:00Z' });
    expect(JSON.stringify(result)).not.toContain('secret-token');
  });

  it('classifies explicit expiration and revocation evidence from a rejected token', async () => {
    const expired = new VaultSessionValidator({ address: 'http://vault.test', fetchImpl: async () => response(401, { errors: ['token expired'] }) });
    const revoked = new VaultSessionValidator({ address: 'http://vault.test', fetchImpl: async () => response(401, { errors: ['token revoked'] }) });

    await expect(expired.validate('token')).resolves.toEqual({ outcome: 'EXPIRED' });
    await expect(revoked.validate('token')).resolves.toEqual({ outcome: 'REVOKED' });
  });

  it('keeps ambiguous authentication and infrastructure failures distinct from expiration', async () => {
    const invalid = new VaultSessionValidator({ address: 'http://vault.test', fetchImpl: async () => response(401, { errors: ['permission denied'] }) });
    const denied = new VaultSessionValidator({ address: 'http://vault.test', fetchImpl: async () => response(403, { errors: ['permission denied'] }) });
    const unavailable = new VaultSessionValidator({ address: 'http://vault.test', fetchImpl: async () => response(503, { sealed: true }) });
    const transport = new VaultSessionValidator({ address: 'http://vault.test', fetchImpl: async () => { throw new Error('network'); } });

    await expect(invalid.validate('token')).resolves.toEqual({ outcome: 'INVALID' });
    await expect(denied.validate('token')).resolves.toEqual({ outcome: 'UNKNOWN', reason: 'INCONCLUSIVE' });
    await expect(unavailable.validate('token')).resolves.toEqual({ outcome: 'UNKNOWN', reason: 'UNAVAILABLE' });
    await expect(transport.validate('token')).resolves.toEqual({ outcome: 'UNKNOWN', reason: 'UNAVAILABLE' });
  });
});