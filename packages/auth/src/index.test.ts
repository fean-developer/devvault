import { describe, expect, it } from 'vitest';
import {
  CredentialStoreDeveloperSessionStore,
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

  it('normalizes Userpass authentication without including the password', async () => {
    const provider = new UserpassAuthenticationProvider({
      loginUserpass: async (_mount, username, password) => {
        expect(username).toBe('alice');
        expect(password).toBe('password');
        return { token: 'session-token', leaseDuration: 3600 };
      },
      revokeSelf: async () => undefined,
    });

    const result = await provider.authenticate('alice', 'password');

    expect(result).toMatchObject({ token: 'session-token', username: 'alice', leaseDuration: 3600, authMount: 'userpass' });
    expect(result.issuedAt).toMatch(/T/);
    expect(result).not.toHaveProperty('password');
  });

  it('stores typed records under a backend-scoped key and reads their metadata', async () => {
    const credentials = new MemoryCredentialStore();
    const sessions = new CredentialStoreDeveloperSessionStore(credentials);
    const record = { token: 'alice-token', username: 'alice', authMount: 'userpass', leaseDuration: 3600 };

    await sessions.replace('http://vault-a:8200', record);

    await expect(sessions.read('http://vault-a:8200')).resolves.toEqual(record);
    await expect(sessions.read('http://vault-b:8200')).resolves.toBeNull();
  });

  it('reads legacy token-only records without requiring metadata', async () => {
    const credentials = new MemoryCredentialStore();
    await credentials.set('session', 'legacy-token');
    const sessions = new CredentialStoreDeveloperSessionStore(credentials);

    await expect(sessions.read('http://127.0.0.1:8200')).resolves.toEqual({ token: 'legacy-token', authMount: 'userpass' });
  });

  it('does not reuse a legacy token-only record for another backend', async () => {
    const credentials = new MemoryCredentialStore();
    await credentials.set('session', 'legacy-token');
    const sessions = new CredentialStoreDeveloperSessionStore(credentials, 'session', 'http://vault-a:8200');

    await expect(sessions.read('http://vault-b:8200')).resolves.toBeNull();
  });

  it('clears scoped and legacy records without touching other backend records', async () => {
    const credentials = new MemoryCredentialStore();
    const sessions = new CredentialStoreDeveloperSessionStore(credentials);
    await sessions.replace('http://vault-a:8200', { token: 'a-token', authMount: 'userpass' });
    await sessions.replace('http://vault-b:8200', { token: 'b-token', authMount: 'userpass' });

    await sessions.clear('http://vault-a:8200');

    await expect(sessions.read('http://vault-a:8200')).resolves.toBeNull();
    await expect(sessions.read('http://vault-b:8200')).resolves.toEqual({ token: 'b-token', authMount: 'userpass' });
  });
});