import { Command } from 'commander';
import { findProjectRoot, listProjectEnvironments, resolveProjectConfig, setActiveEnvironment } from '@devvault/config';

export function registerEnvironmentCommand(program: Command): void {
  const environment = new Command('environment').description('Manage the active project environment');

  environment
    .command('set <name>')
    .action(async (name: string) => {
      const root = await findProjectRoot(process.cwd());
      const environments = await listProjectEnvironments(root);
      if (!environments.includes(name)) throw new Error(`Environment '${name}' does not exist. Available environments: ${environments.join(', ') || '(none)'}`);
      await setActiveEnvironment(root, name);
      process.stdout.write(`Active environment: ${name}\n`);
    });

  environment
    .command('current')
    .action(async () => {
      const root = await findProjectRoot(process.cwd());
      const environments = await listProjectEnvironments(root);
      const context = await resolveProjectConfig(root);
      if (!environments.length) throw new Error('No multi-environment configuration exists.');
      process.stdout.write(`${context.environment}\n`);
    });

  environment
    .command('list')
    .action(async () => {
      const root = await findProjectRoot(process.cwd());
      const environments = await listProjectEnvironments(root);
      process.stdout.write(`${environments.join('\n')}${environments.length ? '\n' : ''}`);
    });

  program.addCommand(environment);
}
