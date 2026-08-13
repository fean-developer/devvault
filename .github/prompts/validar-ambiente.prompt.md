---
name: validar-ambiente
description: Valida o ambiente de desenvolvimento atual.
agent: agent
---

A Phase 1 permanece PARTIALLY VALIDATED.

O código Linux e os testes Linux estão aprovados.

Porém, os seguintes critérios permanecem pendentes:

- WSL2
- Windows
- PowerShell
- Docker Desktop

NÃO implemente novas funcionalidades.

NÃO avance para Phase 2.

Crie um plano de validação cross-platform contendo:

1. Como executar os testes em WSL2.
2. Como executar os testes em Windows.
3. Como executar os testes em PowerShell.
4. Como validar Docker Desktop.
5. Quais testes existentes devem ser executados.
6. Quais testes adicionais são necessários.
7. Quais evidências devem ser coletadas.
8. Como atualizar a matriz de compatibilidade.
9. Quais critérios permitirão fechar a Phase 1.

Para cada ambiente, diferencie:

TESTED
NOT EXECUTED
BLOCKED
FAILED

Não considere compatibilidade comprovada sem execução real.

## Environment Constraint — Docker Desktop

O ambiente atual possui compliance corporativo que impede
a instalação e execução do Docker Desktop.

Portanto:

- NÃO tentar instalar Docker Desktop;
- NÃO alterar configurações corporativas;
- NÃO considerar Docker Desktop como falha de implementação;
- NÃO declarar Docker Desktop como TESTED;
- registrar como BLOCKED BY ENVIRONMENT.

A implementação deve continuar sendo validada usando o ambiente
Docker disponível atualmente, quando aplicável.

A compatibilidade específica com Docker Desktop será validada
posteriormente em uma máquina autorizada.

A Phase 1 deve distinguir:

TESTED
NOT EXECUTED
BLOCKED BY ENVIRONMENT
FAILED

A ausência de teste Docker Desktop não deve ser mascarada como
compatibilidade confirmada.

Registrar essa limitação na documentação e no Phase Gate Report.

Não altere código nesta etapa.

Aguarde aprovação.