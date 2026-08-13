# DevVault — Phase Governance & Architecture Gate

Este documento define as regras obrigatórias para execução do
roadmap do DevVault.

A implementação do projeto é organizada em fases.

A IA NÃO deve avançar automaticamente para a próxima fase.

Toda fase possui um ciclo obrigatório:

PLAN
→ IMPLEMENT
→ TEST
→ SECURITY REVIEW
→ ARCHITECTURE REVIEW
→ PHASE GATE
→ APPROVAL
→ NEXT PHASE

============================================================
1. ROADMAP
============================================================

O roadmap oficial é:

Phase 1 — Windows / WSL / Platform Foundations
Phase 2 — Vault Lifecycle Hardening
Phase 3 — Authentication Architecture
Phase 4 — CredentialStore
Phase 5 — Human Login / Logout
Phase 6 — Policies + Identity
Phase 7 — Security E2E
Phase 8 — MVP Gate
Phase 9 — Application Authentication / AppRole
Phase 10 — OIDC / CI/CD

A ordem não deve ser alterada implicitamente.

Caso uma dependência exija alteração da ordem:

STOP.

Explique:

- dependência;
- motivo;
- impacto;
- alternativa;
- nova ordem proposta.

Aguarde aprovação explícita.

============================================================
2. PHASE BOUNDARY
============================================================

Cada fase possui um escopo explícito.

A IA não deve implementar funcionalidades pertencentes
a fases futuras apenas porque são tecnicamente convenientes.

Exemplo:

Durante Phase 1 NÃO implementar:

- AppRole;
- OIDC;
- CI/CD;
- Human Login;
- CredentialStore;

a menos que uma dependência arquitetural seja identificada.

Se uma dependência existir:

STOP.

Documente a dependência antes de implementar.

============================================================
3. BEFORE IMPLEMENTATION GATE
============================================================

Antes de iniciar qualquer fase:

1. Leia a documentação arquitetural.
2. Leia os Architecture Invariants.
3. Leia o resultado do último Phase Gate.
4. Leia o roadmap.
5. Analise o estado atual do código.
6. Identifique o escopo da fase.
7. Identifique dependências.
8. Identifique riscos.
9. Identifique arquivos/componentes afetados.
10. Proponha o plano de implementação.

Não altere código antes desse planejamento.

============================================================
4. IMPLEMENTATION RULES
============================================================

Durante a implementação:

- preservar Architecture Invariants;
- manter Core desacoplado de Infrastructure;
- manter platform-specific code em adapters;
- não introduzir secrets em arquivos;
- não expor secrets em logs;
- não introduzir credenciais estáticas sem justificativa;
- não criar atalhos arquiteturais;
- não duplicar lógica existente;
- reutilizar ports e abstrações existentes.

Se uma mudança arquitetural for necessária:

STOP.

Não implemente silenciosamente.

Proponha um ADR.

============================================================
5. TEST GATE
============================================================

Ao terminar a implementação da fase, executar:

- unit tests;
- integration tests;
- E2E tests quando aplicável;
- lint;
- typecheck;
- build.

Não considerar uma fase concluída apenas porque:

"build passou"

ou:

"unit tests passaram".

============================================================
6. SECURITY GATE
============================================================

Para qualquer mudança relacionada a secrets,
authentication, Vault, runtime ou credentials:

verificar:

- stdout;
- stderr;
- logs;
- exceptions;
- command arguments;
- environment;
- filesystem;
- temporary files;
- shell history;
- process inspection.

Secrets nunca devem aparecer em:

- logs;
- errors;
- command line;
- project files;
- generated configuration.

Adicionar testes sempre que tecnicamente possível.

============================================================
7. ARCHITECTURE GATE
============================================================

Depois dos testes:

verificar:

CLI
↓
Application
↓
Ports
↓
Adapters
↓
Infrastructure

Verificar também:

- Core não depende de Infrastructure;
- Core não depende de plataforma;
- Application não instancia adapters diretamente;
- platform-specific logic está isolada;
- authentication providers são abstraídos;
- CredentialStore é abstraído;
- Vault access é abstraído;
- runtime permanece desacoplado.

Executar Architecture Compliance Review.

============================================================
8. INVARIANT GATE
============================================================

Todos os Architecture Invariants devem ser avaliados.

Para cada invariant:

ID
Status
Evidence
Tests
Notes

Exemplo:

INV-001
Status: PASS
Evidence: config/schema.ts
Test: config.test.ts
Notes: secret values rejected

Nunca considerar:

"documentado"

como equivalente a:

"implementado".

============================================================
9. PHASE EXIT CRITERIA
============================================================

Uma fase só pode ser marcada como:

COMPLETED

quando:

- todos os requisitos da fase foram implementados;
- testes relevantes passaram;
- security review passou;
- architecture review passou;
- invariants não foram violados;
- documentação foi atualizada;
- limitações foram registradas;
- nenhum CRITICAL aberto;
- nenhum HIGH aberto relacionado ao escopo da fase.

Se algum requisito não puder ser validado:

marcar:

BLOCKED

ou:

PARTIALLY VALIDATED

Nunca marcar como COMPLETED por expectativa.

============================================================
10. REAL ENVIRONMENT VALIDATION
============================================================

Não declarar compatibilidade com uma plataforma apenas
porque o código teoricamente suporta a plataforma.

Diferenciar:

IMPLEMENTED
TESTED
NOT TESTED
BLOCKED
EXPECTED TO WORK

Exemplo:

Windows:
IMPLEMENTED
NOT TESTED

não é equivalente a:

Windows:
TESTED

============================================================
11. PHASE GATE REPORT
============================================================

Ao terminar cada fase, gerar obrigatoriamente:

# Phase Gate Report

## Phase

Nome e número da fase.

## Status

PASS
PASS WITH WARNINGS
PARTIAL
BLOCKED
FAIL

## Implementation

O que foi implementado.

## Tests

Testes executados.

## Security

Resultados da revisão de segurança.

## Architecture

Resultados da revisão arquitetural.

## Invariants

Tabela:

| ID | Status | Evidence | Test |
|----|--------|----------|------|

## Documentation

Documentação atualizada.

## Known Limitations

Limitações conhecidas.

## Technical Debt

Dívidas técnicas introduzidas ou descobertas.

## Deferred Items

Itens deliberadamente deixados para fases futuras.

## Exit Criteria

| Criterion | Status | Evidence |
|-----------|--------|----------|

## Recommendation

Uma das opções:

READY FOR NEXT PHASE
NEEDS FIXES
BLOCKED
PARTIALLY VALIDATED

============================================================
12. NEXT PHASE RULE
============================================================

A IA NÃO deve iniciar automaticamente a próxima fase.

Depois do Phase Gate, deve:

1. apresentar o relatório;
2. indicar a recomendação;
3. aguardar aprovação explícita.

Somente após aprovação explícita:

"Proceed to Phase N"

poderá iniciar a próxima fase.

============================================================
13. ARCHITECTURAL CHANGE RULE
============================================================

Se durante qualquer fase surgir necessidade de alterar:

- Architecture Invariants;
- Core boundaries;
- Authentication model;
- Vault security model;
- Credential model;
- project isolation model;

a IA deve parar.

Criar proposta de ADR contendo:

- Context;
- Problem;
- Current Architecture;
- Proposed Change;
- Alternatives;
- Security Impact;
- Architecture Impact;
- Migration Impact;
- Testing Impact.

Não alterar a arquitetura sem aprovação.

============================================================
14. NO FALSE COMPLETION
============================================================

É proibido declarar:

"completed"
"fully supported"
"production ready"
"Windows compatible"
"secure"
"MVP ready"

sem evidência correspondente.

Sempre diferenciar:

Implemented
Tested
Verified

============================================================
15. PRIORITY
============================================================

Quando houver conflito entre:

feature delivery
e
architecture/security integrity

priorizar:

1. Security
2. Architecture
3. Correctness
4. Tests
5. Documentation
6. Features

Nunca sacrificar um Architecture Invariant para acelerar
uma implementação.

============================================================
16. FINAL RULE
============================================================

O DevVault deve evoluir como:

Architecture
→ Implementation
→ Evidence
→ Gate
→ Approval
→ Next Phase

e nunca como:

Feature
→ Feature
→ Feature
→ Architecture later.

A arquitetura deve evoluir junto com a implementação.

## Phase Gate Rule: 
- Nenhuma fase pode ser marcada como COMPLETED nem a implementação da próxima fase pode começar enquanto o Readiness Gate da fase atual não tiver sido executado, documentado e aprovado. Todo requisito obrigatório deve possuir evidência automatizada ou ser explicitamente marcado como BLOCKED, e BLOCKED/NOT_TESTED impede a conclusão da fase.
