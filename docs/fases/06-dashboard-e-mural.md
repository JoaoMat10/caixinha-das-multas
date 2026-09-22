# Fase 06 — Dashboard e Mural

## Estado

- Estado: em curso — PR em Draft, aguarda validação manual
- Responsável: equipa de engenharia
- Início: 2026-09-21
- Última atualização: 2026-09-22
- Dependências recebidas: PR #5 integrado em `main` (`1b03ad3`); contratos seguros de reporting e RLS da Fase 02; domínios financeiros da Fase 05.

## Objetivo

Entregar a experiência de consulta do membro, com dashboard financeiro pessoal e rankings coletivos por equipa e época, sem expor detalhe financeiro de terceiros, dados privados ou a qualidade de Owner.

## Escopo assumido

- Totais e histórico pessoal, separados entre multas pendentes e pagas.
- Apresentação dos snapshots financeiros e estados das multas.
- Diretório mínimo de membros para identidade de jogador, capitão e equipa técnica.
- Rankings por quantidade, valor acumulado e dívida atual.
- Estados de carregamento, erro e ausência de dados em desktop e viewport móvel.
- Cobertura local de regras, contratos, segurança, interface e percursos E2E.

## Decisões tomadas

| Data       | Decisão                                                                                                                | Justificação                                                                                                     | Impacto                                                         |
| ---------- | ---------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------- |
| 2026-09-21 | Partir de `main` limpa e atualizada por fast-forward na branch `feature/dashboard-e-mural`.                            | O PR #5 foi integrado e contém os contratos financeiros necessários.                                             | A Fase 06 fica isolada para revisão.                            |
| 2026-09-21 | Reutilizar primeiro `my_season_balances`, RLS de `fines` e as RPCs públicas de diretório e ranking.                    | Estes contratos limitam o detalhe pessoal e omitem identidade técnica e permissão global.                        | Evita alargar a superfície de dados sem necessidade comprovada. |
| 2026-09-21 | Resolver empates por métrica descendente, nome apresentado em `pt-PT` e ID da associação como último critério técnico. | Produz ordem determinística mesmo quando existem nomes repetidos, sem apresentar o ID na interface.              | Os três rankings mantêm uma ordem previsível.                   |
| 2026-09-21 | Não criar migração na fase.                                                                                            | Os contratos existentes cobrem saldo pessoal, detalhe protegido por RLS, diretório mínimo e agregados coletivos. | Mantém a superfície SQL e de autorização inalterada.            |
| 2026-09-22 | Publicar a implementação para revisão no PR #6, mantendo as contas manuais até ao parecer do utilizador.               | Permite validar os três perfis na aplicação antes da limpeza definitiva dos dados temporários.                   | A fase permanece aberta e o PR não deve ser integrado ainda.    |

## Trabalho realizado

### Preparação

- Lidas as fontes de verdade, a matriz RLS/RBAC, o diário da Fase 05 e as migrações de reporting.
- Confirmado no GitHub que o PR #5 foi integrado em `main`.
- Atualizada `main` de `6f475c7` para `1b03ad3` exclusivamente por fast-forward.
- Confirmada árvore de trabalho limpa e criada a branch da fase.

### Dashboard pessoal

- Criados contratos, gateway Supabase e serviço do domínio `dashboard`.
- O saldo é lido de `my_season_balances`, ligado a `auth.uid()`; o detalhe é filtrado simultaneamente por época e pela associação recebida do contexto autenticado.
- Totais, contagens, identidade normal de plantel, snapshots, observação, data, multiplicador e valor final são apresentados com separação entre pendentes e pagas.
- Fotografias são resolvidas por URL assinada temporária do bucket privado; falhas de fotografia usam iniciais sem expor o caminho.
- Implementados estados de carregamento, erro recuperável, ausência total e ausência por estado.

### Mural da Vergonha

- Criados contratos, gateway Supabase, regras de ordenação e serviço do domínio `leaderboard`.
- As métricas agregadas vêm de `get_season_leaderboard`; as fotografias vêm do diretório seguro e os campos de tesoureiro, username, email e administração não entram no modelo de apresentação.
- Implementados rankings separados por quantidade, acumulado e dívida atual, com valores zero omitidos para estados vazios úteis.
- Jogadores, capitães e equipa técnica mantêm a identidade normal de plantel; a interface não apresenta qualquer rótulo de Owner.
- Removida a apresentação do username no cabeçalho autenticado, evitando que a interface coletiva o exponha.

### Testes preparados

- Adicionados testes de serviço e regras para totais pessoais, separação por estado e desempate determinístico.
- Adicionados testes de interface para snapshots, multiplicador, jogador, capitão, equipa técnica, dados privados, carregamento, erro e estados vazios.
- Adicionado cenário PGlite específico de reporting pessoal, isolamento, payload coletivo, multa paga sem dívida e exclusão após eliminação.
- Adicionado e executado o percurso E2E do membro para Chromium desktop e móvel, com conta e dados efémeros removidos pelo runner.
- Preparados e executados scripts de criação e verificação de contas manuais isoladas para jogador, capitão e equipa técnica. As contas permanecem apenas até ao feedback manual e têm limpeza integral dedicada.

### Validação remota e manual

- Confirmado novamente o projeto descartável `showcasetestref00001` e obtida autorização explícita para as operações remotas desta fase.
- O pgTAP remoto passou 81/81 asserções e o runner E2E confirmou a limpeza das contas temporárias.
- A primeira execução do novo E2E detetou que a leitura imediata do Painel podia conservar o estado anterior da sessão de teste. O percurso passou a recarregar a página depois da mutação, validando também a recuperação da sessão; a repetição passou 10/10 em desktop e móvel.
- Criados jogador, capitão e elemento da equipa técnica manuais, cada um com uma multa pendente e uma paga. Login, totais pessoais, isolamento do detalhe, apresentação e rankings foram verificados pelos contratos públicos.
- Build local disponível em `http://127.0.0.1:4174/`; credenciais guardadas exclusivamente em `.manual-validation/members.local.json`, ignorado pelo Git.
- Branch `feature/dashboard-e-mural` publicada e PR Draft #6 aberto para revisão: <https://github.com/JoaoMat10/caixinha-das-multas/pull/6>.

## Ficheiros criados ou alterados

| Ficheiro                                                                                                     | Tipo de alteração | Motivo                                                                      |
| ------------------------------------------------------------------------------------------------------------ | ----------------- | --------------------------------------------------------------------------- |
| `docs/fases/06-dashboard-e-mural.md`                                                                         | criado            | Registo da fase.                                                            |
| `src/domains/dashboard/**`                                                                                   | criado/alterado   | Contratos, gateway, serviço, regras e testes do painel pessoal.             |
| `src/domains/leaderboard/**`                                                                                 | criado/alterado   | Contratos, gateway, serviço, ordenação e testes dos rankings.               |
| `src/app/member/**`, `src/app/AppProviders.tsx`, `src/app/router.tsx`                                        | criado/alterado   | Composição dos serviços e substituição dos placeholders.                    |
| `src/app/layout/AppShell.tsx`                                                                                | alterado          | Remover username da interface autenticada coletiva.                         |
| `src/shared/formatters/money.ts`, `src/shared/infrastructure/privatePhotoUrl.ts`                             | criado            | Formatação monetária partilhada e acesso temporário a fotografias privadas. |
| `src/app/MemberPage.test.tsx`, `tests/database/database.test.mjs`, `e2e/member.spec.ts`                      | criado/alterado   | Cobertura da experiência, reporting/RLS e percursos desktop/móvel.          |
| `scripts/prepare-manual-member.mjs`, `scripts/verify-manual-member.mjs`, `scripts/cleanup-manual-member.mjs` | criado            | Dados e contas efémeros para validação manual, com limpeza dedicada.        |

## Base de dados, contratos e migrações

- Migrações adicionadas: nenhuma; os contratos existentes são suficientes.
- Alterações de schema: nenhuma.
- Funções/RPCs/Edge Functions: reutilizadas `get_season_member_directory`, `get_season_leaderboard`, a vista `my_season_balances` e a leitura RLS de `fines`; sem alterações.
- Políticas RLS: mantidas sem alteração; um jogador continua a ler apenas as próprias multas e os rankings exigem associação à época.
- Compatibilidade e dados existentes: snapshots financeiros, logs imutáveis e isolamento por equipa/época devem permanecer inalterados.

## Testes e verificações

| Comando/cenário                                    | Resultado | Observações                                                                                         |
| -------------------------------------------------- | --------- | --------------------------------------------------------------------------------------------------- |
| Confirmação do PR #5                               | passou    | PR integrado em 2026-09-21; base `main`.                                                            |
| `git pull --ff-only origin main`                   | passou    | Fast-forward até `1b03ad3`.                                                                         |
| `git status --short --branch` antes da nova branch | passou    | Árvore limpa.                                                                                       |
| Typecheck focado com Node 24                       | passou    | Contratos e composição dos novos domínios compilam.                                                 |
| Testes focados de regras e serviço                 | passou    | Regras de apresentação, totais e desempates.                                                        |
| `npm run format:check`                             | passou    | Todos os ficheiros seguem Prettier.                                                                 |
| `npm run lint`                                     | passou    | Sem erros ou avisos.                                                                                |
| `npm run typecheck`                                | passou    | TypeScript sem erros.                                                                               |
| `npm test`                                         | passou    | 66/66 testes em 18 ficheiros.                                                                       |
| `npm run test:db`                                  | passou    | 8/8 cenários PGlite, incluindo reporting da Fase 06.                                                |
| `npm run build`                                    | passou    | Build concluído; aviso não bloqueante de chunk inicial de 755,66 kB.                                |
| Comparação da referência ligada                    | passou    | `supabase/.temp/project-ref` contém exatamente `showcasetestref00001`.                              |
| `supabase db push --linked --dry-run`              | passou    | Base atualizada; zero migrações, seeds ou roles pendentes.                                          |
| `npm run test:db:supabase`                         | passou    | 81/81 asserções pgTAP remotas.                                                                      |
| Primeira execução de `npm run test:e2e`            | falhou    | O novo cenário leu o estado anterior imediatamente após aplicar a multa; contas temporárias limpas. |
| Segunda execução acompanhada de `npm run test:e2e` | passou    | 10/10 testes: cinco em Chromium desktop e cinco em viewport móvel.                                  |
| Verificação de limpeza E2E                         | passou    | Zero contas financeiras ou administrativas temporárias residuais.                                   |
| `scripts/prepare-manual-member.mjs`                | passou    | Três perfis e dados temporários criados no projeto autorizado.                                      |
| `scripts/verify-manual-member.mjs`                 | passou    | Login, saldos, RLS, diretório e rankings confirmados nos três perfis.                               |
| Pré-visualização local                             | passou    | `http://127.0.0.1:4174/` respondeu HTTP 200.                                                        |
| Publicação da branch e criação do PR Draft #6      | passou    | Branch remota criada; PR apontado a `main`, sem integração.                                         |

## Desvios ao planeamento

- O E2E do membro recarrega o Painel depois da escrita para validar dados atuais e recuperação da sessão; não altera o comportamento funcional da aplicação.

## Riscos e limitações

- O chunk inicial de 755,66 kB mantém o aviso não bloqueante já conhecido; code splitting e refinamento final da navegação pertencem à Fase 07.
- As três contas manuais e os respetivos dados são deliberadamente temporários e têm de ser removidos depois da aprovação manual.

## Trabalho pendente

- [x] Implementar os domínios `dashboard` e `leaderboard`.
- [x] Substituir os placeholders do Painel e do Mural.
- [x] Executar os testes remotos de RLS e E2E preparados, depois de autorização explícita.
- [x] Executar a bateria de qualidade local completa.
- [x] Preparar o dry-run remoto sem alterações.
- [x] Obter autorização explícita para a validação remota da fase.
- [x] Preparar scripts isolados para a validação manual.
- [x] Criar as contas manuais e iniciar a app depois da autorização remota.
- [x] Abrir PR em Draft.
- [ ] Recolher feedback manual.
- [ ] Após aprovação, remover contas, dados e credenciais temporários e confirmar o seed original.

## Handoff para a fase seguinte

- A preencher quando a fase estiver pronta para validação e encerramento.
