# Contribuir para a Caixinha das Multas

Este guia define o fluxo de trabalho comum para manter o repositorio consistente, verificavel e seguro.

## Repositorio

- GitHub: [JoaoMat10/caixinha-das-multas](https://github.com/JoaoMat10/caixinha-das-multas)
- Visibilidade: privada
- Branch principal: `main`
- Remote local esperado: `origin`
- Issues: ativas
- Wiki: desativada
- Merge permitido: squash ou rebase
- Merge commits: desativados
- Branches integradas: eliminadas automaticamente depois do merge

## Preparar o ambiente

```powershell
git clone https://github.com/JoaoMat10/caixinha-das-multas.git
Set-Location Multas_Futebol
npm install
Copy-Item .env.example .env.local
npm run test:e2e:install
```

Antes de alterar a implementacao, ler a documentacao em `docs/` e identificar a fase ativa no plano de execucao.

## Criar uma branch de trabalho

Atualizar primeiro a branch principal:

```powershell
git switch main
git pull --ff-only origin main
git switch -c feature/descricao-curta
```

Usar nomes curtos e descritivos, por exemplo:

- `feature/base-de-dados-e-rls`
- `feature/autenticacao-e-sessoes`
- `fix/correcao-validacao-ambiente`
- `docs/atualizar-handoff`

## Implementar e validar

- Respeitar o escopo da fase atual.
- Atualizar o unico diario da fase ao longo do trabalho.
- Nao misturar alteracoes funcionais sem relacao no mesmo commit.
- Executar as verificacoes proporcionais ao risco da alteracao.

Validacao completa da aplicacao web:

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run build
npm run test:e2e
```

## Criar commits

Rever sempre o conteudo preparado antes do commit:

```powershell
git status
git add --all
git diff --cached
git diff --cached --check
```

As mensagens devem ser curtas, descritivas e centradas na alteracao realizada. Prefixos recomendados:

- `feat:` nova capacidade;
- `fix:` correcao de comportamento;
- `refactor:` alteracao interna sem mudar comportamento;
- `test:` testes;
- `docs:` documentacao;
- `chore:` manutencao tecnica.

Exemplo:

```powershell
git commit -m "feat: criar modelo inicial de equipas e epocas"
```

## Publicar e abrir um pull request

```powershell
git push --set-upstream origin feature/descricao-curta
gh pr create --base main --fill
```

O pull request deve indicar:

- objetivo e escopo;
- decisoes e desvios relevantes;
- migracoes ou alteracoes de contratos;
- testes executados e resultados;
- riscos, limitacoes e trabalho pendente.

Depois do merge, atualizar a copia local:

```powershell
git switch main
git pull --ff-only origin main
```

## Seguranca e historico

- Nunca versionar passwords, tokens, chaves privadas, ficheiros `.env` locais ou credenciais administrativas.
- Nunca colocar chaves secretas do Supabase em variaveis `VITE_`.
- Nao versionar `node_modules`, builds, relatorios de teste ou browsers locais.
- Nao fazer force-push nem reescrever historico publicado sem uma decisao explicita e coordenada.
- Nao eliminar branches ou repositorios remotos sem confirmar o alvo e a necessidade.
