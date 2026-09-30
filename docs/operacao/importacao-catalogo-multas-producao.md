# Importação do catálogo de multas em produção

## Objetivo

Importar, de forma controlada, as 23 categorias da época `2026/2027` da equipa `Clube Desportivo Exemplo`.

O comando é read-only por omissão:

```powershell
npm run populate:production:catalog
```

A escrita exige a opção explícita:

```powershell
npm run populate:production:catalog -- --apply
```

## Proteções

- alvo fixo e confirmado como `showcaseprodref00001`;
- recusa se o checkout estiver ligado à produção;
- exige exatamente uma equipa, uma época ativa, 29 membros e o tesoureiro `jorge.sousa4`;
- recusa movimentos financeiros inesperados;
- só escreve sobre um catálogo vazio;
- usa uma única transação e as RPCs autorizadas de catálogo;
- confirma no final as 23 categorias, valores, ordem, estado e regra por minuto.

## Regra variável

`Atraso à concentração do jogo sem justificação` tem base de `3,00 €` e acréscimo de `0,10 €` por minuto. O tesoureiro indica minutos inteiros positivos e o servidor calcula:

```text
(3,00 € + 0,10 € × minutos) × multiplicador do membro
```

As restantes 22 categorias têm valor fixo. Nenhuma multa, pagamento ou saldo é criado pela importação do catálogo.

## Resultado de 2026-09-30

- migração `20260930010000_support_per_minute_fines.sql` aplicada em produção sem seed;
- 23 categorias criadas numa única transação;
- categoria n.º 2 confirmada com base de `3,00 €` e `0,10 €/min`;
- auditoria final confirmou as 23 categorias exatas e zero multas, batches ou logs de pagamento;
- dry-run final confirmou zero migrações, seeds ou roles pendentes.
