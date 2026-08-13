import { Command } from 'commander';
import { createInterface } from 'node:readline/promises';
import type { ReturnTypeOfComposition } from '../composition-root.js';
import { readSecretFromProcess } from '../input.js';

export function registerAuthCommands(program: Command, composition: ReturnTypeOfComposition): void {
  program.command('login')
    .description('Authenticate a developer with Vault Userpass')
    .option('-u, --username <username>', 'Vault Userpass username')
    .action(async (options: { username?: string }) => {
      const username = options.username ?? await readUsername();
      const token = await composition.createDeveloperAuthentication().login(username, await readSecretFromProcess());
      await composition.credentialStore.set('session', token);
      process.stdout.write(`Logged in as ${username}.\n`);
    });

  program.command('logout')
    .description('Revoke the current developer Vault session')
    .action(async () => {
      const token = await composition.credentialStore.get('session');
      if (token) {
        await composition.createDeveloperAuthentication().logout(token);
        await composition.credentialStore.delete('session');
      }
      process.stdout.write('Logged out.\n');
    });
}

export async function readUsername(): Promise<string> {
  const readline = createInterface({ input: process.stdin, output: process.stderr });
  try {
    return await readline.question('Vault username: ');
  } finally {
    readline.close();
  }
}