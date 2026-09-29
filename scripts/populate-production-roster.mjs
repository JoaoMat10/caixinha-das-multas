import { createClient } from '@supabase/supabase-js';
import { spawnSync } from 'node:child_process';
import { createHash, randomBytes } from 'node:crypto';
import {
  access,
  chmod,
  mkdtemp,
  mkdir,
  readFile,
  rm,
  stat,
  writeFile,
} from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const scriptDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(scriptDirectory, '..');
const cliEntryPoint = path.join(
  projectDirectory,
  'node_modules',
  'supabase',
  'dist',
  'supabase.js',
);
const expectedProjectRef = 'showcaseprodref00001';
const expectedLinkedTestProjectRef = 'showcasetestref00001';
const defaultManifestPath = path.join(
  projectDirectory,
  '.manual-validation',
  'clube-desportivo-exemplo-production-roster.local.json',
);
const credentialsPath = path.join(
  projectDirectory,
  '.manual-validation',
  'clube-desportivo-exemplo-production-credentials.local.json',
);
const passwordPrefix = 'Aa1';

function parseArguments(argv) {
  const result = { apply: false, manifestPath: defaultManifestPath };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === '--apply') result.apply = true;
    else if (argument === '--manifest') {
      const value = argv[index + 1];
      if (!value) throw new Error('O argumento --manifest exige um caminho.');
      result.manifestPath = path.resolve(projectDirectory, value);
      index += 1;
    } else {
      throw new Error(`Argumento desconhecido: ${argument}`);
    }
  }
  return result;
}

function redact(value) {
  return String(value)
    .replace(/sb_secret_[A-Za-z0-9_-]+/g, '[secret]')
    .replace(/eyJ[A-Za-z0-9_-]+[.][A-Za-z0-9_-]+[.][A-Za-z0-9_-]+/g, '[jwt]')
    .replace(new RegExp(`${passwordPrefix}[A-Za-z0-9_-]+`, 'g'), '[password]');
}

function runCli(argumentsList) {
  const result = spawnSync(
    process.execPath,
    [cliEntryPoint, ...argumentsList],
    {
      cwd: projectDirectory,
      encoding: 'utf8',
      maxBuffer: 20 * 1024 * 1024,
      stdio: ['ignore', 'pipe', 'pipe'],
    },
  );
  if (result.status !== 0) {
    throw new Error(
      `Supabase CLI falhou: ${redact(`${result.stderr}\n${result.stdout}`)}`,
    );
  }
  return result.stdout;
}

function parseCliJson(output) {
  const arrayStart = output.indexOf('[');
  const objectStart = output.indexOf('{');
  const starts = [arrayStart, objectStart].filter((index) => index >= 0);
  if (starts.length === 0) throw new Error('A CLI não devolveu JSON.');
  const start = Math.min(...starts);
  const isArray = output[start] === '[';
  const end = output.lastIndexOf(isArray ? ']' : '}');
  if (end < start) throw new Error('A resposta JSON da CLI está incompleta.');
  return JSON.parse(output.slice(start, end + 1));
}

async function runSql(projectRef, sql) {
  const temporaryDirectory = await mkdtemp(
    path.join(tmpdir(), 'caixinha-production-import-'),
  );
  const sqlPath = path.join(temporaryDirectory, 'query.sql');
  try {
    await writeFile(sqlPath, sql, 'utf8');
    const output = runCli([
      'db',
      'query',
      '--linked',
      '--project-ref',
      projectRef,
      '--output',
      'json',
      '--file',
      sqlPath,
    ]);
    return parseCliJson(output);
  } finally {
    await rm(temporaryDirectory, { force: true, recursive: true });
  }
}

function sqlLiteral(value) {
  return `'${String(value).replaceAll("'", "''")}'`;
}

function sqlNullable(value) {
  return value === null ? 'null' : sqlLiteral(value);
}

function normalizeUsername(value) {
  return value.trim().toLowerCase();
}

function encodeBase32(value) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  const bytes = new TextEncoder().encode(value);
  let accumulator = 0;
  let availableBits = 0;
  let encoded = '';
  for (const byte of bytes) {
    accumulator = (accumulator << 8) | byte;
    availableBits += 8;
    while (availableBits >= 5) {
      availableBits -= 5;
      encoded += alphabet[(accumulator >> availableBits) & 31];
    }
  }
  if (availableBits > 0)
    encoded += alphabet[(accumulator << (5 - availableBits)) & 31];
  return encoded;
}

function technicalEmail(username) {
  return `u-${encodeBase32(normalizeUsername(username))}@auth.caixinha.invalid`;
}

function deterministicUuid(value) {
  const bytes = Buffer.from(
    createHash('sha256').update(value).digest().subarray(0, 16),
  );
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = bytes.toString('hex');
  return `${hex.slice(0, 8)}-${hex.slice(8, 12)}-${hex.slice(12, 16)}-${hex.slice(16, 20)}-${hex.slice(20)}`;
}

function createSecretKeyFetch(secretKey) {
  return (input, init = {}) => {
    const headers = new Headers(init.headers);
    if (headers.get('Authorization') === `Bearer ${secretKey}`)
      headers.delete('Authorization');
    return fetch(input, { ...init, headers });
  };
}

async function fileExists(filePath) {
  try {
    await access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function loadManifest(manifestPath) {
  const manifest = JSON.parse(await readFile(manifestPath, 'utf8'));
  if (manifest.projectRef !== expectedProjectRef)
    throw new Error('O project ref do manifesto não corresponde a produção.');
  if (!manifest.team?.name?.trim() || !manifest.season?.name?.trim())
    throw new Error('Equipa e época são obrigatórias no manifesto.');
  if (!Array.isArray(manifest.members) || manifest.members.length === 0)
    throw new Error('O manifesto não contém membros.');

  const usernames = new Set();
  const shirtNumbers = new Set();
  let existingOwnerCount = 0;
  for (const member of manifest.members) {
    const username = normalizeUsername(member.username ?? '');
    if (!/^[a-z0-9._-]{3,32}$/.test(username))
      throw new Error(`Username inválido no manifesto: ${member.username}`);
    if (usernames.has(username))
      throw new Error(`Username duplicado no manifesto: ${username}`);
    usernames.add(username);
    member.username = username;
    if (!member.displayName?.trim())
      throw new Error(`Nome apresentado em falta para ${username}.`);
    if (!['player', 'staff'].includes(member.memberType))
      throw new Error(`Tipo de membro inválido para ${username}.`);
    if (member.memberType === 'player') {
      if (!Number.isInteger(member.shirtNumber) || member.shirtNumber < 0)
        throw new Error(`Número de camisola inválido para ${username}.`);
      if (shirtNumbers.has(member.shirtNumber))
        throw new Error(`Número de camisola duplicado: ${member.shirtNumber}.`);
      shirtNumbers.add(member.shirtNumber);
      if (member.staffFunction !== null)
        throw new Error(`Jogador ${username} não pode ter função técnica.`);
    } else if (!member.staffFunction?.trim() || member.shirtNumber !== null) {
      throw new Error(`Função técnica inválida para ${username}.`);
    }
    const roles = member.roles ?? [];
    if (
      new Set(roles).size !== roles.length ||
      roles.some((role) => !['captain', 'treasurer'].includes(role))
    )
      throw new Error(`Funções adicionais inválidas para ${username}.`);
    if (member.existingOwner) existingOwnerCount += 1;

    if (member.photo) {
      const photoRoot = path.resolve(projectDirectory, 'Fotos');
      const photoPath = path.resolve(projectDirectory, member.photo);
      if (
        photoPath !== photoRoot &&
        !photoPath.startsWith(`${photoRoot}${path.sep}`)
      )
        throw new Error(`Fotografia fora da pasta autorizada: ${member.photo}`);
      const extension = path.extname(photoPath).toLowerCase();
      if (!['.jpg', '.jpeg', '.png', '.webp'].includes(extension))
        throw new Error(`Formato de fotografia inválido: ${member.photo}`);
      const information = await stat(photoPath);
      if (!information.isFile() || information.size > 5 * 1024 * 1024)
        throw new Error(
          `Fotografia inválida ou demasiado grande: ${member.photo}`,
        );
      member.photoPath = photoPath;
    } else {
      member.photoPath = null;
    }
  }
  if (existingOwnerCount !== 1)
    throw new Error('O manifesto deve conter exatamente um Owner existente.');
  return manifest;
}

async function readCredentials(manifest) {
  if (!(await fileExists(credentialsPath))) {
    return {
      projectRef: manifest.projectRef,
      team: manifest.team.name,
      season: manifest.season.name,
      generatedAt: new Date().toISOString(),
      accounts: [],
    };
  }
  const saved = JSON.parse(await readFile(credentialsPath, 'utf8'));
  if (
    saved.projectRef !== manifest.projectRef ||
    saved.team !== manifest.team.name ||
    saved.season !== manifest.season.name ||
    !Array.isArray(saved.accounts)
  )
    throw new Error('O ficheiro local de credenciais pertence a outro import.');
  return saved;
}

async function saveCredentials(credentials) {
  await mkdir(path.dirname(credentialsPath), { recursive: true });
  await writeFile(
    credentialsPath,
    `${JSON.stringify(credentials, null, 2)}\n`,
    {
      encoding: 'utf8',
      mode: 0o600,
    },
  );
  await chmod(credentialsPath, 0o600).catch(() => undefined);
}

function inventorySql() {
  return `
    select json_build_object(
      'authUsers', (select count(*) from auth.users),
      'authIdentities', (select count(*) from auth.identities),
      'publicUsers', (select count(*) from public.users),
      'owners', (select count(*) from public.app_admins),
      'teams', (select count(*) from public.teams),
      'seasons', (select count(*) from public.seasons),
      'members', (select count(*) from public.season_members),
      'memberRoles', (select count(*) from public.member_roles),
      'categories', (select count(*) from public.fine_categories),
      'fines', (select count(*) from public.fines),
      'batches', (select count(*) from public.payment_batches),
      'paymentLogs', (select count(*) from public.payment_logs),
      'storageObjects', (select count(*) from storage.objects),
      'owner', (
        select json_build_object(
          'id', u.id,
          'username', u.username_normalized,
          'displayName', u.display_name,
          'isActive', u.is_active,
          'mustChangePassword', u.must_change_password
        )
        from public.app_admins a
        join public.users u on u.id = a.user_id
      ),
      'usernames', coalesce((
        select json_agg(u.username_normalized order by u.username_normalized)
        from public.users u
      ), '[]'::json)
    ) as state;
  `;
}

async function getInventory(projectRef) {
  const result = await runSql(projectRef, inventorySql());
  return result.rows?.[0]?.state;
}

function assertSafeInventory(inventory, manifest) {
  if (!inventory || inventory.owners !== 1)
    throw new Error('Produção não contém exatamente um Owner.');
  if (
    inventory.owner?.username !== manifest.ownerUsername ||
    inventory.owner?.isActive !== true
  )
    throw new Error('O Owner de produção não corresponde ao manifesto.');
  const allowed = new Set(manifest.members.map((member) => member.username));
  const unexpected = (inventory.usernames ?? []).filter(
    (username) => !allowed.has(username),
  );
  if (unexpected.length > 0)
    throw new Error(
      `Produção contém usernames inesperados: ${unexpected.join(', ')}`,
    );
  if (
    inventory.categories !== 0 ||
    inventory.fines !== 0 ||
    inventory.batches !== 0 ||
    inventory.paymentLogs !== 0
  )
    throw new Error(
      'Produção já contém dados financeiros; importação recusada.',
    );
  if (inventory.teams > 1 || inventory.seasons > 1)
    throw new Error(
      'Produção contém equipas ou épocas fora do plano esperado.',
    );
}

async function verifyTarget(manifest) {
  const registry = await readFile(
    path.join(
      projectDirectory,
      'docs',
      'operacao',
      'supabase-production-preflight.md',
    ),
    'utf8',
  );
  if (!registry.includes(expectedProjectRef))
    throw new Error('O registo versionado não confirma o alvo de produção.');

  const linkedRef = (
    await readFile(
      path.join(projectDirectory, 'supabase', '.temp', 'project-ref'),
      'utf8',
    )
  ).trim();
  if (linkedRef !== expectedLinkedTestProjectRef)
    throw new Error(
      'O vínculo local deixou de apontar para o projeto descartável.',
    );

  const projects = parseCliJson(
    runCli(['projects', 'list', '--output', 'json']),
  );
  const target = projects.find((project) => project.id === expectedProjectRef);
  if (
    !target ||
    target.name !== 'caixinha-showcase-producao' ||
    target.status !== 'ACTIVE_HEALTHY'
  )
    throw new Error(
      'A listagem remota não confirmou o projeto de produção saudável.',
    );

  const inventory = await getInventory(expectedProjectRef);
  assertSafeInventory(inventory, manifest);
  return inventory;
}

function getSecretConfiguration(projectRef) {
  const keys = parseCliJson(
    runCli([
      'projects',
      'api-keys',
      '--project-ref',
      projectRef,
      '--reveal',
      '--output',
      'json',
    ]),
  );
  const secretKey = keys.find((key) => key.type === 'secret')?.api_key;
  if (typeof secretKey !== 'string' || !secretKey.startsWith('sb_secret_'))
    throw new Error('A chave secreta moderna de produção não está disponível.');
  return { url: `https://${projectRef}.supabase.co`, secretKey };
}

async function listAllAuthUsers(client) {
  const users = [];
  const perPage = 1000;
  for (let page = 1; ; page += 1) {
    const result = await client.auth.admin.listUsers({ page, perPage });
    if (result.error) throw result.error;
    users.push(...result.data.users);
    if (result.data.users.length < perPage) break;
  }
  return users;
}

async function provisionUsers(client, manifest, credentials) {
  const { data: profiles, error: profilesError } = await client
    .from('users')
    .select(
      'id,username,username_normalized,display_name,must_change_password,is_active',
    );
  if (profilesError) throw profilesError;
  const profileByUsername = new Map(
    profiles.map((profile) => [profile.username_normalized, profile]),
  );
  const owner = profileByUsername.get(manifest.ownerUsername);
  if (!owner) throw new Error('O perfil Owner não foi encontrado.');

  const ownerMember = manifest.members.find((member) => member.existingOwner);
  if (owner.display_name !== ownerMember.displayName) {
    const update = await client.rpc('update_admin_user', {
      p_actor_user_id: owner.id,
      p_user_id: owner.id,
      p_username: owner.username,
      p_display_name: ownerMember.displayName,
    });
    if (update.error) throw update.error;
    owner.display_name = ownerMember.displayName;
  }

  const authUsers = await listAllAuthUsers(client);
  const authByEmail = new Map(
    authUsers.map((user) => [user.email?.toLowerCase(), user]),
  );
  const credentialsByUsername = new Map(
    credentials.accounts.map((account) => [account.username, account]),
  );
  const userIds = new Map([[manifest.ownerUsername, owner.id]]);

  for (const member of manifest.members.filter((item) => !item.existingOwner)) {
    const currentProfile = profileByUsername.get(member.username);
    if (currentProfile) {
      const savedCredential = credentialsByUsername.get(member.username);
      if (!savedCredential)
        throw new Error(
          `A conta ${member.username} já existe, mas a password temporária local não está disponível.`,
        );
      if (currentProfile.display_name !== member.displayName)
        throw new Error(
          `O nome da conta existente ${member.username} diverge do manifesto.`,
        );
      userIds.set(member.username, currentProfile.id);
      continue;
    }

    const email = technicalEmail(member.username);
    const savedCredential = credentialsByUsername.get(member.username);
    const temporaryPassword =
      savedCredential?.temporaryPassword ??
      `${passwordPrefix}${randomBytes(12).toString('base64url')}`;
    let authUser = authByEmail.get(email);
    let createdAuth = false;
    if (!authUser) {
      const created = await client.auth.admin.createUser({
        email,
        password: temporaryPassword,
        email_confirm: true,
      });
      if (created.error || !created.data.user)
        throw (
          created.error ??
          new Error(`Não foi possível criar ${member.username}.`)
        );
      authUser = created.data.user;
      createdAuth = true;
      authByEmail.set(email, authUser);
    } else if (!savedCredential) {
      const reset = await client.auth.admin.updateUserById(authUser.id, {
        password: temporaryPassword,
      });
      if (reset.error) throw reset.error;
    }

    const idempotencyKey = deterministicUuid(
      `${manifest.projectRef}|${manifest.team.name}|${manifest.season.name}|user|${member.username}`,
    );
    const registered = await client.rpc('register_admin_user', {
      p_actor_user_id: owner.id,
      p_user_id: authUser.id,
      p_username: member.username,
      p_display_name: member.displayName,
      p_idempotency_key: idempotencyKey,
    });
    if (registered.error) {
      if (createdAuth) await client.auth.admin.deleteUser(authUser.id);
      throw registered.error;
    }
    userIds.set(member.username, authUser.id);
    if (!savedCredential) {
      const account = {
        displayName: member.displayName,
        username: member.username,
        temporaryPassword,
      };
      credentials.accounts.push(account);
      credentials.accounts.sort((left, right) =>
        left.displayName.localeCompare(right.displayName, 'pt'),
      );
      credentialsByUsername.set(member.username, account);
      await saveCredentials(credentials);
    }
  }
  return { ownerId: owner.id, userIds };
}

function domainSql(manifest, ownerId, userIds) {
  const members = manifest.members.map((member) => ({
    userId: userIds.get(member.username),
    username: member.username,
    memberType: member.memberType,
    shirtNumber: member.shirtNumber,
    staffFunction: member.staffFunction,
    roles: [...member.roles].sort(),
  }));
  const seasonKey = deterministicUuid(
    `${manifest.projectRef}|${manifest.team.name}|${manifest.season.name}|season`,
  );
  return `
    begin;
    select set_config('request.jwt.claim.sub', ${sqlLiteral(ownerId)}, true);

    do $import$
    declare
      v_team_id uuid;
      v_season_id uuid;
      v_member_id uuid;
      v_existing public.season_members;
      v_current_roles text[];
      v_item record;
    begin
      select id into v_team_id
      from public.teams
      where lower(name) = lower(${sqlLiteral(manifest.team.name)});

      if v_team_id is null then
        select saved.id into v_team_id
        from public.save_admin_team(null, ${sqlLiteral(manifest.team.name)}, true) saved;
      elsif not (select is_active from public.teams where id = v_team_id) then
        perform public.save_admin_team(v_team_id, ${sqlLiteral(manifest.team.name)}, true);
      end if;

      select id into v_season_id
      from public.seasons
      where team_id = v_team_id and name = ${sqlLiteral(manifest.season.name)};

      if v_season_id is null then
        select saved.id into v_season_id
        from public.create_season(
          v_team_id,
          ${sqlLiteral(manifest.season.name)},
          ${sqlNullable(manifest.season.startsOn)}::date,
          ${sqlNullable(manifest.season.endsOn)}::date,
          ${sqlLiteral(manifest.season.status)}::public.season_status,
          null,
          ${sqlLiteral(seasonKey)}::uuid
        ) saved;
      end if;

      for v_item in
        select *
        from jsonb_to_recordset(${sqlLiteral(JSON.stringify(members))}::jsonb) as item(
          "userId" uuid,
          username text,
          "memberType" text,
          "shirtNumber" integer,
          "staffFunction" text,
          roles jsonb
        )
      loop
        select * into v_existing
        from public.season_members
        where season_id = v_season_id and user_id = v_item."userId";

        select coalesce(array_agg(r.code order by r.code), '{}'::text[])
        into v_current_roles
        from public.member_roles mr
        join public.roles r on r.id = mr.role_id
        where mr.season_member_id = v_existing.id;

        if v_existing.id is null
          or v_existing.member_type::text <> v_item."memberType"
          or v_existing.shirt_number is distinct from v_item."shirtNumber"
          or v_existing.staff_function is distinct from v_item."staffFunction"
          or v_existing.status <> 'active'
          or v_current_roles is distinct from array(
            select jsonb_array_elements_text(v_item.roles) order by 1
          ) then
          v_member_id := v_existing.id;
          perform public.save_admin_member(
            v_member_id,
            v_season_id,
            v_item."userId",
            v_item."memberType"::public.member_type,
            v_item."shirtNumber",
            v_item."staffFunction",
            'active'::public.member_status,
            array(select jsonb_array_elements_text(v_item.roles))
          );
        end if;
      end loop;

      if (select count(*) from public.season_members where season_id = v_season_id) <> ${members.length} then
        raise exception 'Contagem de membros inesperada após importação.';
      end if;
    end
    $import$;

    commit;

    select json_build_object(
      'teamId', (select id from public.teams where lower(name) = lower(${sqlLiteral(manifest.team.name)})),
      'seasonId', (
        select s.id from public.seasons s join public.teams t on t.id = s.team_id
        where lower(t.name) = lower(${sqlLiteral(manifest.team.name)})
          and s.name = ${sqlLiteral(manifest.season.name)}
      )
    ) as result;
  `;
}

function photoContentType(extension) {
  if (extension === '.png') return 'image/png';
  if (extension === '.webp') return 'image/webp';
  return 'image/jpeg';
}

async function uploadPhotos(client, manifest, userIds) {
  const uploads = [];
  for (const member of manifest.members.filter((item) => item.photoPath)) {
    const bytes = await readFile(member.photoPath);
    const digest = createHash('sha256').update(bytes).digest('hex');
    const extension =
      path.extname(member.photoPath).toLowerCase() === '.jpeg'
        ? '.jpg'
        : path.extname(member.photoPath).toLowerCase();
    const userId = userIds.get(member.username);
    const photoId = deterministicUuid(
      `${manifest.projectRef}|photo|${member.username}|${digest}`,
    );
    const storagePath = `users/${userId}/${photoId}${extension}`;
    uploads.push({
      username: member.username,
      userId,
      bytes,
      storagePath,
      contentType: photoContentType(extension),
    });
  }

  const { data: profiles, error: profileError } = await client
    .from('users')
    .select('id,avatar_path');
  if (profileError) throw profileError;
  const currentPaths = new Map(
    profiles.map((profile) => [profile.id, profile.avatar_path]),
  );
  const newlyUploaded = [];
  try {
    for (const upload of uploads) {
      if (currentPaths.get(upload.userId) === upload.storagePath) continue;
      const result = await client.storage
        .from('private-photos')
        .upload(upload.storagePath, upload.bytes, {
          cacheControl: '3600',
          contentType: upload.contentType,
          upsert: false,
        });
      if (
        result.error &&
        !/already exists|duplicate/i.test(result.error.message)
      )
        throw result.error;
      if (!result.error) newlyUploaded.push(upload.storagePath);
    }
  } catch (error) {
    if (newlyUploaded.length > 0)
      await client.storage.from('private-photos').remove(newlyUploaded);
    throw error;
  }
  return { uploads, newlyUploaded, currentPaths };
}

function photoLinkSql(ownerId, uploads, currentPaths) {
  const changes = uploads.filter(
    (upload) => currentPaths.get(upload.userId) !== upload.storagePath,
  );
  return `
    begin;
    select set_config('request.jwt.claim.sub', ${sqlLiteral(ownerId)}, true);
    ${changes
      .map(
        (upload) =>
          `select public.set_admin_photo('user', ${sqlLiteral(upload.userId)}::uuid, ${sqlLiteral(upload.storagePath)});`,
      )
      .join('\n')}
    commit;
    select json_build_object('linked', ${changes.length}) as result;
  `;
}

async function verifyFinalState(projectRef, manifest) {
  const result = await runSql(
    projectRef,
    `
      select json_build_object(
        'authUsers', (select count(*) from auth.users),
        'authIdentities', (select count(*) from auth.identities),
        'publicUsers', (select count(*) from public.users),
        'activeUsers', (select count(*) from public.users where is_active),
        'pendingPasswordChanges', (select count(*) from public.users where must_change_password),
        'owners', (select count(*) from public.app_admins),
        'teams', (select count(*) from public.teams),
        'seasons', (select count(*) from public.seasons),
        'members', (select count(*) from public.season_members),
        'players', (select count(*) from public.season_members where member_type = 'player'),
        'staff', (select count(*) from public.season_members where member_type = 'staff'),
        'memberRoles', (select count(*) from public.member_roles),
        'captains', (
          select count(*) from public.member_roles mr join public.roles r on r.id = mr.role_id
          where r.code = 'captain'
        ),
        'treasurers', (
          select count(*) from public.member_roles mr join public.roles r on r.id = mr.role_id
          where r.code = 'treasurer'
        ),
        'photoProfiles', (select count(*) from public.users where avatar_path is not null),
        'storageObjects', (select count(*) from storage.objects where bucket_id = 'private-photos'),
        'categories', (select count(*) from public.fine_categories),
        'fines', (select count(*) from public.fines),
        'batches', (select count(*) from public.payment_batches),
        'paymentLogs', (select count(*) from public.payment_logs),
        'teamName', (select name from public.teams),
        'seasonName', (select name from public.seasons),
        'seasonStatus', (select status from public.seasons),
        'ownerMember', (
          select json_build_object(
            'username', u.username_normalized,
            'displayName', u.display_name,
            'shirtNumber', sm.shirt_number,
            'memberType', sm.member_type,
            'mustChangePassword', u.must_change_password
          )
          from public.app_admins a
          join public.users u on u.id = a.user_id
          join public.season_members sm on sm.user_id = u.id
        ),
        'usernames', (
          select json_agg(username_normalized order by username_normalized) from public.users
        )
      ) as state;
    `,
  );
  const state = result.rows?.[0]?.state;
  const expectedUsers = manifest.members.length;
  const expectedPlayers = manifest.members.filter(
    (member) => member.memberType === 'player',
  ).length;
  const expectedStaff = manifest.members.filter(
    (member) => member.memberType === 'staff',
  ).length;
  const expectedPhotos = manifest.members.filter(
    (member) => member.photo,
  ).length;
  const expectedCaptains = manifest.members.filter((member) =>
    member.roles.includes('captain'),
  ).length;
  const expectedTreasurers = manifest.members.filter((member) =>
    member.roles.includes('treasurer'),
  ).length;
  const expectedUsernames = manifest.members
    .map((member) => member.username)
    .sort();
  const actualUsernames = [...(state.usernames ?? [])].sort();
  const valid =
    state.authUsers === expectedUsers &&
    state.authIdentities === expectedUsers &&
    state.publicUsers === expectedUsers &&
    state.activeUsers === expectedUsers &&
    state.pendingPasswordChanges === expectedUsers - 1 &&
    state.owners === 1 &&
    state.teams === 1 &&
    state.seasons === 1 &&
    state.members === expectedUsers &&
    state.players === expectedPlayers &&
    state.staff === expectedStaff &&
    state.memberRoles === expectedCaptains + expectedTreasurers &&
    state.captains === expectedCaptains &&
    state.treasurers === expectedTreasurers &&
    state.photoProfiles === expectedPhotos &&
    state.storageObjects === expectedPhotos &&
    state.categories === 0 &&
    state.fines === 0 &&
    state.batches === 0 &&
    state.paymentLogs === 0 &&
    state.teamName === manifest.team.name &&
    state.seasonName === manifest.season.name &&
    state.seasonStatus === manifest.season.status &&
    JSON.stringify(actualUsernames) === JSON.stringify(expectedUsernames) &&
    state.ownerMember?.username === manifest.ownerUsername &&
    state.ownerMember?.displayName ===
      manifest.members.find((member) => member.existingOwner).displayName &&
    state.ownerMember?.shirtNumber ===
      manifest.members.find((member) => member.existingOwner).shirtNumber &&
    state.ownerMember?.memberType === 'player' &&
    state.ownerMember?.mustChangePassword === false;
  if (!valid)
    throw new Error(`A verificação final divergiu: ${JSON.stringify(state)}`);
  return state;
}

async function main() {
  const options = parseArguments(process.argv.slice(2));
  const manifest = await loadManifest(options.manifestPath);
  const inventory = await verifyTarget(manifest);
  const finalStateVerified =
    inventory.publicUsers === manifest.members.length &&
    inventory.members === manifest.members.length
      ? Boolean(await verifyFinalState(manifest.projectRef, manifest))
      : false;
  const plan = {
    projectRef: manifest.projectRef,
    team: manifest.team.name,
    season: manifest.season.name,
    members: manifest.members.length,
    newAccounts: manifest.members.filter((member) => !member.existingOwner)
      .length,
    existingOwnerMemberships: manifest.members.filter(
      (member) => member.existingOwner,
    ).length,
    captains: manifest.members.filter((member) =>
      member.roles.includes('captain'),
    ).length,
    treasurers: manifest.members.filter((member) =>
      member.roles.includes('treasurer'),
    ).length,
    photos: manifest.members.filter((member) => member.photo).length,
    membersWithoutPhoto: manifest.members
      .filter((member) => !member.photo)
      .map((member) => member.displayName),
    finalStateVerified,
    currentInventory: {
      ...inventory,
      owner: inventory.owner
        ? {
            username: inventory.owner.username,
            displayName: inventory.owner.displayName,
            isActive: inventory.owner.isActive,
            mustChangePassword: inventory.owner.mustChangePassword,
          }
        : null,
    },
  };
  process.stdout.write(
    `${JSON.stringify({ mode: options.apply ? 'apply' : 'dry-run', plan }, null, 2)}\n`,
  );
  if (!options.apply) return;

  const configuration = getSecretConfiguration(manifest.projectRef);
  const client = createClient(configuration.url, configuration.secretKey, {
    global: { fetch: createSecretKeyFetch(configuration.secretKey) },
    auth: { autoRefreshToken: false, persistSession: false },
  });
  const credentials = await readCredentials(manifest);
  const { ownerId, userIds } = await provisionUsers(
    client,
    manifest,
    credentials,
  );
  await runSql(manifest.projectRef, domainSql(manifest, ownerId, userIds));

  const photoState = await uploadPhotos(client, manifest, userIds);
  try {
    await runSql(
      manifest.projectRef,
      photoLinkSql(ownerId, photoState.uploads, photoState.currentPaths),
    );
  } catch (error) {
    if (photoState.newlyUploaded.length > 0)
      await client.storage
        .from('private-photos')
        .remove(photoState.newlyUploaded);
    throw error;
  }

  const finalState = await verifyFinalState(manifest.projectRef, manifest);
  process.stdout.write(
    `${JSON.stringify(
      {
        result: 'completed',
        projectRef: manifest.projectRef,
        counts: {
          users: finalState.publicUsers,
          members: finalState.members,
          captains: finalState.captains,
          treasurers: finalState.treasurers,
          photos: finalState.photoProfiles,
        },
        credentialsFile: path.relative(projectDirectory, credentialsPath),
      },
      null,
      2,
    )}\n`,
  );
}

main().catch((error) => {
  process.stderr.write(
    `${redact(error instanceof Error ? error.message : error)}\n`,
  );
  process.exitCode = 1;
});
