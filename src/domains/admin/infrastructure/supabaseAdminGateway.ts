import { createClient, type SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type {
  AdminGateway,
  CreateAdminUser,
  ResetAdminPassword,
  SaveAdminMember,
  SaveAdminSeason,
  SaveAdminTeam,
  UpdateAdminUser,
} from '@/domains/admin/contracts/admin';
import type { SupabasePublicConfiguration } from '@/shared/config/env';

const overviewSchema = z.object({
  users: z.array(
    z.object({
      id: z.uuid(),
      username: z.string(),
      displayName: z.string(),
      avatarPath: z.string().nullable(),
      mustChangePassword: z.boolean(),
      isActive: z.boolean(),
      createdAt: z.string(),
    }),
  ),
  teams: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      badgePath: z.string().nullable(),
      isActive: z.boolean(),
      createdAt: z.string(),
    }),
  ),
  seasons: z.array(
    z.object({
      id: z.uuid(),
      teamId: z.uuid(),
      name: z.string(),
      startsOn: z.string().nullable(),
      endsOn: z.string().nullable(),
      status: z.enum(['draft', 'active', 'archived']),
      copiedFromSeasonId: z.uuid().nullable(),
      createdAt: z.string(),
    }),
  ),
  members: z.array(
    z.object({
      id: z.uuid(),
      seasonId: z.uuid(),
      userId: z.uuid(),
      memberType: z.enum(['player', 'staff']),
      shirtNumber: z.number().nullable(),
      staffFunction: z.string().nullable(),
      status: z.enum(['active', 'inactive']),
      roles: z.array(z.enum(['captain', 'treasurer'])),
    }),
  ),
  auditEvents: z.array(
    z.object({
      id: z.uuid(),
      actorUserId: z.uuid(),
      actorDisplayName: z.string(),
      action: z.string(),
      entityType: z.string(),
      entityId: z.uuid().nullable(),
      teamId: z.uuid().nullable(),
      seasonId: z.uuid().nullable(),
      metadata: z.record(z.string(), z.unknown()),
      occurredAt: z.string(),
    }),
  ),
});

type RpcResult = { data: unknown; error: Error | null };

function assertResult(result: RpcResult) {
  if (result.error) throw result.error;
  return result.data;
}

export class SupabaseAdminGateway implements AdminGateway {
  constructor(private readonly client: SupabaseClient) {}

  async loadOverview() {
    const result = (await this.client.rpc('get_admin_overview')) as RpcResult;
    return overviewSchema.parse(assertResult(result));
  }

  private async invokeAccount(body: Record<string, unknown>) {
    const invocation = (await this.client.functions.invoke('admin-users', {
      body,
    })) as { data: unknown; error: Error | null };
    const { data, error } = invocation;
    if (error)
      throw new Error('Não foi possível concluir a operação da conta.');
    const response = data as {
      error?: string;
      temporaryPassword?: string;
      replayed?: boolean;
    } | null;
    if (!response || response.error)
      throw new Error(response?.error ?? 'Resposta administrativa inválida.');
    return {
      temporaryPassword: response.temporaryPassword ?? null,
      replayed: response.replayed,
    };
  }

  createUser(input: CreateAdminUser) {
    return this.invokeAccount({ action: 'create', ...input });
  }

  async updateUser(input: UpdateAdminUser) {
    await this.invokeAccount({
      action: 'update',
      userId: input.id,
      username: input.username,
      displayName: input.displayName,
    });
  }

  async setUserActive(userId: string, isActive: boolean) {
    await this.invokeAccount({ action: 'set-active', userId, isActive });
  }

  resetPassword(input: ResetAdminPassword) {
    return this.invokeAccount({ action: 'reset-password', ...input });
  }

  async saveTeam(input: SaveAdminTeam) {
    assertResult(
      (await this.client.rpc('save_admin_team', {
        p_team_id: input.id ?? null,
        p_name: input.name,
        p_is_active: input.isActive,
      })) as RpcResult,
    );
  }

  async saveSeason(input: SaveAdminSeason) {
    if (input.id) {
      assertResult(
        (await this.client.rpc('update_admin_season', {
          p_season_id: input.id,
          p_name: input.name,
          p_starts_on: input.startsOn,
          p_ends_on: input.endsOn,
          p_status: input.status,
        })) as RpcResult,
      );
      return;
    }
    assertResult(
      (await this.client.rpc('create_season', {
        p_team_id: input.teamId,
        p_name: input.name,
        p_starts_on: input.startsOn,
        p_ends_on: input.endsOn,
        p_status: input.status,
        p_copy_from_season_id: input.copyFromSeasonId,
        p_idempotency_key: input.idempotencyKey,
      })) as RpcResult,
    );
  }

  async saveMember(input: SaveAdminMember) {
    assertResult(
      (await this.client.rpc('save_admin_member', {
        p_season_member_id: input.id ?? null,
        p_season_id: input.seasonId,
        p_user_id: input.userId,
        p_member_type: input.memberType,
        p_shirt_number:
          input.memberType === 'player' ? input.shirtNumber : null,
        p_staff_function:
          input.memberType === 'staff' ? input.staffFunction : null,
        p_status: input.status,
        p_roles: input.roles,
      })) as RpcResult,
    );
  }

  async uploadUserPhoto(userId: string, file: File) {
    const extension =
      file.type === 'image/png'
        ? 'png'
        : file.type === 'image/webp'
          ? 'webp'
          : 'jpg';
    const path = `users/${userId}/${crypto.randomUUID()}.${extension}`;
    const { error: uploadError } = await this.client.storage
      .from('private-photos')
      .upload(path, file, {
        cacheControl: '3600',
        contentType: file.type,
        upsert: false,
      });
    if (uploadError) throw uploadError;

    const result = (await this.client.rpc('set_admin_photo', {
      p_entity_type: 'user',
      p_entity_id: userId,
      p_path: path,
    })) as RpcResult;
    if (result.error) {
      await this.client.storage.from('private-photos').remove([path]);
      throw result.error;
    }
    if (typeof result.data === 'string' && result.data !== path) {
      await this.client.storage.from('private-photos').remove([result.data]);
    }
  }

  async removeUserPhoto(userId: string) {
    const result = (await this.client.rpc('set_admin_photo', {
      p_entity_type: 'user',
      p_entity_id: userId,
      p_path: null,
    })) as RpcResult;
    const previousPath = assertResult(result);
    if (typeof previousPath === 'string') {
      const { error } = await this.client.storage
        .from('private-photos')
        .remove([previousPath]);
      if (error) throw error;
    }
  }
}

export function createSupabaseAdminGateway(
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
  return new SupabaseAdminGateway(client);
}
