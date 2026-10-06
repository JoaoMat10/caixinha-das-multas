# Fase 08 — Testes, Segurança e Deploy

## Estado

- Estado: em curso — frontend, Auth, secrets, Edge Function `admin-users` e primeiro Owner ativos; smoke autenticado concluído e gate de leitura da função classificada como não aplicável por desenho
- Responsável: equipa de engenharia
- Início: 2026-09-22
- Última atualização: 2026-10-06
- Dependências recebidas: Fase 07 e primeiro bloco da Fase 08 integrados em `main`; interface “Balneário Premium”, PWA online-first, gates locais e contratos funcionais existentes.
- Revisão: PR #8 integrado em `[COMMIT_SHOWCASE]`; PR #9 integrado em `[COMMIT_SHOWCASE]`; PR #10 integrado em `7cedae1`; PR #13 integrado em `fd38160`; PR #14 integrado em `4af0a33`; PR #15 integrado em `[COMMIT_SHOWCASE]`; preparação de portefólio no PR #16, branch `feature/documentacao-portfolio`, sem merge.

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

| Data       | Decisão                                                                                     | Justificação                                                                                                   | Impacto                                                                                                                 |
| ---------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2026-09-22 | Criar a branch `feature/qualidade-seguranca-deploy` a partir de `main` no commit `9c1d4db`. | Isola a última fase do MVP e preserva o fluxo de revisão por pull request.                                     | Nenhuma alteração é feita diretamente em `main`.                                                                        |
| 2026-09-22 | Adotar Cloudflare Pages para o frontend.                                                    | Decisão explícita recebida para o fornecedor de alojamento.                                                    | A preparação local usa o formato de configuração e de headers suportado pelo Pages.                                     |
| 2026-09-22 | Fixar Node 24.19.0 para comandos locais e builds do Pages.                                  | Garante uma versão compatível e reproduzível; o Node 21.7.2 do sistema não serve o projeto.                    | `.node-version` passa a definir o runtime esperado.                                                                     |
| 2026-09-23 | Executar os ficheiros Vitest sem paralelismo e dar 3 segundos às esperas assíncronas da UI. | As falhas ocorriam apenas sob contenção, durante transformação e carregamento de rotas lazy.                   | Três execuções integrais consecutivas passaram sem aumentar o timeout dos próprios testes.                              |
| 2026-09-23 | Usar o fallback SPA nativo do Pages, sem uma regra global `_redirects`.                     | Regras globais do Pages têm precedência sobre assets e poderiam intercetar JavaScript e CSS.                   | A ausência de `404.html` ativa o fallback nativo sem afetar assets existentes.                                          |
| 2026-09-23 | Manter operações Cloudflare e Supabase suspensas no primeiro checkpoint.                    | A autorização inicial limitava-se a preparação, auditoria e testes locais.                                     | O checkpoint local foi revisto antes de qualquer teste remoto.                                                          |
| 2026-09-23 | Executar testes remotos apenas em `showcasetestref00001`, com inventário e limpeza.         | O projeto foi confirmado como descartável e exclusivo para testes.                                             | As mutações temporárias foram delimitadas por prefixos únicos, `finally` e asserção exata da linha de base.             |
| 2026-09-23 | Usar uma role e função PostgreSQL temporárias na prova de concorrência.                     | Duas instâncias passwordless da CLI rodam a credencial interna e não são concorrentes fiáveis.                 | A credencial ficou apenas em memória; role, função, grants e dados foram removidos no `finally`.                        |
| 2026-09-23 | Criar a produção em `showcaseprodref00001`, mantendo o vínculo local no projeto de testes.  | Separa definitivamente produção do projeto descartável e evita operações implícitas no alvo errado.            | Todos os comandos de inventário e dry-run usam a referência explícita; nenhuma migração foi aplicada.                   |
| 2026-09-23 | Preparar o deployment Supabase num worktree isolado e usar `--skip-vault`.                  | Preserva o vínculo local de testes e impede alterações implícitas de secrets durante `db push`.                | O comando final usa a referência de produção explícita e exclui seed, roles e Vault.                                    |
| 2026-09-23 | Separar autorização e execução das seis operações restantes de produção.                    | URL Pages, Auth, CORS, Edge Function e bootstrap têm dependências e rollback diferentes.                       | O preflight define gates, inventários e rollback por operação; nenhuma mutação remota foi executada.                    |
| 2026-09-23 | Reprovar para publicação a Edge Function enquanto mantiver CORS `*`.                        | A origem final só fica conhecida após criar o Pages e CORS permissivo não é necessário.                        | O checksum atual é apenas inventário; a autorização Edge exige novo bundle e checksum.                                  |
| 2026-09-23 | Restringir a CSP do frontend exclusivamente ao Supabase de produção.                        | A referência de produção já é conhecida e previews continuam desativados.                                      | Só HTTPS permite `showcaseprodref00001`; wildcard, WSS e projeto descartável são rejeitados em teste.                   |
| 2026-09-23 | Manter a password mínima em seis caracteres até ao checkpoint Auth.                         | A política final requer decisão e autorização próprias.                                                        | Nenhuma validação de password ou configuração Auth foi alterada neste checkpoint.                                       |
| 2026-09-23 | Registar a ativação posterior numa branch e PR próprios.                                    | Separa a revisão do MVP das mutações operacionais autorizadas por checkpoints.                                 | Após o merge do PR #8, usar `feature/ativacao-producao` e continuar o diário único da Fase 08.                          |
| 2026-09-24 | Bloquear o signup apenas com `disable_signup=true`.                                         | `external_email_enabled` mantém o provider de email/password necessário ao login técnico.                      | O provider permanece ativo; a reversão futura repõe apenas `disable_signup=false`, após nova autorização.               |
| 2026-09-24 | Manter previews Pages desativados e limitar a GitHub App a um repositório.                  | Previews não podem usar produção e a instalação deve minimizar o alcance no GitHub.                            | Só `main` publica; a instalação seleciona exclusivamente `JoaoMat10/caixinha-das-multas`.                                    |
| 2026-09-28 | Substituir o fallback nativo por rotas explícitas e cache gerado pós-build.                 | O smoke real provou que um asset inexistente recebia o documento SPA e cache imutável.                         | `404.html` bloqueia o fallback global; só rotas conhecidas reescrevem e só assets existentes ficam imutáveis.           |
| 2026-09-28 | Tornar as variáveis públicas uma precondição do build Production/main.                      | Valores visíveis no painel não demonstram que chegaram ao processo Vite que produziu o bundle.                 | A gate valida quatro variáveis sem expor a chave e não afeta desenvolvimento ou testes locais.                          |
| 2026-09-28 | Aceitar o segundo deployment apenas após merge revisto e smoke independente.                | O primeiro deployment expôs duas falhas que exigiam correção forward comprovada antes da promoção.             | O frontend publicado contém a configuração pública correta e devolve 404 seguro para assets inexistentes.               |
| 2026-09-29 | Alterar apenas Site URL e redirects no Auth de produção.                                    | A URL canónica já foi validada e os restantes campos não pertencem a este checkpoint.                          | `GET → PATCH → GET` confirmou só os dois campos autorizados; mínimo de password permanece em 6.                         |
| 2026-09-29 | Exigir CORS exato e segredo HMAC próprio na `admin-users`.                                  | A service role não deve ser reutilizada para derivação e CORS `*` deixou de ser necessário.                    | A função falha fechada sem configuração, usa chaves modernas do runtime e fica pronta para revisão.                     |
| 2026-09-29 | Criar apenas os dois secrets customizados antes de publicar a função.                       | Separa configuração sensível, código e bootstrap em checkpoints reversíveis e auditáveis.                      | Os valores existiram apenas em memória; a função e as identidades permaneceram inalteradas.                             |
| 2026-09-29 | Usar uma única identidade `demo.admin` como Owner e futuro jogador.                       | Evita contas duplicadas e preserva a invisibilidade da permissão global no plantel.                            | O bootstrap exigirá `must_change_password=true`; a futura associação de jogador reutiliza o mesmo utilizador.           |
| 2026-09-29 | Publicar futuramente apenas `admin-users`, com versão atribuída pela plataforma.            | Produção ainda tem zero funções e não existe uma versão anterior que possa ser presumida ou reposta.           | O deploy usará alvo explícito, `--use-api`, um job e `verify_jwt=true`, sem prune nem publicação em lote.               |
| 2026-09-29 | Aceitar a versão 1 de `admin-users` como linha de base remota.                              | A tentativa única terminou com função ativa e o smoke sem dados passou.                                        | Qualquer nova versão, correção ou eliminação requer nova autorização; o Owner continuava ausente nesse checkpoint.      |
| 2026-09-29 | Fazer o primeiro Owner por identidade manual e transação SQL estritamente verificada.       | `admin-users` exige um Owner prévio e a service role não pode sair do Supabase.                                | O painel cria a única identidade; uma transação insere perfil, Owner e auditoria sem mecanismo persistente.             |
| 2026-09-29 | Concluir o bootstrap sem iniciar sessão.                                                    | Separa a criação administrativa do primeiro acesso e mantém o alcance autorizado mínimo.                       | Produção fica com uma identidade, perfil ativo, Owner e auditoria; `must_change_password=true` e zero sessões.          |
| 2026-09-29 | Fazer o primeiro acesso manual sem observar credenciais.                                    | A password deve permanecer exclusivamente entre o responsável, o browser e o Supabase Auth.                    | A auditoria posterior verifica a sessão e o contexto Owner apenas por flags, relações e contagens.                      |
| 2026-09-30 | Iniciar a comissão mensal em setembro e excluir agosto.                                     | A decisão funcional mais recente determina a primeira contabilização em 1 de outubro.                          | A comissão é fixa em 1,00 EUR, sem multiplicador, protegida e idempotente.                                              |
| 2026-09-30 | Preservar o multiplicador histórico indicado em cada multa de agosto.                       | As funções atuais do plantel não podem reescrever o contexto histórico.                                        | Óscar Rodrigues usa 2x; William Costa e Diogo Almeida usam 1x; as 18 multas ficam liquidadas.                                                    |
| 2026-09-30 | Permitir liquidar diretamente cada multa pendente na listagem da Caixa.                     | O fluxo anterior escondia a seleção até o tesoureiro filtrar primeiro um membro.                               | Cada multa pendente tem confirmação própria; a seleção em lote por membro permanece disponível.                         |
| 2026-10-01 | Dar prioridade integral à experiência móvel entre 320 e 430 px.                             | O uso real ocorre principalmente em telemóveis e revelou excesso de ações na navegação e formulários extensos. | A navegação, hierarquia, controlos táteis, feedback e páginas privilegiadas passam a ter comportamento móvel explícito. |
| 2026-10-06 | Preservar o repositório privado e o histórico integral durante a preparação do portefólio.  | Commits e pull requests reais demonstram evolução, revisão e correção incremental do produto.                  | A limpeza limita-se a ficheiros locais ignorados e artefactos regeneráveis; não existe reescrita de histórico.          |

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
- À data deste preflight conjunto, Auth tinha `disable_signup=false` e
  `external_email_enabled=true`. O estado corrente mantém
  `disable_signup=true` e `external_email_enabled=true`; desde 2026-09-29, Site
  URL e redirect apontam exclusivamente para o Pages, enquanto password,
  confirmação de email e restantes campos permanecem inalterados.
- O PR #8 está aberto e Ready for review, com merge state limpo. `eba69ad` fecha os sete commits de implementação da Fase 08 sobre `main`; o commit posterior corrige apenas documentação. `main` não pode ser usado num primeiro deployment antes da revisão e autorização de merge.
- A configuração Cloudflare foi fixada para o projeto proposto `caixinha-das-multas`, repositório `JoaoMat10/caixinha-das-multas`, branch `main`, Node 24.19.0, `npm run verify` e output `dist`; previews começam desativados.
- Nesse preflight, a Edge Function ainda tinha CORS `*` e ficou reprovada. O
  hardening local e os novos checksums foram concluídos em 2026-09-29; a função
  continua sem publicação remota.
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
- Não foi usado `config push`, evitando alterar Site URL, redirects, password,
  confirmação de email, TOTP, sessões ou qualquer outra diferença não
  autorizada.
- O segundo `GET` confirmou `disable_signup=true` e `external_email_enabled=true`; a comparação integral confirmou todos os restantes campos Auth inalterados.
- O dry-run final não escreveu ficheiros e a auditoria SQL read-only confirmou zero identidades Auth, zero objetos Storage, duas roles de referência e zero linhas nas restantes tabelas.
- A credencial da CLI permaneceu apenas em memória durante `GET → PATCH → GET`, não foi impressa nem persistida e foi removida imediatamente depois.
- A reversão futura repõe exclusivamente `disable_signup=false`, mediante nova autorização e seguida da mesma auditoria read-only.
- Não foram alterados Cloudflare, secrets, Edge Functions, Owner ou outros recursos.
- O procedimento detalhado foi acrescentado a `docs/operacao/preflight-producao-auth-edge-owner.md`.

### Site URL e redirect Auth de 2026-09-29

- As três fontes voltaram a confirmar exclusivamente `showcaseprodref00001`,
  `caixinha-showcase-producao`, `eu-central-1` e `ACTIVE_HEALTHY`; o dry-run
  devolveu `dry_run=true`, `wrote=false` e o vínculo local permaneceu em
  `showcasetestref00001`.
- O `GET` inicial confirmou `disable_signup=true`,
  `external_email_enabled=true`, Site URL em `http://localhost:3000` e redirects
  vazios.
- O único `PATCH` conteve `site_url=https://caixinha-showcase.pages.dev` e
  `uri_allow_list=https://caixinha-showcase.pages.dev/`.
- O segundo `GET` confirmou os dois valores exatos e a comparação integral
  confirmou todos os restantes campos Auth inalterados, incluindo password
  mínima de 6, confirmação de email, TOTP, sessões e rate limits.
- A credencial da CLI permaneceu exclusivamente em memória e foi libertada após
  a verificação. Não foram alterados secrets, Edge Function, identidades, Owner
  ou dados de utilização.

### Hardening local da Edge Function de 2026-09-29

- `admin-users` passou a exigir `ADMIN_ALLOWED_ORIGINS`, a rejeitar pedidos sem
  `Origin` ou fora da allowlist e a devolver a origem exata com `Vary: Origin`.
- `ADMIN_PASSWORD_RESET_SECRET`, com pelo menos 32 bytes, substitui a chave
  elevada como segredo HMAC da reposição idempotente de password.
- A função passou a consumir os dicionários modernos
  `SUPABASE_PUBLISHABLE_KEYS` e `SUPABASE_SECRET_KEYS` injetados pelo runtime;
  a chave elevada é enviada apenas em `apikey`, nunca como JWT em
  `Authorization`, e nenhuma chave entra no frontend, Git ou logs.
- `[functions.admin-users] verify_jwt = true`, a validação de utilizador e a
  autorização Owner permanecem obrigatórias.
- Esta preparação é exclusivamente local: não foram guardados secrets nem
  publicada a Edge Function.

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

### Secrets da Edge Function de 2026-09-29

- O alvo foi reconfirmado por três fontes: registo versionado, projeto
  `caixinha-showcase-producao` ativo em `eu-central-1` e dry-run com
  `target.project_ref=showcaseprodref00001`, `dry_run=true` e `wrote=false`.
  O vínculo local permaneceu em `showcasetestref00001`.
- O inventário inicial tinha zero secrets customizados. Foram criados apenas
  `ADMIN_ALLOWED_ORIGINS` e `ADMIN_PASSWORD_RESET_SECRET`; a resposta foi `201`
  e a leitura posterior encontrou exatamente esses dois nomes.
- O segredo de reset usa 48 bytes criptograficamente aleatórios. Access token e
  valores permaneceram apenas em memória e foram removidos no fim; não houve
  argumentos `NAME=VALUE`, ficheiros `.env`, valores em logs ou persistência no
  repositório.
- Não foram alterados os nomes reservados `SUPABASE_*`, Auth, Cloudflare, dados,
  identidades ou Owner. A Edge Function não foi publicada.
- O futuro primeiro Owner reutilizará uma única identidade Auth com username
  `demo.admin`; a mesma identidade poderá ser associada como jogador, sem
  revelar a permissão global aos membros e sem criar uma segunda conta.

### Preflight read-only da Edge Function de 2026-09-29

- As três fontes voltaram a confirmar `showcaseprodref00001`; o projeto está
  `ACTIVE_HEALTHY` em `eu-central-1`, o dry-run não escreveu e o vínculo local
  continua no descartável `showcasetestref00001`.
- A produção contém zero Edge Functions. O candidato chama-se `admin-users`; a
  versão e o deployment ID só serão atribuídos pelo Supabase no primeiro deploy.
- `verify_jwt=true` está versionado e o comando preparado publica apenas esta
  função com `--use-api --jobs 1`, sem `--no-verify-jwt`, `--prune`, import map,
  secrets ou vínculo implícito.
- O diff de código face a `main` contém exatamente quatro ficheiros: dois novos
  (`adminCors.ts`, `supabaseRuntimeKeys.ts`) e dois modificados
  (`adminPasswordReset.ts`, `admin-users/index.ts`). `username.ts` e
  `config.toml` são dependências sem diff; os seis checksums permanecem iguais ao
  inventário aprovado.
- O CORS aceita exclusivamente `https://caixinha-showcase.pages.dev`, falha
  fechado sem origem/configuração, devolve `Vary: Origin` e nunca usa wildcard.
- Os dois secrets customizados usam o checkpoint 0→2 já verificado. A listagem
  não foi repetida porque a CLI carrega também o campo interno `value`; nenhum
  valor foi relido ou apresentado.
- Passaram quatro ficheiros/29 testes dirigidos, TypeScript e
  `git diff --check`, com Node 24.19.0. Não houve publicação, criação de Owner,
  identidade ou dado.

### Publicação da Edge Function de 2026-09-29

- As gates foram repetidas imediatamente antes do comando único: três fontes do
  alvo, zero funções, checksum aprovado, `verify_jwt=true`, branch sincronizada e
  working tree limpa.
- A CLI publicou `admin-users`. O formatador local do resumo falhou depois da
  conclusão do comando; não houve nova tentativa. A leitura remota confirmou ID
  `33333333-3333-4333-8333-333333333333`, versão 1, estado `ACTIVE` e
  `verify_jwt=true`.
- A origem canónica passou o preflight CORS com `204`, origem exata,
  `Vary: Accept-Encoding,Origin` e `POST, OPTIONS`; uma origem estranha recebeu
  `403` sem ACAO.
- Um `POST` sem JWT recebeu `401` e `UNAUTHORIZED_NO_AUTH_HEADER` antes do
  handler, sem efeitos. O gateway acrescentou ACAO `*` à sua resposta genérica
  pré-handler; esta diferença da infraestrutura fica pendente de confirmação no
  futuro smoke com sessão real, sem enfraquecer a allowlist do handler.
- A auditoria SQL estritamente read-only confirmou zero Auth, perfis, Owners,
  auditoria, objetos Storage e dados de utilização; apenas `captain` e
  `treasurer` permanecem como referências.
- Não foram alterados Cloudflare, Auth, secrets, schema ou dados e não foi criado
  o Owner. A versão 1 é agora a linha de base; não foi executado rollback.

### Preflight read-only do primeiro Owner

- O alvo foi confirmado pelo registo versionado, por `projects list` e por
  `config pull --project-ref showcaseprodref00001 --dry-run`; as três fontes
  devolveram `showcaseprodref00001`. O vínculo local permaneceu no projeto de
  testes `showcasetestref00001`.
- O inventário confirmou zero `auth.users`, `auth.identities`, perfis, Owners,
  auditoria, dados de utilização e objetos Storage; as únicas referências são
  `captain` e `treasurer`.
- O email técnico determinista de `demo.admin` é
  `u-mrsw23zomfsg22lo@auth.caixinha.invalid`. Falta apenas confirmar o nome
  apresentado e preparar a password inicial fora do chat, no gestor de
  passwords.
- O mecanismo definido cria manualmente uma única identidade confirmada no
  painel e executa depois um bloco SQL transacional com advisory lock,
  precondições exatas, `public.users`, `public.app_admins`, auditoria
  `owner.bootstrap` e asserções antes do `COMMIT`.
- O perfil começa ativo, sem avatar, membership ou dados de domínio e com
  `must_change_password=true`. A futura associação como jogador reutilizará o
  mesmo UUID e terá checkpoint separado.
- O trigger de password, RLS e funções de contexto continuam ativos e com
  `search_path` restrito. A UI e a Edge Function não expõem promoção a Owner.
- O rollback anterior ao `COMMIT` é integral. Após o `COMMIT`, a auditoria
  imutável impede uma eliminação silenciosa; uma reversão autorizada desativa e
  bane a identidade, remove `app_admins` e preserva um evento compensatório.
- Este preflight não executou qualquer escrita, criação de conta, sessão, equipa,
  época, membership, multa, fotografia, alteração Auth, secret ou deployment.

### Bootstrap do primeiro Owner

- A única identidade Auth foi criada no painel com o email técnico determinista
  e uma password nova introduzida diretamente pelo responsável. Nenhum valor da
  password foi lido ou registado e não foi iniciada sessão.
- O inventário read-only imediatamente anterior confirmou uma identidade email
  confirmada, zero sessões/refresh tokens, zero dados públicos ou Storage, roles
  de referência exatas, RLS e trigger de password ativos.
- A transação foi executada uma única vez no alvo explícito
  `showcaseprodref00001`, com advisory lock, precondições integrais e asserções
  antes do `COMMIT`. O SQL Editor devolveu sucesso sem linhas.
- A auditoria pós-commit confirmou 1/1/1 para identidade, perfil ativo e Owner,
  um evento imutável `owner.bootstrap`, `must_change_password=true` e o mesmo
  UUID nos três contratos.
- Permanecem zero sessões, refresh tokens, equipas, épocas, memberships,
  categorias, multas, batches, logs, pedidos administrativos e objetos Storage;
  as referências continuam exclusivamente `captain` e `treasurer`.
- RLS, `auth_user_password_changed`, `private.sync_password_change()` e
  `public.get_auth_context()` permanecem ativos; as funções mantêm
  `security definer` e `search_path` restrito.
- Não houve erro, repetição, rollback, alteração de configuração Auth, secret,
  função, Cloudflare ou deployment. O primeiro login e a mudança de password
  exigem autorização própria.

### Primeiro acesso e mudança obrigatória de password

- O responsável introduziu diretamente na aplicação o username, a password
  inicial e a nova password. Nenhum desses valores foi observado, capturado ou
  registado.
- Depois da confirmação manual, foi executada uma única consulta SQL read-only,
  sem selecionar tokens, hashes, credenciais ou identificadores de sessão.
- A consulta confirmou `must_change_password=false`, uma única sessão ativa para
  o único utilizador, zero sessões de outras identidades e um refresh token sem
  ler o respetivo valor.
- A relação entre Auth, perfil e `app_admins` confirmou `isAppAdmin=true`; o
  perfil permanece ativo e não tem memberships.
- Continuam a existir zero equipas, épocas, memberships, categorias, multas,
  batches, logs, pedidos administrativos, fotografias e objetos Storage.
- `public.audit_events` continua com um único evento `owner.bootstrap`, porque
  o trigger de mudança de password atualiza a flag mas não cria auditoria
  pública adicional.
- RLS e o trigger de password permanecem ativos. Não foram alterados Cloudflare,
  configuração Auth, secrets, Edge Function ou quaisquer dados adicionais.

### Smoke autenticado read-only

- A sessão Owner já aberta foi reutilizada sem observar credenciais, tokens,
  storage do browser ou headers de autenticação e sem executar mutações.
- `/administracao` carregou e permaneceu autenticada após refresh. O resumo
  mostrou um utilizador ativo e zero equipas, épocas e membros ativos.
- A listagem apresentou apenas `Administrador Demo` (`@demo.admin`), ativo e sem
  fotografia. Equipas, épocas e plantéis permaneceram vazios; a auditoria
  mostrou exclusivamente `owner.bootstrap`.
- A route guard administrativa confirmou o contexto Owner (`isAppAdmin=true`).
  A navegação disponível sem membership ficou limitada a Administração e
  Definições de password.
- Não surgiram avisos ou erros na consola do frontend após refresh, consulta dos
  separadores e navegação autorizada.
- A listagem read-only da área administrativa é servida pela RPC
  `get_admin_overview`. O contrato local e publicado de `admin-users` não contém
  `list`; expõe apenas `create`, `update`, `set-active` e `reset-password`.
  A gate específica de leitura pela Edge Function é não aplicável nesta fase:
  duplicaria a RPC protegida e alargaria desnecessariamente um contrato composto
  exclusivamente por operações mutáveis.
- A evidência da função fica constituída pelos testes locais do handler e regras
  partilhadas, `verify_jwt=true`, smokes CORS e `401` sem efeitos, deployment
  remoto versão 1 em estado `ACTIVE` e smoke autenticado da área administrativa.
  Não foi executada qualquer operação mutável para fechar esta gate.
- `npm run verify` passou com Node 24.19.0: formatação, lint, typecheck, 29
  ficheiros/119 testes Vitest, 11/11 testes PostgreSQL, build e 5/5 testes Pages.
- O diff integral da branch face a `main` foi revisto e `git diff --check`
  passou. Com a gate corretamente classificada como não aplicável, o PR #10
  ficou pronto para revisão, sem merge.

## Importação inicial do plantel de produção

- Foi criado `scripts/populate-production-roster.mjs`, com preflight read-only
  por omissão e escrita apenas através de `--apply`.
- O manifesto e as credenciais ficam exclusivamente em `.manual-validation/`,
  ignorado pelo Git. `Fotos/` e `outputs/` também passaram a ser ignorados para
  impedir publicação acidental de dados pessoais.
- O alvo foi confirmado em três fontes como `showcaseprodref00001`; o vínculo
  local permaneceu em `showcasetestref00001`.
- O inventário anterior continha exatamente um Auth user, um perfil e um Owner,
  sem equipa, época, memberships, Storage ou dados financeiros.
- A execução criou 28 contas novas com passwords temporárias únicas, guardadas
  apenas no ficheiro local ignorado. Todas exigem mudança no primeiro acesso.
- O Owner existente `demo.admin` foi atualizado de Administrador Demo para Administrador Demo e associado como jogador com a camisola 21; não foi criada uma segunda
  identidade.
- Foram criadas a equipa ativa `Clube Desportivo Exemplo`, a época ativa `2026/2027` e 29
  memberships: 26 jogadores e 3 elementos da equipa técnica.
- Foram atribuídos cinco capitães — António Silva Almeida, Jorge Sousa, Óscar Rodrigues, William Costa e Diogo Almeida —
  e um tesoureiro, Jorge Sousa. O máximo de 2x continua a ser calculado pelos
  contratos existentes.
- Foram carregadas 28 fotografias no bucket privado e associadas aos perfis. A
  Mariana Ferreira permanece sem fotografia porque não foi fornecido ficheiro.
- A auditoria read-only independente confirmou 29 identidades Auth, 29 perfis
  ativos, 29 memberships, seis member roles, 28 objetos Storage e zero
  categorias, multas, batches ou logs de pagamento.
- Idade e nacionalidade da folha de recolha não fazem parte do modelo aprovado e
  não foram persistidas.

## Catálogo oficial e multas por minuto

- O catálogo oficial contém 23 categorias para a época `2026/2027` da equipa
  `Clube Desportivo Exemplo`.
- Foi acrescentado suporte opcional a um acréscimo por minuto na categoria e a
  snapshots de preço por minuto e minutos na multa.
- O cálculo da multa variável é executado no servidor sobre
  `(base + preço por minuto × minutos) × multiplicador`; o multiplicador máximo
  continua a ser 2x e abrange o total.
- Categorias fixas e multas históricas mantêm minutos a zero e não mudam de
  significado.
- A RPC de aplicação recusa uma categoria variável sem minutos positivos e
  recusa minutos numa categoria fixa. A idempotência também compara os minutos.
- A cópia de época preserva a configuração por minuto do catálogo.
- `scripts/populate-production-fine-catalog.mjs` valida alvo, equipa, época,
  plantel, tesoureiro e ausência de movimentos financeiros. O modo por omissão
  é read-only e `--apply` só aceita um catálogo vazio.
- A migração foi aplicada primeiro no projeto descartável
  `showcasetestref00001`, sem seed. A suite remota passou 85/85 asserções com
  `ROLLBACK`, incluindo quatro cenários novos de preço por minuto.
- A validação local passou 121 testes Vitest, 12 cenários PostgreSQL,
  TypeScript, lint e build de produção.
- O dry-run de produção confirmou exclusivamente a nova migração, sem seed ou
  roles. A migração foi aplicada em `showcaseprodref00001` e o importador criou
  as 23 categorias numa única transação.
- A auditoria final confirmou o catálogo exato, a categoria variável com
  `3,00 € + 0,10 €/min`, zero multas/batches/logs e zero migrações, seeds ou
  roles pendentes.

## Histórico de agosto e comissão mensal

- Criada uma categoria protegida `Comissão mensal sem multas`, fixa em
  `1,00 €`, sem minutos nem multiplicador e independente do catálogo normal.
- A operação `generate_monthly_commissions` aceita apenas meses concluídos a
  partir de setembro de 2026, exige um tesoureiro da época e é idempotente por
  membro, época e mês.
- A interface disponibiliza o cálculo do mês anterior apenas depois do seu
  fecho. A primeira execução possível é 1 de outubro de 2026, relativa a
  setembro.
- O importador transacional registou 18 multas de agosto e liquidou-as em 11
  batches, produzindo 18 logs imutáveis. Não criou qualquer comissão de agosto.
- `Óscar Rodrigues` foi resolvido para `oscar.rodrigues6`; a multa 16 de 3 de agosto usa
  multiplicador 2x. William Costa e Diogo Almeida mantêm 1x nas ocorrências de agosto.
- A auditoria detalhada confirmou membro, categoria, data, multiplicador,
  estado pago e histórico de pagamento para as 18 ocorrências. O total recebido
  é `37,00 €`.

## Correção da Caixa e da apresentação móvel

- A Caixa passou a apresentar `Marcar como paga` em cada multa pendente, mesmo
  quando o filtro está em `Todos os membros`. A confirmação usa a mesma RPC
  atómica e idempotente da liquidação em lote.
- A seleção e liquidação conjunta continua disponível depois de escolher um
  membro específico.
- A barra inferior móvel organiza agora ícone e texto verticalmente, incluindo
  contas que acumulam permissões de membro, tesoureiro e Owner.
- Inputs, botões, paginação e ações de formulários receberam limites e quebras
  responsivas para viewports estreitos; os diálogos passam a uma coluna abaixo
  de 360 px.
- Os diálogos de confirmação são montados diretamente no `body`, bloqueiam o
  scroll de fundo e ficam centrados no viewport mesmo quando a ação é iniciada
  no fim de uma página longa no iPhone.
- Os cartões do catálogo e da Caixa separam conteúdo, valor e ações em grelhas
  responsivas, evitando sobreposição e quebras irregulares em ecrãs estreitos.

## Auditoria UI/UX mobile-first

- A barra inferior apresenta no máximo quatro destinos principais e a ação
  `Mais`; os restantes destinos são movidos para uma folha móvel com rota ativa,
  bloqueio do scroll de fundo e fecho por seleção ou `Escape`.
- Todas as páginas funcionais usam um cabeçalho partilhado, reduzindo títulos
  duplicados e tornando a hierarquia visual consistente em ecrãs estreitos.
- Inputs e seletores usam 16 px no telemóvel para impedir zoom automático no
  iPhone; botões, checkboxes e ações principais têm alvos táteis entre 44 e
  48 px e o botão dourado mantém contraste escuro legível.
- No fluxo de multas, a aplicação de uma multa aparece antes do catálogo; notas
  e descrições longas usam áreas de texto e editar uma categoria desloca o foco
  visual para o formulário.
- Painel e Caixa compactam os resumos financeiros, destacam o recebido e mantêm
  o resultado das operações visível no topo enquanto o tesoureiro percorre a
  listagem.
- Administração usa separadores horizontais deslocáveis, ações empilhadas,
  cartões sem overflow e estados vazios claros em utilizadores, equipas,
  plantel e auditoria.
- Login e mudança de password permitem mostrar ou ocultar cada password sem
  reduzir o alvo tátil. O aviso de atualização PWA adapta-se a 320 px.
- A matriz autenticada detetou e eliminou o último overflow do Mural; as linhas
  do ranking apresentam o valor numa segunda linha em mobile. A execução final
  passou 10/10 percursos em Chromium desktop e móvel, com verificações a 320,
  390 e 430 px.
- Não foram alteradas regras financeiras, contratos PostgreSQL, RLS/RBAC,
  migrações, dados de produção ou integrações externas.

## Preparação para portefólio

- O repositório permanece privado e conserva integralmente commits, branches
  publicadas e pull requests. Não foi criado um repositório artificial sem
  histórico nem executada qualquer reescrita.
- Foi criado um guia técnico de portefólio que explica produto, arquitetura,
  frontend, PWA, autenticação, RLS/RBAC, modelo de dados, contabilidade,
  segurança, testes, deployment, decisões, limitações e preparação para
  entrevista.
- O `README.md` e o índice de documentação passaram a apontar para o guia e a
  refletir o estado publicado do MVP.
- Ficheiros operacionais privados foram movidos, sem eliminação, para um arquivo
  local fora do checkout. Dependências, caches, builds e relatórios ignorados
  foram removidos por serem regeneráveis.
- Não foram alterados código funcional, dados de produção, configuração remota,
  contratos, migrações ou recursos de infraestrutura.

## Ficheiros criados ou alterados

| Ficheiro                                                            | Tipo de alteração | Motivo                                                                                            |
| ------------------------------------------------------------------- | ----------------- | ------------------------------------------------------------------------------------------------- |
| `.node-version`                                                     | criado            | Fixar Node 24.19.0.                                                                               |
| `wrangler.toml`                                                     | criado            | Declarar configuração local do Cloudflare Pages.                                                  |
| `package.json`                                                      | alterado          | Adicionar `npm run verify`.                                                                       |
| `.gitignore`                                                        | alterado          | Impedir a publicação de fotografias, folhas locais e credenciais.                                 |
| `eslint.config.js`                                                  | alterado          | Excluir artefactos e fotografias locais das verificações de código.                               |
| `scripts/populate-production-roster.mjs`                            | criado            | Validar e importar contas, equipa, época, plantel, roles e fotografias com retoma segura.         |
| `scripts/populate-production-fine-catalog.mjs`                      | criado            | Validar e importar o catálogo oficial de 23 multas sem criar movimentos financeiros.              |
| `scripts/import-production-august-fines.mjs`                        | criado            | Importar e auditar as 18 multas pagas de agosto e criar a categoria mensal protegida.             |
| `supabase/migrations/20260930010000_support_per_minute_fines.sql`   | criado            | Guardar e calcular multas com acréscimo opcional por minuto, preservando contratos fixos.         |
| `supabase/migrations/20260930020000_create_monthly_commissions.sql` | criado            | Proteger e gerar comissões mensais fixas sem multiplicador a partir de setembro de 2026.          |
| `src/domains/fines/rules/monthlyCommission.ts`                      | criado            | Determinar o último mês concluído segundo o calendário de Lisboa.                                 |
| `src/domains/fines/rules/monthlyCommission.test.ts`                 | criado            | Cobrir a abertura em 1 de outubro e a mudança de ano.                                             |
| `src/app/financial/TreasuryPage.tsx`                                | alterado          | Permitir liquidação individual visível sem exigir filtro prévio por membro.                       |
| `src/app/financial/FinancialUi.tsx`                                 | alterado          | Conter inputs, cartões e botões em viewports móveis estreitos.                                    |
| `src/app/financial/FinesPage.tsx`                                   | alterado          | Empilhar ações e dimensionar controlos de forma responsiva.                                       |
| `src/app/layout/AppShell.tsx`                                       | alterado          | Limitar a navegação móvel direta, organizar destinos excedentes e bloquear o scroll da folha.     |
| `src/shared/components/PageHeader.tsx`                              | criado            | Uniformizar títulos e descrições das páginas funcionais.                                          |
| `src/app/admin/`                                                    | alterado          | Adaptar tabs, formulários, cartões, ações e estados vazios à utilização móvel.                    |
| `src/app/auth/`                                                     | alterado          | Adicionar controlos acessíveis para mostrar e ocultar passwords.                                  |
| `src/styles/index.css`                                              | alterado          | Reforçar navegação, alvos táteis, contraste, formulários, feedback e layouts entre 320 e 430 px.  |
| `src/shared/components/ConfirmDialog.tsx`                           | alterado          | Montar confirmações fora do conteúdo animado e bloquear o scroll de fundo.                        |
| `src/app/FinancialPage.test.tsx`                                    | alterado          | Cobrir a liquidação individual sem filtro de membro.                                              |
| `src/app/App.test.tsx`                                              | alterado          | Cobrir navegação móvel, folha Mais, bloqueio de scroll e visibilidade da password.                |
| `e2e/mobileLayout.ts`                                               | criado            | Validar ausência de overflow horizontal a 320, 390 e 430 px.                                      |
| `e2e/*.spec.ts`                                                     | alterado          | Aplicar a matriz móvel aos fluxos Auth, membro, multas, Caixa e Administração.                    |
| `docs/operacao/importacao-catalogo-multas-producao.md`              | criado            | Documentar preflight, aplicação e verificação do catálogo oficial.                                |
| `docs/operacao/importacao-historico-agosto.md`                      | criado            | Registar o mapa histórico, precondições, resultado e auditoria da importação.                     |
| `docs/operacao/importacao-plantel-producao.md`                      | criado            | Documentar execução, proteções, credenciais locais e resultado do primeiro plantel.               |
| `vite.config.ts`                                                    | alterado          | Executar ficheiros Vitest sem paralelismo.                                                        |
| `src/test/setup.ts`                                                 | alterado          | Estabilizar esperas assíncronas de rotas lazy.                                                    |
| `playwright.config.ts`                                              | alterado          | Acomodar a latência real de autenticação nos E2E remotos.                                         |
| `public/_headers`                                                   | criado            | Definir CSP, headers de segurança e cache.                                                        |
| `public/_redirects`                                                 | criado            | Reescrever exclusivamente as nove rotas funcionais conhecidas para a SPA.                         |
| `public/404.html`                                                   | criado            | Desativar o fallback SPA global para caminhos e assets inexistentes.                              |
| `scripts/validate-cloudflare-production-env.mjs`                    | criado            | Bloquear um build Production/main sem a configuração pública exata.                               |
| `scripts/finalize-pages-build.mjs`                                  | criado            | Gerar regras de cache exatas a partir dos assets com hash do `dist` final.                        |
| `tests/scripts/deployment-security.test.mjs`                        | criado            | Validar configuração do Pages e garantias estáticas do frontend.                                  |
| `src/shared/rules/adminCors.ts`                                     | criado            | Validar allowlist CORS e produzir headers exatos ou falhar fechada.                               |
| `src/shared/rules/adminCors.test.ts`                                | criado            | Cobrir origem autorizada, recusas e configuração inválida.                                        |
| `src/shared/rules/supabaseRuntimeKeys.ts`                           | criado            | Ler apenas as chaves modernas `default` injetadas no runtime Supabase.                            |
| `src/shared/rules/supabaseRuntimeKeys.test.ts`                      | criado            | Recusar chaves ausentes, inválidas ou no formato legado.                                          |
| `src/shared/rules/adminPasswordReset.ts`                            | alterado          | Exigir segredo HMAC próprio com pelo menos 32 bytes.                                              |
| `supabase/functions/admin-users/index.ts`                           | alterado          | Fechar CORS, separar HMAC e usar as chaves modernas do runtime.                                   |
| `tests/scripts/cloudflare-production-env.test.mjs`                  | criado            | Cobrir casos positivos, negativos e não exposição da chave na gate.                               |
| `tests/pages/pages-output.test.mjs`                                 | criado            | Validar o output final e a semântica local do Pages com Wrangler.                                 |
| `tests/database/database.test.mjs`                                  | alterado          | Completar matriz RLS/RBAC, imutabilidade, idempotência e concorrência local.                      |
| `tests/database/production-verification.test.mjs`                   | criado            | Aplicar localmente o manifesto sem seed e validar checksums e auditoria pós-migração.             |
| `scripts/supabase-auth-test-fixture.mjs`                            | alterado          | Garantir limpeza e validação SQL das tabelas protegidas.                                          |
| `scripts/test-concurrency-supabase.mjs`                             | criado            | Provar concorrência em duas sessões PostgreSQL independentes.                                     |
| `scripts/verify-supabase-test-cleanup.mjs`                          | criado            | Auditar identidades e perfis temporários após cada bloco.                                         |
| `scripts/sql/`                                                      | criado            | Inventariar e comparar exatamente a linha de base remota.                                         |
| `scripts/sql/supabase-production-initial-inventory.sql`             | criado            | Inventariar produção de forma read-only antes de qualquer migração.                               |
| `scripts/sql/supabase-production-post-migration-verification.sql`   | criado            | Verificar read-only schema, RLS, políticas, Storage, privilégios e ausência de dados após o lote. |
| `docs/operacao/deploy-cloudflare-pages.md`                          | criado            | Documentar configuração, separação de ambientes, promoção e rollback.                             |
| `docs/operacao/supabase-production-preflight.md`                    | criado            | Registar alvo, checksums, políticas, privilégios, execução, verificação e rollback.               |
| `docs/operacao/preflight-producao-auth-edge-owner.md`               | criado            | Registar o preflight conjunto de Pages, Auth, secrets, Edge Function, Owner e smoke test.         |
| `docs/fases/08-testes-seguranca-e-deploy.md`                        | criado            | Manter o diário único e contínuo da Fase 08.                                                      |
| `docs/portfolio-guia-tecnico-e-entrevista.md`                       | criado            | Explicar o projeto tecnicamente e preparar a sua apresentação em entrevista.                     |
| `README.md`                                                         | alterado          | Destacar o guia e atualizar o estado corrente do produto.                                        |
| `docs/README.md`                                                    | alterado          | Indexar o guia e atualizar o resumo da implementação.                                             |

## Base de dados, contratos e migrações

- Migrações adicionadas: nenhuma neste checkpoint.
- Alterações de schema: nenhuma.
- Funções/RPCs: nenhuma alteração neste checkpoint. A Edge Function
  `admin-users` mantém-se publicada e protegida em produção.
- Políticas RLS: nenhuma alteração; os testes existentes foram alargados.
- Contratos públicos: adicionado apenas o comando de engenharia `npm run verify`.
- Compatibilidade e dados existentes: todas as mutações, roles, funções, extensões e ficheiros temporários foram removidos; o inventário remoto regressou exatamente à linha de base.
- Produção: as oito migrações foram aplicadas e verificadas em `showcaseprodref00001`; não foram executados seed, fixtures, roles de configuração ou criação de utilizadores.

## Testes e verificações

| Comando/cenário                                      | Resultado | Observações                                                                                       |
| ---------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------- |
| Pesquisa de segredos no estado atual e em 35 commits | passou    | Zero literais de alto risco encontrados; ficheiros locais ignorados não foram expostos.           |
| `npm audit --json`                                   | passou    | 0 vulnerabilidades conhecidas em 338 dependências.                                                |
| Suite Vitest integral, três repetições               | passou    | 88/88 em cada repetição; 26 ficheiros por execução.                                               |
| Testes de configuração e segurança estática          | passou    | 17/17; inclui fallback/cache e onze cenários da gate Cloudflare.                                  |
| Testes PostgreSQL embebidos                          | passou    | 11/11; inclui o manifesto de produção sem seed e a verificação pós-migração.                      |
| `npm run verify` com Node 24.19.0                    | passou    | Formatação, lint, tipos, 99 Vitest, 11 PostgreSQL, build e 5 testes Pages numa única cadeia.      |
| Verificação antes da limpeza local, Node 24.19.0     | passou    | Formatação, lint, tipos, 126 Vitest, 13 PostgreSQL, build e 5 testes Pages.                        |
| Inspeção de `dist` final                             | passou    | 22 regras exatas de assets, redirects, três HTML, manifest, service worker e 0 source maps.       |
| pgTAP remoto em transações com `ROLLBACK`            | passou    | 81/81 asserções de Admin, Auth, RLS/RBAC e base de dados.                                         |
| Supabase Auth real                                   | passou    | 9/9 cenários; login, password, contexto, inativação e logout.                                     |
| Admin/Auth/Storage/Edge Function real                | passou    | 34 verificações; fotografia temporária removida.                                                  |
| Concorrência PostgreSQL com duas sessões             | passou    | 1 sucesso, 1 rejeição, 1 batch e 1 log; role/função temporárias removidas.                        |
| E2E Chromium desktop e Pixel 7                       | passou    | 10/10 após estabilizar o timeout de autenticação remota em 15 segundos.                           |
| Auditoria final remota                               | passou    | Zero temporários e `baseline_exact` para dados, Storage, RLS, políticas, triggers e funções.      |
| Inventário inicial de produção                       | passou    | Zero tabelas públicas, Auth, buckets, objetos e políticas da aplicação.                           |
| Dry-run de migrações de produção                     | passou    | Oito migrações pendentes; zero seeds e roles de configuração; nenhuma alteração aplicada.         |
| Auditoria estática das oito migrações                | passou    | 14/14 tabelas com RLS, 29+4 políticas e 33/33 funções efetivas com `search_path` seguro.          |
| Dry-run isolado com `--skip-vault`                   | passou    | Alvo explícito de produção; oito migrações, zero seeds, zero roles e nenhum vínculo alterado.     |
| Pipeline equivalente a `npm run verify`, Node 24     | passou    | Prettier, ESLint, TypeScript, 88/88 Vitest, 11/11 PostgreSQL e build passaram.                    |
| Migrações de produção                                | passou    | Oito migrações aplicadas numa única invocação; zero seeds, roles, Auth ou dados de utilização.    |
| Auditoria read-only pós-migração                     | passou    | Todos os checks verdadeiros; 14/14 RLS, 29+4 políticas, bucket privado e base vazia.              |
| Dry-run final de produção                            | passou    | `upToDate: true`; zero migrações, seeds ou roles pendentes.                                       |
| Preflight read-only do bloqueio de signup            | passou    | Três fontes confirmaram `showcaseprodref00001`; dry-run sem escrita e payload mínimo definido.    |
| Bloqueio do signup global em produção                | passou    | `disable_signup=true`; provider email/password ativo; restantes campos Auth idênticos.            |
| Auditoria read-only após bloqueio                    | passou    | Zero Auth, zero Storage, duas roles de referência e zero linhas nas restantes tabelas.            |
| Preflight Cloudflare Pages                           | passou    | Configuração, permissões, URL, verificações, credenciais e rollback definidos sem mutações.       |
| Primeiro build Cloudflare Pages                      | passou    | Node 24.19.0, `npm run verify`, commit autorizado e deployment Production concluídos.             |
| Isolamento Preview                                   | passou    | `None`, zero variáveis e zero deployments executáveis; uma entrada `skipped`, sem URL ou assets.  |
| Smoke HTTPS: headers, cache e PWA estática           | passou    | CSP e headers exatos; assets existentes, manifest, service worker, offline e ícones acessíveis.   |
| Smoke HTTPS: configuração pública Supabase           | falhou    | Bundle sem variáveis Vite; frontend apresenta autenticação não configurada.                       |
| Smoke HTTPS: asset inexistente                       | falhou    | Fallback devolve HTML com cache imutável para `/assets/nao-existe.js`.                            |
| Gate Cloudflare Production/main                      | passou    | Casos positivos e negativos; alvo e formato validados sem expor a chave.                          |
| Pages local sobre o `dist` final                     | passou    | 5/5; rotas explícitas, 404 de asset, cache exato, zero source maps e zero segredos.               |
| Segundo deployment Production                        | passou    | `main` em `d0c9ac8`; build concluído e smoke independente aprovado.                               |
| Smoke público após correção                          | passou    | Bundle com configuração pública; rota profunda 200; asset inexistente 404 sem cache imutável.     |
| Site URL e redirect Auth em produção                 | passou    | Três fontes; `GET → PATCH → GET`; apenas os dois campos autorizados mudaram.                      |
| Hardening local da Edge Function                     | passou    | 29 testes dirigidos; CORS exato, HMAC próprio, chaves modernas e `verify_jwt=true`.               |
| Pipeline local após hardening                        | passou    | Node 24.19.0; 29 ficheiros/119 Vitest, 11/11 PostgreSQL, build e 5/5 Pages.                       |
| Secrets customizados da Edge Function                | passou    | Três fontes; inventário 0→2; apenas os dois nomes autorizados; sem publish ou identidades.        |
| Preflight read-only da Edge Function                 | passou    | Alvo, zero funções, diff, checksums, JWT, CORS, comando, verificação e rollback confirmados.      |
| Publicação da Edge Function                          | passou    | Tentativa única; versão 1 ativa, JWT preservado, CORS validado e auditoria final com zero dados.  |
| Preflight read-only do primeiro Owner                | passou    | Três fontes, inventário vazio, identidade, transação, auditoria e rollback dirigido definidos.    |
| Bootstrap do primeiro Owner                          | passou    | Execução única; 1 Auth, 1 perfil ativo, 1 Owner, 1 auditoria e zero sessões ou dados de domínio.  |
| Primeiro acesso e mudança obrigatória de password    | passou    | `must_change_password=false`, 1 sessão ativa, Owner válido, zero memberships e dados adicionais.  |
| Smoke autenticado: sessão, Admin e inventário        | passou    | Refresh, único utilizador, Owner, navegação permitida, zero domínio e zero erros frontend.        |
| Leitura autenticada via Edge Function                | n/a       | Por desenho, `admin-users` é mutável; a UI consulta `get_admin_overview` por RPC.                 |
| Validação final local                                | passou    | Node 24.19.0; 119 Vitest, 11 PostgreSQL, build e 5/5 Pages; diff integral revisto.                |
| Dry-run do importador de plantel                     | passou    | Três fontes, inventário inicial exato, 29 membros, 28 contas novas, 5 capitães, 1 tesoureiro.     |
| Importação do plantel Clube Desportivo Exemplo                    | passou    | 29 Auth/perfis/memberships, 28 fotografias privadas e credenciais apenas no ficheiro ignorado.    |
| Auditoria read-only pós-importação                   | passou    | Conjuntos exatos; seis roles; Owner associado; zero categorias, multas, batches ou logs.          |
| Multas por minuto                                    | passou    | 121 Vitest, 12 PostgreSQL e 85/85 pgTAP remoto; frontend preparado para integração em `main`.     |
| Migração e catálogo oficial em produção              | passou    | 1 migração, 23 categorias exatas, regra variável confirmada e zero movimentos financeiros.        |
| Comissão mensal local                                | passou    | 123 Vitest e 13 PostgreSQL; agosto recusado e categoria protegida contra aplicação/edição normal. |
| Comissão mensal no Supabase descartável              | passou    | Migração isolada e 88/88 asserções pgTAP com rollback.                                            |
| Histórico de agosto em produção                      | passou    | 18 multas pagas, 11 batches, 18 logs, 0 comissões de agosto e total recebido de 37,00 EUR.        |
| Correção da Caixa e layout móvel                     | passou    | 124 Vitest, 13 PostgreSQL, lint, TypeScript, build, 5/5 Pages e 10/10 E2E; validação a 320 px.    |
| Auditoria UI/UX móvel local                          | passou    | 126 Vitest, 13 PostgreSQL, lint, TypeScript, build e 5/5 Pages; inspeção visual da autenticação.  |
| Matriz E2E móvel autenticada                         | passou    | 10/10 em desktop e mobile; 320, 390 e 430 px sem overflow e limpeza remota com zero temporários.  |

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

- Baixo: o projeto Supabase de produção tem schema, políticas, configuração
  Auth mínima, secrets, Edge Function e primeiro Owner; o projeto descartável
  nunca pode ser promovido.
- Baixo: o frontend, a Edge Function e o primeiro Owner estão ativos; o primeiro
  login e a mudança obrigatória de password foram concluídos.
- Baixo: a CSP está fixada exclusivamente ao Supabase de produção; previews permanecem desativados até existir uma CSP própria para o ambiente descartável.
- Baixo: a Edge Function está ativa na versão 1 com JWT e CORS validados e
  mantém um contrato exclusivamente mutável; a leitura administrativa permanece
  isolada na RPC `get_admin_overview`.
- Baixo: `main` contém o squash do PR #9 em `[COMMIT_SHOWCASE]`; a continuação operacional permanece isolada numa nova branch.
- Baixo: o signup Auth global está bloqueado; o provider email/password permanece deliberadamente ativo para o login por username técnico.
- Médio: a política final de password permanece por decidir; o frontend e Auth continuam alinhados no mínimo atual de seis caracteres até ao checkpoint autorizado.
- Médio: o workflow GitHub Actions existente é parcial e o bloqueio histórico de faturação não foi reconfirmado nesta sessão.
- Baixo: o Pages confirmou Node 24.19.0 a partir de `.node-version`; o Node global
  desta máquina continua fora da versão autorizada e não deve ser usado.
- Baixo: o plano gratuito Supabase pode pausar por inatividade e não inclui backups automáticos nem SLA.
- Médio: 28 passwords temporárias permanecem num ficheiro local ignorado até à
  distribuição. O ficheiro deve ser eliminado depois das mudanças obrigatórias.
- Médio: uma versão legacy da chave `service_role` foi apresentada integralmente
  pela CLI durante um diagnóstico local. O valor não foi persistido nem
  versionado e o importador usa apenas uma chave secreta moderna em memória, mas
  as chaves legacy devem ser rodadas ou desativadas num checkpoint próprio antes
  de um uso alargado.
- Baixo: a Mariana Ferreira está ativa sem fotografia; pode ser adicionada mais tarde
  pelo Owner sem alterar o plantel.
- Baixo: a comissão mensal é iniciada manualmente pelo tesoureiro depois do
  fecho do mês; todas as multas retroativas desse mês devem ser registadas antes
  do cálculo.

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
- [x] Configurar Site URL e redirect exato no Auth sem alterar os restantes campos.
- [ ] Decidir a política final de password; o mínimo permanece em 6.
- [x] Guardar exclusivamente os dois secrets customizados após autorização própria.
- [x] Publicar exclusivamente a Edge Function após autorização própria e validar sem dados.
- [x] Criar o primeiro Owner após autorização independente, sem iniciar sessão.
- [x] Executar o primeiro login e a mudança obrigatória de password, seguidos de
      auditoria read-only sem dados adicionais.
- [x] Classificar como não aplicável uma listagem na Edge Function: a leitura
      administrativa permanece na RPC protegida `get_admin_overview` e não será
      duplicada em `admin-users`.
- [x] Ligar o repositório ao Cloudflare Pages, configurar preview/produção e executar o primeiro deployment autorizado.
- [x] Preparar o preflight conjunto de Pages, Auth, secrets, Edge Function, primeiro Owner e smoke test sem mutações remotas.
- [x] Remover CORS `*`, separar o segredo HMAC da chave elevada e recalcular o checksum do bundle antes de autorizar a Edge Function.
- [ ] Alinhar a validação do frontend com a política final de password antes de alterar Auth.
- [x] Desativar exclusivamente o signup público global em produção, mantendo o provider email/password e todos os restantes campos Auth inalterados.
- [x] Atualizar o preflight específico do Cloudflare Pages sem criar ou configurar recursos.
- [ ] Executar backup/restauro apenas entre ambientes autorizados e nunca sobre produção.
- [ ] Rodar ou desativar as chaves legacy do projeto de produção num checkpoint
      próprio e validar novamente a aplicação e a Edge Function.
- [x] Importar a primeira equipa, época, contas, plantel, roles e fotografias em
      produção, preservando o Owner existente e zero dados financeiros.
- [x] Aplicar a migração por minuto e importar as 23 categorias em produção,
      sem seed nem movimentos financeiros.
- [x] Importar as 18 multas liquidadas de agosto, preservando os multiplicadores
      históricos e sem criar comissão nesse mês.
- [x] Preparar a comissão mensal fixa a partir de setembro, com primeira
      contabilização disponível em 1 de outubro.
- [x] Auditar e corrigir localmente a experiência móvel das páginas de
      autenticação, membro, multas, Caixa, Administração e definições.
- [x] Executar a matriz E2E autenticada a 320, 390 e 430 px no projeto
      descartável e confirmar zero identidades e perfis temporários no final.
- [x] Preparar o repositório privado para portefólio, preservando o histórico,
      arquivando dados locais privados e criando o guia técnico de entrevista.
- [x] Abrir o PR #8, concluir os sete commits de implementação no checkpoint `eba69ad` e colocá-lo Ready for review; depois, corrigir apenas a deriva documental, sem merge ou deployment.

## Handoff para a fase seguinte

- Esta é a última fase do MVP Web/PWA; não existe handoff autorizado para Capacitor, Android ou iOS.
- Preservar integralmente RLS, contratos financeiros, snapshots, idempotência, logs imutáveis e isolamento por equipa e época.
- O projeto `showcasetestref00001` permanece exclusivamente descartável e nunca pode ser configurado como produção.
- Antes de qualquer operação remota, repetir a confirmação do alvo, listar comandos e mutações previstos, indicar reversibilidade e descrever a limpeza completa.
