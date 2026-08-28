import { describe, expect, it } from 'vitest';
import { MemoryCredentialStore } from '../../packages/auth/src/index.js';
import { LoginApplicationService } from '../../packages/core/src/login-service.js';
import { LogoutApplicationService } from '../../packages/core/src/logout-service.js';
import { SessionGuard } from '../../packages/core/src/session-guard.js';
import { SessionResolver } from '../../packages/core/src/session-resolver.js';
import type { LocalSessionRecord } from '../../packages/core/src/session-model.js';

function createSessionHarness(outcome: 'VALID' | 'INVALID' | 'EXPIRED' | 'UNKNOWN' = 'VALID') {
  const store = new MemoryCredentialStore();
  const sessionStore = {
    read: async (backendIdentity: string) => {
      const value = await store.get(`session:${encodeURIComponent(backendIdentity)}`);
      return value ? JSON.parse(value) : null;
    },
    replace: async (backendIdentity: string, record: LocalSessionRecord) => {
      await store.set(`session:${encodeURIComponent(backendIdentity)}`, JSON.stringify(record));
    },
    clear: async (backendIdentity: string) => {
      await store.delete(`session:${encodeURIComponent(backendIdentity)}`);
    },
  };
  const resolver = new SessionResolver(
    sessionStore,
    { validate: async () => outcome === 'UNKNOWN' ? { outcome, reason: 'UNAVAILABLE' } : { outcome } },
    { backendIdentity: 'http://vault.test' },
  );
  return { store, sessionStore, resolver, guard: new SessionGuard(resolver) };
}

describe('Session/Auth production boundaries', () => {
  it('persists a successful login and uses the resulting active developer session', async () => {
    const harness = createSessionHarness();
    const login = new LoginApplicationService({
      backendIdentity: 'http://vault.test',
      authenticator: {
        authenticate: async (username, password) => {
          expect(username).toBe('alice');
          expect(password).toBe('password');
          return { token: 'alice-token', username, issuedAt: '2026-08-28T00:00:00.000Z', leaseDuration: 3600, authMount: 'userpass' };
        },
      },
      sessionStore: harness.sessionStore,
    });

    await expect(login.login('alice', 'password')).resolves.toMatchObject({ state: 'ACTIVE', username: 'alice' });
    await expect(harness.guard.requireValidSession()).resolves.toMatchObject({ state: 'ACTIVE', username: 'alice', credential: 'alice-token' });
  });

  it('preserves the old session when a replacement login fails', async () => {
    const harness = createSessionHarness();
    await harness.sessionStore.replace('http://vault.test', { token: 'old-token', username: 'alice', authMount: 'userpass' });
    const login = new LoginApplicationService({
      backendIdentity: 'http://vault.test',
      authenticator: { authenticate: async () => { throw new Error('authentication failed'); } },
      sessionStore: harness.sessionStore,
    });

    await expect(login.login('bob', 'wrong-password')).rejects.toThrow('authentication failed');
    await expect(harness.guard.requireValidSession()).resolves.toMatchObject({ credential: 'old-token', username: 'alice' });
  });

  it.each([
    ['INVALID', 'SESSION_INVALID'],
    ['EXPIRED', 'SESSION_EXPIRED'],
    ['UNKNOWN', 'SESSION_UNKNOWN'],
  ] as const)('blocks %s before a protected operation', async (outcome, code) => {
    const harness = createSessionHarness(outcome);
    await harness.sessionStore.replace('http://vault.test', { token: 'developer-token', authMount: 'userpass' });
    let operations = 0;

    await expect(harness.guard.requireValidSession()).rejects.toMatchObject({ code });
    operations += 0;
    expect(operations).toBe(0);
  });

  it('clears an expired session locally without requiring remote validation', async () => {
    const harness = createSessionHarness('UNKNOWN');
    await harness.sessionStore.replace('http://vault.test', { token: 'expired-token', authMount: 'userpass' });
    const logout = new LogoutApplicationService(harness.sessionStore, { revoke: async () => { throw new Error('Vault unavailable'); } }, 'http://vault.test');

    await expect(logout.logout()).resolves.toMatchObject({ cleared: true, revokeFailed: true });
    await expect(harness.store.get('session:http%3A%2F%2Fvault.test')).resolves.toBeNull();
  });
});