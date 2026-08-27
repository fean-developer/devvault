import { describe, expect, it } from 'vitest';
import { formatStatus } from './status.js';

describe('status environment context output', () => {
  it('reports selected context independently from Vault lifecycle', () => {
    const output = formatStatus({
      project: 'my-project',
      environment: 'staging',
      environmentState: 'SELECTED',
      configured: false,
      configuration: 'NOT_FOUND',
      vault: { address: 'http://127.0.0.1:8200', reachable: true, initialized: true, sealed: false, lifecycle: 'READY' },
    });

    expect(output).toContain('Project: my-project');
    expect(output).toContain('Environment: staging');
    expect(output).toContain('Environment state: SELECTED');
    expect(output).toContain('Reachable: yes');
  });
});