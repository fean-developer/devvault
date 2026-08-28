import { describe, expect, it } from 'vitest';
import {
  SESSION_STATES,
  type LocalSessionRecord,
  type SafeSessionSummary,
  type SessionResolution,
  type ValidatedDeveloperSession,
} from './session-model.js';

describe('developer session models', () => {
  it('defines exactly the approved session states', () => {
    expect(SESSION_STATES).toEqual([
      'NOT_AUTHENTICATED',
      'ACTIVE',
      'INVALID',
      'EXPIRED',
      'REVOKED',
      'UNKNOWN',
    ]);
  });

  it('constructs the local record with optional legacy metadata', () => {
    const record: LocalSessionRecord = { token: 'session-token', authMount: 'userpass' };
    expect(record).toMatchObject({ token: 'session-token', authMount: 'userpass' });
    expect(record.username).toBeUndefined();
    expect(record.expiresAt).toBeUndefined();
  });

  it('keeps session resolution states and credential sources explicit', () => {
    const resolutions: SessionResolution[] = SESSION_STATES.map((state) => ({
      state,
      credentialSource: state === 'NOT_AUTHENTICATED' ? 'NONE' : 'CREDENTIAL_STORE',
      validation: state === 'NOT_AUTHENTICATED' ? 'NOT_ATTEMPTED' : 'REMOTE_CONFIRMED',
    }));

    expect(resolutions.map((resolution) => resolution.state)).toEqual(SESSION_STATES);
    expect(resolutions[0]).toMatchObject({ state: 'NOT_AUTHENTICATED', credentialSource: 'NONE', validation: 'NOT_ATTEMPTED' });
    expect(resolutions[1]).toMatchObject({ state: 'ACTIVE', credentialSource: 'CREDENTIAL_STORE', validation: 'REMOTE_CONFIRMED' });
  });

  it('constructs the validated session context without exposing it in the safe summary', () => {
    const validated: ValidatedDeveloperSession = {
      state: 'ACTIVE',
      username: 'alice',
      expiresAt: '2026-08-28T01:00:00.000Z',
      credential: 'session-token',
      validation: 'REMOTE_CONFIRMED',
    };
    const summary: SafeSessionSummary = {
      state: validated.state,
      username: validated.username,
      expiresAt: validated.expiresAt,
      validation: validated.validation,
    };

    expect(validated).toMatchObject({ state: 'ACTIVE', username: 'alice', credential: 'session-token', validation: 'REMOTE_CONFIRMED' });
    expect(summary).toMatchObject({ state: 'ACTIVE', username: 'alice', expiresAt: validated.expiresAt, validation: 'REMOTE_CONFIRMED' });
    expect(summary).not.toHaveProperty('credential');
    expect(summary).not.toHaveProperty('token');
  });
});