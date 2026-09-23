import assert from 'node:assert/strict';
import { readdir, readFile } from 'node:fs/promises';
import { test } from 'node:test';
import { fileURLToPath, URL } from 'node:url';

import { PGlite } from '@electric-sql/pglite';

const migrationsDirectory = fileURLToPath(
  new URL('../../supabase/migrations', import.meta.url),
);
const seedPath = fileURLToPath(
  new URL('../../supabase/seed.sql', import.meta.url),
);

const ids = {
  owner: '00000000-0000-4000-8000-000000000001',
  treasurerA: '00000000-0000-4000-8000-000000000002',
  playerA: '00000000-0000-4000-8000-000000000003',
  captainA: '00000000-0000-4000-8000-000000000004',
  staffA: '00000000-0000-4000-8000-000000000005',
  playerB: '00000000-0000-4000-8000-000000000006',
  treasurerB: '00000000-0000-4000-8000-000000000007',
  teamA: '20000000-0000-4000-8000-000000000001',
  teamB: '20000000-0000-4000-8000-000000000002',
  seasonA: '30000000-0000-4000-8000-000000000001',
  seasonAOld: '30000000-0000-4000-8000-000000000002',
  seasonB: '30000000-0000-4000-8000-000000000003',
  treasurerMemberA: '40000000-0000-4000-8000-000000000001',
  playerMemberA: '40000000-0000-4000-8000-000000000002',
  captainMemberA: '40000000-0000-4000-8000-000000000003',
  staffMemberA: '40000000-0000-4000-8000-000000000004',
  playerMemberAOld: '40000000-0000-4000-8000-000000000005',
  treasurerMemberAOld: '40000000-0000-4000-8000-000000000008',
  playerMemberB: '40000000-0000-4000-8000-000000000007',
  categoryA: '50000000-0000-4000-8000-000000000001',
  categoryAOld: '50000000-0000-4000-8000-000000000003',
  categoryB: '50000000-0000-4000-8000-000000000004',
  fineAOld: '60000000-0000-4000-8000-000000000006',
};

const authBootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create role service_role nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    encrypted_password text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  grant usage on schema auth to anon, authenticated, service_role;
  grant execute on function auth.uid() to anon, authenticated, service_role;
`;

async function createSeededDatabase() {
  const database = new PGlite();
  await database.exec(authBootstrap);

  const migrations = (await readdir(migrationsDirectory))
    .filter((file) => file.endsWith('.sql'))
    .sort();

  for (const migration of migrations) {
    const sql = await readFile(`${migrationsDirectory}/${migration}`, 'utf8');
    await database.exec(sql);
  }

  await database.exec(await readFile(seedPath, 'utf8'));
  return database;
}

async function rows(database, sql, parameters = []) {
  return (await database.query(sql, parameters)).rows;
}

async function asRole(database, role, userId, operation) {
  await database.exec(`set role ${role}`);

  if (userId) {
    await database.query(
      "select set_config('request.jwt.claim.sub', $1, false)",
      [userId],
    );
  }

  try {
    return await operation();
  } finally {
    await database.exec('reset role');
    await database.exec(
      "select set_config('request.jwt.claim.sub', '', false)",
    );
  }
}

test('as migracoes e seeds sao reproduziveis', async () => {
  const firstDatabase = await createSeededDatabase();
  const secondDatabase = await createSeededDatabase();

  try {
    const snapshotSql = `
      select
        (select count(*)::integer from public.users) as users,
        (select count(*)::integer from public.teams) as teams,
        (select count(*)::integer from public.seasons) as seasons,
        (select count(*)::integer from public.season_members) as members,
        (select count(*)::integer from public.fines) as fines,
        (select count(*)::integer from public.payment_logs) as payment_logs
    `;

    const firstSnapshot = (await rows(firstDatabase, snapshotSql))[0];
    const secondSnapshot = (await rows(secondDatabase, snapshotSql))[0];

    assert.deepEqual(firstSnapshot, {
      users: 7,
      teams: 2,
      seasons: 3,
      members: 8,
      fines: 6,
      payment_logs: 2,
    });
    assert.deepEqual(secondSnapshot, firstSnapshot);
  } finally {
    await firstDatabase.close();
    await secondDatabase.close();
  }
});

test('constraints estruturais e financeiras rejeitam estados invalidos', async () => {
  const database = await createSeededDatabase();

  try {
    await assert.rejects(
      database.query(
        `insert into public.seasons
          (id, team_id, name, status, created_by, idempotency_key)
         values
          ('30000000-0000-4000-8000-000000000099',
           '20000000-0000-4000-8000-000000000001',
           'Epoca ativa duplicada',
           'active',
           $1,
           '82000000-0000-4000-8000-000000000099')`,
        [ids.owner],
      ),
      /seasons_one_active_per_team_key/,
    );

    await assert.rejects(
      database.query(
        `insert into public.season_members
          (season_id, user_id, member_type, shirt_number, staff_function)
         values ($1, $2, 'staff', 99, 'Adjunto')`,
        [ids.seasonA, ids.playerB],
      ),
      /season_members_identity_by_type/,
    );

    await assert.rejects(
      database.query(
        `insert into public.fines (
          season_id, season_member_id, fine_category_id,
          category_name_snapshot, base_amount_cents_snapshot,
          multiplier, final_amount_cents, occurred_at,
          applied_by, idempotency_key
        ) values ($1, $2, $3, 'Atraso', 500, 2, 500, now(), $4,
          '80000000-0000-4000-8000-000000000099')`,
        [ids.seasonA, ids.playerMemberA, ids.categoryA, ids.treasurerA],
      ),
      /fines_final_amount_calculated/,
    );

    await assert.rejects(
      database.query(
        `insert into public.seasons
          (id, team_id, name, status, copied_from_season_id, created_by, idempotency_key)
         values
          ('30000000-0000-4000-8000-000000000098',
           '20000000-0000-4000-8000-000000000002',
           'Copia invalida',
           'draft',
           $1,
           $2,
           '82000000-0000-4000-8000-000000000098')`,
        [ids.seasonA, ids.owner],
      ),
      /seasons_copy_source_same_team_fk/,
    );

    await assert.rejects(
      database.query(
        `update public.fines
         set category_name_snapshot = 'Historico alterado'
         where id = '60000000-0000-4000-8000-000000000001'`,
      ),
      /dados historicos da multa sao imutaveis/i,
    );

    await assert.rejects(
      database.query(
        `update public.payment_logs
         set amount_cents_snapshot = 999
         where id = '71000000-0000-4000-8000-000000000001'`,
      ),
      /registo contabilistico e imutavel/i,
    );
  } finally {
    await database.close();
  }
});

test('RLS isola equipas, epocas, perfis privados e detalhe financeiro', async () => {
  const database = await createSeededDatabase();

  try {
    assert.deepEqual(
      await rows(
        database,
        `select c.relname
         from pg_catalog.pg_class as c
         join pg_catalog.pg_namespace as n on n.oid = c.relnamespace
         where n.nspname = 'public'
           and c.relkind = 'r'
           and c.relname in (
             'users', 'app_admins', 'teams', 'seasons', 'season_members',
             'roles', 'member_roles', 'fine_categories', 'fines',
             'payment_batches', 'payment_logs', 'audit_events',
             'admin_user_requests', 'admin_password_reset_requests'
           )
           and not c.relrowsecurity`,
      ),
      [],
    );

    assert.deepEqual(
      (
        await rows(
          database,
          `select
             has_table_privilege('anon', 'public.teams', 'select') as anon_select,
             has_table_privilege('authenticated', 'public.fines', 'insert') as fine_insert,
             has_table_privilege('authenticated', 'public.fines', 'update') as fine_update,
             has_table_privilege('authenticated', 'public.fines', 'delete') as fine_delete,
             has_table_privilege('authenticated', 'public.admin_user_requests', 'select') as user_request_select,
             has_table_privilege('authenticated', 'public.admin_password_reset_requests', 'select') as reset_request_select`,
        )
      )[0],
      {
        anon_select: false,
        fine_insert: false,
        fine_update: false,
        fine_delete: false,
        user_request_select: false,
        reset_request_select: false,
      },
    );

    assert.deepEqual(
      await rows(
        database,
        `select n.nspname, p.proname
         from pg_catalog.pg_proc as p
         join pg_catalog.pg_namespace as n on n.oid = p.pronamespace
         where n.nspname in ('private', 'public')
           and p.prosecdef
           and (
             p.proconfig is null
             or not ('search_path=""' = any(p.proconfig))
           )`,
      ),
      [],
    );

    await asRole(database, 'anon', null, async () => {
      await assert.rejects(database.query('select * from public.teams'));
    });

    await asRole(database, 'authenticated', ids.playerA, async () => {
      assert.deepEqual(
        await rows(database, 'select name from public.teams order by name'),
        [{ name: 'Clube Azul' }],
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.seasons',
          )
        )[0].count,
        2,
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.users',
          )
        )[0].count,
        1,
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.app_admins',
          )
        )[0].count,
        0,
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.fines',
          )
        )[0].count,
        2,
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.treasury_season_totals',
          )
        )[0].count,
        0,
      );
      assert.deepEqual(
        (
          await rows(
            database,
            `select fine_count, total_fined_cents, total_paid_cents, total_debt_cents
             from public.my_season_balances
             where season_id = $1`,
            [ids.seasonA],
          )
        )[0],
        {
          fine_count: 1,
          total_fined_cents: 500,
          total_paid_cents: 0,
          total_debt_cents: 500,
        },
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.get_season_leaderboard($1)',
            [ids.seasonA],
          )
        )[0].count,
        4,
      );
      await assert.rejects(
        database.query('select * from public.get_season_leaderboard($1)', [
          ids.seasonB,
        ]),
        /Sem acesso ao ranking/,
      );
    });

    await asRole(database, 'authenticated', ids.playerB, async () => {
      assert.deepEqual(await rows(database, 'select name from public.teams'), [
        { name: 'Clube Verde' },
      ]);
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.fines',
          )
        )[0].count,
        1,
      );
    });

    await asRole(database, 'authenticated', ids.captainA, async () => {
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.seasons',
          )
        )[0].count,
        1,
      );
      await assert.rejects(
        database.query('select * from public.get_season_leaderboard($1)', [
          ids.seasonAOld,
        ]),
        /Sem acesso ao ranking/,
      );
    });

    await asRole(database, 'authenticated', ids.treasurerA, async () => {
      assert.deepEqual(
        (
          await rows(
            database,
            `select fine_count, total_fined_cents, total_received_cents, total_debt_cents
             from public.treasury_season_totals
             where season_id = $1`,
            [ids.seasonA],
          )
        )[0],
        {
          fine_count: 4,
          total_fined_cents: 1800,
          total_received_cents: 200,
          total_debt_cents: 1600,
        },
      );
    });

    await asRole(database, 'authenticated', ids.owner, async () => {
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.teams',
          )
        )[0].count,
        2,
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.users',
          )
        )[0].count,
        7,
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.fines',
          )
        )[0].count,
        0,
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.audit_events',
          )
        )[0].count,
        2,
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.get_season_member_directory($1)',
            [ids.seasonA],
          )
        )[0].count,
        4,
      );
      await assert.rejects(
        database.query('select * from public.get_season_leaderboard($1)', [
          ids.seasonA,
        ]),
        /Sem acesso ao ranking/,
      );
      await assert.rejects(
        database.query(
          `select * from public.save_fine_category(
            $1, null, 'Sem permissao', null, 100, true, 99
          )`,
          [ids.seasonA],
        ),
        /Sem permissao para gerir o catalogo/,
      );

      await assert.rejects(
        database.query(
          `insert into public.teams (name, created_by)
           values ('Sem acesso direto', $1)`,
          [ids.owner],
        ),
      );
    });
  } finally {
    await database.close();
  }
});

test('save_fine_category audita criacao, alteracoes e rollback atomico', async () => {
  const database = await createSeededDatabase();
  let categoryId;

  try {
    await asRole(database, 'authenticated', ids.treasurerA, async () => {
      const category = (
        await rows(
          database,
          `select * from public.save_fine_category(
            $1, null, 'Equipamento', 'Material em falta', 250, true, 40
          )`,
          [ids.seasonA],
        )
      )[0];
      categoryId = category.id;

      await rows(
        database,
        `select * from public.save_fine_category(
          $1, $2, 'Equipamento atualizado', null, 350, false, 45
        )`,
        [ids.seasonA, categoryId],
      );

      await rows(
        database,
        `select * from public.save_fine_category(
          $1, $2, 'Equipamento atualizado', 'Categoria reativada', 400, true, 50
        )`,
        [ids.seasonA, categoryId],
      );

      await assert.rejects(
        database.query(
          `select * from public.save_fine_category(
            $1, null, 'Categoria invalida', null, 9, true, 60
          )`,
          [ids.seasonA],
        ),
        /fine_categories_minimum_amount/,
      );

      await database.exec('begin');
      try {
        await rows(
          database,
          `select * from public.save_fine_category(
            $1, null, 'Categoria revertida', null, 500, true, 70
          )`,
          [ids.seasonA],
        );
      } finally {
        await database.exec('rollback');
      }
    });

    assert.deepEqual(
      (
        await rows(
          database,
          `select
            action,
            actor_user_id::text,
            entity_type,
            entity_id::text,
            team_id::text,
            season_id::text,
            metadata ? 'previous_values' as has_previous_values,
            metadata #>> '{new_values,name}' as new_name,
            metadata #>> '{new_values,description}' as new_description,
            (metadata #>> '{new_values,base_amount_cents}')::integer as new_amount,
            (metadata #>> '{new_values,is_active}')::boolean as new_is_active,
            (metadata #>> '{new_values,display_order}')::integer as new_order
          from public.audit_events
          where action = 'fine_category.created'
            and entity_id = $1`,
          [categoryId],
        )
      )[0],
      {
        action: 'fine_category.created',
        actor_user_id: ids.treasurerA,
        entity_type: 'fine_category',
        entity_id: categoryId,
        team_id: ids.teamA,
        season_id: ids.seasonA,
        has_previous_values: false,
        new_name: 'Equipamento',
        new_description: 'Material em falta',
        new_amount: 250,
        new_is_active: true,
        new_order: 40,
      },
    );

    const updateEventSql = `select
      action,
      actor_user_id::text,
      entity_id::text,
      team_id::text,
      season_id::text,
      metadata #>> '{previous_values,name}' as previous_name,
      metadata #>> '{previous_values,description}' as previous_description,
      (metadata #>> '{previous_values,base_amount_cents}')::integer as previous_amount,
      (metadata #>> '{previous_values,is_active}')::boolean as previous_is_active,
      (metadata #>> '{previous_values,display_order}')::integer as previous_order,
      metadata #>> '{new_values,name}' as new_name,
      metadata #>> '{new_values,description}' as new_description,
      (metadata #>> '{new_values,base_amount_cents}')::integer as new_amount,
      (metadata #>> '{new_values,is_active}')::boolean as new_is_active,
      (metadata #>> '{new_values,display_order}')::integer as new_order
    from public.audit_events
    where action = 'fine_category.updated'
      and entity_id = $1
      and (metadata #>> '{new_values,is_active}')::boolean = $2`;

    assert.deepEqual(
      (await rows(database, updateEventSql, [categoryId, false]))[0],
      {
        action: 'fine_category.updated',
        actor_user_id: ids.treasurerA,
        entity_id: categoryId,
        team_id: ids.teamA,
        season_id: ids.seasonA,
        previous_name: 'Equipamento',
        previous_description: 'Material em falta',
        previous_amount: 250,
        previous_is_active: true,
        previous_order: 40,
        new_name: 'Equipamento atualizado',
        new_description: null,
        new_amount: 350,
        new_is_active: false,
        new_order: 45,
      },
    );

    assert.deepEqual(
      (await rows(database, updateEventSql, [categoryId, true]))[0],
      {
        action: 'fine_category.updated',
        actor_user_id: ids.treasurerA,
        entity_id: categoryId,
        team_id: ids.teamA,
        season_id: ids.seasonA,
        previous_name: 'Equipamento atualizado',
        previous_description: null,
        previous_amount: 350,
        previous_is_active: false,
        previous_order: 45,
        new_name: 'Equipamento atualizado',
        new_description: 'Categoria reativada',
        new_amount: 400,
        new_is_active: true,
        new_order: 50,
      },
    );

    assert.deepEqual(
      (
        await rows(
          database,
          `select
            (select count(*)::integer
             from public.fine_categories
             where name = 'Categoria invalida') as invalid_categories,
            (select count(*)::integer
             from public.audit_events
             where metadata #>> '{new_values,name}' = 'Categoria invalida') as invalid_audit_events,
            (select count(*)::integer
             from public.fine_categories
             where name = 'Categoria revertida') as reverted_categories,
            (select count(*)::integer
             from public.audit_events
             where metadata #>> '{new_values,name}' = 'Categoria revertida') as reverted_audit_events`,
        )
      )[0],
      {
        invalid_categories: 0,
        invalid_audit_events: 0,
        reverted_categories: 0,
        reverted_audit_events: 0,
      },
    );
  } finally {
    await database.close();
  }
});

test('RPCs aplicam multiplicadores, transicoes, idempotencia e autorizacao', async () => {
  const database = await createSeededDatabase();

  try {
    await asRole(database, 'authenticated', ids.playerA, async () => {
      await assert.rejects(
        database.query(
          `select * from public.create_season(
            $1, '2027/28', '2027-08-01', '2028-06-30', 'draft', $2,
            '83000000-0000-4000-8000-000000000001'
          )`,
          [ids.teamA, ids.seasonA],
        ),
        /Apenas o Owner/,
      );

      await assert.rejects(
        database.query(
          `select * from public.apply_fine(
            $1, $2, '2026-09-10 18:00:00+00', null,
            '81000000-0000-4000-8000-000000000001'
          )`,
          [ids.playerMemberA, ids.categoryA],
        ),
        /Sem permissao de tesoureiro/,
      );
    });

    await asRole(database, 'authenticated', ids.owner, async () => {
      const copiedSeason = (
        await rows(
          database,
          `select * from public.create_season(
            $1, '2027/28', '2027-08-01', '2028-06-30', 'draft', $2,
            '83000000-0000-4000-8000-000000000002'
          )`,
          [ids.teamA, ids.seasonA],
        )
      )[0];

      const repeatedCopy = (
        await rows(
          database,
          `select * from public.create_season(
            $1, '2027/28', '2027-08-01', '2028-06-30', 'draft', $2,
            '83000000-0000-4000-8000-000000000002'
          )`,
          [ids.teamA, ids.seasonA],
        )
      )[0];
      assert.equal(repeatedCopy.id, copiedSeason.id);

      assert.deepEqual(
        (
          await rows(
            database,
            `select
              (select count(*)::integer from public.season_members where season_id = $1) as members,
              (select count(*)::integer
               from public.member_roles as mr
               join public.season_members as sm on sm.id = mr.season_member_id
               where sm.season_id = $1) as roles,
              (select count(*)::integer from public.fine_categories where season_id = $1) as categories,
              (select count(*)::integer from public.fines where season_id = $1) as fines,
              (select count(*)::integer from public.payment_batches where season_id = $1) as batches`,
            [copiedSeason.id],
          )
        )[0],
        { members: 4, roles: 2, categories: 2, fines: 0, batches: 0 },
      );

      await assert.rejects(
        database.query(
          `select * from public.create_season(
            $1, 'Copia cruzada', null, null, 'draft', $2,
            '83000000-0000-4000-8000-000000000003'
          )`,
          [ids.teamB, ids.seasonA],
        ),
        /Epoca de origem nao encontrada na equipa/,
      );
    });

    await asRole(database, 'authenticated', ids.treasurerA, async () => {
      const minimumCategory = (
        await rows(
          database,
          `select * from public.save_fine_category(
            $1, null, 'Multa minima', null, 10, true, 30
          )`,
          [ids.seasonA],
        )
      )[0];
      assert.equal(minimumCategory.base_amount_cents, 10);

      const deactivatedCategory = (
        await rows(
          database,
          `select * from public.save_fine_category(
            $1, $2, 'Multa minima', null, 10, false, 30
          )`,
          [ids.seasonA, minimumCategory.id],
        )
      )[0];
      assert.equal(deactivatedCategory.is_active, false);

      await assert.rejects(
        database.query(
          `select * from public.save_fine_category(
            $1, null, 'Epoca arquivada', null, 100, true, 99
          )`,
          [ids.seasonAOld],
        ),
        /Sem permissao para gerir o catalogo/,
      );

      await assert.rejects(
        database.query(
          `select * from public.apply_fine(
            $1, $2, '2026-09-10 18:00:00+00', null,
            '81000000-0000-4000-8000-000000000002'
          )`,
          [ids.playerMemberB, ids.categoryB],
        ),
        /Sem permissao de tesoureiro/,
      );

      const normalFine = (
        await rows(
          database,
          `select * from public.apply_fine(
            $1, $2, '2026-09-10 18:00:00+00', 'Teste normal',
            '81000000-0000-4000-8000-000000000003'
          )`,
          [ids.playerMemberA, ids.categoryA],
        )
      )[0];
      assert.equal(normalFine.multiplier, 1);
      assert.equal(normalFine.final_amount_cents, 500);

      const repeatedFine = (
        await rows(
          database,
          `select * from public.apply_fine(
            $1, $2, '2026-09-10 18:00:00+00', 'Teste normal',
            '81000000-0000-4000-8000-000000000003'
          )`,
          [ids.playerMemberA, ids.categoryA],
        )
      )[0];
      assert.equal(repeatedFine.id, normalFine.id);

      const captainFine = (
        await rows(
          database,
          `select * from public.apply_fine(
            $1, $2, '2026-09-10 18:05:00+00', null,
            '81000000-0000-4000-8000-000000000004'
          )`,
          [ids.captainMemberA, ids.categoryA],
        )
      )[0];
      assert.equal(captainFine.multiplier, 2);
      assert.equal(captainFine.final_amount_cents, 1000);

      const staffFine = (
        await rows(
          database,
          `select * from public.apply_fine(
            $1, $2, '2026-09-10 18:10:00+00', null,
            '81000000-0000-4000-8000-000000000005'
          )`,
          [ids.staffMemberA, ids.categoryA],
        )
      )[0];
      assert.equal(staffFine.multiplier, 2);
      assert.equal(staffFine.final_amount_cents, 1000);

      const paidBatch = (
        await rows(
          database,
          `select * from public.record_payment_batch(
            $1, array[$2]::uuid[], 'paid',
            '91000000-0000-4000-8000-000000000001'
          )`,
          [ids.playerMemberA, normalFine.id],
        )
      )[0];
      assert.equal(paidBatch.calculated_total_cents, 500);

      const repeatedBatch = (
        await rows(
          database,
          `select * from public.record_payment_batch(
            $1, array[$2]::uuid[], 'paid',
            '91000000-0000-4000-8000-000000000001'
          )`,
          [ids.playerMemberA, normalFine.id],
        )
      )[0];
      assert.equal(repeatedBatch.id, paidBatch.id);

      await rows(
        database,
        `select * from public.record_payment_batch(
          $1, array[$2]::uuid[], 'reopened',
          '91000000-0000-4000-8000-000000000002'
        )`,
        [ids.playerMemberA, normalFine.id],
      );

      await assert.rejects(
        database.query('select public.delete_pending_fine($1)', [
          normalFine.id,
        ]),
        /nunca foram pagas/,
      );

      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.payment_logs where fine_id = $1',
            [normalFine.id],
          )
        )[0].count,
        2,
      );

      assert.equal(
        (
          await rows(
            database,
            `select status, has_ever_been_paid
             from public.fines where id = $1`,
            [normalFine.id],
          )
        )[0].has_ever_been_paid,
        true,
      );

      const deletableFine = (
        await rows(
          database,
          `select * from public.apply_fine(
            $1, $2, '2026-09-10 18:15:00+00', null,
            '81000000-0000-4000-8000-000000000006'
          )`,
          [ids.treasurerMemberA, ids.categoryA],
        )
      )[0];
      const deleted = (
        await rows(database, 'select public.delete_pending_fine($1) as id', [
          deletableFine.id,
        ])
      )[0];
      assert.equal(deleted.id, deletableFine.id);
    });
  } finally {
    await database.close();
  }
});

test('tesouraria liquida duas multas sem duplicar, preserva snapshots e reconcilia totais', async () => {
  const database = await createSeededDatabase();
  try {
    await asRole(database, 'authenticated', ids.owner, async () => {
      await assert.rejects(
        database.query(
          `select * from public.save_fine_category($1, null, 'Sem permissao', null, 100, true, 1)`,
          [ids.seasonA],
        ),
        /Sem permissao/,
      );
      await assert.rejects(
        database.query(
          `select * from public.apply_fine($1, $2, now(), null, '81000000-0000-4000-8000-000000000088')`,
          [ids.playerMemberA, ids.categoryA],
        ),
        /Sem permissao de tesoureiro/,
      );
      await assert.rejects(
        database.query(
          `select * from public.record_payment_batch($1, array['60000000-0000-4000-8000-000000000001']::uuid[], 'paid', '91000000-0000-4000-8000-000000000087')`,
          [ids.playerMemberA],
        ),
        /Sem permissao de tesoureiro/,
      );
      await assert.rejects(
        database.query(
          `select public.delete_pending_fine('60000000-0000-4000-8000-000000000001')`,
        ),
        /Sem permissao de tesoureiro/,
      );
    });

    await asRole(database, 'authenticated', ids.treasurerA, async () => {
      const totals = async () =>
        (
          await rows(
            database,
            `select * from public.treasury_season_totals where season_id = $1`,
            [ids.seasonA],
          )
        )[0];
      const before = await totals();
      const firstSql = `select * from public.apply_fine($1, $2, '2026-09-11 12:00:00+00', 'Lote', '81000000-0000-4000-8000-000000000089')`;
      const [firstCall, repeatedCall] = await Promise.all([
        database.query(firstSql, [ids.playerMemberA, ids.categoryA]),
        database.query(firstSql, [ids.playerMemberA, ids.categoryA]),
      ]);
      const first = firstCall.rows[0];
      assert.equal(repeatedCall.rows[0].id, first.id);
      const second = (
        await rows(
          database,
          `select * from public.apply_fine($1, $2, '2026-09-11 12:05:00+00', null, '81000000-0000-4000-8000-000000000090')`,
          [ids.playerMemberA, ids.categoryA],
        )
      )[0];
      assert.equal(first.multiplier, 1);
      assert.equal(second.multiplier, 1);

      await rows(
        database,
        `select * from public.save_fine_category($1, $2, 'Novo nome', null, 900, true, 8)`,
        [ids.seasonA, ids.categoryA],
      );
      const snapshot = (
        await rows(
          database,
          `select category_name_snapshot, base_amount_cents_snapshot, final_amount_cents from public.fines where id = $1`,
          [first.id],
        )
      )[0];
      assert.equal(snapshot.base_amount_cents_snapshot, 500);
      assert.equal(snapshot.final_amount_cents, 500);
      assert.notEqual(snapshot.category_name_snapshot, 'Novo nome');

      const selected = [first.id, second.id];
      const batchSql = `select * from public.record_payment_batch($1, $2::uuid[], 'paid', '91000000-0000-4000-8000-000000000088')`;
      const [batchCall, repeatedBatchCall] = await Promise.all([
        database.query(batchSql, [ids.playerMemberA, selected]),
        database.query(batchSql, [ids.playerMemberA, selected]),
      ]);
      const batch = batchCall.rows[0];
      assert.equal(repeatedBatchCall.rows[0].id, batch.id);
      assert.equal(batch.calculated_total_cents, 1000);
      assert.equal(
        (
          await rows(
            database,
            `select count(*)::integer as count from public.payment_logs where payment_batch_id = $1`,
            [batch.id],
          )
        )[0].count,
        2,
      );
      const afterPaid = await totals();
      assert.equal(
        Number(afterPaid.total_fined_cents),
        Number(before.total_fined_cents) + 1000,
      );
      assert.equal(
        Number(afterPaid.total_received_cents),
        Number(before.total_received_cents) + 1000,
      );
      assert.equal(
        Number(afterPaid.total_debt_cents),
        Number(before.total_debt_cents),
      );

      await assert.rejects(
        database.query(
          `select * from public.record_payment_batch($1, $2::uuid[], 'paid', '91000000-0000-4000-8000-000000000089')`,
          [ids.playerMemberA, selected],
        ),
        /nao permitem a transicao/,
      );
      await assert.rejects(
        database.query(
          `select * from public.record_payment_batch($1, $2::uuid[], 'reopened', '91000000-0000-4000-8000-000000000090')`,
          [
            ids.playerMemberA,
            [first.id, '60000000-0000-4000-8000-000000000099'],
          ],
        ),
        /Todas as multas devem pertencer/,
      );
      assert.equal(
        (
          await rows(
            database,
            `select count(*)::integer as count from public.payment_logs where payment_batch_id = $1`,
            [batch.id],
          )
        )[0].count,
        2,
      );

      const reopened = (
        await rows(
          database,
          `select * from public.record_payment_batch($1, $2::uuid[], 'reopened', '91000000-0000-4000-8000-000000000091')`,
          [ids.playerMemberA, [first.id]],
        )
      )[0];
      assert.equal(reopened.calculated_total_cents, 500);
      const afterReopen = await totals();
      assert.equal(
        Number(afterReopen.total_received_cents),
        Number(before.total_received_cents) + 500,
      );
      assert.equal(
        Number(afterReopen.total_debt_cents),
        Number(before.total_debt_cents) + 500,
      );
      await assert.rejects(
        database.query('select public.delete_pending_fine($1)', [first.id]),
        /nunca foram pagas/,
      );
      assert.equal(
        (
          await rows(
            database,
            `select count(*)::integer as count from public.payment_logs where fine_id = $1`,
            [first.id],
          )
        )[0].count,
        2,
      );
    });
  } finally {
    await database.close();
  }
});

test('matriz RBAC cobre perfis, Owner membro, epoca arquivada e conta inativa', async () => {
  const database = await createSeededDatabase();

  try {
    for (const [userId, label] of [
      [ids.captainA, 'capitao'],
      [ids.staffA, 'staff'],
    ]) {
      await asRole(database, 'authenticated', userId, async () => {
        await assert.rejects(
          database.query(
            `select * from public.apply_fine(
              $1, $2, '2026-09-12 18:00:00+00', $3,
              '81000000-0000-4000-8000-000000000101'
            )`,
            [ids.playerMemberA, ids.categoryA, label],
          ),
          /Sem permissao de tesoureiro/,
        );
        await assert.rejects(
          database.query('select public.get_admin_overview()'),
          /Apenas o Owner/,
        );
      });
    }

    let ownerMemberId;
    await asRole(database, 'authenticated', ids.owner, async () => {
      ownerMemberId = (
        await rows(
          database,
          `select id from public.save_admin_member(
            null, $1, $2, 'player', 99, null, 'active', '{}'::text[]
          )`,
          [ids.seasonA, ids.owner],
        )
      )[0].id;
      await rows(
        database,
        `select id from public.save_admin_member(
          $1, $2, $3, 'staff', null, 'Treinadora', 'active', array['captain']::text[]
        )`,
        [ids.staffMemberA, ids.seasonA, ids.staffA],
      );
    });

    await asRole(database, 'authenticated', ids.owner, async () => {
      const ranking = await rows(
        database,
        'select * from public.get_season_leaderboard($1)',
        [ids.seasonA],
      );
      const ownerEntry = ranking.find(
        (entry) => entry.season_member_id === ownerMemberId,
      );
      assert.ok(ownerEntry);
      assert.equal(
        Object.keys(ownerEntry).some((key) =>
          /username|email|auth|admin|owner|treasurer/i.test(key),
        ),
        false,
      );
      await assert.rejects(
        database.query(
          `select * from public.apply_fine(
            $1, $2, now(), null,
            '81000000-0000-4000-8000-000000000102'
          )`,
          [ids.playerMemberA, ids.categoryA],
        ),
        /Sem permissao de tesoureiro/,
      );
    });

    await asRole(database, 'authenticated', ids.treasurerA, async () => {
      const directory = await rows(
        database,
        'select * from public.get_season_member_directory($1)',
        [ids.seasonA],
      );
      assert.equal(directory.length, 5);
      assert.equal(
        directory.some((entry) =>
          Object.keys(entry).some((key) =>
            /username|email|auth|admin|owner/i.test(key),
          ),
        ),
        false,
      );

      const staffFine = (
        await rows(
          database,
          `select * from public.apply_fine(
            $1, $2, '2026-09-12 18:05:00+00', null,
            '81000000-0000-4000-8000-000000000103'
          )`,
          [ids.staffMemberA, ids.categoryA],
        )
      )[0];
      assert.equal(staffFine.multiplier, 2);
      assert.equal(staffFine.final_amount_cents, 1000);

      const treasurerFine = (
        await rows(
          database,
          `select * from public.apply_fine(
            $1, $2, '2026-09-12 18:10:00+00', null,
            '81000000-0000-4000-8000-000000000104'
          )`,
          [ids.treasurerMemberA, ids.categoryA],
        )
      )[0];
      assert.equal(treasurerFine.multiplier, 1);

      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.fines where season_id = $1',
            [ids.seasonAOld],
          )
        )[0].count,
        1,
      );
      await assert.rejects(
        database.query(
          `select * from public.apply_fine(
            $1, $2, now(), null,
            '81000000-0000-4000-8000-000000000105'
          )`,
          [ids.playerMemberAOld, ids.categoryAOld],
        ),
        /A epoca nao esta ativa/,
      );
      await assert.rejects(
        database.query(
          `select * from public.record_payment_batch(
            $1, array[$2]::uuid[], 'reopened',
            '91000000-0000-4000-8000-000000000101'
          )`,
          [ids.playerMemberAOld, ids.fineAOld],
        ),
        /A epoca nao esta ativa/,
      );
    });

    await database.query(
      'update public.users set is_active = false where id = $1',
      [ids.playerA],
    );
    await asRole(database, 'authenticated', ids.playerA, async () => {
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.teams',
          )
        )[0].count,
        0,
      );
      assert.equal(
        (
          await rows(
            database,
            'select count(*)::integer as count from public.fines',
          )
        )[0].count,
        0,
      );
      await assert.rejects(
        database.query('select public.get_auth_context()'),
        /Sessao invalida/,
      );
      await assert.rejects(
        database.query('select * from public.get_season_leaderboard($1)', [
          ids.seasonA,
        ]),
        /Sem acesso ao ranking/,
      );
    });
  } finally {
    await database.close();
  }
});

test('concorrencia local impede dupla liquidacao e o ledger permanece imutavel', async () => {
  const database = await createSeededDatabase();

  try {
    await asRole(database, 'authenticated', ids.treasurerA, async () => {
      const fine = (
        await rows(
          database,
          `select * from public.apply_fine(
            $1, $2, '2026-09-13 18:00:00+00', null,
            '81000000-0000-4000-8000-000000000106'
          )`,
          [ids.playerMemberA, ids.categoryA],
        )
      )[0];
      const paymentSql = `select * from public.record_payment_batch(
        $1, array[$2]::uuid[], 'paid', $3
      )`;
      const attempts = await Promise.allSettled([
        database.query(paymentSql, [
          ids.playerMemberA,
          fine.id,
          '91000000-0000-4000-8000-000000000102',
        ]),
        database.query(paymentSql, [
          ids.playerMemberA,
          fine.id,
          '91000000-0000-4000-8000-000000000103',
        ]),
      ]);
      assert.equal(
        attempts.filter((attempt) => attempt.status === 'fulfilled').length,
        1,
      );
      assert.equal(
        attempts.filter((attempt) => attempt.status === 'rejected').length,
        1,
      );
      assert.match(
        attempts.find((attempt) => attempt.status === 'rejected').reason
          .message,
        /nao permitem a transicao/,
      );
      assert.deepEqual(
        (
          await rows(
            database,
            `select
              (select count(*)::integer from public.payment_batches where idempotency_key in ($1, $2)) as batches,
              (select count(*)::integer from public.payment_logs where fine_id = $3) as logs,
              (select status from public.fines where id = $3) as fine_status`,
            [
              '91000000-0000-4000-8000-000000000102',
              '91000000-0000-4000-8000-000000000103',
              fine.id,
            ],
          )
        )[0],
        { batches: 1, logs: 1, fine_status: 'paid' },
      );
    });

    const immutableMutations = [
      `update public.payment_batches set calculated_total_cents = 999 where id = '70000000-0000-4000-8000-000000000001'`,
      `delete from public.payment_batches where id = '70000000-0000-4000-8000-000000000001'`,
      `update public.payment_logs set amount_cents_snapshot = 999 where id = '71000000-0000-4000-8000-000000000001'`,
      `delete from public.payment_logs where id = '71000000-0000-4000-8000-000000000001'`,
      `update public.audit_events set action = 'alterado' where id = '72000000-0000-4000-8000-000000000001'`,
      `delete from public.audit_events where id = '72000000-0000-4000-8000-000000000001'`,
    ];
    for (const mutation of immutableMutations) {
      await assert.rejects(
        database.exec(mutation),
        /registo contabilistico e imutavel/i,
      );
    }
  } finally {
    await database.close();
  }
});

test('reporting do membro preserva detalhe pessoal, rankings e exclusao de multas eliminadas', async () => {
  const database = await createSeededDatabase();
  try {
    await asRole(database, 'authenticated', ids.playerA, async () => {
      assert.deepEqual(
        (
          await rows(
            database,
            `select fine_count, total_fined_cents, total_paid_cents, total_debt_cents
             from public.my_season_balances where season_id = $1`,
            [ids.seasonA],
          )
        )[0],
        {
          fine_count: 1,
          total_fined_cents: 500,
          total_paid_cents: 0,
          total_debt_cents: 500,
        },
      );
      assert.deepEqual(
        await rows(
          database,
          `select category_name_snapshot, base_amount_cents_snapshot,
                  multiplier, final_amount_cents, status, notes
           from public.fines where season_id = $1 order by occurred_at desc`,
          [ids.seasonA],
        ),
        [
          {
            category_name_snapshot: 'Atraso',
            base_amount_cents_snapshot: 500,
            multiplier: 1,
            final_amount_cents: 500,
            status: 'pending',
            notes: null,
          },
        ],
      );
      assert.equal(
        (
          await rows(
            database,
            `select count(*)::integer as count from public.fines
             where season_member_id = $1`,
            [ids.captainMemberA],
          )
        )[0].count,
        0,
      );

      const ranking = await rows(
        database,
        `select season_member_id::text, display_name, member_type,
                shirt_number, staff_function, is_captain,
                fine_count, total_fined_cents, total_debt_cents
         from public.get_season_leaderboard($1)`,
        [ids.seasonA],
      );
      assert.deepEqual(
        ranking.find((entry) => entry.season_member_id === ids.captainMemberA),
        {
          season_member_id: ids.captainMemberA,
          display_name: 'Carlos Capitao',
          member_type: 'player',
          shirt_number: 10,
          staff_function: null,
          is_captain: true,
          fine_count: 1,
          total_fined_cents: 200,
          total_debt_cents: 0,
        },
      );
      assert.deepEqual(
        ranking.find((entry) => entry.season_member_id === ids.staffMemberA),
        {
          season_member_id: ids.staffMemberA,
          display_name: 'Teresa Treinadora',
          member_type: 'staff',
          shirt_number: null,
          staff_function: 'Treinadora',
          is_captain: false,
          fine_count: 1,
          total_fined_cents: 1000,
          total_debt_cents: 1000,
        },
      );
      assert.equal(
        Object.keys(ranking[0]).some((key) =>
          /username|email|auth|admin|owner|treasurer/i.test(key),
        ),
        false,
      );
      await assert.rejects(
        database.query('select * from public.get_season_leaderboard($1)', [
          ids.seasonB,
        ]),
        /Sem acesso ao ranking/,
      );
    });

    await asRole(database, 'authenticated', ids.treasurerA, async () => {
      const before = (
        await rows(
          database,
          `select fine_count, total_fined_cents, total_debt_cents
           from public.get_season_leaderboard($1)
           where season_member_id = $2`,
          [ids.seasonA, ids.playerMemberA],
        )
      )[0];
      const created = (
        await rows(
          database,
          `select * from public.apply_fine(
             $1, $2, '2026-09-21 12:00:00+00', 'Eliminavel',
             '81000000-0000-4000-8000-000000000096'
           )`,
          [ids.playerMemberA, ids.categoryA],
        )
      )[0];
      const during = (
        await rows(
          database,
          `select fine_count, total_fined_cents, total_debt_cents
           from public.get_season_leaderboard($1)
           where season_member_id = $2`,
          [ids.seasonA, ids.playerMemberA],
        )
      )[0];
      assert.deepEqual(during, {
        fine_count: Number(before.fine_count) + 1,
        total_fined_cents: Number(before.total_fined_cents) + 500,
        total_debt_cents: Number(before.total_debt_cents) + 500,
      });
      await rows(database, 'select public.delete_pending_fine($1)', [
        created.id,
      ]);
      const after = (
        await rows(
          database,
          `select fine_count, total_fined_cents, total_debt_cents
           from public.get_season_leaderboard($1)
           where season_member_id = $2`,
          [ids.seasonA, ids.playerMemberA],
        )
      )[0];
      assert.deepEqual(after, before);
    });
  } finally {
    await database.close();
  }
});

test('contratos administrativos validam Owner, idempotencia, plantel e auditoria', async () => {
  const database = await createSeededDatabase();
  const newUserId = '00000000-0000-4000-8000-000000000099';
  try {
    await database.query(
      "insert into auth.users (id, email, raw_user_meta_data) values ($1, 'novo@local.invalid', '{}'::jsonb)",
      [newUserId],
    );

    await asRole(database, 'authenticated', ids.playerA, async () => {
      await assert.rejects(
        database.query('select public.get_admin_overview()'),
        /Apenas o Owner/,
      );
      await assert.rejects(
        database.query(
          "select * from public.save_admin_team(null, 'Equipa negada', true)",
        ),
        /Apenas o Owner/,
      );
    });

    const idempotencyKey = 'aa000000-0000-4000-8000-000000000001';
    await asRole(database, 'service_role', null, async () => {
      const created = (
        await rows(
          database,
          `select id::text, username, must_change_password
        from public.register_admin_user($1, $2, 'Novo.User', 'Novo Utilizador', $3)`,
          [ids.owner, newUserId, idempotencyKey],
        )
      )[0];
      assert.deepEqual(created, {
        id: newUserId,
        username: 'Novo.User',
        must_change_password: true,
      });
      const repeated = (
        await rows(
          database,
          `select id::text from public.register_admin_user($1, $2, 'novo.user', 'Novo Utilizador', $3)`,
          [ids.owner, newUserId, idempotencyKey],
        )
      )[0];
      assert.equal(repeated.id, newUserId);
      await rows(
        database,
        'select public.prepare_admin_password_reset($1, $2, $3)',
        [ids.owner, newUserId, 'aa000000-0000-4000-8000-000000000010'],
      );
      await rows(
        database,
        'select * from public.complete_admin_password_reset($1, $2, $3)',
        [ids.owner, newUserId, 'aa000000-0000-4000-8000-000000000010'],
      );
      await rows(
        database,
        'select * from public.complete_admin_password_reset($1, $2, $3)',
        [ids.owner, newUserId, 'aa000000-0000-4000-8000-000000000010'],
      );
    });

    assert.equal(
      (
        await rows(
          database,
          `select count(*)::integer as count from public.audit_events
           where action = 'user.password_reset' and entity_id = $1`,
          [newUserId],
        )
      )[0].count,
      1,
    );

    await asRole(database, 'authenticated', ids.owner, async () => {
      const team = (
        await rows(
          database,
          "select * from public.save_admin_team(null, 'Equipa Nova', true)",
        )
      )[0];
      const season = (
        await rows(
          database,
          `select * from public.create_season($1, '2027/28', null, null, 'draft', null, 'aa000000-0000-4000-8000-000000000002')`,
          [team.id],
        )
      )[0];
      const member = (
        await rows(
          database,
          `select * from public.save_admin_member(null, $1, $2, 'player', 77, null, 'active', array['captain','treasurer'])`,
          [season.id, newUserId],
        )
      )[0];
      assert.equal(member.shirt_number, 77);
      assert.deepEqual(
        (
          await rows(
            database,
            `select r.code from public.member_roles mr join public.roles r on r.id = mr.role_id where mr.season_member_id = $1 order by r.code`,
            [member.id],
          )
        ).map((row) => row.code),
        ['captain', 'treasurer'],
      );
      await assert.rejects(
        database.query(
          `select * from public.save_admin_member($1, $2, $3, 'staff', 77, 'Treinador', 'active', '{}'::text[])`,
          [member.id, season.id, newUserId],
        ),
        /season_members_identity_by_type/,
      );
      const overview = (
        await rows(database, 'select public.get_admin_overview() as data')
      )[0].data;
      assert.equal(
        overview.users.some((user) => Object.hasOwn(user, 'email')),
        false,
      );
      assert.equal(
        overview.users.some((user) => Object.hasOwn(user, 'isAppAdmin')),
        false,
      );
      assert.equal(
        overview.auditEvents.some((event) =>
          JSON.stringify(event.metadata).toLowerCase().includes('password'),
        ),
        false,
      );
    });
  } finally {
    await database.close();
  }
});
