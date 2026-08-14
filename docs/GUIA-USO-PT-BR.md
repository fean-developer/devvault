# Guia de Uso do DevVault

Este guia mostra o fluxo recomendado para usar o DevVault em português.

## 1. Pré-requisitos

- Node.js 20 ou superior
- Docker Engine ou Docker Desktop com Compose
- Corepack habilitado

No checkout do DevVault:

```bash
corepack enable
corepack pnpm install
corepack pnpm build
```

Verifique:

```bash
devvault --version
devvault --help
```

## 2. Preparar um projeto

Entre na raiz da aplicação:

```bash
cd ~/fean-lab/build-local-runner
```

Crie os ambientes de forma independente:

```bash
devvault init-project --environment development
devvault init-project --environment production
```

Arquivos gerados:

```text
environments/development/devvault.yaml
environments/production/devvault.yaml
```

Criar `production` não sobrescreve `development`.

Se o mesmo ambiente já existir, o comando falha. Para substituir somente aquele ambiente:

```bash
devvault init-project --environment development --force
```

## 3. Selecionar o ambiente ativo

```bash
devvault environment set development
devvault environment current
devvault environment list
```

O ambiente ativo é salvo em:

```text
.devvault/context.json
```

Esse arquivo contém somente o nome do ambiente e é adicionado ao `.gitignore`.

Não existe fallback automático para `development`.

## 4. Iniciar o DevVault

```bash
devvault start
```

O comando prepara automaticamente o ambiente local:

- inicia o Vault local;
- inicializa o Vault se necessário;
- gera e guarda bootstrap material internamente;
- faz unseal automático;
- configura KV v2;
- cria as policies do projeto;
- prepara a sessão do desenvolvedor;
- valida a prontidão.

Nenhum root token ou unseal key é solicitado ao desenvolvedor.

Formato JSON:

```bash
devvault start --json
```

## 5. Configurar secrets de desenvolvimento

Selecione development:

```bash
devvault environment set development
```

Cadastre os valores sem colocá-los na linha de comando:

```bash
devvault secret set database.username
devvault secret set database.password
```

Liste somente os nomes:

```bash
devvault secret list
```

Verifique sem imprimir o valor:

```bash
devvault secret get database.password
```

Para exibir explicitamente um valor, use `--show` com cuidado:

```bash
devvault secret get database.password --show
```

## 6. Configurar secrets de produção

Mude o contexto:

```bash
devvault environment set production
```

Cadastre os secrets de produção:

```bash
devvault secret set database.username
devvault secret set database.password
```

Esses valores ficam em paths diferentes dos valores de development:

```text
secret/data/projects/build-local-runner/development
secret/data/projects/build-local-runner/production
```

Para consultar production sem alterar o contexto ativo:

```bash
devvault secret list --environment production
devvault secret get database.password --environment production
```

O override vale somente para aquele comando.

## 7. Ambientes protegidos

Marque explicitamente o arquivo do ambiente:

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

## 8. Executar a aplicação

Com o ambiente ativo:

```bash
devvault run -- npm start
```

O DevVault resolve automaticamente:

```text
projeto
  -> ambiente ativo
  -> devvault.yaml do ambiente
  -> mappings
  -> secrets do Vault
  -> processo filho
```

Executar diretamente em production sem alterar o contexto:

```bash
devvault run --environment production -- npm start
```

## 9. Criar outro usuário

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

O usuário recebe a policy do projeto e do ambiente ativo. O root token interno não é solicitado.

## 10. Logout e troca de usuário

```bash
devvault logout
devvault login --username alice
```

O logout remove a sessão local do keyring mesmo quando o Vault não consegue revogar o token remoto. Nesse caso, exibe um aviso, mas retorna sucesso para não deixar a máquina presa à sessão antiga.

## 11. Status e diagnóstico

Status rápido:

```bash
devvault status
devvault status --json
```

Diagnóstico detalhado:

```bash
devvault doctor
devvault doctor --json
```

O diagnóstico mostra projeto, ambiente, proteção, Vault e autenticação, mas nunca mostra valores de secrets.

## 10. Comandos avançados

```bash
devvault setup
devvault setup --check
devvault setup --check --json
devvault setup --repair
devvault init
devvault login --username alice
devvault logout
```

O fluxo normal deve preferir `devvault start`. Os comandos avançados são úteis para diagnóstico, automação e compatibilidade.

## 11. Configuração legada

Projetos antigos podem ter:

```text
devvault.yaml
```

Esse formato continua sendo lido quando o diretório `environments/` não existe. A migração não é automática e o arquivo legado não é apagado.

## 12. Reset local

O reset destrói secrets, policies, usuários e bootstrap material locais. Não execute sem intenção explícita:

```bash
docker compose -f infra/vault/docker-compose.yml down
docker volume rm devvault-vault-data devvault-vault-bootstrap
docker compose -f infra/vault/docker-compose.yml up -d
```

Depois, simplesmente use:

```bash
devvault start
```

## 13. Regras de segurança

Nunca:

- coloque secrets em `devvault.yaml`;
- passe secrets como argumentos;
- crie `.env` para contornar o DevVault;
- imprima root tokens ou unseal keys;
- commite `.devvault/`;
- use o root token como credencial normal da aplicação.

O DevVault usa variáveis de ambiente somente para compatibilidade com aplicações. Uma máquina local comprometida ainda pode expor processos, `/proc`, debuggers, dumps e ambientes de processos filhos.

## 14. Fluxo resumido

```bash
cd ~/fean-lab/build-local-runner

devvault init-project --environment development
devvault init-project --environment production

devvault environment set development
devvault start
devvault secret set database.username
devvault secret set database.password
devvault run -- npm start
```
