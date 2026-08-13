import { stdin as defaultInput, stderr as defaultOutput } from 'node:process';
import type { Readable, Writable } from 'node:stream';

export async function readSecretValue(
  input: Readable & { isTTY?: boolean; setRawMode?: (mode: boolean) => void },
  output: Writable,
  prompt?: string,
): Promise<string> {
  if (!input.isTTY) {
    const chunks: Buffer[] = [];
    for await (const chunk of input) {
      chunks.push(Buffer.from(chunk));
    }
    return Buffer.concat(chunks).toString('utf8').replace(/\r?\n$/, '');
  }

  if (!input.setRawMode) {
    throw new Error('Interactive secret input is unavailable in this terminal.');
  }

  if (prompt) output.write(prompt);
  input.setRawMode(true);
  input.resume();

  return new Promise((resolve, reject) => {
    let value = '';
    const onData = (chunk: Buffer) => {
      for (const byte of chunk) {
        if (byte === 3) {
          cleanup();
          reject(new Error('Secret input cancelled.'));
          return;
        }
        if (byte === 13 || byte === 10) {
          cleanup();
          output.write('\n');
          resolve(value);
          return;
        }
        if (byte === 127 || byte === 8) {
          value = value.slice(0, -1);
          continue;
        }
        if (byte >= 32) {
          value += String.fromCharCode(byte);
        }
      }
    };
    const cleanup = () => {
      input.setRawMode?.(false);
      input.pause();
      input.removeListener('data', onData);
    };
    input.on('data', onData);
    input.once('error', (error) => {
      cleanup();
      reject(error);
    });
  });
}

export function readSecretFromProcess(prompt?: string): Promise<string> {
  return readSecretValue(defaultInput, defaultOutput, prompt);
}