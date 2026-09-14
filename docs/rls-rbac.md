# Matriz RLS e RBAC

Este documento descreve o contrato de autorizacao implementado na Fase 02. As politicas PostgreSQL sao a fonte executavel; esta matriz facilita a revisao e deve ser atualizada sempre que um recurso, uma operacao ou uma regra de visibilidade mudar.

## Principios

- `anon` nao tem privilegios sobre tabelas, vistas ou RPCs da aplicacao.
- `authenticated` recebe apenas `SELECT` nas tabelas e vistas autorizadas. Nao existem escritas financeiras diretas.
- Operacoes financeiras usam RPCs `security definer` com `search_path` vazio, validacao explicita do utilizador, equipa, epoca, estado e idempotencia.
- As funcoes auxiliares vivem no schema `private`, que nao e exposto pela Data API.
- Owner e uma permissao global privada em `app_admins`; nao concede acesso financeiro nem poderes de tesoureiro.
- Capitao e equipa tecnica alteram apenas o multiplicador. Nao recebem autorizacoes adicionais.
- Um membro normal consulta detalhe apenas das suas multas. O tesoureiro consulta o detalhe financeiro completo apenas das epocas em que tem essa funcao.
- Vistas publicas usam `security_invoker = true`; rankings e diretorio devolvem apenas campos aprovados e nunca usernames, emails tecnicos ou `app_admins`.

## Tabelas

`Negado` significa ausencia de privilegio direto, de politica aplicavel ou ambos. Operacoes administrativas futuras que precisem de `service_role` pertencem a Edge Functions e nunca ao frontend.

| Recurso           | SELECT                                              | INSERT                                                               | UPDATE                                                               | DELETE                                            |
| ----------------- | --------------------------------------------------- | -------------------------------------------------------------------- | -------------------------------------------------------------------- | ------------------------------------------------- |
| `users`           | Proprio perfil; Owner consulta todos                | Negado diretamente; politica defensiva para Owner                    | Negado diretamente; politica defensiva para Owner                    | Negado                                            |
| `app_admins`      | Apenas Owner; invisivel para restantes utilizadores | Negado diretamente; politica defensiva para Owner                    | Negado                                                               | Negado diretamente; politica defensiva para Owner |
| `teams`           | Owner ou membro ativo de uma epoca da equipa        | Negado diretamente; politica defensiva para Owner                    | Negado diretamente; politica defensiva para Owner                    | Negado; arquivar/desativar substitui eliminacao   |
| `seasons`         | Owner ou membro ativo da epoca                      | Negado diretamente; politica defensiva para Owner                    | Negado diretamente; politica defensiva para Owner                    | Negado; o estado `archived` preserva historico    |
| `season_members`  | Owner ou membro ativo da mesma epoca                | Negado diretamente; politica defensiva para Owner                    | Negado diretamente; politica defensiva para Owner                    | Negado; usa-se `inactive`                         |
| `roles`           | Utilizador autenticado ativo                        | Negado                                                               | Negado                                                               | Negado                                            |
| `member_roles`    | Owner ou membro ativo da mesma epoca                | Negado diretamente; politica defensiva para Owner                    | Negado diretamente; politica defensiva para Owner                    | Negado diretamente; politica defensiva para Owner |
| `fine_categories` | Owner ou membro ativo da epoca                      | Apenas via `save_fine_category`; politica defensiva exige tesoureiro | Apenas via `save_fine_category`; politica defensiva exige tesoureiro | Negado; categorias usadas sao desativadas         |
| `fines`           | Proprio infrator ou tesoureiro da epoca             | Apenas via `apply_fine`                                              | Apenas via `record_payment_batch`                                    | Apenas via `delete_pending_fine`                  |
| `payment_batches` | Proprio pagador ou tesoureiro da epoca              | Apenas via `record_payment_batch`                                    | Negado                                                               | Negado                                            |
| `payment_logs`    | Proprio pagador ou tesoureiro da epoca              | Apenas via `record_payment_batch`                                    | Negado; eventos imutaveis                                            | Negado; eventos imutaveis                         |
| `audit_events`    | Apenas Owner                                        | Negado diretamente; politica defensiva para Owner                    | Negado                                                               | Negado                                            |

## Vistas e RPCs

| Contrato                      | Quem pode usar                                    | Garantias                                                                                                  |
| ----------------------------- | ------------------------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| `my_season_balances`          | Utilizador autenticado ativo                      | Apenas o proprio saldo por epoca; totais em centimos inteiros                                              |
| `treasury_season_totals`      | Tesoureiro da epoca                               | Total multado, recebido e em divida calculados a partir do estado atual                                    |
| `pending_fines_by_member`     | Proprio membro ou tesoureiro da epoca             | Respeita a RLS de `fines` e nao inclui observacoes                                                         |
| `get_season_member_directory` | Owner ou membro ativo da epoca                    | Nome apresentado, fotografia e dados de plantel; omite identidade tecnica e permissao global               |
| `get_season_leaderboard`      | Membro ativo da epoca                             | Quantidade, acumulado e divida; omite detalhe das multas e permissao global                                |
| `create_season`               | Apenas Owner                                      | Cria de forma idempotente e copia plantel ativo, roles e catalogo; nunca dados financeiros                 |
| `save_fine_category`          | Tesoureiro da epoca em estado `draft` ou `active` | Calcula autoria, valida valor minimo e impede gestao em epoca arquivada                                    |
| `apply_fine`                  | Tesoureiro da epoca ativa                         | Valida membro/categoria, fixa snapshots, calcula multiplicador 1x/2x e aplica idempotencia por epoca/ator  |
| `record_payment_batch`        | Tesoureiro da epoca ativa                         | Uma so pessoa por batch, total calculado no servidor, transicao atomica, logs imutaveis e idempotencia     |
| `delete_pending_fine`         | Tesoureiro da epoca ativa                         | Elimina apenas `pending` com `has_ever_been_paid = false`; nao cria historico funcional da multa eliminada |

## Casos de teste

| Cenario                                               | Resultado esperado                                               | Cobertura automatizada      |
| ----------------------------------------------------- | ---------------------------------------------------------------- | --------------------------- |
| Pedido `anon` a `teams`                               | Negado por privilegios                                           | PostgreSQL embebido e pgTAP |
| Jogador A consulta equipas/epocas                     | Apenas Clube Azul e as epocas em que participa                   | PostgreSQL embebido e pgTAP |
| Jogador A consulta `users` e `app_admins`             | Apenas o proprio perfil; zero linhas de Owner                    | PostgreSQL embebido e pgTAP |
| Jogador A consulta multas                             | Apenas as multas do proprio membro, incluindo epocas autorizadas | PostgreSQL embebido e pgTAP |
| Jogador B tenta consultar Clube Azul                  | Zero linhas/dados inacessiveis                                   | PostgreSQL embebido e pgTAP |
| Membro tenta ranking de outra equipa                  | Erro `42501`                                                     | PostgreSQL embebido e pgTAP |
| Membro tenta ranking de outra epoca da mesma equipa   | Erro `42501`                                                     | PostgreSQL embebido e pgTAP |
| Owner copia uma epoca                                 | Plantel ativo, roles e catalogo copiados; zero dados financeiros | PostgreSQL embebido e pgTAP |
| Repeticao da copia com a mesma chave                  | Devolve a mesma epoca sem duplicar dados                         | PostgreSQL embebido e pgTAP |
| Owner tenta copiar uma epoca de outra equipa          | Erro `P0002`                                                     | PostgreSQL embebido e pgTAP |
| Jogador tenta criar uma epoca                         | Erro `42501`                                                     | PostgreSQL embebido e pgTAP |
| Owner sem associacao consulta multas/ranking          | Zero multas e ranking negado                                     | PostgreSQL embebido e pgTAP |
| Owner consulta equipas, perfis, auditoria e diretorio | Permitido                                                        | PostgreSQL embebido e pgTAP |
| Jogador normal tenta aplicar multa                    | Erro `42501`                                                     | PostgreSQL embebido e pgTAP |
| Tesoureiro A tenta operar na equipa B                 | Erro `42501`                                                     | PostgreSQL embebido e pgTAP |
| Tesoureiro aplica multa a jogador normal              | Permitido; multiplicador 1x                                      | PostgreSQL embebido e pgTAP |
| Tesoureiro aplica multa a capitao e equipa tecnica    | Permitido; multiplicador 2x sem acumulacao                       | PostgreSQL embebido e pgTAP |
| Repeticao da aplicacao com a mesma chave              | Devolve a mesma multa sem duplicar                               | PostgreSQL embebido e pgTAP |
| Liquidacao de multas selecionadas                     | Total calculado, estado `paid`, batch e um log por multa         | PostgreSQL embebido e pgTAP |
| Repeticao da liquidacao com a mesma chave             | Devolve o mesmo batch sem duplicar logs                          | PostgreSQL embebido e pgTAP |
| Reabertura                                            | Estado `pending`, novo log e `has_ever_been_paid = true`         | PostgreSQL embebido e pgTAP |
| Eliminacao de multa reaberta                          | Negada com erro `55000`                                          | PostgreSQL embebido e pgTAP |
| Eliminacao de multa pendente nunca paga               | Permitida ao tesoureiro da epoca                                 | PostgreSQL embebido e pgTAP |
| Escrita direta em tabela financeira                   | Negada por privilegios mesmo ao tesoureiro                       | PostgreSQL embebido e pgTAP |

## Execucao

Sem Docker, as migracoes completas e o seed sao aplicados sobre duas instancias PostgreSQL PGlite independentes antes dos testes:

```powershell
npm run test:db
```

Com Docker Desktop e Supabase CLI, a verificacao oficial recria a base local e executa `supabase/tests/database_rls.test.sql` com pgTAP:

```powershell
npm run test:db:supabase
```

O segundo comando e destrutivo apenas para a base Supabase local. Nunca usar `supabase db reset --linked` num ambiente remoto com dados reais.

## Resultado da Fase 02

- `npm run test:db`: passou em 2026-09-14; quatro suites cobriram reproducao integral, constraints, metadados de seguranca, RLS/RBAC, isolamento entre equipas/epocas e RPCs atomicas.
- `supabase/tests/database_rls.test.sql`: 39 assercoes pgTAP preparadas. Nao foram executadas neste host porque Docker Desktop e Supabase CLI nao estao instalados.
- Formatação, lint, typecheck, testes web, build e quatro testes E2E em Chromium desktop/movel passaram no mesmo ciclo final.
