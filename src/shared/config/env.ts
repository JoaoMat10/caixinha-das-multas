import { z } from 'zod';

const publicEnvironmentSchema = z.object({
  VITE_APP_NAME: z.string().trim().min(1).default('Caixinha das Multas'),
  VITE_PUBLIC_APP_URL: z.url().default('http://127.0.0.1:5173'),
});

export type PublicEnvironment = z.infer<typeof publicEnvironmentSchema>;

export function parsePublicEnvironment(
  environment: Record<string, unknown>,
): PublicEnvironment {
  return publicEnvironmentSchema.parse(environment);
}

export const appEnv = parsePublicEnvironment(import.meta.env);
