import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type { DashboardGateway } from '@/domains/dashboard/contracts/dashboard';
import type { SupabasePublicConfiguration } from '@/shared/config/env';
import { createPrivatePhotoUrl } from '@/shared/infrastructure/privatePhotoUrl';
import { getSupabasePublicClient } from '@/shared/infrastructure/supabasePublicClient';

const balanceSchema = z.object({
  fine_count: z.coerce.number().int().nonnegative(),
  total_fined_cents: z.coerce.number().int().nonnegative(),
  total_paid_cents: z.coerce.number().int().nonnegative(),
  total_debt_cents: z.coerce.number().int().nonnegative(),
});

const memberSchema = z.object({
  season_member_id: z.uuid(),
  display_name: z.string(),
  avatar_path: z.string().nullable(),
  member_type: z.enum(['player', 'staff']),
  shirt_number: z.number().int().nullable(),
  staff_function: z.string().nullable(),
  is_captain: z.boolean(),
});

const fineSchema = z.object({
  id: z.uuid(),
  category_name_snapshot: z.string(),
  base_amount_cents_snapshot: z.number().int().nonnegative(),
  multiplier: z.union([z.literal(1), z.literal(2)]),
  final_amount_cents: z.number().int().nonnegative(),
  occurred_at: z.string(),
  notes: z.string().nullable(),
  status: z.enum(['pending', 'paid']),
});

function requireData(result: { data: unknown; error: Error | null }) {
  if (result.error) throw result.error;
  return result.data;
}

export class SupabaseDashboardGateway implements DashboardGateway {
  constructor(private readonly client: SupabaseClient) {}

  async loadSnapshot(seasonId: string, memberId: string) {
    const [balanceResult, directoryResult, finesResult] = await Promise.all([
      this.client
        .from('my_season_balances')
        .select(
          'fine_count,total_fined_cents,total_paid_cents,total_debt_cents',
        )
        .eq('season_id', seasonId)
        .eq('season_member_id', memberId)
        .maybeSingle(),
      this.client.rpc('get_season_member_directory', {
        p_season_id: seasonId,
      }),
      this.client
        .from('fines')
        .select(
          'id,category_name_snapshot,base_amount_cents_snapshot,multiplier,final_amount_cents,occurred_at,notes,status',
        )
        .eq('season_id', seasonId)
        .eq('season_member_id', memberId)
        .order('occurred_at', { ascending: false })
        .order('id'),
    ]);

    const balance = balanceSchema.parse(requireData(balanceResult));
    const member = z
      .array(memberSchema)
      .parse(requireData(directoryResult))
      .find((item) => item.season_member_id === memberId);
    if (!member) throw new Error('Membro não encontrado nesta época.');
    const avatarUrl = await createPrivatePhotoUrl(
      this.client,
      member.avatar_path,
    );

    return {
      member: {
        id: member.season_member_id,
        displayName: member.display_name,
        avatarUrl,
        memberType: member.member_type,
        shirtNumber: member.shirt_number,
        staffFunction: member.staff_function,
        isCaptain: member.is_captain,
      },
      fineCount: balance.fine_count,
      totalFinedCents: balance.total_fined_cents,
      totalPaidCents: balance.total_paid_cents,
      totalDebtCents: balance.total_debt_cents,
      fines: z
        .array(fineSchema)
        .parse(requireData(finesResult))
        .map((fine) => ({
          id: fine.id,
          categoryName: fine.category_name_snapshot,
          baseAmountCents: fine.base_amount_cents_snapshot,
          multiplier: fine.multiplier,
          finalAmountCents: fine.final_amount_cents,
          occurredAt: fine.occurred_at,
          notes: fine.notes,
          status: fine.status,
        })),
    };
  }
}

export function createSupabaseDashboardGateway(
  configuration: SupabasePublicConfiguration,
) {
  return new SupabaseDashboardGateway(getSupabasePublicClient(configuration));
}
