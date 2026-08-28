import { describe, expect, it } from 'vitest';
import { SessionGuard } from '../../packages/core/src/session-guard.js';
import { SessionResolver } from '../../packages/core/src/session-resolver.js';
import { LogoutApplicationService } from '../../packages/core/src/logout-service.js';

function activeResolver(credential = 'validated-token') {
  return new SessionResolver(
    { read: async () => ({ token: credential, username: 'alice', authMount: 'userpass' }) },
    { validate: async (token) => ({ outcome: token === credential ? 'VALID' as const : 'INVALID' as const }) },
    { backendIdentity: 'http://vault.test' },
  );
}

describe('Session/Auth mutation discrimination', () => {
  it('rejects stored-token-as-active without remote validation', async () => {
    let validations = 0;
    const resolver = new SessionResolver(
      { read: async () => ({ token: 'stored-token', authMount: 'userpass' }) },
      { validate: async () => { validations += 1; return { outcome: 'INVALID' as const }; } },
      { backendIdentity: 'http://vault.test' },
    );

    await expect(resolver.resolve()).resolves.toMatchObject({ state: 'INVALID' });
    expect(validations).toBe(1);
  });

  it('keeps all non-active session outcomes behind the guard', async () => {
    for (const outcome of ['INVALID', 'EXPIRED', 'REVOKED'] as const) {
      const resolver = new SessionResolver(
        { read: async () => ({ token: 'stored-token', authMount: 'userpass' }) },
        { validate: async () => ({ outcome }) },
        { backendIdentity: 'http://vault.test' },
      );
      await expect(new SessionGuard(resolver).requireValidSession()).rejects.toBeInstanceOf(Error);
    }
  });

  it('does not accept an environment token as a developer session', async () => {
    const previous = process.env.VAULT_TOKEN;
    process.env.VAULT_TOKEN = 'admin-token';
    try {
      const resolver = new SessionResolver({ read: async () => null }, { validate: async () => ({ outcome: 'VALID' as const }) }, { backendIdentity: 'http://vault.test' });
      await expect(resolver.resolve()).resolves.toMatchObject({ state: 'NOT_AUTHENTICATED', credentialSource: 'NONE' });
    } finally {
      if (previous === undefined) delete process.env.VAULT_TOKEN;
      else process.env.VAULT_TOKEN = previous;
    }
  });

  it('preserves credential identity from validation through the operation context', async () => {
    const session = await new SessionGuard(activeResolver()).requireValidSession();
    const operationCredential = session.credential;
    expect(operationCredential).toBe('validated-token');
  });

  it('does not convert authorization or infrastructure outcomes into expiration', async () => {
    const guard = new SessionGuard({
      resolveValidated: async () => ({ state: 'UNKNOWN' as const, validation: 'UNAVAILABLE' as const }),
    });
    await expect(guard.requireValidSession()).rejects.toMatchObject({ code: 'SESSION_UNKNOWN' });
  });

  it('clears the local developer credential after logout even when revoke fails', async () => {
    let stored = true;
    const service = new LogoutApplicationService(
      {
        read: async () => stored ? { token: 'developer-token', authMount: 'userpass' } : null,
        clear: async () => { stored = false; },
      },
      { revoke: async () => { throw new Error('unavailable'); } },
      'http://vault.test',
    );
    await expect(service.logout()).resolves.toMatchObject({ cleared: true, revokeFailed: true });
    expect(stored).toBe(false);
  });
});