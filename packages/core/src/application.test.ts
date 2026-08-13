import { describe, expect, it } from 'vitest';
import { ProjectApplicationService } from './application.js';

const config = {
  version: 1 as const,
  project: 'my-api',
  environment: 'development',
  vault: { mount: 'secret', path: 'projects/my-api/development' },
  runtime: { mappings: {} },
};

describe('ProjectApplicationService', () => {
  it('delegates project operations through application ports', async () => {
    const calls: string[] = [];
    const service = new ProjectApplicationService(
      { load: async () => config },
      {
        set: async () => {
          calls.push('set');
        },
        get: async () => 'value',
        list: async () => ['database'],
        delete: async () => true,
      },
      { run: async () => 7 },
    );

    await expect(service.load('/project')).resolves.toEqual(config);
    await service.setSecret(config, 'database.password', 'value');
    await expect(service.getSecret(config, 'database.password')).resolves.toBe('value');
    await expect(service.listSecrets(config)).resolves.toEqual(['database']);
    await expect(service.deleteSecret(config, 'database.password')).resolves.toBe(true);
    await expect(service.run(config, 'node', ['app.js'])).resolves.toBe(7);
    expect(calls).toEqual(['set']);
  });
});