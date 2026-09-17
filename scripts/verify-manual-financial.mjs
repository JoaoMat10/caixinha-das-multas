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
const credentialsPath = path.join(
  projectDirectory,
  '.manual-validation',
  'treasurer.local.json',
);
const saved = JSON.parse(await readFile(credentialsPath, 'utf8'));
if (!/^manual\.finance\.[a-f0-9]{10}$/.test(saved.username))
  throw new Error('A conta manual esperada não foi encontrada.');
const configuration = await getLinkedPublicConfiguration();
const client = createClient(configuration.url, configuration.publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});
const login = await client.auth.signInWithPassword({
  email: technicalEmailForUsername(saved.username),
  password: saved.password,
});
if (login.error)
  throw new Error('A conta manual não conseguiu iniciar sessão.');
const context = await client.rpc('get_auth_context');
if (context.error)
  throw new Error('Não foi possível carregar as permissões da conta manual.');
const memberships = context.data?.memberships ?? [];
const season = memberships.find(
  (membership) =>
    membership.seasonStatus === 'active' &&
    membership.roles.includes('treasurer'),
);
if (!season)
  throw new Error('A conta manual não tem uma época ativa de tesouraria.');
const totals = await client
  .from('treasury_season_totals')
  .select('season_id')
  .eq('season_id', season.seasonId)
  .single();
if (totals.error || !totals.data)
  throw new Error(
    'A conta manual não consegue consultar os totais da tesouraria.',
  );
process.stdout.write(
  'Login, função de tesoureiro e leitura dos totais confirmados no projeto descartável.\n',
);
