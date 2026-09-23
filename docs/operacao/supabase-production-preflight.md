# Preflight Supabase de produção

## Estado e alvo

- Estado: preparado, não executado.
- Projeto: `caixinha-showcase-producao`.
- Project ref: `showcaseprodref00001`.
- Região: `eu-central-1` (Frankfurt).
- Estado observado: `ACTIVE_HEALTHY`.
- Commit imutável do preflight: `[COMMIT_SHOWCASE]`.
- Worktree isolado: `production-preflight`, em detached HEAD, sem `supabase/.temp/project-ref`.
- Vínculo do checkout principal preservado em `showcasetestref00001`.

O dry-run foi executado no worktree isolado com a referência explícita de produção. Devolveu oito migrações, `seeds: []` e `roles: []`. Nenhuma migração foi aplicada.

## Comando preparado

O comando final deve usar Node 24 e uma única invocação da CLI:

```powershell
& $node24 $supabaseCli db push `
  --project-ref showcaseprodref00001 `
  --include-all `
  --skip-vault `
  --output-format json
```

Não usar `--include-seed`, `--include-roles`, `--linked`, `db reset` ou uma connection string. `--skip-vault` impede atualizações de secrets a partir de `config.toml`.

O ficheiro `supabase/seed.sql` existe e está ativado para ambientes locais, mas `db push` só o executa com `--include-seed`. Essa flag fica expressamente excluída.

## Migrações e checksums SHA-256

| Migração                                           | SHA-256                                                            |
| -------------------------------------------------- | ------------------------------------------------------------------ |
| `20260911010000_create_core_schema.sql`            | `41b1ac8dd7af9dbacc5c922e6588c95d5e6dc12dd712cc4cc569f147ede05f6b` |
| `20260911020000_create_authorization_and_rls.sql`  | `1e34cfa4160f972026c9c1cd3f8bceeebf15cb904b964a075ddc415e5c88d2db` |
| `20260911030000_create_domain_rpcs.sql`            | `577be5299264eb477ddf53da6401a1795a789fc6520d6b50a773467f90a604e7` |
| `20260911040000_create_secure_reporting.sql`       | `459e1f79ac472bda1f70174bdf41285dad8e2ff22ae63404e0b6c94e82b8813f` |
| `20260914010000_create_auth_session_contracts.sql` | `e1ba80828aab50ec0786d06e22c38859907e1b85221c06cae6f2b67864dabdb6` |
| `20260915010000_create_admin_contracts.sql`        | `7906fb343da426a87d81f985da992f891b3ee3f6fead2029805e140d7c365158` |
| `20260915020000_grant_admin_service_reads.sql`     | `26a0905defaad9a21651f0802d4985c394aff93c468aa46dd4e2d1d216b17848` |
| `20260915030000_harden_admin_password_reset.sql`   | `e379e0433a2de47f4b4bcd43bcee2d63076e9ff9f07f002785be01b478c64997` |

Antes da execução, os oito checksums devem ser recalculados no worktree e comparados byte a byte com esta lista. Qualquer diferença interrompe o processo.

## Tabelas e RLS

O conjunto criado e o conjunto que recebe `ENABLE ROW LEVEL SECURITY` são exatamente iguais, com 14 tabelas:

`admin_password_reset_requests`, `admin_user_requests`, `app_admins`, `audit_events`, `fine_categories`, `fines`, `member_roles`, `payment_batches`, `payment_logs`, `roles`, `season_members`, `seasons`, `teams` e `users`.

A migração do schema e a migração de autorização são ficheiros consecutivos no mesmo `db push`. Cada migração é uma transação própria. Durante o intervalo entre ambas, o event trigger de plataforma `ensure_rls` ativa RLS automaticamente nas novas tabelas, deixando-as em negação por omissão até à criação das políticas. As duas tabelas administrativas criadas mais tarde ativam RLS dentro da própria transação que as cria.

## Políticas RLS públicas

As 29 políticas públicas são:

| Tabela            | Operação | Política                                    |
| ----------------- | -------- | ------------------------------------------- |
| `app_admins`      | DELETE   | `app_admins_delete_admin`                   |
| `app_admins`      | INSERT   | `app_admins_insert_admin`                   |
| `app_admins`      | SELECT   | `app_admins_select_admin`                   |
| `audit_events`    | INSERT   | `audit_events_insert_admin`                 |
| `audit_events`    | SELECT   | `audit_events_select_admin`                 |
| `fine_categories` | INSERT   | `fine_categories_insert_treasurer`          |
| `fine_categories` | SELECT   | `fine_categories_select_authorized`         |
| `fine_categories` | UPDATE   | `fine_categories_update_treasurer`          |
| `fines`           | INSERT   | `fines_insert_treasurer`                    |
| `fines`           | SELECT   | `fines_select_owner_or_treasurer`           |
| `member_roles`    | DELETE   | `member_roles_delete_admin`                 |
| `member_roles`    | INSERT   | `member_roles_insert_admin`                 |
| `member_roles`    | SELECT   | `member_roles_select_authorized`            |
| `member_roles`    | UPDATE   | `member_roles_update_admin`                 |
| `payment_batches` | SELECT   | `payment_batches_select_owner_or_treasurer` |
| `payment_logs`    | SELECT   | `payment_logs_select_owner_or_treasurer`    |
| `roles`           | SELECT   | `roles_select_authenticated`                |
| `season_members`  | INSERT   | `season_members_insert_admin`               |
| `season_members`  | SELECT   | `season_members_select_authorized`          |
| `season_members`  | UPDATE   | `season_members_update_admin`               |
| `seasons`         | INSERT   | `seasons_insert_admin`                      |
| `seasons`         | SELECT   | `seasons_select_authorized`                 |
| `seasons`         | UPDATE   | `seasons_update_admin`                      |
| `teams`           | INSERT   | `teams_insert_admin`                        |
| `teams`           | SELECT   | `teams_select_authorized`                   |
| `teams`           | UPDATE   | `teams_update_admin`                        |
| `users`           | INSERT   | `users_insert_admin`                        |
| `users`           | SELECT   | `users_select_self_or_admin`                |
| `users`           | UPDATE   | `users_update_admin`                        |

Não existem políticas públicas de escrita direta para pagamentos. As transições financeiras são feitas pelas RPCs autorizadas e os triggers de imutabilidade impedem `UPDATE` e `DELETE` nos batches, logs e eventos de auditoria.

## Storage

O bucket `private-photos` fica com:

- `public = false`;
- limite de 5 MiB (`5242880` bytes);
- MIME types `image/jpeg`, `image/png` e `image/webp`;
- atualização idempotente que repõe `public = false` se o bucket já existir.

As quatro políticas em `storage.objects` são:

| Operação | Política                         | Regra                                                                                                                                            |
| -------- | -------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------ |
| SELECT   | `private_photos_read_authorized` | Exige conta ativa e permite Owner/Admin; a própria fotografia; fotografias de membros ativos da mesma época; ou fotografias da equipa do membro. |
| INSERT   | `private_photos_insert_admin`    | Exige bucket `private-photos` e Owner/Admin.                                                                                                     |
| UPDATE   | `private_photos_update_admin`    | Exige bucket `private-photos` e Owner/Admin em `USING` e `WITH CHECK`.                                                                           |
| DELETE   | `private_photos_delete_admin`    | Exige bucket `private-photos` e Owner/Admin.                                                                                                     |

## GRANT e REVOKE

O lote aplica os seguintes limites finais:

- schema `private`: `REVOKE ALL` de `PUBLIC`; apenas `USAGE` para `authenticated`;
- funções `private` iniciais: `REVOKE EXECUTE` de `PUBLIC` e `GRANT EXECUTE` a `authenticated`; os auxiliares administrativos e o trigger de password recebem revogações mais restritivas;
- 12 tabelas de domínio: `REVOKE ALL` de `anon` e `authenticated`, seguido apenas de `GRANT SELECT` a `authenticated`;
- `admin_user_requests` e `admin_password_reset_requests`: `REVOKE ALL` de `PUBLIC`, `anon` e `authenticated`, sem leitura direta concedida;
- tipos `season_status`, `member_type`, `member_status`, `fine_status` e `payment_action`: `GRANT USAGE` a `authenticated`;
- cinco RPCs de domínio: execução revogada a `PUBLIC` e `anon`, concedida a `authenticated`;
- três vistas de reporting: acesso revogado a `PUBLIC` e `anon`, apenas `SELECT` para `authenticated`;
- duas funções públicas de reporting e duas funções privadas correspondentes: execução pública/anónima revogada e execução autenticada concedida;
- `get_auth_context`, `get_admin_overview`, `save_admin_team`, `update_admin_season`, `save_admin_member` e `set_admin_photo`: execução pública/anónima revogada e execução autenticada concedida;
- cinco funções administrativas de identidade e duas funções de reset de password: execução revogada a `PUBLIC`, `anon` e `authenticated`, concedida exclusivamente a `service_role`;
- `service_role`: `SELECT` explícito apenas em `public.users` e `public.app_admins` para suportar a Edge Function;
- nenhuma permissão de tabela é concedida a `anon` e não existe `GRANT INSERT`, `UPDATE` ou `DELETE` direto a `authenticated`.

## Funções SECURITY DEFINER

- O estado final das oito migrações contém 32 funções `SECURITY DEFINER` da aplicação. Existem 33 declarações no lote porque `mark_admin_password_reset` é substituída pelas rotinas endurecidas da última migração.
- As 32 funções finais declaram explicitamente `SET search_path = ''` e usam referências qualificadas por schema.
- A função preexistente da plataforma `public.rls_auto_enable()` pertence a `postgres`, usa `search_path=pg_catalog` e está associada ao event trigger ativo `ensure_rls`.
- Assim, as 33 funções `SECURITY DEFINER` efetivas previstas após o lote têm um `search_path` restrito: vazio para as 32 funções da aplicação e apenas `pg_catalog` para a função da plataforma.

## Verificação pós-execução

Imediatamente após um `db push` bem-sucedido:

1. voltar a confirmar que o checkout principal continua ligado a `showcasetestref00001` e que o worktree isolado continua sem vínculo;
2. executar `scripts/sql/supabase-production-post-migration-verification.sql` por referência explícita de produção;
3. exigir oito versões no histórico, 14 tabelas exatas e RLS ativo nas 14;
4. exigir exatamente 29 políticas públicas e quatro de Storage;
5. exigir o bucket privado com limite e MIME types previstos;
6. exigir 32 funções de segurança da aplicação com `search_path` vazio e a função da plataforma com `pg_catalog`;
7. exigir todos os triggers relevantes ativos;
8. exigir zero identidades Auth, zero objetos Storage, apenas as duas roles de referência e zero linhas nas restantes tabelas;
9. inventariar os privilégios diretos de tabelas e funções e compará-los com a secção anterior;
10. repetir `db push --dry-run --include-all --skip-vault` e exigir `upToDate: true`, `migrations: []`, `seeds: []` e `roles: []`.

Não configurar Auth, secrets, Edge Functions, Owner, Cloudflare ou deployment neste checkpoint.

## Falha e rollback

`supabase db push` executa cada ficheiro de migração numa transação, mas não envolve as oito migrações numa única transação global. Em caso de falha:

1. a migração que falhou é revertida pela respetiva transação e a CLI interrompe o lote;
2. migrações anteriores já confirmadas podem permanecer aplicadas e registadas;
3. interromper todas as operações seguintes, não executar seed, `db reset`, drops ou limpeza automática;
4. preservar output da CLI, histórico de migrações e o inventário read-only pós-falha;
5. confirmar que todas as tabelas eventualmente criadas continuam com RLS ativo e sem dados de utilizador;
6. corrigir por uma migração forward versionada e retomar apenas após revisão e nova autorização;
7. se for exigido regressar à base vazia, preparar separadamente um teardown revisto ou recriar o projeto, ambos destrutivos e sujeitos a autorização explícita própria.

Não existe promessa de rollback global automático. A estratégia segura é transação por migração, negação por omissão via RLS, paragem imediata, recolha de evidências e correção forward.
