import { describe, expect, it } from 'vitest';
import type { VaultBackend } from './vault-backend.js';

describe('VaultBackend contract', () => {
  it('supports local and remote implementations without Docker-specific methods', async () => {
    const backends: VaultBackend[] = [
      {
        kind: () => 'local-docker',
        detect: async () => ({ kind: 'local-docker', available: true, capabilities: { canStart: true, canConfigure: true, canValidateKv: true, canValidatePolicy: true } }),
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        validate: async () => ({ lifecycle: 'ready', kvValid: true, policyValid: true }),
      },
      {
        kind: () => 'remote-vault',
        detect: async () => ({ kind: 'remote-vault', available: true, capabilities: { canStart: false, canConfigure: false, canValidateKv: true, canValidatePolicy: true } }),
        health: async () => ({ reachable: true, initialized: true, sealed: false }),
        validate: async () => ({ lifecycle: 'ready', kvValid: true, policyValid: true }),
      },
    ];

    await expect(Promise.all(backends.map((backend) => backend.detect()))).resolves.toHaveLength(2);
    expect(backends[1].kind()).toBe('remote-vault');
  });
});