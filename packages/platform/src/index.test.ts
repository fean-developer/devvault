import { describe, expect, it } from 'vitest';
import { DockerComposeManager, resolveKeytarModule } from './index.js';

describe('DockerComposeManager', () => {
  it('exposes Docker availability as a boolean', async () => {
    await expect(new DockerComposeManager().isAvailable()).resolves.toBeTypeOf('boolean');
  });
});

describe('resolveKeytarModule', () => {
  const api = {
    getPassword: async () => null,
    setPassword: async () => undefined,
    deletePassword: async () => true,
  };

  it('supports CommonJS modules exposed through the ESM default export', () => {
    expect(resolveKeytarModule({ default: api })).toBe(api);
  });

  it('supports direct named exports', () => {
    expect(resolveKeytarModule(api)).toBe(api);
  });
});