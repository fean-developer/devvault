import { z } from 'zod';
import { access, readFile } from 'node:fs/promises';
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

export function parseProjectConfig(input: unknown): ProjectConfig {
  return projectConfigSchema.parse(input);
}

export async function findProjectConfig(startDirectory: string): Promise<string> {
  let directory = startDirectory;

  while (true) {
    const candidate = join(directory, 'devvault.yaml');
    try {
      await access(candidate);
      return candidate;
    } catch {
      const parent = dirname(directory);
      if (parent === directory) {
        throw new Error('Could not find devvault.yaml from the current directory.');
      }
      directory = parent;
    }
  }
}

export async function loadProjectConfig(startDirectory: string): Promise<ProjectConfig> {
  const configPath = await findProjectConfig(startDirectory);
  const source = await readFile(configPath, 'utf8');
  return parseProjectConfig(parseYaml(source));
}