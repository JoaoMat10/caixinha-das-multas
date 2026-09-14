import { useContext } from 'react';

import { AuthContext } from '@/domains/auth/state/authContext';

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('AuthProvider não encontrado.');
  return context;
}
