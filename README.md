# Caixinha das Multas

Aplicação web mobile-first para gerir as multas internas de uma equipa de futebol. A implementação segue as fases e as regras descritas em [`docs/`](docs/README.md).

## Estado atual

A Fase 01 está concluída e disponibiliza a fundação web: shell, rotas e páginas placeholder. Não existem ligações a base de dados, autenticação ou operações de negócio. A próxima etapa é a Fase 02 — Base de Dados e RLS.

O fluxo de branches, commits, validações e pull requests está descrito em [`CONTRIBUTING.md`](CONTRIBUTING.md).

## Requisitos

- Windows 10 ou 11;
- Node.js 22.22.2 (LTS) ou 24.15.0 ou superior;
- npm 10 ou superior;
- um browser baseado em Chromium para os testes de browser.

Todas as dependências usadas são gratuitas e open source.

## Preparação em Windows

No PowerShell, a partir da raiz do repositório:

```powershell
npm install
Copy-Item .env.example .env.local
npm run test:e2e:install
```

O ficheiro `.env.local` é opcional nesta fase. Apenas variáveis públicas com o prefixo `VITE_` podem ser disponibilizadas ao frontend. Chaves secretas e credenciais administrativas nunca devem ser colocadas em ficheiros do cliente.

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
npm run build
npm run test:e2e
```

Os testes Playwright cobrem Chromium em perfis desktop e móvel.

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
```

As dependências seguem uma direção simples: `app` compõe os domínios; os domínios podem usar `shared`; `shared` não depende de domínios. Regras financeiras, autorização, persistência e integrações externas não pertencem a componentes de apresentação.
