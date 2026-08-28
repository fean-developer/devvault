import { describe, expect, it } from 'vitest';
import { LoginApplicationService } from './login-service.js';

describe('LoginApplicationService', () => {
  it('authenticates before replacing the developer session and returns safe metadata', async () => {
    const calls: string[] = [];
    const service = new LoginApplicationService({
      backendIdentity: 'http://vault.test',
      authenticator: {
        authenticate: async (username, password) => {
          calls.push(`authenticate:${username}:${password}`);
          return { token: 'alice-token', username, issuedAt: '2026-08-28T00:00:00.000Z', leaseDuration: 3600, authMount: 'userpass' };
        },
      },
      sessionStore: {
        replace: async (backend, record) => {
          calls.push(`replace:${backend}:${record.token}`);
          expect(record).toMatchObject({ token: 'alice-token', username: 'alice', leaseDuration: 3600, authMount: 'userpass' });
          expect(record).not.toHaveProperty('password');
        },
      },
    });

    const result = await service.login('alice', 'password');

    expect(calls).toEqual(['authenticate:alice:password', 'replace:http://vault.test:alice-token']);
    expect(result).toMatchObject({ state: 'ACTIVE', username: 'alice', validation: 'REMOTE_CONFIRMED' });
    expect(result).not.toHaveProperty('token');
    expect(result).not.toHaveProperty('password');
  });

  it('preserves the existing session when authentication fails before replacement', async () => {
    let replaced = false;
    const service = new LoginApplicationService({
      backendIdentity: 'http://vault.test',
      authenticator: { authenticate: async () => { throw new Error('authentication failed'); } },
      sessionStore: { replace: async () => { replaced = true; } },
    });

    await expect(service.login('alice', 'wrong-password')).rejects.toThrow('authentication failed');
    expect(replaced).toBe(false);
  });
});