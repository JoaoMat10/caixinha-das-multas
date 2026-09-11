# Contexto e escopo do produto

## 1. Objetivo

A **Caixinha das Multas** e uma aplicacao para gerir multas internas de um balneario/plantel de futebol.

Os pagamentos acontecem fora da aplicacao, por exemplo em dinheiro, MB Way ou transferencia. A aplicacao nao recebe dinheiro, nao integra meios de pagamento e nao confirma transacoes externas. Serve exclusivamente para:

- aplicar multas;
- controlar multas por pagar e pagas;
- manter historico e totais;
- apresentar o saldo recebido;
- disponibilizar rankings coletivos.

## 2. Estrategia de produto

### Fase atual

- Web app mobile-first.
- Acesso atraves de URL no browser do telemovel.
- Instalavel como PWA.
- Desenvolvimento e testes principais num PC Windows.

### Fase futura

- Empacotamento Android e iOS com Capacitor.
- A compilacao nativa nao condiciona o MVP e sera tratada num trabalho futuro.

## 3. Modelo operacional

O sistema pode conter varias equipas e varias epocas, mas apenas o Super Admin as cria e administra.

Uma equipa e uma entidade permanente. Cada equipa pode ter varias epocas, mas apenas uma deve estar ativa de cada vez. Plantel, funcoes, catalogo de multas, multas e totais pertencem sempre a uma epoca concreta.

Ao criar uma epoca, o Super Admin pode copiar da epoca anterior:

- membros do plantel;
- tipos de membro;
- numeros de camisola e funcoes tecnicas;
- capitaes e tesoureiros;
- catalogo de multas.

Multas e pagamentos nunca sao copiados entre epocas.

## 4. Perfis de utilizacao

### Super Admin / Owner

- Existe como permissao global e privada.
- E o unico que ve a tab Admin.
- Cria e gere equipas, epocas e utilizadores.
- Associa utilizadores aos planteis.
- Define tipos e funcoes dos membros.
- Define o nome apresentado na app.
- Carrega, substitui ou remove fotografias.
- Pode participar numa equipa como jogador atraves de uma associacao normal ao plantel.
- A qualidade de Super Admin nunca aparece para outros utilizadores.
- Ser Super Admin, por si so, nao concede operacoes de tesoureiro dentro de uma equipa. Para as executar, o utilizador deve tambem ser tesoureiro dessa epoca.

### Jogador

- E identificado por nome e numero da camisola.
- Ve o proprio saldo, historico e rankings autorizados.
- Paga o valor base das multas, salvo se tambem for capitao.

### Equipa tecnica

- E identificada por nome e funcao, por exemplo treinador, adjunto ou fisioterapeuta.
- Tem a mesma experiencia funcional de consulta de um jogador.
- Paga sempre 2x o valor base das multas.

### Capitao

- E uma funcao adicional, podendo existir varios por epoca.
- Surge com um pequeno badge de bracadeira com a letra `C` junto ao nome/numero.
- Paga 2x o valor base das multas.
- Nao recebe automaticamente permissoes de tesoureiro.

### Tesoureiro

- E uma funcao adicional atribuida a um jogador ou elemento da equipa tecnica.
- Pode coexistir com a funcao de capitao.
- Tem uma tab propria para aplicar, liquidar, reabrir e eliminar multas nos limites das regras de negocio.

## 5. Fora do escopo do MVP

- Processamento real de pagamentos.
- Pagamentos parciais.
- Introducao manual do montante recebido.
- Registo do metodo de pagamento.
- Gestao de despesas ou levantamentos.
- Auto-registo de utilizadores.
- Edicao de nome, username ou fotografia pelo proprio utilizador.
- Recuperacao automatica de password por email ou SMS.
- Notificacoes push.
- Aplicacoes Android/iOS publicadas.
- Funcionamento offline para escritas financeiras.

## 6. Metricas principais

- **Total multado:** soma das multas validas, pagas e por pagar.
- **Total recebido / saldo disponivel:** soma das multas atualmente pagas.
- **Total em divida:** soma das multas atualmente por pagar.
- **Mais multas:** numero de multas validas por membro.
- **Maior valor acumulado:** soma de multas validas por membro.
- **Maior divida atual:** soma de multas por pagar por membro.

Multas eliminadas nao entram em historicos, saldos ou rankings.
