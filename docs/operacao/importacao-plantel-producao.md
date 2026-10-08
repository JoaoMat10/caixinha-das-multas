# Importação do plantel em produção

> **Modelo demonstrativo:** todos os nomes, URLs, referências, identificadores e resultados abaixo são fictícios e servem apenas para documentar o procedimento. Substitua os placeholders por recursos próprios antes de executar qualquer operação.

Este procedimento popula uma equipa, uma época e o respetivo plantel através de
um manifesto local. Não executa `supabase/seed.sql`, não cria categorias nem
introduz multas ou pagamentos.

## Comando

O comando sem argumentos executa apenas o preflight read-only:

```powershell
npm run populate:production
```

A escrita exige o argumento explícito:

```powershell
npm run populate:production -- --apply
```

É possível indicar outro manifesto local:

```powershell
npm run populate:production -- --manifest .manual-validation/outro-plantel.local.json
```

## Dados locais

- O manifesto fica em `.manual-validation/` e nunca é versionado.
- As passwords temporárias ficam em
  `.manual-validation/clube-desportivo-exemplo-production-credentials.local.json`.
- `Fotos/` e `outputs/` estão ignorados pelo Git para impedir a publicação
  acidental de fotografias, listas e credenciais.
- O ficheiro de credenciais deve ser eliminado depois de cada utilizador receber
  a sua password e concluir a mudança obrigatória.

## Proteções do importador

1. Confirma a referência de produção no registo versionado, na listagem remota e
   numa consulta read-only.
2. Exige que o vínculo local continue no projeto descartável.
3. Recusa usernames, números de camisola, tipos, funções ou roles inválidos.
4. Confirma que todas as fotografias pertencem à pasta autorizada, usam um tipo
   permitido e respeitam o limite de 5 MiB.
5. Recusa dados financeiros preexistentes ou utilizadores que não pertençam ao
   manifesto.
6. Cria identidades Auth e perfis com chaves de idempotência determinísticas.
7. Cria equipa, época, memberships e roles através dos contratos administrativos
   existentes e numa transação PostgreSQL.
8. Carrega fotografias com caminhos UUID e só depois atualiza os perfis através
   de `set_admin_photo`.
9. Remove uploads novos se a associação transacional das fotografias falhar.
10. Faz uma auditoria final independente de contagens, usernames, roles,
    fotografias, Owner e ausência de dados financeiros.

O importador não elimina contas nem dados funcionais. Uma falha parcial deve ser
inventariada e retomada com o mesmo manifesto e ficheiro local de credenciais.

## Execução de 29 de setembro de 2026

O importador foi executado uma vez em `showcaseprodref00001` para a equipa
`Clube Desportivo Exemplo` e a época ativa `2026/2027`.

- 29 utilizadores e 29 memberships ativos;
- 26 jogadores e 3 elementos da equipa técnica;
- 28 contas novas com mudança obrigatória de password;
- o Owner `demo.admin` foi associado como Administrador Demo, jogador com camisola
  21, sem criar uma segunda identidade;
- 5 capitães e 1 tesoureiro;
- 28 fotografias privadas; Mariana Ferreira permanece sem fotografia;
- zero categorias, multas, batches ou logs de pagamento.

Idade e nacionalidade existiam na folha de recolha, mas não pertencem ao modelo
de dados aprovado e não foram persistidas.
