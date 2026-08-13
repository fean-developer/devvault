import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import type { DeveloperLifecycleService, LifecycleResult, StartInput } from '@devvault/core';
import { registerStartCommand, runStartCommand, writeStartResult } from './start.js';

const readyResult: LifecycleResult = {
  status: 'READY',
  lifecycle: 'ready',
  backend: 'local-docker',
  blockers: [],
  warnings: [],
  metadata: { backend: 'local-docker' },
};

describe('start command', () => {
  it('delegates interactive start intent to the lifecycle service', async () => {
    let received: StartInput | undefined;
    const lifecycle: DeveloperLifecycleService = {
      start: async (input) => { received = input; return readyResult; },
      status: async () => readyResult,
    };

    await expect(runStartCommand(lifecycle)).resolves.toEqual(readyResult);
    expect(received).toEqual({ mode: 'interactive' });
  });

  it('passes non-interactive and backend options without infrastructure logic', async () => {
    let received: StartInput | undefined;
    const lifecycle: DeveloperLifecycleService = {
      start: async (input) => { received = input; return readyResult; },
      status: async () => readyResult,
    };

    await runStartCommand(lifecycle, { nonInteractive: true, backend: 'remote-vault' });

    expect(received).toEqual({ mode: 'non-interactive', preferredBackend: 'remote-vault' });
  });

  it('registers the public start command', () => {
    const program = new Command();
    const lifecycle: DeveloperLifecycleService = { start: async () => readyResult, status: async () => readyResult };

    registerStartCommand(program, lifecycle);

    expect(program.commands.map((command) => command.name())).toContain('start');
  });

  it('keeps human output concise and JSON output structured', () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    writeStartResult(readyResult, false);
    expect(write.mock.calls.flat().join('')).toContain('DevVault is ready.');
    write.mockClear();
    writeStartResult(readyResult, true);
    expect(write.mock.calls.flat().join('')).toContain('"status":"READY"');
    write.mockRestore();
  });
});