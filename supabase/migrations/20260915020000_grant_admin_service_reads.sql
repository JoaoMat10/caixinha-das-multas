grant select on table public.users to service_role;
grant select on table public.app_admins to service_role;

comment on table public.admin_user_requests is
  'Chaves de idempotencia de criacao de contas; sem credenciais e acessiveis apenas por funcoes security definer.';

notify pgrst, 'reload schema';
