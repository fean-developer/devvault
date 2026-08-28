import { describe, expect, it } from 'vitest';
import { LogoutApplicationService } from './logout-service.js';

function createStore(record: { token: string } | null) {
  let cleared = false;
  return {
    store: {
      read: async () => record ? { ...record, authMount: 'userpass' } : null,
      clear: async () => { cleared = true; },
    },
    wasCleared: () => cleared,
  };
}

describe('LogoutApplicationService', () => {
  it('revokes the stored developer token and clears local state', async () => {
    const test = createStore({ token: 'alice-token' });
    let revoked: string | undefined;
    const service = new LogoutApplicationService(test.store, { revoke: async (token) => { revoked = token; } }, 'http://vault.test');

    await expect(service.logout()).resolves.toEqual({ cleared: true, revokeAttempted: true, revokeFailed: false });
    expect(revoked).toBe('alice-token');
    expect(test.wasCleared()).toBe(true);
  });

  it('clears local state even when remote revocation fails', async () => {
    const test = createStore({ token: 'expired-token' });
    const service = new LogoutApplicationService(test.store, { revoke: async () => { throw new Error('Vault unavailable'); } }, 'http://vault.test');

    await expect(service.logout()).resolves.toEqual({ cleared: true, revokeAttempted: true, revokeFailed: true });
    expect(test.wasCleared()).toBe(true);
  });

  it('clears local state without remote validation when no session exists', async () => {
    const test = createStore(null);
    let revokeCalls = 0;
    const service = new LogoutApplicationService(test.store, { revoke: async () => { revokeCalls += 1; } }, 'http://vault.test');

    await expect(service.logout()).resolves.toEqual({ cleared: true, revokeAttempted: false, revokeFailed: false });
    expect(revokeCalls).toBe(0);
    expect(test.wasCleared()).toBe(true);
  });
});