import type {
  DependencyCheckInput,
  DependencyChecker,
  DependencyReport,
} from '@devvault/core';
import { detectPlatform, type PlatformInfo, type PlatformSignals } from './platform-detection.js';
import { DockerComposeManager } from './index.js';
import type { DockerDiagnostics } from './docker-diagnostics.js';

export interface PlatformDependencyCheckerOptions {
  platformSignals?: PlatformSignals;
  diagnoseDocker?: () => Promise<DockerDiagnostics>;
}

export class PlatformDependencyChecker implements DependencyChecker {
  private readonly platform: PlatformInfo;
  private readonly dockerDiagnostics: () => Promise<DockerDiagnostics>;

  constructor(options: PlatformDependencyCheckerOptions = {}) {
    this.platform = detectPlatform(options.platformSignals);
    this.dockerDiagnostics = options.diagnoseDocker ?? (() => new DockerComposeManager().diagnose());
  }

  async check(input: DependencyCheckInput): Promise<DependencyReport> {
    const diagnostics = await this.dockerDiagnostics();
    const capabilities: Record<string, boolean> = {
      platform: this.platform.host !== 'unknown',
      'docker-cli': diagnostics.state !== 'cli-unavailable',
      'docker-daemon': !['cli-unavailable', 'daemon-unavailable'].includes(diagnostics.state),
      'docker-compose': diagnostics.state === 'available',
      'vault-container': diagnostics.vaultContainer === 'running',
    };
    const blockers: string[] = [];
    const warnings: string[] = [];

    if (!capabilities.platform) blockers.push('Platform could not be detected.');
    if (diagnostics.detail) blockers.push(diagnostics.detail);
    if (diagnostics.state === 'available' && diagnostics.vaultContainer !== 'running') {
      blockers.push(`Vault container is ${diagnostics.vaultContainer}.`);
    }
    if (input.metadata?.dockerDesktopRequired === true) {
      blockers.push('Docker Desktop installation or modification is blocked by policy.');
    }
    if (this.platform.isWsl) warnings.push('Running under WSL2; Docker Desktop integration is not inferred from WSL detection alone.');

    return {
      capabilities,
      blockers,
      warnings,
      metadata: {
        platform: this.platform.host,
        isWsl: this.platform.isWsl,
        shell: this.platform.shell,
        dockerState: diagnostics.state,
        vaultContainer: diagnostics.vaultContainer,
      },
    };
  }
}