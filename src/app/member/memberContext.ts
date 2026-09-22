import { createContext, useContext } from 'react';

import type { DashboardService } from '@/domains/dashboard/services/DashboardService';
import type { LeaderboardService } from '@/domains/leaderboard/services/LeaderboardService';

export const MemberContext = createContext<{
  dashboard: DashboardService;
  leaderboard: LeaderboardService;
} | null>(null);

export function useMemberServices() {
  const context = useContext(MemberContext);
  if (!context) throw new Error('MemberProvider não encontrado.');
  return context;
}
