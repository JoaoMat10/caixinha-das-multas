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
- Não existem identidades Auth, objetos Storage ou dados de utilização em
  produção.
- Não será executado `supabase/seed.sql` nem serão criadas fixtures.

## Gates obrigatórias

1. Gate concluída: PR #9 integrado, segundo deployment Production concluído e
   smoke independente aprovado.
2. Gate concluída localmente: CORS `*` foi substituído por uma allowlist exata,
   o HMAC foi separado da chave elevada e os checksums foram recalculados.
3. Decidir a política de password antes do primeiro Owner. O mínimo permanece em
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
4. Próximo, com autorização própria: guardar os dois secrets customizados da
   Edge Function.
5. Com autorização própria, publicar `admin-users` com JWT e CORS restritos.
6. Com autorização própria, executar o bootstrap transacional do primeiro
   Owner e obrigar à troca imediata da password.
7. Com autorização própria, executar o smoke test, remover todos os artefactos
   temporários e comparar o inventário final.

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

### Próximo checkpoint — secrets

- O runtime Supabase já injeta `SUPABASE_URL`, `SUPABASE_PUBLISHABLE_KEYS` e
  `SUPABASE_SECRET_KEYS`; estes nomes reservados não serão criados, lidos ou
  alterados neste checkpoint.
- Criar exclusivamente `ADMIN_ALLOWED_ORIGINS` com o valor exato
  `https://caixinha-showcase.pages.dev`.
- Criar exclusivamente `ADMIN_PASSWORD_RESET_SECRET` com 32 bytes aleatórios ou
  mais, gerados criptograficamente e nunca apresentados no chat ou logs.
- Antes da escrita: repetir as três confirmações do project ref e inventariar
  apenas os nomes/digests existentes, abortando se algum dos dois nomes já
  existir.
- Depois da escrita: listar apenas nomes/digests e exigir exatamente os dois
  nomes customizados, sem publicar ainda a função.
- Não usar argumentos `NAME=VALUE` nem ficheiros `.env`, para evitar exposição em
  processos ou persistência local; os valores serão enviados apenas em memória.

Nenhum valor entra no Git, frontend, Pages, comandos mostrados, chat ou logs.
A criação dos secrets não publica código. O futuro deployment usa o project ref
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

Dados mínimos: username válido, nome apresentado, password temporária aleatória
gerada/guardada pelo responsável no gestor de passwords e o UUID Auth criado
pelo Supabase. Passwords e tokens nunca são transmitidos no chat.

Procedimento:

1. Confirmar zero `auth.users`, `public.users`, `public.app_admins` e
   `public.audit_events`.
2. Criar manualmente no painel uma única identidade Auth com o email técnico
   calculado localmente, password temporária forte e email marcado como
   confirmado.
3. Capturar apenas o UUID. Se qualquer passo seguinte falhar, parar; a única
   limpeza admissível é eliminar essa identidade exata após autorização.
4. Executar no SQL Editor uma única transação que obtém advisory lock, exige
   zero Owners e uma única identidade Auth correspondente, insere
   `public.users` com `must_change_password=true`, `is_active=true` e
   `created_by` igual ao próprio UUID, insere `public.app_admins` e regista
   `owner.bootstrap` em `public.audit_events`.
5. Não criar função, token, policy ou conta de bootstrap persistente. O bloco
   SQL é descartável e deixa apenas as três linhas de negócio/auditoria.
6. Iniciar sessão na aplicação. O route guard permite apenas a página de troca
   de password; o Owner fornece a password atual e uma nova password. O trigger
   `private.sync_password_change` muda `must_change_password` para `false`.
7. Invalidar e remover do gestor a password temporária; confirmar que deixa de
   autenticar e que apenas a nova password funciona.

Não existe caminho público ou de utilizador comum para criar um segundo Owner.
As policies atuais permitem alteração de `app_admins` apenas a um Owner ativo;
a UI e a Edge Function não expõem promoção a Owner. Uma alteração que exija
dupla aprovação de Owners necessitaria de nova migração, fora deste rollout.

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

Inventário final esperado: um Auth user, um `public.users`, um
`public.app_admins`, auditoria de bootstrap e mudança de password; zero objetos
Storage; apenas `captain` e `treasurer` nas referências; restantes tabelas sem
dados de utilização.
