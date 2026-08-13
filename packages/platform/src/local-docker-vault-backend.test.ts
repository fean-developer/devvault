import { describe, expect, it } from 'vitest';
import { LocalDockerVaultBackend } from './local-docker-vault-backend.js';

function backend(
  docker: { state: 'available' | 'daemon-unavailable'; vaultContainer: 'running' | 'stopped' | 'missing' },
  health: { initialized: boolean; sealed: boolean } | Error,
  effective: { kv: boolean; read: boolean } = { kv: true, read: true },
) {
  return new LocalDockerVaultBackend({
    docker: {
      composeUp: async () => undefined,
      isAvailable: async () => docker.state === 'available',
      diagnose: async () => docker.state === 'available'
        ? { state: 'available', vaultContainer: docker.vaultContainer }
        : { state: 'daemon-unavailable', vaultContainer: 'unknown', detail: 'Docker daemon is unavailable.' },
    },
    vault: {
      health: async () => {
        if (health instanceof Error) throw health;
        return health;
      },
      validateKvV2: async () => effective.kv,
      checkCapabilities: async () => effective.read ? ['read'] : [],
    },
  });
}

describe('LocalDockerVaultBackend', () => {
  it('detects an available running local Vault', async () => {
    await expect(backend({ state: 'available', vaultContainer: 'running' }, { initialized: true, sealed: false }).detect())
      .resolves.toMatchObject({ available: true, capabilities: { canValidateKv: true, canValidatePolicy: true } });
  });

  it('detects Docker daemon and container failures without mutation', async () => {
    await expect(backend({ state: 'daemon-unavailable', vaultContainer: 'missing' }, { initialized: false, sealed: true }).detect())
      .resolves.toMatchObject({ available: false, detail: 'Docker daemon is unavailable.' });
    await expect(backend({ state: 'available', vaultContainer: 'stopped' }, { initialized: false, sealed: true }).detect())
      .resolves.toMatchObject({ available: false, detail: 'Vault container is stopped.' });
  });

  it.each([
    [{ initialized: false, sealed: true }, 'not-initialized'],
    [{ initialized: true, sealed: true }, 'sealed'],
    [{ initialized: true, sealed: false }, 'configured'],
  ] as const)('maps Vault health %s to %s', async (health, lifecycle) => {
    await expect(backend({ state: 'available', vaultContainer: 'running' }, health).validate({
      canStart: true, canConfigure: true, canValidateKv: true, canValidatePolicy: true,
    })).resolves.toMatchObject({ lifecycle });
  });

  it('maps transport failure to unavailable', async () => {
    await expect(backend({ state: 'available', vaultContainer: 'running' }, new Error('down')).health())
      .resolves.toEqual({ reachable: false, initialized: false, sealed: true });
  });

  it('requires effective KV and capability checks even when static flags are true', async () => {
    await expect(backend({ state: 'available', vaultContainer: 'running' }, { initialized: true, sealed: false }, { kv: false, read: true }).validate({
      canStart: true, canConfigure: true, canValidateKv: true, canValidatePolicy: true,
    })).resolves.toMatchObject({ lifecycle: 'unsealed', kvValid: false, policyValid: true });
    await expect(backend({ state: 'available', vaultContainer: 'running' }, { initialized: true, sealed: false }, { kv: true, read: false }).validate({
      canStart: true, canConfigure: true, canValidateKv: true, canValidatePolicy: true,
    })).resolves.toMatchObject({ lifecycle: 'unsealed', kvValid: true, policyValid: false });
  });
});