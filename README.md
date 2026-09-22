# Caixinha das Multas

Aplicação web mobile-first para gerir as multas internas de uma equipa de futebol. A implementação segue as fases e as regras descritas em [`docs/`](docs/README.md).

## Estado atual

A Fase 06 — Dashboard e Mural — está integrada em `main`. A Fase 07 — UI Mobile e PWA — está concluída e validada na branch `feature/ui-mobile-e-pwa`; o PR Draft #7 aguarda revisão e integração. A direção visual “Balneário Premium” é o tema disponível e a arquitetura permanece preparada para famílias futuras.

O fluxo de branches, commits, validações e pull requests está descrito em [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Requisitos

- Windows 10 ou 11;
- Node.js 22.22.2 (LTS) ou 24.15.0 ou superior;
- npm 10 ou superior;
- um browser baseado em Chromium para os testes de browser.
- Docker Desktop para executar a stack Supabase oficial diretamente no Windows (opcional; o CLI pertence às dependências do projeto e a mesma validação corre em GitHub Actions sem instalações locais).

Todas as dependências usadas são gratuitas e open source.

## Preparação em Windows

No PowerShell, a partir da raiz do repositório:

```powershell
npm install
Copy-Item .env.example .env.local
```

Preencher em `.env.local` apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`, disponíveis no projeto Supabase. O email usado pelo Supabase Auth é um identificador técnico interno e nunca é mostrado no frontend. Chaves secretas e credenciais administrativas nunca devem ser colocadas em ficheiros do cliente.

Se ainda não existir um browser compatível com a versão do Playwright instalada:

```powershell
npm run test:e2e:install
```

## Base de dados

A configuração local está em `supabase/config.toml`. O schema é alterado exclusivamente através dos ficheiros ordenados em `supabase/migrations/`; `supabase/seed.sql` contém apenas dados determinísticos de desenvolvimento, sem passwords.

O teste reproduzível que não requer Docker cria duas bases PostgreSQL independentes, aplica todas as migrações e seeds e exerce constraints, RLS e RPCs:

```powershell
npm run test:db
```

Quando Docker Desktop estiver disponível, iniciar a stack e executar os testes pgTAP com o CLI instalado no projeto:

```powershell
npx supabase start
npm run test:db:supabase:local
```

Sem Docker local, o workflow `Base de dados Supabase` pode executar a mesma validação num runner descartável do GitHub Actions.

Os testes remotos só podem ser executados contra um projeto Supabase descartável, dedicado exclusivamente a desenvolvimento/testes e sem dados reais. Depois de ligar explicitamente esse projeto com `npx supabase link`, definir a respetiva referência na sessão PowerShell:

```powershell
$env:SUPABASE_TEST_PROJECT_REF = 'referencia-do-projeto-de-testes'
```

Antes de obter chaves ou executar SQL, todos os runners remotos comparam esta variável com `supabase/.temp/project-ref` e recusam referências ausentes, inválidas ou divergentes. A suite de base de dados pode então ser executada sem Docker e agrega as mesmas asserções pgTAP dentro da transação definida pela suite:

```powershell
npm run test:db:supabase
```

Os fluxos de Auth reais usam uma conta aleatória e efémera, criada pela API administrativa apenas durante o teste e eliminada no fim, mesmo que a limpeza das tabelas públicas falhe. O comando exige login, ligação prévia do CLI e a mesma `SUPABASE_TEST_PROJECT_REF`; não grava passwords nem disponibiliza chaves administrativas ao frontend:

```powershell
npm run test:auth:supabase
npm run test:admin:supabase
```

Aplicar migrações e seed num projeto remoto é uma operação separada e explícita. Nunca executar `supabase db reset --linked`.

`supabase db reset` atua por omissão apenas na base local. Nunca executar `supabase db reset --linked` contra produção.

## Desenvolvimento no browser

```powershell
npm run dev
```

Abrir `http://127.0.0.1:5173` no browser. O servidor fica acessível apenas no computador local por omissão.

Para testar o build de produção:

```powershell
npm run build
npm run preview
```

Abrir `http://127.0.0.1:4173`.

## Validação

```powershell
npm run format:check
npm run lint
npm run typecheck
npm test
npm run test:db
npm run test:db:supabase
npm run test:auth:supabase
npm run test:admin:supabase
npm run build
npm run test:e2e
```

Os testes Playwright cobrem Chromium em perfis desktop e móvel contra o projeto Supabase de testes explicitamente confirmado por `SUPABASE_TEST_PROJECT_REF` e também removem a conta temporária no fim.

## Estrutura

```text
src/
  app/                  composição, providers e routing
  domains/
    admin/              fronteira de administração
    auth/               fronteira de autenticação
    dashboard/          fronteira do painel pessoal
    fines/              fronteira de multas
    leaderboard/        fronteira dos rankings
    treasury/           fronteira da tesouraria
  shared/
    components/         componentes transversais
    config/             configuração pública validada
    forms/              integração genérica de formulários
    pages/              páginas transversais
  styles/               Tailwind e design tokens
  test/                 configuração e utilitários de teste
e2e/                    testes de browser
public/                 manifesto e recursos estáticos
supabase/               configuração, migrações, seeds e testes pgTAP
tests/database/          testes PostgreSQL reproduzíveis sem Docker
```

As dependências seguem uma direção simples: `app` compõe os domínios; os domínios podem usar `shared`; `shared` não depende de domínios. Regras financeiras, autorização, persistência e integrações externas não pertencem a componentes de apresentação.
