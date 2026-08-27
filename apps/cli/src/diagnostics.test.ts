import { describe, expect, it } from 'vitest';
import { createDoctorReport, formatDoctorReport, reportHasFailures } from './diagnostics.js';

const config = {
  version: 1 as const,
  project: 'my-api',
  environment: 'development',
  vault: { mount: 'secret', path: 'projects/my-api/development' },
  runtime: { mappings: {} },
};

describe('doctor diagnostics', () => {
  it('reports healthy Vault and project without secret values', async () => {
    const report = await createDoctorReport('/project', {
      health: async () => ({ initialized: true, sealed: false }),
      checkCapabilities: async () => ['read'],
    }, async () => config);
    const output = formatDoctorReport(report);

    expect(reportHasFailures(report)).toBe(false);
    expect(report.lifecycle).toBe('ready');
    expect(report.environmentState).toBe('CONFIGURED');
    expect(report.configuration).toBe('FOUND');
    expect(output).toContain('Vault reachable');
    expect(output).toContain('Project: my-api');
    expect(output).not.toContain('password');
  });

  it('reports configuration and Vault failures without throwing', async () => {
    const report = await createDoctorReport('/project', {
      health: async () => {
        throw new Error('Vault is unavailable.');
      },
    }, async () => {
      throw new Error('Project configuration is invalid.');
    }, undefined, undefined, async () => ({
      projectRoot: '/project',
      state: 'INVALID',
    }));

    expect(reportHasFailures(report)).toBe(true);
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Project configuration', ok: false }),
      expect.objectContaining({ name: 'Vault reachable', ok: false }),
    ]));
    expect(report.lifecycle).toBe('unavailable');
    expect(report.configuration).toBe('INVALID');
  });

  it('reports missing project read capability', async () => {
    const report = await createDoctorReport('/project', {
      health: async () => ({ initialized: true, sealed: false }),
      checkCapabilities: async () => ['deny'],
    }, async () => config);

    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Project policy', ok: false }),
    ]));
  });

  it('includes platform and Docker diagnostics when provided', async () => {
    const report = await createDoctorReport('/project', {
      health: async () => ({ initialized: true, sealed: false }),
    }, async () => config, {
      platform: { host: 'linux', isWsl: false, shell: 'bash' },
      docker: { state: 'available', vaultContainer: 'running' },
    });

    expect(report.platform?.host).toBe('linux');
    expect(report.docker?.vaultContainer).toBe('running');
  });

  it('reports selected but unconfigured environment while continuing Vault diagnostics', async () => {
    const report = await createDoctorReport('/project', {
      health: async () => ({ initialized: true, sealed: false }),
    }, async () => { throw new Error('Environment is not configured.'); }, undefined, undefined, async () => ({
      projectRoot: '/project',
      environment: 'staging',
      state: 'SELECTED',
    }));

    expect(report.environmentState).toBe('SELECTED');
    expect(report.configured).toBe(false);
    expect(report.configuration).toBe('NOT_FOUND');
    expect(report.remediation).toBe('init-project');
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Environment configuration', ok: false }),
      expect.objectContaining({ name: 'Vault reachable', ok: true }),
    ]));
    expect(report.lifecycle).toBe('unsealed');
  });

  it('keeps diagnostic JSON free of credentials while exposing environment state', async () => {
    const report = await createDoctorReport('/project', {
      health: async () => ({ initialized: true, sealed: false }),
    }, async () => { throw new Error('not configured'); }, undefined, undefined, async () => ({
      projectRoot: '/project',
      environment: 'staging',
      state: 'SELECTED',
    }));
    const output = JSON.stringify(report);

    expect(output).toContain('"environmentState":"SELECTED"');
    expect(output).not.toMatch(/token|password|secret-value/i);
  });

  it.each([
    ['NOT_SELECTED', { projectRoot: '/project', state: 'NOT_SELECTED' as const }],
    ['SELECTED', { projectRoot: '/project', environment: 'staging', state: 'SELECTED' as const }],
    ['CONFIGURED', { projectRoot: '/project', environment: 'development', state: 'CONFIGURED' as const, config }],
    ['INVALID', { projectRoot: '/project', environment: 'development', state: 'INVALID' as const }],
  ])('serializes the %s environment state without sensitive fields', async (_state, context) => {
    const report = await createDoctorReport('/project', {
      health: async () => ({ initialized: true, sealed: false }),
    }, async () => context.state === 'CONFIGURED' ? config : Promise.reject(new Error('Environment configuration is unavailable.')), undefined, undefined, async () => context);
    const output = JSON.stringify(report);

    expect(report.environmentState).toBe(context.state);
    expect(report.configured).toBe(context.state === 'CONFIGURED');
    expect(output).not.toMatch(/token|password|secret-value|authorization|unseal-key/i);
  });
});