import { Command } from 'commander';
import { basename } from 'node:path';
import type { ReturnTypeOfComposition } from '../composition-root.js';
import { readSecretFromProcess } from '../input.js';
import { readUsername } from './auth.js';

export function registerBootstrapCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program.command('bootstrap')
    .description('Enable Userpass and create a human identity without storing bootstrap secrets')
    .option('-u, --username <username>', 'Initial Userpass username')
    .option('-e, --environment <name>', 'Policy environment', 'development')
    .action(async (options: { username?: string; environment: string }) => {
      if (!process.env.VAULT_TOKEN) throw new Error('Bootstrap requires an explicit administrative VAULT_TOKEN.');
      const client = await composition.createVaultClient();
      const health = await client.health();
      if (!health.initialized) throw new Error('Vault operator initialization is required before devvault bootstrap. Do not store unseal keys or the root token in the project.');
      if (health.sealed) throw new Error('Vault is sealed. Unseal it with the operator procedure before devvault bootstrap.');
      await client.ensureUserpass();
      const username = options.username ?? await readUsername();
      process.stderr.write(`Password for Userpass user ${username}: `);
      const password = await readSecretFromProcess();
      const project = basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      await client.createUserpassUser(username, password, [`devvault-${project}-${options.environment}-developer`]);
      process.stdout.write(`Userpass identity created: ${username}\n`);
    });
}