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
  playerMemberB: '40000000-0000-4000-8000-000000000007',
  categoryA: '50000000-0000-4000-8000-000000000001',
  categoryB: '50000000-0000-4000-8000-000000000004',
};

const authBootstrap = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key,
    email text,
    raw_user_meta_data jsonb not null default '{}'::jsonb
  );
  create function auth.uid()
  returns uuid
  language sql
  stable
  as $$
    select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid;
  $$;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
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
             'payment_batches', 'payment_logs', 'audit_events'
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
             has_table_privilege('authenticated', 'public.fines', 'delete') as fine_delete`,
        )
      )[0],
      {
        anon_select: false,
        fine_insert: false,
        fine_update: false,
        fine_delete: false,
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
