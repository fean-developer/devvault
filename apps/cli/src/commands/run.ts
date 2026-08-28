import { Command } from 'commander';
import type { ReturnTypeOfComposition } from '../composition-root.js';
import type { ValidatedDeveloperSession } from '@devvault/core';

type SessionRequiredComposition = ReturnTypeOfComposition & {
  requireValidSession?: () => Promise<ValidatedDeveloperSession>;
};

export function registerRunCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program
    .command('run')
    .description('Run a command with secrets from the current project')
    .allowUnknownOption(true)
    .option('--environment <name>', 'Environment override')
    .argument('[command...]', 'Command and arguments after --')
    .action(async (commandArguments: string[], options: { environment?: string }) => {
      if (!commandArguments.length) {
        throw new Error('A command is required. Usage: devvault run -- <command> [args...]');
      }
      const sessionComposition = composition as SessionRequiredComposition;
      const config = await (await composition.createProjectApplication()).load(process.cwd(), options.environment);
      const session = sessionComposition.requireValidSession ? await sessionComposition.requireValidSession() : undefined;
      const application = await composition.createProjectApplication(session);
      const [command, ...args] = commandArguments;
      process.exitCode = await application.run(config, command, args);
    });
}