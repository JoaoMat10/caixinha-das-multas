# Fase 01 — Fundacao Web

## Estado

- Estado: concluida
- Responsavel: equipa de engenharia
- Inicio: 2026-09-11
- Ultima atualizacao: 2026-09-11
- Dependencias recebidas: planeamento funcional e arquitetural aprovado em `docs/`.

## Objetivo

Criar uma fundacao web executavel, mobile-first, tipada, modular e testavel para a aplicacao Caixinha das Multas, sem antecipar persistencia, autenticacao ou funcionalidades de negocio de fases posteriores.

## Escopo assumido

- Inicializar React, Vite e TypeScript.
- Configurar Tailwind CSS e os primeiros design tokens.
- Criar a estrutura modular por dominio definida na arquitetura.
- Configurar React Router e TanStack Query.
- Preparar React Hook Form e Zod atraves de um formulario demonstrativo sem comportamento de negocio.
- Configurar lint, formatacao, testes unitarios e testes de browser base.
- Preparar variaveis de ambiente publicas sem segredos.
- Adicionar um manifesto PWA inicial.
- Criar um shell mobile-first minimo e paginas placeholder.
- Documentar os comandos de desenvolvimento e teste em Windows.

## Decisoes tomadas

| Data       | Decisao                                                                                        | Justificacao                                                                                                    | Impacto                                                                                                                 |
| ---------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2026-09-11 | Manter a Fase 01 sem qualquer cliente de dados ou autenticacao.                                | O plano reserva base de dados/RLS para a Fase 02 e autenticacao para a Fase 03.                                 | Os modulos de dominio terao apenas fronteiras e placeholders de apresentacao nesta fase.                                |
| 2026-09-11 | Adicionar apenas o manifesto PWA inicial, sem service worker.                                  | A estrategia de cache, atualizacao e instalacao PWA pertence explicitamente a Fase 07.                          | O browser reconhece os metadados iniciais; nao existe cache offline nem promessa de funcionamento offline.              |
| 2026-09-11 | Expor cada dominio futuro atraves de um `index.ts` publico.                                    | Mantem imports direcionados, reduz acoplamento e permite evoluir cada modulo sem expor a sua estrutura interna. | `app` compoe dominios; dominios dependem apenas de `shared`; `shared` permanece independente.                           |
| 2026-09-11 | Fixar as versoes resolvidas no `package-lock.json` e usar intervalos compativeis no manifesto. | Garante instalacoes reproduziveis sem impedir correcoes compativeis dentro da mesma versao principal.           | O runtime suportado e Node.js `^22.22.2` ou `>=24.15.0`, de acordo com os requisitos das dependencias instaladas.       |
| 2026-09-11 | Publicar a fundacao num repositorio GitHub privado com um fluxo documentado de contribuicao.   | Permite continuidade do trabalho com branches, commits, validacoes e revisao consistentes.                      | `main` representa a base concluida da Fase 01; novas alteracoes usam branches curtas e descritivas.                     |
| 2026-09-11 | Colocar o shell de composicao em `app/layout` e proteger as fronteiras com ESLint.             | O shell consome navegacao definida em `app` e, por isso, nao pertence ao modulo independente `shared`.          | `shared` fica impedido de importar `app` ou `domains`; cada dominio fica impedido de importar `app` ou outros dominios. |

## Trabalho realizado

### Preparacao da fase

- Leitura integral das instrucoes internas do repositorio e de todos os ficheiros Markdown existentes em `docs/`.
- Confirmacao de que o repositorio contem apenas documentacao e ainda nao tem implementacao da aplicacao.
- Confirmacao de que nao existe `ficheiros residuais de alojamento` nem configuracao de alojamento a preservar.

### Fundacao tecnica e interface

- Configuracao inicial de React, TypeScript, Vite, Tailwind CSS, React Router e TanStack Query.
- Integracao generica de React Hook Form com validacao Zod, sem formulario funcional do produto.
- Criacao de um shell mobile-first e responsivo com paginas placeholder para todas as fronteiras de dominio aprovadas.
- Adicao de manifesto PWA e icones vetoriais iniciais, sem service worker.
- Configuracao de ESLint, Prettier, Vitest, Testing Library e Playwright.
- Documentacao dos comandos de preparacao, desenvolvimento, build e validacao em Windows.
- Validacao do build num servidor local e execucao dos testes de browser em Chromium, nos perfis desktop e movel.
- Verificacao de que o repositorio nao contem credenciais ou segredos e de que os artefactos locais de build/teste sao ignorados.

### Publicacao e colaboracao

- Publicacao do commit da fundacao na branch `main` do repositorio privado `JoaoMat10/caixinha-das-multas`.
- Configuracao de `origin` por HTTPS e da branch local `main` para acompanhar `origin/main`.
- Definicao das convencoes de branches, commits, validacoes, pull requests, merge e seguranca em `CONTRIBUTING.md`.
- Configuracao de squash merge e rebase, com merge commits desativados e remocao automatica da branch depois do merge.

### Correcao da fronteira modular

- A revisao final identificou que `src/shared/components/AppShell.tsx` importava `src/app/navigation.ts`, contrariando a independencia declarada de `shared`.
- O shell foi movido para `src/app/layout/AppShell.tsx`, junto da composicao e navegacao que consome, e o router foi atualizado.
- `no-restricted-imports` impede que `src/shared` importe `src/app` ou `src/domains` por alias ou caminho relativo.
- A mesma protecao impede cada modulo em `src/domains` de importar `src/app` ou outro dominio diretamente.
- A configuracao foi exercitada em memoria com quatro imports proibidos representativos; todos foram bloqueados pela regra.

## Ficheiros criados ou alterados

| Ficheiro                                                                                        | Tipo de alteracao | Motivo                                                                                   |
| ----------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------- |
| `.env.example`                                                                                  | criado            | Exemplo de configuracao exclusivamente publica e sem segredos.                           |
| `.gitignore`, `.prettierignore`, `.prettierrc.json`                                             | criados           | Exclusoes de artefactos locais e regras de formatacao.                                   |
| `package.json`, `package-lock.json`                                                             | criados           | Dependencias, scripts, versoes resolvidas e requisitos de runtime.                       |
| `tsconfig.json`, `tsconfig.app.json`, `tsconfig.node.json`                                      | criados           | Typecheck estrito separado entre aplicacao e tooling.                                    |
| `eslint.config.js`, `vite.config.ts`, `playwright.config.ts`                                    | criados/alterados | Configuracao de lint, fronteiras modulares, build, testes unitarios e testes de browser. |
| `index.html`                                                                                    | criado            | Entrada HTML, metadados mobile e ligacao ao manifesto PWA.                               |
| `README.md`                                                                                     | criado/alterado   | Preparacao, desenvolvimento, validacao, estado atual e ligacao ao guia de contribuicao.  |
| `CONTRIBUTING.md`                                                                               | criado            | Fluxo partilhado de branches, commits, testes, pull requests e seguranca.                |
| `.gitattributes`                                                                                | criado            | Normalizacao de line endings entre Windows e os restantes ambientes.                     |
| `public/manifest.webmanifest`                                                                   | criado            | Manifesto PWA inicial em portugues de Portugal.                                          |
| `public/icons/icon.svg`, `public/icons/maskable-icon.svg`                                       | criados           | Icones vetoriais iniciais normal e maskable.                                             |
| `src/main.tsx`, `src/vite-env.d.ts`, `src/styles/index.css`                                     | criados           | Bootstrap React, tipos de ambiente, Tailwind e design tokens.                            |
| `src/app/App.tsx`, `src/app/AppProviders.tsx`, `src/app/queryClient.ts`                         | criados           | Composicao da aplicacao e configuracao isolada de TanStack Query.                        |
| `src/app/router.tsx`, `src/app/navigation.ts`                                                   | criados           | Routing, navegacao e variante de router para testes.                                     |
| `src/app/layout/AppShell.tsx`                                                                   | movido            | O shell pertence a camada de composicao porque depende da navegacao de `app`.            |
| `src/shared/components/AppShell.tsx`                                                            | removido          | Eliminacao da dependencia invertida de `shared` para `app`.                              |
| `src/shared/components/PhasePlaceholder.tsx`                                                    | criado            | Placeholder transversal reutilizavel e independente.                                     |
| `src/shared/pages/FoundationPage.tsx`, `src/shared/pages/NotFoundPage.tsx`                      | criados           | Pagina inicial da fundacao e tratamento de rota desconhecida.                            |
| `src/shared/config/env.ts`                                                                      | criado            | Validacao Zod das variaveis publicas com valores seguros por omissao.                    |
| `src/shared/forms/validation.ts`                                                                | criado            | Integracao tipada e generica entre React Hook Form e Zod.                                |
| `src/domains/auth/**`                                                                           | criado            | Fronteira publica e placeholder de autenticacao.                                         |
| `src/domains/admin/**`                                                                          | criado            | Fronteira publica e placeholder de administracao.                                        |
| `src/domains/fines/**`                                                                          | criado            | Fronteira publica e placeholder de multas.                                               |
| `src/domains/treasury/**`                                                                       | criado            | Fronteira publica e placeholder de tesouraria.                                           |
| `src/domains/dashboard/**`                                                                      | criado            | Fronteira publica e placeholder do painel pessoal.                                       |
| `src/domains/leaderboard/**`                                                                    | criado            | Fronteira publica e placeholder dos rankings.                                            |
| `src/test/setup.ts`, `src/test/test-utils.tsx`                                                  | criados           | Ambiente e utilitarios de testes de componentes.                                         |
| `src/app/App.test.tsx`, `src/shared/config/env.test.ts`, `src/shared/forms/validation.test.tsx` | criados           | Testes do shell, routing, ambiente e validacao de formularios.                           |
| `e2e/app-shell.spec.ts`                                                                         | criado            | Smoke tests do shell e manifesto em browser desktop e movel.                             |
| `docs/fases/01-fundacao-web.md`                                                                 | criado            | Registo obrigatorio da execucao e handoff da Fase 01.                                    |
| `docs/*.md`, `docs/fases/README.md`, `docs/fases/TEMPLATE.md`                                   | formatacao        | Normalizacao automatica de formatacao, sem alteracao funcional ou arquitetural.          |

## Base de dados, contratos e migracoes

- Migracoes adicionadas: nenhuma; fora do escopo desta fase.
- Alteracoes de schema: nenhuma; fora do escopo desta fase.
- Funcoes/RPCs/Edge Functions: nenhuma; fora do escopo desta fase.
- Politicas RLS: nenhuma; fora do escopo desta fase.
- Compatibilidade e dados existentes: nao existem dados nem contratos de implementacao anteriores.

## Testes e verificacoes

| Comando/cenario                          | Resultado              | Observacoes                                                                                                               |
| ---------------------------------------- | ---------------------- | ------------------------------------------------------------------------------------------------------------------------- |
| Inventario inicial do repositorio        | passou                 | Apenas instrucoes internas e documentacao em `docs/`; o repositorio ainda nao tinha commits.                              |
| `npm install`                            | passou                 | 264 pacotes instalados; auditoria da instalacao sem vulnerabilidades conhecidas.                                          |
| Primeiro ciclo de lint/typecheck/testes  | falhou e foi corrigido | Foram isolados o config JavaScript do lint tipado, os testes Playwright do Vitest e a resolucao de paths do TypeScript 6. |
| `npm run format:check`                   | passou                 | Todos os ficheiros abrangidos seguem a configuracao Prettier.                                                             |
| `npm run lint`                           | passou                 | ESLint terminou sem erros ou avisos.                                                                                      |
| `npm run typecheck`                      | passou                 | TypeScript em modo estrito terminou sem erros.                                                                            |
| `npm test`                               | passou                 | 3 ficheiros e 5 testes Vitest passaram.                                                                                   |
| `npm run build`                          | passou                 | 185 modulos transformados e build de producao criado em `dist/`.                                                          |
| `npm run test:e2e`                       | passou                 | 4 testes Playwright passaram em Chromium desktop e movel.                                                                 |
| Arranque do build no browser             | passou                 | `vite preview` serviu a aplicacao em `http://127.0.0.1:4173`; navegacao validada por browser real.                        |
| Verificacao de credenciais               | passou                 | Nenhum padrao de chave, token, password atribuida ou chave privada encontrado; apenas `.env.example` existe.              |
| Estado Git e GitHub final                | passou                 | Commit `b8ab482` publicado em `origin/main`; repositorio privado e working tree sincronizada.                             |
| Inventario de imports dos dominios       | passou                 | Nenhum dominio importa `app` nem outro dominio diretamente.                                                               |
| Exercicios de `no-restricted-imports`    | passou                 | Imports de `shared` para `app`/`domains` e de `auth` para `app`/`admin` foram bloqueados.                                 |
| Revisao modular — `npm run format:check` | passou                 | Todos os ficheiros abrangidos mantem a formatacao aprovada.                                                               |
| Revisao modular — `npm run lint`         | passou                 | ESLint terminou sem erros ou avisos com as novas protecoes ativas.                                                        |
| Revisao modular — `npm run typecheck`    | passou                 | TypeScript terminou sem erros depois da deslocacao do shell.                                                              |
| Revisao modular — `npm test`             | passou                 | 3 ficheiros e 5 testes Vitest passaram.                                                                                   |
| Revisao modular — `npm run build`        | passou                 | 185 modulos transformados e build de producao concluido.                                                                  |
| Revisao modular — `npm run test:e2e`     | passou                 | 4 testes Playwright passaram em Chromium desktop e movel.                                                                 |

## Desvios ao planeamento

- Nenhum.

## Riscos e limitacoes

- O checkout e executado num contexto Windows com propriedade diferente da conta do processo; os comandos Git requerem uma excecao local ao processo.
- O executavel `rg` instalado no sistema nao arranca neste contexto; o inventario inicial foi efetuado com PowerShell.
- O manifesto e os icones sao iniciais; service worker, cache, instalabilidade final, atualizacoes e testes PWA completos pertencem a Fase 07.
- As paginas de dominio sao placeholders deliberados e nao aplicam RBAC nem executam operacoes, porque essas garantias dependem das fases de dados e autenticacao.
- Os testes de browser cobrem Chromium em viewport desktop e movel; a matriz completa de browsers e dispositivos pertence a fase de qualidade final.

## Trabalho pendente

- Nenhum item pendente dentro da Fase 01.

## Handoff para a fase seguinte

- Executar `npm install` e, opcionalmente, `Copy-Item .env.example .env.local` antes do desenvolvimento.
- Preservar a direcao de dependencias: `app` compoe dominios; dominios podem depender de `shared`; `shared` nao depende de dominios.
- Preservar as regras `no-restricted-imports`: `shared` nao importa `app`/`domains`, e cada dominio nao importa `app` nem outro dominio diretamente.
- Manter clientes de infraestrutura e acesso a dados fora dos componentes de apresentacao e atras de contratos tipados.
- A Fase 02 deve adicionar exclusivamente base de dados, migracoes, constraints, funcoes auxiliares, RLS e testes de dados; nao deve implementar login nem substituir os placeholders funcionais.
- Nunca colocar a chave secreta de administracao do Supabase em variaveis `VITE_`; apenas configuracao publicavel e protegida por RLS pode chegar ao frontend.
- Preservar `src/app/queryClient.ts` como ponto de configuracao da cache remota e `src/shared/config/env.ts` como fronteira de validacao da configuracao publica.
- Seguir `CONTRIBUTING.md`: atualizar `main`, criar uma branch `feature/`, validar, criar commits coerentes, fazer push e abrir pull request.
- Executar `npm run format:check`, `npm run lint`, `npm run typecheck`, `npm test`, `npm run build` e `npm run test:e2e` depois das alteracoes da fase seguinte.
