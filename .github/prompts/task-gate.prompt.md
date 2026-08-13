---
name: task-gate
description: This prompt is used to create a new task for the DevVault project.
agent: agent
---
TASKS GATE — REVIEW

A Specification e o Design da Phase 0 — devvault-setup estão aprovados.

O tasks.md foi criado e passou por validate_tasks com:
0 errors
5 warnings conhecidos e justificados.

Agora execute SOMENTE o Tasks Gate.

Não implemente código.
Não altere código de produção.
Não execute as tasks.
Não crie adapters.
Não avance para Execute.

Verifique:

1. Todas as requirements SETUP-001...SETUP-018 possuem cobertura.
2. Todas as tasks possuem:
   - What
   - Where
   - Depends on
   - Requirement
   - Design reference
   - Tests
   - Gate
   - Done when
   - Evidence
   - Commit
3. Todas as dependências entre tasks são acíclicas.
4. Nenhuma task ultrapassa o boundary da Phase 0.
5. RemoteVaultBackend permanece read-only.
6. setup --check permanece estritamente read-only.
7. SetupState mantém:
   - strict schema
   - allowlist
   - sanitização
   - atomic write
   - lock
   - recovery
8. Não existe task que introduza:
   - AppRole
   - OIDC
   - CI/CD
   - auto-unseal
   - human login completo
   - dynamic secrets
   - Vault Agent
   - CredentialStore real
   - Docker Desktop installation
9. Toda task crítica de segurança possui testes.
10. Toda task possui evidência verificável.
11. A matriz Requirement → Task está completa.
12. A matriz Task → Test está completa.
13. A matriz Task → Evidence está completa.
14. A matriz Invariant → Task/Test está completa.
15. Os 5 warnings restantes estão justificados e não representam perda de cobertura.

Produza somente:

TASKS GATE RESULT

Status:
PASS
PASS WITH CHANGES
ou
BLOCKED

Depois:

- Findings
- Requirement coverage
- Invariant coverage
- Security coverage
- Boundary violations
- Warnings
- Required changes, se houver
- Recommendation

Se PASS:
autorizar explicitamente a próxima etapa como:
READY FOR EXECUTE

Não iniciar Execute automaticamente.