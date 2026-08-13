import { chmod, mkdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { LocalBootstrapMaterial, LocalBootstrapMaterialStore } from '@devvault/core';
import type { DockerManager } from './index.js';

export class LocalBootstrapMaterialFileStore implements LocalBootstrapMaterialStore {
  constructor(
    private readonly docker: DockerManager,
    private readonly volume = 'devvault-vault-bootstrap',
  ) {}

  async load(): Promise<LocalBootstrapMaterial | null> {
    try {
      if (this.docker.readContainerFile) {
        return JSON.parse(await this.docker.readContainerFile('devvault-vault', '/vault/bootstrap/bootstrap.json')) as LocalBootstrapMaterial;
      }
      const path = await this.materialPath();
      return JSON.parse(await readFile(path, 'utf8')) as LocalBootstrapMaterial;
    } catch {
      return null;
    }
  }

  async save(material: LocalBootstrapMaterial): Promise<void> {
    if (this.docker.writeContainerFile) {
      await this.docker.writeContainerFile('devvault-vault', '/vault/bootstrap/bootstrap.json', JSON.stringify(material));
      return;
    }
    const path = await this.materialPath();
    await writeFile(path, JSON.stringify(material), { encoding: 'utf8', mode: 0o600 });
    await chmod(path, 0o600);
  }

  private async materialPath(): Promise<string> {
    if (!this.docker.volumeMountpoint) throw new Error('Docker volume inspection is unavailable.');
    const mountpoint = await this.docker.volumeMountpoint(this.volume);
    await mkdir(mountpoint, { recursive: true, mode: 0o700 });
    return join(mountpoint, 'bootstrap.json');
  }
}