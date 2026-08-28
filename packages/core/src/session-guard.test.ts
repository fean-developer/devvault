import { describe, expect, it } from 'vitest';
import { SessionGuard } from './session-guard.js';

describe('SessionGuard', () => {
  it('returns the validated developer session without another credential lookup', async () => {
    let resolutions = 0;
    const guard = new SessionGuard({
      resolveValidated: async () => {
        resolutions += 1;
        return { state: 'ACTIVE', username: 'alice', credential: 'alice-token', validation: 'REMOTE_CONFIRMED' };
      },
    });

    const result = await guard.requireValidSession();

    expect(result).toEqual({ state: 'ACTIVE', username: 'alice', credential: 'alice-token', validation: 'REMOTE_CONFIRMED' });
    expect(resolutions).toBe(1);
  });

  it.each([
    ['NOT_AUTHENTICATED', 'LOGIN_REQUIRED'],
    ['INVALID', 'SESSION_INVALID'],
    ['EXPIRED', 'SESSION_EXPIRED'],
    ['REVOKED', 'SESSION_REVOKED'],
    ['UNKNOWN', 'SESSION_UNKNOWN'],
  ] as const)('blocks %s with %s', async (state, code) => {
    const guard = new SessionGuard({
      resolveValidated: async () => state === 'NOT_AUTHENTICATED'
        ? { state, validation: 'NOT_ATTEMPTED' }
        : state === 'UNKNOWN'
          ? { state, validation: 'UNAVAILABLE' }
          : { state, validation: 'REMOTE_CONFIRMED' },
    });

    await expect(guard.requireValidSession()).rejects.toMatchObject({ code });
  });
});