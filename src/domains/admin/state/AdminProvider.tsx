import type { PropsWithChildren } from 'react';

import type { AdminService } from '@/domains/admin/services/AdminService';
import { AdminContext } from '@/domains/admin/state/adminContext';

export function AdminProvider({
  children,
  service,
}: PropsWithChildren<{ service: AdminService }>) {
  return <AdminContext value={service}>{children}</AdminContext>;
}
