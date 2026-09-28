# Fase 08 — Testes, Segurança e Deploy

## Estado

- Estado: em curso — correção forward publicada e smoke independente aprovado; configuração Auth, secrets, Edge Function e Owner aguardam checkpoints próprios
- Responsável: equipa de engenharia
- Início: 2026-09-22
- Última atualização: 2026-09-28
- Dependências recebidas: Fase 07 e primeiro bloco da Fase 08 integrados em `main`; interface “Balneário Premium”, PWA online-first, gates locais e contratos funcionais existentes.
- Revisão: PR #8 integrado em `[COMMIT_SHOWCASE]`; PR #9 integrado por Squash and merge em `[COMMIT_SHOWCASE]`; continuação documental e operacional em `feature/ativacao-producao-final`.

## Objetivo

Endurecer a qualidade e a segurança do MVP Web/PWA, separar teste e produção, preparar backup e restauro, publicar o frontend numa URL HTTPS gratuita e validar a prontidão para um piloto real, sem iniciar trabalho de Capacitor, Android ou iOS.

## Escopo assumido

- Completar testes unitários, de integração, PostgreSQL/pgTAP, Auth, Admin/Storage/Edge Function e E2E.
- Validar integralmente RLS/RBAC, invariantes financeiras, idempotência e concorrência real.
- Auditar dependências, segredos, configuração, persistência, PWA, headers, acessibilidade e operação.
- Preparar ambientes separados para desenvolvimento, testes, preview e produção.
- Documentar e testar backup/restauro apenas num destino descartável autorizado.
- Configurar e publicar o frontend num fornecedor gratuito após decisão explícita.
- Executar smoke tests e preparar o piloto sem dados seed ou credenciais temporárias residuais em produção.

## Decisões tomadas

| Data       | Decisão                                                                                     | Justificação                                                                                        | Impacto                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 2026-09-22 | Criar a branch `feature/qualidade-seguranca-deploy` a partir de `main` no commit `9c1d4db`. | Isola a última fase do MVP e preserva o fluxo de revisão por pull request.                          | Nenhuma alteração é feita diretamente em `main`.                                                              |
| 2026-09-22 | Adotar Cloudflare Pages para o frontend.                                                    | Decisão explícita recebida para o fornecedor de alojamento.                                         | A preparação local usa o formato de configuração e de headers suportado pelo Pages.                           |
| 2026-09-22 | Fixar Node 24.19.0 para comandos locais e builds do Pages.                                  | Garante uma versão compatível e reproduzível; o Node 21.7.2 do sistema não serve o projeto.         | `.node-version` passa a definir o runtime esperado.                                                           |
| 2026-09-23 | Executar os ficheiros Vitest sem paralelismo e dar 3 segundos às esperas assíncronas da UI. | As falhas ocorriam apenas sob contenção, durante transformação e carregamento de rotas lazy.        | Três execuções integrais consecutivas passaram sem aumentar o timeout dos próprios testes.                    |
| 2026-09-23 | Usar o fallback SPA nativo do Pages, sem uma regra global `_redirects`.                     | Regras globais do Pages têm precedência sobre assets e poderiam intercetar JavaScript e CSS.        | A ausência de `404.html` ativa o fallback nativo sem afetar assets existentes.                                |
| 2026-09-23 | Manter operações Cloudflare e Supabase suspensas no primeiro checkpoint.                    | A autorização inicial limitava-se a preparação, auditoria e testes locais.                          | O checkpoint local foi revisto antes de qualquer teste remoto.                                                |
| 2026-09-23 | Executar testes remotos apenas em `showcasetestref00001`, com inventário e limpeza.         | O projeto foi confirmado como descartável e exclusivo para testes.                                  | As mutações temporárias foram delimitadas por prefixos únicos, `finally` e asserção exata da linha de base.   |
| 2026-09-23 | Usar uma role e função PostgreSQL temporárias na prova de concorrência.                     | Duas instâncias passwordless da CLI rodam a credencial interna e não são concorrentes fiáveis.      | A credencial ficou apenas em memória; role, função, grants e dados foram removidos no `finally`.              |
| 2026-09-23 | Criar a produção em `showcaseprodref00001`, mantendo o vínculo local no projeto de testes.  | Separa definitivamente produção do projeto descartável e evita operações implícitas no alvo errado. | Todos os comandos de inventário e dry-run usam a referência explícita; nenhuma migração foi aplicada.         |
| 2026-09-23 | Preparar o deployment Supabase num worktree isolado e usar `--skip-vault`.                  | Preserva o vínculo local de testes e impede alterações implícitas de secrets durante `db push`.     | O comando final usa a referência de produção explícita e exclui seed, roles e Vault.                          |
| 2026-09-23 | Separar autorização e execução das seis operações restantes de produção.                    | URL Pages, Auth, CORS, Edge Function e bootstrap têm dependências e rollback diferentes.            | O preflight define gates, inventários e rollback por operação; nenhuma mutação remota foi executada.          |
| 2026-09-23 | Reprovar para publicação a Edge Function enquanto mantiver CORS `*`.                        | A origem final só fica conhecida após criar o Pages e CORS permissivo não é necessário.             | O checksum atual é apenas inventário; a autorização Edge exige novo bundle e checksum.                        |
| 2026-09-23 | Restringir a CSP do frontend exclusivamente ao Supabase de produção.                        | A referência de produção já é conhecida e previews continuam desativados.                           | Só HTTPS permite `showcaseprodref00001`; wildcard, WSS e projeto descartável são rejeitados em teste.         |
| 2026-09-23 | Manter a password mínima em seis caracteres até ao checkpoint Auth.                         | A política final requer decisão e autorização próprias.                                             | Nenhuma validação de password ou configuração Auth foi alterada neste checkpoint.                             |
| 2026-09-23 | Registar a ativação posterior numa branch e PR próprios.                                    | Separa a revisão do MVP das mutações operacionais autorizadas por checkpoints.                      | Após o merge do PR #8, usar `feature/ativacao-producao` e continuar o diário único da Fase 08.                |
| 2026-09-24 | Bloquear o signup apenas com `disable_signup=true`.                                         | `external_email_enabled` mantém o provider de email/password necessário ao login técnico.           | O provider permanece ativo; a reversão futura repõe apenas `disable_signup=false`, após nova autorização.     |
| 2026-09-24 | Manter previews Pages desativados e limitar a GitHub App a um repositório.                  | Previews não podem usar produção e a instalação deve minimizar o alcance no GitHub.                 | Só `main` publica; a instalação seleciona exclusivamente `JoaoMat10/caixinha-das-multas`.                          |
| 2026-09-28 | Substituir o fallback nativo por rotas explícitas e cache gerado pós-build.                 | O smoke real provou que um asset inexistente recebia o documento SPA e cache imutável.              | `404.html` bloqueia o fallback global; só rotas conhecidas reescrevem e só assets existentes ficam imutáveis. |
| 2026-09-28 | Tornar as variáveis públicas uma precondição do build Production/main.                      | Valores visíveis no painel não demonstram que chegaram ao processo Vite que produziu o bundle.      | A gate valida quatro variáveis sem expor a chave e não afeta desenvolvimento ou testes locais.                |
| 2026-09-28 | Aceitar o segundo deployment apenas após merge revisto e smoke independente.                | O primeiro deployment expôs duas falhas que exigiam correção forward comprovada antes da promoção.  | O frontend publicado contém a configuração pública correta e devolve 404 seguro para assets inexistentes.     |

## Trabalho realizado

### Preparação e Git

- Lidos integralmente `AGENTS.md`, as seis fontes obrigatórias, `docs/rls-rbac.md`, os diários das Fases 02 a 07 e o template de fase.
- Confirmado o merge da Fase 07 por fast-forward de `main` entre `c3d8bd1` e `9c1d4db`.
- Criada a branch `feature/qualidade-seguranca-deploy` a partir da árvore limpa.
- Consolidado o checkpoint local no commit `4b0a7a3` e aberto o PR #8 inicialmente em Draft, sem merge.
- Depois de concluir as gates locais de CSP, cache e documentação, publicado o commit `eba69ad` e colocado o PR #8 como Ready for review; nesse checkpoint, a branch ficou sete commits de implementação à frente de `main` e sincronizada com o remoto.
- O PR #8 foi integrado por Squash and merge no commit `[COMMIT_SHOWCASE]`; a working tree foi confirmada limpa, `main` foi atualizada exclusivamente por fast-forward de `origin/main` e o commit foi validado como `HEAD`.
- Criada `feature/ativacao-producao` diretamente dessa `main` atualizada. O trabalho continua neste mesmo diário e o novo PR permanece em Draft durante os checkpoints operacionais.
- O PR #9 foi integrado por Squash and merge em `main` no commit
  `[COMMIT_SHOWCASE]`. `main` foi atualizada por
  fast-forward e a continuação foi criada em `feature/ativacao-producao-final`,
  sem criar um segundo diário da Fase 08.
- Antes do checkpoint autorizado não existia qualquer recurso Cloudflare. O
  primeiro projeto e deployment foram depois criados nos termos registados
  abaixo; os dados Supabase temporários dos testes continuam integralmente
  removidos.

### Estabilização e pipeline local

- A causa das três falhas intermitentes foi isolada no custo combinado de 26 ambientes jsdom e no carregamento de rotas com `React.lazy`.
- `fileParallelism: false` remove a contenção entre ficheiros sem partilhar estado entre suites.
- O limite dos utilitários assíncronos do Testing Library passou de 1 para 3 segundos, exclusivamente para acomodar o carregamento dos módulos lazy em máquinas frias.
- A suite integral passou três vezes consecutivas com 88/88 testes.
- Criado `npm run verify`, que executa, por ordem, formatação, lint, tipos, Vitest, testes PostgreSQL embebidos e build.

### Cloudflare Pages

- Adicionados `.node-version` e `wrangler.toml`, sem variáveis, bindings ou referências a recursos externos.
- Fixados localmente o nome lógico `caixinha-das-multas`, o output `dist`, Node 24.19.0 e a data de compatibilidade do Pages.
- Adicionado `public/_headers` com CSP, HSTS, proteção contra framing e MIME sniffing, política de referência, política de permissões e cache específico para assets e PWA.
- Confirmado que `_headers` é copiado sem alterações para `dist` e que o build não contém source maps.
- O fallback SPA final usa `404.html` no topo e apenas nove rewrites explícitos;
  não existe uma regra global que intercepte assets.
- O pós-build gera regras imutáveis exatas apenas para os assets com hash que
  existem no `dist` final.
- Documentados build, variáveis públicas separadas, promoção, rollback e limites de autorização em `docs/operacao/deploy-cloudflare-pages.md`.

### Auditoria local de segurança

- `npm audit` inventariou 338 dependências e não encontrou vulnerabilidades conhecidas.
- A pesquisa no estado atual e em 35 commits não encontrou chaves privadas, JWTs completos nem tokens GitHub, AWS ou Supabase de alto privilégio.
- O frontend usa apenas URL e chave publicável Supabase; o teste estático rejeita nomes de segredos com prefixo `VITE_` e referências a `service_role` em `src` ou `public`.
- O teste estático rejeita `dangerouslySetInnerHTML`, `eval`, `new Function` e logging informativo no frontend.
- Todas as funções `security definer` pertencentes à aplicação mantêm `search_path` vazio e os privilégios de escrita financeira continuam limitados a RPCs.
- As tabelas administrativas internas foram incluídas na verificação de RLS e de ausência de `SELECT` para `authenticated`.
- O service worker mantém apenas pedidos `GET` da mesma origem em cache e exclui Supabase, Auth, REST, RPC e Storage.
- A sessão Auth continua persistida pelo SDK no browser; a CSP reduz a superfície de injeção, mas a validação efetiva dos headers depende de um futuro preview autorizado.

### RLS, RBAC, idempotência e concorrência local

- A matriz local passou a cobrir Owner, tesoureiro, capitão, jogador, staff, conta inativa, equipas distintas e época arquivada.
- Owner sem plantel mantém acesso administrativo, mas não financeiro; quando inscrito como jogador aparece no ranking sem expor privilégios globais.
- Capitão e staff não obtêm permissões administrativas ou de tesouraria.
- Staff com função de capitão recebe multiplicador máximo de 2x; a função de tesoureiro não altera o multiplicador base de 1x.
- Contas inativas deixam de obter contexto Auth e de ver equipas, multas ou rankings.
- Épocas arquivadas permanecem legíveis para membros autorizados, mas recusam novas multas e transições financeiras.
- Diretório e ranking não expõem username, email, identidade Auth ou estatuto Owner/Admin.
- Dois pedidos locais concorrentes com chaves diferentes para liquidar a mesma multa resultam num sucesso, uma rejeição, um batch e um log.
- `payment_batches`, `payment_logs` e `audit_events` recusam `UPDATE` e `DELETE`, incluindo quando a tentativa é feita fora do papel aplicacional.

### Execução remota de 2026-09-23

- Confirmada correspondência exata entre `SUPABASE_TEST_PROJECT_REF`, `supabase/.temp/project-ref` e o destino efetivo: `showcasetestref00001`.
- O dry-run remoto confirmou base atualizada e zero migrações, seeds ou roles pendentes.
- O inventário inicial registou 7 identidades Auth, 7 perfis, 8 memberships, 4 atribuições de roles, 6 multas, 2 batches, 2 logs, 0 objetos Storage e 0 perfis temporários.
- As 14 tabelas públicas tinham RLS ativo; as políticas e os triggers relevantes estavam ativos. A única função `SECURITY DEFINER` sem `search_path` vazio era `public.rls_auto_enable()`, gerida pela plataforma e ausente das migrações da aplicação.
- pgTAP passou 81/81 asserções em transações terminadas por `ROLLBACK`.
- O teste Auth funcional passou 9/9 cenários.
- A limpeza Auth falhou antes de eliminar a conta, ao inventariar o membership temporário através da API administrativa. Por instrução operacional, todos os testes seguintes foram interrompidos e não foi tentada uma segunda mutação.
- A auditoria read-only pós-falha registou 1 perfil `auth.test.217dfa2fa0`, 8 identidades Auth, 8 perfis, 9 memberships, 5 atribuições de roles, 6 multas, 2 batches, 2 logs e 0 objetos Storage. RLS permaneceu ativo em todas as tabelas.
- O diagnóstico confirmou que `service_role` tem `SELECT` em `public.users`, mas não nas tabelas protegidas; a rotina foi corrigida para validar essas tabelas pela ligação PostgreSQL sem alterar grants ou políticas.
- Após nova confirmação dos três refs e novo dry-run, a identidade/perfil/membership/role `auth.test.217dfa2fa0` foi eliminada de forma dirigida.
- A auditoria pós-limpeza regressou exatamente aos counts e fingerprints iniciais, com 7 identidades Auth, 7 perfis, 8 memberships, 4 roles, zero Storage e zero prefixos temporários; RLS, políticas, triggers e funções de segurança mantiveram o inventário original.
- A repetição Auth passou 9/9 e regressou imediatamente à linha de base.
- Admin/Auth/Storage/Edge Function passou 34 verificações, incluindo autorização Owner, negações, idempotência, auditoria, upload, leitura e remoção de fotografia; a limpeza regressou a `baseline_exact`.
- A prova financeira abriu duas sessões PostgreSQL independentes com uma role/função temporárias restritas: 1 pagamento passou, 1 foi rejeitado, e ficaram exatamente 1 batch e 1 log antes da limpeza.
- A primeira execução E2E passou 8/10; dois logins desktop frios excederam o timeout de 5 segundos, enquanto os mesmos cenários móveis passaram. O timeout de expectativas remotas foi fixado em 15 segundos.
- A repetição E2E passou 10/10: cinco cenários desktop e cinco Pixel 7, incluindo Auth, PWA, Admin, Storage, tesouraria e painel do membro.
- A auditoria final confirmou zero identidades/perfis temporários, zero memberships/roles/dados financeiros temporários, zero objetos Storage e zero roles/funções PostgreSQL de teste. Counts e fingerprints do seed, 14 tabelas RLS, 33 políticas, 18 triggers e 33 funções de segurança coincidem com o inventário inicial; `pgtap` e `dblink` não ficaram instaladas.

### Checkpoint inicial de produção de 2026-09-23

- Confirmada de forma read-only a disponibilidade de uma segunda vaga ativa no plano Free: a organização tinha um projeto ativo e três projetos inativos.
- O projeto `caixinha-showcase-producao` foi criado manualmente na organização `Organizacao Demo`, com referência `showcaseprodref00001`, região `eu-central-1` (Frankfurt), Postgres padrão e estado `ACTIVE_HEALTHY`.
- A password da base de dados foi gerada e guardada pelo responsável num gestor de passwords; não foi transmitida, impressa ou guardada no repositório.
- Data API ficou ativa, exposição automática de novas tabelas ficou desativada e RLS automático ficou ativo. GitHub não foi ligado.
- O vínculo local `supabase/.temp/project-ref` permaneceu em `showcasetestref00001` antes e depois de cada leitura de produção.
- O inventário inicial read-only encontrou zero tabelas públicas, zero identidades Auth, zero buckets, zero objetos e zero políticas em `public` ou `storage`.
- A função de plataforma `public.rls_auto_enable()` estava ativa; os sete event triggers da plataforma e os sete triggers não internos de Storage inventariados estavam ativos. `pgtap` e `dblink` não estavam instaladas.
- O dry-run explícito para produção indicou oito migrações pendentes, zero ficheiros seed e zero roles de configuração; nenhuma migração foi aplicada.
- A inspeção local do lote confirmou que as migrações criam 14 tabelas, 29 políticas públicas, um bucket privado `private-photos`, quatro políticas de Storage e duas linhas de referência de domínio (`captain` e `treasurer`). Estas linhas pertencem à migração versionada e não a `supabase/seed.sql` nem a fixtures.
- Não foram alterados schema, Auth, Storage, secrets, Edge Functions, utilizadores, dados financeiros, GitHub, Cloudflare ou deployments.

### Preflight das migrações de produção de 2026-09-23

- Criado o worktree isolado `production-preflight` no commit `[COMMIT_SHOWCASE]`, em detached HEAD e sem vínculo Supabase.
- Confirmado antes e depois do dry-run que o checkout principal permaneceu ligado a `showcasetestref00001` e o worktree isolado continuou sem `supabase/.temp/project-ref`.
- Reconfirmado read-only que `showcaseprodref00001` corresponde a `caixinha-showcase-producao`, em `eu-central-1`, com estado `ACTIVE_HEALTHY`.
- O novo dry-run, com `--project-ref showcaseprodref00001 --include-all --skip-vault`, devolveu as mesmas oito migrações e `seeds: []`, `roles: []`.
- Confirmada igualdade exata entre as 14 tabelas públicas criadas e as 14 tabelas com `ENABLE ROW LEVEL SECURITY`.
- Inventariadas 29 políticas públicas e quatro políticas de Storage; `private-photos` fica privado, limitado a 5 MiB e a JPEG, PNG e WebP.
- Revistos todos os `GRANT` e `REVOKE`: `anon` não recebe acesso, `authenticated` recebe apenas leitura de tabelas e execução das RPCs autorizadas, e as rotinas de identidade ficam exclusivas de `service_role`.
- As 32 funções `SECURITY DEFINER` finais da aplicação usam `search_path` vazio. A função automática de RLS da plataforma, propriedade de `postgres`, usa `search_path=pg_catalog` e o trigger `ensure_rls` está ativo; o total efetivo é 33.
- Calculados e registados checksums SHA-256 dos oito ficheiros; qualquer divergência antes da execução interrompe o processo.
- Preparada uma verificação SQL pós-migração estritamente read-only e documentado que o rollback é transacional por ficheiro, não global ao lote.
- Nenhuma migração, seed, role, secret, configuração Auth, bucket, política, função remota, utilizador ou dado foi criado neste preflight.

### Migrações de produção de 2026-09-23

- Imediatamente antes da execução, reconfirmado que `showcaseprodref00001` correspondia unicamente a `caixinha-showcase-producao`, em `eu-central-1`, com estado `ACTIVE_HEALTHY`.
- O worktree isolado estava limpo no commit `[COMMIT_SHOWCASE]`, sem vínculo Supabase; o checkout principal permaneceu ligado a `showcasetestref00001`.
- Os oito checksums SHA-256 coincidiram exatamente com o manifesto aprovado e o dry-run final prévio indicou oito migrações, `seeds: []` e `roles: []`.
- Uma única invocação `db push --project-ref showcaseprodref00001 --include-all --skip-vault` aplicou, por ordem, as oito migrações aprovadas.
- Não foram usados `--linked`, `db reset`, `--include-seed` ou `--include-roles`; não foram configurados Vault, Auth, secrets, Edge Functions, Owner, Cloudflare ou deployments.
- A auditoria read-only pós-migração devolveu todos os checks a `true`: oito migrações registadas, 14/14 tabelas com RLS, 29 políticas públicas, quatro políticas Storage, bucket `private-photos` privado e funções de segurança com `search_path` restrito.
- Confirmados zero identidades Auth, zero objetos Storage, apenas `captain` e `treasurer` em `public.roles` e zero linhas nas restantes tabelas da aplicação.
- O dry-run final devolveu `upToDate: true`, `migrations: []`, `seeds: []` e `roles: []`.

### Preflight conjunto de ativação de produção de 2026-09-23

- A leitura `config pull --dry-run` apontou explicitamente para `showcaseprodref00001` e devolveu `dry_run=true`, `wrote=false`; nenhum valor confidencial foi impresso.
- À data deste preflight conjunto, Auth tinha `disable_signup=false` e `external_email_enabled=true`. O estado corrente, após o checkpoint de 2026-09-24, é `disable_signup=true` e `external_email_enabled=true`; Site URL, redirects, confirmação de email, password e restantes campos permaneceram inalterados.
- O PR #8 está aberto e Ready for review, com merge state limpo. `eba69ad` fecha os sete commits de implementação da Fase 08 sobre `main`; o commit posterior corrige apenas documentação. `main` não pode ser usado num primeiro deployment antes da revisão e autorização de merge.
- A configuração Cloudflare foi fixada para o projeto proposto `caixinha-das-multas`, repositório `JoaoMat10/caixinha-das-multas`, branch `main`, Node 24.19.0, `npm run verify` e output `dist`; previews começam desativados.
- O estado local da Edge Function foi inventariado com checksums. O código atual continua com CORS `*` e ficou explicitamente reprovado para publicação até existir allowlist exata e novo checksum.
- Definido bootstrap sem mecanismo persistente: uma identidade criada manualmente, uma transação com lock e precondição de zero Owners, auditoria `owner.bootstrap` e mudança obrigatória de password.
- Definidos inventários, smoke tests, rollback e limpeza. Não foram alterados Cloudflare, GitHub, Auth, secrets, funções, identidades, dados ou Storage.
- O detalhe operacional está em `docs/operacao/preflight-producao-auth-edge-owner.md`.

### Gates locais para Cloudflare Pages de 2026-09-23

- A CSP deixou de aceitar `*.supabase.co` e passou a permitir exclusivamente `https://showcaseprodref00001.supabase.co` para imagens e ligações HTTPS; não existe funcionalidade Realtime que justifique WSS.
- `data:` e `blob:` foram removidos de `img-src`. O único estilo inline necessário é o da página offline e fica autorizado pelo seu hash SHA-256 exato; `unsafe-inline`, `unsafe-eval`, o projeto descartável e origens adicionais continuam proibidos.
- A política de cache ficou explícita para raiz, documentos HTML e rotas SPA conhecidas; assets com hash, ícones, manifest e service worker mantêm regras específicas.
- Os testes estáticos passaram a analisar todas as diretivas CSP como uma matriz exata e a validar individualmente todas as regras de cache.
- `npm run verify` passou integralmente com Node 24.19.0: Prettier, ESLint, TypeScript, 88/88 Vitest, 11/11 testes PostgreSQL embebidos e build Vite.
- A inspeção de `dist` confirmou `_headers` copiado byte a byte, zero wildcards Supabase, a origem HTTPS de produção, 22 assets com hash, dois documentos HTML, manifest e service worker, sem source maps.
- A password mínima permanece inalterada em seis caracteres e a decisão foi adiada para o checkpoint Auth.
- O trabalho posterior fica definido numa branch `feature/ativacao-producao`, criada apenas após o merge autorizado do PR #8, com um novo PR Draft e continuação deste diário; secrets e dados pessoais ficam excluídos.
- As gates locais estão concluídas no checkpoint técnico `eba69ad`, sete commits de implementação sobre `main`; o PR #8 está Ready for review e recebe depois apenas esta correção documental, sem merge ou deployment. Não foram alterados Cloudflare, Auth, secrets, Edge Functions ou Owner.

### Bloqueio do signup público de 2026-09-24

- O alvo `showcaseprodref00001` foi confirmado pelo registo versionado de produção, pelo inventário remoto de projetos e pelo `target.project_ref` do dry-run Auth.
- O projeto remoto corresponde a `caixinha-showcase-producao`, região `eu-central-1`, estado `ACTIVE_HEALTHY`.
- `config pull --dry-run` devolveu `dry_run=true` e `wrote=false`; o vínculo local permaneceu no projeto descartável `showcasetestref00001`.
- O inventário read-only confirmou `disable_signup=false`, `external_email_enabled=true`, confirmação de email ativa, Site URL local, redirects vazios, mínimo de 6 caracteres, alteração segura por email desativada e TOTP ativo.
- Corrigida a semântica de `external_email_enabled`: o campo mantém o provider de email/password necessário ao login por username técnico e não deve ser desligado.
- Após validar as duas precondições, foi executado um único `PATCH` para `showcaseprodref00001`, contendo exclusivamente `disable_signup=true`.
- Não será usado `config push`, evitando alterar Site URL, redirects, password, confirmação de email, TOTP, sessões ou qualquer outra diferença não autorizada.
- O segundo `GET` confirmou `disable_signup=true` e `external_email_enabled=true`; a comparação integral confirmou todos os restantes campos Auth inalterados.
- O dry-run final não escreveu ficheiros e a auditoria SQL read-only confirmou zero identidades Auth, zero objetos Storage, duas roles de referência e zero linhas nas restantes tabelas.
- A credencial da CLI permaneceu apenas em memória durante `GET → PATCH → GET`, não foi impressa nem persistida e foi removida imediatamente depois.
- A reversão futura repõe exclusivamente `disable_signup=false`, mediante nova autorização e seguida da mesma auditoria read-only.
- Não foram alterados Cloudflare, secrets, Edge Functions, Owner ou outros recursos.
- O procedimento detalhado foi acrescentado a `docs/operacao/preflight-producao-auth-edge-owner.md`.

### Preflight Cloudflare Pages de 2026-09-24

- Confirmados localmente `caixinha-das-multas`, `JoaoMat10/caixinha-das-multas`,
  `main`, raiz `/`, `npm run verify`, output `dist` e Node 24.19.0 fixado em
  `.node-version`.
- Os previews ficam em `None`, sem variáveis; apenas `main` pode gerar produção.
- As quatro variáveis públicas de produção foram delimitadas. Três valores estão
  fixos; a chave publicável Supabase será lida diretamente do painel e a URL
  `pages.dev` será confirmada pelo Pages antes do primeiro deployment.
- A GitHub App fica limitada por `Only select repositories` exclusivamente a
  `JoaoMat10/caixinha-das-multas`. As permissões individuais definidas pelo fornecedor
  não podem ser reduzidas na instalação e devem ser revistas antes de confirmar.
- O fluxo pelo dashboard requer apenas sessões interativas Cloudflare e GitHub;
  não exige API token, Global API Key ou autenticação Wrangler.
- Definidas verificações reais de build, URL, SPA, headers, cache, PWA, rede e
  ausência de previews, segredos e referências ao projeto descartável.
- O primeiro deployment não tem rollback anterior; uma falha de smoke exige
  pausar builds e correção forward. Deployments seguintes podem reverter para um
  deployment de produção aprovado.
- Não foram criados projeto, integração, variáveis ou deployments e não foi lida
  qualquer credencial Cloudflare.
- O detalhe operacional está em `docs/operacao/deploy-cloudflare-pages.md`.

### Primeiro deployment Cloudflare Pages de 2026-09-28

- Instalada a GitHub App oficial `Cloudflare Workers and Pages` com **Only select
  repositories**, exclusivamente para `JoaoMat10/caixinha-das-multas`.
- Criado `caixinha-das-multas` na conta pessoal inequívoca e confirmado o
  hostname exato `https://caixinha-showcase.pages.dev`.
- O único deployment, Production/main, publicou exclusivamente o commit
  `[COMMIT_SHOWCASE]`; ID
  `11111111-1111-4111-8111-111111111111`.
- O build confirmou Node 24.19.0 e concluiu `npm run verify`: Prettier, ESLint,
  TypeScript, 88/88 Vitest, 11/11 PostgreSQL embebidos e Vite para `dist`.
- Por limitação do formulário inicial, as quatro variáveis públicas ficaram
  transitoriamente nos dois ambientes durante o primeiro build autorizado.
  Logo após a conclusão, `Preview branch` foi guardado como `None`, as quatro
  variáveis foram removidas de Preview e confirmadas intactas em Production.
- O inventário contém zero deployments Preview executáveis e exatamente um
  deployment Production. O histórico inclui a entrada
  `22222222-2222-4222-8222-222222222222`, branch
  `feature/ativacao-producao`, commit
  `[COMMIT_SHOWCASE]`, marcada
  `skipped — No deployment available`: não publicou URL nem assets e não foi
  eliminada. Não foram configurados Web Analytics, domínio próprio, Workers,
  Access, deploy hooks, secrets ou serviços adicionais.
- O smoke HTTPS confirmou a URL, headers de segurança, CSP, cache dos documentos
  principais, assets existentes, manifest, service worker, página offline,
  ícones e rota profunda. O `GET` público Auth confirmou
  `disable_signup=true` e `external_email_enabled=true`.
- O smoke reprovou o rollout por dois motivos: o bundle não contém
  `VITE_SUPABASE_URL` nem `VITE_SUPABASE_PUBLISHABLE_KEY`, deixando a UI sem
  autenticação, e um asset inexistente sob `/assets/` recebe o HTML da SPA com
  cache imutável de um ano.
- Não foi executado um segundo deployment. O rollout fica pausado até existir
  uma correção forward revista, testada e autorizada separadamente.

### Correção forward local de 2026-09-28

- Causa 1: as quatro variáveis públicas estavam visíveis no painel Production,
  mas o bundle publicado não as continha. A visibilidade no painel não é
  evidência de que uma variável esteve disponível ao processo de build.
- Causa 2: o fallback SPA nativo, ativado pela ausência de `404.html`, devolvia
  `index.html` para qualquer caminho inexistente; a regra `/assets/*` acrescentava
  depois `immutable` à resposta incorreta.
- O build passa a executar uma gate apenas quando `CF_PAGES=1` e
  `CF_PAGES_BRANCH=main`. São obrigatórias as quatro variáveis `VITE_*`; URL
  canónica, referência `showcaseprodref00001` e formato `sb_publishable_…` são
  validados sem imprimir a chave. Fora deste contexto a gate não interfere com
  desenvolvimento e testes locais.
- Foi adicionado `404.html` no topo e `_redirects` contém apenas as nove rotas
  funcionais autorizadas. A raiz usa `index.html`; um `/assets/` desconhecido
  devolve `404`, sem o documento SPA.
- A regra genérica de cache foi removida. O pós-build recusa assets sem hash e
  gera no `_headers` final regras exatas apenas para os ficheiros efetivamente
  existentes em `dist/assets`.
- A verificação passou a ocorrer depois do build acabado e usa localmente
  `wrangler pages dev`, sem autenticação ou deployment. Confirma `_headers`,
  `_redirects`, `404.html`, rotas SPA, asset inexistente, source maps e segredos.
- `npm run verify` passou com Node 24.19.0: 27 ficheiros/99 testes Vitest,
  11/11 testes PostgreSQL, 22 assets com hash e 5/5 testes do Pages local.
- O rollout permanece pausado. Não houve alteração remota a Cloudflare,
  Supabase Auth, Edge Functions, secrets ou Owner, nem segundo deployment.

### Segundo deployment Cloudflare Pages de 2026-09-28

- O PR #9 foi integrado em `main` por Squash and merge no commit completo
  `[COMMIT_SHOWCASE]`; o merge desencadeou o segundo
  deployment Production previsto.
- O deployment terminou com sucesso e o smoke test independente foi aprovado.
- A reconfirmação pública read-only devolveu `200` para `/` e `/multas`, com o
  mesmo documento de entrada, e confirmou no bundle a referência
  `showcaseprodref00001` e uma chave no formato `sb_publishable_…`, sem expor o
  respetivo valor.
- `/assets/nao-existe.js` devolveu `404`, `Cache-Control: no-store` e não recebeu
  o shell da aplicação nem cache imutável.
- O frontend fica aprovado para prosseguir para a configuração Auth. Não foram
  alterados secrets, Edge Functions, identidades, Owner ou dados de utilização.

## Ficheiros criados ou alterados

| Ficheiro                                                          | Tipo de alteração | Motivo                                                                                            |
| ----------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `.node-version`                                                   | criado            | Fixar Node 24.19.0.                                                                               |
| `wrangler.toml`                                                   | criado            | Declarar configuração local do Cloudflare Pages.                                                  |
| `package.json`                                                    | alterado          | Adicionar `npm run verify`.                                                                       |
| `vite.config.ts`                                                  | alterado          | Executar ficheiros Vitest sem paralelismo.                                                        |
| `src/test/setup.ts`                                               | alterado          | Estabilizar esperas assíncronas de rotas lazy.                                                    |
| `playwright.config.ts`                                            | alterado          | Acomodar a latência real de autenticação nos E2E remotos.                                         |
| `public/_headers`                                                 | criado            | Definir CSP, headers de segurança e cache.                                                        |
| `public/_redirects`                                               | criado            | Reescrever exclusivamente as nove rotas funcionais conhecidas para a SPA.                         |
| `public/404.html`                                                 | criado            | Desativar o fallback SPA global para caminhos e assets inexistentes.                              |
| `scripts/validate-cloudflare-production-env.mjs`                  | criado            | Bloquear um build Production/main sem a configuração pública exata.                               |
| `scripts/finalize-pages-build.mjs`                                | criado            | Gerar regras de cache exatas a partir dos assets com hash do `dist` final.                        |
| `tests/scripts/deployment-security.test.mjs`                      | criado            | Validar configuração do Pages e garantias estáticas do frontend.                                  |
| `tests/scripts/cloudflare-production-env.test.mjs`                | criado            | Cobrir casos positivos, negativos e não exposição da chave na gate.                               |
| `tests/pages/pages-output.test.mjs`                               | criado            | Validar o output final e a semântica local do Pages com Wrangler.                                 |
| `tests/database/database.test.mjs`                                | alterado          | Completar matriz RLS/RBAC, imutabilidade, idempotência e concorrência local.                      |
| `tests/database/production-verification.test.mjs`                 | criado            | Aplicar localmente o manifesto sem seed e validar checksums e auditoria pós-migração.             |
| `scripts/supabase-auth-test-fixture.mjs`                          | alterado          | Garantir limpeza e validação SQL das tabelas protegidas.                                          |
| `scripts/test-concurrency-supabase.mjs`                           | criado            | Provar concorrência em duas sessões PostgreSQL independentes.                                     |
| `scripts/verify-supabase-test-cleanup.mjs`                        | criado            | Auditar identidades e perfis temporários após cada bloco.                                         |
| `scripts/sql/`                                                    | criado            | Inventariar e comparar exatamente a linha de base remota.                                         |
| `scripts/sql/supabase-production-initial-inventory.sql`           | criado            | Inventariar produção de forma read-only antes de qualquer migração.                               |
| `scripts/sql/supabase-production-post-migration-verification.sql` | criado            | Verificar read-only schema, RLS, políticas, Storage, privilégios e ausência de dados após o lote. |
| `docs/operacao/deploy-cloudflare-pages.md`                        | criado            | Documentar configuração, separação de ambientes, promoção e rollback.                             |
| `docs/operacao/supabase-production-preflight.md`                  | criado            | Registar alvo, checksums, políticas, privilégios, execução, verificação e rollback.               |
| `docs/operacao/preflight-producao-auth-edge-owner.md`             | criado            | Registar o preflight conjunto de Pages, Auth, secrets, Edge Function, Owner e smoke test.         |
| `docs/fases/08-testes-seguranca-e-deploy.md`                      | criado            | Manter o diário único e contínuo da Fase 08.                                                      |

## Base de dados, contratos e migrações

- Migrações adicionadas: nenhuma neste checkpoint.
- Alterações de schema: nenhuma.
- Funções/RPCs/Edge Functions: nenhuma alteração.
- Políticas RLS: nenhuma alteração; os testes existentes foram alargados.
- Contratos públicos: adicionado apenas o comando de engenharia `npm run verify`.
- Compatibilidade e dados existentes: todas as mutações, roles, funções, extensões e ficheiros temporários foram removidos; o inventário remoto regressou exatamente à linha de base.
- Produção: as oito migrações foram aplicadas e verificadas em `showcaseprodref00001`; não foram executados seed, fixtures, roles de configuração ou criação de utilizadores.

## Testes e verificações

| Comando/cenário                                      | Resultado | Observações                                                                                      |
| ---------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------ |
| Pesquisa de segredos no estado atual e em 35 commits | passou    | Zero literais de alto risco encontrados; ficheiros locais ignorados não foram expostos.          |
| `npm audit --json`                                   | passou    | 0 vulnerabilidades conhecidas em 338 dependências.                                               |
| Suite Vitest integral, três repetições               | passou    | 88/88 em cada repetição; 26 ficheiros por execução.                                              |
| Testes de configuração e segurança estática          | passou    | 17/17; inclui fallback/cache e onze cenários da gate Cloudflare.                                 |
| Testes PostgreSQL embebidos                          | passou    | 11/11; inclui o manifesto de produção sem seed e a verificação pós-migração.                     |
| `npm run verify` com Node 24.19.0                    | passou    | Formatação, lint, tipos, 99 Vitest, 11 PostgreSQL, build e 5 testes Pages numa única cadeia.     |
| Inspeção de `dist` final                             | passou    | 22 regras exatas de assets, redirects, três HTML, manifest, service worker e 0 source maps.      |
| pgTAP remoto em transações com `ROLLBACK`            | passou    | 81/81 asserções de Admin, Auth, RLS/RBAC e base de dados.                                        |
| Supabase Auth real                                   | passou    | 9/9 cenários; login, password, contexto, inativação e logout.                                    |
| Admin/Auth/Storage/Edge Function real                | passou    | 34 verificações; fotografia temporária removida.                                                 |
| Concorrência PostgreSQL com duas sessões             | passou    | 1 sucesso, 1 rejeição, 1 batch e 1 log; role/função temporárias removidas.                       |
| E2E Chromium desktop e Pixel 7                       | passou    | 10/10 após estabilizar o timeout de autenticação remota em 15 segundos.                          |
| Auditoria final remota                               | passou    | Zero temporários e `baseline_exact` para dados, Storage, RLS, políticas, triggers e funções.     |
| Inventário inicial de produção                       | passou    | Zero tabelas públicas, Auth, buckets, objetos e políticas da aplicação.                          |
| Dry-run de migrações de produção                     | passou    | Oito migrações pendentes; zero seeds e roles de configuração; nenhuma alteração aplicada.        |
| Auditoria estática das oito migrações                | passou    | 14/14 tabelas com RLS, 29+4 políticas e 33/33 funções efetivas com `search_path` seguro.         |
| Dry-run isolado com `--skip-vault`                   | passou    | Alvo explícito de produção; oito migrações, zero seeds, zero roles e nenhum vínculo alterado.    |
| Pipeline equivalente a `npm run verify`, Node 24     | passou    | Prettier, ESLint, TypeScript, 88/88 Vitest, 11/11 PostgreSQL e build passaram.                   |
| Migrações de produção                                | passou    | Oito migrações aplicadas numa única invocação; zero seeds, roles, Auth ou dados de utilização.   |
| Auditoria read-only pós-migração                     | passou    | Todos os checks verdadeiros; 14/14 RLS, 29+4 políticas, bucket privado e base vazia.             |
| Dry-run final de produção                            | passou    | `upToDate: true`; zero migrações, seeds ou roles pendentes.                                      |
| Preflight read-only do bloqueio de signup            | passou    | Três fontes confirmaram `showcaseprodref00001`; dry-run sem escrita e payload mínimo definido.   |
| Bloqueio do signup global em produção                | passou    | `disable_signup=true`; provider email/password ativo; restantes campos Auth idênticos.           |
| Auditoria read-only após bloqueio                    | passou    | Zero Auth, zero Storage, duas roles de referência e zero linhas nas restantes tabelas.           |
| Preflight Cloudflare Pages                           | passou    | Configuração, permissões, URL, verificações, credenciais e rollback definidos sem mutações.      |
| Primeiro build Cloudflare Pages                      | passou    | Node 24.19.0, `npm run verify`, commit autorizado e deployment Production concluídos.            |
| Isolamento Preview                                   | passou    | `None`, zero variáveis e zero deployments executáveis; uma entrada `skipped`, sem URL ou assets. |
| Smoke HTTPS: headers, cache e PWA estática           | passou    | CSP e headers exatos; assets existentes, manifest, service worker, offline e ícones acessíveis.  |
| Smoke HTTPS: configuração pública Supabase           | falhou    | Bundle sem variáveis Vite; frontend apresenta autenticação não configurada.                      |
| Smoke HTTPS: asset inexistente                       | falhou    | Fallback devolve HTML com cache imutável para `/assets/nao-existe.js`.                           |
| Gate Cloudflare Production/main                      | passou    | Casos positivos e negativos; alvo e formato validados sem expor a chave.                         |
| Pages local sobre o `dist` final                     | passou    | 5/5; rotas explícitas, 404 de asset, cache exato, zero source maps e zero segredos.              |
| Segundo deployment Production                        | passou    | `main` em `d0c9ac8`; build concluído e smoke independente aprovado.                              |
| Smoke público após correção                          | passou    | Bundle com configuração pública; rota profunda 200; asset inexistente 404 sem cache imutável.    |

## Desvios ao planeamento

- A regra `_redirects` global inicialmente preparada foi removida antes do fecho
  do primeiro checkpoint. A correção forward reintroduz apenas nove regras
  estáticas exatas; nenhuma regra `/*` pode intercetar assets.
- O smoke real demonstrou que o fallback nativo também responde a assets
  inexistentes. Com a regra de cache `/assets/*`, esse HTML recebe cache imutável;
  a correção adiciona `404.html` e gera cache apenas para nomes com hash que
  existem no output final.
- A concorrência local usa chamadas intercaladas sobre PGlite; a prova remota complementar usou duas sessões PostgreSQL verdadeiramente independentes.
- A via passwordless da CLI não pode ser iniciada em paralelo porque cada processo roda a password da role interna `cli_login_postgres`. A prova passou a usar uma role e função de teste exclusivas, com validade curta, privilégios mínimos e remoção verificada.

## Riscos e limitações

- Elevado: o projeto Supabase de produção recebeu schema e políticas, mas ainda não tem Auth, secrets, Edge Function ou Owner; o projeto descartável nunca pode ser promovido.
- Baixo: o frontend corrigido está publicado e o smoke passou; o login só ficará
  operacional depois de concluir Auth, secrets, Edge Function e primeiro Owner.
- Baixo: a CSP está fixada exclusivamente ao Supabase de produção; previews permanecem desativados até existir uma CSP própria para o ambiente descartável.
- Médio: a Edge Function mantém CORS permissivo; o token JWT e a verificação Owner no servidor preservam a autorização, mas a origem deve ser restringida quando existirem hostnames definitivos.
- Baixo: `main` contém o squash do PR #9 em `[COMMIT_SHOWCASE]`; a continuação operacional permanece isolada numa nova branch.
- Baixo: o signup Auth global está bloqueado; o provider email/password permanece deliberadamente ativo para o login por username técnico.
- Médio: a política final de password permanece por decidir; o frontend e Auth continuam alinhados no mínimo atual de seis caracteres até ao checkpoint autorizado.
- Médio: o workflow GitHub Actions existente é parcial e o bloqueio histórico de faturação não foi reconfirmado nesta sessão.
- Baixo: o Pages confirmou Node 24.19.0 a partir de `.node-version`; o Node global
  desta máquina continua fora da versão autorizada e não deve ser usado.
- Baixo: o plano gratuito Supabase pode pausar por inatividade e não inclui backups automáticos nem SLA.

## Trabalho pendente

- [x] Estabilizar a suite web e criar um comando local único de verificação.
- [x] Completar localmente a matriz RLS/RBAC, financeira, de idempotência e concorrência intercalada.
- [x] Preparar localmente Cloudflare Pages, fallback SPA, cache e headers de segurança.
- [x] Reconfirmar, antes de qualquer teste remoto, que o alvo exclusivo é `showcasetestref00001` e apresentar operações, dados temporários e limpeza.
- [x] Retomar Auth e executar Admin/Storage/Edge Function e concorrência com sessões independentes após resolver a limpeza falhada.
- [x] Executar pgTAP remoto: 81/81 asserções com `ROLLBACK`.
- [x] Diagnosticar e limpar a identidade/perfil/membership/role `auth.test.217dfa2fa0`; confirmado regresso exato ao inventário inicial antes de retomar.
- [x] Executar E2E desktop, móvel e PWA num preview local de produção: 10/10.
- [x] Executar smoke tests dos headers, fallback, cache e PWA no hostname HTTPS de produção; duas falhas bloquearam o rollout.
- [x] Preparar e rever localmente a correção forward das variáveis Vite e do fallback de assets antes de pedir novo deployment.
- [x] Publicar a correção forward e obter smoke independente aprovado.
- [ ] Rever e reforçar o workflow apenas se GitHub Actions estiver operacional; caso contrário, manter o pipeline local documentado.
- [ ] Produzir procedimentos de backup/restauro, privacidade e resposta a incidente.
- [x] Criar o projeto Supabase de produção e confirmar nome, região, referência, inventário inicial e dry-run.
- [x] Aplicar apenas migrações versionadas em produção, sem `supabase/seed.sql`, após dry-run e autorização.
- [x] Apresentar o preflight das 29 políticas públicas, bucket privado, quatro políticas Storage, privilégios, funções de segurança e checksums.
- [x] Receber autorização final única e executar o lote coerente das oito migrações, incluindo RLS e Storage.
- [ ] Configurar Site URL, redirect e política final de password no Auth após autorização específica.
- [ ] Guardar secrets, publicar Edge Function e criar o primeiro Owner apenas após três autorizações independentes.
- [x] Ligar o repositório ao Cloudflare Pages, configurar preview/produção e executar o primeiro deployment autorizado.
- [x] Preparar o preflight conjunto de Pages, Auth, secrets, Edge Function, primeiro Owner e smoke test sem mutações remotas.
- [ ] Remover CORS `*`, separar o segredo HMAC da service role e recalcular o checksum do bundle antes de autorizar a Edge Function.
- [ ] Alinhar a validação do frontend com a política final de password antes de alterar Auth.
- [x] Desativar exclusivamente o signup público global em produção, mantendo o provider email/password e todos os restantes campos Auth inalterados.
- [x] Atualizar o preflight específico do Cloudflare Pages sem criar ou configurar recursos.
- [ ] Executar backup/restauro apenas entre ambientes autorizados e nunca sobre produção.
- [x] Abrir o PR #8, concluir os sete commits de implementação no checkpoint `eba69ad` e colocá-lo Ready for review; depois, corrigir apenas a deriva documental, sem merge ou deployment.

## Handoff para a fase seguinte

- Esta é a última fase do MVP Web/PWA; não existe handoff autorizado para Capacitor, Android ou iOS.
- Preservar integralmente RLS, contratos financeiros, snapshots, idempotência, logs imutáveis e isolamento por equipa e época.
- O projeto `showcasetestref00001` permanece exclusivamente descartável e nunca pode ser configurado como produção.
- Antes de qualquer operação remota, repetir a confirmação do alvo, listar comandos e mutações previstos, indicar reversibilidade e descrever a limpeza completa.
