# DevVault — Especificação para desenvolvimento por IA

## 1. Papel

Você é um **Senior Software Architect + Senior TypeScript Engineer + Security Engineer**, especialista em:

* Node.js
* TypeScript
* CLI applications
* HashiCorp Vault
* Secret Management
* Docker
* WSL/Linux
* Authentication & Authorization
* AppRole
* Vault KV v2
* Process management
* Secure credential storage
* GitHub Actions
* CI/CD
* Developer Experience

Sua responsabilidade é projetar e implementar uma aplicação chamada **DevVault**.

Não trate este projeto como um simples wrapper do CLI oficial do Vault.

O DevVault deve ser uma **Developer Experience Layer sobre o HashiCorp Vault**, permitindo que desenvolvedores utilizem secrets localmente sem precisar armazená-los em arquivos `.env`.

---

# 2. Objetivo do produto

O DevVault deve resolver o seguinte problema:

> Desenvolvedores precisam de secrets para executar aplicações localmente, mas não devem precisar armazenar esses secrets em `.env`, arquivos de configuração ou no Git.

Exemplos:

* DATABASE_PASSWORD
* DATABASE_URL
* REDIS_PASSWORD
* KAFKA_PASSWORD
* KEYCLOAK_CLIENT_SECRET
* GITHUB_TOKEN
* AZURE_DEVOPS_TOKEN
* API_KEY
* PRIVATE_KEY
* outros secrets de aplicações

A arquitetura deve utilizar o **HashiCorp Vault como secret store**.

O DevVault será responsável por:

1. configurar o ambiente local;
2. conectar-se ao Vault;
3. autenticar o desenvolvedor;
4. localizar o projeto;
5. resolver os secrets necessários;
6. executar processos com os secrets disponíveis;
7. evitar a criação de `.env`;
8. aplicar políticas de acesso;
9. fornecer uma experiência simples via CLI.

---

# 3. Princípio fundamental de segurança

A regra principal do projeto é:

> **Secrets nunca devem ser armazenados em arquivos do projeto.**

Não criar automaticamente:

* `.env`
* `.env.local`
* `.env.development`
* `.env.production`
* arquivos JSON contendo secrets
* arquivos YAML contendo secrets
* arquivos temporários contendo secrets

O arquivo `devvault.yaml` deve conter somente configuração não sensível.

Secrets devem permanecer no Vault e ser recuperados somente quando necessários.

---

# 4. Stack tecnológica

Utilize:

### CLI

* TypeScript
* Node.js LTS
* Commander.js ou uma biblioteca CLI equivalente bem mantida
* Zod para validação de configuração
* Vitest para testes
* ESLint
* Prettier
* tsup ou equivalente para build

### Vault

* HashiCorp Vault
* KV v2
* Policies
* AppRole
* Vault HTTP API / SDK oficial quando disponível

### Infraestrutura

* Docker
* Docker Compose
* Linux/WSL compatível
* Windows compatível quando possível

### Package manager

Preferencialmente `pnpm`.

Se escolher outra tecnologia, justifique a decisão antes da implementação.

---

# 5. Arquitetura

Utilize arquitetura modular.

Estrutura inicial:

```text
devvault/
├── apps/
│   └── cli/
│       └── src/
│           ├── commands/
│           ├── vault/
│           ├── auth/
│           ├── config/
│           ├── runtime/
│           ├── platform/
│           └── utils/
│
├── packages/
│   ├── core/
│   ├── vault-client/
│   └── config/
│
├── infra/
│   └── vault/
│       ├── docker-compose.yml
│       ├── config/
│       ├── policies/
│       └── bootstrap/
│
├── docs/
│
├── tests/
│
├── package.json
├── pnpm-workspace.yaml
├── tsconfig.json
└── README.md
```

Evite criar um monólito dentro de `index.ts`.

Separe claramente:

* CLI layer
* application layer
* Vault infrastructure
* authentication
* configuration
* runtime process execution
* platform-specific functionality

---

# 6. Conceito do DevVault

O DevVault deve funcionar como:

```text
Developer
    |
    v
DevVault CLI
    |
    +--> Project configuration
    |
    +--> Authentication
    |
    +--> Vault
    |
    +--> Secret resolution
    |
    v
Process execution
```

Exemplo:

```bash
devvault run -- npm run dev
```

Fluxo:

```text
devvault run
    |
    +--> localizar devvault.yaml
    |
    +--> identificar projeto
    |
    +--> identificar environment
    |
    +--> autenticar no Vault
    |
    +--> resolver secrets
    |
    +--> montar environment
    |
    +--> iniciar processo filho
    |
    +--> remover credenciais após encerramento
```

Nenhum `.env` deve ser criado.

---

# 7. Configuração do projeto

Cada projeto deve poder possuir:

```text
devvault.yaml
```

Exemplo:

```yaml
version: 1

project: my-api

environment: development

vault:
  mount: secret
  path: projects/my-api/development

runtime:
  mappings:
    DATABASE_URL: database.url
    DATABASE_USER: database.username
    DATABASE_PASSWORD: database.password
    KEYCLOAK_CLIENT_SECRET: keycloak.client_secret
```

Esse arquivo é seguro para commit.

Nunca permita valores como:

```yaml
DATABASE_PASSWORD: "123456"
```

ou:

```yaml
token: "ghp_xxxxx"
```

---

# 8. Estrutura do Vault

Utilize:

```text
secret/
└── projects/
    ├── my-api/
    │   └── development/
    │       ├── database
    │       ├── redis
    │       ├── kafka
    │       └── keycloak
    │
    └── migration-tool/
        └── development/
            ├── github
            ├── azure-devops
            └── database
```

Utilize KV v2.

Não misture secrets de projetos diferentes sem necessidade.

---

# 9. CLI

A CLI deve possuir inicialmente:

```bash
devvault init
devvault init-project

devvault login
devvault logout
devvault status

devvault secret set <key>
devvault secret get <key>
devvault secret list
devvault secret delete <key>

devvault run -- <command>

devvault exec <project> -- <command>

devvault doctor
```

---

# 10. `devvault init`

Responsabilidades:

1. verificar Docker;
2. verificar Docker Compose;
3. iniciar o Vault;
4. verificar disponibilidade;
5. inicializar o Vault se necessário;
6. habilitar KV v2;
7. criar policies;
8. configurar autenticação;
9. preparar estrutura inicial;
10. configurar o ambiente local do DevVault.

O comando deve ser idempotente.

Executar duas vezes não deve destruir ou duplicar configurações.

---

# 11. `devvault init-project`

Deve:

1. detectar o diretório atual;
2. detectar o nome do projeto;
3. permitir configuração do environment;
4. criar `devvault.yaml`;
5. nunca criar secrets;
6. nunca sobrescrever configuração existente sem confirmação.

Exemplo:

```bash
devvault init-project
```

Resultado:

```text
✔ Project detected: my-api
✔ Environment: development
✔ devvault.yaml created
```

---

# 12. Secrets

Implementar:

```bash
devvault secret set database.password
```

O valor deve ser solicitado de forma segura.

Não fazer:

```text
echo "$SECRET"
```

Não exibir o valor no terminal.

Não registrar o valor em logs.

Não colocar o valor em mensagens de erro.

O comando:

```bash
devvault secret get database.password
```

deve possuir comportamento explícito para evitar vazamento acidental.

Por exemplo:

```bash
devvault secret get database.password
```

pode retornar o valor somente quando explicitamente solicitado.

Considere:

```bash
devvault secret get database.password --show
```

ou uma abordagem equivalente.

---

# 13. `devvault run`

Este é o recurso principal do MVP.

Exemplo:

```bash
devvault run -- npm run dev
```

ou:

```bash
devvault run -- python migration.py
```

ou:

```bash
devvault run -- npx prisma migrate dev
```

O DevVault deve:

1. carregar `devvault.yaml`;
2. autenticar;
3. buscar somente os secrets necessários;
4. construir o environment;
5. criar o processo filho;
6. encaminhar stdin/stdout/stderr;
7. encaminhar sinais;
8. retornar o exit code correto;
9. limpar referências locais aos secrets após o processo terminar.

Não criar `.env`.

---

# 14. Segurança de environment variables

Reconheça que environment variables não são uma fronteira de segurança perfeita.

Documente os riscos de:

* `/proc`
* process inspection
* debugging
* crash dumps
* child processes
* shell history
* logs

O MVP pode utilizar environment variables porque elas são compatíveis com praticamente todas as aplicações.

Porém, projete a arquitetura permitindo posteriormente:

```text
Vault
  |
  +--> environment variables
  |
  +--> Vault Agent
  |
  +--> local socket
  |
  +--> direct SDK integration
```

Não acople o Core exclusivamente a environment variables.

---

# 15. Autenticação

Separar claramente:

```text
Human authentication
```

de:

```text
Application authentication
```

Não utilizar o mesmo mecanismo para ambos.

Para aplicações, preparar suporte a:

```text
AppRole
```

Cada aplicação deve possuir somente acesso aos secrets necessários.

Exemplo:

```text
my-api-development
```

deve acessar:

```text
secret/data/projects/my-api/development/*
```

mas não:

```text
secret/data/projects/other-project/*
```

---

# 16. Policies

Criar policies separadas.

No mínimo:

```text
admin
developer
application
readonly
```

Uma aplicação deve possuir:

```text
read
```

somente nos paths necessários.

Não conceder:

```text
sudo
root
delete
update
```

sem necessidade.

Aplicar princípio de:

> Least Privilege.

---

# 17. Credential storage

Nunca armazenar permanentemente:

```text
VAULT_TOKEN
```

em:

```text
devvault.yaml
config.yaml
package.json
.env
```

Quando for necessário persistir material de autenticação local, utilizar mecanismos apropriados ao sistema operacional:

### Windows

Credential Manager.

### Linux

Secret Service / keyring quando disponível.

### WSL

Avaliar integração segura com o host Windows ou mecanismo próprio do Linux.

Criar uma abstração:

```typescript
interface CredentialStore {
  get(key: string): Promise<string | null>;
  set(key: string, value: string): Promise<void>;
  delete(key: string): Promise<void>;
}
```

Implementações:

```text
WindowsCredentialStore
LinuxCredentialStore
MemoryCredentialStore
```

---

# 18. `devvault doctor`

Implementar diagnóstico completo.

Exemplo:

```text
DevVault Doctor

✔ Node.js
✔ Docker
✔ Docker daemon
✔ Vault container
✔ Vault reachable
✔ Vault initialized
✔ KV v2
✔ Authentication
✔ Developer identity
✔ Project configuration
✔ Project policy

Project:
  my-api

Environment:
  development

Vault:
  http://127.0.0.1:8200

Secrets:
  ✔ database
  ✔ redis
  ✔ keycloak
```

Nunca exibir os valores dos secrets.

---

# 19. Tratamento de erros

Criar erros específicos:

```text
VaultUnavailableError
VaultAuthenticationError
VaultPermissionDeniedError
ProjectConfigError
SecretNotFoundError
InvalidProjectConfigError
DockerUnavailableError
CredentialStoreError
```

Mensagens devem ser úteis para o desenvolvedor.

Exemplo ruim:

```text
Error: 403
```

Exemplo desejado:

```text
Access denied while reading:

secret/projects/my-api/development/database

Check the project's Vault policy.

Run:

  devvault doctor
```

Nunca incluir secrets nas mensagens.

---

# 20. Logging

Criar níveis:

```text
silent
error
warn
info
debug
```

Nunca logar:

* secret values;
* tokens;
* passwords;
* API keys;
* SecretIDs;
* private keys.

Adicionar testes automatizados garantindo que secrets não apareçam nos logs.

---

# 21. Auditoria

Preparar a arquitetura para suportar audit logs do Vault.

O DevVault não deve implementar seu próprio mecanismo de auditoria como substituto do Vault.

O Vault é a fonte de verdade para operações de secret management.

---

# 22. Docker

Criar:

```text
infra/vault/docker-compose.yml
```

O container deve:

* possuir volume persistente;
* possuir healthcheck;
* possuir configuração explícita;
* não utilizar `latest`;
* permitir configuração da versão;
* possuir rede própria;
* não expor portas desnecessárias.

O Vault deve ser acessível localmente através de:

```text
127.0.0.1:8200
```

Não exponha o Vault para `0.0.0.0` sem justificativa.

---

# 23. Persistência

Não perder secrets quando o container for recriado.

Utilizar volume persistente.

Testar:

```text
docker compose down
docker compose up
```

e verificar que os secrets continuam disponíveis.

Também testar:

```text
docker compose restart
```

---

# 24. Compatibilidade

Priorizar:

```text
Windows
WSL2
Linux
macOS
```

O MVP deve funcionar especialmente bem em:

```text
Windows + WSL2 + Docker Desktop
```

Detectar o ambiente automaticamente quando possível.

Evitar comandos shell específicos de uma única plataforma no Core.

---

# 25. Testes

A aplicação deve possuir testes unitários e de integração.

### Unitários

Testar:

* configuração;
* YAML parsing;
* schema validation;
* secret mapping;
* process launcher;
* credential store;
* error handling;
* Vault client;
* policy resolution.

### Integração

Subir Vault real em Docker e testar:

```text
init
KV
policy
authentication
secret set
secret get
secret list
run
```

### Segurança

Testar explicitamente:

```text
secret não aparece no stdout
secret não aparece no stderr
secret não aparece em logs
secret não aparece em exceptions
secret não é gravado em devvault.yaml
secret não é gravado em arquivos temporários
```

---

# 26. Teste end-to-end obrigatório

Criar um cenário:

```text
test-app/
├── devvault.yaml
└── app.js
```

`app.js`:

```javascript
console.log(process.env.TEST_SECRET);
```

Configurar:

```text
TEST_SECRET=hello-devvault
```

Executar:

```bash
devvault run -- node app.js
```

Resultado:

```text
hello-devvault
```

E verificar:

```text
.env não existe
secret não está no devvault.yaml
```

Também criar um teste verificando que um secret não autorizado retorna:

```text
permission denied
```

---

# 27. DX

A CLI deve ser agradável.

Utilizar:

* mensagens claras;
* símbolos de sucesso/erro;
* cores apenas quando suportadas;
* modo `--json`;
* exit codes corretos;
* autocomplete futuramente.

Exemplo:

```bash
devvault status
```

Deve permitir:

```bash
devvault status --json
```

para integração com scripts.

---

# 28. Comandos destrutivos

Comandos como:

```bash
devvault secret delete
devvault reset
devvault destroy
```

devem exigir confirmação.

Nunca executar operações destrutivas silenciosamente.

Adicionar:

```bash
--yes
```

para automação explícita.

---

# 29. Idempotência

Todos os comandos de infraestrutura devem ser idempotentes.

Por exemplo:

```bash
devvault init
```

executado dez vezes não deve:

* recriar policies;
* apagar secrets;
* resetar Vault;
* sobrescrever configuração;
* gerar novas credenciais desnecessariamente.

---

# 30. Não reinventar o Vault

Não implementar no DevVault:

* criptografia própria;
* algoritmo próprio de secrets;
* mecanismo próprio de rotação;
* mecanismo próprio de autorização;
* armazenamento próprio de secrets.

Delegar segurança ao HashiCorp Vault sempre que possível.

O DevVault deve ser uma camada de orquestração e Developer Experience.

---

# 31. Segurança por design

Antes de implementar funcionalidades de segurança, analise:

1. onde o secret existe;
2. por quanto tempo existe;
3. quem pode acessá-lo;
4. como é autenticado;
5. como é transportado;
6. se é armazenado;
7. se aparece em logs;
8. se aparece em processos filhos;
9. como é revogado;
10. qual é o blast radius em caso de comprometimento.

Documentar essas decisões.

---

# 32. Documentação

Criar:

```text
docs/
├── architecture.md
├── security.md
├── authentication.md
├── vault.md
├── configuration.md
├── cli.md
├── development.md
├── troubleshooting.md
└── threat-model.md
```

O `README.md` deve explicar:

1. problema;
2. arquitetura;
3. instalação;
4. quick start;
5. configuração;
6. comandos;
7. segurança;
8. desenvolvimento;
9. troubleshooting.

---

# 33. Threat Model

Criar um threat model simples considerando:

```text
Threats
├── accidental Git commit
├── malicious developer
├── compromised local machine
├── leaked Vault token
├── leaked AppRole SecretID
├── process inspection
├── log leakage
├── Docker compromise
├── backup leakage
└── credential store compromise
```

Para cada ameaça:

```text
Threat
Impact
Likelihood
Mitigation
Residual Risk
```

Não afirmar que o DevVault elimina completamente o risco de secrets em uma máquina comprometida.

---

# 34. MVP

Não implemente tudo de uma vez.

Primeiro implemente somente:

```text
1. Monorepo
2. CLI
3. Docker Vault
4. KV v2
5. devvault.yaml
6. init
7. init-project
8. secret set
9. secret get
10. secret list
11. run
12. doctor
13. policies
14. testes
15. documentação
```

Depois pare e valide o MVP.

Somente após o MVP estar funcionando implementar:

```text
AppRole
credential store avançado
Vault Agent
Docker integration
GitHub Actions
OIDC
dynamic secrets
VS Code extension
```

---

# 35. Processo de desenvolvimento

Não gere centenas de arquivos imediatamente.

Trabalhe incrementalmente.

Para cada etapa:

1. explique o que será implementado;
2. mostre a decisão arquitetural;
3. implemente;
4. execute testes;
5. corrija problemas;
6. atualize documentação;
7. valide a etapa;
8. só então avance.

Nunca marque uma tarefa como concluída sem evidência de que ela funciona.

---

# 36. Regra contra código fictício

Não utilize:

```text
TODO
FIXME
mock
placeholder
fake implementation
```

em funcionalidades que deveriam estar funcionando no MVP.

Se uma integração não puder ser implementada corretamente, explique o bloqueio.

Não simule uma integração com Vault e apresente como funcional.

---

# 37. Regra de dependências

Antes de adicionar uma dependência:

1. verifique se ela é realmente necessária;
2. prefira bibliotecas maduras;
3. evite dependências abandonadas;
4. evite dependências que duplicam funcionalidade do Node;
5. documente decisões importantes.

---

# 38. Critérios de aceitação do MVP

O MVP será considerado concluído somente quando for possível executar:

```bash
devvault init
```

depois:

```bash
devvault init-project
```

configurar:

```bash
devvault secret set database.password
```

e executar:

```bash
devvault run -- node test-app.js
```

onde:

```javascript
process.env.DATABASE_PASSWORD
```

possua o valor armazenado no Vault.

Também deve funcionar:

```bash
devvault doctor
```

e detectar problemas.

Deve ser possível reiniciar o Docker e continuar acessando os secrets.

Nenhum secret deve ser criado no Git.

Nenhum `.env` deve ser criado.

Nenhum secret deve aparecer nos logs.

---

# 39. Entregáveis

Ao finalizar o MVP, entregar:

```text
[ ] Código fonte
[ ] Monorepo funcional
[ ] CLI executável
[ ] Docker Compose
[ ] Vault configurado
[ ] KV v2
[ ] Policies
[ ] devvault.yaml
[ ] Commands
[ ] Unit tests
[ ] Integration tests
[ ] E2E test
[ ] Security tests
[ ] README
[ ] Architecture documentation
[ ] Security documentation
[ ] Threat model
[ ] Troubleshooting
```

---

# 40. Primeira tarefa

Antes de escrever código:

1. analise toda esta especificação;
2. proponha a arquitetura final do MVP;
3. proponha a estrutura do monorepo;
4. defina os principais módulos;
5. defina as interfaces;
6. defina o fluxo de autenticação;
7. defina o modelo `devvault.yaml`;
8. defina o modelo de secrets;
9. defina as policies iniciais;
10. identifique riscos de segurança;
11. identifique decisões que precisam ser tomadas;
12. apresente um plano de implementação dividido em fases.

## Architecture Authority

The architecture documentation under docs/architecture/
is authoritative for architectural decisions.

Do not introduce architectural changes implicitly.

If an implementation requires violating an architecture
invariant, stop implementation and propose an ADR.

Never silently trade architectural integrity for
implementation convenience.

**Não implemente ainda.**

Primeiro apresente o plano arquitetural e aguarde aprovação.

Depois da aprovação, implemente o MVP de forma incremental, executando os testes a cada etapa.
Sempre atualize as documentações inclusive  README ao final de cada etapa, após a validação, e antes de avançar para a próxima etapa.


## Artefatos
  - Toda decisão de plano e registros devem gerar um artefato documentado, em docs/artefatos, para manter registros de evolução e mudanças importantes.
  - caso não exista docs/artefatos a pasta deve ser criada