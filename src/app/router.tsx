import { createBrowserRouter, createMemoryRouter } from 'react-router-dom';

import { AppShell } from '@/shared/components/AppShell';
import { NotFoundPage } from '@/shared/pages/NotFoundPage';
import { FoundationPage } from '@/shared/pages/FoundationPage';
import { AdminPlaceholderPage } from '@/domains/admin';
import { AuthPlaceholderPage } from '@/domains/auth';
import { DashboardPlaceholderPage } from '@/domains/dashboard';
import { FinesPlaceholderPage } from '@/domains/fines';
import { LeaderboardPlaceholderPage } from '@/domains/leaderboard';
import { TreasuryPlaceholderPage } from '@/domains/treasury';

export const appRoutes = [
  {
    path: '/',
    element: <AppShell />,
    children: [
      { index: true, element: <FoundationPage /> },
      { path: 'entrar', element: <AuthPlaceholderPage /> },
      { path: 'painel', element: <DashboardPlaceholderPage /> },
      { path: 'multas', element: <FinesPlaceholderPage /> },
      { path: 'tesouraria', element: <TreasuryPlaceholderPage /> },
      { path: 'mural', element: <LeaderboardPlaceholderPage /> },
      { path: 'administracao', element: <AdminPlaceholderPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
];

export const browserRouter = createBrowserRouter(appRoutes);

export function createTestRouter(initialEntries: string[] = ['/']) {
  return createMemoryRouter(appRoutes, { initialEntries });
}
