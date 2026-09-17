import type { SupabaseClient } from '@supabase/supabase-js';
import { z } from 'zod';

import type {
  ApplyFine,
  FineFilters,
  FinesGateway,
  SaveFineCategory,
} from '@/domains/fines/contracts/fines';
import type { SupabasePublicConfiguration } from '@/shared/config/env';
import { getSupabasePublicClient } from '@/shared/infrastructure/supabasePublicClient';

const categorySchema = z.object({
  id: z.uuid(),
  season_id: z.uuid(),
  name: z.string(),
  description: z.string().nullable(),
  base_amount_cents: z.number().int(),
  is_active: z.boolean(),
  display_order: z.number().int(),
});
const memberSchema = z.object({
  season_member_id: z.uuid(),
  display_name: z.string(),
  member_type: z.enum(['player', 'staff']),
  shirt_number: z.number().nullable(),
  staff_function: z.string().nullable(),
  member_status: z.enum(['active', 'inactive']),
  is_captain: z.boolean(),
  is_treasurer: z.boolean(),
});
const fineSchema = z.object({
  id: z.uuid(),
  season_id: z.uuid(),
  season_member_id: z.uuid(),
  category_name_snapshot: z.string(),
  base_amount_cents_snapshot: z.number().int(),
  multiplier: z.union([z.literal(1), z.literal(2)]),
  final_amount_cents: z.number().int(),
  occurred_at: z.string(),
  notes: z.string().nullable(),
  status: z.enum(['pending', 'paid']),
  has_ever_been_paid: z.boolean(),
});

function check(result: { data: unknown; error: Error | null }): unknown {
  if (result.error) throw result.error;
  return result.data;
}

function mapCategory(row: z.infer<typeof categorySchema>) {
  return {
    id: row.id,
    seasonId: row.season_id,
    name: row.name,
    description: row.description,
    baseAmountCents: row.base_amount_cents,
    isActive: row.is_active,
    displayOrder: row.display_order,
  };
}

function mapFine(row: z.infer<typeof fineSchema>) {
  return {
    id: row.id,
    seasonId: row.season_id,
    seasonMemberId: row.season_member_id,
    categoryNameSnapshot: row.category_name_snapshot,
    baseAmountCentsSnapshot: row.base_amount_cents_snapshot,
    multiplier: row.multiplier,
    finalAmountCents: row.final_amount_cents,
    occurredAt: row.occurred_at,
    notes: row.notes,
    status: row.status,
    hasEverBeenPaid: row.has_ever_been_paid,
  };
}

export class SupabaseFinesGateway implements FinesGateway {
  constructor(private readonly client: SupabaseClient) {}

  async loadCategories(seasonId: string) {
    const rows = check(
      await this.client
        .from('fine_categories')
        .select(
          'id,season_id,name,description,base_amount_cents,is_active,display_order',
        )
        .eq('season_id', seasonId)
        .order('display_order')
        .order('name'),
    );
    return z.array(categorySchema).parse(rows).map(mapCategory);
  }

  async loadMembers(seasonId: string) {
    const rows = check(
      await this.client.rpc('get_season_member_directory', {
        p_season_id: seasonId,
      }),
    );
    return z
      .array(memberSchema)
      .parse(rows)
      .map((row) => ({
        id: row.season_member_id,
        displayName: row.display_name,
        memberType: row.member_type,
        shirtNumber: row.shirt_number,
        staffFunction: row.staff_function,
        status: row.member_status,
        isCaptain: row.is_captain,
        isTreasurer: row.is_treasurer,
      }));
  }

  async loadFines(filters: FineFilters) {
    let query = this.client
      .from('fines')
      .select(
        'id,season_id,season_member_id,category_name_snapshot,base_amount_cents_snapshot,multiplier,final_amount_cents,occurred_at,notes,status,has_ever_been_paid',
        { count: 'exact' },
      )
      .eq('season_id', filters.seasonId);
    if (filters.memberId)
      query = query.eq('season_member_id', filters.memberId);
    if (filters.status) query = query.eq('status', filters.status);
    const first = filters.page * 50;
    const result = await query
      .order('occurred_at', { ascending: false })
      .order('id')
      .range(first, first + 49);
    if (result.error) throw result.error;
    return {
      fines: z.array(fineSchema).parse(result.data).map(mapFine),
      total: result.count ?? 0,
    };
  }

  async saveCategory(input: SaveFineCategory) {
    const row = check(
      await this.client.rpc('save_fine_category', {
        p_season_id: input.seasonId,
        p_fine_category_id: input.id ?? null,
        p_name: input.name,
        p_description: input.description,
        p_base_amount_cents: input.baseAmountCents,
        p_is_active: input.isActive,
        p_display_order: input.displayOrder,
      }),
    );
    return mapCategory(categorySchema.parse(row));
  }

  async applyFine(input: ApplyFine) {
    const row = check(
      await this.client.rpc('apply_fine', {
        p_season_member_id: input.memberId,
        p_fine_category_id: input.categoryId,
        p_occurred_at: input.occurredAt,
        p_notes: input.notes,
        p_idempotency_key: input.idempotencyKey,
      }),
    );
    return mapFine(fineSchema.parse(row));
  }
}

export function createSupabaseFinesGateway(
  configuration: SupabasePublicConfiguration,
) {
  return new SupabaseFinesGateway(getSupabasePublicClient(configuration));
}
