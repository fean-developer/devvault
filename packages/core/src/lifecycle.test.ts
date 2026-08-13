import { describe, expect, it } from 'vitest';
import { classifyVaultLifecycle } from './lifecycle.js';

describe('Vault lifecycle', () => {
  it.each([
    [{ reachable: false, initialized: false, sealed: true }, 'unavailable'],
    [{ reachable: true, initialized: false, sealed: true }, 'not-initialized'],
    [{ reachable: true, initialized: true, sealed: true }, 'sealed'],
    [{ reachable: true, initialized: true, sealed: false }, 'unsealed'],
    [{ reachable: true, initialized: true, sealed: false, configured: true }, 'configured'],
    [{ reachable: true, initialized: true, sealed: false, configured: true, authenticated: true, authorized: true }, 'ready'],
  ] as const)('classifies %s as %s', (input, state) => {
    expect(classifyVaultLifecycle(input).state).toBe(state);
  });
});