import { describe, expect, it } from 'vitest';
import { sanitizeSetupMetadata, validateSetupState } from './setup-state.js';

const validState = {
  schemaVersion: 1,
  status: 'READY' as const,
  profile: 'local-bootstrap' as const,
  platform: { host: 'linux', isWsl: true, shell: 'bash' },
  backend: 'local-docker' as const,
  vaultAddress: 'http://127.0.0.1:8200',
  kvMount: 'secret',
  completedSteps: ['platform'],
  pendingSteps: [],
  lastErrorCode: undefined,
  updatedAt: '2026-08-12T00:00:00.000Z',
};

describe('SetupState', () => {
  it('accepts the strict non-sensitive allowlist', () => {
    expect(validateSetupState(validState)).toEqual(validState);
  });

  it('rejects unknown fields and every credential category', () => {
    const forbidden = ['password', 'token', 'secretId', 'authorization', 'unseal', 'recovery', 'rootCredential'];
    expect(() => validateSetupState({ ...validState, unexpected: true })).toThrow('Unknown setup state field');
    for (const key of forbidden) {
      expect(() => validateSetupState({ ...validState, [key]: 'value' })).toThrow();
    }
  });

  it('rejects sensitive values and credential-bearing URLs', () => {
    expect(() => validateSetupState({ ...validState, vaultAddress: 'https://user:password@example.test' })).toThrow();
    expect(() => validateSetupState({ ...validState, lastErrorCode: 'token=leaked' })).toThrow();
  });

  it('sanitizes metadata by rejecting sensitive keys and values', () => {
    expect(sanitizeSetupMetadata({ step: 'platform', retry: 1 })).toEqual({ step: 'platform', retry: 1 });
    expect(() => sanitizeSetupMetadata({ password: 'value' })).toThrow();
    expect(() => sanitizeSetupMetadata({ detail: 'token leaked' })).toThrow();
  });
});