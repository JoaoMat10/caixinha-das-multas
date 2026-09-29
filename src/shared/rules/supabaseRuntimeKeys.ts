export type SupabaseRuntimeKeys = {
  publishableKey: string;
  secretKey: string;
};

function defaultKey(
  serializedKeys: string | undefined,
  expectedPrefix: string,
) {
  if (!serializedKeys) return null;

  try {
    const keys = JSON.parse(serializedKeys) as unknown;
    if (!keys || typeof keys !== 'object' || Array.isArray(keys)) return null;
    const value = (keys as Record<string, unknown>).default;
    return typeof value === 'string' && value.startsWith(expectedPrefix)
      ? value
      : null;
  } catch {
    return null;
  }
}

export function resolveSupabaseRuntimeKeys(
  publishableKeys: string | undefined,
  secretKeys: string | undefined,
): SupabaseRuntimeKeys | null {
  const publishableKey = defaultKey(publishableKeys, 'sb_publishable_');
  const secretKey = defaultKey(secretKeys, 'sb_secret_');

  return publishableKey && secretKey ? { publishableKey, secretKey } : null;
}

export function createSupabaseSecretKeyFetch(
  secretKey: string,
  fetchImplementation: typeof fetch = fetch,
): typeof fetch {
  return (input, init = {}) => {
    const headers = new Headers(init.headers);
    if (headers.get('Authorization') === `Bearer ${secretKey}`) {
      headers.delete('Authorization');
    }

    return fetchImplementation(input, { ...init, headers });
  };
}
