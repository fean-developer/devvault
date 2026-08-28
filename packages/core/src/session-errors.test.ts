import { describe, expect, it } from 'vitest';
import { classifySessionFailure } from './session-errors.js';

describe('session error mapping', () => {
  it('maps session and infrastructure outcomes to stable safe codes', () => {
    expect(classifySessionFailure({ kind: 'LOGIN_REQUIRED' })).toMatchObject({ code: 'LOGIN_REQUIRED', message: 'Developer login required.' });
    expect(classifySessionFailure({ kind: 'EXPIRED_SESSION' })).toMatchObject({ code: 'SESSION_EXPIRED', message: 'Developer session expired.' });
    expect(classifySessionFailure({ kind: 'PERMISSION_DENIED' })).toMatchObject({ code: 'PERMISSION_DENIED', message: 'Permission denied for this operation.' });
    expect(classifySessionFailure({ kind: 'VAULT_UNAVAILABLE' })).toMatchObject({ code: 'VAULT_UNAVAILABLE', message: 'Vault is unavailable.' });
    expect(classifySessionFailure({ kind: 'VAULT_SEALED' })).toMatchObject({ code: 'VAULT_SEALED', message: 'Vault is sealed.' });
  });

  it('keeps authorization denial and unavailable validation distinct from expiration', () => {
    const denied = classifySessionFailure({ kind: 'PERMISSION_DENIED' });
    const unavailable = classifySessionFailure({ kind: 'VAULT_UNAVAILABLE' });
    const unknown = classifySessionFailure({ kind: 'UNKNOWN' });

    expect(denied.code).not.toBe('SESSION_EXPIRED');
    expect(unavailable.code).not.toBe('SESSION_EXPIRED');
    expect(unknown.code).not.toBe('SESSION_EXPIRED');
  });

  it('does not include sensitive transport data in mapped errors', () => {
    const error = classifySessionFailure({ kind: 'INVALID_SESSION' });

    expect(error.message).not.toMatch(/token|password|authorization|secret-value/i);
    expect(JSON.stringify(error)).not.toMatch(/token|password|authorization|secret-value/i);
  });
});