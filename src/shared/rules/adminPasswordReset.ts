export type AdminPasswordResetInput = {
  actorUserId: string;
  userId: string;
  idempotencyKey: string;
};

export type AdminPasswordResetDependencies<Result> = {
  secret: string;
  prepare(): Promise<void>;
  updateAuth(password: string): Promise<void>;
  complete(): Promise<Result>;
};

export function isValidAdminPasswordResetSecret(
  value: string | undefined,
): value is string {
  return (
    typeof value === 'string' && new TextEncoder().encode(value).length >= 32
  );
}

function bytesToBase64Url(bytes: Uint8Array) {
  let binary = '';
  for (const byte of bytes) binary += String.fromCharCode(byte);
  return btoa(binary)
    .replaceAll('+', '-')
    .replaceAll('/', '_')
    .replace(/=+$/, '');
}

export async function deriveAdminResetPassword(
  secret: string,
  input: AdminPasswordResetInput,
) {
  if (!isValidAdminPasswordResetSecret(secret))
    throw new Error('Segredo de reposição indisponível.');
  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    'raw',
    encoder.encode(secret),
    { name: 'HMAC', hash: 'SHA-256' },
    false,
    ['sign'],
  );
  const context = [
    'admin-password-reset-v1',
    input.actorUserId,
    input.userId,
    input.idempotencyKey,
  ].join(':');
  const signature = new Uint8Array(
    await crypto.subtle.sign('HMAC', key, encoder.encode(context)),
  );
  return `Aa1${bytesToBase64Url(signature).slice(0, 18)}`;
}

export async function executeAdminPasswordReset<Result>(
  input: AdminPasswordResetInput,
  dependencies: AdminPasswordResetDependencies<Result>,
) {
  await dependencies.prepare();
  const temporaryPassword = await deriveAdminResetPassword(
    dependencies.secret,
    input,
  );
  await dependencies.updateAuth(temporaryPassword);
  const result = await dependencies.complete();
  return { result, temporaryPassword };
}
