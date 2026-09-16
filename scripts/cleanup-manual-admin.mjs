import { createClient } from '@supabase/supabase-js';
import { access, readFile, rmdir, unlink } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  getLinkedConfiguration,
  runLinkedSql,
} from './supabase-auth-test-fixture.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, '..');
const artifactsDirectory = path.join(projectDirectory, '.manual-validation');
const credentialsPath = path.join(artifactsDirectory, 'owner.local.json');
const avatarPath = path.join(artifactsDirectory, 'avatar-teste.png');
const uuidPattern =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

function sqlLiteral(value) {
  return `'${value.replaceAll("'", "''")}'`;
}

function uuidArray(values) {
  for (const value of values) {
    if (!uuidPattern.test(value))
      throw new Error('Foi encontrado um UUID inválido.');
  }
  return values.length === 0
    ? 'array[]::uuid[]'
    : `array[${values.map((value) => `${sqlLiteral(value)}::uuid`).join(',')}]`;
}

function textArray(values) {
  return values.length === 0
    ? 'array[]::text[]'
    : `array[${values.map((value) => `${sqlLiteral(value)}::text`).join(',')}]`;
}

function parseMarkedPayload(output, marker) {
  const envelope = JSON.parse(
    output.slice(output.indexOf('{'), output.lastIndexOf('}') + 1),
  );
  const payload = envelope.rows?.[0]?.inventory;
  if (typeof payload !== 'string' || !payload.startsWith(marker))
    throw new Error('A consulta não devolveu o resultado esperado.');
  return JSON.parse(payload.slice(marker.length));
}

async function buildInventory() {
  const credentials = JSON.parse(await readFile(credentialsPath, 'utf8'));
  if (
    typeof credentials.username !== 'string' ||
    !credentials.username.startsWith('manual.owner.')
  ) {
    throw new Error(
      'O ficheiro local não identifica um Owner manual autorizado.',
    );
  }

  const configuration = await getLinkedConfiguration();
  const administrator = createClient(
    configuration.url,
    configuration.serviceRoleKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const marker = '__CAIXINHA_MANUAL_INVENTORY__';
  const output = await runLinkedSql(`
    with owner as (
        select * from public.users
        where username_normalized = lower(${sqlLiteral(credentials.username)})
      ), created_users as (
        select u.* from public.users u join owner o on u.created_by = o.id
      ), created_teams as (
        select t.* from public.teams t join owner o on t.created_by = o.id
      ), created_seasons as (
        select s.* from public.seasons s
        where s.created_by in (select id from owner)
           or s.team_id in (select id from created_teams)
      ), manual_audit as (
        select a.* from public.audit_events a join owner o on a.actor_user_id = o.id
      ), created_members as (
        select distinct sm.* from public.season_members sm
        where sm.id in (
          select entity_id from manual_audit
          where action = 'member.created' and entity_id is not null
        )
           or sm.season_id in (select id from created_seasons)
           or sm.user_id in (select id from created_users)
      ), related_fines as (
        select distinct f.* from public.fines f
        where f.season_id in (select id from created_seasons)
           or f.season_member_id in (select id from created_members)
           or f.applied_by in (select id from created_users)
      ), related_batches as (
        select distinct b.* from public.payment_batches b
        where b.season_id in (select id from created_seasons)
           or b.season_member_id in (select id from created_members)
           or b.recorded_by in (select id from created_users)
      ), manual_storage as (
        select so.* from storage.objects so, owner o
        where so.bucket_id = 'private-photos'
          and to_jsonb(so) ->> 'owner_id' = o.id::text
      )
    select ${sqlLiteral(marker)} || jsonb_build_object(
        'owner', (select to_jsonb(o) from owner o),
        'ownerCount', (select count(*) from owner),
        'ownerAdminCount', (select count(*) from public.app_admins where user_id in (select id from owner)),
        'createdUsers', coalesce((select jsonb_agg(to_jsonb(u) order by u.created_at) from created_users u), '[]'::jsonb),
        'createdTeams', coalesce((select jsonb_agg(to_jsonb(t) order by t.created_at) from created_teams t), '[]'::jsonb),
        'createdSeasons', coalesce((select jsonb_agg(to_jsonb(s) order by s.created_at) from created_seasons s), '[]'::jsonb),
        'createdMembers', coalesce((select jsonb_agg(to_jsonb(m) order by m.created_at) from created_members m), '[]'::jsonb),
        'adminUserRequests', coalesce((
          select jsonb_agg(to_jsonb(r) order by r.created_at)
          from public.admin_user_requests r
          where r.actor_user_id in (select id from owner)
             or r.user_id in (select id from created_users)
        ), '[]'::jsonb),
        'passwordResetRequests', coalesce((
          select jsonb_agg(to_jsonb(r) order by r.created_at)
          from public.admin_password_reset_requests r
          where r.actor_user_id in (select id from owner)
             or r.user_id in (select id from created_users)
        ), '[]'::jsonb),
        'auditEvents', coalesce((select jsonb_agg(to_jsonb(a) order by a.occurred_at) from manual_audit a), '[]'::jsonb),
        'storageObjects', coalesce((select jsonb_agg(to_jsonb(so) order by so.created_at) from manual_storage so), '[]'::jsonb),
        'storagePaths', coalesce((select jsonb_agg(so.name order by so.created_at) from manual_storage so), '[]'::jsonb),
        'permanentPhotoTargets', jsonb_build_object(
          'users', coalesce((
            select jsonb_agg(jsonb_build_object('id', u.id, 'avatar_path', u.avatar_path))
            from public.users u
            where u.id in (
              select entity_id from manual_audit
              where action = 'photo.updated' and entity_type = 'user'
            ) and u.id not in (select id from created_users) and u.avatar_path is not null
          ), '[]'::jsonb),
          'teams', coalesce((
            select jsonb_agg(jsonb_build_object('id', t.id, 'badge_path', t.badge_path))
            from public.teams t
            where t.id in (
              select entity_id from manual_audit
              where action = 'photo.updated' and entity_type = 'team'
            ) and t.id not in (select id from created_teams) and t.badge_path is not null
          ), '[]'::jsonb)
        ),
        'financialReferences', jsonb_build_object(
          'fines', coalesce((select jsonb_agg(to_jsonb(f)) from related_fines f), '[]'::jsonb),
          'paymentBatches', coalesce((select jsonb_agg(to_jsonb(b)) from related_batches b), '[]'::jsonb),
          'paymentLogs', coalesce((
            select jsonb_agg(to_jsonb(l)) from public.payment_logs l
            where l.fine_id in (select id from related_fines)
               or l.payment_batch_id in (select id from related_batches)
               or l.recorded_by in (select id from created_users)
          ), '[]'::jsonb)
        )
    )::text as inventory;
  `);
  const inventory = parseMarkedPayload(output, marker);
  if (
    inventory.ownerCount !== 1 ||
    inventory.ownerAdminCount !== 1 ||
    inventory.owner?.created_by !== inventory.owner?.id ||
    inventory.owner?.username_normalized !== credentials.username.toLowerCase()
  ) {
    throw new Error(
      'O Owner manual não corresponde exatamente ao perfil esperado.',
    );
  }
  return { configuration, administrator, inventory };
}

async function removeKnownLocalArtifacts() {
  for (const file of [credentialsPath, avatarPath]) {
    try {
      await unlink(file);
    } catch (error) {
      if (error?.code !== 'ENOENT') throw error;
    }
  }
  try {
    await rmdir(artifactsDirectory);
  } catch (error) {
    if (!['ENOENT', 'ENOTEMPTY'].includes(error?.code)) throw error;
  }
}

async function executeCleanup(context) {
  const { administrator, inventory } = context;
  if (
    inventory.financialReferences.fines.length > 0 ||
    inventory.financialReferences.paymentBatches.length > 0 ||
    inventory.financialReferences.paymentLogs.length > 0
  ) {
    throw new Error(
      'A limpeza foi recusada porque existem referências financeiras.',
    );
  }
  if (inventory.storagePaths.length > 0) {
    const removed = await administrator.storage
      .from('private-photos')
      .remove(inventory.storagePaths);
    if (removed.error)
      throw new Error('Não foi possível remover os ficheiros inventariados.');
  }

  const userIds = inventory.createdUsers.map((user) => user.id);
  const teamIds = inventory.createdTeams.map((team) => team.id);
  const seasonIds = inventory.createdSeasons.map((season) => season.id);
  const memberIds = inventory.createdMembers.map((member) => member.id);
  const permanentUserPhotoValues = inventory.permanentPhotoTargets.users
    .filter((user) => user.avatar_path)
    .map(
      (user) =>
        `(${sqlLiteral(user.id)}::uuid, ${sqlLiteral(user.avatar_path)}::text)`,
    );
  const permanentTeamPhotoValues = inventory.permanentPhotoTargets.teams
    .filter((team) => team.badge_path)
    .map(
      (team) =>
        `(${sqlLiteral(team.id)}::uuid, ${sqlLiteral(team.badge_path)}::text)`,
    );

  await runLinkedSql(`
    begin;
    ${
      permanentUserPhotoValues.length > 0
        ? `update public.users as target set avatar_path = null
           from (values ${permanentUserPhotoValues.join(',')}) as cleanup(id, path)
           where target.id = cleanup.id and target.avatar_path = cleanup.path;`
        : ''
    }
    ${
      permanentTeamPhotoValues.length > 0
        ? `update public.teams as target set badge_path = null
           from (values ${permanentTeamPhotoValues.join(',')}) as cleanup(id, path)
           where target.id = cleanup.id and target.badge_path = cleanup.path;`
        : ''
    }
    delete from public.member_roles
    where season_member_id = any(${uuidArray(memberIds)})
       or assigned_by = any(${uuidArray(userIds)});
    delete from public.season_members where id = any(${uuidArray(memberIds)});
    delete from public.fine_categories where season_id = any(${uuidArray(seasonIds)});
    delete from public.admin_password_reset_requests
    where actor_user_id = any(${uuidArray(userIds)})
       or user_id = any(${uuidArray(userIds)});
    delete from public.admin_user_requests
    where actor_user_id = any(${uuidArray(userIds)})
       or user_id = any(${uuidArray(userIds)});
    alter table public.audit_events disable trigger audit_events_are_immutable;
    delete from public.audit_events
    where actor_user_id = any(${uuidArray(userIds)})
       or entity_id = any(${uuidArray([...userIds, ...teamIds, ...seasonIds, ...memberIds])})
       or team_id = any(${uuidArray(teamIds)})
       or season_id = any(${uuidArray(seasonIds)});
    alter table public.audit_events enable trigger audit_events_are_immutable;
    delete from public.seasons where id = any(${uuidArray(seasonIds)});
    delete from public.teams where id = any(${uuidArray(teamIds)});
    delete from public.app_admins where user_id = any(${uuidArray(userIds)});
    delete from public.users where id = any(${uuidArray(userIds)});
    commit;
  `);

  const authErrors = [];
  for (const userId of userIds) {
    const deleted = await administrator.auth.admin.deleteUser(userId);
    if (deleted.error) authErrors.push(userId);
  }
  if (authErrors.length > 0) {
    throw new Error(`Falhou a remoção Auth de: ${authErrors.join(', ')}`);
  }

  const verificationMarker = '__CAIXINHA_MANUAL_CLEANUP_VERIFICATION__';
  const verificationOutput = await runLinkedSql(`
    select ${sqlLiteral(verificationMarker)} || jsonb_build_object(
      'users', (select count(*) from public.users where id = any(${uuidArray(userIds)})),
      'admins', (select count(*) from public.app_admins where user_id = any(${uuidArray(userIds)})),
      'teams', (select count(*) from public.teams where id = any(${uuidArray(teamIds)})),
      'seasons', (select count(*) from public.seasons where id = any(${uuidArray(seasonIds)})),
      'members', (select count(*) from public.season_members where id = any(${uuidArray(memberIds)})),
      'auditEvents', (
        select count(*) from public.audit_events
        where actor_user_id = any(${uuidArray(userIds)})
           or entity_id = any(${uuidArray([...userIds, ...teamIds, ...seasonIds, ...memberIds])})
           or team_id = any(${uuidArray(teamIds)})
           or season_id = any(${uuidArray(seasonIds)})
      ),
      'storageObjects', (
        select count(*) from storage.objects
        where bucket_id = 'private-photos'
          and name = any(${textArray(inventory.storagePaths)})
      ),
      'remainingUserPhotoPointers', (
        select count(*) from public.users
        where avatar_path = any(${textArray(inventory.storagePaths)})
      ),
      'remainingTeamPhotoPointers', (
        select count(*) from public.teams
        where badge_path = any(${textArray(inventory.storagePaths)})
      )
    )::text as inventory;
  `);
  const verification = parseMarkedPayload(
    verificationOutput,
    verificationMarker,
  );
  if (Object.values(verification).some((count) => count !== 0)) {
    throw new Error(
      `A verificação pós-limpeza encontrou registos: ${JSON.stringify(verification)}`,
    );
  }
  for (const userId of userIds) {
    const authResult = await administrator.auth.admin.getUserById(userId);
    if (!authResult.error || authResult.data?.user) {
      throw new Error(`O utilizador Auth ${userId} ainda existe.`);
    }
  }

  await removeKnownLocalArtifacts();
  process.stdout.write(
    `${JSON.stringify({ databaseAndStorage: verification, authUsers: 0 }, null, 2)}\n`,
  );
}

const mode = process.argv[2] ?? '--inventory';
if (!['--inventory', '--execute'].includes(mode)) {
  throw new Error('Usa --inventory ou --execute.');
}
await access(credentialsPath);
const context = await buildInventory();
process.stdout.write(`${JSON.stringify(context.inventory, null, 2)}\n`);
if (mode === '--execute') {
  await executeCleanup(context);
  process.stdout.write('Limpeza manual concluída.\n');
}
