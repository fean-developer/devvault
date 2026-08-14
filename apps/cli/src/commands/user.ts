import { Command } from 'commander';
import type { ReturnTypeOfComposition } from '../composition-root.js';
import { readSecretFromProcess } from '../input.js';

export function registerUserCommand(program: Command, composition: ReturnTypeOfComposition): void {
  const user = new Command('user').description('Manage local developer identities');
  user.command('create')
    .requiredOption('-u, --username <username>', 'Userpass username')
    .action(async (options: { username: string }) => {
      const password = await readSecretFromProcess(`Password for ${options.username}: `);
      await composition.createLocalDeveloperUser(options.username, password);
      process.stdout.write(`Developer user created: ${options.username}\n`);
    });
  program.addCommand(user);
}