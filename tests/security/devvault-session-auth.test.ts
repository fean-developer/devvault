import { describe, expect, it } from 'vitest';
import { SessionResolver } from '../../packages/core/src/session-resolver.js';
import { createDoctorReport } from '../../apps/cli/src/diagnostics.js';

describe('Session/Auth security boundaries', () => {
  it('does not let VAULT_TOKEN create a developer session', async () => {
    const previous = process.env.VAULT_TOKEN;
    process.env.VAULT_TOKEN = 'admin-token';
    try {
      const resolver = new SessionResolver(
        { read: async () => null },
        { validate: async () => ({ outcome: 'VALID' as const }) },
        { backendIdentity: 'http://security.test' },
      );

      await expect(resolver.resolve()).resolves.toMatchObject({ state: 'NOT_AUTHENTICATED', credentialSource: 'NONE' });
    } finally {
      if (previous === undefined) delete process.env.VAULT_TOKEN;
      else process.env.VAULT_TOKEN = previous;
    }
  });

  it('keeps credentials out of diagnostics and safe session summaries', async () => {
    const report = await createDoctorReport('/project', {
      health: async () => ({ initialized: true, sealed: false }),
    }, async () => ({
      version: 1 as const,
      project: 'my-api',
      environment: 'development',
      vault: { mount: 'secret', path: 'projects/my-api/development' },
      runtime: { mappings: {} },
    }), undefined, undefined, undefined, {
      observe: async () => ({ state: 'ACTIVE', username: 'alice', validation: 'REMOTE_CONFIRMED' }),
    });
    const serialized = JSON.stringify(report);

    expect(serialized).toContain('alice');
    expect(serialized).not.toMatch(/alice-token|admin-token|password|authorization|unseal-key/i);
    expect(report.session).toEqual({ state: 'ACTIVE', username: 'alice', validation: 'REMOTE_CONFIRMED' });
  });
});