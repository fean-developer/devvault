# Guia de Uso do DevVault

Este arquivo resume o fluxo atual do projeto. Para o manual operacional completo em português, consulte [docs/GUIA-USO-PT-BR.md](GUIA-USO-PT-BR.md) e, para usuários do npm, o [README do pacote](../apps/cli/README.md).

## Usuário final via npm

```bash
npm install -g @fean-developer/devvault-cli
cd ~/meu-projeto
devvault init-project --environment development
devvault environment set development
devvault start
devvault secret set database.username
devvault secret set database.password
devvault run -- npm start
```

O usuário não precisa executar `vault operator init`, `vault operator unseal` ou fornecer root token. O `start` gerencia o Vault local pertencente ao DevVault.

## Ambientes

```bash
devvault init-project --environment development
devvault init-project --environment production
devvault environment set development
devvault environment current
devvault environment list
```

Use um override temporário:

```bash
devvault secret list --environment production
devvault run --environment production -- npm start
```

O override não altera o contexto ativo. Não existe fallback silencioso para `development`.

## Secrets e aplicações

```bash
devvault secret set database.password
devvault secret get database.password
devvault secret list
devvault secret delete database.password --yes
```

O DevVault suporta comandos de aplicações Node.js, Python, Go, Java, .NET, Ruby, PHP, shell e CLIs de banco/migração:

```bash
devvault run -- npm start
devvault run -- python app.py
devvault run -- ./service
devvault run -- java -jar app.jar
devvault run -- dotnet run
devvault run -- npx prisma migrate dev
```

## Usuários

O `start` prepara a sessão local padrão. Para criar outro usuário:

```bash
devvault user create --username fnascimento
devvault logout
devvault login --username fnascimento
```

O logout limpa a sessão local mesmo quando o Vault não consegue revogar remotamente o token.

## Diagnóstico

```bash
devvault status --json
devvault doctor --json
devvault setup --check --json
```

## Desenvolvimento do repositório

```bash
corepack enable
corepack pnpm install
corepack pnpm typecheck
corepack pnpm lint
corepack pnpm test
corepack pnpm build
```

Para preparar o pacote npm:

```bash
corepack pnpm pack:npm
cd .npm-dist
npm pack
```

Não publique sem testar o tarball em uma pasta limpa.
