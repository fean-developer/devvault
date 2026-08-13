import { describe, expect, it } from 'vitest';
import { evaluateConsent } from './consent.js';

describe('consent boundary', () => {
  const mutation = { actionId: 'start-docker', summary: 'Start local Vault', mutating: true, required: true };

  it('blocks denied consent', () => {
    expect(evaluateConsent(mutation, { mode: 'interactive', assumeYes: false }, 'denied')).toMatchObject({
      blocked: true,
      decision: 'denied',
    });
  });

  it('blocks non-interactive mutation without explicit authorization', () => {
    expect(evaluateConsent(mutation, { mode: 'non-interactive', assumeYes: false }, 'unavailable')).toMatchObject({
      blocked: true,
      decision: 'unavailable',
    });
  });

  it('never authorizes prohibited Docker Desktop mutation', () => {
    expect(evaluateConsent({ ...mutation, prohibited: true }, { mode: 'interactive', assumeYes: true }, 'approved')).toMatchObject({
      blocked: true,
      decision: 'denied',
    });
  });

  it('does not require consent for read-only checks', () => {
    expect(evaluateConsent({ ...mutation, mutating: false, required: false }, { mode: 'non-interactive', assumeYes: false }, 'unavailable')).toEqual({
      blocked: false,
      decision: 'approved',
    });
  });
});