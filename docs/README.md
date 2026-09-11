# Documentacao — Caixinha das Multas

Esta pasta contem a especificacao aprovada e o historico de implementacao da aplicacao. Deve ser usada como fonte de contexto em todas as fases de trabalho neste projeto.

## Fonte de verdade

| Documento                                          | Conteudo                                             |
| -------------------------------------------------- | ---------------------------------------------------- |
| [00-contexto-e-escopo.md](00-contexto-e-escopo.md) | Objetivo, utilizadores, limites e definicao do MVP   |
| [01-arquitetura.md](01-arquitetura.md)             | Stack, modulos, seguranca, autenticacao e alojamento |
| [02-modelo-de-dados.md](02-modelo-de-dados.md)     | Entidades, relacoes, estados e constraints           |
| [03-regras-de-negocio.md](03-regras-de-negocio.md) | Regras funcionais e fluxos criticos aprovados        |
| [04-plano-de-execucao.md](04-plano-de-execucao.md) | Fases, ordem, entregaveis e criterios de conclusao   |
| [fases/TEMPLATE.md](fases/TEMPLATE.md)             | Modelo obrigatorio do diario de cada fase            |

## Como iniciar uma nova fase de implementacao

1. Identificar a fase exata a executar.
2. Ler todos os documentos desta pasta antes de alterar a implementacao.
3. Criar o ficheiro de fase indicado no plano, a partir do template.
4. Implementar apenas o escopo dessa fase e manter o diario atualizado.
5. No final, registar testes, limitacoes e handoff para a fase seguinte.

## Estado global

- Planeamento funcional: **aprovado**
- Implementacao: **Fase 01 concluida**
- Fase seguinte: **Fase 02 — Base de Dados e RLS**
- App nativa: fora do MVP atual; sera planeada depois da estabilizacao da PWA

## Principios imutaveis sem nova aprovacao

- O produto e um livro-razao; nao processa pagamentos reais.
- O Super Admin e global, invisivel no plantel e o unico gestor de equipas, epocas, utilizadores e fotografias.
- Existem dois tipos base de membro: jogador e equipa tecnica.
- Capitao e tesoureiro sao funcoes adicionais acumulaveis.
- Equipa tecnica e capitaes pagam 2x; multiplicadores nunca acumulam acima de 2x.
- O tesoureiro nao introduz montantes pagos: seleciona multas completas e a app calcula o total.
- Nao existem pagamentos parciais nem registo do metodo de pagamento no MVP.
- Apenas multas nunca pagas podem ser eliminadas, exclusivamente por um tesoureiro.
- Uma multa que ja tenha sido paga nunca pode ser eliminada, mesmo que seja posteriormente reaberta.
- O saldo disponivel e a soma das multas atualmente liquidadas.
