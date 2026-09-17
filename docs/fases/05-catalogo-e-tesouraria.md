# Fase 05 — Catálogo e Tesouraria

## Estado

- Estado: em curso — implementação validada; aguarda feedback manual antes de aprovação para merge
- Responsável: equipa de engenharia
- Início: 2026-09-17
- Última atualização: 2026-09-17
- Dependências recebidas: PR #4 fundido em `main` (`6f475c7`); contratos PostgreSQL da Fase 02 e administração da Fase 04.

## Objetivo

Entregar a experiência do tesoureiro para gerir o catálogo, aplicar e consultar multas, liquidar em lote, reabrir, eliminar multas elegíveis e consultar totais, com autorização e cálculo efetivos na base de dados.

## Escopo assumido

- Catálogo por época: criação, edição, ordenação, desativação e reativação.
- Aplicação com pré-visualização de base, multiplicador e total.
- Listagem com filtros por época, membro e estado.
- Liquidação atómica de multas pendentes de um único membro, reabertura e eliminação protegida.
- Totais da tesouraria e testes locais, remotos autorizados e E2E desktop/móvel.

## Decisões tomadas

| Data       | Decisão                                                                                         | Justificação                                                                         | Impacto                                                     |
| ---------- | ----------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------ | ----------------------------------------------------------- |
| 2026-09-17 | Partir de `main` limpa, atualizada por fast forward, na branch `feature/catalogo-e-tesouraria`. | O PR #4 já foi fundido; a fase precisa dos seus contratos.                           | Alterações isoladas para revisão.                           |
| 2026-09-17 | Reutilizar as RPCs financeiras e as vistas seguras existentes.                                  | O cálculo, a autorização, a atomicidade e a idempotência já pertencem ao PostgreSQL. | A interface não escreve diretamente em tabelas financeiras. |

## Trabalho realizado

### Preparação

- Confirmada árvore de trabalho limpa na branch da Fase 04.
- Atualizada `main` de `7c22ce3` para `6f475c7` com `git pull --ff-only origin main`.
- Criada `feature/catalogo-e-tesouraria` e lidas as fontes obrigatórias, a matriz RLS/RBAC e o handoff da Fase 04.
- Inventariados os contratos `save_fine_category`, `apply_fine`, `record_payment_batch`, `delete_pending_fine`, `treasury_season_totals` e o diretório de membros.

### Interface e serviços

- Criados contratos, regras, serviços e gateways Supabase separados para `fines` e `treasury`. A camada `app/financial` compõe os dois domínios e a sessão.
- Catálogo por época com criação, edição, ordem numérica, desativação e reativação; categorias usadas são preservadas.
- Aplicação de multa com seleção de membro/categoria, pré-visualização de base, multiplicador e total, e chave de idempotência retida até resposta conclusiva.
- Tesouraria com totais da vista segura, filtros por época/membro/estado, paginação, seleção de pendentes de um único membro, liquidação por RPC, reabertura e eliminação após confirmação explícita.
- Épocas arquivadas ficam em consulta; aplicação, liquidação, reabertura e eliminação são apresentadas só na época ativa. As RPCs validam novamente o contexto.
- Auth, Admin, multas e tesouraria partilham um único cliente Supabase publicável por configuração, evitando múltiplas sessões Auth no mesmo armazenamento.

### Preparação da validação

- Adicionado cenário PGlite para duas multas no mesmo batch, chamadas repetidas em paralelo, snapshots após edição da categoria, totais e proteção da multa reaberta.
- Adicionados testes de regras monetárias/multiplicador e dos percursos de aplicação, liquidação, reabertura e eliminação na interface.
- Preparado E2E Chromium desktop/móvel com conta de tesoureiro efémera, categoria própria, três multas, liquidação, reabertura e eliminação, com limpeza dos registos temporários.
- Preparados scripts separados para criar e remover a conta de validação manual, com credenciais apenas em `.manual-validation/`.
- Obtida autorização específica da Fase 05 para operações remotas no projeto descartável `showcasetestref00001` após apresentar o alvo e o dry-run sem migrações pendentes.
- Criada conta temporária `manual.finance.*` com função de tesoureiro numa época ativa; login e leitura dos totais confirmados. As credenciais estão em `.manual-validation/treasurer.local.json`, ignorado pelo Git.
- Pré-visualização local iniciada em `http://127.0.0.1:4173/` e confirmada com HTTP 200. A conta manual será mantida até ao feedback e removida pelo script dedicado.

## Ficheiros criados ou alterados

| Ficheiro                                                                                                          | Tipo de alteração | Motivo                                            |
| ----------------------------------------------------------------------------------------------------------------- | ----------------- | ------------------------------------------------- |
| `docs/fases/05-catalogo-e-tesouraria.md`                                                                          | criado            | Registo da fase.                                  |
| `docs/README.md`                                                                                                  | alterado          | Atualizar estado global após o merge da Fase 04.  |
| `README.md`                                                                                                       | alterado          | Atualizar o estado visível do projeto.            |
| `src/domains/fines/**`                                                                                            | criado/alterado   | Contratos, regras, gateway e serviço de multas.   |
| `src/domains/treasury/**`                                                                                         | criado/alterado   | Contratos, gateway e serviço de tesouraria.       |
| `src/app/financial/**`, `src/app/AppProviders.tsx`, `src/app/router.tsx`                                          | criado/alterado   | Composição, interface e rotas protegidas.         |
| `src/shared/infrastructure/supabasePublicClient.ts`, gateways Auth/Admin                                          | criado/alterado   | Cliente publicável partilhado entre domínios.     |
| `tests/database/database.test.mjs`, `src/app/FinancialPage.test.tsx`, `src/domains/fines/rules/fineRules.test.ts` | alterado/criado   | Contratos financeiros, regras e interface.        |
| `scripts/supabase-auth-test-fixture.mjs`, `scripts/test-e2e.mjs`, `e2e/financial.spec.ts`                         | alterado/criado   | E2E financeiro com limpeza.                       |
| `scripts/prepare-manual-financial.mjs`, `scripts/cleanup-manual-financial.mjs`                                    | criado            | Conta efémera de validação manual.                |
| `scripts/verify-manual-financial.mjs`                                                                             | criado            | Confirmar login, função e totais da conta manual. |

## Base de dados, contratos e migrações

- Migrações adicionadas: nenhuma; o dry-run remoto mostrou a base atualizada.
- Alterações de schema: nenhuma.
- Funções/RPCs/Edge Functions: reutilizadas `save_fine_category`, `apply_fine`, `record_payment_batch`, `delete_pending_fine` e `get_season_member_directory`; sem alterações.
- Políticas RLS: mantidas sem alteração; leituras por `fine_categories`, `fines` e `treasury_season_totals` respeitam as restrições existentes.
- Compatibilidade e dados existentes: preservar snapshots, logs e privilégios.

## Testes e verificações

| Comando/cenário                                            | Resultado | Observações                                                                                                    |
| ---------------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------------------------- |
| `git status --short --branch`                              | passou    | Árvore inicial limpa.                                                                                          |
| `git pull --ff-only origin main`                           | passou    | Fast forward até `6f475c7`.                                                                                    |
| `npm run test:db`                                          | passou    | 6/6 cenários PGlite existentes, incluindo RLS e RPCs financeiras.                                              |
| `npm test`                                                 | passou    | 53/53 testes existentes com Node 24.                                                                           |
| `npm run typecheck`                                        | passou    | Após composição dos domínios.                                                                                  |
| `npm run format:check`                                     | passou    | Prettier sem diferenças.                                                                                       |
| `npm run lint`                                             | passou    | Sem erros ou avisos.                                                                                           |
| `npm test` final                                           | passou    | 57/57 em 14 ficheiros.                                                                                         |
| `npm run test:db` final                                    | passou    | 7/7 PGlite, incluindo novo cenário de batch e totais.                                                          |
| `npm run build`                                            | passou    | Build com Node 24; aviso não bloqueante de chunk inicial de 743 kB.                                            |
| Comparação do alvo e `supabase db push --linked --dry-run` | passou    | Referências iguais a `showcasetestref00001`; `upToDate: true`, zero migrações, seeds e roles pendentes.        |
| `node scripts/test-supabase-linked.mjs`                    | passou    | 81/81 asserções pgTAP remotas, após comparação da referência.                                                  |
| Primeiro `node scripts/test-e2e.mjs`                       | falhou    | 7/8; o teste financeiro móvel contou uma multa criada na execução desktop com a mesma conta. Dados E2E limpos. |
| Segundo `node scripts/test-e2e.mjs`                        | passou    | 8/8 Chromium desktop/móvel. A seleção foi limitada à categoria própria de cada execução.                       |
| Verificação de limpeza E2E financeira                      | passou    | Zero perfis `financial.test.*` residuais.                                                                      |
| `node scripts/prepare-manual-financial.mjs`                | passou    | Conta temporária criada no projeto descartável; credenciais apenas na pasta local ignorada.                    |
| `node scripts/verify-manual-financial.mjs`                 | passou    | Login, papel de tesoureiro e leitura dos totais confirmados.                                                   |
| Pré-visualização local                                     | passou    | `http://127.0.0.1:4173/` respondeu HTTP 200.                                                                   |

## Desvios ao planeamento

- O E2E passou a isolar a categoria criada por cada projeto Playwright. Desktop e móvel usam a mesma conta temporária, e a primeira execução deixou multas visíveis para a segunda; a seleção global era uma suposição incorreta do teste.

## Riscos e limitações

- Qualquer nova operação remota continua limitada ao projeto descartável autorizado e exige comparação exata das referências antes da execução.
- O `npm` no PATH inicial usava Node 21; os comandos da fase usam o Node 24 incluído no ambiente, compatível com `package.json`.
- O teste de chamadas paralelas usa uma instância PGlite que serializa pedidos; uma corrida entre ligações PostgreSQL independentes não fica demonstrada por esse teste local.
- O bundle inicial continua acima do aviso de 500 kB; a divisão de código fica para refinamento posterior.

## Trabalho pendente

- [x] Implementar catálogo, multas, tesouraria e totais na interface.
- [x] Cobrir regras, autorização, idempotência, concorrência básica e transições em testes locais.
- [x] Executar validação remota autorizada e E2E desktop/móvel.
- [x] Preparar conta e URL para validação manual.
- [ ] Receber o feedback manual; corrigir eventuais problemas e limpar a conta e dados temporários após essa validação.
- [ ] Abrir PR sem merge e aguardar feedback manual.

## Validação manual pendente

- Abrir `http://127.0.0.1:4173/` e entrar com as credenciais locais em `.manual-validation/treasurer.local.json`.
- Em **Multas**, criar uma categoria de `0,10 €`, mudar a ordem, desativar e reativar; aplicar multas a um jogador, capitão e elemento da equipa técnica e confirmar a pré-visualização 1x/2x.
- Em **Tesouraria**, filtrar por membro e estado, liquidar duas multas pendentes do mesmo membro, confirmar o total e os saldos, reabrir uma paga e verificar que não surge a opção de eliminar essa multa; eliminar apenas uma pendente nunca paga após a confirmação.
- Comunicar o resultado antes de qualquer decisão de merge. A conta e os dados manuais são temporários.

## Handoff para a fase seguinte

- Preservar snapshots financeiros, idempotência e logs imutáveis.
- Os contratos públicos dos domínios são `FinesService` e `TreasuryService`; os gateways encapsulam Supabase e a UI está em `src/app/financial`. Manter o cliente publicável partilhado em `src/shared/infrastructure/supabasePublicClient.ts`.
- Para testar localmente usar Node 24, `npm test`, `npm run test:db`, `npm run lint`, `npm run typecheck` e `npm run build`. Ensaios remotos exigem `SUPABASE_TEST_PROJECT_REF=showcasetestref00001` igual a `supabase/.temp/project-ref`.
- Após o feedback manual, executar `node scripts/cleanup-manual-financial.mjs` só no projeto descartável confirmado. O script remove apenas o perfil `manual.finance.*`, os seus registos e o ficheiro local de credenciais.
- A Fase 06 só começa depois da validação e integração explícitas desta fase.
