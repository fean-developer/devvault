import { Command } from 'commander';
import { setupExitCodes, type DeveloperLifecycleService, type LifecycleProgressEvent, type LifecycleResult, type StartInput } from '@devvault/core';

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
    progress: options.json ? undefined : renderProgress,
    ...(options.backend ? { preferredBackend: options.backend } : {}),
  };
  return lifecycle.start(input);
}

function renderProgress(event: LifecycleProgressEvent): void {
  if (event.state === 'start') process.stdout.write(`⠼ ${event.message}\n`);
  else process.stdout.write(`✓ ${event.message}\n`);
}

export function writeStartResult(result: LifecycleResult, json: boolean): void {
  const safeResult = sanitizeStartResult(result);
  if (json) {
    process.stdout.write(`${JSON.stringify(safeResult)}\n`);
    return;
  }

  process.stdout.write('DevVault\n\n');
  if (safeResult.status === 'READY') {
    process.stdout.write('✓ DevVault is ready.\n');
    return;
  }
  process.stdout.write('DevVault could not prepare the local environment.\n');
  for (const blocker of safeResult.blockers) process.stdout.write(`Reason: ${blocker}\n`);
  process.stdout.write('Run: devvault doctor\n');
}

export function sanitizeStartResult(result: LifecycleResult): LifecycleResult {
  return {
    ...result,
    blockers: result.blockers.map((value) => sanitizeText(value)),
    warnings: result.warnings.map((value) => sanitizeText(value)),
    metadata: Object.fromEntries(
      Object.entries(result.metadata).map(([key, value]) => [key, typeof value === 'string' ? sanitizeText(value) : value]),
    ),
  };
}

function sanitizeText(value: string): string {
  return value.replace(/(password|token|secret|secretid|unseal(?:[ _-]key)?\b|recovery(?:[ _-]key)?\b|rootcredential|authorization|bearer)[^\s]*/gi, '[redacted]');
}