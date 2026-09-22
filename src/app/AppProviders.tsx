import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';

import { createAppQueryClient } from '@/app/queryClient';
import type { AdminService } from '@/domains/admin/services/AdminService';
import { AuthProvider } from '@/domains/auth';
import { createAuthService } from '@/domains/auth/services/createAuthService';
import type { AuthService } from '@/domains/auth/services/AuthService';
import type { FinesService } from '@/domains/fines/services/FinesService';
import type { TreasuryService } from '@/domains/treasury/services/TreasuryService';
import type { DashboardService } from '@/domains/dashboard/services/DashboardService';
import type { LeaderboardService } from '@/domains/leaderboard/services/LeaderboardService';
import { ServiceOverridesProvider } from '@/app/serviceOverrides';

type AppProvidersProps = PropsWithChildren<{
  queryClient?: QueryClient;
  authService?: AuthService;
  adminService?: AdminService;
  finesService?: FinesService;
  treasuryService?: TreasuryService;
  dashboardService?: DashboardService;
  leaderboardService?: LeaderboardService;
}>;

export function AppProviders({
  children,
  queryClient,
  authService,
  adminService,
  finesService,
  treasuryService,
  dashboardService,
  leaderboardService,
}: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createAppQueryClient());
  const [authentication] = useState(() => authService ?? createAuthService());

  return (
    <QueryClientProvider client={client}>
      <AuthProvider service={authentication}>
        <ServiceOverridesProvider
          value={{
            adminService,
            finesService,
            treasuryService,
            dashboardService,
            leaderboardService,
          }}
        >
          {children}
        </ServiceOverridesProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
