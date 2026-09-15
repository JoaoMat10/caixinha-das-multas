import { createClient } from 'npm:@supabase/supabase-js@2';
import {
  isValidUsername,
  usernameToTechnicalEmail,
} from '../../../src/shared/rules/username.ts';

const corsHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  'Access-Control-Allow-Origin': '*',
};

type JsonRecord = Record<string, unknown>;

function jsonResponse(status: number, body: JsonRecord) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
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
  if (request.method === 'OPTIONS')
    return new Response('ok', { headers: corsHeaders });
  if (request.method !== 'POST')
    return jsonResponse(405, { error: 'Método não permitido.' });

  try {
    const authorization = request.headers.get('Authorization');
    const token = authorization?.replace(/^Bearer\s+/i, '');
    if (!token)
      return jsonResponse(401, { error: 'Autenticação obrigatória.' });

    const supabaseUrl = Deno.env.get('SUPABASE_URL');
    const publishableKey = Deno.env.get('SUPABASE_ANON_KEY');
    const serviceRoleKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY');
    if (!supabaseUrl || !publishableKey || !serviceRoleKey) {
      return jsonResponse(503, {
        error: 'Serviço administrativo indisponível.',
      });
    }

    const callerClient = createClient(supabaseUrl, publishableKey, {
      global: { headers: { Authorization: `Bearer ${token}` } },
      auth: { persistSession: false },
    });
    const { data: callerData, error: callerError } =
      await callerClient.auth.getUser(token);
    if (callerError || !callerData.user) {
      return jsonResponse(401, { error: 'Sessão inválida.' });
    }

    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
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
      return jsonResponse(403, { error: 'Operação não autorizada.' });

    const body = (await request.json()) as JsonRecord;
    const action = requiredString(body, 'action', 32);

    if (action === 'create') {
      const username = requiredString(body, 'username', 32);
      const displayName = requiredString(body, 'displayName', 120);
      const idempotencyKey = requiredUuid(body, 'idempotencyKey');
      if (!isValidUsername(username))
        return jsonResponse(400, { error: 'Username inválido.' });

      const { data: existing, error: lookupError } = await adminClient.rpc(
        'get_admin_user_creation',
        { p_actor_user_id: actorId, p_idempotency_key: idempotencyKey },
      );
      if (lookupError) throw lookupError;
      if (existing)
        return jsonResponse(200, { user: existing, replayed: true });

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
      return jsonResponse(201, {
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
      return jsonResponse(404, { error: 'Utilizador não encontrado.' });

    if (action === 'update') {
      const username = requiredString(body, 'username', 32);
      const displayName = requiredString(body, 'displayName', 120);
      if (!isValidUsername(username))
        return jsonResponse(400, { error: 'Username inválido.' });

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
      return jsonResponse(200, { user: profile });
    }

    if (action === 'set-active') {
      if (typeof body.isActive !== 'boolean')
        return jsonResponse(400, { error: 'Estado inválido.' });
      const isActive = body.isActive;
      if (userId === actorId && !isActive) {
        return jsonResponse(400, {
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
      return jsonResponse(200, { user: profile });
    }

    if (action === 'reset-password') {
      const password = temporaryPassword();
      const { error: passwordError } =
        await adminClient.auth.admin.updateUserById(userId, { password });
      if (passwordError) throw passwordError;
      const { data: profile, error: resetError } = await adminClient.rpc(
        'mark_admin_password_reset',
        {
          p_actor_user_id: actorId,
          p_user_id: userId,
        },
      );
      if (resetError) throw resetError;
      return jsonResponse(200, { user: profile, temporaryPassword: password });
    }

    return jsonResponse(400, { error: 'Operação administrativa inválida.' });
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
    return jsonResponse(status, {
      error:
        status === 409
          ? 'Já existe um utilizador com esse username.'
          : invalidInput
            ? 'Os dados enviados são inválidos.'
            : 'Não foi possível concluir a operação administrativa.',
    });
  }
});
