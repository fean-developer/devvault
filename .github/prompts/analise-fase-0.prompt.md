---
name: Phase 0 TLC Plan
description: Plano detalhado de implementação da Phase 0 — Developer Experience / Bootstrap.
agent: agent
---

A análise arquitetural da Phase 0 foi aprovada conceitualmente.

Agora quero que você produza SOMENTE o plano de implementação
da Phase 0 — Developer Experience / Bootstrap.

NÃO implemente código ainda.

Objetivo:

Transformar o DevVault em uma ferramenta transparente para o
desenvolvedor final, permitindo:

    devvault setup

preparar e validar o ambiente sem exigir conhecimento prévio
de Docker, Docker Compose, Vault, KV v2, pnpm ou Corepack.

A arquitetura aprovada é:

Phase 0
Developer Experience / Bootstrap

    ↓

Phase 1
Windows / WSL / Platform Foundations

    ↓

Phase 2
Vault Lifecycle Hardening

    ↓

Phase 3
Authentication Architecture

    ↓

Phase 4
CredentialStore

    ↓

Phase 5
Human Login / Logout

    ↓

Phase 6
Policies + Identity

    ↓

Phase 7
Security E2E

    ↓

Phase 8
MVP Gate

    ↓

Phase 9
AppRole

    ↓

Phase 10
OIDC / CI/CD


IMPORTANTE:

A Phase 0 NÃO deve implementar todas as funcionalidades
das fases posteriores.

Ela deve criar os contratos, orchestration boundaries,
adapters necessários e infraestrutura para que essas fases
possam ser implementadas posteriormente sem quebrar a
arquitetura.

## Escopo da Phase 0

Avaliar e planejar:

1. `devvault setup`
2. `devvault setup --check`
3. `devvault setup --json`
4. `devvault setup --repair`
5. SetupOrchestrator
6. DependencyChecker
7. ConsentService
8. BackendSelector
9. SetupStateStore
10. SetupValidator
11. Platform abstraction
12. Docker abstraction
13. Vault backend abstraction
14. READY / NOT_READY / DEGRADED / BLOCKED
15. idempotência
16. recovery
17. segurança do setup state
18. CLI standalone/bundled distribution

## NÃO implementar nesta fase

Não implementar ainda:

- AppRole;
- OIDC;
- CI/CD;
- dynamic secrets;
- Vault Agent;
- auto-unseal;
- CredentialStore real, exceto contratos/adapters necessários;
- autenticação humana completa;
- políticas finais de aplicação;
- funcionalidades avançadas de Vault;
- instalação automática de Docker Desktop;
- bypass de políticas corporativas.

Esses itens pertencem às fases posteriores.

## Regras arquiteturais obrigatórias

### INV-SETUP-001

`setup` nunca pode declarar READY sem backend de secrets
acessível e validado.

### INV-SETUP-002

Setup state nunca pode armazenar:

- passwords;
- tokens;
- SecretIDs;
- root credentials;
- unseal keys;
- secret values.

### INV-SETUP-003

Nenhuma instalação ou alteração do sistema pode ocorrer
sem consentimento explícito.

### INV-SETUP-004

Setup deve ser idempotente.

### INV-SETUP-005

Setup deve ser recuperável após interrupção.

### INV-SETUP-006

DevVault nunca pode contornar políticas de segurança
do sistema operacional ou ambiente corporativo.

### INV-SETUP-007

Docker Desktop nunca deve ser instalado ou alterado
automaticamente.

### INV-SETUP-008

Core não pode depender de APIs específicas de plataforma.

### INV-SETUP-009

Setup não pode persistir secrets.

### INV-SETUP-010

Root token nunca pode se tornar credencial normal
do Developer.

### INV-SETUP-011

Backend local e remoto devem possuir abstração comum.

### INV-SETUP-012

`devvault setup` prepara o ambiente DevVault.

`devvault init-project` prepara o projeto.

Não misturar essas responsabilidades.

## Backend

Planejar inicialmente somente:

Local:

    Docker → Vault

Remote:

    DevVault → Vault HTTP API

Não implementar Vault como processo nativo empacotado nesta fase.

Registrar essa alternativa como decisão futura.

## Estados

Definir formalmente:

NOT_READY
READY
DEGRADED
BLOCKED

Definir:

- significado;
- transições;
- critérios;
- exit codes;
- representação JSON.

## Distribution

Avaliar como transformar o CLI atual Node/TypeScript
em uma distribuição que não exija do usuário final:

- Node.js;
- pnpm;
- Corepack.

Não implemente ainda a distribuição final.

Apresente alternativas e recomendação.

## Test Strategy

Definir testes:

### Unit

- state machine;
- dependency detection;
- consent;
- backend selection;
- setup state;
- validation.

### Integration

- Docker available;
- Docker unavailable;
- daemon unavailable;
- Vault unavailable;
- Vault sealed;
- Vault ready;
- remote Vault.

### E2E

- clean setup;
- repeated setup;
- interrupted setup;
- repair;
- blocked environment;
- remote backend.

### Security

Garantir que:

- secrets nunca aparecem no setup state;
- tokens nunca aparecem em logs;
- exceptions não vazam credentials;
- temporary files não armazenam secrets.

## Phase Gate

Defina critérios objetivos para:

PHASE 0 READY

A Phase 0 NÃO poderá ser considerada concluída apenas porque:

- código compila;
- testes unitários passam;
- `setup` executa.

Ela somente poderá ser concluída quando houver
evidência suficiente para cada invariant arquitetural.

Crie uma matriz:

| Invariant | Test | Evidence | Status |

Nenhum invariant pode ficar como "assumed".

Estados permitidos:

PASS
FAIL
BLOCKED
NOT_TESTED

Se houver BLOCKED ou NOT_TESTED em um requisito
obrigatório, a Phase 0 NÃO pode ser marcada como COMPLETED.

## Architecture Compliance Gate

Antes de considerar a Phase 0 concluída, executar:

1. Architecture review
2. Invariant validation
3. Unit tests
4. Integration tests
5. E2E tests
6. Security tests
7. Documentation review
8. Roadmap consistency review

Ao final produzir:

# Phase 0 Readiness Report

com:

- Implemented
- Partially Implemented
- Not Implemented
- Evidence
- Invariants
- Risks
- Known Limitations
- Blockers
- Recommendation

IMPORTANTE:

Se encontrar conflito entre o código atual e a arquitetura,
NÃO faça uma mudança silenciosa.

Documente:

CONFLICT
IMPACT
PROPOSED CHANGE
RATIONALE

e aguarde aprovação.

Resultado esperado desta tarefa:

Somente o plano TLC detalhado da Phase 0.

Nenhum código deve ser alterado.