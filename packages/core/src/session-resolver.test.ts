import { describe, expect, it } from 'vitest';
import { SessionResolver } from './session-resolver.js';

function resolver(record: { token: string; username?: string } | null, outcome: 'VALID' | 'INVALID' | 'EXPIRED' | 'REVOKED' | 'UNKNOWN' = 'VALID') {
  let validations = 0;
  const sessionResolver = new SessionResolver(
    { read: async () => record ? { ...record, authMount: 'userpass' } : null },
    { validate: async () => { validations += 1; return outcome === 'UNKNOWN' ? { outcome, reason: 'UNAVAILABLE' } : { outcome }; } },
    { backendIdentity: 'http://vault.test' },
  );
  return { sessionResolver, validations: () => validations };
}

describe('SessionResolver', () => {
  it('returns NOT_AUTHENTICATED without remote validation when no record exists', async () => {
    const test = resolver(null);

    await expect(test.sessionResolver.resolve()).resolves.toEqual({
      state: 'NOT_AUTHENTICATED',
      credentialSource: 'NONE',
      validation: 'NOT_ATTEMPTED',
    });
    expect(test.validations()).toBe(0);
  });

  it.each([
    ['VALID', 'ACTIVE'],
    ['INVALID', 'INVALID'],
    ['EXPIRED', 'EXPIRED'],
    ['REVOKED', 'REVOKED'],
    ['UNKNOWN', 'UNKNOWN'],
  ] as const)('maps remote %s evidence to %s without accepting token presence alone', async (outcome, state) => {
    const test = resolver({ token: 'stored-token', username: 'alice' }, outcome);

    await expect(test.sessionResolver.resolve()).resolves.toMatchObject({ state, identity: { username: 'alice' }, credentialSource: 'CREDENTIAL_STORE' });
    expect(test.validations()).toBe(1);
  });

  it('returns the validated credential only through the internal validated-session result', async () => {
    const test = resolver({ token: 'stored-token', username: 'alice' });

    await expect(test.sessionResolver.resolveValidated()).resolves.toMatchObject({ state: 'ACTIVE', credential: 'stored-token', username: 'alice' });
    await expect(test.sessionResolver.resolve()).resolves.not.toHaveProperty('credential');
  });
});