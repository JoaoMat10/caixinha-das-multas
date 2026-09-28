import path from 'node:path';
import { pathToFileURL } from 'node:url';

export const productionEnvironment = Object.freeze({
  VITE_APP_NAME: 'Caixinha das Multas',
  VITE_PUBLIC_APP_URL: 'https://caixinha-showcase.pages.dev',
  VITE_SUPABASE_URL: 'https://showcaseprodref00001.supabase.co',
});

export const requiredPublicVariables = Object.freeze([
  'VITE_APP_NAME',
  'VITE_PUBLIC_APP_URL',
  'VITE_SUPABASE_URL',
  'VITE_SUPABASE_PUBLISHABLE_KEY',
]);

const publishableKeyPattern = /^sb_publishable_[A-Za-z0-9_-]{20,}$/;

export function isCloudflareProductionBuild(environment) {
  return environment.CF_PAGES === '1' && environment.CF_PAGES_BRANCH === 'main';
}

export function validateCloudflareProductionEnvironment(environment) {
  if (!isCloudflareProductionBuild(environment)) {
    return { validated: false };
  }

  const errors = [];

  for (const variable of requiredPublicVariables) {
    if (
      typeof environment[variable] !== 'string' ||
      !environment[variable].trim()
    ) {
      errors.push(`${variable}: variável obrigatória ausente`);
    }
  }

  for (const [variable, expectedValue] of Object.entries(
    productionEnvironment,
  )) {
    const value = environment[variable];
    if (typeof value === 'string' && value.trim() && value !== expectedValue) {
      errors.push(`${variable}: valor de produção inválido`);
    }
  }

  const publishableKey = environment.VITE_SUPABASE_PUBLISHABLE_KEY;
  if (
    typeof publishableKey === 'string' &&
    publishableKey.trim() &&
    !publishableKeyPattern.test(publishableKey)
  ) {
    errors.push(
      'VITE_SUPABASE_PUBLISHABLE_KEY: formato de chave publicável inválido',
    );
  }

  if (errors.length > 0) {
    throw new Error(
      `Gate do build Cloudflare Production recusada:\n- ${errors.join('\n- ')}`,
    );
  }

  return { validated: true };
}

const invokedPath = process.argv[1]
  ? pathToFileURL(path.resolve(process.argv[1])).href
  : null;

if (invokedPath === import.meta.url) {
  try {
    const result = validateCloudflareProductionEnvironment(process.env);
    if (result.validated) {
      console.info(
        'Gate do build Cloudflare Production: quatro variáveis públicas validadas.',
      );
    }
  } catch (error) {
    console.error(
      error instanceof Error ? error.message : 'Gate de build recusada.',
    );
    process.exitCode = 1;
  }
}
