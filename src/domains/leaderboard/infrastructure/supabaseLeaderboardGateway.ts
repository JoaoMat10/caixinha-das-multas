import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { LeaderboardGateway } from '@/domains/leaderboard/contracts/leaderboard';
import type { SupabasePublicConfiguration } from '@/shared/config/env';
import { createPrivatePhotoUrl } from '@/shared/infrastructure/privatePhotoUrl';
import { getSupabasePublicClient } from '@/shared/infrastructure/supabasePublicClient';

const leaderboardSchema = z.object({
  season_member_id: z.uuid(),
  display_name: z.string(),
  member_type: z.enum(['player', 'staff']),
  shirt_number: z.number().int().nullable(),
  staff_function: z.string().nullable(),
  is_captain: z.boolean(),
  fine_count: z.coerce.number().int().nonnegative(),
  total_fined_cents: z.coerce.number().int().nonnegative(),
  total_debt_cents: z.coerce.number().int().nonnegative(),
});

const directorySchema = z.object({
  season_member_id: z.uuid(),
  avatar_path: z.string().nullable(),
});

function requireData(result: { data: unknown; error: Error | null }) {
  if (result.error) throw result.error;
  return result.data;
}

export class SupabaseLeaderboardGateway implements LeaderboardGateway {
  constructor(private readonly client: SupabaseClient) {}

  async loadMembers(seasonId: string) {
    const [leaderboardResult, directoryResult] = await Promise.all([
      this.client.rpc('get_season_leaderboard', { p_season_id: seasonId }),
      this.client.rpc('get_season_member_directory', {
        p_season_id: seasonId,
      }),
    ]);
    const rows = z
      .array(leaderboardSchema)
      .parse(requireData(leaderboardResult));
    const directory = z
      .array(directorySchema)
      .parse(requireData(directoryResult));
    const avatarPaths = new Map(
      directory.map((member) => [member.season_member_id, member.avatar_path]),
    );
    return Promise.all(
      rows.map(async (member) => ({
        id: member.season_member_id,
        displayName: member.display_name,
        avatarUrl: await createPrivatePhotoUrl(
          this.client,
          avatarPaths.get(member.season_member_id) ?? null,
        ),
        memberType: member.member_type,
        shirtNumber: member.shirt_number,
        staffFunction: member.staff_function,
        isCaptain: member.is_captain,
        fineCount: member.fine_count,
        totalFinedCents: member.total_fined_cents,
        totalDebtCents: member.total_debt_cents,
      })),
    );
  }
}

export function createSupabaseLeaderboardGateway(
  configuration: SupabasePublicConfiguration,
) {
  return new SupabaseLeaderboardGateway(getSupabasePublicClient(configuration));
}
