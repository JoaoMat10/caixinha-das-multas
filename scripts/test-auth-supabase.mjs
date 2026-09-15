import { createClient } from '@supabase/supabase-js';

import {
  cleanupAuthTestUser,
  getLinkedPublicConfiguration,
  prepareAuthTestUser,
  setAuthTestUserActive,
} from './supabase-auth-test-fixture.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

const configuration = await getLinkedPublicConfiguration();
const testUser = await prepareAuthTestUser();
const client = createClient(configuration.url, configuration.publishableKey, {
  auth: { persistSession: false, autoRefreshToken: false },
});

try {
  const invalidLogin = await client.auth.signInWithPassword({
    email: testUser.technicalEmail,
    password: `${testUser.password}x`,
  });
  assert(Boolean(invalidLogin.error), 'O login inválido foi aceite.');

  const validLogin = await client.auth.signInWithPassword({
    email: testUser.technicalEmail,
    password: testUser.password,
  });
  assert(
    !validLogin.error && validLogin.data.session,
    'O login válido falhou.',
  );

  const initialContext = await client.rpc('get_auth_context');
  assert(
    !initialContext.error,
    'O carregamento do contexto autorizado falhou.',
  );
  assert(
    initialContext.data?.profile?.username === testUser.username,
    'O contexto devolveu outro perfil.',
  );
  assert(
    initialContext.data?.profile?.mustChangePassword === true,
    'A obrigação de mudar a password não foi devolvida.',
  );

  const rejectedChange = await client.auth.updateUser({
    current_password: `${testUser.password}x`,
    password: `Bb2${testUser.password}`,
  });
  assert(
    Boolean(rejectedChange.error),
    'A password atual incorreta foi aceite.',
  );

  const nextPassword = `Cc3${testUser.password}`;
  const acceptedChange = await client.auth.updateUser({
    current_password: testUser.password,
    password: nextPassword,
  });
  assert(!acceptedChange.error, 'A alteração válida da password falhou.');

  const updatedContext = await client.rpc('get_auth_context');
  assert(
    updatedContext.data?.profile?.mustChangePassword === false,
    'A obrigação de mudar a password não foi encerrada pelo trigger.',
  );

  await setAuthTestUserActive(testUser, false);
  const disabledContext = await client.rpc('get_auth_context');
  assert(
    Boolean(disabledContext.error),
    'O utilizador desativado manteve acesso.',
  );

  const signOut = await client.auth.signOut();
  assert(!signOut.error, 'O logout falhou.');
  const recoveredSession = await client.auth.getSession();
  assert(
    !recoveredSession.data.session,
    'A sessão continuou ativa após logout.',
  );

  console.log('Supabase Auth real: 9/9 cenários passaram.');
} finally {
  await client.auth.signOut();
  await cleanupAuthTestUser(testUser);
}
