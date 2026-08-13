---
name: create-task
description: This prompt is used to create a new task for the DevVault project.
agent: agent
---

AUTHORIZATION: CREATE TASKS

A Specification da Phase 0 — devvault-setup foi aprovada.
O Design da Phase 0 — devvault-setup foi aprovado.

Autorizo iniciar a etapa Tasks do TLC.

Antes de criar tasks, verificar que spec.md e design.md estão presentes
e que seus status são APPROVED.

Se qualquer um estiver Draft, Pending ou sem aprovação explícita:
não criar tasks.

Criar exclusivamente:

.specs/features/devvault-setup/tasks.md

Não implementar código nesta etapa.

O tasks.md deve ser derivado exclusivamente de:
- .specs/features/devvault-setup/spec.md
- .specs/features/devvault-setup/design.md
- Architecture Authority
- matriz canônica de invariantes

Cada task deve conter obrigatoriamente:

- ID
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

Requisitos obrigatórios:

1. Toda requirement SETUP-001...SETUP-018 deve possuir pelo menos uma task.
2. Toda task deve possuir Requirement e Design reference.
3. Toda task deve possuir testes definidos.
4. Toda task deve possuir critério objetivo de conclusão.
5. Toda task deve possuir evidência esperada.
6. Toda task deve possuir gate.
7. Tasks devem respeitar os boundaries definidos no Design.
8. Não implementar funcionalidades das Phases 2–10.
9. RemoteVaultBackend deve permanecer read-only na Phase 0.
10. --check deve permanecer estritamente read-only.
11. SetupState deve manter atomicidade, lock, schema validation e sanitização.
12. Não introduzir secrets no setup state, logs, JSON ou arquivos temporários.
13. Não alterar código nesta etapa.

Organizar as tasks em uma ordem executável e explicitar as dependências entre elas.

Ao final, incluir:

- Requirement → Task matrix
- Task → Test matrix
- Task → Evidence matrix
- Invariant → Task/Test matrix
- Task execution order
- Phase 0 Tasks Gate

Depois de criar o arquivo, executar somente a validação estrutural/TLC aplicável às Tasks.

Não iniciar implementação.

Resultado esperado:
TASKS READY FOR REVIEW
ou
TASKS BLOCKED

Se houver inconsistências entre Specification, Design e Tasks, não corrigir silenciosamente. Reportar o conflito.