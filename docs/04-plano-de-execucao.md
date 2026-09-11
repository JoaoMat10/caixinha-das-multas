# Plano de execucao por fases

## 1. Metodo

A implementacao sera dividida em fases sequenciais, todas dentro do mesmo projeto. Cada fase:

1. le toda a documentacao de planeamento;
2. cria o diario de fase com o nome indicado abaixo;
3. implementa apenas o escopo da fase;
4. atualiza o diario durante o trabalho;
5. executa e regista os testes relevantes;
6. deixa um handoff claro para a fase seguinte.

As fases nao devem ser executadas em paralelo porque partilham o mesmo repositorio e dependem dos contratos produzidos anteriormente.

## 2. Fases

### Fase 01 — Fundacao Web

**Fase:** `01 - Fundacao Web`  
**Diario:** `docs/fases/01-fundacao-web.md`

Escopo:

- inicializar React, Vite e TypeScript;
- configurar Tailwind e design tokens iniciais;
- criar estrutura modular por dominio;
- configurar React Router;
- configurar TanStack Query, formularios e validacao;
- configurar lint, formatacao e testes base;
- preparar variaveis de ambiente sem segredos;
- adicionar manifest PWA inicial;
- criar shell mobile-first minimo e paginas placeholder;
- documentar comandos de desenvolvimento em Windows.

Criterios de conclusao:

- app arranca no browser;
- build de producao funciona;
- lint/typecheck/testes base passam;
- nenhuma chave secreta esta no repositorio;
- diario da fase completo.

### Fase 02 — Base de Dados e RLS

**Fase:** `02 - Base de Dados e RLS`  
**Diario:** `docs/fases/02-base-de-dados-e-rls.md`

Escopo:

- configurar Supabase e estrategia de migracoes;
- implementar o modelo de dados aprovado;
- criar constraints, indices e seeds;
- criar funcoes auxiliares de autorizacao;
- implementar RLS por operacao;
- implementar calculos derivados e vistas/RPCs seguras;
- preparar dados de teste para Owner, jogadores, equipa tecnica, capitao e tesoureiro.

Criterios de conclusao:

- migracoes reproduziveis;
- constraints financeiras e de roles validadas;
- utilizadores nao acedem a outras equipas/epocas;
- testes negativos de RLS documentados;
- diario da fase completo.

### Fase 03 — Autenticacao e Sessoes

**Fase:** `03 - Autenticacao e Sessoes`  
**Diario:** `docs/fases/03-autenticacao-e-sessoes.md`

Escopo:

- login por username/password;
- identificador tecnico interno;
- gestao segura de sessao;
- protecao de rotas;
- mudanca obrigatoria da password temporaria;
- alteracao posterior com validacao da password atual;
- estado de utilizador desativado;
- tratamento seguro de erros e loading.

Criterios de conclusao:

- login funcional para todos os perfis;
- primeiro login obriga mudanca de password;
- utilizador desativado nao entra;
- rotas e tabs respeitam permissoes;
- testes de auth relevantes passam.

### Fase 04 — Painel Super Admin

**Fase:** `04 - Painel Super Admin`  
**Diario:** `docs/fases/04-painel-super-admin.md`

Escopo:

- Edge Functions administrativas;
- criar/desativar utilizadores;
- repor password temporaria;
- gerir equipas e epocas;
- copiar uma epoca anterior;
- gerir plantel, tipo, numero, funcao, capitao e tesoureiro;
- upload/substituicao/remocao exclusiva de fotografias;
- auditoria administrativa;
- garantir invisibilidade da permissao Super Admin.

Criterios de conclusao:

- configuracao integral possivel pela app;
- criacao de conta e plantel e idempotente/segura;
- apenas Owner ve e usa Admin;
- copia de epoca nao copia multas ou pagamentos;
- Storage protegido por politicas.

### Fase 05 — Catalogo e Tesouraria

**Fase:** `05 - Catalogo e Tesouraria`  
**Diario:** `docs/fases/05-catalogo-e-tesouraria.md`

Escopo:

- permitir ao tesoureiro gerir o catalogo de multas da epoca;
- aplicar multa com snapshot e multiplicador;
- mostrar calculo antes de confirmar;
- listar e filtrar multas;
- selecionar varias multas de um membro;
- liquidar com total calculado;
- reabrir liquidacao com log imutavel;
- eliminar apenas multas nunca pagas;
- calcular totais da tesouraria.

Criterios de conclusao:

- multiplicador 2x nunca acumula;
- nao e possivel introduzir valores de pagamento;
- nao existem pagamentos parciais ou metodo;
- multas alguma vez pagas nao podem ser eliminadas;
- operacoes sao atomicas e resistentes a duplo toque;
- testes dos fluxos criticos passam.

### Fase 06 — Experiencia do Membro

**Fase:** `06 - Dashboard e Mural`  
**Diario:** `docs/fases/06-dashboard-e-mural.md`

Escopo:

- dashboard pessoal;
- divida e historico;
- separacao entre pagas e pendentes;
- apresentacao de jogador e equipa tecnica;
- badge de capitao;
- Mural da Vergonha por quantidade, acumulado e divida;
- garantir que dados privados e Super Admin nao sao expostos.

Criterios de conclusao:

- saldos coincidem com a base de dados;
- ranking exclui multas eliminadas;
- multas pagas nao entram na divida;
- cada membro ve apenas detalhe autorizado;
- estados vazios e erros funcionais implementados.

### Fase 07 — UI Mobile-First e PWA

**Fase:** `07 - UI Mobile e PWA`  
**Diario:** `docs/fases/07-ui-mobile-e-pwa.md`

Escopo:

- bottom navigation dependente de permissoes;
- dark mode desportivo;
- componentes e areas tateis consistentes;
- acessibilidade, contraste e navegacao por teclado;
- safe areas e teclado movel;
- loaders, feedback, confirmacoes e estados vazios finais;
- service worker e estrategia de atualizacao;
- instalacao PWA;
- teste responsivo em dispositivos/tamanhos representativos.

Criterios de conclusao:

- fluxos principais utilizaveis confortavelmente em telemovel;
- PWA instalavel;
- escritas financeiras nao funcionam silenciosamente offline;
- navegacao respeita player/staff/tesoureiro/Owner;
- auditoria de acessibilidade sem bloqueios graves.

### Fase 08 — Qualidade, Seguranca e Deploy

**Fase:** `08 - Testes Seguranca e Deploy`  
**Diario:** `docs/fases/08-testes-seguranca-e-deploy.md`

Escopo:

- completar testes unitarios e de integracao;
- testes end-to-end dos fluxos criticos;
- matriz completa de testes RLS/RBAC;
- testes de idempotencia e concorrencia basicos;
- verificacao de dependencias e segredos;
- deploy gratuito do frontend;
- configuracao de producao Supabase;
- backup manual e procedimento de restauracao;
- checklist operacional e de privacidade;
- smoke test em browser desktop e telemovel real.

Criterios de conclusao:

- pipeline de qualidade passa;
- nenhum acesso indevido conhecido;
- aplicacao publicada numa URL HTTPS;
- backup e restauracao documentados/testados;
- MVP pronto para piloto real.

### Fase futura — Capacitor Android/iOS

Nao faz parte do MVP atual. Sera criada apenas apos estabilizacao e validacao da PWA.

## 3. Dependencias entre fases

```text
01 Fundacao
    -> 02 Dados/RLS
        -> 03 Auth
            -> 04 Admin
                -> 05 Tesouraria
                    -> 06 Membro/Mural
                        -> 07 UI/PWA
                            -> 08 Testes/Deploy
```

Testes devem ser escritos em todas as fases; a Fase 08 completa e endurece a cobertura, nao substitui a verificacao incremental.

## 4. Gestao de alteracoes

Se surgir uma nova regra:

1. registar a decisao no diario da fase atual;
2. atualizar o documento de fonte de verdade afetado;
3. avaliar impacto em dados, RLS, UI e testes;
4. nao alterar retroativamente o significado de dados existentes sem migracao explicita.
