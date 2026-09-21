import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';

import { createAppQueryClient } from '@/app/queryClient';
import { AdminProvider } from '@/domains/admin/state/AdminProvider';
import { createAdminService } from '@/domains/admin/services/createAdminService';
import type { AdminService } from '@/domains/admin/services/AdminService';
import { AuthProvider } from '@/domains/auth';
import { createAuthService } from '@/domains/auth/services/createAuthService';
import type { AuthService } from '@/domains/auth/services/AuthService';
import { FinancialProvider } from '@/app/financial/FinancialProvider';
import type { FinesService } from '@/domains/fines/services/FinesService';
import type { TreasuryService } from '@/domains/treasury/services/TreasuryService';
import { MemberProvider } from '@/app/member/MemberProvider';
import type { DashboardService } from '@/domains/dashboard/services/DashboardService';
import type { LeaderboardService } from '@/domains/leaderboard/services/LeaderboardService';

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
  const [administration] = useState(() => adminService ?? createAdminService());

  return (
    <QueryClientProvider client={client}>
      <AuthProvider service={authentication}>
        <AdminProvider service={administration}>
          <FinancialProvider
            finesService={finesService}
            treasuryService={treasuryService}
          >
            <MemberProvider
              dashboardService={dashboardService}
              leaderboardService={leaderboardService}
            >
              {children}
            </MemberProvider>
          </FinancialProvider>
        </AdminProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
