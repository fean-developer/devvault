import { Command } from 'commander';
import type { ReturnTypeOfComposition } from '../composition-root.js';
import { readSecretFromProcess } from '../input.js';

export function registerSecretCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program
    .command('secret')
    .description('Manage project secrets in Vault')
    .addCommand(new Command('set')
      .argument('<key>', 'Secret key, for example database.password')
      .action(async (key: string) => {
        const application = await composition.createProjectApplication();
        const config = await application.load(process.cwd());
        await application.setSecret(config, key, await readSecretFromProcess(`Secret value for ${key}: `));
        process.stdout.write(`Secret stored: ${key}\n`);
      }))
    .addCommand(new Command('get')
      .argument('<key>', 'Secret key')
      .option('--show', 'Print the secret value explicitly')
      .action(async (key: string, options: { show?: boolean }) => {
        const application = await composition.createProjectApplication();
        const config = await application.load(process.cwd());
        const value = await application.getSecret(config, key);
        if (value === undefined) throw new Error(`Secret not found: ${key}`);
        process.stdout.write(options.show ? `${value}\n` : 'Secret exists. Use --show to display it.\n');
      }))
    .addCommand(new Command('list')
      .action(async () => {
        const application = await composition.createProjectApplication();
        const config = await application.load(process.cwd());
        const keys = await application.listSecrets(config);
        process.stdout.write(`${keys.join('\n')}${keys.length ? '\n' : ''}`);
      }))
    .addCommand(new Command('delete')
      .argument('<key>', 'Secret key')
      .option('--yes', 'Confirm deletion')
      .action(async (key: string, options: { yes?: boolean }) => {
        if (!options.yes) throw new Error('Deletion requires --yes.');
        const application = await composition.createProjectApplication();
        const config = await application.load(process.cwd());
        if (!await application.deleteSecret(config, key)) throw new Error(`Secret not found: ${key}`);
        process.stdout.write(`Secret deleted: ${key}\n`);
      }));
}