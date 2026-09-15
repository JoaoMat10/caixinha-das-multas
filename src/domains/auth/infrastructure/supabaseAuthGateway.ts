import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type {
  AuthGateway,
  AuthSession,
  AuthSessionEvent,
  PasswordChange,
} from '@/domains/auth/contracts/auth';
import type { SupabasePublicConfiguration } from '@/shared/config/env';

const authorizationContextSchema = z.object({
  profile: z.object({
    id: z.uuid(),
    username: z.string(),
    displayName: z.string(),
    avatarPath: z.string().nullable(),
    mustChangePassword: z.boolean(),
  }),
  isAppAdmin: z.boolean(),
  memberships: z.array(
    z.object({
      id: z.uuid(),
      seasonId: z.uuid(),
      seasonName: z.string(),
      seasonStatus: z.enum(['draft', 'active', 'archived']),
      teamId: z.uuid(),
      teamName: z.string(),
      memberType: z.enum(['player', 'staff']),
      roles: z.array(z.enum(['captain', 'treasurer'])),
    }),
  ),
});

const authEventMap: Record<string, AuthSessionEvent | undefined> = {
  INITIAL_SESSION: 'initial',
  SIGNED_IN: 'signed-in',
  SIGNED_OUT: 'signed-out',
  TOKEN_REFRESHED: 'token-refreshed',
  USER_UPDATED: 'user-updated',
};

function toAuthSession(
  session: { user: { id: string }; expires_at?: number } | null,
): AuthSession | null {
  if (!session?.expires_at) {
    return null;
  }

  return { userId: session.user.id, expiresAt: session.expires_at };
}

export class SupabaseAuthGateway implements AuthGateway {
  constructor(private readonly client: SupabaseClient) {}

  async signIn(technicalEmail: string, password: string) {
    const { data, error } = await this.client.auth.signInWithPassword({
      email: technicalEmail,
      password,
    });

    if (error) throw error;

    const session = toAuthSession(data.session);
    if (!session) throw new Error('Sessão inválida.');
    return session;
  }

  async getSession() {
    const { data, error } = await this.client.auth.getSession();
    if (error) throw error;
    return toAuthSession(data.session);
  }

  async loadAuthorizationContext(userId: string) {
    const result = (await this.client.rpc('get_auth_context')) as {
      data: unknown;
      error: Error | null;
    };
    if (result.error) throw result.error;

    const context = authorizationContextSchema.parse(result.data);
    if (context.profile.id !== userId) {
      throw new Error('Contexto de autorização inconsistente.');
    }
    return {
      id: context.profile.id,
      username: context.profile.username,
      displayName: context.profile.displayName,
      avatarPath: context.profile.avatarPath,
      mustChangePassword: context.profile.mustChangePassword,
      isAppAdmin: context.isAppAdmin,
      memberships: context.memberships,
    } satisfies Awaited<ReturnType<AuthGateway['loadAuthorizationContext']>>;
  }

  async updatePassword(change: PasswordChange) {
    const { error } = await this.client.auth.updateUser({
      current_password: change.currentPassword,
      password: change.newPassword,
    });
    if (error) throw error;
  }

  async signOut() {
    const { error } = await this.client.auth.signOut({ scope: 'local' });
    if (error) throw error;
  }

  onSessionEvent(listener: (event: AuthSessionEvent) => void) {
    const { data } = this.client.auth.onAuthStateChange((event) => {
      const mappedEvent = authEventMap[event];
      if (mappedEvent) listener(mappedEvent);
    });

    return () => data.subscription.unsubscribe();
  }
}

export function createSupabaseAuthGateway(
  configuration: SupabasePublicConfiguration,
) {
  const client = createClient(configuration.url, configuration.publishableKey, {
    auth: {
      autoRefreshToken: true,
      detectSessionInUrl: false,
      persistSession: true,
      storageKey: 'caixinha-das-multas.auth',
    },
  });

  return new SupabaseAuthGateway(client);
}
