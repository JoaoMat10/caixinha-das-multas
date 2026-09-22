/* eslint-disable react-refresh/only-export-components */
import { lazy, Suspense, type ReactNode } from 'react';
import { createBrowserRouter, createMemoryRouter } from 'react-router-dom';

import { AppShell } from '@/app/layout/AppShell';
import { NotFoundPage } from '@/shared/pages/NotFoundPage';
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

const DashboardPage = lazy(() =>
  import('@/app/member/DashboardPage').then((module) => ({
    default: module.DashboardPage,
  })),
);
const LeaderboardPage = lazy(() =>
  import('@/app/member/LeaderboardPage').then((module) => ({
    default: module.LeaderboardPage,
  })),
);
const FinesPage = lazy(() =>
  import('@/app/financial/FinesPage').then((module) => ({
    default: module.FinesPage,
  })),
);
const TreasuryPage = lazy(() =>
  import('@/app/financial/TreasuryPage').then((module) => ({
    default: module.TreasuryPage,
  })),
);
const AdminPage = lazy(() =>
  import('@/domains/admin/pages/AdminPage').then((module) => ({
    default: module.AdminPage,
  })),
);
const MemberRouteProvider = lazy(() =>
  import('@/app/providers/MemberRouteProvider').then((module) => ({
    default: module.MemberRouteProvider,
  })),
);
const FinancialRouteProvider = lazy(() =>
  import('@/app/providers/FinancialRouteProvider').then((module) => ({
    default: module.FinancialRouteProvider,
  })),
);
const AdminRouteProvider = lazy(() =>
  import('@/app/providers/AdminRouteProvider').then((module) => ({
    default: module.AdminRouteProvider,
  })),
);

function lazyPage(page: ReactNode) {
  return (
    <Suspense
      fallback={
        <div
          aria-label="A carregar conteúdo"
          className="page-loader"
          role="status"
        >
          <span className="skeleton-line short" />
          <span className="skeleton-line" />
          <span className="skeleton-card" />
        </div>
      }
    >
      {page}
    </Suspense>
  );
}

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
              {
                element: lazyPage(<MemberRouteProvider />),
                children: [
                  { path: 'painel', element: lazyPage(<DashboardPage />) },
                  { path: 'mural', element: lazyPage(<LeaderboardPage />) },
                ],
              },
            ],
          },
          {
            element: <AuthorizedRoute capability="treasurer" />,
            children: [
              {
                element: lazyPage(<FinancialRouteProvider />),
                children: [
                  { path: 'multas', element: lazyPage(<FinesPage />) },
                  { path: 'tesouraria', element: lazyPage(<TreasuryPage />) },
                ],
              },
            ],
          },
          {
            element: <AuthorizedRoute capability="admin" />,
            children: [
              {
                element: lazyPage(<AdminRouteProvider />),
                children: [
                  { path: 'administracao', element: lazyPage(<AdminPage />) },
                ],
              },
            ],
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
