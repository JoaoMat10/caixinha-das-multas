import { createContext } from 'react';

import type { AdminService } from '@/domains/admin/services/AdminService';

export const AdminContext = createContext<AdminService | null>(null);
