begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(46);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';

select extensions.results_eq(
  $$select name from public.teams order by name$$,
  array['Clube Azul'::text],
  'jogador consulta apenas a sua equipa'
);

select extensions.results_eq(
  $$select count(*) from public.users$$,
  array[1::bigint],
  'jogador consulta apenas o proprio perfil privado'
);

select extensions.results_eq(
  $$select count(*) from public.fines$$,
  array[2::bigint],
  'jogador consulta apenas as proprias multas nas epocas autorizadas'
);

select extensions.results_eq(
  $$select count(*) from public.treasury_season_totals$$,
  array[0::bigint],
  'jogador nao consulta totais da tesouraria'
);

select extensions.results_eq(
  $$select fine_count, total_fined_cents, total_paid_cents, total_debt_cents
    from public.my_season_balances
    where season_id = '30000000-0000-4000-8000-000000000001'$$,
  $$values (1::bigint, 500::bigint, 0::bigint, 500::bigint)$$,
  'saldo pessoal deriva os totais corretos'
);

select extensions.results_eq(
  $$select count(*) from public.get_season_leaderboard('30000000-0000-4000-8000-000000000001')$$,
  array[4::bigint],
  'membro consulta o ranking agregado da sua epoca'
);

select extensions.throws_ok(
  $$select * from public.get_season_leaderboard('30000000-0000-4000-8000-000000000003')$$,
  '42501',
  'Sem acesso ao ranking desta epoca.',
  'membro nao consulta o ranking de outra equipa'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000006';

select extensions.results_eq(
  $$select name from public.teams$$,
  array['Clube Verde'::text],
  'jogador da segunda equipa permanece isolado da primeira'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000004';

select extensions.throws_ok(
  $$select * from public.get_season_leaderboard('30000000-0000-4000-8000-000000000002')$$,
  '42501',
  'Sem acesso ao ranking desta epoca.',
  'membro de uma epoca nao consulta outra epoca da mesma equipa'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000001';

select extensions.results_eq(
  $$select count(*) from public.teams$$,
  array[2::bigint],
  'Owner consulta todas as equipas'
);

select extensions.results_eq(
  $$select count(*) from public.fines$$,
  array[0::bigint],
  'Owner sem funcao de plantel nao consulta detalhe financeiro'
);

select extensions.throws_ok(
  $$select * from public.get_season_leaderboard('30000000-0000-4000-8000-000000000001')$$,
  '42501',
  'Sem acesso ao ranking desta epoca.',
  'permissao global nao concede acesso ao ranking'
);

select extensions.results_eq(
  $$select count(*) from public.get_season_member_directory('30000000-0000-4000-8000-000000000001')$$,
  array[4::bigint],
  'Owner consulta o plantel necessario a administracao'
);

select extensions.lives_ok(
  $$select * from public.create_season(
    '20000000-0000-4000-8000-000000000001',
    '2027/28',
    '2027-08-01',
    '2028-06-30',
    'draft',
    '30000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000002'
  )$$,
  'Owner copia uma epoca'
);

select extensions.results_eq(
  $$select count(*) from public.season_members where season_id = (
    select id from public.seasons where idempotency_key = '83000000-0000-4000-8000-000000000002'
  )$$,
  array[4::bigint],
  'copia inclui apenas o plantel ativo'
);

select extensions.results_eq(
  $$select count(*) from public.fines where season_id = (
    select id from public.seasons where idempotency_key = '83000000-0000-4000-8000-000000000002'
  )$$,
  array[0::bigint],
  'copia nao inclui multas'
);

select extensions.results_eq(
  $$select count(*) from public.seasons
    where idempotency_key = '83000000-0000-4000-8000-000000000002'
      and (select count(*) from public.create_season(
        '20000000-0000-4000-8000-000000000001',
        '2027/28',
        '2027-08-01',
        '2028-06-30',
        'draft',
        '30000000-0000-4000-8000-000000000001',
        '83000000-0000-4000-8000-000000000002'
      )) = 1$$,
  array[1::bigint],
  'repetir copia nao cria outra epoca'
);

select extensions.throws_ok(
  $$select * from public.create_season(
    '20000000-0000-4000-8000-000000000002',
    'Copia cruzada',
    null,
    null,
    'draft',
    '30000000-0000-4000-8000-000000000001',
    '83000000-0000-4000-8000-000000000003'
  )$$,
  'P0002',
  'Epoca de origem nao encontrada na equipa.',
  'Owner nao copia uma epoca entre equipas'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000003';

select extensions.throws_ok(
  $$select * from public.create_season(
    '20000000-0000-4000-8000-000000000001',
    'Sem permissao',
    null,
    null,
    'draft',
    null,
    '83000000-0000-4000-8000-000000000004'
  )$$,
  '42501',
  'Apenas o Owner pode criar epocas.',
  'jogador nao cria epocas'
);

select extensions.throws_ok(
  $$select * from public.save_fine_category(
    '30000000-0000-4000-8000-000000000001',
    null,
    'Sem permissao',
    null,
    100,
    true,
    99
  )$$,
  '42501',
  'Sem permissao para gerir o catalogo desta epoca.',
  'jogador nao gere catalogo'
);

select extensions.throws_ok(
  $$select * from public.apply_fine(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    '2026-09-10 18:00:00+00',
    null,
    '81000000-0000-4000-8000-000000000001'
  )$$,
  '42501',
  'Sem permissao de tesoureiro nesta epoca.',
  'jogador normal nao aplica multas'
);

set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

select extensions.results_eq(
  $$select fine_count, total_fined_cents, total_received_cents, total_debt_cents
    from public.treasury_season_totals
    where season_id = '30000000-0000-4000-8000-000000000001'$$,
  $$values (4::bigint, 1800::bigint, 200::bigint, 1600::bigint)$$,
  'totais da tesouraria derivam multado, recebido e divida'
);

select extensions.results_eq(
  $$select base_amount_cents from public.save_fine_category(
    '30000000-0000-4000-8000-000000000001',
    null,
    'Multa minima',
    null,
    10,
    true,
    30
  )$$,
  array[10],
  'catalogo suporta o minimo de dez centimos'
);

reset role;

select extensions.results_eq(
  $$select
      action,
      actor_user_id,
      entity_type,
      entity_id = (
        select id from public.fine_categories where name = 'Multa minima'
      ),
      team_id,
      season_id,
      metadata #>> '{new_values,name}',
      (metadata #>> '{new_values,base_amount_cents}')::integer,
      (metadata #>> '{new_values,is_active}')::boolean,
      (metadata #>> '{new_values,display_order}')::integer
    from public.audit_events
    where action = 'fine_category.created'
      and metadata #>> '{new_values,name}' = 'Multa minima'$$,
  $$values (
    'fine_category.created'::text,
    '00000000-0000-4000-8000-000000000002'::uuid,
    'fine_category'::text,
    true,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '30000000-0000-4000-8000-000000000001'::uuid,
    'Multa minima'::text,
    10,
    true,
    30
  )$$,
  'criacao de categoria regista ator, categoria, equipa, epoca e novos valores'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

select extensions.results_eq(
  $$select is_active from public.save_fine_category(
    '30000000-0000-4000-8000-000000000001',
    (select id from public.fine_categories where name = 'Multa minima'),
    'Multa minima atualizada',
    'Desativada em teste',
    20,
    false,
    31
  )$$,
  array[false],
  'tesoureiro pode desativar categoria'
);

reset role;

select extensions.results_eq(
  $$select
      action,
      actor_user_id,
      entity_type,
      entity_id = (
        select id from public.fine_categories where name = 'Multa minima atualizada'
      ),
      team_id,
      season_id,
      metadata #>> '{previous_values,name}',
      (metadata #>> '{previous_values,base_amount_cents}')::integer,
      (metadata #>> '{previous_values,is_active}')::boolean,
      (metadata #>> '{previous_values,display_order}')::integer,
      metadata #>> '{new_values,name}',
      (metadata #>> '{new_values,base_amount_cents}')::integer,
      (metadata #>> '{new_values,is_active}')::boolean,
      (metadata #>> '{new_values,display_order}')::integer
    from public.audit_events
    where action = 'fine_category.updated'
      and metadata #>> '{new_values,name}' = 'Multa minima atualizada'
      and (metadata #>> '{new_values,is_active}')::boolean = false$$,
  $$values (
    'fine_category.updated'::text,
    '00000000-0000-4000-8000-000000000002'::uuid,
    'fine_category'::text,
    true,
    '20000000-0000-4000-8000-000000000001'::uuid,
    '30000000-0000-4000-8000-000000000001'::uuid,
    'Multa minima'::text,
    10,
    true,
    30,
    'Multa minima atualizada'::text,
    20,
    false,
    31
  )$$,
  'desativacao regista valores anteriores e novos, incluindo preco e ordenacao'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

select extensions.results_eq(
  $$select is_active from public.save_fine_category(
    '30000000-0000-4000-8000-000000000001',
    (select id from public.fine_categories where name = 'Multa minima atualizada'),
    'Multa minima reativada',
    null,
    25,
    true,
    32
  )$$,
  array[true],
  'tesoureiro pode reativar categoria'
);

reset role;

select extensions.results_eq(
  $$select
      (metadata #>> '{previous_values,is_active}')::boolean,
      (metadata #>> '{new_values,is_active}')::boolean,
      (metadata #>> '{previous_values,base_amount_cents}')::integer,
      (metadata #>> '{new_values,base_amount_cents}')::integer,
      (metadata #>> '{previous_values,display_order}')::integer,
      (metadata #>> '{new_values,display_order}')::integer
    from public.audit_events
    where action = 'fine_category.updated'
      and metadata #>> '{new_values,name}' = 'Multa minima reativada'$$,
  $$values (false, true, 20, 25, 31, 32)$$,
  'reativacao regista a transicao e os restantes valores alterados'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

select extensions.throws_ok(
  $$select * from public.save_fine_category(
    '30000000-0000-4000-8000-000000000002',
    null,
    'Epoca arquivada',
    null,
    100,
    true,
    99
  )$$,
  '42501',
  'Sem permissao para gerir o catalogo desta epoca.',
  'catalogo de epoca arquivada e apenas de leitura'
);

reset role;

select extensions.results_eq(
  $$select count(*) from public.audit_events
    where metadata #>> '{new_values,name}' = 'Epoca arquivada'$$,
  array[0::bigint],
  'operacao rejeitada nao deixa evento de auditoria'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

select extensions.throws_ok(
  $statement$
    do $$
    begin
      perform public.save_fine_category(
        '30000000-0000-4000-8000-000000000001',
        null,
        'Categoria revertida',
        null,
        500,
        true,
        70
      );
      raise exception 'rollback intencional';
    end;
    $$
  $statement$,
  'P0001',
  'rollback intencional',
  'erro posterior reverte categoria e evento na mesma transacao'
);

reset role;

select extensions.results_eq(
  $$select
      (select count(*) from public.fine_categories where name = 'Categoria revertida'),
      (select count(*) from public.audit_events
       where metadata #>> '{new_values,name}' = 'Categoria revertida')$$,
  $$values (0::bigint, 0::bigint)$$,
  'rollback nao deixa categoria nem evento de auditoria'
);

set local role authenticated;
set local request.jwt.claim.sub = '00000000-0000-4000-8000-000000000002';

select extensions.throws_ok(
  $$select * from public.apply_fine(
    '40000000-0000-4000-8000-000000000007',
    '50000000-0000-4000-8000-000000000004',
    '2026-09-10 18:00:00+00',
    null,
    '81000000-0000-4000-8000-000000000002'
  )$$,
  '42501',
  'Sem permissao de tesoureiro nesta epoca.',
  'tesoureiro nao aplica multas noutra equipa'
);

select extensions.lives_ok(
  $$select * from public.apply_fine(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    '2026-09-10 18:00:00+00',
    'Teste pgTAP',
    '81000000-0000-4000-8000-000000000003'
  )$$,
  'tesoureiro aplica multa na propria epoca'
);

select extensions.results_eq(
  $$select multiplier::integer from public.fines where idempotency_key = '81000000-0000-4000-8000-000000000003'$$,
  array[1],
  'jogador normal recebe multiplicador 1x'
);

select extensions.results_eq(
  $$select count(*) from public.apply_fine(
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    '2026-09-10 18:00:00+00',
    'Teste pgTAP',
    '81000000-0000-4000-8000-000000000003'
  )$$,
  array[1::bigint],
  'repetir aplicacao devolve a mesma multa'
);

select extensions.results_eq(
  $$select multiplier::integer from public.apply_fine(
    '40000000-0000-4000-8000-000000000003',
    '50000000-0000-4000-8000-000000000001',
    '2026-09-10 18:05:00+00',
    null,
    '81000000-0000-4000-8000-000000000004'
  )$$,
  array[2],
  'capitao recebe multiplicador 2x'
);

select extensions.results_eq(
  $$select multiplier::integer from public.apply_fine(
    '40000000-0000-4000-8000-000000000004',
    '50000000-0000-4000-8000-000000000001',
    '2026-09-10 18:10:00+00',
    null,
    '81000000-0000-4000-8000-000000000005'
  )$$,
  array[2],
  'equipa tecnica recebe multiplicador 2x'
);

select extensions.lives_ok(
  $$select * from public.record_payment_batch(
    '40000000-0000-4000-8000-000000000002',
    array[(select id from public.fines where idempotency_key = '81000000-0000-4000-8000-000000000003')]::uuid[],
    'paid',
    '91000000-0000-4000-8000-000000000001'
  )$$,
  'tesoureiro liquida uma selecao completa'
);

select extensions.results_eq(
  $$select count(*) from public.payment_batches where idempotency_key = '91000000-0000-4000-8000-000000000001'$$,
  array[1::bigint],
  'liquidacao idempotente cria um unico batch'
);

select extensions.lives_ok(
  $$select * from public.record_payment_batch(
    '40000000-0000-4000-8000-000000000002',
    array[(select id from public.fines where idempotency_key = '81000000-0000-4000-8000-000000000003')]::uuid[],
    'reopened',
    '91000000-0000-4000-8000-000000000002'
  )$$,
  'tesoureiro reabre a multa com novo log'
);

select extensions.throws_ok(
  $$select public.delete_pending_fine(
    (select id from public.fines where idempotency_key = '81000000-0000-4000-8000-000000000003')
  )$$,
  '55000',
  'So e possivel eliminar multas pendentes que nunca foram pagas.',
  'multa reaberta permanece protegida contra eliminacao'
);

select extensions.results_eq(
  $$select count(*) from public.payment_logs where fine_id = (
    select id from public.fines where idempotency_key = '81000000-0000-4000-8000-000000000003'
  )$$,
  array[2::bigint],
  'liquidacao e reabertura preservam dois logs imutaveis'
);

select extensions.lives_ok(
  $$select * from public.apply_fine(
    '40000000-0000-4000-8000-000000000001',
    '50000000-0000-4000-8000-000000000001',
    '2026-09-10 18:15:00+00',
    null,
    '81000000-0000-4000-8000-000000000006'
  )$$,
  'tesoureiro cria uma multa eliminavel'
);

select extensions.lives_ok(
  $$select public.delete_pending_fine(
    (select id from public.fines where idempotency_key = '81000000-0000-4000-8000-000000000006')
  )$$,
  'tesoureiro elimina multa pendente nunca paga'
);

select extensions.throws_ok(
  $$insert into public.fines (
    season_id,
    season_member_id,
    fine_category_id,
    category_name_snapshot,
    base_amount_cents_snapshot,
    multiplier,
    final_amount_cents,
    occurred_at,
    applied_by,
    idempotency_key
  ) values (
    '30000000-0000-4000-8000-000000000001',
    '40000000-0000-4000-8000-000000000002',
    '50000000-0000-4000-8000-000000000001',
    'Atraso', 500, 1, 500, now(),
    '00000000-0000-4000-8000-000000000002',
    '81000000-0000-4000-8000-000000000099'
  )$$,
  '42501',
  null,
  'escrita direta na tabela financeira e negada'
);

reset role;
select * from extensions.finish();
rollback;
