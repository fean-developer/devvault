import { Command } from 'commander';
import { join } from 'node:path';
import type { ReturnTypeOfComposition } from '../composition-root.js';

export function registerInitCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program.command('init')
    .description('Start and prepare the local Vault without destroying existing data')
    .action(async () => {
      if (!(await composition.docker.isAvailable())) {
        throw new Error('Docker Compose is unavailable. Start Docker Desktop or install Docker Compose.');
      }
      await composition.docker.composeUp(join(process.cwd(), 'infra/vault/docker-compose.yml'));
      const client = await composition.createVaultClient();
      const health = await client.health();
      if (!health.initialized) throw new Error('Vault is running but not initialized. Initialize it with the Vault operator and run devvault init again.');
      if (health.sealed) throw new Error('Vault is initialized but sealed. Unseal it and run devvault init again.');
      if (!process.env.VAULT_TOKEN) throw new Error('Vault is ready. Set VAULT_TOKEN before configuring KV v2.');
      await client.ensureKvV2('secret');
      process.stdout.write('Vault is running and KV v2 is ready.\n');
    });
}