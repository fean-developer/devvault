import { Command } from 'commander';
import { createDoctorReport, formatDoctorReport, reportHasFailures } from '../diagnostics.js';
import type { ReturnTypeOfComposition } from '../composition-root.js';

export function registerDoctorCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program
    .command('doctor')
    .description('Diagnose local DevVault and project configuration')
    .option('--json', 'Print machine-readable JSON')
    .action(async (options: { json?: boolean }) => {
      const report = await createDoctorReport(
        process.cwd(),
        await composition.createVaultClient(),
        undefined,
        { platform: composition.platform, docker: await composition.docker.diagnose() },
      );
      process.stdout.write(options.json ? `${JSON.stringify(report)}\n` : formatDoctorReport(report));
      if (reportHasFailures(report)) process.exitCode = 1;
    });
}