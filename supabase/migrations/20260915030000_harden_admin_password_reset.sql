create table public.admin_password_reset_requests (
  actor_user_id uuid not null references public.users (id) on delete restrict,
  idempotency_key uuid not null,
  user_id uuid not null references public.users (id) on delete restrict,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  primary key (actor_user_id, idempotency_key)
);

comment on table public.admin_password_reset_requests is
  'Estado idempotente de reposicoes administrativas; nunca contem passwords, tokens ou email tecnico.';

alter table public.admin_password_reset_requests enable row level security;
revoke all on table public.admin_password_reset_requests from public, anon, authenticated;

create function public.prepare_admin_password_reset(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.admin_password_reset_requests;
begin
  perform private.assert_admin_actor(p_actor_user_id);
  if p_user_id is null or p_idempotency_key is null then
    raise exception using errcode = '22004', message = 'Utilizador e chave de idempotencia sao obrigatorios.';
  end if;
  if not exists (select 1 from public.users where id = p_user_id) then
    raise exception using errcode = 'P0002', message = 'Utilizador nao encontrado.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'admin_password_reset:' || p_actor_user_id::text || ':' || p_idempotency_key::text,
    0
  ));

  select * into v_request
  from public.admin_password_reset_requests
  where actor_user_id = p_actor_user_id
    and idempotency_key = p_idempotency_key
  for update;

  if found then
    if v_request.user_id <> p_user_id then
      raise exception using errcode = '22023', message = 'Chave de idempotencia reutilizada para outro utilizador.';
    end if;
  else
    insert into public.admin_password_reset_requests (
      actor_user_id, idempotency_key, user_id
    ) values (
      p_actor_user_id, p_idempotency_key, p_user_id
    ) returning * into v_request;
  end if;

  return jsonb_build_object(
    'userId', v_request.user_id,
    'completed', v_request.completed_at is not null
  );
end;
$$;

create function public.complete_admin_password_reset(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_idempotency_key uuid
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_request public.admin_password_reset_requests;
  v_user public.users;
begin
  perform private.assert_admin_actor(p_actor_user_id);

  select * into v_request
  from public.admin_password_reset_requests
  where actor_user_id = p_actor_user_id
    and idempotency_key = p_idempotency_key
  for update;

  if not found or v_request.user_id <> p_user_id then
    raise exception using errcode = 'P0002', message = 'Pedido de reposicao nao encontrado.';
  end if;

  if v_request.completed_at is null then
    update public.users
    set must_change_password = true
    where id = p_user_id
    returning * into v_user;
    if not found then
      raise exception using errcode = 'P0002', message = 'Utilizador nao encontrado.';
    end if;

    insert into public.audit_events (
      actor_user_id, action, entity_type, entity_id, metadata
    ) values (
      p_actor_user_id, 'user.password_reset', 'user', p_user_id, '{}'::jsonb
    );

    update public.admin_password_reset_requests
    set completed_at = now()
    where actor_user_id = p_actor_user_id
      and idempotency_key = p_idempotency_key;
  else
    select * into strict v_user from public.users where id = p_user_id;
  end if;

  return v_user;
end;
$$;

revoke all on function public.prepare_admin_password_reset(uuid, uuid, uuid) from public, anon, authenticated;
revoke all on function public.complete_admin_password_reset(uuid, uuid, uuid) from public, anon, authenticated;
grant execute on function public.prepare_admin_password_reset(uuid, uuid, uuid) to service_role;
grant execute on function public.complete_admin_password_reset(uuid, uuid, uuid) to service_role;

drop function public.mark_admin_password_reset(uuid, uuid);

notify pgrst, 'reload schema';
