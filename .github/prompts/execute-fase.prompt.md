---
name: execute-fase
description: Este prompt é usado para executar uma fase do DevVault.
agent: agent
---

AUTHORIZATION: EXECUTE PHASE 0

O Tasks Gate foi aprovado com status:

READY FOR EXECUTE

Autorizo iniciar a implementação da Phase 0 — devvault-setup.

Regras obrigatórias:

1. Executar somente uma Task por vez.
2. Respeitar exatamente a ordem e as dependências definidas em:
   .specs/features/devvault-setup/tasks.md
3. Antes de iniciar uma Task, verificar:
   - Requirements
   - Design reference
   - Dependencies
   - Done when
   - Tests
   - Gate
4. Implementar somente o escopo da Task atual.
5. Após implementar:
   - executar os testes definidos;
   - executar o Gate da Task;
   - registrar Evidence;
   - atualizar o status da Task em tasks.md.
6. Somente após a Task passar no Gate, criar seu commit atômico.
7. Não iniciar a próxima Task enquanto a atual não estiver PASS.
8. Em caso de falha:
   - parar;
   - diagnosticar;
   - corrigir somente o necessário para a Task atual;
   - executar novamente os testes;
   - não avançar enquanto o Gate não passar.
9. Não fazer alterações não relacionadas à Task.
10. Não implementar funcionalidades das fases posteriores.

Phase boundaries obrigatórios:

- não implementar AppRole;
- não implementar OIDC;
- não implementar CI/CD;
- não implementar auto-unseal;
- não implementar human login completo;
- não implementar renewal/revocation;
- não implementar policies/identities finais;
- não implementar CredentialStore real;
- não implementar dynamic secrets;
- não implementar Vault Agent;
- não instalar ou modificar Docker Desktop automaticamente;
- não implementar standalone binaries.

Security invariants:

- nenhum secret em SetupState;
- nenhum token em logs;
- nenhum token em JSON;
- nenhum secret em arquivos temporários;
- nenhum credential em mensagens de erro;
- SetupState deve permanecer allowlist-based;
- --check deve permanecer estritamente read-only;
- RemoteVaultBackend deve permanecer read-only.

Git:

- um commit atômico por Task;
- não agrupar Tasks em um único commit;
- não alterar commits anteriores;
- não fazer squash;
- usar a mensagem de commit definida na Task;
- antes do commit, confirmar que somente arquivos pertencentes à Task foram alterados.

Após cada Task, produzir:

TASK RESULT

Task:
Status:
Requirements:
Files changed:
Tests:
Gate:
Evidence:
Commit:
Next task:

Não executar o Verifier final ainda.

Ao concluir todas as Tasks, parar antes do Architecture Gate e apresentar:

PHASE 0 IMPLEMENTATION COMPLETE

com:
- Tasks concluídas;
- Tasks bloqueadas;
- commits;
- testes;
- evidências;
- invariantes;
- riscos;
- alterações fora do escopo, se houver.



Não iniciar o Architecture Gate automaticamente.