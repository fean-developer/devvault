---
name: aprover-design
description: Aprovação do design da Phase 0 — Developer Experience / Bootstrap.
agent: agent
---

AUTORIZAÇÃO EXPLÍCITA — PHASE 0 DESIGN

Autorizo a criação do Design da Phase 0 — Developer Experience / Bootstrap.

Execute somente a fase Design.

Objetivo:
transformar a Specification aprovada em um design técnico implementável, mantendo todos os boundaries e invariantes definidos.

Regras obrigatórias:

1. Criar somente os artefatos necessários ao Design, principalmente:

   .specs/features/devvault-setup/design.md

2. Não criar tasks.md ainda.

3. Não implementar código.

4. Não alterar código de produção.

5. Não antecipar funcionalidades das Phases 1–10.

6. O Design deve ser rastreável aos requisitos SETUP-001...SETUP-XXX.

7. O Design deve preservar todos os invariants existentes:
   INV-001...INV-018

   e os invariants:
   INV-SETUP-001...INV-SETUP-012

8. O Design deve definir explicitamente:

   - arquitetura;
   - componentes;
   - ports;
   - adapters;
   - SetupOrchestrator;
   - SetupStep;
   - DependencyChecker;
   - ConsentService;
   - InstallationManager;
   - BackendSelector;
   - VaultBackend;
   - SetupStateStore;
   - SetupValidator;
   - state machine;
   - readiness profiles;
   - capability model;
   - backend selection;
   - recovery;
   - concurrency/locking;
   - atomic state persistence;
   - security/sanitization;
   - command surface;
   - JSON contract;
   - exit codes;
   - error model;
   - platform boundaries;
   - remote backend boundary;
   - distribution decision boundary.

9. O Design deve demonstrar claramente que:

   Core/Application
       ↓
   Ports
       ↓
   Infrastructure/Platform adapters

   e que nenhum adapter de plataforma entra no Core.

10. Definir formalmente os readiness profiles:

   local-bootstrap
   developer-runtime
   remote-check

   Para cada perfil especificar:

   - capabilities obrigatórias;
   - capabilities opcionais;
   - condições de READY;
   - condições de DEGRADED;
   - condições de BLOCKED;
   - condições de FAILED.

11. Definir formalmente:

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

12. Definir todas as transições e cenários de recovery.

13. Definir comportamento de:

   setup
   setup --check
   setup --json
   setup --repair
   setup --non-interactive
   setup --yes

14. Garantir que:

   --check
   => nenhum mutating adapter pode ser executado.

15. Definir SetupState com strict allowlist.

16. Definir:

   - schema version;
   - atomic write;
   - temporary file;
   - rename;
   - previous-state retention;
   - corruption handling;
   - lock;
   - concurrent execution;
   - repair behavior.

17. Definir explicitamente que nenhum destes pode aparecer no state, logs, errors ou JSON:

   password
   token
   SecretID
   root credential
   unseal key
   recovery key
   secret value
   authorization header

18. RemoteVaultBackend deve permanecer read-only nesta Phase 0.

19. Docker Desktop nunca deve ser instalado ou modificado automaticamente.

20. O Design deve declarar explicitamente o que NÃO será implementado nesta Phase 0.

21. Criar diagramas arquiteturais quando ajudarem a demonstrar os boundaries e fluxos.

22. Criar uma matriz:

   Requirement
       → Design component
       → Port/Adapter
       → Test strategy

23. Criar uma matriz de invariants:

   Invariant
       → Design rule
       → Enforcement point
       → Test strategy

24. Identificar qualquer conflito restante entre Specification e Design.

Após criar o Design:

NÃO criar Tasks.

Execute um:

DESIGN COMPLIANCE GATE

O relatório deve conter:

- Design Gate Result
- Architecture Boundary Audit
- Requirement Traceability Audit
- Invariant Audit
- State Machine Audit
- Recovery/Concurrency Audit
- Security Audit
- Backend Audit
- Platform Audit
- Phase Boundary Audit
- Risks
- Required Changes
- Final Recommendation

Resultado permitido:

PASS
PASS WITH CHANGES
FAIL

Se for PASS, pare e aguarde minha autorização explícita para criar o Tasks.

Não implementar código em nenhuma circunstância nesta etapa.