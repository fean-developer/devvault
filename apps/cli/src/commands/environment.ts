import { Command } from 'commander';
import { findProjectRoot, listProjectEnvironments, resolveEnvironmentContext, setActiveEnvironment } from '@devvault/config';

export async function runEnvironmentSet(name: string, directory = process.cwd()): Promise<void> {
  const root = await findProjectRoot(directory, true);
  await setActiveEnvironment(root, name);
  const context = await resolveEnvironmentContext(root, undefined, { mode: 'diagnostic' });
  process.stdout.write(`Active environment: ${name}\nState: ${context.state}\n`);
}

export async function runEnvironmentCurrent(directory = process.cwd()): Promise<void> {
  const root = await findProjectRoot(directory, true);
  const context = await resolveEnvironmentContext(root, undefined, { mode: 'diagnostic' });
  if (context.state === 'NOT_SELECTED') throw new Error('No environment selected.');
  process.stdout.write(`Environment: ${context.environment}\nState: ${context.state}\n`);
}

export async function runEnvironmentList(directory = process.cwd()): Promise<void> {
  const root = await findProjectRoot(directory, true);
  const environments = await listProjectEnvironments(root);
  const context = await resolveEnvironmentContext(root, undefined, { mode: 'diagnostic' });
  const lines = environments.map((name) => `${name}${name === context.environment ? ` ${context.state} ACTIVE` : ' CONFIGURED'}`);
  if (context.state === 'SELECTED' && context.environment && !environments.includes(context.environment)) {
    lines.push(`${context.environment} SELECTED NOT_CONFIGURED ACTIVE`);
  }
  process.stdout.write(`${lines.join('\n')}${lines.length ? '\n' : ''}`);
}

export function registerEnvironmentCommand(program: Command): void {
  const environment = new Command('environment').description('Manage the active project environment');

  environment
    .command('set <name>')
    .action(runEnvironmentSet);

  environment
    .command('current')
    .action(runEnvironmentCurrent);

  environment
    .command('list')
    .action(runEnvironmentList);

  program.addCommand(environment);
}
