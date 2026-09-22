# Fase 07 — UI Mobile e PWA

## Estado

- Estado: concluída — implementação, validação automatizada e validação manual aprovadas
- Responsável: equipa de engenharia
- Início: 2026-09-22
- Última atualização: 2026-09-22
- Dependências recebidas: Fase 06 integrada em `main` no commit `c3d8bd1`; contratos de autenticação, administração, multas, tesouraria, dashboard e mural existentes.

## Objetivo

Redesenhar integralmente a interface com uma experiência mobile-first coerente, acessível e responsiva, e tornar a aplicação instalável como PWA sem alterar regras de negócio, contratos financeiros, RLS ou isolamento por equipa e época.

## Escopo assumido

- Aprovar uma direção visual antes de alterar componentes ou rotas da aplicação.
- Consolidar tokens, estados e adaptações desktop da direção escolhida, deixando o contrato pronto para temas adicionais.
- Redesenhar login, password, Painel, Mural, multas, Tesouraria, Admin, navegação e definições.
- Implementar bottom navigation por permissões, acessibilidade, responsividade, code splitting e PWA online-first.
- Impedir escritas financeiras e administrativas sem rede e excluir dados pessoais, financeiros e de autenticação de caches persistentes.

## Decisões tomadas

| Data       | Decisão                                                                                                         | Justificação                                                                                                            | Impacto                                                                                                                |
| ---------- | --------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-09-22 | Partir de `main` atualizada exclusivamente por fast-forward até `c3d8bd1`, na branch `feature/ui-mobile-e-pwa`. | A Fase 07 depende da integração integral da experiência de membro entregue pela Fase 06.                                | O trabalho fica isolado e baseado no estado aprovado mais recente.                                                     |
| 2026-09-22 | Separar a aprovação visual da implementação.                                                                    | A direção visual deve ser comparada e aprovada antes de afetar a interface de produção.                                 | Nesta etapa apenas o diário é alterado no repositório; protótipos temporários ficam fora.                              |
| 2026-09-22 | Aprovar “Balneário Premium” como única direção visual a implementar nesta fase.                                 | Mantém identidade forte e limita o custo inicial; “Clube Minimalista” e outras famílias poderão ser adicionadas depois. | Os componentes usam tokens semânticos e um registo extensível de temas, sem apresentar opções ainda não implementadas. |
| 2026-09-22 | Manter a aplicação online-first e limitar o cache persistente ao shell e a recursos estáticos da mesma origem.  | Dados pessoais, financeiros, de autenticação e respostas Supabase não devem persistir no service worker.                | Navegação com fallback offline; escritas financeiras e administrativas são recusadas sem ligação.                      |
| 2026-09-22 | Carregar rotas e providers funcionais sob procura.                                                              | O bundle inicial excedia 750 kB e incluía integrações não necessárias no primeiro ecrã.                                 | O chunk principal desceu para cerca de 390 kB e o cliente Supabase ficou separado.                                     |
| 2026-09-22 | Remover o aviso interno de instalação após a validação manual.                                                  | A instalação deve ficar ao critério do utilizador através da interface nativa do browser.                               | A PWA continua instalável, mas a aplicação não interceta `beforeinstallprompt` nem apresenta o botão “Instalar”.       |

## Trabalho realizado

### Preparação

- Lidas as fontes de verdade, a matriz RLS/RBAC e os diários das Fases 05 e 06.
- Confirmada a integração da Fase 06 em `main` no commit `c3d8bd1`.
- Atualizada `main` exclusivamente por fast-forward e confirmada a árvore de trabalho limpa antes da criação da branch.
- Criada a branch `feature/ui-mobile-e-pwa`.
- Iniciada a análise da interface existente e a preparação de três propostas visuais isoladas do código de produção.

### Auditoria inicial da interface

- O shell autenticado usa cabeçalho alto e navegação horizontal com scroll, sem bottom navigation nem consideração explícita de safe areas.
- Os domínios repetem classes de cartões, campos e botões com pequenas diferenças; falta uma camada visual partilhada e coerente.
- A hierarquia atual trata métricas, formulários e listas de forma semelhante, reduzindo a leitura rápida dos valores e estados financeiros.
- As confirmações financeiras e destrutivas ainda recorrem a diálogos nativos do browser, sem apresentação consistente nem controlo de foco próprio.
- Existem estados textuais de carregamento, erro e vazio, mas ainda não formam um padrão visual comum e não incluem skeletons.
- A navegação já filtra permissões funcionais, mas apresenta password juntamente com áreas primárias e não diferencia a experiência móvel da adaptação desktop.
- O tema é exclusivamente claro e as cores, raios e sombras estão parcialmente centralizados; não existe preferência claro/escuro/sistema.
- O `router` importa todas as áreas de forma síncrona, contribuindo para o chunk inicial de 755,66 kB reportado na Fase 06.

### Propostas visuais para aprovação

- Preparadas três pranchas comparáveis, cada uma com login, Painel pessoal, Mural da Vergonha, aplicação de multa, Tesouraria e bottom navigation por permissões.
- A proposta A, “Balneário Premium”, usa verde profundo, preto e dourado, com cartões densos e forte destaque competitivo.
- A proposta B, “Matchday”, usa verde vivo, marinho, branco e laranja, com ritmo de placar e tipografia energética.
- A proposta C, “Clube Minimalista”, usa fundo claro, verde florestal e azul, com menos decoração e maior serenidade visual.
- Os protótipos usam conteúdo fictício em português de Portugal, valores em euros, jogador com número, capitão, equipa técnica, estados pago/pendente e navegação distinta para membro, tesoureiro e Owner.
- As pranchas permanecem fora do repositório e nenhuma proposta foi aplicada ao código de produção.

### Direção aprovada

- A proposta A, “Balneário Premium”, foi escolhida como única família visual da implementação inicial.
- A proposta C não será implementada nesta fase, mas a estrutura visual deve permitir adicionar famílias futuras através de tokens e configuração, sem duplicar componentes nem alterar domínios.
- O seletor da aplicação não deve anunciar ou permitir temas que ainda não estejam disponíveis.
- A consolidação da proposta A deve cobrir tokens, catálogo, Tesouraria, Owner/Admin, password, estados de sistema e adaptação desktop antes da confirmação final de implementação.

### Consolidação visual

- Definida uma paleta semântica inicial com fundo verde profundo, superfícies em camadas, dourado de ação, verde de sucesso, âmbar de pendência e vermelho de perigo.
- Definidas escalas iniciais de espaçamento, raios, sombras, tipografia, áreas táteis e estados de foco para utilização mobile-first.
- Preparados mockups adicionais para catálogo, liquidação em lote, Owner/Admin, definições e password, indisponibilidade de rede, carregamento, vazio, erro e confirmação destrutiva.
- Preparada uma adaptação desktop com navegação lateral, conteúdo principal e contexto secundário da época.
- A família inicial é identificada internamente como `balneario-premium`; tokens de componentes dependem de nomes semânticos e não de cores literais, permitindo introduzir `clube-minimalista` ou outra família no futuro.
- Apenas temas existentes devem aparecer nas definições; nesta fase não é apresentado um seletor funcional com opções indisponíveis.
- A implementação permaneceu suspensa até à confirmação final desta consolidação.

### Aprovação final

- A consolidação “Balneário Premium” foi aprovada em 2026-09-22.
- Autorizado avançar para a implementação integral da Fase 07 com esta família visual como único tema disponível.
- A arquitetura deve continuar preparada para adicionar “Clube Minimalista” ou outras famílias no futuro através do mesmo contrato de tokens.

### Implementação da interface

- Criado um registo tipado de temas com inicialização antes da montagem da aplicação, preferência local versionada e fallback para `balneario-premium`.
- Substituída a camada visual por tokens semânticos “Balneário Premium”, com contraste elevado, foco visível, áreas táteis mínimas, safe areas, redução de movimento e adaptações desde 320 px até desktop.
- Reestruturado o shell autenticado com cabeçalho compacto e bottom navigation por permissões em mobile, folha acessível “Mais” para destinos secundários e barra lateral em desktop.
- Redesenhados login, password, Painel, Mural, catálogo/aplicação de multas, Tesouraria e áreas administrativas sem mover regras de negócio para componentes.
- Uniformizados carregamento, vazio, erro, offline, atualização disponível e confirmação destrutiva; os diálogos controlam foco, `Escape` e ciclo de tabulação.

### PWA e funcionamento offline

- Expandido o manifesto com identidade, cores, ícones PNG/SVG, categorias e atalhos.
- Implementado service worker online-first para navegação, cache-first com atualização para recursos estáticos e fallback offline explícito.
- Excluídos de cache todos os pedidos cross-origin e caminhos de Auth, REST, RPC e Storage.
- Adicionados avisos de indisponibilidade de rede e nova versão; a atualização só é ativada após ação explícita.
- O registo PWA foi colocado na raiz da aplicação, incluindo o login, e recebe um identificador distinto por build para que novas publicações sejam detetadas mesmo quando o ficheiro base do service worker não muda.
- Introduzida uma guarda partilhada que bloqueia escritas administrativas, de multas e tesouraria antes do gateway quando não existe ligação.

### Desempenho e composição

- As páginas e providers de membro, finanças e administração passaram a ser carregados por rota com `lazy` e `Suspense`.
- O gateway de autenticação carrega a integração Supabase apenas quando necessária, preservando a interface síncrona de eventos de sessão.
- O build deixou de emitir o aviso de chunks acima de 500 kB: o chunk principal passou de 755,66 kB (216,56 kB gzip) para cerca de 389,99 kB (122,51 kB gzip), com Supabase num chunk de 203,33 kB (52,10 kB gzip).

### Validação remota e manual

- Executados os fluxos E2E contra o projeto Supabase descartável autorizado `showcasetestref00001`; as contas da suite foram removidas automaticamente no final.
- A primeira passagem expôs seletores antigos para a navegação móvel e para as confirmações nativas substituídas por diálogos acessíveis. Os testes foram alinhados com os novos nomes acessíveis e com a confirmação explícita dentro do diálogo.
- A repetição passou os 10 cenários em Chromium desktop e móvel, cobrindo autenticação, Owner/Admin, catálogo, aplicação, liquidação, reabertura, eliminação, Painel, Mural e manifesto.
- Criadas contas temporárias independentes para jogador, capitão, equipa técnica, tesoureiro e Owner. Todas foram confirmadas por login durante a validação manual.
- A pré-visualização de produção foi disponibilizada em `http://127.0.0.1:4173`; as credenciais ficaram apenas em `.manual-validation/*.local.json`, pasta ignorada pelo Git.
- A validação manual foi aprovada pelo utilizador. O aviso interno de instalação foi removido, preservando a instalação através da interface dos browsers compatíveis.
- Inventariados e removidos o Owner, o membro, a fotografia, os eventos, os restantes perfis e os dados financeiros temporários. As verificações pós-limpeza devolveram zero registos, ficheiros, ponteiros e identidades Auth.
- Removidas as credenciais e os artefactos locais de validação e encerradas todas as pré-visualizações locais da fase.

## Ficheiros criados ou alterados

| Ficheiro ou área                                                                           | Tipo de alteração | Motivo                                                                     |
| ------------------------------------------------------------------------------------------ | ----------------- | -------------------------------------------------------------------------- |
| `docs/01-arquitetura.md`, `docs/README.md`, `README.md`                                    | alterados         | Atualizar arquitetura PWA, temas e estado da implementação.                |
| `docs/fases/07-ui-mobile-e-pwa.md`                                                         | criado            | Registo único e contínuo da Fase 07.                                       |
| `index.html`, `public/manifest.webmanifest`, `public/offline.html`                         | alterados/criados | Metadados, instalação e fallback PWA.                                      |
| `public/service-worker.js`, `public/icons/*`                                               | criados/alterados | Cache seguro, atualização e identidade instalável.                         |
| `src/styles/index.css`                                                                     | alterado          | Tokens e componentes visuais mobile-first “Balneário Premium”.             |
| `src/shared/theme/*`, `src/shared/pwa/*`, `src/shared/network/*`                           | criados           | Registo de temas, estado PWA e bloqueio de escritas offline.               |
| `src/shared/components/AppIcon.tsx`, `src/shared/components/ConfirmDialog.tsx`             | criados           | Iconografia consistente e confirmação acessível.                           |
| `src/app/layout/AppShell.tsx`, `src/app/navigation.ts`                                     | alterados         | Navegação responsiva e filtrada por permissões.                            |
| `src/app/router.tsx`, `src/app/AppProviders.tsx`, `src/app/providers/*`                    | alterados/criados | Code splitting por rota e providers locais.                                |
| `src/app/serviceOverrides.tsx`, `src/domains/auth/services/createAuthService.ts`           | criados/alterados | Injeção de serviços para testes e carregamento diferido do gateway.        |
| `src/app/member/*`, `src/app/financial/*`, `src/domains/auth/*`                            | alterados         | Redesign dos fluxos funcionais e das páginas transversais.                 |
| `src/domains/admin/services/AdminService.ts`                                               | alterado          | Bloqueio de mutações administrativas offline.                              |
| `src/domains/fines/services/FinesService.ts`                                               | alterado          | Bloqueio de mutações de multas offline.                                    |
| `src/domains/treasury/services/TreasuryService.ts`                                         | alterado          | Bloqueio de mutações de tesouraria offline.                                |
| `scripts/prepare-manual-*.mjs`                                                             | alterados         | Identificar credenciais temporárias com a fase de validação atual.         |
| `scripts/cleanup-manual-member.mjs`                                                        | alterado          | Identificar e confirmar a limpeza de contas temporárias da Fase 07.        |
| `e2e/admin.spec.ts`, `e2e/financial.spec.ts`, `e2e/member.spec.ts`                         | alterados         | Validar nomes responsivos e confirmações acessíveis no redesign.           |
| `src/**/*.test.ts(x)`, `tests/scripts/pwa.test.mjs`, `tests/scripts/ui-contracts.test.mjs` | criados/alterados | Cobertura de navegação, temas, offline, diálogos, PWA e contratos visuais. |

## Base de dados, contratos e migrações

- Migrações adicionadas: nenhuma.
- Alterações de schema: nenhuma.
- Funções/RPCs/Edge Functions: sem alterações.
- Políticas RLS: sem alterações.
- Contratos de domínio: inalterados; apenas foi acrescentada uma falha local explícita quando uma mutação é iniciada offline.
- Compatibilidade e dados existentes: preservados, sem migração ou limpeza de dados.

## Testes e verificações

| Comando/cenário                                    | Resultado | Observações                                                                          |
| -------------------------------------------------- | --------- | ------------------------------------------------------------------------------------ |
| Confirmação do commit `c3d8bd1` em `main`          | passou    | Fase 06 presente na base da Fase 07.                                                 |
| `git pull --ff-only origin main`                   | passou    | Fast-forward de `1b03ad3` para `c3d8bd1`.                                            |
| `git status --short --branch` antes da nova branch | passou    | Árvore limpa em `main`.                                                              |
| Renderização das propostas A, B e C                | passou    | Três pranchas a 2400 × 1123 px, com ecrãs de 390 × 844 px.                           |
| Inspeção visual das três pranchas                  | passou    | Conteúdo, contraste base, alinhamento e navegação verificados.                       |
| Consolidação mobile de “Balneário Premium”         | passou    | Catálogo, liquidação, Admin, password e estados revistos.                            |
| Adaptação desktop de “Balneário Premium”           | passou    | Navegação lateral e distribuição responsiva validadas visualmente.                   |
| `npm run format:check`                             | passou    | Todos os ficheiros respeitam a formatação definida.                                  |
| `npm run lint`                                     | passou    | Sem erros ou avisos.                                                                 |
| `npm run typecheck`                                | passou    | Contratos TypeScript válidos.                                                        |
| `npm test`                                         | passou    | 25 ficheiros e 82 testes aprovados após o redesign.                                  |
| `npm run test:db`                                  | passou    | 8 testes de migrações, constraints, RLS, RPCs e reporting.                           |
| `npm run build`                                    | passou    | Build sem chunks acima de 500 kB; chunk principal 389,52 kB.                         |
| Inspeção visual local                              | passou    | Login revisto a 320 × 720, 390 × 844 e 1280 × 900 px.                                |
| Auditoria responsiva em Chromium                   | passou    | 320, 360, 390, 430, 768 e 1280 px sem overflow horizontal; alvo principal com 48 px. |
| Service worker e offline em Chromium               | passou    | Registo versionado no login e navegação offline servida pelo shell em cache.         |
| `npm run test:e2e`                                 | passou    | 10/10 cenários em Chromium desktop e móvel contra o projeto descartável autorizado.  |
| Login das contas de validação manual               | passou    | Jogador, capitão, equipa técnica, tesoureiro e Owner confirmados.                    |
| Ausência do aviso interno de instalação            | passou    | Texto e tratamento de `beforeinstallprompt` ausentes do código e do build final.     |
| Limpeza remota e local                             | passou    | Contagens pós-limpeza a zero; credenciais, fotografia, logs e identidades removidos. |
| Integridade de `supabase/seed.sql`                 | passou    | Ficheiro inalterado relativamente a `main`.                                          |

## Desvios ao planeamento

- O pedido inicial previa temas claro e escuro; a decisão posterior do utilizador substituiu-o por uma única família escura “Balneário Premium”, mantendo extensibilidade para a proposta C e outros temas.

## Riscos e limitações

- A instalação PWA permanece disponível através da interface própria dos browsers compatíveis; por decisão de produto, a aplicação não apresenta um aviso interno de instalação.
- O tema “Clube Minimalista” não está implementado nem é apresentado; a arquitetura está apenas preparada para o receber.

## Trabalho pendente

- [x] Inventariar fluxos, componentes, inconsistências e limitações móveis da interface atual.
- [x] Apresentar três propostas visuais de alta fidelidade e recolher a decisão.
- [x] Consolidar tokens e ecrãs adicionais da direção aprovada.
- [x] Obter confirmação final antes da implementação quando existirem alterações relevantes.
- [x] Implementar o redesign, temas, navegação, acessibilidade, responsividade, PWA e code splitting.
- [x] Executar a bateria de testes, auditorias e E2E desktop/móvel.
- [x] Recolher a validação manual final do utilizador e remover os dados temporários após aprovação.
- [x] Publicar a branch e abrir um PR Draft, sem merge.

## Handoff para a fase seguinte

- Não iniciar a Fase 08 antes de concluir e validar a Fase 07.
- Preservar todos os contratos financeiros, RLS, snapshots, idempotência e isolamento por equipa e época.
- Adicionar novos temas apenas através do registo tipado e do contrato de tokens semânticos; não duplicar componentes ou regras de domínio.
- Manter o service worker afastado de Auth, REST, RPC, Storage e de qualquer resposta com dados pessoais ou financeiros.
- Não converter falhas offline em filas de escrita: operações financeiras e administrativas continuam a exigir confirmação do servidor.
- A Fase 07 está concluída e pronta para integração; manter o PR sem merge até decisão explícita.
