---
name: readiness-gate
description: Valida se o projeto está pronto para a implementação de uma funcionalidade.
agent: agent
---
# DevVault — MVP Readiness Gate

As correções do Architecture Compliance Gate foram implementadas.

Foram corrigidos:

- validação de vault.path contra project/environment;
- proteção contra cross-project configuration;
- lifecycle state no doctor;
- bootstrap com environment explícito;
- tratamento explícito para Vault não inicializado/sealed;
- documentação de lifecycle;
- testes, build, typecheck e validators.

Antes de implementar qualquer nova funcionalidade, faça uma avaliação formal de prontidão do MVP.

NÃO altere nenhum arquivo nesta etapa.

---

## 1. Architecture Compliance

Reavalie:

docs/architecture/
docs/architecture/architecture-invariants.md
docs/architecture/vault-lifecycle.md

Para cada invariant:

- informe PASS/FAIL;
- apresente evidência no código;
- indique teste que comprova o comportamento.

Não considere documentação como evidência de implementação.

---

## 2. Classificação de funcionalidades

Classifique cada item como:

IMPLEMENTED
PARTIAL
DESIGNED
NOT_IMPLEMENTED

Avalie:

### Configuration

- project discovery
- environment
- vault path
- mappings
- schema validation

### Vault

- connection
- KV v2
- lifecycle detection
- bootstrap
- initialization
- unseal
- policies
- identities
- audit

### Authentication

- VAULT_TOKEN
- human authentication
- login
- logout
- token renewal
- token revocation
- CredentialStore

### Runtime

- secret resolution
- environment injection
- child process
- signal handling
- exit code propagation
- cleanup

### Security

- hidden secret input
- log redaction
- error redaction
- secret leakage tests
- filesystem leakage tests
- command-line leakage tests

### Platform

- Linux
- Windows
- WSL2
- PowerShell
- Docker Desktop

---

## 3. Authentication Architecture

Não implemente nada.

Determine se a arquitetura atual está pronta para separar:

Developer
Application
CI/CD
Administrator

Determine também se os atuais use cases podem suportar futuramente:

Developer → OIDC
Application → AppRole/JWT
CI/CD → OIDC/JWT

sem alterar os use cases da aplicação.

Se isso não for possível, identifique o ponto arquitetural que precisa ser corrigido.

---

## 4. Credential Store

Determine se existe atualmente uma abstração real para:

CredentialStore

e se o Core está desacoplado de:

Windows Credential Manager
Linux Secret Service
WSL

Informe:

- interface;
- implementação;
- adapter;
- testes.

Não crie implementação.

---

## 5. Vault Lifecycle

Avalie os estados:

UNAVAILABLE
NOT_INITIALIZED
SEALED
UNSEALED
CONFIGURED
READY

Diferencie:

lifecycle detection
lifecycle management
lifecycle recovery

Para cada estado informe o que:

- doctor faz;
- init faz;
- bootstrap faz;
- run faz.

Especialmente determine:

O que acontece quando:

1. Vault está parado;
2. Vault está não inicializado;
3. Vault está sealed;
4. Vault está unsealed;
5. Vault está configurado;
6. Vault reinicia;
7. Docker é recriado;
8. volume é preservado;
9. volume é removido.

---

## 6. Security Review

Verifique novamente:

- secret input;
- stdout;
- stderr;
- logs;
- exceptions;
- process arguments;
- environment;
- filesystem;
- temporary files;
- shell history.

Procure testes automatizados para cada boundary.

---

## 7. Windows / WSL

Não aceite apenas "código compatível".

Determine quais testes foram realmente executados em:

- Linux;
- WSL2;
- Windows/PowerShell.

Separe:

TESTED
NOT TESTED
EXPECTED TO WORK

Não trate "build passou no Linux" como evidência de compatibilidade Windows/WSL.

---

## 8. Runtime

Verifique se:

devvault run -- <command>

continua respeitando:

config
→ authentication
→ authorization
→ Vault
→ secret resolution
→ process launch

Verifique se o runtime depende diretamente de VAULT_TOKEN.

Se depender, classifique como dívida arquitetural.

---

## 9. MVP Definition

Com base exclusivamente na implementação atual, proponha uma definição objetiva de MVP.

Crie três grupos:

### MVP BLOCKER

Funcionalidade necessária antes de considerar DevVault MVP.

### MVP ACCEPTABLE GAP

Pode existir no MVP desde que documentada.

### POST-MVP

Não deve bloquear o MVP.

Justifique cada classificação.

---

## 10. Release recommendation

Determine:

READY FOR NEXT IMPLEMENTATION
ou
NEEDS ARCHITECTURAL WORK

Se READY:

indique exatamente qual é a próxima funcionalidade.

Se NEEDS ARCHITECTURAL WORK:

liste no máximo 5 bloqueadores, ordenados por prioridade.

Não implemente nada.

Apenas produza o diagnóstico.