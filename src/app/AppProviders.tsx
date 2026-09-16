import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';

import { createAppQueryClient } from '@/app/queryClient';
import { AdminProvider } from '@/domains/admin/state/AdminProvider';
import { createAdminService } from '@/domains/admin/services/createAdminService';
import type { AdminService } from '@/domains/admin/services/AdminService';
import { AuthProvider } from '@/domains/auth';
import { createAuthService } from '@/domains/auth/services/createAuthService';
import type { AuthService } from '@/domains/auth/services/AuthService';

type AppProvidersProps = PropsWithChildren<{
  queryClient?: QueryClient;
  authService?: AuthService;
  adminService?: AdminService;
}>;

export function AppProviders({
  children,
  queryClient,
  authService,
  adminService,
}: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createAppQueryClient());
  const [authentication] = useState(() => authService ?? createAuthService());
  const [administration] = useState(() => adminService ?? createAdminService());

  return (
    <QueryClientProvider client={client}>
      <AuthProvider service={authentication}>
        <AdminProvider service={administration}>{children}</AdminProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}
