import { describe, expect, it } from 'vitest';
import {
  AuthorizationDeniedError,
  VaultAuthenticationError,
  VaultPermissionDeniedError,
  VaultUnavailableError,
} from './errors.js';
import { classifyVaultOperationError } from './authorization-errors.js';

const context = { operation: 'secret.get' as const, project: 'my-api', environment: 'development' };

describe('classifyVaultOperationError', () => {
  it('translates a Vault permission denial into AuthorizationDeniedError', () => {
    expect(() => classifyVaultOperationError(new VaultPermissionDeniedError(), context))
      .toThrowError(AuthorizationDeniedError);
  });

  it('rethrows an authentication failure unchanged (401 stays Session/Auth-owned)', () => {
    const original = new VaultAuthenticationError();
    try {
      classifyVaultOperationError(original, context);
      throw new Error('expected classifyVaultOperationError to throw');
    } catch (thrown) {
      expect(thrown).toBe(original);
      expect(thrown).not.toBeInstanceOf(AuthorizationDeniedError);
    }
  });

  it('rethrows an unavailable error unchanged (503 stays infrastructure-owned)', () => {
    const original = new VaultUnavailableError();
    try {
      classifyVaultOperationError(original, context);
      throw new Error('expected classifyVaultOperationError to throw');
    } catch (thrown) {
      expect(thrown).toBe(original);
      expect(thrown).not.toBeInstanceOf(AuthorizationDeniedError);
    }
  });

  it('rethrows an unrelated error unchanged instead of swallowing it', () => {
    const original = new Error('unrelated');
    try {
      classifyVaultOperationError(original, context);
      throw new Error('expected classifyVaultOperationError to throw');
    } catch (thrown) {
      expect(thrown).toBe(original);
    }
  });
});
