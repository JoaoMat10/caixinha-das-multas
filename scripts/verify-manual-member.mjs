import { createClient } from '@supabase/supabase-js';
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getLinkedPublicConfiguration,
  technicalEmailForUsername,
} from './supabase-auth-test-fixture.mjs';

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const saved = JSON.parse(
  await readFile(
    path.join(projectDirectory, '.manual-validation', 'members.local.json'),
    'utf8',
  ),
);
const configuration = await getLinkedPublicConfiguration();

for (const account of saved.accounts ?? []) {
  if (!/^manual\.(player|captain|staff)\.[a-f0-9]{10}$/.test(account.username))
    throw new Error('Foi encontrada uma conta manual inesperada.');
  const client = createClient(configuration.url, configuration.publishableKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const login = await client.auth.signInWithPassword({
    email: technicalEmailForUsername(account.username),
    password: account.password,
  });
  if (login.error) throw new Error(`${account.key} não iniciou sessão.`);
  const context = await client.rpc('get_auth_context');
  if (context.error) throw new Error(`${account.key} não carregou o contexto.`);
  const membership = context.data?.memberships?.find(
    (item) => item.id === account.memberId,
  );
  if (!membership)
    throw new Error(`${account.key} não tem a associação esperada.`);
  const balance = await client
    .from('my_season_balances')
    .select('fine_count,total_fined_cents,total_paid_cents,total_debt_cents')
    .eq('season_id', membership.seasonId)
    .eq('season_member_id', account.memberId)
    .single();
  if (balance.error || Number(balance.data?.fine_count) !== 2)
    throw new Error(`${account.key} não tem o saldo temporário esperado.`);
  const totalFined = Number(balance.data.total_fined_cents);
  const totalPaid = Number(balance.data.total_paid_cents);
  const totalDebt = Number(balance.data.total_debt_cents);
  if (
    totalPaid <= 0 ||
    totalDebt !== totalPaid ||
    totalFined !== totalPaid + totalDebt
  )
    throw new Error(`${account.key} não tem os totais pessoais esperados.`);
  const fines = await client
    .from('fines')
    .select('season_member_id,status')
    .eq('season_id', membership.seasonId);
  if (
    fines.error ||
    fines.data?.length !== 2 ||
    fines.data.some((fine) => fine.season_member_id !== account.memberId)
  )
    throw new Error(`${account.key} acedeu a detalhe financeiro inesperado.`);
  const ranking = await client.rpc('get_season_leaderboard', {
    p_season_id: membership.seasonId,
  });
  if (
    ranking.error ||
    !ranking.data?.some(
      (row) =>
        row.season_member_id === account.memberId &&
        Number(row.fine_count) === 2,
    ) ||
    ranking.data.some((row) =>
      Object.keys(row).some((key) =>
        /username|email|auth|admin|owner/i.test(key),
      ),
    )
  )
    throw new Error(`${account.key} não recebeu o ranking público esperado.`);
  const directory = await client.rpc('get_season_member_directory', {
    p_season_id: membership.seasonId,
  });
  const identity = directory.data?.find(
    (row) => row.season_member_id === account.memberId,
  );
  if (
    directory.error ||
    !identity ||
    identity.is_treasurer ||
    identity.is_captain !== (account.key === 'captain') ||
    (account.key === 'staff'
      ? identity.member_type !== 'staff' ||
        identity.staff_function !== 'Treinador'
      : identity.member_type !== 'player' || !identity.shirt_number)
  )
    throw new Error(`${account.key} não tem a apresentação esperada.`);
  await client.auth.signOut({ scope: 'local' });
}

process.stdout.write(
  'Login, saldos pessoais, isolamento de detalhe e rankings confirmados para os três perfis.\n',
);
