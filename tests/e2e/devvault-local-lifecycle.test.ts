import { Command } from 'commander';
import { execFileSync } from 'node:child_process';
import { join } from 'node:path';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DeveloperLifecycleService, LifecycleResult, StartInput } from '@devvault/core';
import { registerStartCommand } from '../../apps/cli/src/commands/start.js';

const readyResult: LifecycleResult = {
  status: 'READY',
  lifecycle: 'ready',
  backend: 'local-docker',
  blockers: [],
  warnings: [],
  metadata: { backend: 'local-docker' },
};

afterEach(() => {
  process.exitCode = undefined;
  vi.restoreAllMocks();
});

describe('production lifecycle command path', () => {
  it('exposes start through the compiled production entrypoint', () => {
    const cliPath = join(process.cwd(), 'apps/cli/dist/index.js');
    const output = execFileSync(process.execPath, [cliPath, '--help'], { encoding: 'utf8' });

    expect(output).toContain('start');
  });

  it('runs the registered start command and returns READY on repeated starts', async () => {
    let calls = 0;
    const lifecycle: DeveloperLifecycleService = {
      start: async () => { calls += 1; return readyResult; },
      status: async () => readyResult,
    };
    const first = new Command().exitOverride();
    registerStartCommand(first, lifecycle);
    await first.parseAsync(['node', 'devvault', 'start']);
    const second = new Command().exitOverride();
    registerStartCommand(second, lifecycle);
    await second.parseAsync(['node', 'devvault', 'start']);

    expect(calls).toBe(2);
    expect(process.exitCode).toBe(0);
  });

  it('returns BLOCKED for sealed non-interactive lifecycle without changing the input mode', async () => {
    let received: StartInput | undefined;
    const lifecycle: DeveloperLifecycleService = {
      start: async (input) => {
        received = input;
        return {
          status: 'BLOCKED',
          lifecycle: 'sealed',
          backend: 'local-docker',
          blockers: ['The local Vault is sealed.'],
          warnings: [],
          metadata: {},
        };
      },
      status: async () => readyResult,
    };
    const program = new Command().exitOverride();
    registerStartCommand(program, lifecycle);

    await program.parseAsync(['node', 'devvault', 'start', '--non-interactive']);

    expect(received).toEqual({ mode: 'non-interactive' });
    expect(process.exitCode).toBe(4);
  });

  it('sanitizes credential material from human and JSON output', async () => {
    const lifecycle: DeveloperLifecycleService = {
      start: async () => ({
        status: 'BLOCKED',
        lifecycle: 'sealed',
        backend: 'local-docker',
        blockers: ['unseal-key=ephemeral-key token=hvs.secret-token'],
        warnings: ['password=hidden-password'],
        metadata: { detail: 'authorization=bearer-value' },
      }),
      status: async () => readyResult,
    };
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command().exitOverride();
    registerStartCommand(program, lifecycle);

    await program.parseAsync(['node', 'devvault', 'start', '--json']);

    const output = write.mock.calls.flat().join('');
    expect(output).not.toContain('ephemeral-key');
    expect(output).not.toContain('hvs.secret-token');
    expect(output).not.toContain('hidden-password');
    expect(output).toContain('[redacted]');
  });

  it('keeps credential material out of process arguments and persisted project state', async () => {
    const lifecycle: DeveloperLifecycleService = {
      start: async () => ({
        status: 'BLOCKED',
        lifecycle: 'sealed',
        backend: 'local-docker',
        blockers: ['unseal-key=ephemeral-key'],
        warnings: [],
        metadata: {},
      }),
      status: async () => readyResult,
    };
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command().exitOverride();
    registerStartCommand(program, lifecycle);
    await program.parseAsync(['node', 'devvault', 'start', '--json']);

    expect(process.argv.join(' ')).not.toContain('ephemeral-key');
    expect(write.mock.calls.flat().join('')).not.toContain('ephemeral-key');
  });
});