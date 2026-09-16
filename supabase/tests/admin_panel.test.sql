begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(27);

select extensions.has_function('public', 'get_admin_overview', array[]::text[], 'painel administrativo exposto por RPC');
select extensions.function_privs_are('public', 'get_admin_overview', array[]::text[], 'authenticated', array['EXECUTE'], 'authenticated pode pedir o painel sujeito a autorizacao interna');
select extensions.function_privs_are('public', 'get_admin_overview', array[]::text[], 'anon', array[]::text[], 'anon nao executa o painel');
select extensions.function_privs_are(
  'public', 'register_admin_user', array['uuid','uuid','text','text','uuid'],
  'authenticated', array[]::text[], 'authenticated nao finaliza contas diretamente'
);
select extensions.function_privs_are(
  'public', 'prepare_admin_password_reset', array['uuid','uuid','uuid'],
  'authenticated', array[]::text[], 'authenticated nao prepara reposicoes diretamente'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000003', true);
select extensions.throws_ok(
  $$select public.get_admin_overview()$$, '42501', 'Apenas o Owner pode executar esta operacao.',
  'membro normal nao abre o painel'
);
select extensions.throws_ok(
  $$select * from public.save_admin_team(null, 'Negada', true)$$, '42501', 'Apenas o Owner pode executar esta operacao.',
  'membro normal nao cria equipas'
);

reset role;
insert into auth.users (id, email, raw_user_meta_data)
values ('00000000-0000-4000-8000-000000000099', 'fase04@local.invalid', '{}'::jsonb);

set local role service_role;
select extensions.lives_ok(
  $$select * from public.register_admin_user(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000099',
    'fase04.user', 'Utilizador Fase 04',
    'a4000000-0000-4000-8000-000000000001'
  )$$,
  'service_role finaliza perfil com ator Owner validado'
);
select extensions.results_eq(
  $$select count(*) from public.register_admin_user(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000099',
    'fase04.user', 'Utilizador Fase 04',
    'a4000000-0000-4000-8000-000000000001'
  )$$,
  array[1::bigint], 'criacao repetida devolve o mesmo perfil'
);
select extensions.lives_ok(
  $$select public.prepare_admin_password_reset(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000099',
    'a4000000-0000-4000-8000-000000000010'
  )$$,
  'service_role prepara reposicao idempotente'
);
select extensions.throws_ok(
  $$select public.prepare_admin_password_reset(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000001',
    'a4000000-0000-4000-8000-000000000010'
  )$$,
  '22023', 'Chave de idempotencia reutilizada para outro utilizador.',
  'a chave nao pode mudar de utilizador'
);
select extensions.lives_ok(
  $$select * from public.complete_admin_password_reset(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000099',
    'a4000000-0000-4000-8000-000000000010'
  )$$,
  'service_role conclui a reposicao'
);
select extensions.lives_ok(
  $$select * from public.complete_admin_password_reset(
    '00000000-0000-4000-8000-000000000001',
    '00000000-0000-4000-8000-000000000099',
    'a4000000-0000-4000-8000-000000000010'
  )$$,
  'conclusao repetida e idempotente'
);
reset role;
select extensions.results_eq(
  $$select count(*) from public.admin_user_requests where user_id = '00000000-0000-4000-8000-000000000099'$$,
  array[1::bigint], 'idempotencia nao duplica pedidos'
);
select extensions.results_eq(
  $$select count(*) from public.admin_password_reset_requests
    where actor_user_id = '00000000-0000-4000-8000-000000000001'
      and idempotency_key = 'a4000000-0000-4000-8000-000000000010'
      and completed_at is not null$$,
  array[1::bigint], 'reposicao fica marcada como concluida uma vez'
);
select extensions.results_eq(
  $$select count(*) from public.audit_events
    where actor_user_id = '00000000-0000-4000-8000-000000000001'
      and entity_id = '00000000-0000-4000-8000-000000000099'
      and action = 'user.password_reset'$$,
  array[1::bigint], 'reposicao repetida nao duplica auditoria'
);

set local role authenticated;
select set_config('request.jwt.claim.sub', '00000000-0000-4000-8000-000000000001', true);

select extensions.lives_ok(
  $$select * from public.save_admin_team(null, 'Equipa Fase 04', true)$$,
  'Owner cria uma equipa auditada'
);
select extensions.lives_ok(
  $$select * from public.create_season(
    (select id from public.teams where name = 'Equipa Fase 04'), '2027/28', null, null,
    'draft', null, 'a4000000-0000-4000-8000-000000000002'
  )$$,
  'Owner cria uma epoca em rascunho'
);
select extensions.lives_ok(
  $$select * from public.save_admin_member(
    null,
    (select id from public.seasons where idempotency_key = 'a4000000-0000-4000-8000-000000000002'),
    '00000000-0000-4000-8000-000000000099', 'player', 77, null, 'active',
    array['captain','treasurer']
  )$$,
  'Owner adiciona jogador com capitao e tesoureiro coexistentes'
);
select extensions.results_eq(
  $$select r.code from public.member_roles mr join public.roles r on r.id = mr.role_id
    where mr.season_member_id = (
      select id from public.season_members where user_id = '00000000-0000-4000-8000-000000000099'
        and season_id = (select id from public.seasons where idempotency_key = 'a4000000-0000-4000-8000-000000000002')
    ) order by r.code$$,
  $$values ('captain'::text), ('treasurer'::text)$$,
  'capitao e tesoureiro permanecem roles independentes'
);
select extensions.throws_ok(
  $$select * from public.save_admin_member(
    (select id from public.season_members where user_id = '00000000-0000-4000-8000-000000000099'
      and season_id = (select id from public.seasons where idempotency_key = 'a4000000-0000-4000-8000-000000000002')),
    (select id from public.seasons where idempotency_key = 'a4000000-0000-4000-8000-000000000002'),
    '00000000-0000-4000-8000-000000000099', 'staff', 77, 'Treinador', 'active', '{}'::text[]
  )$$,
  '23514', null, 'equipa tecnica nao pode manter numero de camisola'
);
select extensions.lives_ok(
  $$select * from public.update_admin_season(
    (select id from public.seasons where idempotency_key = 'a4000000-0000-4000-8000-000000000002'),
    '2027/28', null, null, 'active'
  )$$,
  'rascunho pode transitar para ativo'
);
select extensions.lives_ok(
  $$select * from public.update_admin_season(
    (select id from public.seasons where idempotency_key = 'a4000000-0000-4000-8000-000000000002'),
    '2027/28', null, null, 'archived'
  )$$,
  'epoca ativa pode ser arquivada'
);
select extensions.throws_ok(
  $$select * from public.update_admin_season(
    (select id from public.seasons where idempotency_key = 'a4000000-0000-4000-8000-000000000002'),
    '2027/28', null, null, 'active'
  )$$,
  '55000', 'Uma epoca arquivada nao pode ser reaberta.', 'epoca arquivada e terminal'
);
select extensions.ok(
  not exists (
    select 1 from public.audit_events
    where lower(metadata::text) ~ '(password|token|@auth[.]caixinha)'
  ),
  'auditoria nao contem credenciais nem email tecnico'
);
select extensions.results_eq(
  $$select count(*) from public.fines$$, array[0::bigint],
  'Owner sem tesoureiro continua sem acesso financeiro por RLS'
);
select extensions.results_eq(
  $$select count(*) from pg_policies where schemaname = 'storage' and tablename = 'objects'
    and policyname in ('private_photos_insert_admin','private_photos_update_admin','private_photos_delete_admin')$$,
  array[3::bigint], 'Storage tem as tres politicas de escrita exclusivas do Owner'
);

select * from extensions.finish();
rollback;
