import { describe, expect, it } from 'vitest';
import { ProfileSetupValidator } from './setup-validator.js';

const context = {
  mode: 'check' as const,
  profile: 'local-bootstrap' as const,
  metadata: {},
};

const complete = {
  platform: true,
  backend: true,
  'vault-lifecycle': true,
  kv: true,
  'setup-state': true,
};

describe('ProfileSetupValidator', () => {
  it('returns READY only when the selected profile is complete', async () => {
    const report = await new ProfileSetupValidator({
      collect: async () => ({ capabilities: complete, blockers: [], warnings: [], metadata: { backend: 'local-docker' } }),
    }).validate(context);

    expect(report.status).toBe('READY');
    expect(report.metadata).toEqual({ backend: 'local-docker' });
  });

  it('returns DEGRADED only for optional capability loss', async () => {
    const report = await new ProfileSetupValidator({
      collect: async () => ({ capabilities: { ...complete, presentation: false }, blockers: [], warnings: ['presentation unavailable'], metadata: {} }),
    }).validate(context);

    expect(report.status).toBe('DEGRADED');
  });

  it('returns BLOCKED for explicit blockers or mandatory false capabilities', async () => {
    const explicit = await new ProfileSetupValidator({
      collect: async () => ({ capabilities: complete, blockers: ['Docker is blocked by policy.'], warnings: [], metadata: {} }),
    }).validate(context);
    const mandatory = await new ProfileSetupValidator({
      collect: async () => ({ capabilities: { ...complete, kv: false }, blockers: [], warnings: [], metadata: {} }),
    }).validate(context);

    expect(explicit.status).toBe('BLOCKED');
    expect(mandatory.status).toBe('BLOCKED');
  });

  it('returns FAILED for missing capabilities, provider failures and sensitive metadata', async () => {
    const missing = await new ProfileSetupValidator({
      collect: async () => ({ capabilities: { platform: true }, blockers: [], warnings: [], metadata: {} }),
    }).validate(context);
    const providerFailure = await new ProfileSetupValidator({
      collect: async () => { throw new Error('credential should not escape'); },
    }).validate(context);
    const sensitive = await new ProfileSetupValidator({
      collect: async () => ({ capabilities: complete, blockers: [], warnings: [], metadata: { token: 'value' } }),
    }).validate(context);

    expect(missing.status).toBe('FAILED');
    expect(providerFailure.status).toBe('FAILED');
    expect(providerFailure.blockers.join()).not.toContain('credential should not escape');
    expect(sensitive.status).toBe('FAILED');
    expect(sensitive.metadata).toEqual({});
  });
});