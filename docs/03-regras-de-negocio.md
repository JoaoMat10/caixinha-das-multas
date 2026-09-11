# Regras de negocio aprovadas

## 1. Identidade e contas

1. Nao existe auto-registo.
2. Apenas o Super Admin cria utilizadores.
3. O login visivel usa username e password.
4. O nome mostrado na aplicacao e definido pelo Super Admin.
5. Apenas o Super Admin carrega ou altera fotografias.
6. O novo utilizador recebe uma password temporaria e e obrigado a altera-la no primeiro login.
7. O utilizador pode alterar apenas a propria password.
8. Uma password esquecida e reposta pelo Super Admin.
9. Desativar um utilizador impede novos logins sem destruir o historico.

## 2. Equipas e epocas

1. Apenas o Super Admin cria, edita ou arquiva equipas e epocas.
2. Cada multa pertence a uma unica epoca.
3. Cada utilizador pode ter associacoes diferentes em epocas/equipas diferentes.
4. Deve existir a opcao de copiar plantel, funcoes e catalogo da epoca anterior.
5. A copia nunca inclui multas, liquidacoes ou saldos.

## 3. Tipos e funcoes

1. Cada membro e jogador ou equipa tecnica.
2. Jogador e mostrado por nome e numero de camisola.
3. Equipa tecnica e mostrada por nome e funcao.
4. Capitao e tesoureiro sao funcoes adicionais.
5. Podem existir varios capitaes e tesoureiros.
6. Tesoureiro pode ser jogador, equipa tecnica e/ou capitao.
7. Capitao recebe um badge pequeno com uma bracadeira e `C`.
8. Super Admin e invisivel enquanto permissao; se estiver no plantel, aparece apenas com o perfil desse plantel.

## 4. Multiplicadores

1. Jogador normal paga 1x.
2. Equipa tecnica paga 2x.
3. Capitao paga 2x.
4. Multiplicadores nao acumulam: o maximo e sempre 2x.
5. Ser tesoureiro nao altera o valor.
6. O multiplicador e fixado quando a multa e aplicada.
7. Alteracoes posteriores de tipo/role nao alteram multas existentes.

Formula:

```text
valor final = valor base da categoria no momento da aplicacao x multiplicador do membro
```

## 5. Aplicacao de multa

1. Apenas um tesoureiro da epoca pode aplicar multas nessa epoca.
2. Seleciona membro, categoria, data e observacao opcional.
3. O valor nao e introduzido livremente: vem da categoria e do multiplicador.
4. Antes da confirmacao, a app mostra membro, categoria, valor base, multiplicador e total.
5. O servidor valida tesoureiro, epoca, membro, categoria, estado e idempotencia.
6. A multa guarda snapshots do nome da categoria, valor base e multiplicador.
7. A categoria ou perfil alterados posteriormente nao reescrevem o passado.

## 6. Liquidacao de multas

1. O tesoureiro escolhe um membro e uma ou varias multas pendentes.
2. A app calcula o total automaticamente.
3. O tesoureiro nao introduz o montante recebido.
4. Nao se regista o metodo de pagamento.
5. Nao existem pagamentos parciais.
6. A confirmacao marca todas as multas selecionadas como pagas numa operacao atomica.
7. E criado um batch e um log imutavel por multa.
8. O saldo recebido aumenta pela soma exata das multas marcadas como pagas.

## 7. Reabertura/correcao

1. Um tesoureiro pode corrigir uma liquidacao marcando uma multa paga novamente como pendente.
2. A correcao cria um novo log `reopened`; nao apaga o log original.
3. O saldo recebido diminui pelo valor da multa.
4. Uma multa que tenha sido paga pelo menos uma vez fica permanentemente protegida contra eliminacao.

## 8. Eliminacao de multas

1. Apenas um tesoureiro da respetiva epoca pode eliminar uma multa.
2. Apenas multas pendentes que nunca tenham sido pagas podem ser eliminadas.
3. Uma multa paga nao pode ser eliminada.
4. Reabrir uma multa paga nao a torna eliminavel.
5. Nao e pedido nem armazenado um motivo funcional de eliminacao; a decisao e discutida pessoalmente antes da operacao.
6. A interface exige confirmacao explicita.
7. Depois da eliminacao, a multa desaparece dos registos funcionais, saldos e rankings.
8. Super Admin sem funcao de tesoureiro nessa epoca nao pode eliminar multas.

## 9. Catalogo

1. O catalogo e definido por epoca.
2. Apenas um tesoureiro da respetiva epoca pode criar, alterar, ordenar ou desativar categorias.
3. O Super Admin so gere o catalogo se tambem tiver a funcao de tesoureiro nessa epoca.
4. Valores sao apresentados em euros com duas casas decimais.
5. O valor minimo suportado inclui `0,10 EUR`.
6. A categoria define o valor base; o multiplicador e aplicado pela app.
7. Alterar uma categoria afeta apenas multas futuras.
8. Categorias utilizadas podem ser desativadas, preservando referencias historicas.

## 10. Rankings

O Mural da Vergonha tem, pelo menos:

- ranking por quantidade de multas validas;
- ranking por valor total acumulado;
- ranking por divida atual.

Multas eliminadas nao contam. Multas pagas contam no acumulado, mas nao na divida atual. O estado de Super Admin nunca e revelado.

## 11. Saldos

```text
total multado = multas pendentes + multas pagas
total recebido = multas atualmente pagas
total em divida = multas atualmente pendentes
saldo disponivel para o jantar = total recebido
```

Nao existem despesas, levantamentos ou outros movimentos de caixa no MVP.

## 12. Estados permitidos

```text
aplicar multa  -> pending
liquidar       -> paid
reabrir        -> pending, mas has_ever_been_paid continua true
eliminar       -> permitido apenas em pending e has_ever_been_paid false
```
