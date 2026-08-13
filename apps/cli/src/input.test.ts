import { PassThrough } from 'node:stream';
import { describe, expect, it } from 'vitest';
import { readSecretValue } from './input.js';

describe('hidden secret input', () => {
  it('reads piped input without writing the secret to output', async () => {
    const input = new PassThrough();
    const output = new PassThrough();
    const result = readSecretValue(input, output);
    input.end('secret-value\n');

    await expect(result).resolves.toBe('secret-value');
    expect(output.read()).toBeNull();
  });

  it('writes the contextual prompt without echoing typed characters', async () => {
    const input = new PassThrough() as PassThrough & { isTTY?: boolean; setRawMode?: (mode: boolean) => void };
    const output = new PassThrough();
    input.isTTY = true;
    input.setRawMode = () => undefined;
    const result = readSecretValue(input, output, 'Secret value for test.secret: ');
    input.write('hidden-value');
    input.write('\n');

    await expect(result).resolves.toBe('hidden-value');
    expect(output.read()?.toString()).toBe('Secret value for test.secret: \n');
  });
});