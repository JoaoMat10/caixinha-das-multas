import { createClient } from '@supabase/supabase-js';

import { getLinkedConfiguration } from './supabase-auth-test-fixture.mjs';

const temporaryPrefixes = [
  'admin.test.',
  'auth.test.',
  'e2e.',
  'financial.test.',
  'managed.',
];

function decodeBase32(value) {
  const alphabet = 'abcdefghijklmnopqrstuvwxyz234567';
  let accumulator = 0;
  let availableBits = 0;
  const bytes = [];

  for (const character of value) {
    const index = alphabet.indexOf(character);
    if (index < 0) return null;
    accumulator = (accumulator << 5) | index;
    availableBits += 5;
    if (availableBits >= 8) {
      availableBits -= 8;
      bytes.push((accumulator >> availableBits) & 255);
    }
  }

  try {
    return new TextDecoder('utf-8', { fatal: true }).decode(
      Uint8Array.from(bytes),
    );
  } catch {
    return null;
  }
}

function usernameFromTechnicalEmail(email) {
  const match = /^u-([a-z2-7]+)@auth\.caixinha\.invalid$/i.exec(email ?? '');
  return match ? decodeBase32(match[1].toLowerCase()) : null;
}

function isTemporaryUsername(username) {
  return temporaryPrefixes.some((prefix) => username?.startsWith(prefix));
}

const configuration = await getLinkedConfiguration();
const administrator = createClient(
  configuration.url,
  configuration.serviceRoleKey,
  { auth: { persistSession: false, autoRefreshToken: false } },
);

const publicProfiles = await administrator
  .from('users')
  .select('username_normalized');
if (publicProfiles.error) {
  throw new Error('Não foi possível auditar os perfis temporários.');
}
const temporaryProfiles = (publicProfiles.data ?? []).filter((profile) =>
  isTemporaryUsername(profile.username_normalized),
);

let page = 1;
let temporaryAuthIdentities = 0;
while (true) {
  const result = await administrator.auth.admin.listUsers({
    page,
    perPage: 1000,
  });
  if (result.error) {
    throw new Error('Não foi possível auditar as identidades Auth.');
  }
  temporaryAuthIdentities += result.data.users.filter((user) =>
    isTemporaryUsername(usernameFromTechnicalEmail(user.email)),
  ).length;
  if (result.data.users.length < 1000) break;
  page += 1;
}

if (temporaryProfiles.length > 0 || temporaryAuthIdentities > 0) {
  throw new Error(
    'A auditoria final encontrou perfis ou identidades Auth temporárias.',
  );
}

console.log(
  'Limpeza remota: 0 perfis temporários e 0 identidades Auth temporárias.',
);
