import { QueryClientProvider, type QueryClient } from '@tanstack/react-query';
import { useState, type PropsWithChildren } from 'react';

import { createAppQueryClient } from '@/app/queryClient';

type AppProvidersProps = PropsWithChildren<{
  queryClient?: QueryClient;
}>;

export function AppProviders({ children, queryClient }: AppProvidersProps) {
  const [client] = useState(() => queryClient ?? createAppQueryClient());

  return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
}
