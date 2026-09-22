import { access, mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cleanupFinancialTestUser,
  prepareAuthTestUser,
} from './supabase-auth-test-fixture.mjs';

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const outputDirectory = path.join(projectDirectory, '.manual-validation');
const credentialsPath = path.join(outputDirectory, 'treasurer.local.json');

try {
  await access(credentialsPath);
  throw new Error(
    'Já existem credenciais de tesouraria manual. Limpa a conta anterior antes de gerar outra.',
  );
} catch (error) {
  if (error?.code !== 'ENOENT') throw error;
}

let testUser;
try {
  testUser = await prepareAuthTestUser({
    usernamePrefix: 'manual.finance',
    displayName: 'Tesoureiro de validação',
    mustChangePassword: false,
  });
  await mkdir(outputDirectory, { recursive: true });
  await writeFile(
    credentialsPath,
    `${JSON.stringify(
      {
        id: testUser.id,
        username: testUser.username,
        password: testUser.password,
        season: 'época ativa atribuída no projeto de testes',
        expiresAfter: 'validação manual da Fase 07',
      },
      null,
      2,
    )}\n`,
    { encoding: 'utf8', mode: 0o600 },
  );
  process.stdout.write(
    'Tesoureiro manual criado; credenciais guardadas apenas na pasta local ignorada.\n',
  );
} catch (error) {
  await cleanupFinancialTestUser(testUser);
  throw error;
}
