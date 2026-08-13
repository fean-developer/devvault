import { Command } from 'commander';
import type { ReturnTypeOfComposition } from '../composition-root.js';
import { loadProjectConfig } from '@devvault/config';

export function registerStatusCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program
    .command('status')
    .description('Show the local Vault status')
    .option('--json', 'Print machine-readable JSON')
    .option('--environment <name>', 'Environment override')
    .action(async (options: { json?: boolean; environment?: string }) => {
      const client = await composition.createVaultClient();
      const health = await client.health();
      let authenticated = false;
      let keyringAvailable = true;
      try {
        authenticated = await composition.credentialStore.get('session') !== null;
      } catch {
        keyringAvailable = false;
      }
      const status = {
        project: await loadProjectConfig(process.cwd(), options.environment).then((config) => config.project).catch(() => undefined),
        environment: await loadProjectConfig(process.cwd(), options.environment).then((config) => config.environment).catch(() => undefined),
        vault: {
          address: process.env.VAULT_ADDR ?? 'http://127.0.0.1:8200',
          reachable: true,
          initialized: health.initialized,
          sealed: health.sealed,
        },
        authentication: { authenticated, keyringAvailable },
      };
      process.stdout.write(options.json ? `${JSON.stringify(status)}\n` : formatStatus(status));
    });
}

function formatStatus(status: {
  project?: string;
  environment?: string;
  vault: { address: string; reachable: boolean; initialized: boolean; sealed: boolean };
}): string {
  return [
    'DevVault Status',
    ...(status.project ? [`Project: ${status.project}`] : []),
    ...(status.environment ? [`Environment: ${status.environment}`] : []),
    `Vault: ${status.vault.address}`,
    `Reachable: ${status.vault.reachable ? 'yes' : 'no'}`,
    `Initialized: ${status.vault.initialized ? 'yes' : 'no'}`,
    `Sealed: ${status.vault.sealed ? 'yes' : 'no'}`,
    '',
  ].join('\n');
}