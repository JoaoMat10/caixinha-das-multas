import { createClient, type SupabaseClient } from '@supabase/supabase-js';

import type { SupabasePublicConfiguration } from '@/shared/config/env';

let cached: {
  url: string;
  publishableKey: string;
  client: SupabaseClient;
} | null = null;

export function getSupabasePublicClient(
  configuration: SupabasePublicConfiguration,
): SupabaseClient {
  if (
    cached?.url === configuration.url &&
    cached.publishableKey === configuration.publishableKey
  )
    return cached.client;
  // O SDK sem esquema gerado expõe o cliente com genéricos `any`; cada gateway valida as respostas.
  // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
  const client: SupabaseClient = createClient(
    configuration.url,
    configuration.publishableKey,
    {
      auth: {
        autoRefreshToken: true,
        detectSessionInUrl: false,
        persistSession: true,
        storageKey: 'caixinha-das-multas.auth',
      },
    },
  );
  cached = { ...configuration, client };
  return client;
}
