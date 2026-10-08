# Deploy do frontend no Cloudflare Pages

> **Modelo demonstrativo:** todos os nomes, URLs, referências, identificadores e resultados abaixo são fictícios e servem apenas para documentar o procedimento. Substitua os placeholders por recursos próprios antes de executar qualquer operação.

## Estado

Segundo deployment Production executado em 2026-09-28; a correção forward e o
smoke test independente foram aprovados.
O projeto `caixinha-das-multas` está ligado exclusivamente a
`JoaoMat10/caixinha-das-multas`; não foram configurados serviços adicionais.

- URL canónica: `https://caixinha-showcase.pages.dev`.
- Deployment inicial: `11111111-1111-4111-8111-111111111111`, preservado apenas
  como evidência histórica da falha; não é um alvo de rollback aprovado.
- Commit atualmente publicado: `[COMMIT_SHOWCASE]`.
- Build: sucesso com Node 24.19.0, `npm run verify` e output `dist`.
- Previews: `None`, zero deployments executáveis e zero variáveis; existe apenas
  um registo `skipped — No deployment available`, sem URL nem assets.
- Production: quatro variáveis públicas presentes; nenhum segredo configurado.
- Segundo deployment: sucesso; smoke independente e reconfirmação pública
  read-only aprovados.

## Configuração de build

| Campo               | Valor                                      |
| ------------------- | ------------------------------------------ |
| Projeto             | `caixinha-das-multas`                      |
| Repositório         | `JoaoMat10/caixinha-das-multas`            |
| Branch de produção  | `main`                                     |
| Diretório raiz      | `/`                                        |
| Framework preset    | configuração personalizada                 |
| Comando de build    | `npm run verify`                           |
| Diretório publicado | `dist`                                     |
| Runtime             | Node.js 24.19.0, fixado em `.node-version` |
| Preview branches    | `None`, sem deployments automáticos        |
| Domínio inicial     | apenas `pages.dev`, sem domínio próprio    |

O comando `verify` executa formatação, lint, tipos, testes web, testes PostgreSQL
embebidos, build e validação do `dist` final com o servidor local oficial do
Pages. Não usa credenciais, não autentica no Cloudflare e não cria deployments.

O ficheiro `wrangler.toml` fixa o nome lógico do projeto, o diretório `dist`, a
data de compatibilidade e desativa telemetria do Wrangler. Não contém variáveis,
identificadores externos ou bindings. `.node-version` é o mecanismo versionado
suportado pelo build image do Pages; não é necessário duplicar `NODE_VERSION` no
painel.

## Variáveis públicas

Configurar exclusivamente no ambiente Production:

| Variável                        | Valor de produção                                          |
| ------------------------------- | ---------------------------------------------------------- |
| `VITE_APP_NAME`                 | `Caixinha das Multas`                                      |
| `VITE_PUBLIC_APP_URL`           | `https://caixinha-showcase.pages.dev`, após confirmação    |
| `VITE_SUPABASE_URL`             | `https://showcaseprodref00001.supabase.co`                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave `sb_publishable_…` pública de `showcaseprodref00001` |

A chave publicável foi lida diretamente da secção de API do projeto Supabase de
produção e introduzida no painel Cloudflare sem ser colocada no Git ou na
documentação. Nenhum valor secreto foi lido ou configurado.

A presença visual destas variáveis no painel não prova que foram injetadas no
processo que produziu um bundle. Para Production/main, o build valida a presença
das quatro variáveis, a URL canónica, a referência Supabase exata e o formato
`sb_publishable_…`; a chave nunca é escrita no diagnóstico. A gate só é ativada
quando `CF_PAGES=1` e `CF_PAGES_BRANCH=main`, pelo que desenvolvimento e testes
locais continuam a funcionar sem configuração de produção.

O formulário inicial obrigou a guardar temporariamente estas quatro variáveis em
Production e Preview. Imediatamente após o primeiro deployment, antes de qualquer
outra operação, `Preview branch` foi definido e confirmado como `None` e as
quatro variáveis foram removidas de Preview. Production permaneceu intacto e
nenhum deployment Preview foi criado.

Não voltar a configurar variáveis Preview enquanto os previews estiverem
desativados.
Nunca configurar `SUPABASE_SERVICE_ROLE_KEY`, passwords, tokens administrativos,
connection strings ou qualquer segredo no Cloudflare Pages.

## URL canónica

O Pages atribuiu e confirmou exatamente o subdomínio
`caixinha-showcase.pages.dev`. Este hostname é a fonte de verdade canónica do
frontend até existir uma autorização separada para domínio próprio.

Se o Pages atribuir qualquer hostname diferente, o processo para antes do
deployment: regista-se a URL efetiva, corrige-se `VITE_PUBLIC_APP_URL` e pede-se
nova validação. A URL foi comparada com o deployment canónico e usada no
checkpoint separado de Site URL e redirects do Supabase Auth, concluído em
2026-09-29.

## Integração GitHub e permissões

- Instalar a aplicação oficial `Cloudflare Workers and Pages` com **Only select
  repositories** e selecionar exclusivamente `JoaoMat10/caixinha-das-multas`.
- Não conceder acesso a todos os repositórios nem a outra organização ou conta.
- O conjunto de permissões individuais da GitHub App é definido pelo fornecedor
  e não pode ser reduzido durante a instalação. A aplicação publica checks e pode
  comentar URLs de preview; a Cloudflare documenta ainda permissões de Contents e
  Repository Administration read/write para funcionalidades de templates.
- A contenção mínima disponível é, por isso, restringir a instalação ao único
  repositório. Se o conjunto de permissões apresentado pelo GitHub não for
  aceite, interromper a ligação e rever uma alternativa de CI/Direct Upload em
  autorização própria.

Os previews são desativados em **Settings > Builds > Branch control > Preview
branch > None**. Até essa confirmação não se faz qualquer novo push ou evento no
PR #9. Depois da ligação, verificar que não foi criado um deployment de preview
retroativo; se existir, parar sem o apagar automaticamente e sem lhe atribuir
variáveis de produção.

## Autenticação necessária

- sessão interativa no dashboard Cloudflare numa conta com permissão para criar
  e configurar um projeto Pages;
- sessão GitHub capaz de instalar/configurar a GitHub App no repositório
  `JoaoMat10/caixinha-das-multas`;
- eventual 2FA ou confirmação de instalação é realizada manualmente pelo titular
  da conta;
- valor público `VITE_SUPABASE_PUBLISHABLE_KEY`, obtido diretamente do projeto
  Supabase de produção.

O fluxo pelo dashboard não exige Cloudflare API token, Global API Key nem login
Wrangler. Se futuramente for escolhida a API, seria necessário um token limitado
à conta com `Cloudflare Pages Edit`; criar ou ler esse token não faz parte deste
checkpoint.

## SPA, segurança e cache

- O output inclui um `404.html` de topo, desativando o fallback SPA nativo e
  indiscriminado. A raiz continua a ser servida por `index.html`.
- `_redirects` contém apenas rewrites `200` das nove rotas funcionais conhecidas
  para `/index.html`. Não existe `/* /index.html 200`, pelo que um caminho
  desconhecido em `/assets/` devolve `404` e nunca o documento da SPA.
- `public/_headers` aplica CSP, proteção contra framing e MIME sniffing, política de referência, política de permissões e HSTS.
- A CSP permite scripts, manifest e worker apenas da própria origem. Estilos permitem ainda o hash SHA-256 exato do CSS inline da página offline. Ligações HTTPS e fotografias permitem apenas a própria origem e `https://showcaseprodref00001.supabase.co`; não são autorizados WebSockets, `data:` ou `blob:`.
- A build de produção não aceita wildcards Supabase nem a referência do projeto descartável. Previews permanecem desativados até existir uma política CSP própria que autorize exclusivamente o respetivo backend de testes.
- O pós-build enumera os ficheiros com hash realmente produzidos em
  `dist/assets` e acrescenta ao `_headers` final uma regra exata de cache
  imutável de um ano para cada um. Não existe `/assets/*`; um asset inexistente
  não recebe `immutable`.
- `service-worker.js` usa `no-cache, no-store, must-revalidate`, evitando manter indefinidamente o ponto de atualização da PWA.
- O manifest usa uma hora com revalidação. `index.html`, `offline.html` e todas as rotas HTML conhecidas usam `no-cache, must-revalidate`.
- O service worker continua a excluir Auth, REST, RPC, Storage e qualquer pedido cross-origin.

## Preview e produção

- Previews nunca recebem as variáveis do Supabase de produção.
- A branch `main` será a única branch de produção.
- Preview branch fica em `None`; nenhuma branch de pull request gera deployments.
- O push documental anterior gerou no histórico a entrada
  `22222222-2222-4222-8222-222222222222`, branch
  `feature/ativacao-producao`, commit
  `[COMMIT_SHOWCASE]`, com estado
  `skipped — No deployment available`. Esta entrada não é um deployment Preview
  executável: não publicou URL nem assets e não foi eliminada.
- O primeiro smoke HTTPS validou CSP, headers, rotas profundas e artefactos PWA;
  a instalação funcional ficou inconclusiva porque o bundle publicado não contém
  a configuração pública Supabase e a aplicação bloqueia a autenticação.
- O segundo deployment corrigiu estas duas falhas. O bundle contém a referência
  de produção e uma chave no formato publicável, sem revelar o valor; o asset
  inexistente devolve 404 sem o documento da SPA e sem cache imutável.

## Verificação pós-deploy

1. confirmar no build log Node 24.19.0, `npm run verify` sem falhas, output
   `dist` e commit exato de `main`;
2. confirmar projeto, repositório, branch, diretório raiz, build command e
   previews `None` no painel;
3. confirmar a URL HTTPS canónica e que `VITE_PUBLIC_APP_URL` coincide;
4. verificar `index.html`, uma rota profunda e um asset inexistente para validar
   o fallback SPA sem intercetar JavaScript ou CSS;
5. validar CSP, HSTS, `nosniff`, proteção de framing, políticas de referência e
   permissões nas respostas reais;
6. validar cache: HTML com revalidação, assets com hash imutáveis por um ano,
   manifest por uma hora e service worker sem cache persistente;
7. confirmar manifest, registo/atualização do service worker, página offline e
   instalação PWA em desktop e mobile;
8. confirmar ausência de source maps, wildcard Supabase, referência do projeto
   descartável, chaves secretas ou pedidos para origens não autorizadas;
9. confirmar que o frontend contacta apenas
   `https://showcaseprodref00001.supabase.co` e que o signup público continua
   recusado;
10. confirmar que não existem deployments de preview e registar o deployment ID
    de produção aprovado.

### Resultado do primeiro smoke — 2026-09-28

| Verificação                   | Resultado         | Evidência                                                                                                                              |
| ----------------------------- | ----------------- | -------------------------------------------------------------------------------------------------------------------------------------- |
| Build e commit                | passou            | Node 24.19.0; `npm run verify`; 88/88 Vitest; 11/11 PostgreSQL; commit `[COMMIT_SHOWCASE]`.                                            |
| Projeto e ambientes           | passou            | Hostname exato; `main`; raiz `/`; output `dist`; Preview `None`, sem variáveis e sem deployments.                                      |
| Headers e CSP                 | passou            | CSP restrita à origem de produção; HSTS; `nosniff`; `DENY`; `no-referrer`; Permissions-Policy esperada.                                |
| Cache previsto                | passou com desvio | HTML, assets com hash, manifest e service worker corretos; `/offline.html` normaliza para `/offline` com `max-age=0, must-revalidate`. |
| SPA e rota profunda           | passou            | `/multas` devolve o mesmo documento HTML de entrada.                                                                                   |
| Asset inexistente             | **falhou**        | `/assets/nao-existe.js` devolve `index.html` como `text/html` e recebe `public, max-age=31536000, immutable`.                          |
| Manifest, offline e ícones    | passou            | Manifest válido, página offline e quatro ícones publicados com tipos corretos.                                                         |
| Conteúdo do bundle            | **falhou**        | Os 22 assets não contêm a referência de produção nem a chave publicável; a UI mostra autenticação não configurada.                     |
| Segredos e ambiente de testes | passou            | Sem `service_role`, `sb_secret_`, source maps ou referência `showcasetestref00001`; CSP sem wildcard Supabase.                         |
| Auth público                  | passou            | `GET /auth/v1/settings`: `disable_signup=true` e `external_email_enabled=true`.                                                        |
| Inventário de deployments     | passou            | Um único deployment Production/main, ID `11111111-1111-4111-8111-111111111111`; zero Preview.                                          |

O rollout permanece pausado. A correção forward deve garantir que as variáveis
`VITE_*` estão disponíveis ao processo de build e substituir o fallback nativo
por uma estratégia que preserve as rotas SPA sem devolver HTML imutável em
`/assets/*`. Qualquer novo deployment requer autorização própria após revisão e
testes locais; não existe versão anterior para rollback.

### Correção forward preparada localmente

As duas causas foram confirmadas:

1. as variáveis estavam visíveis em Production no painel, mas o build publicado
   não continha os valores Vite; não existia uma precondição que relacionasse a
   configuração visual com o ambiente efetivo do processo de build;
2. a ausência de `404.html` ativava o fallback SPA nativo para todos os caminhos
   e a regra genérica `/assets/*` aplicava cache imutável também à resposta HTML
   de um asset inexistente.

A correção forward acrescenta a gate específica de Production/main, `404.html`,
os nove rewrites explícitos e geração pós-build de regras exatas apenas para os
assets com hash existentes. `npm run verify` valida o output que acabou de ser
produzido e inicia localmente `wrangler pages dev` para confirmar raiz, rotas
conhecidas, `404` de asset inexistente, headers, cache, ausência de source maps e
ausência de segredos. O rollout e o segundo deployment continuam pausados; o
merge em `main` só pode ocorrer depois de revisão e autorização explícita porque
desencadeia automaticamente o deployment de produção.

Resultado local: Node 24.19.0, 27 ficheiros/99 testes Vitest, 11/11 testes
PostgreSQL, build de 22 assets com hash e 5/5 verificações Pages. Nenhuma
credencial Cloudflare foi lida e nenhuma operação remota foi executada.

### Resultado do segundo deployment — 2026-09-28

- Origem: merge do PR #9 em `main`, commit
  `[COMMIT_SHOWCASE]`.
- Build Production: sucesso.
- Smoke independente: aprovado.
- Reconfirmação pública sanitizada: `/` e `/multas` responderam `200` com o
  mesmo app shell; o bundle contém a referência Supabase de produção e uma chave
  no formato publicável; `/assets/nao-existe.js` respondeu `404` com `no-store`
  e sem o shell da aplicação.
- Nenhum valor de chave foi apresentado ou persistido nesta verificação.
- O rollout do frontend fica concluído; Auth, secrets, Edge Function e Owner
  continuam em checkpoints separados.

## Promoção e rollback

- A promoção normal ocorre através da integração em `main` depois de revisão e testes.
- Um build falhado não é um alvo de rollback. O deployment inicial
  `11111111-1111-4111-8111-111111111111` fica excluído porque falhou o smoke.
- Num deployment futuro, o rollback pode selecionar este segundo deployment,
  agora aprovado. Previews não são alvos válidos e qualquer rollback remoto
  continua a exigir autorização explícita.
- Um rollback do frontend não altera a base de dados. Migrações incompatíveis exigem uma estratégia corretiva própria antes da publicação.
- Variáveis e definições do projeto são verificadas e revertidas separadamente;
  não se assume que o rollback de assets restaura configuração.
- A publicação, ligação ao GitHub e qualquer rollback remoto exigem autorização explícita.

## Próximo checkpoint

Cloudflare Pages, Site URL e redirect exato do Supabase Auth estão concluídos. O
passo seguinte é guardar exclusivamente os dois secrets customizados da Edge
Function, após autorização própria. Publicação da função e criação do primeiro
Owner mantêm duas autorizações posteriores e independentes.
