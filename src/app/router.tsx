import { createBrowserRouter, createMemoryRouter } from 'react-router-dom';

import { AppShell } from '@/app/layout/AppShell';
import { DashboardPage } from '@/app/member/DashboardPage';
import { LeaderboardPage } from '@/app/member/LeaderboardPage';
import { NotFoundPage } from '@/shared/pages/NotFoundPage';
import { AdminPage } from '@/domains/admin';
import {
  AnonymousOnlyRoute,
  AuthenticatedIndexRoute,
  AuthorizedRoute,
  LoginPage,
  NoAccessPage,
  PasswordChangePage,
  PasswordChangeRequiredRoute,
  PasswordSettingsPage,
  ProtectedRoute,
} from '@/domains/auth';
import { FinesPage } from '@/app/financial/FinesPage';
import { TreasuryPage } from '@/app/financial/TreasuryPage';

export const appRoutes = [
  {
    element: <AnonymousOnlyRoute />,
    children: [{ path: '/entrar', element: <LoginPage /> }],
  },
  {
    element: <PasswordChangeRequiredRoute />,
    children: [
      {
        path: '/alterar-password-obrigatoria',
        element: <PasswordChangePage required />,
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        path: '/',
        element: <AppShell />,
        children: [
          { index: true, element: <AuthenticatedIndexRoute /> },
          {
            element: <AuthorizedRoute capability="member" />,
            children: [
              { path: 'painel', element: <DashboardPage /> },
              { path: 'mural', element: <LeaderboardPage /> },
            ],
          },
          {
            element: <AuthorizedRoute capability="treasurer" />,
            children: [
              { path: 'multas', element: <FinesPage /> },
              { path: 'tesouraria', element: <TreasuryPage /> },
            ],
          },
          {
            element: <AuthorizedRoute capability="admin" />,
            children: [{ path: 'administracao', element: <AdminPage /> }],
          },
          {
            path: 'definicoes/password',
            element: <PasswordSettingsPage />,
          },
          { path: 'sem-acesso', element: <NoAccessPage /> },
          { path: '*', element: <NotFoundPage /> },
        ],
      },
    ],
  },
];

export const browserRouter = createBrowserRouter(appRoutes);

export function createTestRouter(initialEntries: string[] = ['/']) {
  return createMemoryRouter(appRoutes, { initialEntries });
}
