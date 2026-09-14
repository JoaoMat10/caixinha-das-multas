import { z } from 'zod';

const publicEnvironmentSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1).default('Caixinha das Multas'),
  VITE_PUBLIC_APP_URL: z.url().default('http://127.0.0.1:5173'),
  VITE_SUPABASE_URL: z.url().optional(),
  VITE_SUPABASE_PUBLISHABLE_KEY: z.string().trim().min(1).optional(),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

export function parsePublicEnvironment(
  environment: Record<string, unknown>,
): PublicEnvironment {
  return publicEnvironmentSchema.parse(environment);
}

export const appEnv = parsePublicEnvironment(import.meta.env);

export type SupabasePublicConfiguration = {
  url: string;
  publishableKey: string;
};

export function getSupabasePublicConfiguration(
  environment: PublicEnvironment,
): SupabasePublicConfiguration | null {
  if (
    !environment.VITE_SUPABASE_URL ||
    !environment.VITE_SUPABASE_PUBLISHABLE_KEY
  ) {
    return null;
  }

  return {
    url: environment.VITE_SUPABASE_URL,
    publishableKey: environment.VITE_SUPABASE_PUBLISHABLE_KEY,
  };
}
