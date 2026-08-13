---
name: Impamentar fase 1
description: Implementar a fase 1 do roadmap do DevVault.
agent: agent
---
# DevVault — Implementação da Fase 1
# DevVault — Phase 1 Implementation

O MVP Readiness Gate e a Roadmap Validation foram concluídos.

Resultado:

READY FOR PHASE 1 IMPLEMENTATION

A ordem do roadmap foi validada.

A partir deste momento, implemente exclusivamente:

# Phase 1 — Windows / WSL / Platform Foundations

Não iniciar:

- AppRole
- OIDC
- CI/CD
- Human Login
- CredentialStore
- novas funcionalidades de aplicação

Essas funcionalidades permanecem fora do escopo desta fase.

---

# Objetivo

Garantir que a fundação do DevVault seja corretamente abstraída
para diferentes plataformas sem introduzir dependências
específicas de plataforma no Core.

Plataformas alvo:

- Linux
- WSL2
- Windows
- PowerShell

---

# Architecture Constraints

Os seguintes invariants são obrigatórios:

INV-PLATFORM-001

Nenhuma implementação específica de:

- Windows
- WSL
- PowerShell
- Docker Desktop

pode ser adicionada ao Core.

---

INV-PLATFORM-002

Diferenças de plataforma devem estar isoladas em adapters.

---

INV-PLATFORM-003

Application services devem depender de interfaces/ports,
nunca diretamente de APIs específicas de plataforma.

---

INV-PLATFORM-004

A introdução de suporte a Windows/WSL não pode exigir
alterações na lógica de negócio do Core.

---

INV-PLATFORM-005

Platform detection deve ser uma responsabilidade isolada.

---

# Escopo

## 1. Platform Detection

Criar ou evoluir uma abstração capaz de identificar:

- Linux
- Windows
- WSL2
- macOS, caso já suportado pela arquitetura

A detecção deve ser testável.

Não espalhar:

process.platform
os.platform()
WSL detection

por toda a aplicação.

Centralizar essa responsabilidade.

---

## 2. Docker Detection

Criar diagnóstico capaz de distinguir:

Docker CLI ausente

Docker daemon indisponível

Docker Compose indisponível

Docker Desktop não disponível

Docker funcionando

Vault container inexistente

Vault container parado

Vault container funcionando

Não considerar apenas:

docker command exists

como Docker saudável.

---

## 3. Docker Failure Paths

Criar testes para:

- Docker não instalado;
- Docker daemon parado;
- Docker Compose indisponível;
- Docker sem permissão;
- Vault container parado;
- Vault container inexistente;
- Vault não acessível;
- timeout.

As mensagens devem ser acionáveis e não expor secrets.

---

## 4. Paths

Validar comportamento consistente para:

Linux:

/home/user/project

Windows:

C:\Users\User\project

WSL:

/home/user/project

e paths envolvendo:

- project discovery;
- devvault.yaml;
- Docker;
- subprocessos.

Evitar concatenação manual de paths.

Utilizar abstração apropriada.

---

## 5. Process Execution

Validar:

devvault run -- <command>

em diferentes plataformas.

Cobrir:

- command not found;
- exit code;
- stdout;
- stderr;
- SIGINT/SIGTERM quando aplicável;
- child process termination;
- environment propagation.

Não alterar o contrato funcional do runtime sem ADR.

---

# 6. WSL2

WSL2 deve ser tratado explicitamente.

Detectar quando o processo está rodando:

Windows
Linux
WSL2

Validar integração com:

- Docker Desktop;
- Docker CLI;
- filesystem;
- subprocessos.

Se o ambiente de desenvolvimento atual não permitir
um teste real de WSL2:

NÃO fingir que o teste foi executado.

Registrar:

WSL2 TEST NOT EXECUTED

e explicar:

- motivo;
- impacto;
- como executar;
- o que permanece não validado.

---

# 7. Windows / PowerShell

Validar em ambiente Windows real quando disponível.

Testar:

- instalação/build;
- CLI;
- path handling;
- command execution;
- Docker detection;
- environment handling;
- exit codes.

Se não houver Windows real disponível:

registrar explicitamente:

WINDOWS TEST NOT EXECUTED

Não considerar execução Linux como evidência de compatibilidade Windows.

---

# 8. Linux

Linux deve possuir testes automatizados e ser considerado
baseline da plataforma.

Garantir que os testes existentes continuem passando.

---

# 9. Documentation

Atualizar documentação com uma matriz:

| Platform | Tested | Environment | Result | Limitations |
|----------|--------|-------------|--------|-------------|
| Linux | | | | |
| WSL2 | | | | |
| Windows | | | | |
| PowerShell | | | | |

Não marcar como Tested sem evidência real.

---

# 10. Architecture Tests

Adicionar testes quando possível para garantir:

- Core não importa adapters de plataforma;
- platform detection está isolado;
- Docker detection está isolado;
- path handling não depende de plataforma;
- process execution utiliza abstração;
- novos adapters não vazam para o Core.

---

# 11. Phase 1 Exit Criteria

A Phase 1 somente poderá ser considerada concluída quando:

- todos os adapters de plataforma permanecerem fora do Core;
- Linux estiver validado;
- Docker failure paths estiverem testados;
- WSL2 tiver teste real ou bloqueio explicitamente registrado;
- Windows/PowerShell tiver teste real ou bloqueio explicitamente registrado;
- paths estiverem cobertos;
- process execution estiver coberto;
- nenhum invariant arquitetural novo for violado;
- documentação registrar exatamente o que foi testado.

---

# Processo obrigatório

Antes de alterar código:

1. analisar arquitetura atual;
2. identificar arquivos que serão alterados;
3. identificar ports/adapters envolvidos;
4. propor plano de implementação;
5. propor testes;
6. Solicitar aprovação.
7. aguardar aprovação.

Depois da implementação:

1. executar testes;
2. executar build;
3. executar typecheck;
4. executar Architecture Compliance Gate;
5. validar Phase 1 Exit Criteria;
6. atualizar documentação;
7. produzir relatório final.

Não marcar Phase 1 como concluída se algum critério estiver apenas "esperado funcionar".

Caso todos os critérios estejam atendidos, registrar explicitamente:

PHASE 1 COMPLETED

Seguir para Phase 2 somente após aprovação explícita.
Sempre validar arquitetura atual antes de iniciar a proxima fase.

Roadmap de implementação completo:

Phase 2 → Vault Lifecycle Hardening
↓
Architecture Gate
↓
Phase 3 → Authentication Architecture
↓
Phase 4 → CredentialStore
↓
Phase 5 → Human Login/Logout
↓
Phase 6 → Policies + Identity
↓
Phase 7 → Security E2E
↓
Phase 8 → MVP Gate
↓
Phase 9 → AppRole
↓
Phase 10 → OIDC / CI/CD