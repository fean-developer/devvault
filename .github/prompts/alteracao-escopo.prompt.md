---
name: alteracao-escopo
description: Analisa possíveis alterações e altera o escopo do DevVault.
agent: agent
---

Tenho uma mudança importante de visão sobre o DevVault.

Quero que o DevVault seja transparente para o desenvolvedor,
inclusive para um desenvolvedor júnior que não conhece:

- Docker;
- Docker Compose;
- pnpm;
- Corepack;
- Vault;
- KV v2;
- policies;
- unseal;
- credential stores.

A experiência desejada é:

1. O desenvolvedor instala o DevVault CLI.
2. Executa:

   devvault setup

3. O DevVault detecta automaticamente o ambiente.
4. Verifica dependências necessárias.
5. Se alguma dependência estiver ausente, explica o motivo
   e solicita confirmação antes de instalar/configurar.
6. Configura o ambiente local.
7. Inicializa/inicia o Vault local quando possível.
8. Configura KV, policies e autenticação.
9. Configura o armazenamento seguro das credenciais.
10. Valida o ambiente.
11. Ao final informa que o DevVault está READY.

O desenvolvedor não deve precisar executar manualmente:

- docker compose;
- vault CLI;
- comandos de unseal;
- configuração de KV;
- configuração de policies;
- export VAULT_TOKEN;
- configuração de pnpm/corepack.

Esses detalhes devem permanecer internos ao DevVault sempre
que tecnicamente e operacionalmente possível.

IMPORTANTE:

Não quero que você implemente isso ainda.

Faça primeiro uma análise arquitetural.

Avalie:

1. Como essa mudança impacta a arquitetura atual.
2. Se precisamos de uma Phase 0 — Developer Experience / Bootstrap.
3. Como deveria funcionar o comando `devvault setup`.
4. Quais dependências realmente precisam existir no sistema.
5. Se Node.js/pnpm/Corepack podem ser eliminados do ambiente
   do usuário final através de distribuição empacotada.
6. Como detectar:
   - Windows;
   - WSL2;
   - Linux;
   - Docker;
   - Docker Compose;
   - Docker Desktop;
   - Credential Store.
7. Como lidar com ambientes corporativos onde Docker Desktop
   não pode ser instalado.
8. Como solicitar autorização antes de instalar/configurar
   qualquer dependência.
9. Como tornar setup idempotente.
10. Como recuperar de setup parcialmente concluído.
11. Como evitar secrets no filesystem.
12. Como separar setup/admin bootstrap de uso diário.
13. Como essa mudança afeta AuthenticationProvider,
    CredentialStore e Vault lifecycle.
14. Quais Architecture Invariants precisam ser adicionados.
15. Quais testes seriam necessários.
16. Como essa mudança altera o roadmap atual.

Não implemente código.

Produza:

# DevVault Setup Architecture Proposal

## Product Vision
## Developer Experience
## Proposed `devvault setup`
## Dependency Detection
## Installation Strategy
## Vault Bootstrap
## Authentication
## CredentialStore
## Platform Architecture
## Corporate/Restricted Environments
## Idempotency
## Failure Recovery
## Security Model
## Architecture Impact
## New Invariants
## Testing Strategy
## Roadmap Impact
## Risks
## Recommendation

Ao final, diga explicitamente se recomenda:

A) implementar `setup` agora;
B) criar uma Phase 0 antes da Phase 1;
C) manter setup para depois;
D) outra abordagem.

Não altere código e aguarde aprovação.