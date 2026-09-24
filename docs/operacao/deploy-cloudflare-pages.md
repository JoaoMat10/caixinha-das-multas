# Deploy do frontend no Cloudflare Pages

## Estado

Preflight atualizado em 2026-09-24. O projeto Cloudflare ainda não existe, o
repositório não está ligado, nenhuma variável foi configurada e não foi efetuado
qualquer deployment. Não foi lida nem utilizada qualquer credencial Cloudflare.

## Configuração de build

| Campo               | Valor                                      |
| ------------------- | ------------------------------------------ |
| Projeto             | `caixinha-das-multas`                      |
| Repositório         | `JoaoMat10/caixinha-das-multas`                 |
| Branch de produção  | `main`                                     |
| Diretório raiz      | `/`                                        |
| Framework preset    | configuração personalizada                 |
| Comando de build    | `npm run verify`                           |
| Diretório publicado | `dist`                                     |
| Runtime             | Node.js 24.19.0, fixado em `.node-version` |
| Preview branches    | `None`, sem deployments automáticos        |
| Domínio inicial     | apenas `pages.dev`, sem domínio próprio    |

O comando `verify` executa formatação, lint, tipos, testes web, testes PostgreSQL embebidos e build. Não usa credenciais nem contacta ambientes remotos.

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
| `VITE_PUBLIC_APP_URL`           | `https://caixinha-showcase.pages.dev`, após confirmação  |
| `VITE_SUPABASE_URL`             | `https://showcaseprodref00001.supabase.co`                 |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave `sb_publishable_…` pública de `showcaseprodref00001` |

A chave publicável não foi recolhida neste preflight sem credenciais. Será lida
apenas da secção de API do projeto Supabase de produção e introduzida diretamente
no painel Cloudflare após autorização; não será colocada no Git nem no chat.

Não configurar variáveis Preview enquanto os previews estiverem desativados.
Nunca configurar `SUPABASE_SERVICE_ROLE_KEY`, passwords, tokens administrativos,
connection strings ou qualquer segredo no Cloudflare Pages.

## URL canónica

O nome do projeto gera normalmente o subdomínio
`caixinha-showcase.pages.dev`. Durante a criação, o painel deve confirmar que
o nome está disponível e apresentar a URL de produção. A fonte de verdade final
será o `pages.dev` devolvido pelo Pages, não uma URL inferida.

Se o Pages atribuir qualquer hostname diferente, o processo para antes do
deployment: regista-se a URL efetiva, corrige-se `VITE_PUBLIC_APP_URL` e pede-se
nova validação. Depois do primeiro deployment, a URL será comparada com a URL do
deployment canónico e usada no checkpoint separado de Site URL e redirects do
Supabase Auth.

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

- O Cloudflare Pages reconhece a aplicação como SPA porque o build contém `index.html` e não contém um `404.html` de topo. Nesse modo, as rotas sem asset correspondente são servidas pelo fallback nativo para `/`.
- Não existe uma regra global em `_redirects`: no Pages, essa regra teria precedência mesmo sobre assets existentes e poderia encaminhar JavaScript ou CSS para `index.html`.
- `public/_headers` aplica CSP, proteção contra framing e MIME sniffing, política de referência, política de permissões e HSTS.
- A CSP permite scripts, manifest e worker apenas da própria origem. Estilos permitem ainda o hash SHA-256 exato do CSS inline da página offline. Ligações HTTPS e fotografias permitem apenas a própria origem e `https://showcaseprodref00001.supabase.co`; não são autorizados WebSockets, `data:` ou `blob:`.
- A build de produção não aceita wildcards Supabase nem a referência do projeto descartável. Previews permanecem desativados até existir uma política CSP própria que autorize exclusivamente o respetivo backend de testes.
- Assets com hash em `/assets/` usam cache imutável de um ano.
- `service-worker.js` usa `no-cache, no-store, must-revalidate`, evitando manter indefinidamente o ponto de atualização da PWA.
- O manifest usa uma hora com revalidação. `index.html`, `offline.html` e todas as rotas HTML conhecidas usam `no-cache, must-revalidate`.
- O service worker continua a excluir Auth, REST, RPC, Storage e qualquer pedido cross-origin.

## Preview e produção

- Previews nunca recebem as variáveis do Supabase de produção.
- A branch `main` será a única branch de produção.
- Preview branch fica em `None`; nenhuma branch de pull request gera deployments.
- Antes do primeiro deployment devem ser validados no browser a CSP, os headers, as rotas profundas, a instalação PWA e o conteúdo de Cache Storage.

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

## Promoção e rollback

- A promoção normal ocorre através da integração em `main` depois de revisão e testes.
- Um build falhado não é promovido. Como o primeiro deployment não tem versão
  anterior, não existe alvo de rollback nesse momento; se o smoke test falhar,
  pausar deployments automáticos e preparar uma correção forward. Eliminar o
  projeto ou retirar a publicação exige autorização destrutiva própria.
- A partir do segundo deployment, o rollback seleciona no Pages o último
  deployment de produção aprovado; previews não são alvos válidos.
- Um rollback do frontend não altera a base de dados. Migrações incompatíveis exigem uma estratégia corretiva própria antes da publicação.
- Variáveis e definições do projeto são verificadas e revertidas separadamente;
  não se assume que o rollback de assets restaura configuração.
- A publicação, ligação ao GitHub e qualquer rollback remoto exigem autorização explícita.

## Ordem autorizável

1. autenticação manual no Cloudflare;
2. instalação GitHub limitada ao único repositório;
3. criação de `caixinha-das-multas` e confirmação da URL atribuída;
4. configuração de `main`, `/`, `npm run verify`, `dist` e previews `None`;
5. introdução exclusiva das quatro variáveis públicas de Production;
6. revisão final dos valores e primeiro deployment;
7. verificações pós-deploy, sem avançar para Auth, Edge Function ou Owner.
