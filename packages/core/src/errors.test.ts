import { describe, expect, it } from 'vitest';
import {
  AuthorizationDeniedError,
  SessionFailureError,
  VaultPermissionDeniedError,
  VaultAuthenticationError,
  VaultUnavailableError,
} from './index.js';

describe('AuthorizationDeniedError', () => {
  it('carries only the safe operation context', () => {
    const error = new AuthorizationDeniedError({ operation: 'secret.set', project: 'my-api', environment: 'production' });

    expect(error.code).toBe('AUTHORIZATION_DENIED');
    expect(error.operation).toBe('secret.set');
    expect(error.project).toBe('my-api');
    expect(error.environment).toBe('production');
  });

  it('exposes exactly the allowed fields and nothing credential-shaped', () => {
    const error = new AuthorizationDeniedError({ operation: 'run', project: 'my-api', environment: 'development' });
    const ownKeys = Object.keys(error);

    expect(ownKeys.sort()).toEqual(['code', 'environment', 'name', 'operation', 'project'].sort());
    expect(JSON.stringify(error)).not.toMatch(/token|password|credential|authorization header/i);
  });

  it('has a code distinct from raw Vault errors and session failures', () => {
    const authz = new AuthorizationDeniedError({ operation: 'secret.get', project: 'my-api', environment: 'development' });

    expect(authz.code).not.toBe(new VaultPermissionDeniedError().code);
    expect(authz.code).not.toBe(new VaultAuthenticationError().code);
    expect(authz.code).not.toBe(new VaultUnavailableError().code);
    expect(authz.code).not.toBe(new SessionFailureError('SESSION_EXPIRED', 'expired').code);
  });
});
