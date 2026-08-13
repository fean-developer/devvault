---
name: aplicar-fix
description: Aplica correções de implementação arquitetural.
agent: agent
---

O Architecture Review foi concluído com verdict PASS WITH CHANGES.

Agora aplique SOMENTE as correções arquiteturais identificadas no review.

IMPORTANTE:
- não implementar código;
- não criar adapters funcionais;
- não implementar setup;
- não avançar para Phase 1–6;
- não alterar comportamento existente do DevVault;
- não iniciar Specification automaticamente sem concluir primeiro as correções do plano.

Execute somente uma etapa de planejamento arquitetural.

## Correções obrigatórias

1. Unificar a matriz de invariantes

Criar uma matriz canônica contendo:

INV-001 ... INV-018
INV-SETUP-001 ... INV-SETUP-012

Nenhum ID pode mudar de significado.

Cada invariant deve possuir:

- ID
- source
- requirement
- applicable phase
- test
- evidence
- status

2. Formalizar estados

Separar:

### Setup result

READY
DEGRADED
BLOCKED
FAILED

### Vault lifecycle

UNAVAILABLE
NOT_INITIALIZED
SEALED
UNSEALED
CONFIGURED
READY

Definir formalmente:

- significado;
- exit code;
- transições;
- recovery;
- interrupção;
- corrupção de state.

Para DEGRADED, documentar casos concretos e garantir que ele nunca mascare uma capability obrigatória ausente.

3. Formalizar VaultBackend

Criar contrato conceitual capability-based.

O contrato deve permitir:

LocalDockerVaultBackend
RemoteVaultBackend

sem obrigar backend remoto a implementar operações específicas de Docker.

4. Formalizar SetupOrchestrator

O orchestrator deve somente coordenar SetupStep.

Cada step deve possuir:

- id;
- mutating;
- requiresConsent;
- run();
- resultado estruturado;
- metadata não sensível;
- idempotência.

O orchestrator não pode conter lógica específica de:

- Docker;
- Vault;
- autenticação;
- keyring;
- Windows;
- WSL.

5. Formalizar DependencyChecker / Consent / Installation

Separar explicitamente:

DependencyChecker = READ ONLY

ConsentService = DECISION

InstallationManager = AUTHORIZED MUTATION

Regra absoluta:

devvault setup --check

não pode executar nenhuma operação mutating.

`--non-interactive` sem autorização suficiente deve retornar BLOCKED.

6. Formalizar SetupState

Definir:

- schema;
- allowlist de campos;
- sanitização;
- atomic write;
- temporary file;
- rename;
- schema validation;
- corrupção;
- concorrência;
- recovery.

O state nunca pode conter:

- token;
- password;
- SecretID;
- authorization header;
- secret;
- unseal key;
- recovery key.

7. Definir boundary da Phase 0

Explicitamente marcar como OUT OF SCOPE:

- AppRole;
- OIDC;
- CI/CD;
- auto-unseal;
- login completo;
- renewal;
- policies finais;
- identities finais;
- CredentialStore real;
- dynamic secrets;
- Vault Agent;
- instalação automática do Docker Desktop.

Phase 0 somente prepara contracts, detection, orchestration,
state, consent, backend selection e validation boundary.

8. Definir READY Gate

Definir exatamente quais capabilities são obrigatórias para cada perfil.

Não permitir que READY dependa de funcionalidades que só serão implementadas nas próximas phases.

9. Formalizar TLC

Criar a feature:

.specs/features/devvault-setup/

com:

spec.md
design.md
tasks.md
validation.md

Não alterar ainda arquivos de implementação.

10. Definir traceability

Toda requirement deve possuir:

Requirement
→ Design
→ Task
→ Test
→ Evidence

Nenhuma requirement crítica pode ficar sem teste.

11. Corrigir a matriz de cobertura

Cada invariant crítico deve possuir:

Invariant
→ Test
→ Evidence
→ Status

Nenhum invariant poderá terminar a Phase 0 como NOT_TESTED.

## Entregáveis desta etapa

Criar/atualizar SOMENTE documentação de planejamento:

- Architecture Authority / invariants
- Phase 0 plan
- state model
- backend contract
- setup orchestration model
- setup state model
- roadmap boundaries

NÃO criar ainda:

- spec.md
- tasks.md
- código
- adapters
- testes de implementação

Depois de aplicar as correções, produzir:

# Phase 0 Plan Correction Report

## Changes Applied

## Invariant Matrix

## State Machine

## Vault Lifecycle Model

## Backend Capability Model

## Setup Orchestrator Boundary

## Setup State Security Model

## Phase Boundaries

## READY Gate

## Remaining Risks

## Final Verdict

O verdict deve ser:

READY FOR SPECIFICATION

ou

NOT READY FOR SPECIFICATION

Não avance automaticamente para Specification.

Pare após apresentar o relatório para aprovação.