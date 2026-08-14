# Guia completo de uso do DevVault

Este guia descreve o fluxo para instalar e usar o pacote npm do DevVault.

## 1. O que é o DevVault

O DevVault é uma CLI que integra aplicações locais ao HashiCorp Vault sem criar arquivos `.env` com credenciais. O Vault armazena os valores e o DevVault os injeta no processo da aplicação somente durante a execução.

Ele funciona com qualquer aplicação que leia configurações por variáveis de ambiente. Não é necessário alterar o código da aplicação.

## 2. Requisitos

- Node.js 20 ou superior;
- Docker Engine ou Docker Desktop com Compose;
- Linux, macOS ou WSL no escopo validado do MVP;
- keyring do sistema operacional disponível para sessões do desenvolvedor;
- acesso à internet para instalar o pacote npm.

## 3. Instalação pelo npm

```bash
npm install -g @fean-developer/devvault-cli
devvault --version
devvault --help
```

## 4. Criar o primeiro projeto

Na raiz da aplicação:

```bash
cd ~/meu-projeto
devvault init-project --environment development
devvault environment set development
devvault start
```

O `start` inicia o Vault local, inicializa quando necessário, faz unseal, configura KV/policies e prepara a sessão do desenvolvedor. O usuário não precisa gerar root token nem unseal key.

Durante o processo, o terminal mostra o progresso de cada etapa. Se houver falha, o DevVault exibe o motivo e recomenda `devvault doctor`.

## 5. Configurar secrets

Cadastre secrets usando prompt oculto:

```bash
devvault secret set database.username
devvault secret set database.password
```

Verifique sem mostrar valores:

```bash
devvault secret list
devvault secret get database.password
```

Para mostrar explicitamente um valor:

```bash
devvault secret get database.password --show
```

Evite `--show` em terminais compartilhados.

## 6. Criar e selecionar ambientes

```bash
devvault init-project --environment development
devvault init-project --environment production
devvault environment set development
devvault environment current
devvault environment list
```

As configurações ficam em:

```text
environments/development/devvault.yaml
environments/production/devvault.yaml
```

Para consultar ou executar em production sem alterar o contexto ativo:

```bash
devvault secret list --environment production
devvault run --environment production -- npm start
```

O override `--environment` vale somente para aquela execução.

## 7. Executar aplicações

O DevVault suporta qualquer comando que consuma variáveis de ambiente:

```bash
# Node.js
devvault run -- npm start

# Python
devvault run -- python app.py

# Go
devvault run -- ./my-service

# Java
devvault run -- java -jar app.jar

# .NET
devvault run -- dotnet run

# Ruby
devvault run -- bundle exec rails server

# PHP
devvault run -- php artisan serve

# Shell
devvault run -- ./script.sh

# Migration CLI
devvault run -- npx prisma migrate dev
```

No YAML do ambiente, associe variáveis aos paths:

```yaml
runtime:
  mappings:
    DATABASE_URL: database.url
    DATABASE_PASSWORD: database.password
```

A aplicação deve estar instalada e deve ler os nomes das variáveis configuradas.

## 8. Criar outro usuário

O `start` prepara automaticamente o usuário local padrão `alice`. Para criar outro usuário:

```bash
devvault user create --username fnascimento
```

Digite a senha no prompt oculto. Depois troque para esse usuário:

```bash
devvault logout
devvault login --username fnascimento
devvault status --json
```

Para voltar:

```bash
devvault logout
devvault login --username alice
```

## 9. Logout e troca de usuário

```bash
devvault logout
```

O logout remove a sessão local do keyring mesmo quando o Vault não consegue revogar o token remoto. Nesse caso, exibe um aviso, mas retorna sucesso para não deixar a máquina presa à sessão antiga.

## 10. Ambientes protegidos

No YAML do ambiente:

```yaml
protected: true
```

Leituras continuam disponíveis:

```bash
devvault secret list
devvault secret get database.password
devvault doctor
```

Alterações exigem confirmação:

```bash
devvault secret set database.password
```

Para automação explícita:

```bash
devvault secret set database.password --yes
```

Não use `CI=true` como autorização implícita.

## 11. Status e diagnóstico

```bash
devvault status
devvault status --json
devvault doctor
devvault doctor --json
```

O diagnóstico mostra projeto, ambiente, proteção, Vault e autenticação, mas nunca mostra valores de secrets.

## 12. Comandos avançados

```bash
devvault setup
devvault setup --check
devvault setup --check --json
devvault setup --repair
devvault init
devvault login --username alice
devvault logout
```

O fluxo normal deve preferir `devvault start`. Os comandos avançados são úteis para diagnóstico e automação.

## 13. Configuração legada

Projetos antigos podem ter:

```text
devvault.yaml
```

Esse formato continua sendo lido quando não existe o diretório `environments/`. A migração não é automática e o arquivo legado não é apagado.

## 14. Reset local

O reset apaga secrets, usuários, policies e bootstrap material locais:

```bash
docker compose -f infra/vault/docker-compose.yml down
docker volume rm devvault-vault-data devvault-vault-bootstrap
docker compose -f infra/vault/docker-compose.yml up -d
devvault start
```

Use somente quando desejar recriar o ambiente local.

## 15. Segurança

Nunca coloque secrets em YAML, `.env`, argumentos, logs ou Git. Uma máquina ou Docker daemon comprometido pode acessar secrets locais.

## 16. Fluxo resumido

```bash
cd ~/meu-projeto
npm install -g @fean-developer/devvault-cli
devvault init-project --environment development
devvault environment set development
devvault start
devvault secret set database.username
devvault secret set database.password
devvault run -- npm start
```
