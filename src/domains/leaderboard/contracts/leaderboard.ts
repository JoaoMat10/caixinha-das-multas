export type LeaderboardMember = {
  id: string;
  displayName: string;
  avatarUrl: string | null;
  memberType: 'player' | 'staff';
  shirtNumber: number | null;
  staffFunction: string | null;
  isCaptain: boolean;
  fineCount: number;
  totalFinedCents: number;
  totalDebtCents: number;
};

export type LeaderboardData = {
  byFineCount: LeaderboardMember[];
  byTotalFined: LeaderboardMember[];
  byCurrentDebt: LeaderboardMember[];
};

export interface LeaderboardGateway {
  loadMembers(seasonId: string): Promise<LeaderboardMember[]>;
}
