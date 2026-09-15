import { createContext } from 'react';

import type { AuthenticatedUser } from '@/domains/auth/contracts/auth';

export type AuthStatus =
  | 'loading'
  | 'anonymous'
  | 'authenticated'
  | 'must-change-password'
  | 'configuration-error';

export type AuthContextValue = {
  status: AuthStatus;
  user: AuthenticatedUser | null;
  error: string | null;
  isBusy: boolean;
  login: (username: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  changePassword: (
    currentPassword: string,
    newPassword: string,
  ) => Promise<void>;
  refresh: () => Promise<void>;
};

export const AuthContext = createContext<AuthContextValue | null>(null);
