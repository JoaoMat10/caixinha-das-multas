import { createClient } from '@supabase/supabase-js';
import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getLinkedConfiguration,
  runCleanupWithAuthFinally,
  runLinkedSql,
} from './supabase-auth-test-fixture.mjs';

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const credentialsPath = path.join(
  projectDirectory,
  '.manual-validation',
  'members.local.json',
);
const saved = JSON.parse(await readFile(credentialsPath, 'utf8'));
const accounts = saved.accounts ?? [];
if (
  accounts.length !== 3 ||
  accounts.some(
    (account) =>
      !/^manual\.(player|captain|staff)\.[a-f0-9]{10}$/.test(account.username),
  )
)
  throw new Error('As contas não pertencem à validação manual da Fase 07.');

const configuration = await getLinkedConfiguration();
const administrator = createClient(
  configuration.url,
  configuration.serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const ids = accounts.map((account) => `'${account.id}'::uuid`).join(',');

await runCleanupWithAuthFinally(
  () =>
    runLinkedSql(`
      begin;
      alter table public.payment_logs disable trigger payment_logs_are_immutable;
      alter table public.payment_batches disable trigger payment_batches_are_immutable;
      delete from public.payment_logs where fine_id in (
        select f.id from public.fines f
        join public.season_members sm on sm.id = f.season_member_id
        where sm.user_id = any(array[${ids}])
      );
      delete from public.payment_batches where season_member_id in (
        select id from public.season_members where user_id = any(array[${ids}])
      );
      delete from public.fines where season_member_id in (
        select id from public.season_members where user_id = any(array[${ids}])
      );
      delete from public.member_roles where season_member_id in (
        select id from public.season_members where user_id = any(array[${ids}])
      );
      delete from public.season_members where user_id = any(array[${ids}]);
      delete from public.users where id = any(array[${ids}]);
      alter table public.payment_batches enable trigger payment_batches_are_immutable;
      alter table public.payment_logs enable trigger payment_logs_are_immutable;
      commit;
    `),
  async () => {
    const errors = [];
    for (const account of accounts) {
      const deleted = await administrator.auth.admin.deleteUser(account.id);
      if (deleted.error) errors.push(deleted.error);
    }
    if (errors.length > 0)
      throw new AggregateError(
        errors,
        'Não foi possível eliminar todas as identidades Auth manuais.',
      );
  },
);
await rm(credentialsPath);
process.stdout.write(
  'Contas, dados e credenciais da validação manual da Fase 07 removidos.\n',
);
