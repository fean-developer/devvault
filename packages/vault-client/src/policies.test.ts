import { describe, expect, it } from 'vitest';
import { createApplicationPolicy, createDeveloperPolicy } from './policies.js';

describe('project policies', () => {
  it('limits developer access to one project and environment', () => {
    const policy = createDeveloperPolicy({ project: 'my-api', environment: 'development' });
    expect(policy).toContain('secret/data/projects/my-api/development/*');
    expect(policy).toContain('["create", "read", "update"]');
    expect(policy).not.toContain('projects/+/+');
  });

  it('gives applications read-only access to one project', () => {
    const policy = createApplicationPolicy({ project: 'my-api', environment: 'development' });
    expect(policy).toContain('secret/data/projects/my-api/development/*');
    expect(policy).toContain('capabilities = ["read"]');
    expect(policy).not.toContain('update');
    expect(policy).not.toContain('list');
  });

  it('does not cross project or environment boundaries', () => {
    const projectA = createApplicationPolicy({ project: 'project-a', environment: 'development' });
    const projectB = createApplicationPolicy({ project: 'project-b', environment: 'development' });

    expect(projectA).toContain('projects/project-a/development');
    expect(projectA).not.toContain('projects/project-b');
    expect(projectB).toContain('projects/project-b/development');
    expect(projectB).not.toContain('projects/project-a');
  });
});