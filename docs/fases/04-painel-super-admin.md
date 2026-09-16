# Fase 04 — Painel Super Admin

## Estado

- Estado: concluída — validação manual aprovada e PR pronto para merge
- Responsável: equipa de engenharia
- Início: 2026-09-15
- Última atualização: 2026-09-16
- Dependências recebidas: Fase 03 integrada em `main` pelo commit squash `7c22ce3`; autenticação por username, contexto de sessão e proteção de rotas validados.

## Objetivo

Entregar um painel administrativo funcional, exclusivo do Super Admin, para gerir utilizadores, equipas, épocas, plantéis, funções, fotografias e auditoria, com autorização efetiva no servidor e sem expor credenciais ou a permissão global.

## Escopo assumido

- Implementar contratos e operações administrativas protegidas no backend.
- Gerir contas, equipas, épocas, plantéis e roles adicionais.
- Criar, substituir e remover fotografias num bucket privado.
- Consultar auditoria administrativa autorizada.
- Disponibilizar uma interface mobile-first e testável, sem antecipar as fases de tesouraria, dashboards ou refinamento visual.

## Decisões tomadas

| Data       | Decisão                                                                                                    | Justificação                                                                                                                                 | Impacto                                                                                                               |
| ---------- | ---------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------------- |
| 2026-09-15 | Criar a branch `feature/painel-super-admin` a partir de `main` limpa e sincronizada.                       | Isola a fase e permite revisão por pull request sem alterar `main`.                                                                          | Todo o trabalho da fase permanece na branch dedicada.                                                                 |
| 2026-09-15 | Separar contas Auth das restantes mutações administrativas.                                                | Criar, alterar, bloquear e repor credenciais atravessa a Admin API; equipas, épocas e plantéis podem permanecer transacionais em PostgreSQL. | A Edge Function coordena Auth com RPCs exclusivas de `service_role`; as restantes RPCs validam `auth.uid()` e Owner.  |
| 2026-09-15 | Tornar cada reposição de password determinística por operação idempotente, usando HMAC apenas no servidor. | Permite recuperar com segurança de falhas ou respostas perdidas entre Auth e PostgreSQL sem persistir a password.                            | A mesma chave reaplica a mesma password e conclui uma única marcação/auditoria; uma nova chave produz outra password. |
| 2026-09-15 | Guardar as credenciais da validação manual apenas em `.manual-validation/`, ignorada pelo Git.             | Permite entregar uma conta temporária sem incluir o segredo no repositório, documentação, comandos ou logs.                                  | O ficheiro local deve ser removido juntamente com a conta após a decisão do utilizador sobre o teste manual.          |
| 2026-09-15 | Redimensionar e recomprimir todas as fotografias no cliente antes do upload.                               | Cumpre o contrato arquitetural, reduz tráfego/armazenamento e mantém a validação defensiva no backend.                                       | JPEG, PNG e WebP são preservados, limitados a 1024 px no maior lado e a 5 MiB antes e depois do processamento.        |

## Trabalho realizado

### Preparação da fase

- Leitura integral do pedido, de `AGENTS.md`, da documentação funcional e arquitetural, da matriz RLS/RBAC, dos diários das Fases 02 e 03 e do template obrigatório.
- Confirmação de `main` e `origin/main` em `7c22ce3`, com working tree limpa e sem alterações locais a preservar.
- Criação da branch `feature/painel-super-admin`.

### Contratos de dados administrativos

- Migração administrativa iniciada com leitura agregada exclusiva do Owner, idempotência de criação de contas e RPCs auditadas para utilizadores, equipas, épocas, plantéis, roles e fotografias.
- Bucket privado preparado condicionalmente para a stack Supabase, com limite de 5 MiB, tipos MIME aprovados, leitura contextual e escrita/remoção apenas pelo Owner.

### Operações de contas

- Edge Function `admin-users` implementada com validação explícita do JWT e confirmação server-side do Owner ativo.
- Criação idempotente coordena Auth e perfil com o mesmo UUID e elimina a identidade Auth se a transação de perfil falhar.
- Edição de username compensa a alteração do email técnico quando a atualização PostgreSQL falha; desativação/reativação coordena banimento Auth e estado público com compensação.
- Criação e reposição geram passwords temporárias no servidor, ativam `must_change_password` e nunca incluem credenciais na auditoria.

### Interface administrativa

- Domínio `admin` organizado em contratos, validação, gateway Supabase, serviço, contexto e componentes de apresentação.
- Página responsiva com resumo, pesquisa e gestão de utilizadores, equipas/épocas, plantéis/roles, fotografias e auditoria.
- Componentes React dependem apenas do serviço administrativo; SDK, Edge Function, Storage e nomes de RPC permanecem no adaptador de infraestrutura.

### Validação remota e preparação manual

- Confirmada a correspondência exata entre `SUPABASE_TEST_PROJECT_REF` e `supabase/.temp/project-ref` antes de cada operação remota.
- Aplicadas as duas migrações após os respetivos dry-runs, sem executar `db reset --linked`; o dry-run final indica base remota atualizada e zero migrações pendentes.
- Publicada e confirmada como ativa a Edge Function `admin-users`, com `verify_jwt = true`.
- Corrigida a permissão interna de leitura de `service_role` identificada pelo primeiro teste real, sem ampliar privilégios de `authenticated` ou `anon`.
- Reforçada a limpeza dos testes para remover perfis, identidades Auth e ficheiros; a auditoria temporária é eliminada numa transação de teardown que reativa a proteção de imutabilidade antes do commit.
- Criado um Owner temporário exclusivo da validação manual. O projeto já contém duas equipas, três épocas, utilizadores, jogadores, equipa técnica, capitães, tesoureiros e eventos de auditoria; foi ainda criada uma imagem PNG local para testar fotografias.
- Pull request `#4` aberto a partir de `feature/painel-super-admin` para `main`; permanece sem aprovação para merge enquanto decorre a validação manual.

### Correções após revisão e validação manual

- A validação manual dos fluxos da Fase 04 foi concluída com sucesso.
- O upload passou a descodificar, redimensionar proporcionalmente até 1024 px e recomprimir no browser, preservando JPEG, PNG ou WebP. O limite de 5 MiB é verificado no ficheiro original e no resultado.
- O E2E descarrega o objeto realmente gravado no Storage e confirma no cabeçalho PNG as dimensões finais de 1024 × 512.
- A reposição de password passou a usar `prepare_admin_password_reset` antes de alterar Auth e `complete_admin_password_reset` depois da alteração. A chave de idempotência liga ator, utilizador e operação; uma password forte determinística é derivada por HMAC com segredo exclusivo do servidor e nunca é armazenada.
- Se a conclusão PostgreSQL falhar ou a resposta se perder, repetir a mesma operação reaplica a mesma password e conclui a marcação/auditoria exatamente uma vez. A interface conserva a chave até receber sucesso.
- A Edge Function foi publicada como versão 2 antes da migração restritiva, evitando uma janela em que o contrato antigo pudesse alterar passwords sem o novo protocolo.

### Limpeza da validação manual

- Antes da limpeza foi executado um inventário exato. Identificou apenas o Owner `44444444-4444-4444-8444-444444444444`, uma atribuição de Owner, um evento `photo.updated` e o objeto `users/00000000-0000-4000-8000-000000000001/55555555-5555-4555-8555-555555555555.png`; não encontrou equipas, épocas, membros, pedidos internos nem referências financeiras criadas por essa conta.
- O objeto estava referenciado pelo `avatar_path` do perfil seed `00000000-0000-4000-8000-000000000001`. A remoção do objeto e dessa referência foi feita apenas após autorização explícita.
- Foram eliminados o objeto inventariado, a referência exata, o evento de auditoria, a atribuição administrativa, o perfil público e a identidade Auth do Owner temporário.
- A verificação pós-limpeza devolveu zero para Auth, utilizadores, administradores, equipas, épocas, membros, auditoria, objetos Storage e referências de fotografia.
- Foram removidos individualmente `owner.local.json` e `avatar-teste.png`. A pasta não foi eliminada por conter um ficheiro não reconhecido, que foi preservado por poder pertencer ao utilizador.

## Ficheiros criados ou alterados

| Ficheiro                                                                    | Tipo de alteração | Motivo                                                                                        |
| --------------------------------------------------------------------------- | ----------------- | --------------------------------------------------------------------------------------------- |
| `docs/fases/04-painel-super-admin.md`                                       | criado            | Diário obrigatório, decisões, validações e handoff da Fase 04.                                |
| `supabase/migrations/20260915010000_create_admin_contracts.sql`             | criado            | Contratos administrativos, auditoria e Storage privado.                                       |
| `tests/database/database.test.mjs`                                          | alterado          | Disponibilizar o papel `service_role` no PostgreSQL embebido para aplicar os contratos reais. |
| `supabase/functions/admin-users/index.ts`                                   | criado            | Coordenar contas Auth e perfis públicos com autorização server-side e compensação.            |
| `supabase/config.toml`                                                      | alterado          | Exigir verificação JWT na Edge Function administrativa.                                       |
| `src/domains/admin/**`                                                      | criado/alterado   | Implementar contratos, regras, adaptador, serviço, estado e interface funcional.              |
| `src/app/AppProviders.tsx`, `src/app/router.tsx`                            | alterado          | Compor o serviço administrativo e substituir o placeholder pela página protegida.             |
| `src/shared/rules/username.ts`, `src/domains/auth/rules/username.ts`        | criado/alterado   | Partilhar a normalização e o email técnico entre Auth e a Edge Function sem duplicação.       |
| `supabase/tests/admin_panel.test.sql`, `tests/database/database.test.mjs`   | criado/alterado   | Cobrir autorização, idempotência, transições, plantel, roles e auditoria.                     |
| `scripts/test-admin-supabase.mjs`, `scripts/supabase-auth-test-fixture.mjs` | criado/alterado   | Validar Auth, Edge Function e Storage num projeto remoto descartável com limpeza.             |
| `e2e/admin.spec.ts`, `scripts/test-e2e.mjs`                                 | criado/alterado   | Exercitar a administração em Chromium desktop e móvel com Owner efémero.                      |
| `scripts/prepare-manual-admin.mjs`, `.gitignore`                            | criado/alterado   | Preparar o Owner, credenciais e imagem apenas na pasta local ignorada.                        |
| `src/domains/admin/rules/photoProcessing.ts` e teste                        | criado            | Redimensionar e recomprimir fotografias antes do upload, preservando MIME e limites.          |
| `src/shared/rules/adminPasswordReset.ts` e teste                            | criado            | Implementar reposição recuperável e idempotente sem armazenar passwords.                      |
| `supabase/migrations/20260915030000_harden_admin_password_reset.sql`        | criado            | Introduzir preparação/conclusão idempotentes e retirar o contrato inseguro anterior.          |
| `scripts/cleanup-manual-admin.mjs`                                          | criado            | Inventariar, limpar e verificar exclusivamente os artefactos da validação manual.             |

## Base de dados, contratos e migrações

- Migrações adicionadas: `20260915010000_create_admin_contracts.sql`, `20260915020000_grant_admin_service_reads.sql` e `20260915030000_harden_admin_password_reset.sql`.
- Alterações de schema: tabelas privadas por privilégios `admin_user_requests` e `admin_password_reset_requests` para idempotência, sem credenciais nem derivados.
- Funções/RPCs/Edge Functions: leitura agregada do painel; contratos administrativos de conta restritos a `service_role`; preparação e conclusão idempotentes da reposição; RPCs transacionais de equipa, época, plantel, roles e fotografia; Edge Function `admin-users` com JWT obrigatório.
- Políticas RLS: tabela de idempotência sem acesso `anon`/`authenticated`; bucket privado com leitura autorizada por contexto e escrita exclusiva do Owner.
- Compatibilidade e dados existentes: a preservar e validar com todas as migrações.

## Testes e verificações

| Comando/cenário                                    | Resultado | Observações                                                                                                                                 |
| -------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------------------------------------- |
| Verificação de branch, histórico e working tree    | passou    | `main` e `origin/main` em `7c22ce3`; árvore inicial limpa.                                                                                  |
| `npm test`                                         | passou    | 53/53 testes em 12 ficheiros, incluindo processamento de imagem, recuperação da reposição, serviço, interface e rotas.                      |
| `npm run test:db`                                  | passou    | 6/6 cenários PGlite; migrações reproduzíveis e contratos administrativos validados.                                                         |
| `npm run lint`                                     | passou    | Sem erros ou avisos.                                                                                                                        |
| `npm run typecheck`                                | passou    | TypeScript estrito sem erros.                                                                                                               |
| `npm run build`                                    | passou    | Build concluído; mantém apenas o aviso não bloqueante sobre o chunk inicial.                                                                |
| `npm audit`                                        | passou    | 0 vulnerabilidades em dependências de produção e desenvolvimento.                                                                           |
| `npm run test:admin:supabase` sem referência       | passou    | O fail-safe recusou a execução antes de qualquer acesso remoto porque `SUPABASE_TEST_PROJECT_REF` está ausente.                             |
| Dry-run e aplicação da primeira migração           | passou    | O dry-run indicou apenas `20260915010000_create_admin_contracts.sql`; migração aplicada sem seed e sem reset.                               |
| Publicação de `admin-users`                        | passou    | Função e módulo partilhado de username publicados no projeto descartável confirmado.                                                        |
| `npm run test:db:supabase`                         | passou    | 81/81 asserções pgTAP: 27 Admin, 8 Auth e 46 RLS/base.                                                                                      |
| Primeira execução de `npm run test:admin:supabase` | falhou    | Detetou falta de `SELECT` de `service_role` em `users`/`app_admins`; a limpeza do Owner temporário ficou impedida até à migração corretiva. |
| Dry-run e aplicação da migração corretiva          | passou    | O dry-run indicou apenas `20260915020000_grant_admin_service_reads.sql`; migração aplicada sem seed e sem reset.                            |
| Segunda execução administrativa real               | passou    | 18 cenários funcionais passaram; o teardown revelou que a proteção de auditoria também precisava de tratamento transacional no teste.       |
| Bateria administrativa remota final                | passou    | 34 verificações de Auth, Edge Function, Storage, repetição da reposição, edição, ativação e auditoria; limpeza final sem perfis residuais.  |
| `npm run test:auth:supabase`                       | passou    | 9/9 cenários Auth reais; contas temporárias eliminadas.                                                                                     |
| `npm run test:e2e`                                 | passou    | 6/6 testes em Chromium desktop e móvel, incluindo upload real redimensionado para 1024 × 512 no Storage.                                    |
| Dry-run remoto final                               | passou    | Zero migrações, seeds ou roles pendentes; base remota atualizada.                                                                           |
| Verificação da Edge Function                       | passou    | `admin-users` ativa, versão 2, com validação JWT.                                                                                           |
| Preparação da validação manual                     | passou    | Owner temporário criado; dados mínimos confirmados; credenciais e PNG apenas na pasta local ignorada.                                       |
| Validação manual                                   | passou    | Utilizador confirmou com sucesso os fluxos administrativos da Fase 04.                                                                      |
| Limpeza da validação manual                        | passou    | Inventário exato sem referências financeiras; Owner, registos, objeto e credenciais removidos; verificação final integral a zero.           |
| Abertura do pull request                           | passou    | PR `#4` aberto sobre `main`; mantido sem merge e pronto para decisão de merge.                                                              |

Comandos remotos executados, sempre depois da comparação exata com a referência autorizada:

```powershell
$env:SUPABASE_TEST_PROJECT_REF = 'showcasetestref00001'
supabase db push --linked --dry-run
supabase db push --linked
supabase functions deploy admin-users --project-ref showcasetestref00001
node scripts/test-supabase-linked.mjs
node scripts/test-auth-supabase.mjs
node scripts/test-admin-supabase.mjs
node scripts/test-e2e.mjs
node scripts/cleanup-manual-admin.mjs --inventory
node scripts/cleanup-manual-admin.mjs --execute
supabase functions list --project-ref showcasetestref00001
```

Não foi executado `db reset --linked`.

## Desvios ao planeamento

- O primeiro teste real revelou que as RPCs internas de contas precisavam de leitura explícita de `users` e `app_admins` por `service_role`. A correção ficou isolada na segunda migração e não alterou o acesso do frontend.
- O primeiro teardown completo encontrou o trigger de imutabilidade da auditoria. A limpeza passou a eliminar apenas eventos dos Owners efémeros numa transação de teste, mantendo o trigger ativo antes e depois da transação.
- A revisão posterior à validação manual detetou que o upload não aplicava o pré-processamento definido na arquitetura e que a reposição de password podia ficar incoerente numa falha entre Auth e PostgreSQL. Ambos os contratos foram corrigidos e cobertos local e remotamente.
- A limpeza manual encontrou uma fotografia criada pelo Owner temporário num perfil seed permanente. O caminho e a referência foram removidos somente após inventário e autorização explícita; nenhum outro ficheiro da pasta local foi removido.

## Riscos e limitações

- As operações que coordenam Supabase Auth e PostgreSQL atravessam dois sistemas transacionais; a criação/edição usa compensação e a reposição usa preparação, derivação determinística e conclusão idempotente.
- Testes remotos só podem executar depois de validar `SUPABASE_TEST_PROJECT_REF` contra `supabase/.temp/project-ref`.
- O bundle inicial cresceu para cerca de 717 kB sem compressão e continua acima do limiar de aviso; code splitting permanece trabalho de refinamento da aplicação.
- A pasta local ignorada `.manual-validation/` conserva um ficheiro não criado nem reconhecido pelo processo de validação; foi deliberadamente preservado.

## Trabalho pendente

- [x] Implementar migração, RPCs administrativas, auditoria e políticas de Storage.
- [x] Implementar Edge Function para contas e contratos protegidos de fotografias.
- [x] Implementar serviços/adaptadores e interface administrativa.
- [x] Cobrir localmente contratos, RLS, UI e rotas.
- [x] Aplicar as migrações e publicar a Edge Function no projeto Supabase de testes após confirmação da referência.
- [x] Executar pgTAP, Auth/Edge Function, Storage e E2E desktop/móvel no projeto ligado.
- [x] Executar o pipeline final, atualizar documentação e preparar o pull request.
- [x] Receber o resultado da validação manual e limpar a conta, ficheiros e registos temporários associados.
- [x] Corrigir o pré-processamento de fotografias e a recuperação idempotente da reposição de password.
- [ ] Obter aprovação explícita para merge; não iniciar a Fase 05 antes dessa decisão.

## Handoff para a fase seguinte

- Preservar o limite do domínio `admin`: componentes usam `AdminService`; Supabase, Storage e Edge Function permanecem no gateway.
- Manter `admin-users` com validação JWT e confirmação server-side de Owner ativo; nunca disponibilizar `service_role` ao frontend.
- Preservar idempotência e compensações entre Auth e PostgreSQL, bem como a imutabilidade da auditoria em operação normal.
- Manter fotografias no bucket privado e guardar apenas caminhos aleatórios, nunca URLs públicas permanentes.
- Antes de qualquer ensaio remoto, confirmar a referência ligada e usar apenas `node scripts/test-supabase-linked.mjs`, `node scripts/test-auth-supabase.mjs` e `node scripts/test-admin-supabase.mjs` com o fail-safe ativo.
- O PR #4 está pronto para merge, mas deve permanecer aberto até à decisão explícita do utilizador. A Fase 05 — Catálogo e Tesouraria — é a próxima e só começa depois desse merge autorizado.
