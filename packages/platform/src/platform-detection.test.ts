import { describe, expect, it } from 'vitest';
import { detectPlatform } from './platform-detection.js';

describe('platform detection', () => {
  it('detects Linux bash', () => {
    expect(detectPlatform({ platform: 'linux', kernelRelease: '6.8.0', env: { SHELL: '/bin/bash' } })).toEqual({
      host: 'linux', isWsl: false, shell: 'bash',
    });
  });

  it('detects WSL from the kernel release', () => {
    expect(detectPlatform({ platform: 'linux', kernelRelease: '5.15.90-microsoft-standard-WSL2', env: {} }).isWsl).toBe(true);
  });

  it('detects Windows PowerShell without depending on the host running Windows', () => {
    expect(detectPlatform({ platform: 'win32', kernelRelease: 'windows', env: { PSModulePath: 'C:\\PowerShell' } })).toMatchObject({
      host: 'windows', shell: 'powershell', isWsl: false,
    });
  });
});