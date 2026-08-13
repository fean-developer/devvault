import { Command } from 'commander';
import { access, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createApplicationPolicy, createDeveloperPolicy } from '@devvault/vault-client';
import type { ReturnTypeOfComposition } from '../composition-root.js';

export function registerProjectCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program.command('init-project')
    .description('Create a non-sensitive devvault.yaml in the current directory')
    .option('-e, --environment <name>', 'Project environment', 'development')
    .option('--force', 'Replace an existing devvault.yaml')
    .action(async (options: { environment: string; force?: boolean }) => {
      const project = basename(process.cwd()).toLowerCase().replace(/[^a-z0-9-]/g, '-');
      const configPath = join(process.cwd(), 'devvault.yaml');
      if (!project || !/^[a-z0-9][a-z0-9-]*$/.test(project)) throw new Error('Could not derive a valid project name from the current directory.');
      if (!options.force) {
        try {
          await access(configPath);
          throw new Error('devvault.yaml already exists. Use --force to replace it.');
        } catch (error) {
          if (error instanceof Error && error.message.includes('already exists')) throw error;
        }
      }
      const content = ['version: 1', `project: ${project}`, `environment: ${options.environment}`, 'vault:', '  mount: secret', `  path: projects/${project}/${options.environment}`, 'runtime:', '  mappings: {}', ''].join('\n');
      await writeFile(configPath, content, { encoding: 'utf8', flag: 'w' });
      if (process.env.VAULT_TOKEN) {
        const client = await composition.createVaultClient();
        await client.putPolicy(`devvault-${project}-${options.environment}-developer`, createDeveloperPolicy({ project, environment: options.environment }));
        await client.putPolicy(`devvault-${project}-${options.environment}-application`, createApplicationPolicy({ project, environment: options.environment }));
      }
      process.stdout.write(`Project detected: ${project}\nConfiguration written: ${configPath}\n`);
    });
}