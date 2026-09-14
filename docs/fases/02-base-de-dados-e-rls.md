# Fase 02 — Base de Dados e RLS

## Estado

- Estado: concluida
- Responsavel: equipa de engenharia
- Inicio: 2026-09-11
- Ultima atualizacao: 2026-09-14
- Dependencias recebidas: Fase 01 concluida no commit `944cf91`, com fronteiras modulares por dominio integradas e `main` sincronizada com `origin/main`.

## Objetivo

Configurar a base Supabase/PostgreSQL e entregar um modelo de dados reproduzivel, com constraints, indices, seeds, autorizacao por RLS, operacoes financeiras atomicas e consultas derivadas seguras, sem implementar autenticacao ou interfaces funcionais das fases seguintes.

## Escopo assumido

- Configurar Supabase e a estrategia de migracoes.
- Implementar integralmente o modelo de dados aprovado.
- Criar constraints, indices e seeds.
- Criar funcoes auxiliares de autorizacao.
- Implementar RLS por operacao.
- Implementar calculos derivados e vistas/RPCs seguras.
- Preparar dados de teste para Owner, jogadores, equipa tecnica, capitao e tesoureiro.
- Testar acessos permitidos e negados entre equipas e epocas.

## Decisoes tomadas

| Data       | Decisao                                                                                   | Justificacao                                                                                                                           | Impacto                                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| 2026-09-11 | Manter toda a persistencia em migracoes SQL versionadas sob `supabase/`.                  | Segue a stack aprovada e permite aplicar a mesma sequencia localmente e num projeto Supabase remoto.                                   | O schema nao depende de alteracoes manuais no dashboard.                                                                               |
| 2026-09-11 | Separar schema, autorizacao/RLS, operacoes de dominio e consultas derivadas por migracao. | Mantem responsabilidades claras e torna revisao, diagnostico e rollback corretivo mais simples.                                        | As migracoes permanecem sequenciais e cada fronteira tem testes proprios.                                                              |
| 2026-09-11 | Usar PostgreSQL embebido open source no harness automatizado enquanto Docker nao existe.  | Docker, Supabase CLI e `psql` nao estao instalados neste ambiente; e necessario validar migracoes e RLS de forma local e reproduzivel. | Os testes exercem PostgreSQL real sem servico externo; `supabase db reset` continua documentado como verificacao oficial complementar. |

## Trabalho realizado

### Preparacao da fase

- Confirmacao de `main` limpa e sincronizada com `origin/main`, sem divergencia, no commit `944cf91`.
- Confirmacao das fronteiras modulares da Fase 01: dominios expostos por `index.ts`, composicao em `app` e independencia de `shared`.
- Leitura integral de `AGENTS.md` e de todos os documentos existentes em `docs/`.
- Criacao da branch `feature/base-de-dados-e-rls`.
- Inventario do ambiente: Docker, Supabase CLI, `psql` e GitHub CLI ausentes; Node 24.19.0 compativel disponivel no runtime local.

### Schema, autorizacao e dados de desenvolvimento

- Configuracao local Supabase sem segredos, com Auth sem auto-registo e PostgreSQL 17.
- Quatro migracoes ordenadas para schema/constraints, autorizacao/RLS, RPCs de dominio e consultas derivadas.
- Modelo completo com perfis, Owner privado, equipas, epocas, plantel, roles, catalogo, multas, batches, logs imutaveis e auditoria.
- Constraints de isolamento por epoca, estados financeiros, snapshots, montantes em centimos, multiplicadores, datas, unicidade e idempotencia.
- Funcoes internas de autorizacao no schema nao exposto `private`, todas com `security definer` e `search_path` vazio.
- RLS ativada nas doze tabelas publicas, sem qualquer privilegio para `anon` e sem escritas financeiras diretas para `authenticated`.
- RPCs transacionais para gerir categorias, aplicar multas, liquidar/reabrir em lote e eliminar apenas multas nunca pagas.
- RPC transacional e idempotente para criar/copiar epoca, incluindo apenas plantel ativo, roles e catalogo.
- Vistas `security_invoker` para saldos e tesouraria; RPCs filtradas para diretorio e rankings sem dados privados.
- Seed deterministico com duas equipas, tres epocas e perfis de Owner, jogadores, capitao, equipa tecnica e tesoureiros.

### Testes e documentacao de seguranca

- Harness Node/PGlite que cria PostgreSQL isolado, aplica todas as migracoes e seed e testa constraints, RLS e RPCs.
- Suite pgTAP equivalente preparada para `supabase test db` na stack oficial.
- Matriz de RLS/RBAC documentada por tabela, operacao, vista, RPC e cenario positivo/negativo.

## Ficheiros criados ou alterados

| Ficheiro                               | Tipo de alteracao | Motivo                                                |
| -------------------------------------- | ----------------- | ----------------------------------------------------- |
| `docs/fases/02-base-de-dados-e-rls.md` | criado/alterado   | Diario obrigatorio e handoff da Fase 02.              |
| `supabase/config.toml`                 | criado            | Configuracao local Supabase sem segredos.             |
| `supabase/migrations/*.sql`            | criados           | Schema, autorizacao/RLS, RPCs e consultas derivadas.  |
| `supabase/seed.sql`                    | criado            | Perfis e dados deterministas de duas equipas/epocas.  |
| `supabase/tests/database_rls.test.sql` | criado            | Suite pgTAP oficial para a matriz RLS/RBAC.           |
| `tests/database/database.test.mjs`     | criado            | Reproducao e testes PostgreSQL sem Docker.            |
| `docs/rls-rbac.md`                     | criado            | Contrato e matriz de autorizacao.                     |
| `docs/02-modelo-de-dados.md`           | alterado          | Contrato de idempotencia da criacao de epocas.        |
| `docs/README.md`, `README.md`          | alterados         | Estado, requisitos e comandos de base de dados.       |
| `.gitignore`                           | alterado          | Exclusao do cache npm e estado local do Supabase.     |
| `package.json`, `package-lock.json`    | alterados         | Scripts de base de dados e PGlite fixado no lockfile. |

## Base de dados, contratos e migracoes

- Migracoes adicionadas: quatro migracoes sequenciais em `supabase/migrations/`.
- Alteracoes de schema: primeira versao integral do modelo aprovado, com doze tabelas publicas, cinco enums, tres vistas e schema interno `private`.
- Funcoes/RPCs/Edge Functions: funcoes auxiliares internas; cinco RPCs de escrita e duas RPCs seguras de leitura; nenhuma Edge Function, por pertencer a fases posteriores.
- Politicas RLS: ativadas e separadas por operacao nas doze tabelas; `anon` sem privilegios e tabelas financeiras sem escrita direta.
- Compatibilidade e dados existentes: primeira versao do schema; nao existem dados anteriores a migrar.

## Testes e verificacoes

| Comando/cenario                                     | Resultado     | Observacoes                                                                             |
| --------------------------------------------------- | ------------- | --------------------------------------------------------------------------------------- |
| `git fetch --prune origin main` e divergencia `0/0` | passou        | `main` e `origin/main` apontam para `944cf91`.                                          |
| Inventario de ferramentas locais                    | passou        | Node 24.19.0 disponivel; Docker, Supabase CLI, `psql` e `gh` estao ausentes.            |
| `npm run format:check`                              | passou        | Todos os ficheiros abrangidos seguem Prettier.                                          |
| `npm run lint`                                      | passou        | ESLint terminou sem erros ou avisos.                                                    |
| `npm run typecheck`                                 | passou        | TypeScript em modo estrito terminou sem erros.                                          |
| `npm test`                                          | passou        | 3 ficheiros e 5 testes Vitest passaram.                                                 |
| `npm run test:db`                                   | passou        | 4 suites: reproducao dupla, constraints, isolamento RLS/RBAC e RPCs atomicas.           |
| `npm run build`                                     | passou        | 185 modulos transformados e build de producao concluido.                                |
| Primeira execucao de `npm run test:e2e`             | falhou        | O Playwright procurou o Chromium no cache global; o processo foi terminado.             |
| `npm run test:e2e` com browser local configurado    | passou        | 4 testes passaram em Chromium desktop e movel.                                          |
| `npm run test:db:supabase`                          | nao executado | Requer Docker Desktop e Supabase CLI, ausentes; suite pgTAP com 39 assercoes preparada. |

## Desvios ao planeamento

- Nenhum desvio funcional. A ausencia da stack Supabase local foi compensada por testes PostgreSQL embebidos e por comandos oficiais documentados para ambientes com Docker.

## Riscos e limitacoes

- A verificacao com a stack Supabase CLI oficial requer Docker Desktop e Supabase CLI, indisponiveis neste ambiente.
- Antes de ligar um projeto Supabase remoto ou promover migracoes, deve executar-se `npm run test:db:supabase` num ambiente com Docker para confirmar tambem as integracoes especificas da stack local.
- A abertura do pull request exigira GitHub CLI, API autenticada ou browser autenticado, porque `gh` nao esta instalado.

## Trabalho pendente

- [x] Configurar Supabase e migracoes.
- [x] Implementar schema, constraints, indices e seeds.
- [x] Implementar funcoes auxiliares, RLS e operacoes atomicas.
- [x] Implementar vistas e RPCs derivadas seguras.
- [x] Criar e executar a matriz de testes RLS/RBAC no PostgreSQL embebido.
- Nenhum item de implementacao pendente dentro da Fase 02.
- Verificacao complementar externa: executar a suite pgTAP quando Docker Desktop e Supabase CLI estiverem disponiveis.

## Handoff para a fase seguinte

- A Fase 03 deve associar as sessoes Supabase Auth aos UUIDs de `public.users` e nunca duplicar passwords ou autorizacao no frontend.
- Preservar `auth.uid()` como identidade de todas as funcoes e politicas; roles de plantel continuam exclusivamente em `member_roles`.
- Usar apenas contratos publicos autorizados. O schema `private` nao deve ser adicionado aos schemas expostos pela Data API.
- Manter as escritas financeiras exclusivamente nas RPCs `apply_fine`, `record_payment_batch` e `delete_pending_fine`; nao conceder DML direto nas tabelas do livro-razao.
- `create_season` e `save_fine_category` ja validam autorizacao e invariantes na base, mas as interfaces e Edge Functions administrativas continuam reservadas para as fases previstas.
- Executar `npm run test:db` depois de qualquer alteracao de migracao. Num ambiente com Docker, executar tambem `npm run test:db:supabase`.
- Nunca executar `supabase db reset --linked` contra um projeto com dados reais nem colocar chaves secretas em variaveis `VITE_`.
