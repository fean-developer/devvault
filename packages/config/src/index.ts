import { z } from 'zod';
import { access, mkdir, readFile, readdir, rename, unlink, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { parse as parseYaml } from 'yaml';

const mappingSchema = z.record(
  z.string().regex(/^[A-Z][A-Z0-9_]*$/),
  z.string().regex(/^[a-z][a-z0-9_-]*(\.[a-z][a-z0-9_-]*)*$/),
);

export const projectConfigSchema = z.strictObject({
  version: z.literal(1),
  project: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  environment: z.string().regex(/^[a-z0-9][a-z0-9-]*$/),
  protected: z.boolean().optional(),
  vault: z.object({
    mount: z.string().min(1),
    path: z.string().min(1),
  }),
  runtime: z.object({
    mappings: mappingSchema,
  }),
}).superRefine((config, context) => {
  const expectedPath = `projects/${config.project}/${config.environment}`;
  if (config.vault.path !== expectedPath) {
    context.addIssue({
      code: 'custom',
      path: ['vault', 'path'],
      message: `Vault path must be ${expectedPath}.`,
    });
  }
});

export type ProjectConfig = z.infer<typeof projectConfigSchema>;

export interface ProjectEnvironmentContext {
  projectRoot: string;
  environment: string;
  configPath: string;
  config: ProjectConfig;
}

export type EnvironmentContextState = 'NOT_SELECTED' | 'SELECTED' | 'CONFIGURED' | 'INVALID';

const environmentNameSchema = z.string().regex(/^[a-z0-9][a-z0-9-]*$/);
const activeContextSchema = z.strictObject({ environment: environmentNameSchema });

export function parseProjectConfig(input: unknown): ProjectConfig {
  return projectConfigSchema.parse(input);
}

export function classifyEnvironmentContext(input: {
  selectedEnvironment?: string;
  config?: ProjectConfig;
  invalid?: boolean;
}): EnvironmentContextState {
  if (input.invalid) return 'INVALID';
  if (!input.selectedEnvironment) return 'NOT_SELECTED';
  return input.config ? 'CONFIGURED' : 'SELECTED';
}

export async function findProjectRoot(startDirectory: string, allowCandidateRoot = false): Promise<string> {
  let directory = startDirectory;
  let currentHasMarker = false;

  while (true) {
    const candidates = [join(directory, 'environments'), join(directory, 'devvault.yaml'), join(directory, '.devvault')];
    let hasMarker = false;
    try {
      await Promise.any(candidates.map((candidate) => access(candidate)));
      hasMarker = true;
    } catch {
      hasMarker = false;
    }
    if (hasMarker) {
      if (allowCandidateRoot && directory === startDirectory) {
        currentHasMarker = true;
      } else if (allowCandidateRoot && currentHasMarker) {
        throw new Error('Project root is ambiguous between the current directory and an ancestor.');
      } else {
        return directory;
      }
    }
    const parent = dirname(directory);
    if (parent === directory) {
      if (allowCandidateRoot) return startDirectory;
      throw new Error('Could not find devvault.yaml from the current directory.');
    }
    directory = parent;
  }
}

export async function findProjectConfig(startDirectory: string): Promise<string> {
  const root = await findProjectRoot(startDirectory);
  const legacy = join(root, 'devvault.yaml');
  await access(legacy);
  return legacy;
}

export async function listProjectEnvironments(projectRoot: string): Promise<string[]> {
  const directory = join(projectRoot, 'environments');
  try {
    const entries = await readdir(directory, { withFileTypes: true });
    return entries.filter((entry) => entry.isDirectory() && environmentNameSchema.safeParse(entry.name).success).map((entry) => entry.name).sort();
  } catch {
    return [];
  }
}

async function readActiveEnvironment(projectRoot: string): Promise<string | null> {
  let contents: string;
  try {
    contents = await readFile(join(projectRoot, '.devvault/context.json'), 'utf8');
  } catch {
    return null;
  }
  try {
    return activeContextSchema.parse(JSON.parse(contents)).environment;
  } catch {
    throw new Error('Active environment context is invalid.');
  }
}

export async function setActiveEnvironment(projectRoot: string, environment: string): Promise<void> {
  const name = environmentNameSchema.parse(environment);
  const directory = join(projectRoot, '.devvault');
  await mkdir(directory, { recursive: true });
  const temporary = join(directory, 'context.json.tmp');
  try {
    await writeFile(temporary, `${JSON.stringify({ environment: name }, null, 2)}\n`, { mode: 0o600 });
    await rename(temporary, join(directory, 'context.json'));
  } finally {
    try { await unlink(temporary); } catch { }
  }
  const gitignore = join(projectRoot, '.gitignore');
  let contents = '';
  try { contents = await readFile(gitignore, 'utf8'); } catch { /* create below */ }
  if (!contents.split(/\r?\n/).includes('.devvault/')) await writeFile(gitignore, `${contents}${contents && !contents.endsWith('\n') ? '\n' : ''}.devvault/\n`);
}

export async function resolveProjectConfig(startDirectory: string, explicitEnvironment?: string): Promise<ProjectEnvironmentContext> {
  const projectRoot = await findProjectRoot(startDirectory);
  const environments = await listProjectEnvironments(projectRoot);
  const legacyPath = join(projectRoot, 'devvault.yaml');
  const environment = explicitEnvironment ?? await readActiveEnvironment(projectRoot);
  if (environments.length > 0) {
    if (!environment) throw new Error(`No environment selected. Available environments: ${environments.join(', ')}. Select one with: devvault environment set <name>`);
    const name = environmentNameSchema.parse(environment);
    const configPath = join(projectRoot, 'environments', name, 'devvault.yaml');
    try { await access(configPath); } catch { throw new Error(`Environment '${name}' does not exist. Available environments: ${environments.join(', ')}`); }
    const config = parseProjectConfig(parseYaml(await readFile(configPath, 'utf8')));
    if (config.environment !== name) throw new Error(`Environment configuration mismatch: expected ${name}.`);
    return { projectRoot, environment: name, configPath, config };
  }
  if (explicitEnvironment) throw new Error('The legacy project configuration cannot resolve an explicit alternate environment.');
  const config = parseProjectConfig(parseYaml(await readFile(legacyPath, 'utf8')));
  return { projectRoot, environment: config.environment, configPath: legacyPath, config };
}

export async function loadProjectConfig(startDirectory: string, explicitEnvironment?: string): Promise<ProjectConfig> {
  const context = await resolveProjectConfig(startDirectory, explicitEnvironment);
  return context.config;
}