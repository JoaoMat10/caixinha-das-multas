select json_build_object(
  'public_tables', (
    select coalesce(json_agg(json_build_object(
      'name', c.relname,
      'rls_enabled', c.relrowsecurity
    ) order by c.relname), '[]'::json)
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind = 'r'
  ),
  'auth_users', (select count(*) from auth.users),
  'storage_buckets', (select count(*) from storage.buckets),
  'storage_objects', (select count(*) from storage.objects),
  'public_storage_policies', (
    select coalesce(json_agg(json_build_object(
      'schema', schemaname,
      'table', tablename,
      'name', policyname,
      'command', cmd
    ) order by schemaname, tablename, policyname), '[]'::json)
    from pg_policies
    where schemaname in ('public', 'storage')
  ),
  'non_internal_triggers', (
    select coalesce(json_agg(json_build_object(
      'schema', n.nspname,
      'table', c.relname,
      'name', t.tgname,
      'enabled', t.tgenabled
    ) order by n.nspname, c.relname, t.tgname), '[]'::json)
    from pg_trigger t
    join pg_class c on c.oid = t.tgrelid
    join pg_namespace n on n.oid = c.relnamespace
    where not t.tgisinternal and n.nspname in ('auth', 'public', 'storage')
  ),
  'event_triggers', (
    select coalesce(json_agg(json_build_object(
      'name', evtname,
      'enabled', evtenabled
    ) order by evtname), '[]'::json)
    from pg_event_trigger
  ),
  'security_definer_functions', (
    select coalesce(json_agg(
      n.nspname || '.' || p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')'
      order by n.nspname, p.proname, pg_get_function_identity_arguments(p.oid)
    ), '[]'::json)
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('private', 'public') and p.prosecdef
  ),
  'test_extensions_installed', (
    select coalesce(json_agg(extname order by extname), '[]'::json)
    from pg_extension
    where extname in ('dblink', 'pgtap')
  )
) as inventory;
