# DevVault: Projeto Real do Zero

Este guia descreve o fluxo disponível atualmente para um desenvolvedor usar o DevVault em um projeto local.

## Estado atual

O fluxo foi validado em Linux dentro de WSL2 com Node.js 24, pnpm 10 via Corepack, Docker Engine, Docker Compose e Vault 1.20.

Windows nativo ainda não foi executado. Docker Desktop está bloqueado por compliance no ambiente atual. O fluxo PowerShell -> WSL2 foi validado.

## Step 0: Pre-requisitos

No WSL2/Linux:

```bash
node --version
corepack enable
corepack pnpm --version
docker --version
docker compose version
```

Requisitos minimos:

- Node.js 20 ou superior;
- Corepack;
- Docker Engine e Compose funcionando;
- acesso ao Vault local;
- um token administrativo somente para bootstrap inicial.

O token administrativo nao deve ser colocado em arquivos do projeto, `devvault.yaml`, `.env`, Git ou historico de shell.

## Step 1: Obter o DevVault

Em um checkout do DevVault:

```bash
corepack pnpm install
corepack pnpm build
node apps/cli/dist/index.js --version
```

Durante desenvolvimento, use o caminho completo da CLI:

```bash
node /caminho/para/devvault/apps/cli/dist/index.js <comando>
```

## Step 2: Iniciar o Vault

A partir da raiz do checkout:

```bash
node apps/cli/dist/index.js init
```

O comando verifica Docker Compose, inicia o container, verifica se o Vault esta inicializado e sealed, e habilita KV v2 quando ha `VAULT_TOKEN` administrativo.

Para um Vault novo, `init` nao inicializa nem faz unseal automaticamente. O operador precisa executar o procedimento do Vault e guardar root/unseal material fora do projeto.

Depois do operator initialization e unseal:

```bash
VAULT_TOKEN='<administrative-token>' node apps/cli/dist/index.js init
```

Nao use root token como credencial normal do desenvolvedor ou da aplicacao.

## Step 3: Entrar no projeto real

As operações abaixo devem ser executadas na pasta raiz da sua aplicação, e não na pasta do checkout do DevVault. O `bootstrap` usa o nome do diretório atual para escolher a policy.

```bash
cd ~/src/my-api
```

## Step 4: Criar a configuração do projeto

```bash
VAULT_TOKEN='<administrative-token>' node apps/cli/dist/index.js bootstrap --username alice --environment development
```

O password deve ser digitado no prompt oculto. Para automacao local, stdin tambem e suportado, mas o valor nao deve entrar no historico:

```bash
printf '%s\n' '<temporary-password>' | VAULT_TOKEN='<administrative-token>' node apps/cli/dist/index.js bootstrap --username alice --environment development
```

O `bootstrap` exige token administrativo, recusa Vault nao inicializado ou sealed, habilita Userpass, cria o usuario com policy do projeto/ambiente e nao persiste root token, password ou unseal keys.

```bash
node /caminho/para/devvault/apps/cli/dist/index.js init-project --environment development
```

Isso cria somente `devvault.yaml`, que pode ser commitado sem credenciais:

```yaml
version: 1
project: my-api
environment: development
vault:
  mount: secret
  path: projects/my-api/development
runtime:
  mappings: {}
```

O comando nao sobrescreve configuracao sem `--force`.

Se `VAULT_TOKEN` estiver definido, `init-project` também cria as policies do projeto no Vault:

```bash
VAULT_TOKEN='<administrative-token>' node /caminho/para/devvault/apps/cli/dist/index.js init-project --environment development
```

## Step 5: Criar a identidade humana

Ainda na pasta da aplicação:

```bash
VAULT_TOKEN='<administrative-token>' node /caminho/para/devvault/apps/cli/dist/index.js bootstrap --username alice --environment development
```

Quando aparecer `Secret value:`, digite uma **senha nova para o usuário humano `alice`**. Esse valor não é a senha do banco, não é o root token, não é a unseal key e não é um secret da aplicação. O prompt tem esse nome por usar a entrada oculta genérica da CLI.

Se você executar `bootstrap` na pasta do DevVault, a policy será criada para `devvault`, que é o projeto errado.

O `bootstrap` exige token administrativo e não persiste root token, senha, unseal key ou senha de aplicação.

## Step 6: Declarar mappings

Edite `devvault.yaml`:

```yaml
version: 1
project: my-api
environment: development
vault:
  mount: secret
  path: projects/my-api/development
runtime:
  mappings:
    DATABASE_URL: database.url
    DATABASE_PASSWORD: database.password
    API_KEY: integrations.api_key
```

Os nomes da esquerda sao environment variables. Os valores da direita sao referencias dentro do documento KV, nunca valores secretos.

O schema rejeita fields desconhecidos, nomes invalidos, valores literais e paths de outro projeto/ambiente.

## Step 7: Login

```bash
node /caminho/para/devvault/apps/cli/dist/index.js login --username alice
node /caminho/para/devvault/apps/cli/dist/index.js status --json
```

O login usa Userpass e tenta armazenar a sessao no keyring do sistema. Linux requer Secret Service; Windows usa Credential Manager; WSL requer integracao configurada. Nao existe fallback para arquivo plaintext.

## Step 8: Gravar secrets da aplicação

```bash
node /caminho/para/devvault/apps/cli/dist/index.js secret set database.password
node /caminho/para/devvault/apps/cli/dist/index.js secret list
```

O primeiro comando usa prompt oculto. O segundo lista somente chaves.

## Step 9: Ler com protecao

```bash
node /caminho/para/devvault/apps/cli/dist/index.js secret get database.password
```

Por padrao, o valor nao e mostrado. Para exibir explicitamente:

```bash
node /caminho/para/devvault/apps/cli/dist/index.js secret get database.password --show
```

## Step 10: Executar a aplicacao

Se a aplicacao le `process.env.DATABASE_PASSWORD`, execute:

```bash
node /caminho/para/devvault/apps/cli/dist/index.js run -- npm run dev
```

O DevVault localiza a configuracao, autentica, resolve mappings, inicia o processo filho, encaminha streams/sinais e retorna o exit code. Nenhum `.env` e criado.

## Step 11: Diagnosticar

```bash
node /caminho/para/devvault/apps/cli/dist/index.js doctor
node /caminho/para/devvault/apps/cli/dist/index.js doctor --json
```

O diagnostico inclui plataforma, WSL2, Docker, container Vault, configuracao, lifecycle e policy efetiva sem ler valores de secrets.

## Step 12: Encerrar sessao

```bash
node /caminho/para/devvault/apps/cli/dist/index.js logout
```

O logout revoga a sessao Userpass e remove a credencial do keyring quando o adapter esta disponivel.

## Step 13: Reiniciar o Vault

```bash
docker compose -f /caminho/para/devvault/infra/vault/docker-compose.yml restart
```

O Vault pode voltar sealed. Isso e esperado. Faca unseal pelo procedimento operacional e valide com `doctor`. Nao execute `docker compose down -v` se quiser preservar os dados.

## Limitacoes atuais

- Windows nativo nao foi validado.
- Docker Desktop esta bloqueado por compliance no ambiente atual.
- PowerShell foi validado apenas no fluxo PowerShell -> WSL2.
- AppRole ainda nao e usado por aplicacoes.
- OIDC e CI/CD ainda nao estao implementados.
- O keyring Linux depende de Secret Service disponivel.
- Unseal automatico nao e realizado pelo DevVault.
