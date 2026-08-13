---
name: Revisar Implementar
description: Prompt para revisar a implementação de uma funcionalidade.
agent: agent

---

# DevVault — Revisão arquitetural antes da implementação

O diagnóstico técnico foi concluído e nenhum arquivo deve ser alterado ainda.

O diagnóstico identificou gaps em:

- segurança da entrada de secrets;
- autenticação humana;
- credential store;
- bootstrap do Vault;
- policies;
- identities;
- logging;
- tratamento de erros;
- testes E2E;
- arquitetura de application services;
- Windows/WSL;
- documentação.

Antes de implementar as correções, faça uma revisão arquitetural focada especificamente em:

1. ciclo de vida do Vault;
2. autenticação humana;
3. autenticação de aplicações;
4. armazenamento local de credenciais;
5. policies;
6. identities;
7. execução de processos;
8. segurança de secrets;
9. Windows/WSL.

Não altere código nesta etapa.

## 1. Defina claramente os tipos de identidade

Separe explicitamente:

### Developer

Pessoa utilizando:

    devvault login

### Local DevVault

Componente responsável por executar a CLI e acessar o Vault.

### Application

Processo executado por:

    devvault run -- <command>

### CI/CD

Execução automatizada fora da workstation.

Para cada identidade, defina:

- como autentica;
- qual credencial utiliza;
- onde a credencial fica;
- duração da credencial;
- policies;
- como ocorre revogação;
- qual é o blast radius em caso de comprometimento.

---

## 2. Defina o ciclo de vida do Vault

Não misture:

    devvault init

com:

    Vault operator initialization

Defina claramente:

### devvault init

Responsável por:

- verificar Docker;
- iniciar Vault;
- verificar estado;
- detectar se está inicializado;
- detectar se está sealed;
- verificar KV;
- preparar infraestrutura;
- aplicar configuração segura quando possível.

### devvault bootstrap

Avalie se deve existir um comando separado para:

- inicializar um Vault novo;
- configurar armazenamento;
- configurar KV;
- instalar policies;
- configurar autenticação;
- criar identities.

Defina também como serão tratados:

- root token;
- unseal keys;
- recovery keys.

Não persista automaticamente essas credenciais.

Explique como o usuário executará o primeiro bootstrap de maneira segura.

---

# 3. Defina autenticação humana

Projete:

    devvault login
    devvault logout
    devvault status

Não use VAULT_TOKEN como mecanismo primário da experiência do desenvolvedor.

Defina qual mecanismo de autenticação será utilizado no MVP.

Compare pelo menos:

- Token;
- Userpass;
- OIDC;
- AppRole.

Considere que o objetivo futuro é permitir autenticação corporativa.

A arquitetura deve permitir adicionar OIDC posteriormente sem alterar os use cases da CLI.

---

# 4. Defina autenticação de aplicações

Não confunda autenticação humana com autenticação de aplicações.

Para:

    devvault run -- <command>

defina se o processo utiliza:

- credencial do desenvolvedor;
- token delegado;
- AppRole;
- outro mecanismo.

Projete a arquitetura para suportar AppRole futuramente.

Não implemente ainda se não fizer parte do MVP, mas crie os contratos necessários.

---

# 5. Defina CredentialStore

Criar a seguinte abstração conceitual:

    interface CredentialStore {
      get(key)
      set(key, value)
      delete(key)
    }

Defina adapters para:

- Windows Credential Manager;
- Linux Secret Service;
- WSL;
- MemoryCredentialStore.

Explique especificamente como o WSL funcionará.

Não implemente ainda.

---

# 6. Defina o modelo de policies

A policy:

    secret/data/projects/+/+

é considerada inadequada para aplicação.

Defina um modelo de least privilege.

Exemplo:

    secret/data/projects/my-api/development/*

Explique como a policy será associada à identidade correta.

Defina:

Developer
Application
Administrator
CI/CD

e quais permissões cada um possui.

---

# 7. Defina o modelo de projeto

Avalie o modelo atual:

    project: my-api
    environment: development

    vault:
      mount: secret
      path: projects/my-api/development

Determine se devemos manter o path completo no YAML ou se o DevVault deve construí-lo a partir de:

    project
    environment

Evite permitir que um projeto aponte arbitrariamente para outro projeto.

Defina regras de validação.

---

# 8. Defina o fluxo completo

Produza diagramas Mermaid para:

### Primeiro setup

Developer
→ devvault init
→ Vault
→ bootstrap
→ authentication
→ policies

### Login

Developer
→ devvault login
→ authentication provider
→ Vault
→ short-lived credential
→ CredentialStore

### Secret access

Developer
→ devvault run
→ authentication
→ Vault
→ KV v2
→ secret resolution
→ child process

### Permission denied

Developer
→ DevVault
→ Vault
→ policy
→ denied

### Application authentication futura

Application
→ AppRole
→ Vault
→ policy
→ KV v2

---

# 9. Defina o threat model atualizado

Analise especificamente:

- root token;
- unseal keys;
- developer token;
- AppRole RoleID;
- AppRole SecretID;
- CredentialStore;
- environment variables;
- localhost HTTP;
- Docker;
- WSL;
- subprocessos;
- logs;
- crash dumps.

Para cada item:

    Asset
    Threat
    Impact
    Mitigation
    Residual Risk

---

# 10. Defina a arquitetura de código

Proponha:

    CLI
      ↓
    Application / Use Cases
      ↓
    Ports
      ↓
    Adapters
      ↓
    Vault / OS / Process

Defina os principais ports:

    VaultClient
    CredentialStore
    AuthenticationProvider
    ProcessLauncher
    Logger
    DockerManager

A CLI não deve instanciar diretamente adapters concretos.

---

# 11. Defina o MVP revisado

Classifique cada funcionalidade como:

CRITICAL
HIGH
MEDIUM
LOW
FUTURE

Inclua:

- hidden secret input;
- Vault bootstrap;
- login;
- logout;
- credential store;
- policies;
- identities;
- secret CRUD;
- run;
- doctor;
- E2E;
- security tests;
- Windows;
- WSL;
- AppRole;
- OIDC;
- Vault Agent;
- dynamic secrets.

---

# 12. Entregável desta etapa

Produza somente:

1. arquitetura revisada;
2. decisões arquiteturais;
3. diagramas Mermaid;
4. modelo de autenticação;
5. modelo de policies;
6. modelo de CredentialStore;
7. threat model;
8. roadmap revisado;
9. lista de arquivos que precisarão ser alterados.

NÃO ALTERE NENHUM ARQUIVO.

A implementação somente começará depois da aprovação desta arquitetura.