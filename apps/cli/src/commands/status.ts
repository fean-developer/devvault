import { Command } from 'commander';
import type { ReturnTypeOfComposition } from '../composition-root.js';
import { resolveEnvironmentContext, type EnvironmentContextState } from '@devvault/config';

export interface StatusReport {
  project?: string;
  environment: string | null;
  environmentState: EnvironmentContextState;
  configured: boolean;
  configValid: boolean;
  configPath?: string;
  protected?: boolean;
  configuration: 'FOUND' | 'NOT_FOUND' | 'INVALID';
  blockers: string[];
  warnings: string[];
  vault: {
    address: string;
    reachable: boolean;
    initialized: boolean;
    sealed: boolean;
    lifecycle: 'UNAVAILABLE' | 'NOT_INITIALIZED' | 'SEALED' | 'READY';
  };
  authentication: { authenticated: boolean; keyringAvailable: boolean };
}

export function registerStatusCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program
    .command('status')
    .description('Show the local Vault status')
    .option('--json', 'Print machine-readable JSON')
    .option('--environment <name>', 'Environment override')
    .action(async (options: { json?: boolean; environment?: string }) => {
      const client = await composition.createVaultClient();
      const warnings: string[] = [];
      let health = { initialized: false, sealed: true };
      let reachable = true;
      try { health = await client.health(); } catch (error) {
        reachable = false;
        warnings.push(error instanceof Error ? error.message : 'Vault is unavailable.');
      }
      const context = await resolveEnvironmentContext(process.cwd(), options.environment, { mode: 'diagnostic', allowCandidateRoot: true }).catch(() => undefined);
      let authenticated = false;
      let keyringAvailable = true;
      try {
        authenticated = await composition.credentialStore.get('session') !== null;
      } catch {
        keyringAvailable = false;
      }
      const environmentState = context?.state ?? 'INVALID';
      const status: StatusReport = {
        project: context?.config?.project,
        environment: context?.environment ?? null,
        environmentState,
        configured: environmentState === 'CONFIGURED',
        configValid: environmentState === 'CONFIGURED',
        ...(context?.configPath ? { configPath: context.configPath } : {}),
        ...(context?.config ? { protected: context.config.protected === true } : {}),
        configuration: environmentState === 'CONFIGURED' ? 'FOUND' : environmentState === 'INVALID' ? 'INVALID' : 'NOT_FOUND',
        blockers: environmentState === 'SELECTED' && context?.environment
          ? [`Environment '${context.environment}' is selected but not configured. Run: devvault init-project`]
          : [],
        warnings,
        vault: {
          address: process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200',
          reachable,
          initialized: health.initialized,
          sealed: health.sealed,
          lifecycle: !reachable ? 'UNAVAILABLE' : !health.initialized ? 'NOT_INITIALIZED' : health.sealed ? 'SEALED' : 'READY',
        },
        authentication: { authenticated, keyringAvailable },
      };
      process.stdout.write(options.json ? `${JSON.stringify(status)}\n` : formatStatus(status));
    });
}

export function formatStatus(status: {
  project?: string;
  environment: string | null;
  environmentState: string;
  configured: boolean;
  configuration: string;
  vault: { address: string; reachable: boolean; initialized: boolean; sealed: boolean; lifecycle: string };
}): string {
  return [
    'DevVault Status',
    ...(status.project ? [`Project: ${status.project}`] : []),
    `Environment: ${status.environment ?? '(none)'}`,
    `Environment state: ${status.environmentState}`,
    `Configuration: ${status.configuration}`,
    `Vault: ${status.vault.address}`,
    `Reachable: ${status.vault.reachable ? 'yes' : 'no'}`,
    `Initialized: ${status.vault.initialized ? 'yes' : 'no'}`,
    `Sealed: ${status.vault.sealed ? 'yes' : 'no'}`,
    '',
  ].join('\n');
}