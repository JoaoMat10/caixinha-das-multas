# Preflight de ativação de produção

## Estado e limites

Este documento descreve a ativação do frontend, Auth, secrets, Edge Function,
primeiro Owner e smoke test. Regista também os checkpoints já executados; não
autoriza por si só novas mutações remotas.

- Supabase de produção: `showcaseprodref00001`.
- Supabase descartável de preview/testes: `showcasetestref00001`.
- Cloudflare Pages: `caixinha-das-multas` ligado exclusivamente a
  `JoaoMat10/caixinha-das-multas`; correção forward publicada e smoke independente
  aprovado.
- PR #8 integrado em `[COMMIT_SHOWCASE]`; PR #9
  integrado em `[COMMIT_SHOWCASE]`; continuação em
  `feature/ativacao-producao-final`.
- Produção contém exatamente uma identidade Auth, o perfil ativo
  `demo.admin`, uma atribuição Owner, uma sessão válida e o evento
  `owner.bootstrap`; não existem objetos Storage ou dados de utilização.
- Existem exclusivamente os secrets customizados `ADMIN_ALLOWED_ORIGINS` e
  `ADMIN_PASSWORD_RESET_SECRET`; os respetivos valores não são registados.
- A Edge Function `admin-users` está publicada na versão 1, ativa e com
  `verify_jwt=true`; o primeiro Owner concluiu o primeiro acesso e a mudança
  obrigatória de password.
- Não será executado `supabase/seed.sql` nem serão criadas fixtures.

## Gates obrigatórias

1. Gate concluída: PR #9 integrado, segundo deployment Production concluído e
   smoke independente aprovado.
2. Gate concluída localmente: CORS `*` foi substituído por uma allowlist exata,
   o HMAC foi separado da chave elevada e os checksums foram recalculados.
3. A política de password não foi alterada no bootstrap. O mínimo permanece em
   seis caracteres até existir decisão explícita; uma mudança para 12 exige
   primeiro alinhar o frontend e autorizar novo deployment.
4. Nenhuma etapa consome automaticamente a autorização da etapa seguinte.

## Registo do trabalho posterior

Depois do merge do PR #9, o trabalho de ativação continua em
`feature/ativacao-producao-final`, criada a partir de `main` no commit
`[COMMIT_SHOWCASE]`. Esta continuação regista apenas:

- hardening local necessário para Auth, CORS e Edge Function;
- checksums, comandos sem credenciais, inventários e resultados sanitizados;
- atualizações dos procedimentos operacionais e deste diário único da Fase 08.

Auth, qualquer nova alteração Cloudflare, secrets, publicação da função,
bootstrap e smoke test manterão autorizações remotas separadas. Secrets,
passwords, tokens, connection strings e dados pessoais nunca entram na branch,
commits, PR ou logs. O PR de continuação fica Draft durante as operações e só
será integrado depois do fecho do rollout.

## Ordem segura

1. Concluído: signup público global bloqueado, mantendo email/password ativo.
2. Concluído: Pages criado, previews desativados, correção publicada e smoke
   aprovado.
3. Concluído: Site URL e redirect Auth configurados; a password mínima permanece
   em 6 até decisão explícita.
4. Concluído: guardados os dois secrets customizados da Edge Function, sem
   publicar código.
5. Concluído: publicada `admin-users` com JWT e CORS restritos e smoke sem dados.
6. Concluído: executado o bootstrap transacional do primeiro Owner, mantendo
   `must_change_password=true` e zero sessões.
7. Concluído: primeiro login e mudança obrigatória de password, seguidos apenas
   da auditoria read-only autorizada.
8. Com autorização própria, executar os restantes smoke tests funcionais,
   remover os artefactos temporários autorizados e comparar o inventário final.

O signup público global já está bloqueado com `disable_signup=true`; o provider
email/password permanece ativo. O rollout Cloudflare do frontend está concluído;
qualquer novo deployment ou rollback exige novo checkpoint.

### Checkpoint Cloudflare Pages de 2026-09-28

- Projeto e hostname: `caixinha-das-multas` e
  `https://caixinha-showcase.pages.dev`.
- A GitHub App oficial ficou limitada por **Only select repositories** apenas a
  `JoaoMat10/caixinha-das-multas`.
- O único deployment é Production/main, ID
  `11111111-1111-4111-8111-111111111111`, no commit completo
  `[COMMIT_SHOWCASE]`.
- O build usou Node 24.19.0 e `npm run verify` terminou sem falhas: 88/88
  Vitest, 11/11 testes PostgreSQL embebidos e build `dist`.
- `Preview branch = None`; Preview ficou sem variáveis e não existe qualquer
  deployment Preview. Production mantém exclusivamente as quatro variáveis
  públicas aprovadas.
- O smoke real confirmou URL, CSP, headers, cache de HTML/assets/manifest e
  service worker, rota profunda, manifest, página offline e ícones. Confirmou
  ainda `disable_signup=true` e `external_email_enabled=true` por `GET` público.
- O rollout ficou pausado porque o primeiro bundle não contém
  `VITE_SUPABASE_URL` nem `VITE_SUPABASE_PUBLISHABLE_KEY`, deixando o frontend
  sem autenticação, e porque `/assets/nao-existe.js` devolve `index.html` com
  cache imutável de um ano. Não foi iniciado qualquer segundo deployment.

### Checkpoint da correção Pages de 2026-09-28

- O PR #9 foi integrado em `main` no commit
  `[COMMIT_SHOWCASE]` e desencadeou o segundo deployment
  Production.
- O build terminou com sucesso e o smoke independente passou.
- A leitura pública sanitizada confirmou a configuração Supabase de produção no
  bundle sem expor a chave, rota profunda funcional e `404` com `no-store` para
  um asset inexistente, sem o app shell.
- Secrets, Edge Function, identidades Auth, Owner e dados de utilização não foram
  alterados neste checkpoint.

## Cloudflare Pages

| Campo              | Valor                                |
| ------------------ | ------------------------------------ |
| Projeto            | `caixinha-das-multas`                |
| Repositório        | `JoaoMat10/caixinha-das-multas`           |
| Branch de produção | `main`                               |
| Diretório raiz     | `/`                                  |
| Comando de build   | `npm run verify`                     |
| Output             | `dist`                               |
| Node               | `24.19.0`, fixado em `.node-version` |

Variáveis públicas de produção:

- `VITE_APP_NAME`
- `VITE_PUBLIC_APP_URL`
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_PUBLISHABLE_KEY`

`VITE_PUBLIC_APP_URL` é a URL HTTPS canónica atribuída. A URL e a
chave publicável Supabase são públicas por definição; passwords, connection
strings, tokens, chaves secretas e `service_role` nunca entram no Pages.

Os previews permanecem desativados (`None`) e não recebem variáveis. A branch
`main` é a única branch de produção.

O output contém `404.html` de topo e nove rewrites exatos para as rotas
funcionais; não existe rewrite global. O pós-build gera cache imutável apenas
para os assets com hash realmente existentes. `_headers` mantém CSP, HSTS,
`nosniff`, bloqueio de framing, política de referência e de permissões; service
worker não tem cache persistente e manifest e página offline revalidam.

A CSP de produção autoriza apenas `showcaseprodref00001.supabase.co` em HTTPS.
Não aceita wildcards, WebSockets, `data:`, `blob:` nem a referência descartável;
previews permanecem desativados até terem uma política própria.

Rollback: selecionar no Pages o último deployment de produção aprovado. Um
preview não é alvo de rollback de produção. O rollback do frontend não altera
Supabase.

Ações manuais: autenticar no Cloudflare, autorizar a aplicação GitHub com
`Only select repositories` apenas para o repositório indicado, confirmar a
disponibilidade do nome, rever os valores públicos sem os colar no chat e
confirmar o primeiro deployment. O detalhe atualizado de permissões, URL,
verificações e rollback está em `docs/operacao/deploy-cloudflare-pages.md`.

## Supabase Auth

Leitura dry-run de `showcaseprodref00001`, sem escrita:

| Campo                                              | Estado após o checkpoint                 | Resultado                                |
| -------------------------------------------------- | ---------------------------------------- | ---------------------------------------- |
| Site URL                                           | `https://caixinha-showcase.pages.dev`  | alterado apenas no checkpoint autorizado |
| Redirects                                          | `https://caixinha-showcase.pages.dev/` | alterado apenas no checkpoint autorizado |
| Signup global (`disable_signup`)                   | desativado                               | alterado de `false` para `true`          |
| Provider email/password (`external_email_enabled`) | ativo                                    | mantido; necessário ao login técnico     |
| Confirmação de email                               | ativa                                    | sem alteração                            |
| Password mínima                                    | 6                                        | sem alteração; decisão continua pendente |
| Caracteres                                         | sem requisito remoto explícito           | sem alteração; decisão continua pendente |
| Alteração segura por email                         | desativada                               | sem alteração                            |
| TOTP                                               | ativo na plataforma                      | sem alteração                            |

### Checkpoint Auth executado em 2026-09-29

Foi aplicado um único `PATCH` explícito a `showcaseprodref00001`, contendo
apenas:

```json
{
  "site_url": "https://caixinha-showcase.pages.dev",
  "uri_allow_list": "https://caixinha-showcase.pages.dev/"
}
```

A origem e o caminho são exatos; não foram autorizados wildcards, localhost ou
URLs de preview. Antes da escrita, o registo versionado, `projects list` e
`target.project_ref` do dry-run confirmaram `showcaseprodref00001`; o vínculo
local permaneceu em `showcasetestref00001`. O primeiro `GET` confirmou
`disable_signup=true`, `external_email_enabled=true`, Site URL local e redirects
vazios.

O segundo `GET` confirmou os valores finais e a comparação integral provou que
confirmação de email, TOTP, JWT, refresh tokens, sessões, rate limits, alteração
segura por email, providers e todos os restantes campos permaneceram idênticos.
A password mínima continua em 6 até decisão explícita. Não foi usado
`config push`, nem foram alterados secrets, função, identidades ou dados.

Reversão, apenas com nova autorização: repor `site_url` em
`http://localhost:3000` e `uri_allow_list` vazio, novamente com comparação
integral `GET → PATCH → GET`.

O frontend envia sempre `current_password` na mudança. Ativar um fluxo que
envie nonce por email bloquearia utilizadores porque os emails técnicos não são
endereços entregáveis.

JWT: 3600 segundos. Rotação de refresh token: ativa, com intervalo de reutilização
de 10 segundos. O SDK persiste a sessão no `localStorage`, atualiza o token e
não processa sessão pela URL. No plano Free, time-box, timeout de inatividade e
sessão única não estão disponíveis; as sessões duram até logout, mudança de
password, bloqueio ou revogação. RLS e a Edge Function verificam `is_active`,
reduzindo a janela de um JWT ainda válido após desativação.

Rate limits iniciais: manter os limites da plataforma e confirmá-los no painel
antes da escrita, incluindo 150 pedidos ao endpoint de token por 5 minutos por
IP e burst máximo de 30. Signup, OTP, magic links, recuperação por email,
telefone, OAuth e acesso anónimo ficam indisponíveis para o produto.

O login visível recebe username, normaliza-o e converte-o de forma determinista
para `u-<base32>@auth.caixinha.invalid`. Consequências: não existe recuperação
por email; criação e reposição são exclusivamente administrativas e server-side;
o email técnico nunca é mostrado na UI nem escrito em auditoria.

### Checkpoint isolado — bloqueio do signup público

O alvo foi confirmado em três fontes independentes:

1. o registo versionado de produção identifica `showcaseprodref00001` em
   `docs/operacao/supabase-production-preflight.md`;
2. `projects list` devolveu exatamente essa referência para
   `caixinha-showcase-producao`, em `eu-central-1`, com estado
   `ACTIVE_HEALTHY`;
3. `config pull --project-ref showcaseprodref00001 --dry-run` devolveu a mesma
   referência em `target.project_ref`, com `dry_run=true` e `wrote=false`.

Como controlo negativo, `supabase/.temp/project-ref` continua a apontar para o
projeto descartável `showcasetestref00001`; não existe vínculo local implícito a
produção.

O inventário read-only anterior à escrita confirmou:

- signup global permitido (`disable_signup=false`) e provider email/password
  ativo (`external_email_enabled=true`);
- confirmação de email ativa;
- `Site URL` em `http://localhost:3000` e lista de redirects vazia;
- password mínima de 6 caracteres e nenhum requisito remoto explícito de
  composição;
- alteração segura por email desativada;
- TOTP ativo para inscrição e verificação;
- frequência de email de 1 minuto e OTP de email com 8 algarismos;
- JWT de 3600 segundos, rotação de refresh token ativa e intervalo de
  reutilização de 10 segundos, conforme o inventário anterior desta fase.

A semântica foi corrigida antes da execução: `external_email_enabled` mantém o
provider de email/password usado pelo identificador técnico da aplicação. Não é
um interruptor adicional que possa ser desligado neste produto para bloquear o
auto-registo. O bloqueio global é feito exclusivamente por `disable_signup`.

A alteração autorizada e executada usou um único `PATCH` da Management API para
o alvo explícito e conteve exclusivamente:

```json
{
  "disable_signup": true
}
```

Não será usado `config push`, porque a configuração local contém diferenças de
Site URL, redirects, confirmação de email, alteração segura de password e TOTP
que não estão autorizadas neste checkpoint. A credencial de gestão será obtida
apenas de uma sessão local segura, nunca incluída no comando, Git, documentação
ou logs.

Verificação executada:

1. as três fontes confirmaram `showcaseprodref00001`,
   `caixinha-showcase-producao`, `eu-central-1` e `ACTIVE_HEALTHY`;
2. o primeiro `GET` confirmou as precondições `disable_signup=false` e
   `external_email_enabled=true`;
3. o `PATCH` enviou apenas `disable_signup=true`;
4. o segundo `GET` confirmou `disable_signup=true` e
   `external_email_enabled=true`;
5. a comparação canónica de todos os restantes campos Auth confirmou igualdade
   integral antes e depois;
6. o dry-run final devolveu `dry_run=true`, `wrote=false`, sem divergência no
   signup global e com o provider email/password ainda ativo;
7. a auditoria SQL read-only confirmou zero identidades Auth, zero objetos
   Storage, apenas `captain` e `treasurer` nas tabelas de referência e zero
   linhas nas restantes tabelas da aplicação;
8. `supabase/.temp/project-ref` permaneceu em `showcasetestref00001`.

O access token da CLI foi lido do Gestor de Credenciais apenas para
`GET → PATCH → GET`, permaneceu em memória, não foi impresso ou persistido e foi
removido da memória do processo imediatamente após o segundo `GET`.

Reversão, apenas mediante autorização explícita: enviar um `PATCH` para o mesmo
alvo contendo exclusivamente `{"disable_signup":false}` e repetir a mesma
verificação read-only. A reversão nunca altera `external_email_enabled`, Site
URL, redirects, password, confirmação de email, TOTP ou sessões.

## Edge Function `admin-users`

O bundle local atual é composto por:

| Ficheiro                                  | SHA-256 atual                                                      |
| ----------------------------------------- | ------------------------------------------------------------------ |
| `supabase/functions/admin-users/index.ts` | `4211B545A1BCE7BEBBEA7250842E629CA2581A118720C0F9CA83986C4168B267` |
| `src/shared/rules/username.ts`            | `1B4A7382D9B8C0F74AA59763420949498F5829D75E61E80D2F8E0AB718847845` |
| `src/shared/rules/adminPasswordReset.ts`  | `807D44D1A77633030DD2D6221483B8F4281B32B33F3E736FC3ACA67056672F3B` |
| `src/shared/rules/adminCors.ts`           | `C6473E818A24B57707DCA5660A29B657A60099B76B1D808503DBBE8C2B41E42E` |
| `src/shared/rules/supabaseRuntimeKeys.ts` | `7ED47D63654BF6E10C63DA7B33F174A22055F14032A5AC27D488385BB2726B44` |
| `supabase/config.toml`                    | `63C6574A39C4BADB3B24ACC9208489E38532000976C52667E96034A19319AD4A` |

O bundle local está aprovado para o checkpoint seguinte:

- aceita apenas origens exatas de `ADMIN_ALLOWED_ORIGINS`;
- rejeita sem efeitos pedidos sem `Origin` ou com origem não autorizada;
- devolve `Vary: Origin` e a origem exata nos preflights aceites;
- usa `ADMIN_PASSWORD_RESET_SECRET` com pelo menos 32 bytes como segredo HMAC;
- usa apenas `SUPABASE_PUBLISHABLE_KEYS` e `SUPABASE_SECRET_KEYS`, injetados pelo
  runtime, em vez das variáveis legadas;
- envia a chave elevada apenas em `apikey` e remove-a de `Authorization`, que
  fica reservado a JWTs reais;
- mantém respostas genéricas e zero logging de tokens, passwords ou secrets.

`[functions.admin-users] verify_jwt = true` permanece obrigatório. O handler
mantém a segunda camada: valida o utilizador Auth e exige `is_active=true` e
presença em `app_admins` antes de criar/alterar contas.

### Preflight read-only de publicação de 2026-09-29

Alvo reconfirmado sem escrita:

1. `docs/operacao/supabase-production-preflight.md` identifica
   `showcaseprodref00001` como produção;
2. `projects list` devolveu uma única correspondência com o nome
   `caixinha-showcase-producao`, região `eu-central-1` e estado
   `ACTIVE_HEALTHY`;
3. `config pull --project-ref showcaseprodref00001 --dry-run` devolveu
   `target.project_ref=showcaseprodref00001`, `dry_run=true` e `wrote=false`.

Como controlo negativo, `supabase/.temp/project-ref` continua em
`showcasetestref00001`. A listagem remota devolveu zero Edge Functions: não
existe versão anterior de `admin-users`. O primeiro número de versão e o
deployment ID serão atribuídos pela plataforma e só podem ser registados depois
de uma publicação bem-sucedida; não se presume antecipadamente `version=1`.

O candidato local chama-se `admin-users`, usa o entrypoint convencional
`supabase/functions/admin-users/index.ts` e mantém
`[functions.admin-users] verify_jwt = true`. O comando futuro não inclui
`--no-verify-jwt`, `--prune`, `--import-map`, secrets ou qualquer opção de
publicação em lote:

```powershell
.\node_modules\.bin\supabase.cmd functions deploy admin-users --project-ref showcaseprodref00001 --use-api --jobs 1 --output-format json
```

O deployment exige working tree limpa, branch remota sincronizada, repetição das
três confirmações e checksums idênticos aos desta tabela. `--use-api` limita a
operação ao bundle server-side da única função indicada, sem Docker e sem mudar o
vínculo local.

Diff exato de código face a `main`:

| Estado | Ficheiro                                  | Linhas    | Alteração                                                        |
| ------ | ----------------------------------------- | --------- | ---------------------------------------------------------------- |
| novo   | `src/shared/rules/adminCors.ts`           | `+73`     | allowlist CORS exata, `Vary: Origin` e falha fechada             |
| mod.   | `src/shared/rules/adminPasswordReset.ts`  | `+10/-1`  | segredo HMAC próprio com mínimo de 32 bytes                      |
| novo   | `src/shared/rules/supabaseRuntimeKeys.ts` | `+46`     | chaves modernas `default` e remoção da secret key de Bearer      |
| mod.   | `supabase/functions/admin-users/index.ts` | `+67/-36` | integra CORS, HMAC, runtime keys e respostas com origem validada |

`src/shared/rules/username.ts` e `supabase/config.toml` entram no bundle e na
configuração, mas não têm diff face a `main`. Os seis checksums são os registados
na tabela anterior e foram recalculados neste preflight.

Secrets necessários:

- customizados, já criados e verificados no checkpoint anterior:
  `ADMIN_ALLOWED_ORIGINS` e `ADMIN_PASSWORD_RESET_SECRET`;
- injetados pelo runtime, sem criação ou leitura manual:
  `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` e `SUPABASE_SECRET_KEYS`.

A CLI 2.117.0 não oferece uma projeção apenas de nomes e carrega um campo interno
`value` ao listar secrets. Este preflight não voltou a consultar esse endpoint:
usa o inventário 0→2 já verificado no checkpoint anterior, evitando reler ou
expor valores. O valor CORS aprovado é exclusivamente
`https://caixinha-showcase.pages.dev`; não existem wildcards, localhost ou
origens de preview.

Verificação posterior autorizável, sem criar dados:

1. capturar o resultado sanitizado do deploy e exigir slug `admin-users`;
2. executar `functions list` e exigir exatamente uma função, estado ativo,
   versão positiva e `verify_jwt=true`;
3. confirmar o endpoint
   `https://showcaseprodref00001.supabase.co/functions/v1/admin-users`;
4. enviar `OPTIONS` da origem canónica e exigir `204`, origem exata,
   `Vary: Origin` e apenas `POST, OPTIONS`;
5. enviar `OPTIONS` de uma origem não autorizada e exigir recusa sem
   `Access-Control-Allow-Origin`;
6. enviar `POST` sem JWT válido e exigir `401`, sem efeitos;
7. confirmar que continuam a existir zero identidades Auth, zero perfis/Owners e
   zero dados de utilização, e que não ocorreu qualquer alteração Cloudflare;
8. não executar ações funcionais de Owner até ao checkpoint separado.

Rollback e falhas:

- se o comando falhar e `functions list` continuar vazio, parar e preservar o
  diagnóstico; não repetir automaticamente;
- se surgir uma função não ativa ou o smoke falhar, parar, recolher apenas
  metadados/logs redigidos e não criar o Owner;
- por ser a primeira publicação, não existe versão anterior para restaurar. A
  correção preferida é um novo bundle revisto, sujeito a nova autorização;
- restaurar a linha de base de zero funções exigiria eliminar exatamente
  `admin-users`, uma ação destrutiva separada que nunca será executada sem nova
  autorização explícita.

Os testes dirigidos deste candidato passaram com Node 24.19.0: quatro ficheiros,
29 testes, TypeScript e `git diff --check`.

### Checkpoint de publicação executado em 2026-09-29

Imediatamente antes da tentativa única foram repetidas as três confirmações do
alvo, verificados zero deployments remotos, working tree limpa, branch
sincronizada, `verify_jwt=true` e o checksum aprovado
`4211B545A1BCE7BEBBEA7250842E629CA2581A118720C0F9CA83986C4168B267`.

Foi executado uma única vez o comando previsto. A CLI concluiu o deployment; o
bloco local que formatava o resumo falhou depois do comando por usar um literal
PowerShell incorreto. Não houve repetição. A consulta read-only posterior
confirmou inequivocamente:

| Campo              | Resultado                                 |
| ------------------ | ----------------------------------------- |
| ID                 | `33333333-3333-4333-8333-333333333333`    |
| slug/nome          | `admin-users`                             |
| versão             | `1`                                       |
| estado             | `ACTIVE`                                  |
| `verify_jwt`       | `true`                                    |
| import map         | `false`                                   |
| caminho de entrada | `supabase/functions/admin-users/index.ts` |

Smoke HTTP sem credenciais nem dados:

- `OPTIONS` da origem canónica devolveu `204`, ACAO exato,
  `Vary: Accept-Encoding,Origin` e `POST, OPTIONS`;
- `OPTIONS` de `https://example.invalid` devolveu `403` sem ACAO;
- `POST` sem JWT devolveu `401` e `UNAUTHORIZED_NO_AUTH_HEADER` antes do
  handler, sem qualquer efeito;
- nesse erro pré-handler, o gateway Supabase acrescentou ACAO `*`. Este header
  pertence à resposta genérica do gateway, não ao handler e não dá acesso a
  dados; as respostas alcançadas do handler mantêm a allowlist exata. Esta
  diferença de infraestrutura fica registada para o smoke com sessão real.

A auditoria pela rota oficial de SQL read-only confirmou zero `auth.users`, zero
`public.users`, zero `public.app_admins`, zero `audit_events`, zero objetos
Storage e zero linhas nas restantes tabelas da aplicação. Permanecem apenas as
duas roles de referência `captain` e `treasurer`.

Não foram alterados Cloudflare, Auth, secrets, Storage, schema ou dados. Não foi
criado o Owner. A versão 1 passa a ser a linha de base para futuras atualizações;
eliminar a função ou publicar uma correção continua a exigir autorização
separada.

### Checkpoint de secrets executado em 2026-09-29

- O runtime Supabase já injeta `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` e
  `SUPABASE_SECRET_KEYS`; estes nomes reservados não foram criados, lidos ou
  alterados neste checkpoint.
- Foi criado exclusivamente `ADMIN_ALLOWED_ORIGINS` com o valor exato
  `https://caixinha-showcase.pages.dev`.
- Foi criado exclusivamente `ADMIN_PASSWORD_RESET_SECRET` com 48 bytes
  aleatórios gerados criptograficamente e codificados em base64url; o valor não
  foi apresentado no chat ou logs.
- Antes da escrita, as três fontes confirmaram `showcaseprodref00001`, o dry-run
  devolveu `wrote=false`, o vínculo local permaneceu em
  `showcasetestref00001` e o inventário confirmou zero secrets customizados.
- A Management API respondeu `201`; a verificação read-only posterior exigiu e
  encontrou exatamente os dois nomes customizados. A CLI 2.117.0 não expôs um
  campo `digest` separado, pelo que nenhum campo de valor foi apresentado.
- Não foram usados argumentos `NAME=VALUE` nem ficheiros `.env`; o access token
  local e os valores existiram apenas na memória do processo, que foi limpa no
  final.

Nenhum valor entrou no Git, frontend, Pages, comandos mostrados, chat ou logs.
A criação dos secrets não publicou código. O futuro deployment usa o project ref
explícito e nunca `--no-verify-jwt`.

Reversão: eliminar ou rodar qualquer secret exige nova autorização. Depois da
primeira utilização, rodar `ADMIN_PASSWORD_RESET_SECRET` pode alterar a password
derivada para um replay ainda incompleto e exige avaliação operacional própria.

Teste funcional sem dados: CORS permitido/negado, ausência de JWT=401,
utilizador não autorizado=403 quando existir uma conta de teste autorizada para
esse teste, e Owner com ação inválida=400 depois das duas camadas de autorização.
Rollback: voltar a publicar o bundle anterior verificado; no primeiro publish,
uma remoção da função exige autorização destrutiva separada. Nunca há rollback
automático.

## Primeiro Owner

### Preflight read-only de bootstrap de 2026-09-29

O alvo foi reconfirmado sem escrita em três fontes independentes:

1. `docs/operacao/supabase-production-preflight.md` identifica
   `showcaseprodref00001` como produção;
2. `projects list` devolveu exatamente essa referência para
   `caixinha-showcase-producao`, região `eu-central-1`, estado
   `ACTIVE_HEALTHY`;
3. `config pull --project-ref showcaseprodref00001 --dry-run` devolveu
   `target.project_ref=showcaseprodref00001`, `dry_run=true` e `wrote=false`.

Como controlo negativo, `supabase/.temp/project-ref` continua em
`showcasetestref00001`; nenhum comando futuro pode usar `--linked`.

O inventário read-only confirmou:

| Objeto                             |           Estado atual |   Estado após o bootstrap |
| ---------------------------------- | ---------------------: | ------------------------: |
| `auth.users`                       |                      0 |                         1 |
| `auth.identities`                  |                      0 |       1, provider `email` |
| `public.users`                     |                      0 |                  1, ativo |
| `public.app_admins`                |                      0 |      1, para o mesmo UUID |
| `public.audit_events`              |                      0 | 1, ação `owner.bootstrap` |
| Equipas, épocas e memberships      |                      0 |                         0 |
| Categorias, multas, batches e logs |                      0 |                         0 |
| Pedidos administrativos            |                      0 |                         0 |
| Objetos Storage                    |                      0 |                         0 |
| `public.roles`                     | `captain`, `treasurer` |                inalterado |

O trigger `auth_user_password_changed` está ativo e chama
`private.sync_password_change()`. A função é `security definer`, usa
`search_path=''` e só muda `must_change_password` para `false` quando a password
da identidade é efetivamente alterada. `public.users`, `public.app_admins` e
`public.audit_events` mantêm RLS ativo; `get_auth_context()` usa igualmente
`security definer` e `search_path=''`.

### Identidade e campos necessários

| Campo                | Valor/estado                                                      |
| -------------------- | ----------------------------------------------------------------- |
| Projeto              | `showcaseprodref00001`                                            |
| Username             | `demo.admin`                                                    |
| Username normalizado | `demo.admin`                                                    |
| Email técnico Auth   | `u-mrsw23zomfsg22lo@auth.caixinha.invalid`                    |
| Nome apresentado     | **a indicar antes da escrita**                                    |
| Password inicial     | **a criar no gestor de passwords no momento autorizado**          |
| UUID                 | gerado pelo Supabase Auth e reutilizado nas duas tabelas públicas |
| Email confirmado     | `true`; o endereço técnico não recebe correio                     |
| Perfil ativo         | `is_active=true`                                                  |
| Troca obrigatória    | `must_change_password=true`                                       |
| Avatar               | `null`                                                            |
| Criado por           | o próprio UUID, apenas para este bootstrap inicial                |

A configuração Auth mantém o mínimo global de 6 caracteres e nenhum requisito
remoto explícito de composição. O frontend exige pelo menos 6 caracteres, uma
minúscula, uma maiúscula e um algarismo. Este checkpoint não altera essas
regras. Para a credencial inicial recomenda-se uma password aleatória com pelo
menos 16 caracteres que cumpra a validação do frontend.

### Mecanismo de bootstrap

O bootstrap será executado em duas partes deliberadamente limitadas, sem usar a
Edge Function — a função exige um Owner já existente — e sem levar a service
role para o frontend ou para a máquina local:

1. Repetir as três confirmações do alvo e o inventário completo imediatamente
   antes da primeira escrita. Abortar perante qualquer divergência.
2. No painel Supabase do projeto exato, em **Authentication → Users**, criar uma
   única identidade com o email técnico indicado, a password introduzida
   diretamente pelo responsável e email confirmado. Não enviar convite, não
   adicionar metadata e não iniciar sessão.
3. Ler apenas o UUID criado e confirmar `auth.users=1`, `auth.identities=1`,
   provider `email`, email técnico exato, identidade confirmada, não anónima,
   não banida e não eliminada. Todas as tabelas públicas continuam vazias.
4. No SQL Editor do mesmo projeto, executar um único bloco transacional. O bloco
   obtém `pg_advisory_xact_lock` com uma chave fixa de bootstrap, volta a exigir
   o inventário exato e recusa UUID, username, email ou nome apresentado
   divergentes.
5. Na mesma transação, inserir exatamente:
   - `public.users`: o UUID Auth, username e normalização exatos, nome
     apresentado, `avatar_path=null`, `must_change_password=true`,
     `is_active=true` e `created_by` igual ao próprio UUID;
   - `public.app_admins`: uma linha para o mesmo UUID;
   - `public.audit_events`: ação `owner.bootstrap`, entidade `user`, o mesmo UUID
     e metadata mínima sem email ou password.
6. Ainda antes do `COMMIT`, afirmar contagens, correspondência dos três UUIDs,
   flags do perfil, única ação de auditoria, duas roles de referência, zero
   equipas, épocas, memberships, dados financeiros, pedidos administrativos e
   objetos Storage. Qualquer falha lança exceção e reverte a transação inteira.
7. Após o `COMMIT`, executar apenas a mesma auditoria read-only. O resultado do
   checkpoint fica com uma identidade, um perfil ativo e um Owner;
   `must_change_password` permanece `true` e não existe sessão iniciada.

O bloco não cria funções, policies, triggers, roles, secrets, tokens, tabelas ou
um mecanismo persistente de bootstrap. Não usa `seed.sql`, não cria equipa,
época, membership, multa, fotografia ou uma segunda conta.

### Primeiro acesso e privacidade do Owner

O primeiro login será um checkpoint posterior. A aplicação transforma
`demo.admin` no email técnico, autentica por password e obtém um contexto com
`isAppAdmin=true`, `memberships=[]` e `mustChangePassword=true`. O route guard
permite apenas `/alterar-password-obrigatoria` até a password ser alterada com a
password atual. O trigger seguro passa então `must_change_password` para
`false`.

`app_admins` não é devolvida na listagem administrativa nem apresentada a
outros membros. A futura associação como jogador reutilizará este UUID e será
autorizada separadamente, depois de existirem equipa e época.

Não existe caminho público ou de utilizador comum para criar um segundo Owner.
As policies só permitem gerir `app_admins` a um Owner ativo e nem a UI nem
`admin-users` expõem promoção a Owner. Acesso direto privilegiado à base de
dados continuaria tecnicamente capaz de o fazer e permanece sujeito a uma nova
autorização operacional.

### Password sem exposição

O responsável deve gerar e guardar a password inicial no seu gestor de
passwords e introduzi-la diretamente no campo do painel. A password não será
pedida no chat, terminal ou SQL Editor, nem copiada para documentação, commits,
ficheiros, variáveis de ambiente ou logs. Depois da troca no primeiro acesso, a
entrada temporária deve ser substituída pela nova credencial no gestor; nenhuma
recuperação por email é possível para o endereço técnico.

### Rollback dirigido

- Se a criação Auth falhar, não existe alteração a reverter.
- Se a identidade for criada mas o bloco SQL não chegar a `COMMIT`, a transação
  deixa zero linhas públicas. O processo para e conserva apenas UUID e
  timestamp; eliminar essa identidade exata no painel exige nova autorização.
- Uma falha dentro do bloco SQL provoca `ROLLBACK` integral automático.
- Depois do `COMMIT`, o evento `owner.bootstrap` é imutável e referencia o
  perfil; uma eliminação integral exigiria enfraquecer temporariamente triggers
  e FKs e não faz parte deste procedimento. O rollback seguro pós-commit é uma
  compensação com nova autorização: registar `owner.bootstrap_revoked`, remover
  apenas a linha `app_admins`, marcar o perfil inativo, revogar sessões e banir
  a identidade Auth exata. Preserva-se assim a auditoria e elimina-se o acesso,
  mas não se regressa artificialmente a zero linhas.
- Nunca executar limpeza automática, apagar outra identidade ou repetir o
  bootstrap. Qualquer estado parcial é inventariado e apresentado antes de uma
  decisão.

### Checkpoint executado em 2026-09-29

O formulário do painel criou uma única identidade Auth para o email técnico já
definido, com confirmação administrativa. Foi usada uma password nova
introduzida diretamente no painel; o valor não foi lido, exibido, registado ou
persistido na documentação e não foi iniciada qualquer sessão.

Antes da transação, o inventário read-only confirmou exatamente:

- uma linha em `auth.users` e uma identidade do provider `email`, ambas para o
  email técnico esperado e com confirmação ativa;
- zero sessões e zero refresh tokens;
- zero perfis, Owners, auditoria, pedidos administrativos, dados de domínio e
  objetos Storage;
- apenas `captain` e `treasurer` em `public.roles`;
- RLS ativo em `users`, `app_admins` e `audit_events`, e o trigger de mudança de
  password ativo.

Foi executada uma única vez a transação autorizada, com advisory lock,
precondições repetidas e asserções antes do `COMMIT`. O SQL Editor devolveu
sucesso sem linhas. Não houve repetição, erro ou rollback.

A auditoria read-only pós-commit confirmou:

| Verificação                                 | Resultado                                     |
| ------------------------------------------- | --------------------------------------------- |
| `auth.users` / `auth.identities`            | 1 / 1, identidade email confirmada            |
| Sessões / refresh tokens                    | 0 / 0                                         |
| `public.users`                              | 1, `Administrador Demo`, ativo e sem avatar           |
| `must_change_password`                      | `true`                                        |
| `public.app_admins`                         | 1, para o mesmo UUID do perfil e Auth         |
| `public.audit_events`                       | 1, evento exato `owner.bootstrap`             |
| Metadata de auditoria                       | sem email ou password                         |
| Equipas, épocas e memberships               | 0                                             |
| Categorias, multas, batches e logs          | 0                                             |
| Pedidos administrativos                     | 0                                             |
| Objetos Storage                             | 0                                             |
| Roles de referência                         | apenas `captain` e `treasurer`                |
| RLS e trigger de password                   | ativos                                        |
| `sync_password_change` / `get_auth_context` | `security definer` com `search_path` restrito |

O checkpoint terminou sem login. O primeiro acesso, criação de sessão, mudança
de password, equipa, época, membership, fotografia e dados financeiros
continuam fora desta autorização.

### Primeiro acesso e mudança de password de 2026-09-29

O responsável introduziu manualmente as credenciais e a nova password na
aplicação publicada. Nenhum valor foi observado, capturado, transmitido para a
auditoria ou registado em logs e documentação. Não foi criada qualquer sessão
adicional pelo processo de verificação.

Após a confirmação manual, uma única consulta read-only confirmou:

| Verificação                        | Resultado                                  |
| ---------------------------------- | ------------------------------------------ |
| `auth.users` / `auth.identities`   | 1 / 1                                      |
| Perfil ativo correspondente        | 1                                          |
| `must_change_password`             | `false`                                    |
| Sessões totais/ativas do Owner     | 1 / 1                                      |
| Sessões de outros utilizadores     | 0                                          |
| Refresh tokens                     | 1, sem leitura do valor                    |
| `isAppAdmin`                       | `true`, pela relação exata em `app_admins` |
| Memberships do Owner / globais     | 0 / 0                                      |
| Equipas e épocas                   | 0 / 0                                      |
| Categorias, multas, batches e logs | 0                                          |
| Pedidos administrativos            | 0                                          |
| Objetos Storage                    | 0                                          |
| `public.audit_events`              | 1, apenas `owner.bootstrap`                |
| Roles de referência                | apenas `captain` e `treasurer`             |
| RLS e trigger de password          | ativos                                     |

A passagem de `must_change_password` para `false` comprova a execução do trigger
`private.sync_password_change()`. Como previsto, esse trigger não cria um novo
evento em `public.audit_events`. Não foram criadas equipas, épocas, memberships,
fotografias, dados financeiros ou outras contas.

## Verificação, dados temporários e limpeza

Inventário antes de cada mutação:

- alvo/ref/região/estado;
- configuração Auth relevante e rate limits;
- lista e checksums do bundle;
- deploy Pages atualmente ativo;
- contagens de Auth, `users`, `app_admins`, auditoria, dados de domínio e
  objetos Storage;
- secrets apenas por nome/estado, nunca por valor.

Smoke tests finais:

- HTTPS, headers, CSP, cache, service worker, manifest e fallback de rota
  profunda;
- build/commit publicado e variáveis públicas do ambiente correto;
- signup público recusado e login inválido com mensagem genérica;
- login Owner, mudança obrigatória de password e contexto Owner;
- Edge JWT/CORS/Owner, administração vazia e RLS;
- upload e remoção de uma fotografia mínima com prefixo UUID exclusivo;
- ausência de seed, equipas, épocas, memberships, multas, batches e logs.

O único dado temporário previsto é uma fotografia de smoke test; será removida
em `finally` e verificada por caminho e contagem. Não serão criadas contas de
smoke test, dados financeiros ou fixtures. Se a limpeza falhar, o processo para,
preserva IDs, timestamps e respostas sem credenciais, e não avança.

Inventário atual: um Auth user, uma identidade email, um `public.users`, um
`public.app_admins`, uma sessão ativa, um refresh token e a auditoria de
bootstrap; `must_change_password=false`, zero objetos Storage, apenas `captain`
e `treasurer` nas referências e restantes tabelas sem dados de utilização.
