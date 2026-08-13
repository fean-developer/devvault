export interface ProjectConfig {
  project: string;
  environment: string;
  vault: { mount: string; path: string };
  runtime: { mappings: Record<string, string> };
}

export interface ProjectConfigLoader {
  load(directory: string): Promise<ProjectConfig>;
}

export interface SecretOperations {
  set(config: ProjectConfig, key: string, value: string): Promise<void>;
  get(config: ProjectConfig, key: string): Promise<string | undefined>;
  list(config: ProjectConfig): Promise<string[]>;
  delete(config: ProjectConfig, key: string): Promise<boolean>;
}

export interface RuntimeOperations {
  run(config: ProjectConfig, command: string, args: string[]): Promise<number>;
}

export class ProjectApplicationService {
  constructor(
    private readonly configLoader: ProjectConfigLoader,
    private readonly secrets: SecretOperations,
    private readonly runtime: RuntimeOperations,
  ) {}

  load(directory: string): Promise<ProjectConfig> {
    return this.configLoader.load(directory);
  }

  setSecret(config: ProjectConfig, key: string, value: string): Promise<void> {
    return this.secrets.set(config, key, value);
  }

  getSecret(config: ProjectConfig, key: string): Promise<string | undefined> {
    return this.secrets.get(config, key);
  }

  listSecrets(config: ProjectConfig): Promise<string[]> {
    return this.secrets.list(config);
  }

  deleteSecret(config: ProjectConfig, key: string): Promise<boolean> {
    return this.secrets.delete(config, key);
  }

  run(config: ProjectConfig, command: string, args: string[]): Promise<number> {
    return this.runtime.run(config, command, args);
  }
}