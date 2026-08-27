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

export interface ResolvedEnvironmentContext {
  projectRoot: string;
  environment?: string;
  state: EnvironmentContextState;
  configPath?: string;
  config?: ProjectConfig;
}

export type EnvironmentResolutionMode = 'required' | 'diagnostic';

export type EnvironmentResolutionErrorCode =
  | 'ENVIRONMENT_NOT_SELECTED'
  | 'ENVIRONMENT_NOT_CONFIGURED'
  | 'ENVIRONMENT_INVALID';

export class EnvironmentResolutionError extends Error {
  constructor(message: string, readonly code: EnvironmentResolutionErrorCode) {
    super(message);
    this.name = 'EnvironmentResolutionError';
  }
}

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

export async function resolveEnvironmentContext(
  startDirectory: string,
  explicitEnvironment?: string,
  options: { mode?: EnvironmentResolutionMode; allowCandidateRoot?: boolean } = {},
): Promise<ResolvedEnvironmentContext> {
  const mode = options.mode ?? 'required';
  const projectRoot = await findProjectRoot(startDirectory, options.allowCandidateRoot === true);
  const environments = await listProjectEnvironments(projectRoot);
  const legacyPath = join(projectRoot, 'devvault.yaml');
  const environment = explicitEnvironment ?? await readActiveEnvironment(projectRoot);
  let hasLegacyConfig = true;
  try { await access(legacyPath); } catch { hasLegacyConfig = false; }
  if (environments.length === 0 && !hasLegacyConfig) {
    if (!environment) {
      if (mode === 'diagnostic') return { projectRoot, state: 'NOT_SELECTED' };
      throw new EnvironmentResolutionError('No environment selected.', 'ENVIRONMENT_NOT_SELECTED');
    }
    let name: string;
    try { name = environmentNameSchema.parse(environment); } catch { throw new EnvironmentResolutionError('Environment name is invalid.', 'ENVIRONMENT_INVALID'); }
    const result = { projectRoot, environment: name, state: 'SELECTED' as const };
    if (mode === 'diagnostic') return result;
    throw new EnvironmentResolutionError(`Environment '${name}' is selected but not configured. Run: devvault init-project`, 'ENVIRONMENT_NOT_CONFIGURED');
  }
  if (environments.length > 0) {
    if (!environment) {
      if (mode === 'diagnostic') return { projectRoot, state: 'NOT_SELECTED' };
      throw new EnvironmentResolutionError(`No environment selected. Available environments: ${environments.join(', ')}. Select one with: devvault environment set <name>`, 'ENVIRONMENT_NOT_SELECTED');
    }
    let name: string;
    try { name = environmentNameSchema.parse(environment); } catch { throw new EnvironmentResolutionError('Environment name is invalid.', 'ENVIRONMENT_INVALID'); }
    const configPath = join(projectRoot, 'environments', name, 'devvault.yaml');
    try { await access(configPath); } catch {
      const result = { projectRoot, environment: name, state: 'SELECTED' as const, configPath };
      if (mode === 'diagnostic') return result;
      throw new EnvironmentResolutionError(`Environment '${name}' is selected but not configured. Run: devvault init-project`, 'ENVIRONMENT_NOT_CONFIGURED');
    }
    try {
      const config = parseProjectConfig(parseYaml(await readFile(configPath, 'utf8')));
      if (config.environment !== name) throw new Error(`Environment configuration mismatch: expected ${name}.`);
      return { projectRoot, environment: name, state: 'CONFIGURED', configPath, config };
    } catch (error) {
      if (error instanceof EnvironmentResolutionError) throw error;
      throw new EnvironmentResolutionError(error instanceof Error ? error.message : 'Environment configuration is invalid.', 'ENVIRONMENT_INVALID');
    }
  }
  if (explicitEnvironment) throw new EnvironmentResolutionError('The legacy project configuration cannot resolve an explicit alternate environment.', 'ENVIRONMENT_INVALID');
  try {
    const config = parseProjectConfig(parseYaml(await readFile(legacyPath, 'utf8')));
    return { projectRoot, environment: config.environment, state: 'CONFIGURED', configPath: legacyPath, config };
  } catch (error) {
    throw new EnvironmentResolutionError(error instanceof Error ? error.message : 'Project configuration is invalid.', 'ENVIRONMENT_INVALID');
  }
}

export async function resolveProjectConfig(startDirectory: string, explicitEnvironment?: string): Promise<ProjectEnvironmentContext> {
  const context = await resolveEnvironmentContext(startDirectory, explicitEnvironment);
  if (!context.config || !context.environment || !context.configPath) {
    throw new EnvironmentResolutionError('Environment configuration is required.', 'ENVIRONMENT_NOT_CONFIGURED');
  }
  return { projectRoot: context.projectRoot, environment: context.environment, configPath: context.configPath, config: context.config };
}

export async function loadProjectConfig(startDirectory: string, explicitEnvironment?: string): Promise<ProjectConfig> {
  const context = await resolveProjectConfig(startDirectory, explicitEnvironment);
  return context.config;
}