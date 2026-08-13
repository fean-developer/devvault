import { describe, expect, it } from 'vitest';
import { HostPathAdapter, normalizePosixPath, normalizeWindowsPath } from './path-adapter.js';

describe('path adapters', () => {
  it('normalizes POSIX and Windows paths without manual separators', () => {
    expect(normalizePosixPath('/home/user/project/../project')).toBe('/home/user/project');
    expect(normalizeWindowsPath('C:\\Users\\User\\project\\..\\project')).toBe('C:\\Users\\User\\project');
  });

  it('provides host path operations through one adapter', () => {
    const adapter = new HostPathAdapter();
    expect(adapter.join('/tmp', 'devvault', 'devvault.yaml')).toContain('devvault.yaml');
    expect(adapter.isAbsolute('/tmp/project')).toBe(true);
  });
});