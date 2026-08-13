import { describe, expect, it } from 'vitest';
import { CapabilityBackendSelector } from './backend-selector.js';
import type { VaultBackend } from './vault-backend.js';

function backend(kind: 'local-docker' | 'remote-vault', available: boolean, calls: string[]): VaultBackend {
  return {
    kind: () => kind,
    detect: async () => {
      calls.push(`${kind}:detect`);
      return {
        kind,
        available,
        capabilities: { canStart: kind === 'local-docker', canConfigure: kind === 'local-docker', canValidateKv: available, canValidatePolicy: available },
      };
    },
    health: async () => ({ reachable: available, initialized: available, sealed: !available }),
    validate: async () => ({ lifecycle: available ? 'configured' : 'unavailable', kvValid: available, policyValid: available }),
  };
}

describe('CapabilityBackendSelector', () => {
  it('selects available local backend first', async () => {
    const calls: string[] = [];
    const result = await new CapabilityBackendSelector().select({
      local: backend('local-docker', true, calls),
      remote: backend('remote-vault', true, calls),
    });
    expect(result.backend?.kind()).toBe('local-docker');
    expect(calls).toEqual(['local-docker:detect']);
  });

  it('selects remote only when explicitly available after local fails', async () => {
    const calls: string[] = [];
    const remote = backend('remote-vault', true, calls);
    const result = await new CapabilityBackendSelector().select({
      local: backend('local-docker', false, calls),
      remote,
    });
    expect(result.backend).toBe(remote);
    expect(calls).toEqual(['local-docker:detect', 'remote-vault:detect']);
  });

  it('blocks when no backend is viable', async () => {
    const result = await new CapabilityBackendSelector().select({
      local: backend('local-docker', false, []),
      remote: backend('remote-vault', false, []),
    });
    expect(result.backend).toBeUndefined();
    expect(result.blockers).toEqual(['No viable Vault backend is available.']);
  });

  it('does not use an unconfigured remote backend or Docker operations for explicit remote', async () => {
    const calls: string[] = [];
    const result = await new CapabilityBackendSelector().select({
      preferred: 'remote-vault',
      local: backend('local-docker', true, calls),
    });
    expect(result.backend).toBeUndefined();
    expect(result.blockers[0]).toContain('not configured');
    expect(calls).toEqual([]);
  });
});