# Fase 03 — Autenticação e Sessões

## Estado

- Estado: em curso
- Responsável: equipa de engenharia
- Início: 2026-09-14
- Última atualização: 2026-09-14
- Dependências recebidas: Fase 02 integrada em `main` pelo commit squash `e628b50`; fronteiras modulares reforçadas em `03a6302`. A validação oficial da stack Supabase local permanece como primeiro checkpoint desta fase.

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

| Data       | Decisão                                                                                                                       | Justificação                                                                                                                              | Impacto                                                                                                                |
| ---------- | ----------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------- |
| 2026-09-14 | Usar a branch `feature/autenticacao-e-sessoes` criada a partir de `main` limpa e sincronizada com `origin/main`.              | Mantém a Fase 03 isolada e pronta para revisão por pull request.                                                                          | Nenhuma alteração da fase será feita diretamente em `main`.                                                            |
| 2026-09-14 | Usar uma exceção `safe.directory` apenas por comando Git.                                                                     | O utilizador efetivo do ambiente difere do proprietário do checkout e a configuração Git global não deve ser alterada desnecessariamente. | Operações Git permanecem limitadas a este repositório.                                                                 |
| 2026-09-14 | Instalar o Supabase CLI 2.117.0 como dependência de desenvolvimento do projeto.                                               | É a instalação por projeto suportada oficialmente, evita dependência global e fixa a ferramenta no lockfile.                              | Os scripts npm resolvem o executável local; continua a ser necessário um runtime compatível com Docker.                |
| 2026-09-14 | Propor Docker Desktop com backend WSL 2 para a stack local em Windows, condicionado à licença gratuita aplicável.             | É o caminho recomendado pela documentação Supabase para Windows e suporta toda a stack local.                                             | Requer autorização antes da instalação externa; alternativas compatíveis são Rancher Desktop ou Podman.                |
| 2026-09-14 | Executar a stack Supabase oficial num runner descartável do GitHub Actions, sem instalar um runtime de containers no Windows. | O disco `C:` dispõe de apenas 3,1 GB livres e o utilizador privilegiou minimizar instalações locais.                                      | O checkpoint pgTAP e os testes reais de Auth correrão em CI; os testes unitários e o harness PGlite permanecem locais. |

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

## Ficheiros criados ou alterados

| Ficheiro                                  | Tipo de alteração | Motivo                                                                   |
| ----------------------------------------- | ----------------- | ------------------------------------------------------------------------ |
| `docs/fases/03-autenticacao-e-sessoes.md` | criado            | Diário obrigatório e handoff da Fase 03.                                 |
| `package.json`                            | alterado          | Supabase CLI disponível como dependência de desenvolvimento local.       |
| `package-lock.json`                       | alterado          | Versão e dependências transitivas do CLI fixadas de forma reproduzível.  |
| `.github/workflows/database-supabase.yml` | criado            | Executar a validação Supabase oficial sem dependências no Windows local. |
| `README.md`                               | alterado          | Documentar o CLI por projeto e a alternativa de validação em CI.         |

## Base de dados, contratos e migrações

- Migrações adicionadas: nenhuma até ao momento.
- Alterações de schema: nenhuma até ao momento.
- Funções/RPCs/Edge Functions: nenhuma até ao momento.
- Políticas RLS: sem alterações até ao momento.
- Compatibilidade e dados existentes: por validar na stack Supabase local antes da implementação de autenticação.

## Testes e verificações

| Comando/cenário                                 | Resultado | Observações                                                                                                   |
| ----------------------------------------------- | --------- | ------------------------------------------------------------------------------------------------------------- |
| Verificação de branch, histórico e working tree | passou    | `main` e `origin/main` em `03a6302`; árvore limpa; conteúdo do PR #2 confirmado pelo commit squash `e628b50`. |
| `npm exec -- supabase --version`                | passou    | CLI local 2.117.0.                                                                                            |
| `npm run test:db:supabase`                      | bloqueado | `LegacyLocalDbRunningError: failed to inspect service`; não existe runtime de containers instalado.           |

## Desvios ao planeamento

- Nenhum até ao momento.

## Riscos e limitações

- A validação da stack Supabase oficial depende agora da disponibilidade e quota do GitHub Actions; não será instalado um runtime de containers neste host.
- O Node disponível no shell é 21.7.2, fora do intervalo declarado pelo projeto; as execuções finais devem usar Node 22.22.2 ou 24.15.0+.

## Trabalho pendente

- [ ] Concluir em GitHub Actions o checkpoint oficial da Fase 02 com quatro migrações, seed e 46 asserções pgTAP.
- [ ] Implementar contratos, regras, adaptador e estado de autenticação.
- [ ] Implementar login, sessão, logout, proteção de rotas e alteração de password.
- [ ] Implementar e executar testes unitários, reais/locais e E2E desktop/móvel.
- [ ] Executar o pipeline final, concluir o diário, publicar a branch e abrir o pull request.

## Handoff para a fase seguinte

- A completar no encerramento da fase.
