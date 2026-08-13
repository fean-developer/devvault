import { Command } from 'commander';
import type { ReturnTypeOfComposition } from '../composition-root.js';

export function registerStatusCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program
    .command('status')
    .description('Show the local Vault status')
    .option('--json', 'Print machine-readable JSON')
    .action(async (options: { json?: boolean }) => {
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
  vault: { address: string; reachable: boolean; initialized: boolean; sealed: boolean };
}): string {
  return [
    'DevVault Status',
    `Vault: ${status.vault.address}`,
    `Reachable: ${status.vault.reachable ? 'yes' : 'no'}`,
    `Initialized: ${status.vault.initialized ? 'yes' : 'no'}`,
    `Sealed: ${status.vault.sealed ? 'yes' : 'no'}`,
    '',
  ].join('\n');
}