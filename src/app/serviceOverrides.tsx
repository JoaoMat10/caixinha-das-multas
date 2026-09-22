/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type PropsWithChildren } from 'react';

import type { AdminService } from '@/domains/admin/services/AdminService';
import type { DashboardService } from '@/domains/dashboard/services/DashboardService';
import type { FinesService } from '@/domains/fines/services/FinesService';
import type { LeaderboardService } from '@/domains/leaderboard/services/LeaderboardService';
import type { TreasuryService } from '@/domains/treasury/services/TreasuryService';

export type AppServiceOverrides = {
  adminService?: AdminService;
  finesService?: FinesService;
  treasuryService?: TreasuryService;
  dashboardService?: DashboardService;
  leaderboardService?: LeaderboardService;
};

const ServiceOverridesContext = createContext<AppServiceOverrides>({});

export function ServiceOverridesProvider({
  children,
  value,
}: PropsWithChildren<{ value: AppServiceOverrides }>) {
  return (
    <ServiceOverridesContext.Provider value={value}>
      {children}
    </ServiceOverridesContext.Provider>
  );
}

export function useServiceOverrides() {
  return useContext(ServiceOverridesContext);
}
