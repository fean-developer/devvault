import { Command } from 'commander';
import { setupExitCodes, type DeveloperLifecycleService, type LifecycleResult, type StartInput } from '@devvault/core';

export interface StartCommandOptions {
  json?: boolean;
  nonInteractive?: boolean;
  backend?: 'local-docker' | 'remote-vault';
}

export function registerStartCommand(program: Command, lifecycle: DeveloperLifecycleService): void {
  program
    .command('start')
    .description('Prepare the local DevVault development environment')
    .option('--json', 'Print machine-readable output')
    .option('--non-interactive', 'Never prompt for unseal input')
    .option('--backend <backend>', 'Select local-docker or remote-vault')
    .action(async (options: StartCommandOptions) => {
      const result = await runStartCommand(lifecycle, options);
      writeStartResult(result, options.json === true);
      process.exitCode = setupExitCodes[result.status];
    });
}

export async function runStartCommand(
  lifecycle: DeveloperLifecycleService,
  options: StartCommandOptions = {},
): Promise<LifecycleResult> {
  const input: StartInput = {
    mode: options.nonInteractive === true ? 'non-interactive' : 'interactive',
    ...(options.backend ? { preferredBackend: options.backend } : {}),
  };
  return lifecycle.start(input);
}

export function writeStartResult(result: LifecycleResult, json: boolean): void {
  if (json) {
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return;
  }

  process.stdout.write('DevVault\n\n');
  if (result.status === 'READY') {
    process.stdout.write('DevVault is ready.\n');
    return;
  }
  process.stdout.write('DevVault could not prepare the local environment.\n');
  for (const blocker of result.blockers) process.stdout.write(`Reason: ${blocker}\n`);
  process.stdout.write('Run: devvault doctor\n');
}