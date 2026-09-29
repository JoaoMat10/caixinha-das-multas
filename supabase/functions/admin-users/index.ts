import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  isValidUsername,
  usernameToTechnicalEmail,
} from '../../../src/shared/rules/username.ts';
import {
  executeAdminPasswordReset,
  isValidAdminPasswordResetSecret,
} from '../../../src/shared/rules/adminPasswordReset.ts';
import {
  adminCorsBaseHeaders,
  resolveAdminCors,
} from '../../../src/shared/rules/adminCors.ts';
import {
  createSupabaseSecretKeyFetch,
  resolveSupabaseRuntimeKeys,
} from '../../../src/shared/rules/supabaseRuntimeKeys.ts';

type JsonRecord = Record<string, unknown>;

function jsonResponse(
  status: number,
  body: JsonRecord,
  headers: Record<string, string> = adminCorsBaseHeaders,
) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...headers, 'Content-Type': 'application/json' },
  });
}

function requiredString(body: JsonRecord, key: string, maxLength = 200) {
  const value = body[key];
  if (
    typeof value !== 'string' ||
    value.trim() === '' ||
    value.length > maxLength
  ) {
    throw new Error(`Campo ${key} inválido.`);
  }
  return value.trim();
}

function requiredUuid(body: JsonRecord, key: string) {
  const value = requiredString(body, key, 36);
  if (
    !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(
      value,
    )
  ) {
    throw new Error(`Campo ${key} inválido.`);
  }
  return value;
}

function temporaryPassword() {
  return `Aa1${crypto.randomUUID().replaceAll('-', '').slice(0, 13)}`;
}

Deno.serve(async (request) => {
  const cors = resolveAdminCors(
    request.headers.get('Origin'),
    Deno.env.get('ADMIN_ALLOWED_ORIGINS'),
  );
  if (cors.status === 'unavailable')
    return jsonResponse(503, {
      error: 'Serviço administrativo indisponível.',
    });
  if (cors.status === 'forbidden')
    return jsonResponse(403, { error: 'Origem não autorizada.' });

  const corsHeaders = cors.headers;
  const respond = (status: number, body: JsonRecord) =>
    jsonResponse(status, body, corsHeaders);

  if (request.method === 'OPTIONS')
    return new Response(null, { status: 204, headers: corsHeaders });
  if (request.method !== 'POST')
    return respond(405, { error: 'Método não permitido.' });

  try {
    const authorization = request.headers.get('Authorization');
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token) return respond(401, { error: 'Autenticação obrigatória.' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const runtimeKeys = resolveSupabaseRuntimeKeys(
      Deno.env.get('SUPABASE_PUBLISHABLE_KEYS'),
      Deno.env.get('SUPABASE_SECRET_KEYS'),
    );
    const passwordResetSecret = Deno.env.get('ADMIN_PASSWORD_RESET_SECRET');
    if (
      !supabaseUrl ||
      !runtimeKeys ||
      !isValidAdminPasswordResetSecret(passwordResetSecret)
    ) {
      return respond(503, {
        error: 'Serviço administrativo indisponível.',
      });
    }

    const callerClient = createClient(supabaseUrl, runtimeKeys.publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: callerData, error: callerError } =
      await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) {
      return respond(401, { error: 'Sessão inválida.' });
    }

    const adminClient = createClient(supabaseUrl, runtimeKeys.secretKey, {
      global: {
        fetch: createSupabaseSecretKeyFetch(runtimeKeys.secretKey),
      },
      auth: { autoRefreshToken: false, persistSession: false },
    });
    const actorId = callerData.user.id;
    const { data: actor, error: actorError } = await adminClient
      .from('users')
      .select('id,is_active,app_admins!inner(user_id)')
      .eq('id', actorId)
      .eq('is_active', true)
      .maybeSingle();
    if (actorError || !actor)
      return respond(403, { error: 'Operação não autorizada.' });

    const body = (await request.json()) as JsonRecord;
    const action = requiredString(body, 'action', 32);

    if (action === 'create') {
      const username = requiredString(body, 'username', 32);
      const displayName = requiredString(body, 'displayName', 120);
      const idempotencyKey = requiredUuid(body, 'idempotencyKey');
      if (!isValidUsername(username))
        return respond(400, { error: 'Username inválido.' });

      const { data: existing, error: lookupError } = await adminClient.rpc(
        'get_admin_user_creation',
        { p_actor_user_id: actorId, p_idempotency_key: idempotencyKey },
      );
      if (lookupError) throw lookupError;
      if (existing) return respond(200, { user: existing, replayed: true });

      const password = temporaryPassword();
      const { data: created, error: createError } =
        await adminClient.auth.admin.createUser({
          email: usernameToTechnicalEmail(username),
          password,
          email_confirm: true,
        });
      if (createError || !created.user)
        throw createError ?? new Error('Falha ao criar conta Auth.');

      const { data: profile, error: profileError } = await adminClient.rpc(
        'register_admin_user',
        {
          p_actor_user_id: actorId,
          p_user_id: created.user.id,
          p_username: username,
          p_display_name: displayName,
          p_idempotency_key: idempotencyKey,
        },
      );
      if (profileError) {
        await adminClient.auth.admin.deleteUser(created.user.id);
        throw profileError;
      }
      return respond(201, {
        user: profile,
        temporaryPassword: password,
        replayed: false,
      });
    }

    const userId = requiredUuid(body, 'userId');
    const { data: currentProfile, error: profileLookupError } =
      await adminClient
        .from('users')
        .select('id,username,is_active')
        .eq('id', userId)
        .single();
    if (profileLookupError || !currentProfile)
      return respond(404, { error: 'Utilizador não encontrado.' });

    if (action === 'update') {
      const username = requiredString(body, 'username', 32);
      const displayName = requiredString(body, 'displayName', 120);
      if (!isValidUsername(username))
        return respond(400, { error: 'Username inválido.' });

      const previousEmail = usernameToTechnicalEmail(currentProfile.username);
      const nextEmail = usernameToTechnicalEmail(username);
      if (previousEmail !== nextEmail) {
        const { error } = await adminClient.auth.admin.updateUserById(userId, {
          email: nextEmail,
          email_confirm: true,
        });
        if (error) throw error;
      }

      const { data: profile, error: updateError } = await adminClient.rpc(
        'update_admin_user',
        {
          p_actor_user_id: actorId,
          p_user_id: userId,
          p_username: username,
          p_display_name: displayName,
        },
      );
      if (updateError) {
        if (previousEmail !== nextEmail) {
          await adminClient.auth.admin.updateUserById(userId, {
            email: previousEmail,
            email_confirm: true,
          });
        }
        throw updateError;
      }
      return respond(200, { user: profile });
    }

    if (action === 'set-active') {
      if (typeof body.isActive !== 'boolean')
        return respond(400, { error: 'Estado inválido.' });
      const isActive = body.isActive;
      if (userId === actorId && !isActive) {
        return respond(400, {
          error: 'O Owner não pode desativar a própria conta.',
        });
      }
      const { error: authUpdateError } =
        await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: isActive ? 'none' : '876000h',
        });
      if (authUpdateError) throw authUpdateError;

      const { data: profile, error: activeError } = await adminClient.rpc(
        'set_admin_user_active',
        {
          p_actor_user_id: actorId,
          p_user_id: userId,
          p_is_active: isActive,
        },
      );
      if (activeError) {
        await adminClient.auth.admin.updateUserById(userId, {
          ban_duration: currentProfile.is_active ? 'none' : '876000h',
        });
        throw activeError;
      }
      return respond(200, { user: profile });
    }

    if (action === 'reset-password') {
      const idempotencyKey = requiredUuid(body, 'idempotencyKey');
      let replayed = false;
      const reset = await executeAdminPasswordReset(
        { actorUserId: actorId, userId, idempotencyKey },
        {
          secret: passwordResetSecret,
          prepare: async () => {
            const { data, error } = await adminClient.rpc(
              'prepare_admin_password_reset',
              {
                p_actor_user_id: actorId,
                p_user_id: userId,
                p_idempotency_key: idempotencyKey,
              },
            );
            if (error) throw error;
            replayed = data?.completed === true;
          },
          updateAuth: async (password) => {
            const { error } = await adminClient.auth.admin.updateUserById(
              userId,
              { password },
            );
            if (error) throw error;
          },
          complete: async () => {
            const { data, error } = await adminClient.rpc(
              'complete_admin_password_reset',
              {
                p_actor_user_id: actorId,
                p_user_id: userId,
                p_idempotency_key: idempotencyKey,
              },
            );
            if (error) throw error;
            return data;
          },
        },
      );
      return respond(200, {
        user: reset.result,
        temporaryPassword: reset.temporaryPassword,
        replayed,
      });
    }

    return respond(400, { error: 'Operação administrativa inválida.' });
  } catch (error) {
    const message =
      error instanceof Error
        ? error.message
        : 'Operação administrativa falhou.';
    const status = /duplicate|unique|already registered/i.test(message)
      ? 409
      : 400;
    const invalidInput =
      /Campo .* inválido|Username inválido|Dados do utilizador invalidos/i.test(
        message,
      );
    return respond(status, {
      error:
        status === 409
          ? 'Já existe um utilizador com esse username.'
          : invalidInput
            ? 'Os dados enviados são inválidos.'
            : 'Não foi possível concluir a operação administrativa.',
    });
  }
});
