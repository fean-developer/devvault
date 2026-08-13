import { mkdtemp, readFile, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { LocalBootstrapMaterialFileStore } from './local-bootstrap-material-store.js';

describe('LocalBootstrapMaterialFileStore', () => {
  it('stores and loads bootstrap material in the configured infrastructure boundary', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devvault-bootstrap-'));
    const store = new LocalBootstrapMaterialFileStore({
      composeUp: async () => undefined,
      isAvailable: async () => true,
      diagnose: async () => ({ state: 'available', dockerCli: true, daemon: true, compose: true, vaultContainer: 'running' }),
      volumeMountpoint: async () => directory,
    });

    await store.save({ rootToken: 'internal-root', unsealKey: 'internal-unseal' });

    await expect(store.load()).resolves.toEqual({ rootToken: 'internal-root', unsealKey: 'internal-unseal' });
    const path = join(directory, 'bootstrap.json');
    expect(JSON.parse(await readFile(path, 'utf8'))).toEqual({ rootToken: 'internal-root', unsealKey: 'internal-unseal' });
    expect((await stat(path)).mode & 0o777).toBe(0o600);
  });

  it('returns null when the dedicated boundary has no bootstrap material', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devvault-bootstrap-empty-'));
    const store = new LocalBootstrapMaterialFileStore({
      composeUp: async () => undefined,
      isAvailable: async () => true,
      diagnose: async () => ({ state: 'available', dockerCli: true, daemon: true, compose: true, vaultContainer: 'running' }),
      volumeMountpoint: async () => directory,
    });

    await expect(store.load()).resolves.toBeNull();
  });
});
