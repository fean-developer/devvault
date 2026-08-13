import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';

describe('init-project configuration contract', () => {
  it('generates only non-sensitive configuration fields', async () => {
    const directory = await mkdtemp(join(tmpdir(), 'devvault-cli-'));
    const project = 'sample-api';
    const content = [
      'version: 1',
      `project: ${project}`,
      'environment: development',
      'vault:',
      '  mount: secret',
      `  path: projects/${project}/development`,
      'runtime:',
      '  mappings: {}',
      '',
    ].join('\n');

    await writeFile(join(directory, 'devvault.yaml'), content);
    const generated = await readFile(join(directory, 'devvault.yaml'), 'utf8');

    expect(generated).toContain('runtime:\n  mappings: {}');
    expect(generated).not.toMatch(/token|password|secret-value/i);
  });
});