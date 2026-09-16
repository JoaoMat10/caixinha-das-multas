create table public.admin_user_requests (
  actor_user_id uuid not null references public.users (id) on delete restrict,
  idempotency_key uuid not null,
  user_id uuid not null unique references public.users (id) on delete restrict,
  username_normalized text not null,
  created_at timestamptz not null default now(),
  primary key (actor_user_id, idempotency_key)
);

comment on table public.admin_user_requests is
  'Chaves de idempotencia de criacao de contas; nunca contem passwords, tokens ou email tecnico.';

alter table public.admin_user_requests enable row level security;
revoke all on table public.admin_user_requests from public, anon, authenticated;

create function private.assert_admin_actor(p_actor_user_id uuid)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.is_app_admin(p_actor_user_id) then
    raise exception using errcode = '42501', message = 'Apenas o Owner pode executar esta operacao.';
  end if;
end;
$$;

revoke all on function private.assert_admin_actor(uuid) from public, anon, authenticated;

create function public.get_admin_overview()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
begin
  perform private.assert_admin_actor(v_actor_id);

  return jsonb_build_object(
    'users', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', u.id,
        'username', u.username,
        'displayName', u.display_name,
        'avatarPath', u.avatar_path,
        'mustChangePassword', u.must_change_password,
        'isActive', u.is_active,
        'createdAt', u.created_at
      ) order by u.display_name, u.username)
      from public.users as u
    ), '[]'::jsonb),
    'teams', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', t.id,
        'name', t.name,
        'badgePath', t.badge_path,
        'isActive', t.is_active,
        'createdAt', t.created_at
      ) order by t.is_active desc, t.name)
      from public.teams as t
    ), '[]'::jsonb),
    'seasons', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', s.id,
        'teamId', s.team_id,
        'name', s.name,
        'startsOn', s.starts_on,
        'endsOn', s.ends_on,
        'status', s.status,
        'copiedFromSeasonId', s.copied_from_season_id,
        'createdAt', s.created_at
      ) order by s.starts_on desc nulls last, s.name desc)
      from public.seasons as s
    ), '[]'::jsonb),
    'members', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', sm.id,
        'seasonId', sm.season_id,
        'userId', sm.user_id,
        'memberType', sm.member_type,
        'shirtNumber', sm.shirt_number,
        'staffFunction', sm.staff_function,
        'status', sm.status,
        'roles', coalesce((
          select jsonb_agg(r.code order by r.code)
          from public.member_roles as mr
          join public.roles as r on r.id = mr.role_id
          where mr.season_member_id = sm.id
        ), '[]'::jsonb)
      ) order by sm.created_at, sm.id)
      from public.season_members as sm
    ), '[]'::jsonb),
    'auditEvents', coalesce((
      select jsonb_agg(jsonb_build_object(
        'id', event.id,
        'actorUserId', event.actor_user_id,
        'actorDisplayName', actor.display_name,
        'action', event.action,
        'entityType', event.entity_type,
        'entityId', event.entity_id,
        'teamId', event.team_id,
        'seasonId', event.season_id,
        'metadata', event.metadata,
        'occurredAt', event.occurred_at
      ) order by event.occurred_at desc)
      from (
        select * from public.audit_events order by occurred_at desc limit 100
      ) as event
      join public.users as actor on actor.id = event.actor_user_id
    ), '[]'::jsonb)
  );
end;
$$;

comment on function public.get_admin_overview() is
  'Devolve exclusivamente ao Owner os dados necessarios ao painel administrativo; omite app_admins e identidade Auth.';

revoke all on function public.get_admin_overview() from public, anon;
grant execute on function public.get_admin_overview() to authenticated;

create function public.get_admin_user_creation(
  p_actor_user_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  perform private.assert_admin_actor(p_actor_user_id);

  select jsonb_build_object(
    'id', u.id,
    'username', u.username,
    'displayName', u.display_name,
    'isActive', u.is_active
  )
  into v_result
  from public.admin_user_requests as request
  join public.users as u on u.id = request.user_id
  where request.actor_user_id = p_actor_user_id
    and request.idempotency_key = p_idempotency_key;

  return v_result;
end;
$$;

create function public.register_admin_user(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_username text,
  p_display_name text,
  p_idempotency_key uuid
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_username text := lower(btrim(p_username));
  v_existing_request public.admin_user_requests;
  v_user public.users;
begin
  perform private.assert_admin_actor(p_actor_user_id);

  if p_user_id is null or p_idempotency_key is null then
    raise exception using errcode = '22004', message = 'Utilizador e chave de idempotencia sao obrigatorios.';
  end if;

  if v_username !~ '^[a-z0-9._-]{3,32}$' or btrim(p_display_name) = '' then
    raise exception using errcode = '22023', message = 'Dados do utilizador invalidos.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    'admin_user:' || p_actor_user_id::text || ':' || p_idempotency_key::text,
    0
  ));

  select * into v_existing_request
  from public.admin_user_requests
  where actor_user_id = p_actor_user_id
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing_request.username_normalized <> v_username then
      raise exception using errcode = '22023', message = 'Chave de idempotencia reutilizada com dados diferentes.';
    end if;
    select * into strict v_user from public.users where id = v_existing_request.user_id;
    if v_user.display_name <> btrim(p_display_name) then
      raise exception using errcode = '22023', message = 'Chave de idempotencia reutilizada com dados diferentes.';
    end if;
    return v_user;
  end if;

  insert into public.users (
    id, username, username_normalized, display_name,
    must_change_password, is_active, created_by
  ) values (
    p_user_id, btrim(p_username), v_username, btrim(p_display_name),
    true, true, p_actor_user_id
  ) returning * into v_user;

  insert into public.admin_user_requests (
    actor_user_id, idempotency_key, user_id, username_normalized
  ) values (
    p_actor_user_id, p_idempotency_key, p_user_id, v_username
  );

  insert into public.audit_events (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_actor_user_id, 'user.created', 'user', p_user_id,
    jsonb_build_object('username', v_user.username, 'display_name', v_user.display_name)
  );

  return v_user;
end;
$$;

create function public.update_admin_user(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_username text,
  p_display_name text
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_previous public.users;
  v_user public.users;
  v_username text := lower(btrim(p_username));
begin
  perform private.assert_admin_actor(p_actor_user_id);
  if v_username !~ '^[a-z0-9._-]{3,32}$' or btrim(p_display_name) = '' then
    raise exception using errcode = '22023', message = 'Dados do utilizador invalidos.';
  end if;

  select * into v_previous from public.users where id = p_user_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Utilizador nao encontrado.';
  end if;

  update public.users
  set username = btrim(p_username), username_normalized = v_username,
      display_name = btrim(p_display_name)
  where id = p_user_id
  returning * into v_user;

  insert into public.audit_events (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_actor_user_id, 'user.updated', 'user', p_user_id,
    jsonb_build_object(
      'previous_values', jsonb_build_object('username', v_previous.username, 'display_name', v_previous.display_name),
      'new_values', jsonb_build_object('username', v_user.username, 'display_name', v_user.display_name)
    )
  );
  return v_user;
end;
$$;

create function public.set_admin_user_active(
  p_actor_user_id uuid,
  p_user_id uuid,
  p_is_active boolean
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users;
begin
  perform private.assert_admin_actor(p_actor_user_id);
  if p_user_id = p_actor_user_id and not p_is_active then
    raise exception using errcode = '55000', message = 'O Owner nao pode desativar a propria conta.';
  end if;

  update public.users set is_active = p_is_active
  where id = p_user_id and is_active is distinct from p_is_active
  returning * into v_user;

  if not found then
    select * into v_user from public.users where id = p_user_id;
    if not found then
      raise exception using errcode = 'P0002', message = 'Utilizador nao encontrado.';
    end if;
    return v_user;
  end if;

  insert into public.audit_events (
    actor_user_id, action, entity_type, entity_id, metadata
  ) values (
    p_actor_user_id,
    case when p_is_active then 'user.activated' else 'user.deactivated' end,
    'user', p_user_id, jsonb_build_object('is_active', p_is_active)
  );
  return v_user;
end;
$$;

create function public.mark_admin_password_reset(
  p_actor_user_id uuid,
  p_user_id uuid
)
returns public.users
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user public.users;
begin
  perform private.assert_admin_actor(p_actor_user_id);
  update public.users set must_change_password = true
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
  return v_user;
end;
$$;

revoke all on function public.get_admin_user_creation(uuid, uuid) from public, anon, authenticated;
revoke all on function public.register_admin_user(uuid, uuid, text, text, uuid) from public, anon, authenticated;
revoke all on function public.update_admin_user(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.set_admin_user_active(uuid, uuid, boolean) from public, anon, authenticated;
revoke all on function public.mark_admin_password_reset(uuid, uuid) from public, anon, authenticated;
grant execute on function public.get_admin_user_creation(uuid, uuid) to service_role;
grant execute on function public.register_admin_user(uuid, uuid, text, text, uuid) to service_role;
grant execute on function public.update_admin_user(uuid, uuid, text, text) to service_role;
grant execute on function public.set_admin_user_active(uuid, uuid, boolean) to service_role;
grant execute on function public.mark_admin_password_reset(uuid, uuid) to service_role;

create function public.save_admin_team(
  p_team_id uuid,
  p_name text,
  p_is_active boolean
)
returns public.teams
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_team public.teams;
  v_previous public.teams;
begin
  perform private.assert_admin_actor(v_actor_id);
  if btrim(p_name) = '' then
    raise exception using errcode = '22023', message = 'O nome da equipa e obrigatorio.';
  end if;

  if p_team_id is null then
    insert into public.teams (name, is_active, created_by)
    values (btrim(p_name), p_is_active, v_actor_id)
    returning * into v_team;
  else
    select * into v_previous from public.teams where id = p_team_id for update;
    if not found then
      raise exception using errcode = 'P0002', message = 'Equipa nao encontrada.';
    end if;
    update public.teams set name = btrim(p_name), is_active = p_is_active
    where id = p_team_id returning * into v_team;
  end if;

  insert into public.audit_events (
    actor_user_id, action, entity_type, entity_id, team_id, metadata
  ) values (
    v_actor_id,
    case when p_team_id is null then 'team.created' else 'team.updated' end,
    'team', v_team.id, v_team.id,
    case when p_team_id is null
      then jsonb_build_object('new_values', jsonb_build_object('name', v_team.name, 'is_active', v_team.is_active))
      else jsonb_build_object(
        'previous_values', jsonb_build_object('name', v_previous.name, 'is_active', v_previous.is_active),
        'new_values', jsonb_build_object('name', v_team.name, 'is_active', v_team.is_active)
      )
    end
  );
  return v_team;
end;
$$;

create function public.update_admin_season(
  p_season_id uuid,
  p_name text,
  p_starts_on date,
  p_ends_on date,
  p_status public.season_status
)
returns public.seasons
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_previous public.seasons;
  v_season public.seasons;
begin
  perform private.assert_admin_actor(v_actor_id);
  select * into v_previous from public.seasons where id = p_season_id for update;
  if not found then
    raise exception using errcode = 'P0002', message = 'Epoca nao encontrada.';
  end if;
  if v_previous.status = 'archived' and p_status <> 'archived' then
    raise exception using errcode = '55000', message = 'Uma epoca arquivada nao pode ser reaberta.';
  end if;
  if v_previous.status = 'archived' and (
    v_previous.name <> btrim(p_name)
    or v_previous.starts_on is distinct from p_starts_on
    or v_previous.ends_on is distinct from p_ends_on
  ) then
    raise exception using errcode = '55000', message = 'Uma epoca arquivada nao pode ser alterada.';
  end if;
  if v_previous.status = 'active' and p_status = 'draft' then
    raise exception using errcode = '55000', message = 'Uma epoca ativa nao pode regressar a rascunho.';
  end if;

  update public.seasons
  set name = btrim(p_name), starts_on = p_starts_on, ends_on = p_ends_on, status = p_status
  where id = p_season_id
  returning * into v_season;

  insert into public.audit_events (
    actor_user_id, action, entity_type, entity_id, team_id, season_id, metadata
  ) values (
    v_actor_id,
    case when p_status = 'archived' and v_previous.status <> 'archived'
      then 'season.archived' else 'season.updated' end,
    'season', v_season.id, v_season.team_id, v_season.id,
    jsonb_build_object(
      'previous_values', jsonb_build_object('name', v_previous.name, 'starts_on', v_previous.starts_on, 'ends_on', v_previous.ends_on, 'status', v_previous.status),
      'new_values', jsonb_build_object('name', v_season.name, 'starts_on', v_season.starts_on, 'ends_on', v_season.ends_on, 'status', v_season.status)
    )
  );
  return v_season;
end;
$$;

create function public.save_admin_member(
  p_season_member_id uuid,
  p_season_id uuid,
  p_user_id uuid,
  p_member_type public.member_type,
  p_shirt_number integer,
  p_staff_function text,
  p_status public.member_status,
  p_roles text[]
)
returns public.season_members
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_member public.season_members;
  v_previous public.season_members;
  v_team_id uuid;
  v_role_count integer;
begin
  perform private.assert_admin_actor(v_actor_id);
  if exists (select 1 from unnest(coalesce(p_roles, '{}'::text[])) role_code where role_code not in ('captain', 'treasurer')) then
    raise exception using errcode = '22023', message = 'Funcao adicional invalida.';
  end if;
  if cardinality(coalesce(p_roles, '{}'::text[])) <> cardinality(array(select distinct role_code from unnest(coalesce(p_roles, '{}'::text[])) role_code)) then
    raise exception using errcode = '22023', message = 'Funcoes adicionais duplicadas.';
  end if;

  select team_id into v_team_id from public.seasons
  where id = p_season_id and status <> 'archived';
  if not found then
    raise exception using errcode = '55000', message = 'O plantel de uma epoca arquivada nao pode ser alterado.';
  end if;
  if not exists (select 1 from public.users where id = p_user_id and is_active) then
    raise exception using errcode = 'P0002', message = 'Utilizador ativo nao encontrado.';
  end if;

  if p_season_member_id is null then
    insert into public.season_members (
      season_id, user_id, member_type, shirt_number, staff_function, status
    ) values (
      p_season_id, p_user_id, p_member_type, p_shirt_number,
      nullif(btrim(p_staff_function), ''), p_status
    ) returning * into v_member;
  else
    select * into v_previous from public.season_members where id = p_season_member_id for update;
    if not found or v_previous.season_id <> p_season_id or v_previous.user_id <> p_user_id then
      raise exception using errcode = 'P0002', message = 'Membro nao encontrado nesta epoca.';
    end if;
    update public.season_members set
      member_type = p_member_type,
      shirt_number = p_shirt_number,
      staff_function = nullif(btrim(p_staff_function), ''),
      status = p_status
    where id = p_season_member_id returning * into v_member;
  end if;

  delete from public.member_roles where season_member_id = v_member.id;
  insert into public.member_roles (season_member_id, role_id, assigned_by)
  select v_member.id, r.id, v_actor_id
  from public.roles as r
  where r.code = any(coalesce(p_roles, '{}'::text[]));
  get diagnostics v_role_count = row_count;
  if v_role_count <> cardinality(coalesce(p_roles, '{}'::text[])) then
    raise exception using errcode = '22023', message = 'Uma funcao adicional nao existe.';
  end if;

  insert into public.audit_events (
    actor_user_id, action, entity_type, entity_id, team_id, season_id, metadata
  ) values (
    v_actor_id,
    case when p_season_member_id is null then 'member.created' else 'member.updated' end,
    'season_member', v_member.id, v_team_id, v_member.season_id,
    jsonb_build_object(
      'user_id', v_member.user_id,
      'member_type', v_member.member_type,
      'shirt_number', v_member.shirt_number,
      'staff_function', v_member.staff_function,
      'status', v_member.status,
      'roles', to_jsonb(coalesce(p_roles, '{}'::text[]))
    )
  );
  return v_member;
end;
$$;

create function public.set_admin_photo(
  p_entity_type text,
  p_entity_id uuid,
  p_path text
)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid := auth.uid();
  v_previous_path text;
  v_team_id uuid;
begin
  perform private.assert_admin_actor(v_actor_id);
  if p_path is not null and (
    btrim(p_path) = '' or
    p_path !~ ('^' || case when p_entity_type = 'user' then 'users' else 'teams' end || '/' || p_entity_id::text || '/[a-f0-9-]+[.](jpg|jpeg|png|webp)$')
  ) then
    raise exception using errcode = '22023', message = 'Caminho de fotografia invalido.';
  end if;

  if p_entity_type = 'user' then
    select avatar_path into v_previous_path from public.users where id = p_entity_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'Utilizador nao encontrado.'; end if;
    update public.users set avatar_path = p_path where id = p_entity_id;
  elsif p_entity_type = 'team' then
    select badge_path, id into v_previous_path, v_team_id from public.teams where id = p_entity_id for update;
    if not found then raise exception using errcode = 'P0002', message = 'Equipa nao encontrada.'; end if;
    update public.teams set badge_path = p_path where id = p_entity_id;
  else
    raise exception using errcode = '22023', message = 'Tipo de fotografia invalido.';
  end if;

  insert into public.audit_events (
    actor_user_id, action, entity_type, entity_id, team_id, metadata
  ) values (
    v_actor_id,
    case when p_path is null then 'photo.removed' else 'photo.updated' end,
    p_entity_type, p_entity_id, v_team_id,
    jsonb_build_object('has_photo', p_path is not null)
  );
  return v_previous_path;
end;
$$;

revoke all on function public.save_admin_team(uuid, text, boolean) from public, anon;
revoke all on function public.update_admin_season(uuid, text, date, date, public.season_status) from public, anon;
revoke all on function public.save_admin_member(uuid, uuid, uuid, public.member_type, integer, text, public.member_status, text[]) from public, anon;
revoke all on function public.set_admin_photo(text, uuid, text) from public, anon;
grant execute on function public.save_admin_team(uuid, text, boolean) to authenticated;
grant execute on function public.update_admin_season(uuid, text, date, date, public.season_status) to authenticated;
grant execute on function public.save_admin_member(uuid, uuid, uuid, public.member_type, integer, text, public.member_status, text[]) to authenticated;
grant execute on function public.set_admin_photo(text, uuid, text) to authenticated;

do $$
begin
  if to_regclass('storage.buckets') is not null then
    execute $storage$
      insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
      values (
        'private-photos', 'private-photos', false, 5242880,
        array['image/jpeg', 'image/png', 'image/webp']
      )
      on conflict (id) do update set
        public = false,
        file_size_limit = excluded.file_size_limit,
        allowed_mime_types = excluded.allowed_mime_types
    $storage$;

    execute 'create policy private_photos_read_authorized on storage.objects for select to authenticated using (
      bucket_id = ''private-photos'' and private.is_active_user() and (
        private.is_app_admin()
        or ((storage.foldername(name))[1] = ''users'' and (
          (storage.foldername(name))[2] = auth.uid()::text
          or exists (
            select 1 from public.season_members viewer
            join public.season_members target on target.season_id = viewer.season_id
            where viewer.user_id = auth.uid() and viewer.status = ''active''
              and target.user_id::text = (storage.foldername(name))[2] and target.status = ''active''
          )
        ))
        or ((storage.foldername(name))[1] = ''teams'' and private.is_team_member(((storage.foldername(name))[2])::uuid))
      )
    )';
    execute 'create policy private_photos_insert_admin on storage.objects for insert to authenticated with check (bucket_id = ''private-photos'' and private.is_app_admin())';
    execute 'create policy private_photos_update_admin on storage.objects for update to authenticated using (bucket_id = ''private-photos'' and private.is_app_admin()) with check (bucket_id = ''private-photos'' and private.is_app_admin())';
    execute 'create policy private_photos_delete_admin on storage.objects for delete to authenticated using (bucket_id = ''private-photos'' and private.is_app_admin())';
  end if;
end;
$$;

notify pgrst, 'reload schema';
