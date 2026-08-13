---
name: avaliacao-plano-fase-0
description: Avaliação do plano de implementação da Phase 0 — Developer Experience / Bootstrap.
agent: agent
---
Antes de iniciar qualquer implementação da Phase 0 — Developer Experience / Bootstrap, faça uma revisão crítica do plano apresentado.

NÃO ALTERE CÓDIGO AINDA.

Objetivo:

Validar se o plano Phase 0 está coerente com:
- architecture.md;
- design.md;
- invariants existentes;
- TLC/spec-driven workflow;
- decisões anteriores do DevVault;
- roadmap estratégico.

Faça obrigatoriamente as seguintes verificações:

1. Architecture Boundary
Verifique se SetupOrchestrator, DependencyChecker, ConsentService,
BackendSelector, SetupStateStore, SetupValidator e VaultBackend estão
corretamente separados entre Core e Platform adapters.

Garanta que o Core NÃO dependa de:
- node:os;
- node:child_process;
- process.platform;
- shell commands;
- keytar;
- caminhos específicos de plataforma;
- APIs Windows;
- APIs WSL;
- Docker diretamente.

2. Invariants
Faça uma auditoria completa dos invariants.

Não aceite:
- IDs duplicados;
- IDs com significados diferentes entre documentos;
- invariants definidos em um documento e ausentes em outro;
- testes sem invariant correspondente;
- invariants sem evidência possível.

A matriz deve possuir exatamente os mesmos invariants definidos na arquitetura.

3. State Machine
Valide formalmente:
NOT_READY
READY
BLOCKED
FAILED

e, caso DEGRADED permaneça, defina exatamente quando ele pode ocorrer.

Nenhum estado pode ser utilizado para mascarar uma falha obrigatória.

Defina:
- transições válidas;
- transições inválidas;
- exit codes;
- recovery;
- comportamento após interrupção.

4. READY Gate
Defina exatamente quais evidências são obrigatórias para declarar READY.

READY não pode significar apenas "Vault respondeu".

Deve validar efetivamente:
- backend;
- Vault lifecycle;
- KV;
- policy/capability;
- authentication;
- CredentialStore quando obrigatório;
- projeto;
- environment;
- configuração;
- ausência de blockers.

5. Security
Verifique que:
- setup state nunca contém credenciais;
- logs nunca contém credenciais;
- exceptions nunca contém credenciais;
- JSON nunca contém credenciais;
- argumentos de processo nunca contém credenciais;
- .env não é criado;
- root token nunca vira credential normal;
- nenhum fallback plaintext é criado silenciosamente.

6. Platform
Verifique se Linux, WSL2, Windows, PowerShell e Docker Desktop
são tratados como adapters/capabilities e não como regras do Core.

Não considerar "implementado" como "validado".

Diferencie explicitamente:
IMPLEMENTED
TESTED
NOT_EXECUTED
BLOCKED_BY_ENVIRONMENT
FAILED

7. Backend
Valide a abstração:

VaultBackend
 ├── LocalDockerVaultBackend
 └── RemoteVaultBackend

Ambos devem obedecer ao mesmo contrato.

Não permitir que regras específicas de Docker vazem para o Core.

8. SetupOrchestrator
Verifique que o orchestrator apenas coordena use cases.

Não permitir God Object.

Cada regra deve permanecer no componente responsável.

9. Dependency / Installation
Verifique se instalação automática de:
- Docker;
- Node;
- runtime;
- ferramentas de sistema

está claramente separada do diagnóstico.

Nenhuma instalação ou alteração do sistema pode ocorrer sem consentimento explícito.

10. Roadmap
Verifique se Phase 0 não invade indevidamente:
- Phase 1 Windows/WSL;
- Phase 2 Vault lifecycle;
- Phase 3 Authentication;
- Phase 4 CredentialStore;
- Phase 5 Human login;
- Phase 6 Policies/Identity;
- Phase 7 Security E2E;
- Phase 9 AppRole;
- Phase 10 OIDC/CI/CD.

Identifique qualquer overlap.

11. TLC
Verifique se cada requisito possui:
Requirement
→ Design
→ Task
→ Test
→ Evidence
→ Gate

Nenhum requisito crítico pode ficar sem teste.

12. Critérios de saída
Revise os critérios de conclusão da Phase 0.

Eles devem ser objetivos e verificáveis.

Não aceitar critérios como:
"funciona corretamente"
"testado"
"validado"

sem definir a evidência necessária.

13. Correções
Se encontrar problemas:
- liste cada problema;
- classifique como CRITICAL/HIGH/MEDIUM/LOW;
- proponha correção;
- NÃO implemente a correção ainda.

Ao final produza:

# Phase 0 Architecture Review

## Verdict
PASS / PASS WITH CHANGES / BLOCKED

## Critical Findings

## High Findings

## Medium Findings

## Invariant Audit

## Architecture Boundary Audit

## State Machine Audit

## Security Audit

## Platform Audit

## TLC Traceability Audit

## Roadmap Boundary Audit

## Required Changes

## Final Recommendation

IMPORTANTE:

Não altere código.
Não crie novos arquivos de implementação.
Não execute a Phase 0.

Somente depois de eu aprovar explicitamente o resultado dessa revisão,
a Phase 0 poderá avançar para Specification → Design → Tasks → Implementation.