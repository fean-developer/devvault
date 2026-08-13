import { describe, expect, it } from 'vitest';
import { RemoteVaultBackend } from './remote-vault-backend.js';

describe('RemoteVaultBackend', () => {
  it('accepts an explicit clean endpoint and exposes no Docker capability', async () => {
    const backend = new RemoteVaultBackend({
      address: 'https://vault.example.test/',
      client: { health: async () => ({ initialized: true, sealed: false }) },
    });

    await expect(backend.detect()).resolves.toMatchObject({
      kind: 'remote-vault',
      available: true,
      capabilities: { canStart: false, canConfigure: false },
    });
    expect(backend.address).toBe('https://vault.example.test');
  });

  it('rejects credentials and query parameters in the endpoint', () => {
    for (const address of ['https://user:password@vault.example.test', 'https://vault.example.test?token=value']) {
      expect(() => new RemoteVaultBackend({ address, client: { health: async () => ({ initialized: true, sealed: false }) } })).toThrow();
    }
  });

  it('maps unavailable, not-initialized and sealed health safely', async () => {
    const states = [
      [new Error('timeout'), 'unavailable'],
      [{ initialized: false, sealed: true }, 'not-initialized'],
      [{ initialized: true, sealed: true }, 'sealed'],
    ] as const;
    for (const [health, lifecycle] of states) {
      const backend = new RemoteVaultBackend({
        address: 'https://vault.example.test',
        client: { health: async () => { if (health instanceof Error) throw health; return health; } },
      });
      await expect(backend.validate({ canStart: false, canConfigure: false, canValidateKv: true, canValidatePolicy: true }))
        .resolves.toMatchObject({ lifecycle });
    }
  });

  it('performs no mutating or Docker operation', async () => {
    const calls: string[] = [];
    const backend = new RemoteVaultBackend({
      address: 'https://vault.example.test',
      client: { health: async () => { calls.push('health'); return { initialized: true, sealed: false }; } },
    });
    await backend.detect();
    await backend.validate({ canStart: false, canConfigure: false, canValidateKv: true, canValidatePolicy: true });
    expect(calls).toEqual(['health', 'health']);
  });
});