begin;

create extension if not exists pgtap with schema extensions;
select extensions.plan(8);

select extensions.has_function(
  'public',
  'get_auth_context',
  array[]::text[],
  'contexto de autenticacao exposto por uma RPC sem argumentos'
);

select extensions.function_privs_are(
  'public',
  'get_auth_context',
  array[]::text[],
  'authenticated',
  array['EXECUTE'],
  'authenticated pode carregar o contexto autorizado'
);

select extensions.function_privs_are(
  'public',
  'get_auth_context',
  array[]::text[],
  'anon',
  array[]::text[],
  'anon nao pode carregar contexto de autenticacao'
);

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);

select extensions.is(
  (public.get_auth_context() -> 'profile' ->> 'username'),
  'tesoureiro.a',
  'o contexto devolve apenas o proprio perfil'
);

select extensions.is(
  jsonb_array_length(public.get_auth_context() -> 'memberships'),
  2,
  'o contexto inclui as duas associacoes autorizadas do utilizador'
);

select extensions.ok(
  public.get_auth_context() -> 'memberships' @> '[{"roles":["treasurer"]}]'::jsonb,
  'o contexto inclui as funcoes de plantel autorizadas'
);

reset role;
update public.users
set is_active = false
where id = '00000000-0000-4000-8000-000000000002';

set local role authenticated;
select set_config(
  'request.jwt.claim.sub',
  '00000000-0000-4000-8000-000000000002',
  true
);

select extensions.throws_ok(
  $$select public.get_auth_context()$$,
  '42501',
  'Sessao invalida.',
  'um utilizador desativado nao recebe contexto autorizado'
);

reset role;
select extensions.is(
  (
    select count(*)::integer
    from pg_trigger
    where tgname = 'auth_user_password_changed'
      and not tgisinternal
  ),
  1,
  'a alteracao real do hash da password tem um unico trigger'
);

select * from extensions.finish();
rollback;
