import { readFile, rm } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import {
  cleanupFinancialTestUser,
  getLinkedConfiguration,
} from './supabase-auth-test-fixture.mjs';

const projectDirectory = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '..',
);
const credentialsPath = path.join(
  projectDirectory,
  '.manual-validation',
  'treasurer.local.json',
);
const saved = JSON.parse(await readFile(credentialsPath, 'utf8'));
const configuration = await getLinkedConfiguration();
await cleanupFinancialTestUser({
  id: saved.id,
  username: saved.username,
  configuration,
});
await rm(credentialsPath);
process.stdout.write(
  'Conta e credenciais da validação manual de tesouraria removidas.\n',
);
