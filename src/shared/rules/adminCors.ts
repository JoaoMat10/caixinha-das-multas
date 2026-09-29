export const adminCorsBaseHeaders = {
  'Access-Control-Allow-Headers':
    'authorization, apikey, content-type, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
  Vary: 'Origin',
} as const;

export type AdminCorsResolution =
  | {
      status: 'allowed';
      headers: Record<string, string>;
    }
  | {
      status: 'forbidden' | 'unavailable';
      headers: typeof adminCorsBaseHeaders;
    };

function isSecureOrigin(value: string) {
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return false;
  }

  const isLoopback =
    url.hostname === 'localhost' ||
    url.hostname === '127.0.0.1' ||
    url.hostname === '[::1]';

  return (
    url.origin === value &&
    (url.protocol === 'https:' || (url.protocol === 'http:' && isLoopback))
  );
}

export function parseAdminAllowedOrigins(value: string | undefined) {
  if (!value) throw new Error('Allowlist CORS indisponível.');

  const origins = [...new Set(value.split(',').map((origin) => origin.trim()))];
  if (
    origins.length === 0 ||
    origins.some((origin) => !origin || !isSecureOrigin(origin))
  ) {
    throw new Error('Allowlist CORS inválida.');
  }

  return origins;
}

export function resolveAdminCors(
  requestOrigin: string | null,
  configuredOrigins: string | undefined,
): AdminCorsResolution {
  let allowedOrigins: string[];
  try {
    allowedOrigins = parseAdminAllowedOrigins(configuredOrigins);
  } catch {
    return { status: 'unavailable', headers: adminCorsBaseHeaders };
  }

  if (!requestOrigin || !allowedOrigins.includes(requestOrigin)) {
    return { status: 'forbidden', headers: adminCorsBaseHeaders };
  }

  return {
    status: 'allowed',
    headers: {
      ...adminCorsBaseHeaders,
      'Access-Control-Allow-Origin': requestOrigin,
    },
  };
}
