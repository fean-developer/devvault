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
      throw new Error('Could not find devvault.yaml from the current directory.');
    });

    expect(reportHasFailures(report)).toBe(true);
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Project configuration', ok: false }),
      expect.objectContaining({ name: 'Vault reachable', ok: false }),
    ]));
    expect(report.lifecycle).toBe('unavailable');
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
    expect(report.checks).toEqual(expect.arrayContaining([
      expect.objectContaining({ name: 'Environment configuration', ok: false }),
      expect.objectContaining({ name: 'Vault reachable', ok: true }),
    ]));
    expect(report.lifecycle).toBe('unsealed');
  });
});