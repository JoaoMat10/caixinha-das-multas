# Deploy do frontend no Cloudflare Pages

## Estado

Esta configuração está preparada localmente. O repositório ainda não está ligado ao Cloudflare Pages e não foi efetuado qualquer deployment.

## Configuração de build

| Campo               | Valor                                      |
| ------------------- | ------------------------------------------ |
| Runtime             | Node.js 24.19.0, fixado em `.node-version` |
| Diretório raiz      | `/`                                        |
| Comando de build    | `npm run verify`                           |
| Diretório publicado | `dist`                                     |
| Branch de produção  | `main`                                     |

O comando `verify` executa formatação, lint, tipos, testes web, testes PostgreSQL embebidos e build. Não usa credenciais nem contacta ambientes remotos.

O ficheiro `wrangler.toml` fixa o nome lógico do projeto, o diretório `dist`, a data de compatibilidade e desativa telemetria do Wrangler. Não contém variáveis, identificadores externos ou bindings.

## Variáveis públicas

Configurar valores distintos nos contextos Preview e Production:

| Variável                        | Preview                       | Production                   |
| ------------------------------- | ----------------------------- | ---------------------------- |
| `VITE_APP_NAME`                 | `Caixinha das Multas`         | `Caixinha das Multas`        |
| `VITE_PUBLIC_APP_URL`           | URL HTTPS do preview          | URL HTTPS de produção        |
| `VITE_SUPABASE_URL`             | projeto descartável de testes | novo projeto de produção     |
| `VITE_SUPABASE_PUBLISHABLE_KEY` | chave publicável de testes    | chave publicável de produção |

Nunca configurar `SUPABASE_SERVICE_ROLE_KEY`, passwords, tokens administrativos ou connection strings no Cloudflare Pages. O projeto descartável `showcasetestref00001` é o único backend permitido para previews.

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
- Branches de pull request podem gerar previews apenas depois de autorização para ligar o GitHub.
- Antes do primeiro deployment devem ser validados no browser a CSP, os headers, as rotas profundas, a instalação PWA e o conteúdo de Cache Storage.

## Promoção e rollback

- A promoção normal ocorre através da integração em `main` depois de revisão e testes.
- O rollback do frontend seleciona no Cloudflare Pages o último deployment de produção aprovado.
- Um rollback do frontend não altera a base de dados. Migrações incompatíveis exigem uma estratégia corretiva própria antes da publicação.
- A publicação, ligação ao GitHub e qualquer rollback remoto exigem autorização explícita.
