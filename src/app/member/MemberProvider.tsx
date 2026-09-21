import { useState, type PropsWithChildren } from 'react';

import { MemberContext } from '@/app/member/memberContext';
import { createDashboardService } from '@/domains/dashboard/services/createDashboardService';
import type { DashboardService } from '@/domains/dashboard/services/DashboardService';
import { createLeaderboardService } from '@/domains/leaderboard/services/createLeaderboardService';
import type { LeaderboardService } from '@/domains/leaderboard/services/LeaderboardService';

export function MemberProvider({
  children,
  dashboardService,
  leaderboardService,
}: PropsWithChildren<{
  dashboardService?: DashboardService;
  leaderboardService?: LeaderboardService;
}>) {
  const [dashboard] = useState(
    () => dashboardService ?? createDashboardService(),
  );
  const [leaderboard] = useState(
    () => leaderboardService ?? createLeaderboardService(),
  );
  return (
    <MemberContext.Provider value={{ dashboard, leaderboard }}>
      {children}
    </MemberContext.Provider>
  );
}
