import { describe, expect, it } from 'vitest';
import {
  MemoryCredentialStore,
  UserpassAuthenticationProvider,
} from './index.js';

describe('authentication ports', () => {
  it('stores and deletes credentials in memory', async () => {
    const store = new MemoryCredentialStore();
    await store.set('session', 'token');
    await expect(store.get('session')).resolves.toBe('token');
    await store.delete('session');
    await expect(store.get('session')).resolves.toBeNull();
  });

  it('keeps Userpass authentication separate from credential storage', async () => {
    const calls: string[] = [];
    const provider = new UserpassAuthenticationProvider({
      loginUserpass: async (_mount, username, password) => {
        calls.push(`${username}:${password}`);
        return { token: 'session-token', leaseDuration: 3600 };
      },
      revokeSelf: async (token) => {
        calls.push(`revoke:${token}`);
      },
    });

    await expect(provider.login('alice', 'password')).resolves.toBe('session-token');
    await provider.logout('session-token');
    expect(calls).toEqual(['alice:password', 'revoke:session-token']);
  });
});