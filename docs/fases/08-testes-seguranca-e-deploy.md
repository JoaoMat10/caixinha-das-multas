# Fase 08 — Testes, Segurança e Deploy

## Estado

- Estado: em curso — checkpoint local concluído; testes e operações remotas aguardam nova confirmação explícita
- Responsável: equipa de engenharia
- Início: 2026-09-22
- Última atualização: 2026-09-23
- Dependências recebidas: Fase 07 integrada em `main` no commit `9c1d4db`; interface “Balneário Premium”, PWA online-first e contratos funcionais existentes.

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

| Data       | Decisão                                                                                     | Justificação                                                                                 | Impacto                                                                                                       |
| ---------- | ------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------- |
| 2026-09-22 | Criar a branch `feature/qualidade-seguranca-deploy` a partir de `main` no commit `9c1d4db`. | Isola a última fase do MVP e preserva o fluxo de revisão por pull request.                   | Nenhuma alteração é feita diretamente em `main`.                                                              |
| 2026-09-22 | Adotar Cloudflare Pages para o frontend.                                                    | Decisão explícita recebida para o fornecedor de alojamento.                                  | A preparação local usa o formato de configuração e de headers suportado pelo Pages.                           |
| 2026-09-22 | Fixar Node 24.19.0 para comandos locais e builds do Pages.                                  | Garante uma versão compatível e reproduzível; o Node 21.7.2 do sistema não serve o projeto.  | `.node-version` passa a definir o runtime esperado.                                                           |
| 2026-09-23 | Executar os ficheiros Vitest sem paralelismo e dar 3 segundos às esperas assíncronas da UI. | As falhas ocorriam apenas sob contenção, durante transformação e carregamento de rotas lazy. | Três execuções integrais consecutivas passaram sem aumentar o timeout dos próprios testes.                    |
| 2026-09-23 | Usar o fallback SPA nativo do Pages, sem uma regra global `_redirects`.                     | Regras globais do Pages têm precedência sobre assets e poderiam intercetar JavaScript e CSS. | A ausência de `404.html` ativa o fallback nativo sem afetar assets existentes.                                |
| 2026-09-23 | Manter operações Cloudflare e Supabase suspensas neste checkpoint.                          | A autorização recebida limita-se a preparação, auditoria e testes locais.                    | Não foram criados recursos, dados, ligações de alojamento, deployments ou alterações remotas nesses serviços. |

## Trabalho realizado

### Preparação e Git

- Lidos integralmente `AGENTS.md`, as seis fontes obrigatórias, `docs/rls-rbac.md`, os diários das Fases 02 a 07 e o template de fase.
- Confirmado o merge da Fase 07 por fast-forward de `main` entre `c3d8bd1` e `9c1d4db`.
- Criada a branch `feature/qualidade-seguranca-deploy` a partir da árvore limpa.
- Consolidado o checkpoint local no commit `4b0a7a3` e aberto o PR Draft #8 para revisão, sem merge.
- Nenhum recurso Cloudflare/Supabase, integração de alojamento, deployment, migração, segredo ou dado remoto foi criado ou alterado.

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
- O fallback SPA usa o comportamento nativo do Pages: existe `index.html` e não existe `404.html` nem uma regra global que sobreponha assets.
- Documentados build, variáveis públicas separadas, promoção, rollback e limites de autorização em `docs/operacao/deploy-cloudflare-pages.md`.

### Auditoria local de segurança

- `npm audit` inventariou 338 dependências e não encontrou vulnerabilidades conhecidas.
- A pesquisa no estado atual e em 35 commits não encontrou chaves privadas, JWTs completos nem tokens GitHub, AWS ou Supabase de alto privilégio.
- O frontend usa apenas URL e chave publicável Supabase; o teste estático rejeita nomes de segredos com prefixo `VITE_` e referências a `service_role` em `src` ou `public`.
- O teste estático rejeita `dangerouslySetInnerHTML`, `eval`, `new Function` e logging informativo no frontend.
- Todas as funções `security definer` inventariadas mantêm `search_path` vazio e os privilégios de escrita financeira continuam limitados a RPCs.
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

## Ficheiros criados ou alterados

| Ficheiro                                     | Tipo de alteração | Motivo                                                                       |
| -------------------------------------------- | ----------------- | ---------------------------------------------------------------------------- |
| `.node-version`                              | criado            | Fixar Node 24.19.0.                                                          |
| `wrangler.toml`                              | criado            | Declarar configuração local do Cloudflare Pages.                             |
| `package.json`                               | alterado          | Adicionar `npm run verify`.                                                  |
| `vite.config.ts`                             | alterado          | Executar ficheiros Vitest sem paralelismo.                                   |
| `src/test/setup.ts`                          | alterado          | Estabilizar esperas assíncronas de rotas lazy.                               |
| `public/_headers`                            | criado            | Definir CSP, headers de segurança e cache.                                   |
| `tests/scripts/deployment-security.test.mjs` | criado            | Validar configuração do Pages e garantias estáticas do frontend.             |
| `tests/database/database.test.mjs`           | alterado          | Completar matriz RLS/RBAC, imutabilidade, idempotência e concorrência local. |
| `docs/operacao/deploy-cloudflare-pages.md`   | criado            | Documentar configuração, separação de ambientes, promoção e rollback.        |
| `docs/fases/08-testes-seguranca-e-deploy.md` | criado            | Manter o diário único e contínuo da Fase 08.                                 |

## Base de dados, contratos e migrações

- Migrações adicionadas: nenhuma neste checkpoint.
- Alterações de schema: nenhuma.
- Funções/RPCs/Edge Functions: nenhuma alteração.
- Políticas RLS: nenhuma alteração; os testes existentes foram alargados.
- Contratos públicos: adicionado apenas o comando de engenharia `npm run verify`.
- Compatibilidade e dados existentes: não foram executadas operações remotas nem tocados dados.

## Testes e verificações

| Comando/cenário                                      | Resultado | Observações                                                                                  |
| ---------------------------------------------------- | --------- | -------------------------------------------------------------------------------------------- |
| Pesquisa de segredos no estado atual e em 35 commits | passou    | Zero literais de alto risco encontrados; ficheiros locais ignorados não foram expostos.      |
| `npm audit --json`                                   | passou    | 0 vulnerabilidades conhecidas em 338 dependências.                                           |
| Suite Vitest integral, três repetições               | passou    | 88/88 em cada repetição; 26 ficheiros por execução.                                          |
| Testes de configuração e segurança estática          | passou    | 6/6, incluídos nas 88 verificações Vitest.                                                   |
| Testes PostgreSQL embebidos                          | passou    | 10/10; anteriormente 8 cenários.                                                             |
| `npm run verify` com Node 24.19.0                    | passou    | Formatação, ESLint, TypeScript, 88 Vitest, 10 PostgreSQL e build passaram numa única cadeia. |
| Inspeção de `dist`                                   | passou    | `_headers` copiado sem diferenças; 0 source maps.                                            |

## Desvios ao planeamento

- A regra `_redirects` inicialmente preparada foi removida antes do fecho do checkpoint. A documentação atual do Cloudflare confirma que o Pages fornece fallback SPA nativo na ausência de `404.html` e que regras globais podem sobrepor assets existentes.
- A concorrência local usa chamadas intercaladas sobre PGlite. A prova com sessões PostgreSQL verdadeiramente independentes continua reservada aos testes remotos autorizados.

## Riscos e limitações

- Elevado: concorrência real entre ligações PostgreSQL, pgTAP, Auth, Storage e Edge Function ainda não foi revalidada no projeto descartável.
- Elevado: não existe projeto Supabase de produção e o projeto descartável nunca pode ser promovido.
- Médio: os headers, o fallback SPA, o cache e a instalação PWA ainda não foram observados numa resposta HTTPS real do Pages.
- Médio: a CSP permite temporariamente qualquer subdomínio Supabase; deve ser restringida às referências exatas de preview e produção quando ambas existirem.
- Médio: a Edge Function mantém CORS permissivo; o token JWT e a verificação Owner no servidor preservam a autorização, mas a origem deve ser restringida quando existirem hostnames definitivos.
- Médio: o workflow GitHub Actions existente é parcial e o bloqueio histórico de faturação não foi reconfirmado nesta sessão.
- Médio: o Node global desta máquina é 21.7.2; foi necessário forçar o runtime 24.19.0. O Pages deverá respeitar `.node-version`.
- Baixo: o plano gratuito Supabase pode pausar por inatividade e não inclui backups automáticos nem SLA.

## Trabalho pendente

- [x] Estabilizar a suite web e criar um comando local único de verificação.
- [x] Completar localmente a matriz RLS/RBAC, financeira, de idempotência e concorrência intercalada.
- [x] Preparar localmente Cloudflare Pages, fallback SPA, cache e headers de segurança.
- [ ] Reconfirmar, antes de qualquer teste remoto, que o alvo exclusivo é `showcasetestref00001` e apresentar operações, dados temporários e limpeza.
- [ ] Executar pgTAP, Auth, Admin/Storage/Edge Function e concorrência com sessões independentes apenas após nova autorização explícita.
- [ ] Executar E2E e smoke tests desktop, móvel e PWA num preview HTTPS autorizado.
- [ ] Rever e reforçar o workflow apenas se GitHub Actions estiver operacional; caso contrário, manter o pipeline local documentado.
- [ ] Produzir procedimentos de backup/restauro, privacidade e resposta a incidente.
- [ ] Receber autorização separada para criar o projeto Supabase de produção e confirmar nome, região e referência.
- [ ] Aplicar apenas migrações versionadas em produção, sem `supabase/seed.sql`, após dry-run e autorização.
- [ ] Publicar Edge Function, configurar segredos, URLs Auth e primeiro Owner apenas após autorizações específicas.
- [ ] Ligar o repositório ao Cloudflare Pages, configurar preview/produção e executar o primeiro deployment após autorização.
- [ ] Executar backup/restauro apenas entre ambientes autorizados e nunca sobre produção.
- [x] Abrir pull request Draft para revisão do checkpoint local, sem merge.

## Handoff para a fase seguinte

- Esta é a última fase do MVP Web/PWA; não existe handoff autorizado para Capacitor, Android ou iOS.
- Preservar integralmente RLS, contratos financeiros, snapshots, idempotência, logs imutáveis e isolamento por equipa e época.
- O projeto `showcasetestref00001` permanece exclusivamente descartável e nunca pode ser configurado como produção.
- Antes de qualquer operação remota, repetir a confirmação do alvo, listar comandos e mutações previstos, indicar reversibilidade e descrever a limpeza completa.
