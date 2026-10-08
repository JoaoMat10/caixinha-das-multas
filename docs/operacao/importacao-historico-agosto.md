# Importação do histórico de agosto de 2026

> **Modelo demonstrativo:** todos os nomes, URLs, referências, identificadores e resultados abaixo são fictícios e servem apenas para documentar o procedimento. Substitua os placeholders por recursos próprios antes de executar qualquer operação.

## Âmbito

Esta operação regista as multas de agosto da época `2026/2027` da equipa
`Clube Desportivo Exemplo`. Todas as ocorrências são importadas como liquidadas. Agosto não
tem comissão mensal.

## Proteções

- alvo fixo: `showcaseprodref00001`;
- o checkout principal tem de continuar ligado ao projeto descartável;
- exige exatamente 29 membros ativos e as 23 categorias oficiais;
- exige zero multas, batches, logs e categorias de comissão antes da escrita;
- o modo por omissão é read-only; a escrita exige `--apply`;
- toda a importação ocorre numa única transação;
- a repetição posterior funciona apenas como auditoria detalhada do resultado.

## Mapa importado

| Utilizador          | Multa | Data       | Multiplicador |
| ------------------- | ----: | ---------- | ------------: |
| `alexandre.silva1`  |    16 | 2026-08-08 |            1x |
| `yuri.martins77`    |    14 | 2026-08-02 |            1x |
| `yuri.martins77`    |    12 | 2026-08-06 |            1x |
| `antonio.silva19`   |    17 | 2026-08-04 |            1x |
| `william.costa7`    |    14 | 2026-08-03 |            1x |
| `william.costa7`    |    17 | 2026-08-07 |            1x |
| `diogo.almeida39`   |    16 | 2026-08-01 |            1x |
| `diogo.almeida39`   |    16 | 2026-08-05 |            1x |
| `diogo.almeida39`   |    17 | 2026-08-04 |            1x |
| `ivo.pereira3`      |    16 | 2026-08-02 |            1x |
| `xavier.ferreira11` |    10 | 2026-08-07 |            1x |
| `ze.miguel10`       |    11 | 2026-08-09 |            1x |
| `ze.miguel10`       |    17 | 2026-08-10 |            1x |
| `oscar.rodrigues6`  |    16 | 2026-08-03 |            2x |
| `ricardo.azevedo30` |    10 | 2026-08-01 |            1x |
| `ricardo.azevedo30` |    14 | 2026-08-06 |            1x |
| `bernardo.sousa9`   |    21 | 2026-08-04 |            1x |
| `bernardo.sousa9`   |    17 | 2026-08-05 |            1x |

`Óscar Rodrigues` corresponde ao Óscar Rodrigues. O multiplicador 2x desta ocorrência é
histórico e não é inferido das funções atuais. William Costa e Diogo Almeida contam como jogadores
normais nas ocorrências de agosto.

## Execução

```powershell
npm run populate:production:august-fines
npm run populate:production:august-fines -- --apply
npm run populate:production:august-fines
```

## Resultado

- 18 multas, todas com estado `paid` e `has_ever_been_paid=true`;
- 11 batches de liquidação e 18 logs imutáveis;
- total recebido: `37,00 EUR`;
- zero multas de comissão em agosto;
- uma categoria mensal protegida, disponível apenas para meses concluídos a
  partir de setembro de 2026;
- dry-run de migrações final sem migrações, seeds ou roles pendentes.
