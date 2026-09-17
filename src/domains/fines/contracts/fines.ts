export type FineCategory = {
  id: string;
  seasonId: string;
  name: string;
  description: string | null;
  baseAmountCents: number;
  isActive: boolean;
  displayOrder: number;
};

export type FineMember = {
  id: string;
  displayName: string;
  memberType: 'player' | 'staff';
  shirtNumber: number | null;
  staffFunction: string | null;
  status: 'active' | 'inactive';
  isCaptain: boolean;
  isTreasurer: boolean;
};

export type Fine = {
  id: string;
  seasonId: string;
  seasonMemberId: string;
  categoryNameSnapshot: string;
  baseAmountCentsSnapshot: number;
  multiplier: 1 | 2;
  finalAmountCents: number;
  occurredAt: string;
  notes: string | null;
  status: 'pending' | 'paid';
  hasEverBeenPaid: boolean;
};

export type FineFilters = {
  seasonId: string;
  memberId?: string;
  status?: 'pending' | 'paid';
  page: number;
};

export type FinePage = { fines: Fine[]; total: number };

export type SaveFineCategory = {
  seasonId: string;
  id?: string;
  name: string;
  description: string;
  baseAmountCents: number;
  isActive: boolean;
  displayOrder: number;
};

export type ApplyFine = {
  memberId: string;
  categoryId: string;
  occurredAt: string;
  notes: string;
  idempotencyKey: string;
};

export interface FinesGateway {
  loadCategories(seasonId: string): Promise<FineCategory[]>;
  loadMembers(seasonId: string): Promise<FineMember[]>;
  loadFines(filters: FineFilters): Promise<FinePage>;
  saveCategory(input: SaveFineCategory): Promise<FineCategory>;
  applyFine(input: ApplyFine): Promise<Fine>;
}
