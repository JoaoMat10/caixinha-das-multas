export type DashboardMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  memberType: 'player' | 'staff';
  shirtNumber: number | null;
  staffFunction: string | null;
  isCaptain: boolean;
};

export type PersonalFine = {
  id: string;
  categoryName: string;
  baseAmountCents: number;
  multiplier: 1 | 2;
  finalAmountCents: number;
  occurredAt: string;
  notes: string | null;
  status: 'pending' | 'paid';
};

export type PersonalBalance = {
  fineCount: number;
  pendingCount: number;
  paidCount: number;
  totalFinedCents: number;
  totalPaidCents: number;
  totalDebtCents: number;
};

export type DashboardData = {
  member: DashboardMember;
  balance: PersonalBalance;
  pendingFines: PersonalFine[];
  paidFines: PersonalFine[];
};

export type DashboardSnapshot = {
  member: DashboardMember;
  fineCount: number;
  totalFinedCents: number;
  totalPaidCents: number;
  totalDebtCents: number;
  fines: PersonalFine[];
};

export interface DashboardGateway {
  loadSnapshot(seasonId: string, memberId: string): Promise<DashboardSnapshot>;
}
