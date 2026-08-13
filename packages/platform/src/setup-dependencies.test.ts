import { describe, expect, it } from 'vitest';
import { PlatformDependencyChecker } from './setup-dependencies.js';

describe('PlatformDependencyChecker', () => {
  it('distinguishes Docker capabilities and reports a running Vault container', async () => {
    const checker = new PlatformDependencyChecker({
      platformSignals: { platform: 'linux', kernelRelease: '6.8.0', env: { SHELL: '/bin/bash' } },
      diagnoseDocker: async () => ({ state: 'available', vaultContainer: 'running' }),
    });
    const report = await checker.check({ profile: 'local-bootstrap' });

    expect(report.capabilities).toEqual({
      platform: true,
      'docker-cli': true,
      'docker-daemon': true,
      'docker-compose': true,
      'vault-container': true,
    });
    expect(report.blockers).toEqual([]);
  });

  it('reports dependency failures without attempting installation', async () => {
    const checker = new PlatformDependencyChecker({
      platformSignals: { platform: 'linux', kernelRelease: '6.8.0', env: {} },
      diagnoseDocker: async () => ({ state: 'daemon-unavailable', vaultContainer: 'unknown', detail: 'Docker daemon is unavailable.' }),
    });
    const report = await checker.check({ profile: 'local-bootstrap' });

    expect(report.capabilities['docker-daemon']).toBe(false);
    expect(report.blockers).toContain('Docker daemon is unavailable.');
  });

  it('blocks Docker Desktop mutation and never invokes an installer', async () => {
    const checker = new PlatformDependencyChecker({
      platformSignals: { platform: 'linux', kernelRelease: '6.8.0', env: {} },
      diagnoseDocker: async () => ({ state: 'available', vaultContainer: 'running' }),
    });
    const report = await checker.check({ profile: 'local-bootstrap', metadata: { dockerDesktopRequired: true } });

    expect(report.blockers).toContain('Docker Desktop installation or modification is blocked by policy.');
  });
});