import { use } from 'react';

import { AdminContext } from '@/domains/admin/state/adminContext';

export function useAdminService() {
  const service = use(AdminContext);
  if (!service) throw new Error('AdminProvider em falta.');
  return service;
}
