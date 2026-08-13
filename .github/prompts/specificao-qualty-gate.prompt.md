---
name: especification-quality-gate
description: Valida se a especificação de uma funcionalidade está pronta para implementação.
agent: agent
---

A Specification da Phase 0 está conceitualmente aprovada para revisão, mas NÃO está autorizada para implementação.

Antes de criar Design, Tasks ou alterar qualquer código, execute um Specification Compliance Gate.

Objetivo:
determinar se a Specification está suficientemente completa, consistente e rastreável para avançar para Design.

Regras obrigatórias:

1. NÃO alterar código.

2. NÃO criar tasks de implementação.

3. NÃO iniciar Design automaticamente.

4. NÃO assumir que um requisito está aprovado apenas porque foi mencionado.

5. Auditar toda a Specification contra a Architecture Authority atual.

6. Verificar todos os invariants existentes:
   INV-001 ... INV-018

7. Verificar todos os novos invariants da Phase 0:
   INV-SETUP-001 ... INV-SETUP-012

8. Criar uma matriz canônica de invariants contendo:

   ID
   Source
   Requirement
   Design target
   Test target
   Evidence target
   Gate
   Status

9. Detectar:
   - invariants ausentes;
   - invariants duplicados;
   - IDs reutilizados;
   - requisitos sem invariant quando necessário;
   - invariants sem teste;
   - invariants sem evidência;
   - conflitos entre Architecture Authority e Specification.

10. Validar a máquina de estados:

   Setup Result:
   READY
   DEGRADED
   BLOCKED
   FAILED

   Vault Lifecycle:
   UNAVAILABLE
   NOT_INITIALIZED
   SEALED
   UNSEALED
   CONFIGURED
   READY

11. Verificar que Setup Result e Vault Lifecycle não foram misturados.

12. Validar todas as transições:
   - normal execution;
   - interruption;
   - retry;
   - repair;
   - corrupted state;
   - concurrent execution;
   - blocked environment;
   - denied consent;
   - dependency failure;
   - Vault sealed;
   - Vault unavailable.

13. Validar que READY possui um perfil explícito.

   Se necessário, propor:
   BOOTSTRAP
   DEVELOPER
   REMOTE

   e determinar exatamente quais capabilities são obrigatórias em cada perfil.

14. Validar a regra:

   mandatory capability failure
       => BLOCKED or FAILED

   optional capability failure
       => DEGRADED

   Nunca permitir que DEGRADED esconda uma falha obrigatória.

15. Validar os boundaries arquiteturais:

   Core/Application:
   - SetupOrchestrator
   - ports
   - policies
   - state model
   - validation

   Infrastructure/Platform:
   - Docker
   - Docker Compose
   - filesystem
   - OS detection
   - installers
   - keyring
   - process execution

16. Confirmar que nenhum platform adapter entra no Core.

17. Validar DependencyChecker, ConsentService e InstallationManager:

   DependencyChecker = read-only
   ConsentService = authorization decision
   InstallationManager = authorized mutation

18. Confirmar:

   --check
   => zero mutating operations

19. Validar SetupState:

   - strict allowlist;
   - atomic write;
   - schema version;
   - corruption handling;
   - concurrent access;
   - no secrets;
   - no tokens;
   - no passwords;
   - no SecretIDs;
   - no authorization headers;
   - no unseal/recovery keys;
   - sanitized errors.

20. Validar backend abstraction:

   Local Docker
   Remote Vault

   e garantir que RemoteVaultBackend não dependa de Docker-specific operations.

21. Validar que a Phase 0 não invade:

   Phase 1 - Platform Foundations
   Phase 2 - Vault Lifecycle Hardening
   Phase 3 - Authentication
   Phase 4 - CredentialStore
   Phase 5 - Human Login/Logout
   Phase 6 - Policies + Identity
   Phase 7 - Security E2E
   Phase 9 - AppRole
   Phase 10 - OIDC / CI/CD

22. Identificar qualquer funcionalidade que esteja sendo antecipada indevidamente.

23. Validar os 18 requisitos SETUP-001...SETUP-018.

24. Identificar requisitos que estejam faltando, especialmente:
   - concurrent setup;
   - profile-based readiness;
   - mandatory vs optional capability;
   - state lock;
   - state corruption;
   - repair semantics.

25. Para cada requisito, verificar:

   Requirement
       ↓
   Design
       ↓
   Task
       ↓
   Test
       ↓
   Evidence
       ↓
   Gate

   Na Specification, Design/Task podem estar Pending, mas a intenção de rastreabilidade deve existir.

26. Verificar se todos os requisitos possuem critérios de aceitação mensuráveis.

27. Verificar EARS consistency.

28. Verificar que nenhum requisito depende de comportamento ainda pertencente a uma Phase posterior sem declarar explicitamente a dependency/boundary.

29. Verificar os critérios de sucesso da Phase 0.

30. Produzir um relatório final com:

   SPECIFICATION GATE RESULT

   Status:
   PASS
   PASS WITH CHANGES
   FAIL

   Findings:
   CRITICAL
   HIGH
   MEDIUM
   LOW

   Invariant Audit

   Requirement Audit

   State Machine Audit

   Architecture Boundary Audit

   Security Audit

   Recovery Audit

   Traceability Audit

   Phase Boundary Audit

   Missing Requirements

   Required Changes

   Final Recommendation

Regra de decisão:

PASS:
   Specification pode avançar para Design.

PASS WITH CHANGES:
   nenhuma implementação pode começar.
   listar correções obrigatórias.

FAIL:
   Specification precisa ser reestruturada.

Somente após um resultado PASS eu autorizarei explicitamente a criação do Design.

Não criar Design automaticamente após o relatório.
Não criar Tasks.
Não alterar código.