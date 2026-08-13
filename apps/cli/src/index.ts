import { Command } from 'commander';
import { createCompositionRoot } from './composition-root.js';
import { registerRunCommand } from './commands/run.js';
import { registerSecretCommand } from './commands/secret.js';
import { registerStatusCommand } from './commands/status.js';
import { registerDoctorCommand } from './commands/doctor.js';
import { registerInitCommand } from './commands/init.js';
import { registerProjectCommand } from './commands/project.js';
import { registerBootstrapCommand } from './commands/bootstrap.js';
import { registerAuthCommands } from './commands/auth.js';
import { createSetupDependencies, registerSetupCommand } from './commands/setup.js';
import { registerStartCommand } from './commands/start.js';
import { registerEnvironmentCommand } from './commands/environment.js';

const program = new Command();
const composition = createCompositionRoot();

registerRunCommand(program, composition);
registerSecretCommand(program, composition);
registerStatusCommand(program, composition);
registerDoctorCommand(program, composition);
registerInitCommand(program, composition);
registerProjectCommand(program, composition);
registerBootstrapCommand(program, composition);
registerAuthCommands(program, composition);
registerSetupCommand(program, createSetupDependencies(composition));
registerStartCommand(program, composition.lifecycleService);
registerEnvironmentCommand(program);

program
  .name('devvault')
  .description('Developer experience layer for HashiCorp Vault')
  .version('0.1.8-mvp');

program.parseAsync().catch((error: unknown) => {
  const message = error instanceof Error ? error.message : 'Command failed.';
  process.stderr.write(`Error: ${message}\n`);
  process.exitCode = 1;
});