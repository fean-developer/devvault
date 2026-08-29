import { Command } from 'commander';
import { describe, expect, it, vi } from 'vitest';
import { registerSecretCommand, runSecretDelete, runSecretSet } from './secret.js';
import type { ReturnTypeOfComposition } from '../composition-root.js';
import { AuthorizationDeniedError } from '@devvault/core';

function composition(config: { protected?: boolean }, calls: string[] = []): ReturnTypeOfComposition {
  const application = {
    load: async () => ({ ...config, environment: 'production' }),
    setSecret: async () => { calls.push('set'); },
    getSecret: async () => 'value',
    listSecrets: async () => ['database'],
    deleteSecret: async () => { calls.push('delete'); return true; },
    run: async () => 0,
  };
  return { createProjectApplication: async () => application } as unknown as ReturnTypeOfComposition;
}

function guardedComposition(config: { protected?: boolean }, calls: string[] = []): ReturnTypeOfComposition {
  const result = composition(config, calls) as ReturnTypeOfComposition & { requireValidSession: () => Promise<import('@devvault/core').ValidatedDeveloperSession> };
  result.requireValidSession = async () => { calls.push('session'); return { state: 'ACTIVE', credential: 'session-token', validation: 'REMOTE_CONFIRMED' }; };
  return result;
}

function setComposition(config: { protected?: boolean }, calls: string[] = []): ReturnTypeOfComposition {
  const application = {
    load: async () => ({ version: 1 as const, project: 'my-api', ...config, environment: 'production', vault: { mount: 'secret', path: 'projects/my-api/production' }, runtime: { mappings: {} } }),
    setSecret: async () => { calls.push('set'); },
    getSecret: async () => undefined,
    listSecrets: async () => [],
    deleteSecret: async () => { calls.push('delete'); return true; },
    run: async () => 0,
  };
  return { createProjectApplication: async () => application } as unknown as ReturnTypeOfComposition;
}

describe('secret command protected environment behavior', () => {
  it('does not write a protected secret when consent is denied', async () => {
    const calls: string[] = [];

    await expect(runSecretSet(setComposition({ protected: true }, calls), 'database.password', {}, {
      confirm: async () => false,
      readSecret: async () => 'must-not-be-read',
    })).rejects.toThrow('Protected environment mutation was not authorized.');
    expect(calls).toEqual([]);
  });

  it('writes a protected secret only with explicit yes authorization', async () => {
    const calls: string[] = [];

    await runSecretSet(setComposition({ protected: true }, calls), 'database.password', { yes: true }, {
      confirm: async () => { throw new Error('confirmation must not be used with --yes'); },
      readSecret: async () => 'value',
    });

    expect(calls).toEqual(['set']);
  });

  it('does not require protected confirmation for an unprotected secret', async () => {
    const calls: string[] = [];

    await runSecretSet(setComposition({}, calls), 'database.password', {}, {
      confirm: async () => { throw new Error('confirmation must not be requested'); },
      readSecret: async () => 'value',
    });

    expect(calls).toEqual(['set']);
  });

  it('allows protected read operations without mutation confirmation', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command().exitOverride();
    registerSecretCommand(program, composition({ protected: true }));

    await program.parseAsync(['node', 'devvault', 'secret', 'list']);

    expect(write.mock.calls.flat().join('')).toBe('database\n');
    write.mockRestore();
  });

  it('allows protected get without mutation confirmation', async () => {
    const write = vi.spyOn(process.stdout, 'write').mockImplementation(() => true);
    const program = new Command().exitOverride();
    registerSecretCommand(program, composition({ protected: true }));

    await program.parseAsync(['node', 'devvault', 'secret', 'get', 'database.password']);

    expect(write.mock.calls.flat().join('')).toBe('Secret exists. Use --show to display it.\n');
    write.mockRestore();
  });

  it('requires explicit confirmation for protected deletion', async () => {
    const calls: string[] = [];
    const program = new Command().exitOverride();
    registerSecretCommand(program, composition({ protected: true }, calls));

    await expect(program.parseAsync(['node', 'devvault', 'secret', 'delete', 'database.password']))
      .rejects.toThrow('Deletion requires --yes.');
    expect(calls).toEqual([]);
  });

  it('allows unprotected deletion with --yes and no consent prompt', async () => {
    const calls: string[] = [];
    const program = new Command().exitOverride();
    registerSecretCommand(program, composition({}, calls));

    await program.parseAsync(['node', 'devvault', 'secret', 'delete', 'database.password', '--yes']);

    expect(calls).toEqual(['delete']);
  });

  it('requires the shared session guard before a secret read', async () => {
    const calls: string[] = [];
    const program = new Command().exitOverride();
    registerSecretCommand(program, guardedComposition({}, calls));

    await program.parseAsync(['node', 'devvault', 'secret', 'get', 'database.password']);

    expect(calls).toEqual(['session']);
  });

  it('blocks secret mutation before Vault access when the shared session guard fails', async () => {
    const calls: string[] = [];
    const guarded = guardedComposition({}, calls) as ReturnTypeOfComposition & { requireValidSession: () => Promise<import('@devvault/core').ValidatedDeveloperSession> };
    guarded.requireValidSession = async () => { throw new Error('SESSION_EXPIRED'); };

    await expect(runSecretSet(guarded, 'database.password', { yes: true }, {
      confirm: async () => true,
      readSecret: async () => 'must-not-be-read',
    })).rejects.toThrow('SESSION_EXPIRED');
    expect(calls).toEqual([]);
  });
});

describe('secret delete protected environment consent (AUTHZ-014)', () => {
  it('sends zero delete calls when protected consent is declined (AZM16/AZM17)', async () => {
    const calls: string[] = [];

    await expect(runSecretDelete(setComposition({ protected: true }, calls), 'database.password', { yes: true }, {
      confirm: async () => false,
    })).rejects.toThrow('Protected environment mutation was not authorized.');
    expect(calls).toEqual([]);
  });

  it('deletes only after protected consent is accepted', async () => {
    const calls: string[] = [];

    await runSecretDelete(setComposition({ protected: true }, calls), 'database.password', { yes: true }, {
      confirm: async () => true,
    });

    expect(calls).toEqual(['delete']);
  });

  it('does not require protected confirmation for an unprotected delete', async () => {
    const calls: string[] = [];

    await runSecretDelete(setComposition({}, calls), 'database.password', { yes: true }, {
      confirm: async () => { throw new Error('confirmation must not be requested'); },
    });

    expect(calls).toEqual(['delete']);
  });

  it('still requires --yes before evaluating protected consent', async () => {
    await expect(runSecretDelete(setComposition({ protected: true }), 'database.password', {}, {
      confirm: async () => { throw new Error('confirm must not be reached without --yes'); },
    })).rejects.toThrow('Deletion requires --yes.');
  });

  it('does not let accepted consent override a Vault authorization denial (AZM10)', async () => {
    const denyingComposition: ReturnTypeOfComposition = {
      createProjectApplication: async () => ({
        load: async () => ({ version: 1 as const, project: 'my-api', protected: true, environment: 'production', vault: { mount: 'secret', path: 'projects/my-api/production' }, runtime: { mappings: {} } }),
        setSecret: async () => undefined,
        getSecret: async () => undefined,
        listSecrets: async () => [],
        deleteSecret: async () => { throw new AuthorizationDeniedError({ operation: 'secret.delete', project: 'my-api', environment: 'production' }); },
        run: async () => 0,
      }),
    } as unknown as ReturnTypeOfComposition;

    await expect(runSecretDelete(denyingComposition, 'database.password', { yes: true }, {
      confirm: async () => true,
    })).rejects.toBeInstanceOf(AuthorizationDeniedError);
  });
});
