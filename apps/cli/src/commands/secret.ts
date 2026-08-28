import { Command } from 'commander';
import type { ReturnTypeOfComposition } from '../composition-root.js';
import { confirmMutation, readSecretFromProcess } from '../input.js';
import type { ValidatedDeveloperSession } from '@devvault/core';

type SessionRequiredComposition = ReturnTypeOfComposition & {
  requireValidSession?: () => Promise<ValidatedDeveloperSession>;
};

async function requireDeveloperSession(composition: ReturnTypeOfComposition): Promise<ValidatedDeveloperSession | undefined> {
  const sessionComposition = composition as SessionRequiredComposition;
  return sessionComposition.requireValidSession ? sessionComposition.requireValidSession() : undefined;
}

export async function runSecretSet(
  composition: ReturnTypeOfComposition,
  key: string,
  options: { environment?: string; yes?: boolean },
  dependencies: { confirm: (prompt: string) => Promise<boolean>; readSecret: (prompt: string) => Promise<string> } = {
    confirm: confirmMutation,
    readSecret: readSecretFromProcess,
  },
): Promise<void> {
  const config = await (await composition.createProjectApplication()).load(process.cwd(), options.environment);
  const session = await requireDeveloperSession(composition);
  const application = await composition.createProjectApplication(session);
  if (config.protected && !options.yes && !await dependencies.confirm(`Current environment: ${config.environment}. This operation will modify a protected environment. Continue?`)) throw new Error('Protected environment mutation was not authorized.');
  await application.setSecret(config, key, await dependencies.readSecret(`Secret value for ${key}: `));
  process.stdout.write(`Secret stored: ${key}\n`);
}

export function registerSecretCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program
    .command('secret')
    .description('Manage project secrets in Vault')
    .addCommand(new Command('set')
      .argument('<key>', 'Secret key, for example database.password')
      .option('--environment <name>', 'Environment override')
      .option('--yes', 'Confirm protected-environment mutation')
      .action((key: string, options: { environment?: string; yes?: boolean }) => runSecretSet(composition, key, options)))
    .addCommand(new Command('get')
      .argument('<key>', 'Secret key')
      .option('--environment <name>', 'Environment override')
      .option('--show', 'Print the secret value explicitly')
      .action(async (key: string, options: { show?: boolean; environment?: string }) => {
        const config = await (await composition.createProjectApplication()).load(process.cwd(), options.environment);
        const session = await requireDeveloperSession(composition);
        const application = await composition.createProjectApplication(session);
        const value = await application.getSecret(config, key);
        if (value === undefined) throw new Error(`Secret not found: ${key}`);
        process.stdout.write(options.show ? `${value}\n` : 'Secret exists. Use --show to display it.\n');
      }))
    .addCommand(new Command('list')
      .option('--environment <name>', 'Environment override')
      .action(async (options: { environment?: string }) => {
        const config = await (await composition.createProjectApplication()).load(process.cwd(), options.environment);
        const session = await requireDeveloperSession(composition);
        const application = await composition.createProjectApplication(session);
        const keys = await application.listSecrets(config);
        process.stdout.write(`${keys.join('\n')}${keys.length ? '\n' : ''}`);
      }))
    .addCommand(new Command('delete')
      .argument('<key>', 'Secret key')
      .option('--yes', 'Confirm deletion')
      .option('--environment <name>', 'Environment override')
      .action(async (key: string, options: { yes?: boolean; environment?: string }) => {
        if (!options.yes) throw new Error('Deletion requires --yes.');
        const config = await (await composition.createProjectApplication()).load(process.cwd(), options.environment);
        const session = await requireDeveloperSession(composition);
        const application = await composition.createProjectApplication(session);
        if (!await application.deleteSecret(config, key)) throw new Error(`Secret not found: ${key}`);
        process.stdout.write(`Secret deleted: ${key}\n`);
      }));
}