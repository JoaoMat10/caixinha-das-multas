import { createSupabaseFinesGateway } from '@/domains/fines/infrastructure/supabaseFinesGateway';
import { FinesService } from '@/domains/fines/services/FinesService';
import { appEnv, getSupabasePublicConfiguration } from '@/shared/config/env';

export function createFinesService() {
  const configuration = getSupabasePublicConfiguration(appEnv);
  if (!configuration)
    return new FinesService({
      loadCategories: () =>
        Promise.reject(new Error('Supabase não configurado.')),
      loadMembers: () => Promise.reject(new Error('Supabase não configurado.')),
      loadFines: () => Promise.reject(new Error('Supabase não configurado.')),
      saveCategory: () =>
        Promise.reject(new Error('Supabase não configurado.')),
      applyFine: () => Promise.reject(new Error('Supabase não configurado.')),
    });
  return new FinesService(createSupabaseFinesGateway(configuration));
}
