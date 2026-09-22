import { Outlet } from 'react-router-dom';

import { MemberProvider } from '@/app/member/MemberProvider';
import { useServiceOverrides } from '@/app/serviceOverrides';

export function MemberRouteProvider() {
  const { dashboardService, leaderboardService } = useServiceOverrides();
  return (
    <MemberProvider
      dashboardService={dashboardService}
      leaderboardService={leaderboardService}
    >
      <Outlet />
    </MemberProvider>
  );
}
