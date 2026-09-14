import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';

import { createAppQueryClient } from '@/app/queryClient';
import { AuthProvider } from '@/domains/auth';
import { createAuthService } from '@/domains/auth/services/createAuthService';
import type { AuthService } from '@/domains/auth/services/AuthService';

type AppProvidersProps = PropsWithChildren<{
  queryClient?: QueryClient;
  authService?: AuthService;
}>;

export function AppProviders({
  children,
  queryClient,
  authService,
}: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createAppQueryClient());
  const [authentication] = useState(() => authService ?? createAuthService());

  return (
    <QueryClientProvider client={client}>
      <AuthProvider service={authentication}>{children}</AuthProvider>
    </QueryClientProvider>
  );
}
