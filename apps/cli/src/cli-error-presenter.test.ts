import { describe, expect, it } from 'vitest';
import { formatCliErrorMessage } from './cli-error-presenter.js';
import { AuthorizationDeniedError, SessionFailureError, VaultUnavailableError } from '@devvault/core';

describe('formatCliErrorMessage', () => {
  it('presents AuthorizationDeniedError as a distinct permission-denied message', () => {
    const message = formatCliErrorMessage(new AuthorizationDeniedError({ operation: 'secret.set', project: 'my-api', environment: 'production' }));

    expect(message).toMatch(/permission denied/i);
    expect(message).not.toMatch(/expired|login|devvault start/i);
  });

  it('never suggests devvault start or login for authorization denial', () => {
    const message = formatCliErrorMessage(new AuthorizationDeniedError({ operation: 'run', project: 'my-api', environment: 'development' }));

    expect(message.toLowerCase()).not.toContain('devvault start');
    expect(message.toLowerCase()).not.toContain('login');
  });

  it('leaves a session/auth error message unchanged (401 stays session-owned)', () => {
    const original = new SessionFailureError('SESSION_EXPIRED', 'Developer session expired.');
    expect(formatCliErrorMessage(original)).toBe('Error: Developer session expired.');
  });

  it('leaves an infrastructure error message unchanged (503 stays infra-owned)', () => {
    const original = new VaultUnavailableError('Vault is unavailable.');
    expect(formatCliErrorMessage(original)).toBe('Error: Vault is unavailable.');
    expect(formatCliErrorMessage(original)).not.toMatch(/permission denied/i);
  });
});
