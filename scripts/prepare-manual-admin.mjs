import { createClient } from '@supabase/supabase-js';
import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cleanupAdminTestOwner,
  prepareAdminTestOwner,
} from './supabase-auth-test-fixture.mjs';

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));
const projectDirectory = path.resolve(currentDirectory, '..');
const outputDirectory = path.join(projectDirectory, '.manual-validation');
const credentialsPath = path.join(outputDirectory, 'owner.local.json');
const avatarPath = path.join(outputDirectory, 'avatar-teste.png');

try {
  await access(credentialsPath);
  throw new Error(
    'Já existem credenciais de validação manual. Limpe a conta anterior antes de gerar outra.',
  );
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

let owner;
try {
  owner = await prepareAdminTestOwner({
    usernamePrefix: 'manual.owner',
    displayName: 'Owner de validação manual',
  });
  const client = createClient(
    owner.configuration.url,
    owner.configuration.publishableKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const login = await client.auth.signInWithPassword({
    email: owner.technicalEmail,
    password: owner.password,
  });
  if (login.error) throw new Error('O Owner manual não iniciou sessão.');

  const overview = await client.rpc('get_admin_overview');
  if (overview.error) {
    throw new Error('O Owner manual não conseguiu abrir a Administração.');
  }
  const minimumDataAvailable =
    overview.data.users.length >= 8 &&
    overview.data.teams.length >= 2 &&
    overview.data.seasons.length >= 3 &&
    overview.data.members.length >= 8 &&
    overview.data.auditEvents.length >= 2;
  if (!minimumDataAvailable) {
    throw new Error('O projeto remoto não contém os dados mínimos esperados.');
  }

  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    credentialsPath,
    `${JSON.stringify(
      {
        username: owner.username,
        password: owner.password,
        expiresAfter: 'validação manual da Fase 07',
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  await writeFile(
    avatarPath,
    Buffer.from(
      'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNk+A8AAQUBAScY42YAAAAASUVORK5CYII=',
      'base64',
    ),
    { mode: 0o600 },
  );
  process.stdout.write(
    'Owner manual criado; credenciais e imagem guardadas apenas na pasta local ignorada.\n',
  );
} catch (error) {
  await cleanupAdminTestOwner(owner);
  throw error;
}
