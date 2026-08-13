import { Command } from 'commander';
import type { ReturnTypeOfComposition } from '../composition-root.js';

export function registerRunCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program
    .command('run')
    .description('Run a command with secrets from the current project')
    .allowUnknownOption(true)
    .argument('[command...]', 'Command and arguments after --')
    .action(async (commandArguments: string[]) => {
      if (!commandArguments.length) {
        throw new Error('A command is required. Usage: devvault run -- <command> [args...]');
      }
      const application = await composition.createProjectApplication();
      const config = await application.load(process.cwd());
      const [command, ...args] = commandArguments;
      process.exitCode = await application.run(config, command, args);
    });
}