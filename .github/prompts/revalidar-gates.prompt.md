---
name: Revalidar implementações arquiteturais
description: Valida alterações arquiteturais antes de implementá-las.
agent: agent
---

Agora execute o Architecture Compliance Gate.

Verifique a implementação contra:

docs/architecture/overview.md
docs/architecture/architecture-invariants.md
docs/architecture/vault-lifecycle.md

Não avalie apenas se os testes passam.

Verifique:

- dependências;
- boundaries;
- security invariants;
- authentication boundaries;
- Vault lifecycle;
- platform isolation;
- least privilege;
- secret handling.

Para cada violação informe:

ID
Severity
Arquivo
Linha
Princípio violado
Evidência
Correção

Finalize com:

PASS
PASS WITH WARNINGS
FAIL