# Modelo de dados conceptual

Este documento descreve o modelo aprovado. Os nomes SQL definitivos podem ser refinados na Fase 02, desde que as relacoes, constraints e regras aqui descritas sejam preservadas.

## 1. Diagrama de relacoes

```text
auth.users ──1:1── users
users ──1:0..1── app_admins

teams ──1:N── seasons
users ──N:N── seasons                 atraves de season_members
season_members ──N:N── roles          atraves de member_roles

seasons ──1:N── fine_categories
season_members ──1:N── fines
fine_categories ──1:N── fines
users (tesoureiro) ──1:N── fines      como applied_by

payment_batches ──1:N── payment_logs
fines ──1:N── payment_logs
users (tesoureiro) ──1:N── payment_logs como recorded_by

users ──1:N── audit_events
```

## 2. Convencoes

- Chaves primarias UUID.
- Datas tecnicas em `timestamptz`/UTC.
- Valores monetarios em centimos inteiros positivos.
- Campos de apresentacao em portugues de Portugal.
- `created_at` e `updated_at` nas entidades mutaveis.
- `created_by`/`updated_by` quando existe acao privilegiada.
- Foreign keys e indices em todas as relacoes e filtros frequentes.
- `team_id`/`season_id` explicito nas tabelas onde melhora isolamento RLS e consultas, mesmo quando a relacao pode ser inferida.

## 3. Entidades

### `users`

Perfil aplicacional associado a `auth.users`.

Campos conceptuais:

- `id`: referencia `auth.users.id`;
- `username`;
- `username_normalized`, unico global;
- `display_name`;
- `avatar_path`, opcional;
- `must_change_password`;
- `is_active`;
- `created_by`;
- timestamps.

O email tecnico, hash da password e tokens pertencem exclusivamente ao Supabase Auth.

### `app_admins`

- `user_id`, unico;
- `created_at`.

E uma permissao global privada e nao uma role de plantel.

### `teams`

- `id`;
- `name`;
- `badge_path`, opcional;
- `is_active`;
- `created_by`;
- timestamps.

So o Super Admin cria, altera ou arquiva equipas.

### `seasons`

- `id`;
- `team_id`;
- `name`, por exemplo `2026/27`;
- `starts_on` e `ends_on`, opcionais;
- `status`: `draft`, `active`, `archived`;
- `copied_from_season_id`, opcional;
- `created_by`;
- `idempotency_key`, unica por equipa e utilizador criador;
- timestamps.

Constraints:

- nome unico dentro da equipa;
- no maximo uma epoca ativa por equipa;
- uma epoca arquivada e apenas de leitura, salvo operacoes exclusivas de administracao que venham a ser aprovadas.

### `season_members`

- `id`;
- `season_id`;
- `user_id`;
- `member_type`: `player` ou `staff`;
- `shirt_number`, obrigatorio apenas para jogador;
- `staff_function`, obrigatoria apenas para equipa tecnica;
- `status`: `active` ou `inactive`;
- timestamps.

Constraints:

- um utilizador aparece no maximo uma vez por epoca;
- jogador exige numero de camisola e nao usa funcao tecnica;
- equipa tecnica exige funcao e nao usa numero de camisola.

### `roles`

Catalogo controlado pelo sistema:

- `captain`;
- `treasurer`.

### `member_roles`

- `season_member_id`;
- `role_id`;
- `assigned_by`;
- `assigned_at`.

Capitao e tesoureiro podem coexistir. O Super Admin nao e registado aqui.

### `fine_categories`

- `id`;
- `season_id`;
- `name`;
- `description`, opcional;
- `base_amount_cents`;
- `amount_per_minute_cents`, opcional;
- `is_monthly_commission`, identifica a única categoria de comissão mensal da época;
- `is_active`;
- `display_order`;
- `created_by`;
- timestamps.

Categorias usadas por multas nao devem ser eliminadas de forma a quebrar referencias; podem ser desativadas. A copia de epoca cria novas categorias independentes.

### `fines`

- `id`;
- `season_id`;
- `season_member_id` do infrator;
- `fine_category_id`;
- `category_name_snapshot`;
- `base_amount_cents_snapshot`;
- `amount_per_minute_cents_snapshot`, opcional;
- `minutes`, zero para multas fixas e positivo para multas por minuto;
- `multiplier`: `1` ou `2`;
- `final_amount_cents`;
- `occurred_at`;
- `notes`, opcional;
- `status`: `pending` ou `paid`;
- `has_ever_been_paid`;
- `applied_by`;
- `paid_at`, opcional;
- `idempotency_key`;
- `commission_month`, opcional e sempre no primeiro dia do mês a que a comissão diz respeito;
- timestamps.

Regras estruturais:

- `final_amount_cents = (base_amount_cents_snapshot + amount_per_minute_cents_snapshot * minutes) * multiplier`, considerando zero quando não existe acréscimo por minuto;
- o multiplicador e obtido no momento da aplicacao e nunca recalculado retroativamente;
- multa pendente nao contribui para recebido;
- multa paga contribui para recebido;
- uma multa com `has_ever_been_paid = true` nunca pode ser eliminada;
- a eliminacao fisica so pode ocorrer quando `status = pending` e `has_ever_been_paid = false`, por operacao protegida de tesoureiro;
- nao existe coluna de montante pago parcial.
- existe no máximo uma comissão mensal por membro e mês;
- uma comissão mensal tem sempre `1,00 EUR`, multiplicador `1`, zero minutos e só pode ser criada pela operação mensal protegida.

### `payment_batches`

Agrupa a selecao de varias multas marcadas numa unica confirmacao.

- `id`;
- `season_id`;
- `season_member_id` do pagador;
- `action`: `paid` ou `reopened`;
- `calculated_total_cents`;
- `recorded_by`;
- `recorded_at`;
- `idempotency_key`.

Nao contem metodo de pagamento nem montante introduzido manualmente. O total e a soma das multas selecionadas no servidor.

### `payment_logs`

Evento imutavel por multa dentro de um batch.

- `id`;
- `payment_batch_id`;
- `fine_id`;
- `action`: `paid` ou `reopened`;
- `amount_cents_snapshot`;
- `recorded_by`;
- `recorded_at`.

Os logs permitem corrigir o estado de uma multa sem editar ou apagar o historico de liquidacao. Uma multa reaberta que ja tenha sido paga continua ineliminavel.

### `audit_events`

Regista acoes administrativas relevantes que nao estejam suficientemente representadas noutras tabelas:

- criacao/desativacao de utilizador;
- reposicao de password, sem guardar a password;
- alteracao de plantel/roles;
- criacao/copia/arquivo de epoca;
- alteracoes ao catalogo;
- alteracoes de fotografias.

As eliminacoes permitidas de multas nunca pagas nao criam um registo funcional da multa nem guardam um motivo. A multa e fisicamente removida e deixa de existir nas listas, historicos, saldos e rankings. Logs tecnicos temporarios da infraestrutura, quando existam, nao fazem parte do livro-razao funcional.

## 4. Indices minimos

- `users(username_normalized)` unico;
- `seasons(team_id, name)` unico;
- indice unico parcial para uma epoca ativa por equipa;
- `season_members(season_id, user_id)` unico;
- `member_roles(season_member_id, role_id)` unico;
- `fine_categories(season_id, is_active, display_order)`;
- indice único parcial para uma categoria de comissão mensal por época;
- `fines(season_id, season_member_id, status)`;
- `fines(season_id, occurred_at)`;
- indice único parcial para uma comissão mensal por membro, época e mês;
- `payment_logs(fine_id, recorded_at)`;
- idempotency keys unicas dentro do respetivo contexto.

## 5. Vistas/consultas derivadas

- saldo pessoal por epoca;
- totais da tesouraria por epoca;
- ranking por numero de multas;
- ranking por valor acumulado;
- ranking por divida atual;
- listagem de multas pendentes por membro.

Estas consultas devem excluir qualquer multa eliminada e nunca expor `app_admins`, identificadores tecnicos de autenticacao ou dados privados desnecessarios.
