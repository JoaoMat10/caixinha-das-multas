# Fase 03 — Autenticação e Sessões

## Estado

- Estado: concluída
- Responsável: equipa de engenharia
- Início: 2026-09-14
- Última atualização: 2026-09-14
- Dependências recebidas: Fase 02 integrada em `main` pelo commit squash `e628b50`; fronteiras modulares reforçadas em `03a6302`; quatro migrações, seed e 46 asserções da Fase 02 validados no Supabase Free dedicado.

## Objetivo

Entregar autenticação por username e password, gestão segura de sessões, proteção de rotas e alteração de password, integrada com Supabase Auth e com o perfil/RBAC da aplicação, sem antecipar o painel administrativo da Fase 04.

## Escopo assumido

- Validar primeiro as quatro migrações, o seed e as 46 asserções pgTAP na stack Supabase local.
- Encapsular o cliente Supabase e expor apenas contratos próprios aos restantes módulos.
- Implementar login por username, recuperação e expiração de sessão, logout e bloqueio de utilizadores desativados.
- Carregar o perfil e o contexto autorizado após autenticação.
- Implementar alteração obrigatória da password temporária e alteração posterior com validação da password atual.
- Proteger rotas e condicionar tabs sem substituir a autorização efetiva da base de dados/RLS.
- Criar testes unitários, de integração e E2E desktop/móvel proporcionais ao risco.

## Decisões tomadas

| Data       | Decisão                                                                                                                       | Justificação                                                                                                                              | Impacto                                                                                                                 |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| 2026-09-14 | Usar a branch `feature/autenticacao-e-sessoes` criada a partir de `main` limpa e sincronizada com `origin/main`.              | Mantém a Fase 03 isolada e pronta para revisão por pull request.                                                                          | Nenhuma alteração da fase será feita diretamente em `main`.                                                             |
| 2026-09-14 | Usar uma exceção `safe.directory` apenas por comando Git.                                                                     | O utilizador efetivo do ambiente difere do proprietário do checkout e a configuração Git global não deve ser alterada desnecessariamente. | Operações Git permanecem limitadas a este repositório.                                                                  |
| 2026-09-14 | Instalar o Supabase CLI 2.117.0 como dependência de desenvolvimento do projeto.                                               | É a instalação por projeto suportada oficialmente, evita dependência global e fixa a ferramenta no lockfile.                              | Os scripts npm resolvem o executável local; continua a ser necessário um runtime compatível com Docker.                 |
| 2026-09-14 | Propor Docker Desktop com backend WSL 2 para a stack local em Windows, condicionado à licença gratuita aplicável.             | É o caminho recomendado pela documentação Supabase para Windows e suporta toda a stack local.                                             | Requer autorização antes da instalação externa; alternativas compatíveis são Rancher Desktop ou Podman.                 |
| 2026-09-14 | Executar a stack Supabase oficial num runner descartável do GitHub Actions, sem instalar um runtime de containers no Windows. | O disco `C:` dispõe de apenas 3,1 GB livres e o utilizador privilegiou minimizar instalações locais.                                      | O checkpoint pgTAP e os testes reais de Auth correrão em CI; os testes unitários e o harness PGlite permanecem locais.  |
| 2026-09-14 | Exigir passwords com mínimo de 6 caracteres, incluindo maiúscula, minúscula e algarismo, sem obrigatoriedade de símbolos.     | Decisão explícita do produto, confirmada após apresentação da recomendação de usar um mínimo superior.                                    | A configuração Supabase, validação cliente e testes devem coincidir; fica aceite um risco superior de passwords curtas. |
| 2026-09-14 | Usar um projeto Supabase Free dedicado como ambiente real de desenvolvimento e testes.                                        | Evita instalar Docker numa máquina com apenas 3,1 GB livres e permite validar PostgreSQL, Auth, API e RLS geridos.                        | Migrações são aplicadas com `db push`; é proibido executar `db reset --linked`.                                         |
| 2026-09-14 | Derivar o email técnico por Base32 do username normalizado e um domínio reservado interno.                                    | Garante uma conversão determinística, sem colisões por maiúsculas/minúsculas e sem apresentar o identificador técnico.                    | Apenas o adaptador/serviço de autenticação conhece o email; a interface recebe sempre username.                         |
| 2026-09-14 | Expor o contexto autorizado por uma RPC `security definer` sem argumentos e com `search_path` vazio.                          | A identidade é obtida exclusivamente de `auth.uid()` e o estado ativo é validado no servidor antes de devolver perfil e permissões.       | `anon` não pode executar a função; uma conta desativada perde contexto e a sessão local é terminada.                    |
| 2026-09-14 | Persistir e renovar a sessão no adaptador Supabase, revalidando o contexto a cada minuto e quando a janela recupera foco.     | Recupera sessões ao abrir a aplicação e limita o tempo durante o qual uma desativação externa poderia permanecer visível.                 | Falhas, expiração ou desativação limpam a sessão; RLS continua a ser a autorização efetiva.                             |
| 2026-09-14 | Criar contas Auth aleatórias e efémeras nos testes reais/E2E, com limpeza obrigatória em `finally`.                           | Testa GoTrue e a Data API reais sem passwords fixas em seeds, ficheiros ou histórico.                                                     | Os testes requerem um projeto ligado; nenhuma conta temporária permanece depois da execução.                            |
| 2026-09-14 | Executar os E2E sequencialmente por perfil desktop/móvel e reutilizar o Chromium já instalado.                                | Evita interferência entre sessões da mesma conta temporária e evita downloads adicionais nesta máquina.                                   | O runner continua portátil, usando o browser gerido pelo Playwright quando o executável local não existe.               |

## Trabalho realizado

### Preparação da fase

- Leitura integral de `AGENTS.md`, da documentação obrigatória, da matriz RLS/RBAC, do diário da Fase 02 e do template de fase.
- Confirmação de `main` e `origin/main` em `03a6302`, sem divergência e com working tree limpa.
- Confirmação de que a árvore do head remoto do PR #2 (`3eeb87e`) é idêntica ao commit squash `e628b50` presente em `main`.
- Criação da branch `feature/autenticacao-e-sessoes`.

### Checkpoint da stack Supabase local

- Inventário confirmou ausência de Docker, Podman e WSL operacionais.
- Supabase CLI 2.117.0 instalado como `devDependency`, com atualização do lockfile.
- A primeira execução oficial alcançou o CLI local e falhou antes de recriar a base com `LegacyLocalDbRunningError: failed to inspect service`, coerente com a ausência de runtime de containers.
- Docker Desktop/WSL 2 permanece pendente de autorização por constituir alteração externa ao projeto.
- Após verificação de apenas 3,1 GB livres no disco `C:`, foi aprovada a alternativa sem instalação local: GitHub Actions com runner descartável e Docker já disponível.
- Workflow dedicado preparado com Node 24.15.0, `npm ci`, arranque da stack Supabase e execução do comando oficial do projeto.
- A publicação do workflow revelou um bloqueio da conta no GitHub: Actions não pode executar enquanto a faturação estiver bloqueada. Nenhum runner foi iniciado e o checkpoint permanece pendente.
- Projeto Supabase Free criado na região Central EU (Frankfurt), com Data API ativa, exposição automática de tabelas desativada e RLS automática ativada.
- Autenticação por email/password mantida apenas como mecanismo técnico; alteração de password exige a password atual. O auto-registo foi desativado.
- As quatro migrações e o seed foram aplicados com `db push --linked --include-seed`, sem qualquer reset remoto.
- O CLI 2.117.0 revelou que `supabase test db --linked` ainda exige Docker para executar `pg_prove`; foi criado um runner que agrega a suite pgTAP numa consulta transacional remota.
- `npm run test:db:supabase` validou 46/46 asserções no projeto Supabase real.

### Autenticação e sessões

- Cliente `@supabase/supabase-js` encapsulado por `SupabaseAuthGateway`; nenhum componente React importa o SDK.
- Configuração validada a partir de `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`; o `.env.local` permanece ignorado e nenhuma chave privilegiada é incluída no bundle.
- Username normalizado com `trim` e lowercase, validado pelo contrato `[a-z0-9._-]` e convertido deterministicamente para um email técnico Base32 que nunca chega à apresentação.
- `AuthService` centraliza login, recuperação/expiração de sessão, contexto autorizado, alteração de password, logout e mensagens genéricas sem enumeração.
- `AuthProvider` recupera a sessão ao arrancar, reage a eventos do Supabase e revalida a conta a cada minuto e no foco da janela.
- Rotas públicas, autenticadas, obrigatórias e autorizadas estão separadas; tabs são filtradas pelo mesmo contexto tipado, sem substituir RLS/RPCs.
- Formulários de login e password apresentam loading, bloqueiam submissões duplicadas e usam mensagens seguras em português de Portugal.
- `must_change_password` bloqueia as restantes rotas; a alteração do hash no Supabase Auth limpa a obrigação por trigger e a password atual é exigida pela configuração Auth e pelo pedido ao SDK.
- A página de alteração posterior exige também a password atual. Utilizadores sem equipa/função recebem uma área neutra e utilizadores desativados são desligados quando o contexto é revalidado.

### Validação contra Supabase real

- Adicionada a migração de contratos de sessão e aplicada ao projeto ligado após `db push --linked --include-seed --dry-run` confirmar que era a única pendente.
- O runner remoto pgTAP passou a descobrir todas as suites `*.test.sql`, mantendo 46/46 da Fase 02 e acrescentando 8/8 da Fase 03.
- O fixture real usa a API administrativa apenas no processo Node de teste, cria uma conta aleatória, associa-a temporariamente a um plantel com função de tesoureiro e elimina associação, perfil e identidade Auth no fim.
- Nove cenários reais validaram login, erro, RPC, password atual, trigger, desativação e logout; uma consulta posterior confirmou zero contas temporárias.
- E2E executado em Chromium desktop e móvel contra a conta efémera, incluindo recuperação da sessão após reload.

## Ficheiros criados ou alterados

| Ficheiro                                                               | Tipo de alteração | Motivo                                                                        |
| ---------------------------------------------------------------------- | ----------------- | ----------------------------------------------------------------------------- |
| `docs/fases/03-autenticacao-e-sessoes.md`                              | criado            | Diário obrigatório e handoff da Fase 03.                                      |
| `package.json` / `package-lock.json`                                   | alterado          | CLI, SDK Supabase e scripts de validação reais fixados de forma reproduzível. |
| `.github/workflows/database-supabase.yml`                              | criado            | Executar a validação Supabase oficial sem dependências no Windows local.      |
| `README.md`                                                            | alterado          | Documentar o CLI por projeto e a alternativa de validação em CI.              |
| `scripts/test-supabase-linked.mjs`                                     | criado            | Executar e validar integralmente a suite pgTAP ligada sem containers.         |
| `docs/fases/02-base-de-dados-e-rls.md`                                 | alterado          | Registar a conclusão da validação pendente da Fase 02.                        |
| `docs/rls-rbac.md`                                                     | alterado          | Corrigir a contagem e o resultado da suite pgTAP para 46 asserções.           |
| `docs/01-arquitetura.md`                                               | alterado          | Registar a política de complexidade de password decidida.                     |
| `docs/03-regras-de-negocio.md`                                         | alterado          | Tornar explícita a regra mínima de password.                                  |
| `.env.example` / `src/shared/config/*`                                 | alterado          | Contrato estritamente público e validado da configuração Supabase.            |
| `src/domains/auth/contracts`, `rules` e `services`                     | criado            | Contratos tipados e regras independentes da apresentação e do fornecedor.     |
| `src/domains/auth/infrastructure`                                      | criado            | Adaptador exclusivo do SDK Supabase e fallback de configuração.               |
| `src/domains/auth/state` e `presentation`                              | criado            | Ciclo de sessão, guards e componentes de autenticação.                        |
| `src/domains/auth/pages`                                               | alterado          | Login, alteração obrigatória/posterior e estado sem acesso.                   |
| `src/app/*`                                                            | alterado          | Composição do provider, rotas protegidas e tabs condicionadas.                |
| `supabase/migrations/20260914010000_create_auth_session_contracts.sql` | criado            | RPC de contexto e trigger de alteração de password.                           |
| `supabase/tests/auth_sessions.test.sql`                                | criado            | Oito asserções pgTAP sobre os contratos de sessão.                            |
| `scripts/supabase-auth-test-fixture.mjs` / `test-auth-supabase.mjs`    | criado            | Testes Auth reais com conta efémera e limpeza.                                |
| `scripts/test-e2e.mjs` / `e2e/auth.spec.ts`                            | criado            | Build e E2E reais em desktop/móvel com fixture efémero.                       |
| `playwright.config.ts`                                                 | alterado          | Runtime Node/browser existente e execução de sessões isolada.                 |
| `tests/database/database.test.mjs`                                     | alterado          | Compatibilidade do harness com o trigger em `auth.users`.                     |
| `supabase/config.toml`                                                 | alterado          | Política Auth local alinhada com o ambiente real.                             |
| `README.md`                                                            | alterado          | Configuração pública, comandos reais e estado da aplicação.                   |

## Base de dados, contratos e migrações

- Migrações adicionadas: `20260914010000_create_auth_session_contracts.sql`.
- Alterações de schema: trigger `auth_user_password_changed` em `auth.users`; sem novas tabelas ou colunas.
- Funções/RPCs/Edge Functions: `public.get_auth_context()` e `private.sync_password_change()`; nenhuma Edge Function nesta fase.
- Políticas RLS: sem alterações; a RPC valida `auth.uid()` e `public.users.is_active`, tem execução apenas para `authenticated` e não concede acesso a `anon`.
- Contratos frontend: `AuthGateway`, `AuthSession`, `AuthenticatedUser`, `SeasonMembership`, `PasswordChange` e `AuthCapability`.
- Compatibilidade e dados existentes: cinco testes PGlite passaram com todas as migrações; 54/54 asserções pgTAP passaram no Supabase ligado; o seed continua sem passwords.

## Testes e verificações

| Comando/cenário                                                  | Resultado | Observações                                                                                                   |
| ---------------------------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| Verificação de branch, histórico e working tree                  | passou    | `main` e `origin/main` em `03a6302`; árvore limpa; conteúdo do PR #2 confirmado pelo commit squash `e628b50`. |
| `npm exec -- supabase --version`                                 | passou    | CLI local 2.117.0.                                                                                            |
| `npm run test:db:supabase`                                       | bloqueado | `LegacyLocalDbRunningError: failed to inspect service`; não existe runtime de containers instalado.           |
| GitHub Actions — `Base de dados Supabase`                        | bloqueado | O GitHub impede a execução porque a faturação da conta está bloqueada; não foi criado qualquer run.           |
| `npm exec -- supabase db push --linked --include-seed --dry-run` | passou    | Foram previstas apenas quatro migrações e `supabase/seed.sql`.                                                |
| `npm exec -- supabase db push --linked --include-seed`           | passou    | Quatro migrações e seed aplicados ao projeto Free dedicado.                                                   |
| `npm exec -- supabase test db --linked`                          | bloqueado | O CLI tenta iniciar `pg_prove` por Docker mesmo para uma base ligada.                                         |
| `npm run test:db:supabase`                                       | passou    | Runner remoto: 46/46 asserções pgTAP passaram.                                                                |
| `npm run test:db` após migração de Auth                          | passou    | 5/5 cenários PGlite; migrações e seed reproduzíveis.                                                          |
| `npm run test:db:supabase` após migração de Auth                 | passou    | 54/54: 46 asserções da Fase 02 e 8 da Fase 03.                                                                |
| `npm run test:auth:supabase`                                     | passou    | 9/9 cenários contra Auth/API/RPC reais; conta temporária removida.                                            |
| Testes unitários e de integração React                           | passou    | 25/25 em 6 ficheiros com Node 24.19.0 isolado.                                                                |
| TypeScript                                                       | passou    | Sem erros com Node 24.19.0 isolado.                                                                           |
| ESLint                                                           | passou    | Sem erros ou avisos.                                                                                          |
| Playwright — Chromium desktop e móvel                            | passou    | 4/4; rota protegida, erro genérico, login, password obrigatória, reload, logout e manifesto.                  |
| `npm run format:check`                                           | passou    | Todos os ficheiros cumprem a configuração Prettier após a atualização final do diário.                        |
| `npm run build`                                                  | passou    | Build de produção concluído; apenas o aviso não bloqueante sobre o chunk inicial.                             |

## Desvios ao planeamento

- O requisito genérico de password mínima robusta foi concretizado por decisão explícita como mínimo de 6 caracteres com maiúscula, minúscula e algarismo. A recomendação técnica de usar pelo menos 12 caracteres foi recusada e o risco residual foi aceite; `docs/01-arquitetura.md` e `docs/03-regras-de-negocio.md` foram atualizados.

## Riscos e limitações

- GitHub Actions permanece indisponível por bloqueio de faturação, mas já não bloqueia a fase: a validação oficial foi concluída diretamente contra o projeto Supabase Free ligado.
- O Node disponível no shell é 21.7.2, fora do intervalo declarado pelo projeto; as execuções finais devem usar Node 22.22.2 ou 24.15.0+.
- Passwords com apenas 6 caracteres têm menor resistência a adivinhação e reutilização indevida do que o mínimo técnico recomendado; o risco foi aceite pelo produto.
- A desativação é detetada imediatamente em novo pedido protegido e, no frontend aberto sem pedidos, no máximo no ciclo de revalidação de 60 segundos; RLS/RPC bloqueiam de imediato no servidor.
- O bundle inicial em produção ultrapassa 500 kB sem compressão e gera um aviso não bloqueante; code splitting deve ser avaliado quando as páginas funcionais das fases seguintes substituírem os placeholders.

## Trabalho pendente

- [x] Concluir o checkpoint oficial da Fase 02 com quatro migrações, seed e 46 asserções pgTAP no Supabase Free dedicado.
- [x] Implementar contratos, regras, adaptador e estado de autenticação.
- [x] Implementar login, sessão, logout, proteção de rotas e alteração de password.
- [x] Implementar e executar testes unitários, reais/locais e E2E desktop/móvel.
- [x] Executar o pipeline final e concluir o diário.
- [x] Publicar os commits finais da branch e abrir o [pull request #3](https://github.com/JoaoMat10/caixinha-das-multas/pull/3), sem efetuar o merge.

## Handoff para a fase seguinte

- A Fase 04 deve reutilizar `usernameToTechnicalEmail` e os contratos do domínio Auth; não deve duplicar a normalização nem apresentar o email técnico.
- A criação, desativação e reposição de contas pertence a operações administrativas no servidor/Edge Functions. Nunca disponibilizar a chave `service_role` ao frontend.
- Depois de criar uma conta, criar o perfil `public.users` com o mesmo UUID, definir `must_change_password = true` e atribuir contexto de equipa/época em operação idempotente e auditada.
- A desativação em `public.users.is_active` já bloqueia `get_auth_context`; a Fase 04 deve preservar esta fonte de verdade e invalidar sessões no servidor quando implementar a operação administrativa.
- Preservar `AuthGateway` como fronteira do fornecedor e usar `useAuth` apenas na composição/apresentação; regras de autorização permanecem em funções puras e na base de dados.
- Configurar localmente apenas `VITE_SUPABASE_URL` e `VITE_SUPABASE_PUBLISHABLE_KEY`. Executar `npm run test:db`, `npm run test:db:supabase`, `npm run test:auth:supabase` e `npm run test:e2e` antes de alterar contratos.
