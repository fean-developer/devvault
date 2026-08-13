---
name: MVP Roadmap
description: Define the MVP roadmap for the project.
agent: agent
---
# DevVault — MVP Roadmap
# Baseline

O projeto acabou de passar pelo MVP Readiness Gate.

Use o resultado desse gate como baseline oficial para
planejamento.

Não assuma que funcionalidades estão implementadas apenas
porque aparecem na documentação.

Para cada fase do roadmap, correlacione:

Current State
→ Gap
→ Architecture
→ Implementation
→ Tests
→ Evidence

# DevVault — Roadmap Estratégico de Implementação

A partir deste momento, quero que o desenvolvimento do DevVault siga o roadmap abaixo como sequência preferencial de implementação.

O objetivo é evitar que funcionalidades sejam implementadas fora de ordem e acabem criando dívida ou desvio arquitetural.

## Roadmap

### Phase 1 — Windows / WSL
Objetivo:
Garantir que a fundação do DevVault funcione corretamente nos ambientes alvo.

Escopo:

- Windows
- PowerShell
- WSL2
- Docker Desktop
- Linux/WSL
- filesystem/path handling
- process spawning
- signals
- terminal input
- Docker integration
- platform-specific diagnostics

Regra:

Não introduzir dependências específicas de Windows/WSL no Core.

Toda particularidade de plataforma deve permanecer em adapters.

---

### Phase 2 — Vault Lifecycle Hardening

Objetivo:
Tornar o ciclo de vida do Vault explícito, previsível, idempotente e seguro.

Estados obrigatórios:

UNAVAILABLE
NOT_INITIALIZED
SEALED
UNSEALED
CONFIGURED
READY

Diferenciar claramente:

- lifecycle detection;
- lifecycle initialization;
- lifecycle configuration;
- lifecycle recovery.

Validar:

- init;
- restart;
- recreate;
- persistent volume;
- KV v2;
- policies;
- healthcheck;
- failure recovery.

Não usar "container running" como sinônimo de "Vault ready".

Não persistir root token ou unseal keys automaticamente.

---

### Phase 3 — Authentication Architecture

Objetivo:
Definir definitivamente o modelo de identidade antes de implementar login ou AppRole.

Separar:

Developer
Application
CI/CD
Administrator

A arquitetura deve permitir futuramente:

Developer → OIDC
Application → AppRole/JWT
CI/CD → OIDC/JWT

sem alterar os application use cases.

Definir:

- AuthenticationProvider;
- authentication context;
- token lifecycle;
- renewal;
- revocation;
- identity;
- authorization context.

Nesta fase, não implementar ainda todos os providers.

Primeiro definir os contratos e boundaries.

---

### Phase 4 — CredentialStore

Objetivo:
Remover a dependência operacional de VAULT_TOKEN fornecido manualmente pelo shell.

Criar uma abstração:

CredentialStore

com adapters para:

- Windows Credential Manager;
- Linux Secret Service;
- WSL;
- MemoryCredentialStore para testes.

Regras:

- CredentialStore pertence à infraestrutura;
- Core não deve conhecer detalhes do sistema operacional;
- credenciais não devem ser armazenadas em plaintext;
- não criar arquivos `.env`;
- não persistir secrets no projeto.

---

### Phase 5 — Human Login / Logout

Objetivo:
Implementar a experiência principal do desenvolvedor.

Comandos:

devvault login
devvault logout
devvault status

Fluxo esperado:

Developer
→ AuthenticationProvider
→ Vault
→ short-lived credential
→ CredentialStore

O uso normal do DevVault não deve exigir:

VAULT_TOKEN=<token>

como requisito manual.

Definir comportamento para:

- login;
- logout;
- token expiration;
- renewal;
- revocation;
- invalid credentials;
- Vault unavailable;
- permission denied.

Não permitir que root token se torne a credencial padrão do desenvolvedor.

---

### Phase 6 — Policies + Identity

Objetivo:
Implementar autorização real baseada em identidade e least privilege.

Definir policies para:

- Developer;
- Application;
- Administrator;
- CI/CD.

Garantir isolamento:

project A
≠
project B

e:

development
≠
staging
≠
production

quando a policy não permitir acesso.

Eliminar policies genéricas como:

secret/data/projects/+/+

quando elas concederem acesso além do necessário.

Validar permissões efetivas através de testes.

---

### Phase 7 — Security E2E

Objetivo:
Provar automaticamente que os invariantes de segurança estão funcionando.

Criar testes E2E para:

- secret não aparecer em stdout;
- secret não aparecer em stderr;
- secret não aparecer em logs;
- secret não aparecer em exceptions;
- secret não aparecer em command arguments;
- `.env` não ser criado;
- secret não ser gravado em arquivos;
- projeto A não acessar projeto B;
- developer não acessar recursos não autorizados;
- root token não ser necessário para runtime;
- token expirado ser tratado corretamente;
- logout revogar/invalidar acesso conforme o modelo;
- Vault sealed ser tratado corretamente;
- restart preservar dados;
- recreate preservar dados quando volume for mantido.

Segurança deve ser comprovada por testes, não somente por documentação.

---

### Phase 8 — MVP Gate

Antes de considerar o MVP concluído:

Executar:

- architecture compliance gate;
- security review;
- threat model review;
- integration tests;
- E2E tests;
- Windows tests;
- WSL tests;
- Docker tests;
- documentation review.

Classificar cada requisito como:

IMPLEMENTED
PARTIAL
NOT IMPLEMENTED
POST-MVP

O MVP somente será considerado concluído se não houver:

- CRITICAL aberto;
- HIGH aberto relacionado a segurança;
- violação de architecture invariant.

Gerar uma matriz:

Requirement
→ Architecture
→ Implementation
→ Test
→ Evidence
→ Status

---

### Phase 9 — Application Authentication / AppRole

Somente após o MVP Gate.

Objetivo:
Permitir autenticação de aplicações sem reutilizar a identidade humana.

Avaliar:

- AppRole;
- JWT;
- workload identity;
- short-lived credentials;
- SecretID lifecycle;
- policy association.

Não assumir AppRole como solução universal.

A arquitetura deve permitir escolher o mecanismo adequado por ambiente.

---

### Phase 10 — OIDC / CI/CD

Após AppRole e estabilização do modelo de identidade.

Objetivo:

Integrar DevVault/Vault com:

- GitHub Actions;
- Azure DevOps;
- CI/CD;
- OIDC;
- workload identity.

Preferir credenciais temporárias e federadas.

Evitar secrets estáticos em CI/CD sempre que houver mecanismo de identidade federada disponível.

---

# Regras de execução do roadmap

## Regra 1 — Não pular fases

Não iniciar uma fase posterior enquanto houver bloqueadores arquiteturais ou de segurança na fase atual.

Se uma fase posterior for necessária para resolver uma dependência da fase atual, explique a dependência antes de implementá-la.

## Regra 2 — Architecture Gate

Antes de cada fase:

1. revisar arquitetura;
2. identificar invariantes afetados;
3. identificar componentes afetados;
4. propor implementação;
5. propor testes.

Depois da implementação:

1. executar testes;
2. executar Architecture Compliance Gate;
3. verificar Architecture Drift;
4. atualizar documentação;
5. registrar decisões arquiteturais.

## Regra 3 — Não confundir "funciona" com "está arquiteturalmente correto"

Uma implementação somente pode ser considerada concluída quando:

Implementation
+
Tests
+
Security
+
Architecture
+
Documentation

estiverem alinhados.

## Regra 4 — Mudança arquitetural exige ADR

Se durante uma implementação surgir a necessidade de violar ou alterar um Architecture Invariant:

NÃO implemente silenciosamente.

Pare e proponha um Architecture Decision Record contendo:

- contexto;
- problema;
- decisão;
- alternativas;
- impacto;
- trade-offs;
- invariantes afetados.

Aguarde aprovação antes de prosseguir.

## Regra 5 — Não antecipar funcionalidades

Não implementar AppRole, OIDC, CI/CD ou outras funcionalidades futuras apenas porque os contratos já foram definidos.

Primeiro estabilizar o MVP.

---

# Próxima ação

Antes de iniciar a Phase 1:

1. revise o estado atual do projeto;
2. compare-o com este roadmap;
3. identifique dependências entre as fases;
4. identifique riscos de implementação;
5. confirme se a ordem proposta é arquiteturalmente consistente;
6. proponha ajustes caso encontre algum problema.

NÃO altere código nesta etapa.

Retorne:

- Roadmap validation;
- Dependency map;
- Risks;
- Recommended adjustments;
- Phase 1 implementation plan.

Aguarde aprovação antes de implementar.