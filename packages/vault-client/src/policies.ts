export interface ProjectPolicyInput {
  project: string;
  environment: string;
  mount?: string;
}

export function createDeveloperPolicy(input: ProjectPolicyInput): string {
  const path = projectPath(input);
  return [
    `path "${path.data}" {`,
    '  capabilities = ["create", "read", "update"]',
    '}',
    '',
    `path "${path.data}/*" {`,
    '  capabilities = ["create", "read", "update"]',
    '}',
    '',
    `path "${path.metadata}/*" {`,
    '  capabilities = ["read", "list"]',
    '}',
    '',
  ].join('\n');
}

export function createApplicationPolicy(input: ProjectPolicyInput): string {
  const path = projectPath(input);
  return [
    `path "${path.data}" {`,
    '  capabilities = ["read"]',
    '}',
    '',
    `path "${path.data}/*" {`,
    '  capabilities = ["read"]',
    '}',
    '',
  ].join('\n');
}

function projectPath(input: ProjectPolicyInput): { data: string; metadata: string } {
  const mount = input.mount ?? 'secret';
  const base = `projects/${input.project}/${input.environment}`;
  return {
    data: `${mount}/data/${base}`,
    metadata: `${mount}/metadata/${base}`,
  };
}