import { describe, expect, it } from 'vitest';
import { DockerComposeManager } from './index.js';

describe('DockerComposeManager', () => {
  it('exposes Docker availability as a boolean', async () => {
    await expect(new DockerComposeManager().isAvailable()).resolves.toBeTypeOf('boolean');
  });
});