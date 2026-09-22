import { useState } from 'react';
import { Outlet } from 'react-router-dom';

import { useServiceOverrides } from '@/app/serviceOverrides';
import { createAdminService } from '@/domains/admin/services/createAdminService';
import { AdminProvider } from '@/domains/admin/state/AdminProvider';

export function AdminRouteProvider() {
  const { adminService } = useServiceOverrides();
  const [service] = useState(() => adminService ?? createAdminService());
  return (
    <AdminProvider service={service}>
      <Outlet />
    </AdminProvider>
  );
}
