import { Command } from 'commander';
import { access, mkdir, writeFile } from 'node:fs/promises';
import { basename, join } from 'node:path';
import { createApplicationPolicy, createDeveloperPolicy } from '@devvault/vault-client';
import { resolveEnvironmentContext } from '@devvault/config';
import type { ReturnTypeOfComposition } from '../composition-root.js';

export async function runInitProject(
  composition: ReturnTypeOfComposition,
  directory = process.cwd(),
  options: { environment?: string; force?: boolean } = {},
): Promise<void> {
  const context = await resolveEnvironmentContext(directory, options.environment, {
    mode: 'diagnostic',
    allowCandidateRoot: true,
  });
  if (!context.environment) throw new Error('No environment selected. Run: devvault environment set <name>');
  const projectRoot = context.projectRoot;
  const project = basename(projectRoot).toLowerCase().replace(/[^a-z0-9-]/g, '-');
  const environment = context.environment;
  const configPath = join(projectRoot, 'environments', environment, 'devvault.yaml');
  if (!project || !/^[a-z0-9][a-z0-9-]*$/.test(project)) throw new Error('Could not derive a valid project name from the project root.');
  if (!options.force) {
    try {
      await access(configPath);
      throw new Error('devvault.yaml already exists. Use --force to replace it.');
    } catch (error) {
      if (error instanceof Error && error.message.includes('already exists')) throw error;
    }
  }
  await mkdir(join(projectRoot, 'environments', environment), { recursive: true });
  const content = ['version: 1', `project: ${project}`, `environment: ${environment}`, 'protected: false', 'vault:', '  mount: secret', `  path: projects/${project}/${environment}`, 'runtime:', '  mappings: {}', ''].join('\n');
  await writeFile(configPath, content, { encoding: 'utf8', flag: 'w' });
  if (process.env.VAULT_TOKEN) {
    const client = await composition.createVaultClient();
    await client.putPolicy(`devvault-${project}-${environment}-developer`, createDeveloperPolicy({ project, environment }));
    await client.putPolicy(`devvault-${project}-${environment}-application`, createApplicationPolicy({ project, environment }));
  }
  process.stdout.write(`Project detected: ${project}\nConfiguration written: ${configPath}\n`);
}

export function registerProjectCommand(program: Command, composition: ReturnTypeOfComposition): void {
  program.command('init-project')
    .description('Create a non-sensitive devvault.yaml in the current directory')
    .option('-e, --environment <name>', 'Project environment override')
    .option('--force', 'Replace an existing devvault.yaml')
    .action((options: { environment?: string; force?: boolean }) => runInitProject(composition, process.cwd(), options));
}