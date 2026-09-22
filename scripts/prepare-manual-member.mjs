import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getLinkedConfiguration,
  runLinkedSql,
  technicalEmailForUsername,
} from './supabase-auth-test-fixture.mjs';

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const outputDirectory = path.join(projectDirectory, '.manual-validation');
const credentialsPath = path.join(outputDirectory, 'members.local.json');

function literal(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

try {
  await access(credentialsPath);
  throw new Error(
    'Já existem credenciais manuais de membros. Limpa a validação anterior antes de criar outra.',
  );
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

const configuration = await getLinkedConfiguration();
const administrator = createClient(
  configuration.url,
  configuration.serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);
const suffix = randomBytes(5).toString('hex');
const definitions = [
  {
    key: 'player',
    username: `manual.player.${suffix}`,
    displayName: 'Jogador de validação',
    memberType: 'player',
    shirtNumber: 21,
    staffFunction: null,
    isCaptain: false,
    multiplier: 1,
  },
  {
    key: 'captain',
    username: `manual.captain.${suffix}`,
    displayName: 'Capitão de validação',
    memberType: 'player',
    shirtNumber: 7,
    staffFunction: null,
    isCaptain: true,
    multiplier: 2,
  },
  {
    key: 'staff',
    username: `manual.staff.${suffix}`,
    displayName: 'Treinador de validação',
    memberType: 'staff',
    shirtNumber: null,
    staffFunction: 'Treinador',
    isCaptain: false,
    multiplier: 2,
  },
];
const created = [];

try {
  for (const definition of definitions) {
    const password = `Aa1${randomBytes(18).toString('base64url')}`;
    const auth = await administrator.auth.admin.createUser({
      email: technicalEmailForUsername(definition.username),
      password,
      email_confirm: true,
    });
    if (auth.error || !auth.data.user)
      throw new Error(`Não foi possível criar ${definition.key} temporário.`);
    created.push({
      ...definition,
      id: auth.data.user.id,
      password,
      memberId: randomUUID(),
      pendingFineId: randomUUID(),
      paidFineId: randomUUID(),
      paymentBatchId: randomUUID(),
      paymentLogId: randomUUID(),
    });
  }

  const activeSeason = `(
    select s.id
    from public.seasons s
    where s.status = 'active'
      and exists (select 1 from public.fine_categories c where c.season_id = s.id and c.is_active)
      and exists (
        select 1 from public.season_members sm
        join public.member_roles mr on mr.season_member_id = sm.id
        join public.roles r on r.id = mr.role_id and r.code = 'treasurer'
        where sm.season_id = s.id and sm.status = 'active'
      )
    order by s.id
    limit 1
  )`;
  const category = `(
    select c.id
    from public.fine_categories c
    where c.season_id = ${activeSeason} and c.is_active
    order by c.display_order, c.name, c.id
    limit 1
  )`;
  const recorder = `(
    select sm.user_id
    from public.season_members sm
    join public.member_roles mr on mr.season_member_id = sm.id
    join public.roles r on r.id = mr.role_id and r.code = 'treasurer'
    where sm.season_id = ${activeSeason} and sm.status = 'active'
    order by sm.id
    limit 1
  )`;
  const sql = ['begin;'];
  for (const account of created) {
    sql.push(`
      insert into public.users (
        id, username, username_normalized, display_name,
        must_change_password, created_by
      ) values (
        ${literal(account.id)}::uuid,
        ${literal(account.username)},
        ${literal(account.username)},
        ${literal(account.displayName)},
        false,
        '00000000-0000-4000-8000-000000000001'::uuid
      );
      insert into public.season_members (
        id, season_id, user_id, member_type,
        shirt_number, staff_function, status
      ) values (
        ${literal(account.memberId)}::uuid,
        ${activeSeason},
        ${literal(account.id)}::uuid,
        ${literal(account.memberType)}::public.member_type,
        ${account.shirtNumber ?? 'null'},
        ${account.staffFunction ? literal(account.staffFunction) : 'null'},
        'active'
      );
    `);
    if (account.isCaptain) {
      sql.push(`
        insert into public.member_roles (season_member_id, role_id, assigned_by)
        select
          ${literal(account.memberId)}::uuid,
          id,
          '00000000-0000-4000-8000-000000000001'::uuid
        from public.roles where code = 'captain';
      `);
    }
    for (const status of ['pending', 'paid']) {
      const fineId =
        status === 'pending' ? account.pendingFineId : account.paidFineId;
      sql.push(`
        insert into public.fines (
          id, season_id, season_member_id, fine_category_id,
          category_name_snapshot, base_amount_cents_snapshot,
          multiplier, final_amount_cents, occurred_at, notes,
          status, has_ever_been_paid, applied_by, paid_at, idempotency_key
        )
        select
          ${literal(fineId)}::uuid,
          c.season_id,
          ${literal(account.memberId)}::uuid,
          c.id,
          c.name,
          c.base_amount_cents,
          ${account.multiplier},
          c.base_amount_cents * ${account.multiplier},
          now() - ${status === 'pending' ? "interval '1 day'" : "interval '2 days'"},
          ${literal(`${account.displayName} · ${status}`)},
          ${literal(status)}::public.fine_status,
          ${status === 'paid' ? 'true' : 'false'},
          ${recorder},
          ${status === 'paid' ? 'now()' : 'null'},
          ${literal(randomUUID())}::uuid
        from public.fine_categories c where c.id = ${category};
      `);
    }
    sql.push(`
      insert into public.payment_batches (
        id, season_id, season_member_id, action,
        calculated_total_cents, recorded_by, idempotency_key
      )
      select
        ${literal(account.paymentBatchId)}::uuid,
        f.season_id,
        f.season_member_id,
        'paid',
        f.final_amount_cents,
        ${recorder},
        ${literal(randomUUID())}::uuid
      from public.fines f where f.id = ${literal(account.paidFineId)}::uuid;
      insert into public.payment_logs (
        id, payment_batch_id, fine_id, action,
        amount_cents_snapshot, recorded_by
      )
      select
        ${literal(account.paymentLogId)}::uuid,
        ${literal(account.paymentBatchId)}::uuid,
        f.id,
        'paid',
        f.final_amount_cents,
        ${recorder}
      from public.fines f where f.id = ${literal(account.paidFineId)}::uuid;
    `);
  }
  sql.push('commit;');
  await runLinkedSql(sql.join('\n'));

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    credentialsPath,
    `${JSON.stringify(
      {
        accounts: created.map(
          ({ key, id, username, password, displayName, memberId }) => ({
            key,
            id,
            username,
            password,
            displayName,
            memberId,
          }),
        ),
        season: 'época ativa selecionada no projeto de testes',
        expiresAfter: 'validação manual da Fase 06',
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  process.stdout.write(
    'Jogador, capitão e equipa técnica criados; credenciais guardadas apenas na pasta local ignorada.\n',
  );
} catch (error) {
  for (const account of created) {
    await administrator.auth.admin.deleteUser(account.id);
  }
  throw error;
}
