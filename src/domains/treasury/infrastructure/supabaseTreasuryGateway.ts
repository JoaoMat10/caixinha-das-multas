import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type {
  RecordPayment,
  TreasuryGateway,
} from '@/domains/treasury/contracts/treasury';
import type { SupabasePublicConfiguration } from '@/shared/config/env';
import { getSupabasePublicClient } from '@/shared/infrastructure/supabasePublicClient';

const totalsSchema = z.object({
  season_id: z.uuid(),
  fine_count: z.number(),
  total_fined_cents: z.number(),
  total_received_cents: z.number(),
  total_debt_cents: z.number(),
});
const batchSchema = z.object({
  id: z.uuid(),
  season_id: z.uuid(),
  season_member_id: z.uuid(),
  action: z.enum(['paid', 'reopened']),
  calculated_total_cents: z.number(),
});

export class SupabaseTreasuryGateway implements TreasuryGateway {
  constructor(private readonly client: SupabaseClient) {}

  async loadTotals(seasonId: string) {
    const { data, error } = (await this.client
      .from('treasury_season_totals')
      .select(
        'season_id,fine_count,total_fined_cents,total_received_cents,total_debt_cents',
      )
      .eq('season_id', seasonId)
      .maybeSingle()) as { data: unknown; error: Error | null };
    if (error) throw error;
    if (!data) throw new Error('Sem acesso aos totais desta época.');
    const row = totalsSchema.parse(data);
    return {
      seasonId: row.season_id,
      fineCount: row.fine_count,
      totalFinedCents: row.total_fined_cents,
      totalReceivedCents: row.total_received_cents,
      totalDebtCents: row.total_debt_cents,
    };
  }

  async recordPayment(input: RecordPayment) {
    const { data, error } = (await this.client.rpc('record_payment_batch', {
      p_season_member_id: input.memberId,
      p_fine_ids: input.fineIds,
      p_action: input.action,
      p_idempotency_key: input.idempotencyKey,
    })) as { data: unknown; error: Error | null };
    if (error) throw error;
    const row = batchSchema.parse(data);
    return {
      id: row.id,
      seasonId: row.season_id,
      memberId: row.season_member_id,
      action: row.action,
      calculatedTotalCents: row.calculated_total_cents,
    };
  }

  async deletePendingFine(fineId: string) {
    const { data, error } = (await this.client.rpc('delete_pending_fine', {
      p_fine_id: fineId,
    })) as { data: unknown; error: Error | null };
    if (error) throw error;
    if (data !== fineId) throw new Error('Resposta de eliminação inválida.');
  }
}

export function createSupabaseTreasuryGateway(
  configuration: SupabasePublicConfiguration,
) {
  return new SupabaseTreasuryGateway(getSupabasePublicClient(configuration));
}
