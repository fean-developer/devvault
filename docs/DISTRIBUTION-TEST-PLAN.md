# Plano de Teste de Distribuição — DevVault v0.1.0-mvp

**Objetivo:** Validar que o CLI funciona em um ambiente limpo e isolado, simulando como um desenvolvedor de verdade vai instalar e usar.

**Escopo:** Linux/macOS, local/dev-mode Vault

**Duração esperada:** ~30–45 minutos

---

## 1. Teste Local — Build e Instalação Básica

### 1.1 Build do CLI

```bash
cd /home/fnascimento/fean-projects/Libraries/devvault

# Limpar builds anteriores
rm -rf apps/cli/dist

# Build fresco
corepack pnpm build

# Verificar que o binário existe
ls -la apps/cli/dist/index.js
file apps/cli/dist/index.js
```

**Esperado:**
- ✓ Build completa sem erros
- ✓ `apps/cli/dist/index.js` é um arquivo JavaScript executável
- ✓ Tamanho razoável (< 50 KB)

### 1.2 Teste básico de execução

```bash
# Help
node apps/cli/dist/index.js --help

# Versão
node apps/cli/dist/index.js --version

# Setup help
node apps/cli/dist/index.js setup --help
```

**Esperado:**
- ✓ `--help` mostra lista de comandos
- ✓ `--version` retorna versão (0.1.0-mvp ou similar)
- ✓ `setup --help` mostra opções (--check, --json, --repair, --non-interactive, --yes)
- ✓ Nenhuma mensagem de erro inesperada

### 1.3 Criar alias para facilitar testes

```bash
# Opção 1: alias (temporary)
alias devvault='node /home/fnascimento/fean-projects/Libraries/devvault/apps/cli/dist/index.js'

# Opção 2: symlink (mais realista)
sudo ln -s /home/fnascimento/fean-projects/Libraries/devvault/apps/cli/dist/index.js /usr/local/bin/devvault
# ou sem sudo (local user)
mkdir -p ~/.local/bin
ln -s /home/fnascimento/fean-projects/Libraries/devvault/apps/cli/dist/index.js ~/.local/bin/devvault
export PATH="$HOME/.local/bin:$PATH"
```

**Teste:**
```bash
devvault --version
devvault setup --help
```

---

## 2. Teste End-to-End — Vault Local + Setup

### 2.1 Iniciar Vault dev-mode local

```bash
# Terminal 1: Vault
cd /home/fnascimento/fean-projects/Libraries/devvault
docker compose -f infra/vault/docker-compose.yml up -d

# Aguardar disponibilidade
sleep 5
curl -s http://127.0.0.1:8200/v1/sys/health | jq .
```

**Esperado:**
- ✓ Container inicia
- ✓ `/v1/sys/health` retorna `sealed: false` (já inicializado)

### 2.2 Testar `devvault setup --check` (read-only)

```bash
devvault setup --check
```

**Esperado:**
- ✓ Exit code 0 (READY) ou 1 (algum step BLOCKED)
- ✓ Output legível, listando steps (dependencies, start-local-vault, backend-selection, etc.)
- ✓ Status como "✓ READY", "⚠ DEGRADED", "⛔ BLOCKED"
- ✓ **NENHUM SECRET** no output (verificar linha por linha)

### 2.3 Testar `devvault setup --check --json`

```bash
devvault setup --check --json > /tmp/devvault-check.json
cat /tmp/devvault-check.json | jq .
```

**Esperado:**
- ✓ Output é JSON válido
- ✓ Contém campos: `status`, `completedSteps`, `pendingSteps`, `blockers`, `warnings`, `metadata`
- ✓ **NENHUM TOKEN, PASSWORD, KEY ou credential no JSON** (grep para palavras-chave)

**Validação de segurança (CRÍTICO):**
```bash
cat /tmp/devvault-check.json | grep -iE '(password|token|secret|key|credential|authorization|bearer|unseal)' 
# Não deve retornar nada (exceto palavras-chave como "unsealed" que é estado, não credencial)
```

### 2.4 Testar `devvault setup --repair` (read-write, mas com consentimento)

```bash
# Com --yes (não-interativo)
devvault setup --repair --yes --json > /tmp/devvault-repair.json
cat /tmp/devvault-repair.json | jq .status
```

**Esperado:**
- ✓ Exit code 0
- ✓ Status "READY" ou "DEGRADED"
- ✓ Output JSON válido
- ✓ **NENHUM SECRET no output**

---

## 3. Teste de Segurança — Verificar Vazamento de Secrets

### 3.1 Capturar stdout + stderr + exit code

```bash
# Executar e capturar tudo
set +e  # Não falha se exit code != 0
OUTPUT=$(devvault setup --check --json 2>&1)
EXIT_CODE=$?
set -e

echo "=== EXIT CODE ==="
echo $EXIT_CODE

echo "=== OUTPUT ==="
echo "$OUTPUT"

echo "=== SECURITY CHECK ==="
# Buscar padrões de credenciais (case-insensitive)
if echo "$OUTPUT" | grep -iE '(password|token|secret|key|credential|authorization|bearer|unseal)' | grep -v -iE '(unsealed|sealed|lifecycle)'; then
  echo "⚠️  POSSÍVEL SECRET ENCONTRADO"
else
  echo "✓ Nenhum secret detectado"
fi
```

**Esperado:**
- ✓ Exit code >= 0 (sem crashes)
- ✓ Output bem-formado
- ✓ Nenhum padrão de secret/token/password

### 3.2 Verificar logs (se houver)

```bash
# Verificar stderr
devvault setup --check 2>&1 >/dev/null | head -20
```

**Esperado:**
- ✓ Nenhum erro inesperado
- ✓ Nenhum secret em mensagens de erro

### 3.3 Verificar que --check é realmente read-only

```bash
# Estado antes
curl -s http://127.0.0.1:8200/v1/sys/seal-status | jq '.sealed, .progress'

# Executar --check
devvault setup --check --json

# Estado depois (deve ser idêntico)
curl -s http://127.0.0.1:8200/v1/sys/seal-status | jq '.sealed, .progress'
```

**Esperado:**
- ✓ Estados antes e depois são iguais
- ✓ `--check` não modifica o Vault

---

## 4. Teste de Limitações Documentadas

### 4.1 Verificar que RELEASE-NOTES.md reflete realidade

```bash
# Abrir RELEASE-NOTES.md e verificar:
# - ✓ "Platform: Linux, macOS only"
# - ✓ "Docker: NOT TESTED IN THIS ENVIRONMENT"
# - ✓ "Live remote Vault: NOT TESTED"
# - ✓ Risk table com mitigações

cat RELEASE-NOTES.md | head -40
```

### 4.2 Testar comportamento em cenário degradado

**Cenário: Vault não disponível (simular)**

```bash
# Terminal 1: Parar Vault
docker compose -f infra/vault/docker-compose.yml down

# Terminal 2: Testar setup
devvault setup --check --json
```

**Esperado:**
- ✓ Status "BLOCKED"
- ✓ Blocker menciona "No viable Vault backend" ou similar
- ✓ Exit code 1
- ✓ Mensagem clara em português ou inglês

```bash
# Terminal 1: Reiniciar Vault
docker compose -f infra/vault/docker-compose.yml up -d
sleep 5
```

---

## 5. Teste em Container (Simular Novo Dev)

### 5.1 Preparar Dockerfile de teste

Criar `tests/docker/test-install.Dockerfile`:

```dockerfile
FROM debian:bookworm-slim

# Install Node.js
RUN apt-get update && apt-get install -y \
    curl wget git ca-certificates \
    && curl -fsSL https://deb.nodesource.com/setup_20.x | bash - \
    && apt-get install -y nodejs \
    && rm -rf /var/lib/apt/lists/*

# Corepack
RUN corepack enable

# Copy DevVault (simulando tarball/npm install)
WORKDIR /app
COPY . .

# Build
RUN corepack pnpm install --frozen-lockfile
RUN corepack pnpm build

# Test
RUN node apps/cli/dist/index.js --version

ENTRYPOINT ["node", "apps/cli/dist/index.js"]
```

### 5.2 Build e testar container

```bash
cd /home/fnascimento/fean-projects/Libraries/devvault

# Build
docker build -f tests/docker/test-install.Dockerfile -t devvault:test .

# Teste 1: Versão
docker run --rm devvault:test --version

# Teste 2: Help
docker run --rm devvault:test --help

# Teste 3: Setup check (vai falhar porque Vault não está em 127.0.0.1 do container)
docker run --rm devvault:test setup --check --json 2>&1 | head -5
```

**Esperado:**
- ✓ Container build sem erros
- ✓ CLI executável dentro do container
- ✓ Mensagens de erro claras quando Vault não está acessível

---

## 6. Teste de Documentação

### 6.1 Verificar README.md

```bash
# Seções que devem estar presentes:
# - ✓ "Scope & Limitations (MVP Release)"
# - ✓ Referência a RELEASE-NOTES.md
# - ✓ Menção a v0.1.0-mvp (not v1.0.0)
# - ✓ "Do not use in production"

grep -E "(Scope|Limitation|RELEASE-NOTES|v0.1.0-mvp|production)" README.md
```

### 6.2 Verificar RELEASE-NOTES.md

```bash
# Deve ter:
# - ✓ Seção "What Works (Tier 1)"
# - ✓ Seção "What Is NOT Validated (Tier 2)"
# - ✓ Tabela de riscos
# - ✓ Instruções de report de bugs
# - ✓ Links para documentação

wc -l RELEASE-NOTES.md
cat RELEASE-NOTES.md | head -50
```

### 6.3 Verificar CHANGELOG.md

```bash
# Deve ter entrada v0.1.0-mvp
grep -A 10 "0.1.0-mvp" CHANGELOG.md
```

---

## 7. Teste de Publicação (Opcional)

Se for publicar em npm ou como tarball:

### 7.1 Criar tarball

```bash
cd /home/fnascimento/fean-projects/Libraries/devvault
mkdir -p /tmp/devvault-dist

# Copiar binário e docs
mkdir -p /tmp/devvault-dist/devvault-0.1.0-mvp
cp -r apps/cli/dist /tmp/devvault-dist/devvault-0.1.0-mvp/bin
cp RELEASE-NOTES.md README.md CHANGELOG.md /tmp/devvault-dist/devvault-0.1.0-mvp/
cp package.json /tmp/devvault-dist/devvault-0.1.0-mvp/

# Criar tarball
cd /tmp/devvault-dist
tar -czf devvault-0.1.0-mvp-linux-x64.tar.gz devvault-0.1.0-mvp/

# Verificar
tar -tzf devvault-0.1.0-mvp-linux-x64.tar.gz | head -10
```

### 7.2 Testar instalação de tarball

```bash
# Simular novo dev
mkdir -p /tmp/test-dev
cd /tmp/test-dev
tar -xzf /tmp/devvault-dist/devvault-0.1.0-mvp-linux-x64.tar.gz

# Executar
./devvault-0.1.0-mvp/bin/index.js --version
./devvault-0.1.0-mvp/bin/index.js --help
```

---

## 8. Checklist Final

- [ ] 1.1: Build local completa sem erros
- [ ] 1.2: CLI executa (--help, --version, setup --help)
- [ ] 1.3: Alias/symlink funciona
- [ ] 2.1: Vault Docker inicia e healthcheck passa
- [ ] 2.2: `devvault setup --check` roda sem crashes
- [ ] 2.3: `devvault setup --check --json` retorna JSON válido
- [ ] 2.4: Grep por secrets em JSON retorna vazio (ou apenas estado como "unsealed")
- [ ] 2.5: `devvault setup --repair --yes` completa
- [ ] 3.1: Captura stdout/stderr sem crashes
- [ ] 3.2: Security check: nenhum secret em output
- [ ] 3.3: `--check` é realmente read-only (Vault state unchanged)
- [ ] 4.1: RELEASE-NOTES.md documenta limitações
- [ ] 4.2: Vault down → BLOCKED status correto
- [ ] 5.1: Dockerfile build completa
- [ ] 5.2: Container executa CLI com sucesso
- [ ] 6.1: README.md menciona escopo MVP e limitações
- [ ] 6.2: RELEASE-NOTES.md está completo e claro
- [ ] 6.3: CHANGELOG.md tem entrada v0.1.0-mvp
- [ ] 7.1–7.2: (Opcional) Tarball criado e testado

---

## 9. Resultado Esperado

Ao final dos testes:

✅ **CLI funciona em ambiente limpo (Linux)**
✅ **Vault local integrável sem erros**
✅ **Setup validation funciona (--check, --repair)**
✅ **Nenhum secret vazado em logs/output**
✅ **Documentação clara sobre limitações**
✅ **Ready para distribuição a Linux/macOS developers**

---

## 10. Próximas Ações

- Se testes passarem: publicar release v0.1.0-mvp (tarball ou npm)
- Se falhar: abrir issue em [projeto]/issues com erro reproduzível
- Avisar usuários sobre limitações (especialmente Windows, Docker Desktop)
- Começar T25 (proc/log coverage) em paralelo com adopção early-adopters
