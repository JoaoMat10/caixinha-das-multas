do $baseline$
declare
  actual text;
  expected text;
begin
  if (select count(*) from auth.users) <> 7
    or (select md5(coalesce(string_agg(id::text, '|' order by id), '')) from auth.users)
      <> '450e37fc4c66514638e5180916a02d75'
    or (select count(*) from storage.objects) <> 0
    or exists (
      select 1 from public.users
      where username_normalized like any (
        array['admin.test.%', 'auth.test.%', 'e2e.%', 'financial.test.%', 'managed.%']
      )
    )
    or exists (
      select 1 from pg_roles where rolname like 'caixinha_concurrency_%'
    )
    or exists (
      select 1 from pg_proc where proname like 'caixinha_concurrency_%'
    )
  then
    raise exception 'identity or temporary-data baseline mismatch';
  end if;

  select md5(string_agg(item, '|' order by item)) into actual
  from (
    values
      ('admin_password_reset_requests:' || (select count(*) from public.admin_password_reset_requests) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by actor_user_id, idempotency_key), '')) from public.admin_password_reset_requests t)),
      ('admin_user_requests:' || (select count(*) from public.admin_user_requests) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by actor_user_id, idempotency_key), '')) from public.admin_user_requests t)),
      ('app_admins:' || (select count(*) from public.app_admins) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by user_id), '')) from public.app_admins t)),
      ('audit_events:' || (select count(*) from public.audit_events) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by id), '')) from public.audit_events t)),
      ('fine_categories:' || (select count(*) from public.fine_categories) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by id), '')) from public.fine_categories t)),
      ('fines:' || (select count(*) from public.fines) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by id), '')) from public.fines t)),
      ('member_roles:' || (select count(*) from public.member_roles) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by season_member_id::text || ':' || role_id::text), '')) from public.member_roles t)),
      ('payment_batches:' || (select count(*) from public.payment_batches) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by id), '')) from public.payment_batches t)),
      ('payment_logs:' || (select count(*) from public.payment_logs) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by id), '')) from public.payment_logs t)),
      ('roles:' || (select count(*) from public.roles) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by id), '')) from public.roles t)),
      ('season_members:' || (select count(*) from public.season_members) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by id), '')) from public.season_members t)),
      ('seasons:' || (select count(*) from public.seasons) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by id), '')) from public.seasons t)),
      ('teams:' || (select count(*) from public.teams) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by id), '')) from public.teams t)),
      ('users:' || (select count(*) from public.users) || ':' || (select md5(coalesce(string_agg(to_jsonb(t)::text, '|' order by id), '')) from public.users t))
  ) baseline_items(item);

  select md5(string_agg(item, '|' order by item)) into expected
  from (
    values
      ('admin_password_reset_requests:0:d41d8cd98f00b204e9800998ecf8427e'),
      ('admin_user_requests:0:d41d8cd98f00b204e9800998ecf8427e'),
      ('app_admins:1:8a7b6a889e5cae442bce4a4183b164ab'),
      ('audit_events:2:2eea2047bec98fae7cd133b51466e8d0'),
      ('fine_categories:4:552ebe1038b8d5e956a334c82379d1bb'),
      ('fines:6:01dd4bbc3051269b5b71859028ef06e6'),
      ('member_roles:4:d287bbbe4d8b3a98ec0183865086a555'),
      ('payment_batches:2:68ba7fb4bb295207f70cfaa20522411f'),
      ('payment_logs:2:b1674f35aeafa217f1ce41a10dd17a5d'),
      ('roles:2:f38641fd0fcf24c79a47bab35d7fb519'),
      ('season_members:8:79639394887c3637131c9648f63bbc2a'),
      ('seasons:3:2b9e4fc668936981516948b3780f4e7d'),
      ('teams:2:efd0d7ee816404a2f321a600f0d9bfc9'),
      ('users:7:5163a85abedcd7d07e6d47e0cf463dad')
  ) expected_items(item);

  if actual <> expected then
    raise exception 'public seed fingerprint mismatch';
  end if;

  if (select count(*) from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = 'public' and c.relkind = 'r') <> 14
    or exists (
    select 1
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity
  ) or (select count(*) from pg_policies where schemaname in ('public', 'storage')) <> 33
  then
    raise exception 'rls or policy baseline mismatch';
  end if;

  if (select count(*)
      from pg_trigger t
      join pg_class c on c.oid = t.tgrelid
      join pg_namespace n on n.oid = c.relnamespace
      where not t.tgisinternal and n.nspname in ('auth', 'public', 'storage')) <> 18
    or exists (
    select 1
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal
      and n.nspname in ('auth', 'public', 'storage')
      and t.tgenabled <> 'O'
  ) then
    raise exception 'security trigger disabled';
  end if;

  select md5(coalesce(string_agg(
    pg_get_function_identity_arguments(p.oid) || ':' || pg_get_functiondef(p.oid),
    '|' order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
  ), '')) into actual
  from pg_proc p
  join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('private', 'public') and p.prosecdef;

  if (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname in ('private', 'public') and p.prosecdef) <> 33
    or actual <> '9d45ff37e4132606e767d7f357bbe4ba'
    or (select count(*) from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname in ('private', 'public') and p.prosecdef
          and (p.proconfig is null or not ('search_path=""' = any(p.proconfig)))) <> 1
    or not exists (
      select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
      where n.nspname = 'public' and p.proname = 'rls_auto_enable' and p.prosecdef
        and (p.proconfig is null or not ('search_path=""' = any(p.proconfig)))
    )
  then
    raise exception 'security function baseline mismatch';
  end if;

  if exists (
    select 1 from pg_extension where extname in ('dblink', 'pgtap')
  ) then
    raise exception 'temporary test extension remained installed';
  end if;
end
$baseline$;

select 'baseline_exact' as verification;
