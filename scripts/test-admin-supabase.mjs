import { createClient } from '@supabase/supabase-js';
import { randomBytes, randomUUID } from 'node:crypto';

import {
  assertNoStrandedAdminTestOwners,
  cleanupAdminTestOwner,
  cleanupAuthTestUser,
  cleanupStrandedAdminTestOwners,
  prepareAdminTestOwner,
  prepareAuthTestUser,
} from './supabase-auth-test-fixture.mjs';

function assert(condition, message) {
  if (!condition) throw new Error(message);
  assertions += 1;
}

let assertions = 0;
let owner;
let ordinaryUser;
let testError;
const cleanupErrors = [];
try {
  await cleanupStrandedAdminTestOwners();
  owner = await prepareAdminTestOwner();
  ordinaryUser = await prepareAuthTestUser();
  const ownerClient = createClient(
    owner.configuration.url,
    owner.configuration.publishableKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const ownerLogin = await ownerClient.auth.signInWithPassword({
    email: owner.technicalEmail,
    password: owner.password,
  });
  assert(!ownerLogin.error, 'O login do Owner temporário falhou.');

  const anonymousClient = createClient(
    owner.configuration.url,
    owner.configuration.publishableKey,
    { auth: { persistSession: false, autoRefreshToken: false } },
  );
  const anonymousAttempt = await anonymousClient.functions.invoke(
    'admin-users',
    {
      body: {
        action: 'create',
        username: 'anonymous.denied',
        displayName: 'Pedido anónimo',
        idempotencyKey: randomUUID(),
      },
    },
  );
  assert(
    Boolean(anonymousAttempt.error),
    'Um pedido anónimo chegou à operação administrativa.',
  );

  const suffix = randomBytes(4).toString('hex');
  const username = `managed.${suffix}`;
  const creationBody = {
    action: 'create',
    username,
    displayName: 'Conta gerida',
    idempotencyKey: randomUUID(),
  };
  const created = await ownerClient.functions.invoke('admin-users', {
    body: creationBody,
  });
  assert(
    !created.error && created.data?.temporaryPassword,
    'A Edge Function não criou a conta.',
  );
  const targetId = created.data.user.id;
  const firstPassword = created.data.temporaryPassword;

  const replayed = await ownerClient.functions.invoke('admin-users', {
    body: creationBody,
  });
  assert(
    !replayed.error && replayed.data?.replayed === true,
    'A criação idempotente não foi reconhecida.',
  );
  assert(
    !replayed.data?.temporaryPassword,
    'Uma repetição voltou a expor a password temporária.',
  );

  const duplicate = await ownerClient.functions.invoke('admin-users', {
    body: { ...creationBody, idempotencyKey: randomUUID() },
  });
  assert(
    Boolean(duplicate.error),
    'Um username duplicado criou uma segunda identidade.',
  );

  const administrator = createClient(
    owner.configuration.url,
    owner.configuration.serviceRoleKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const [authIdentity, publicProfile] = await Promise.all([
    administrator.auth.admin.getUserById(targetId),
    administrator
      .from('users')
      .select('id,must_change_password')
      .eq('id', targetId)
      .single(),
  ]);
  assert(
    authIdentity.data.user?.id === publicProfile.data?.id,
    'Auth e perfil não usam o mesmo UUID.',
  );
  assert(
    publicProfile.data?.must_change_password === true,
    'A password temporária não ativou a obrigação de mudança.',
  );

  const updatedUsername = `${username}.edited`;
  const updated = await ownerClient.functions.invoke('admin-users', {
    body: {
      action: 'update',
      userId: targetId,
      username: updatedUsername,
      displayName: 'Conta gerida editada',
    },
  });
  assert(!updated.error, 'A edição da conta falhou.');
  const updatedIdentity = await administrator.auth.admin.getUserById(targetId);
  assert(
    !updatedIdentity.error &&
      typeof updatedIdentity.data.user?.email === 'string' &&
      updatedIdentity.data.user.email !== authIdentity.data.user?.email,
    'A alteração de username não atualizou a identidade Auth.',
  );
  const targetEmail = updatedIdentity.data.user.email;

  const targetClient = createClient(
    owner.configuration.url,
    owner.configuration.publishableKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const targetLogin = await targetClient.auth.signInWithPassword({
    email: targetEmail,
    password: firstPassword,
  });
  assert(
    !targetLogin.error,
    'A password temporária inicial não permite login.',
  );

  const photoPath = `users/${targetId}/${randomUUID()}.png`;
  const photoBytes = Uint8Array.from([137, 80, 78, 71, 13, 10, 26, 10]);
  const photoUpload = await ownerClient.storage
    .from('private-photos')
    .upload(photoPath, photoBytes, { contentType: 'image/png' });
  assert(!photoUpload.error, 'O Owner não conseguiu carregar fotografia.');
  const photoMetadata = await ownerClient.rpc('set_admin_photo', {
    p_entity_type: 'user',
    p_entity_id: targetId,
    p_path: photoPath,
  });
  assert(
    !photoMetadata.error,
    'Não foi possível associar a fotografia privada.',
  );
  const ownPhoto = await targetClient.storage
    .from('private-photos')
    .download(photoPath);
  assert(
    !ownPhoto.error,
    'O utilizador autenticado não conseguiu ler a própria fotografia.',
  );

  const ordinaryClient = createClient(
    owner.configuration.url,
    owner.configuration.publishableKey,
    {
      auth: { persistSession: false, autoRefreshToken: false },
    },
  );
  const ordinaryLogin = await ordinaryClient.auth.signInWithPassword({
    email: ordinaryUser.technicalEmail,
    password: ordinaryUser.password,
  });
  assert(!ordinaryLogin.error, 'O login do utilizador normal de teste falhou.');
  const ordinaryAdminAttempt = await ordinaryClient.functions.invoke(
    'admin-users',
    {
      body: {
        action: 'reset-password',
        userId: targetId,
      },
    },
  );
  assert(
    Boolean(ordinaryAdminAttempt.error),
    'Um utilizador normal executou uma operação administrativa.',
  );
  const deniedWrite = await ordinaryClient.storage
    .from('private-photos')
    .upload(`users/${ordinaryUser.id}/${randomUUID()}.png`, photoBytes, {
      contentType: 'image/png',
    });
  assert(
    Boolean(deniedWrite.error),
    'Um não-Owner conseguiu escrever fotografias.',
  );
  const deniedRead = await ordinaryClient.storage
    .from('private-photos')
    .download(photoPath);
  assert(
    Boolean(deniedRead.error),
    'Um utilizador sem relação conseguiu ler a fotografia.',
  );

  const reset = await ownerClient.functions.invoke('admin-users', {
    body: { action: 'reset-password', userId: targetId },
  });
  assert(
    !reset.error && reset.data?.temporaryPassword,
    'A reposição de password falhou.',
  );
  assert(
    reset.data.temporaryPassword !== firstPassword,
    'A reposição repetiu a password temporária.',
  );
  await targetClient.auth.signOut();
  const resetLogin = await targetClient.auth.signInWithPassword({
    email: targetEmail,
    password: reset.data.temporaryPassword,
  });
  assert(!resetLogin.error, 'A password reposta não permite login.');

  const deactivated = await ownerClient.functions.invoke('admin-users', {
    body: { action: 'set-active', userId: targetId, isActive: false },
  });
  assert(!deactivated.error, 'A desativação da conta falhou.');
  const disabledContext = await targetClient.rpc('get_auth_context');
  assert(
    Boolean(disabledContext.error),
    'A sessão existente manteve acesso após desativação.',
  );
  await targetClient.auth.signOut();
  const disabledLogin = await targetClient.auth.signInWithPassword({
    email: targetEmail,
    password: reset.data.temporaryPassword,
  });
  assert(
    Boolean(disabledLogin.error),
    'A conta desativada iniciou nova sessão.',
  );

  const reactivated = await ownerClient.functions.invoke('admin-users', {
    body: { action: 'set-active', userId: targetId, isActive: true },
  });
  assert(!reactivated.error, 'A reativação da conta falhou.');
  const reactivatedLogin = await targetClient.auth.signInWithPassword({
    email: targetEmail,
    password: reset.data.temporaryPassword,
  });
  assert(!reactivatedLogin.error, 'A conta reativada não iniciou sessão.');

  const overview = await ownerClient.rpc('get_admin_overview');
  assert(!overview.error, 'O Owner não conseguiu consultar auditoria.');
  const targetEvents = overview.data.auditEvents.filter(
    (event) => event.entityId === targetId,
  );
  assert(
    targetEvents.some((event) => event.action === 'user.created'),
    'A criação não foi auditada.',
  );
  assert(
    targetEvents.some((event) => event.action === 'user.password_reset'),
    'A reposição não foi auditada.',
  );
  assert(
    !JSON.stringify(targetEvents)
      .toLowerCase()
      .includes(firstPassword.toLowerCase()),
    'A auditoria expôs uma password.',
  );

  await ownerClient.rpc('set_admin_photo', {
    p_entity_type: 'user',
    p_entity_id: targetId,
    p_path: null,
  });
  const removed = await ownerClient.storage
    .from('private-photos')
    .remove([photoPath]);
  assert(!removed.error, 'O Owner não conseguiu remover a fotografia.');
  console.log(
    `Supabase Admin/Auth/Storage real: ${assertions} verificações passaram.`,
  );
} catch (error) {
  testError = error;
} finally {
  for (const cleanup of [
    () => cleanupAuthTestUser(ordinaryUser),
    () => cleanupAdminTestOwner(owner),
    () => assertNoStrandedAdminTestOwners(),
  ]) {
    try {
      await cleanup();
    } catch (error) {
      cleanupErrors.push(error);
    }
  }
}

if (cleanupErrors.length > 0) {
  throw new AggregateError(
    testError ? [testError, ...cleanupErrors] : cleanupErrors,
    'A limpeza dos dados administrativos temporários falhou.',
  );
}
if (testError) {
  throw testError;
}
