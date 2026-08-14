# Guia rápido em português

## Instalação

```bash
npm install -g @devvault/cli
```

## Uso

```bash
cd ~/meu-projeto
devvault init-project --environment development
devvault environment set development
devvault start
devvault secret set database.username
devvault secret set database.password
devvault run -- npm start
```

## Ambientes

```bash
devvault init-project --environment production
devvault environment set production
devvault environment current
devvault environment list
devvault run --environment production -- npm start
```

O override `--environment` vale somente para aquela execução.

## Diagnóstico

```bash
devvault status --json
devvault doctor --json
```

O `devvault start` inicializa o Vault local automaticamente e não solicita root token ou unseal key.
