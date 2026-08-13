import type {
  BackendSelectionInput,
  BackendSelectionResult,
  BackendSelector,
} from './setup-ports.js';

export class CapabilityBackendSelector implements BackendSelector {
  async select(input: BackendSelectionInput): Promise<BackendSelectionResult> {
    if (input.preferred === 'remote-vault') {
      return this.selectExplicit(input.remote, 'remote-vault');
    }
    if (input.preferred === 'local-docker') {
      return this.selectExplicit(input.local, 'local-docker');
    }

    const local = await input.local.detect();
    if (local.available) {
      return { backend: input.local, blockers: [], metadata: { selectedBackend: 'local-docker' } };
    }

    if (input.remote) {
      const remote = await input.remote.detect();
      if (remote.available) {
        return { backend: input.remote, blockers: [], metadata: { selectedBackend: 'remote-vault' } };
      }
    }

    return {
      blockers: ['No viable Vault backend is available.'],
      metadata: { selectedBackend: null },
    };
  }

  private async selectExplicit(
    backend: BackendSelectionInput['remote'] | BackendSelectionInput['local'],
    kind: 'local-docker' | 'remote-vault',
  ): Promise<BackendSelectionResult> {
    if (!backend) {
      return { blockers: [`Explicit ${kind} backend is not configured.`], metadata: { selectedBackend: null } };
    }
    const detection = await backend.detect();
    if (!detection.available) {
      return { blockers: [detection.detail ?? `Explicit ${kind} backend is unavailable.`], metadata: { selectedBackend: null } };
    }
    return { backend, blockers: [], metadata: { selectedBackend: kind } };
  }
}