import { describe, expect, it } from 'vitest';

import {
  createSupabaseSecretKeyFetch,
  resolveSupabaseRuntimeKeys,
} from '@/shared/rules/supabaseRuntimeKeys';

const publishableKey = 'sb_publishable_publica';
const secretKey = 'sb_secret_servidor';

describe('chaves injetadas no runtime Supabase', () => {
  it('usa exclusivamente as chaves default com o formato esperado', () => {
    expect(
      resolveSupabaseRuntimeKeys(
        JSON.stringify({ default: publishableKey }),
        JSON.stringify({ default: secretKey }),
      ),
    ).toEqual({ publishableKey, secretKey });
  });

  it.each([
    [undefined, JSON.stringify({ default: secretKey })],
    [JSON.stringify({ default: publishableKey }), undefined],
    ['json-inválido', JSON.stringify({ default: secretKey })],
    [
      JSON.stringify({ default: 'anon-jwt' }),
      JSON.stringify({ default: secretKey }),
    ],
    [
      JSON.stringify({ default: publishableKey }),
      JSON.stringify({ default: 'service-role-jwt' }),
    ],
  ])(
    'falha fechada perante chaves ausentes ou legadas',
    (publicKeys, privateKeys) => {
      expect(resolveSupabaseRuntimeKeys(publicKeys, privateKeys)).toBeNull();
    },
  );

  it('envia a chave elevada apenas em apikey, nunca como JWT', async () => {
    let capturedInit: RequestInit | undefined;
    const implementation: typeof fetch = (_input, init) => {
      capturedInit = init;
      return Promise.resolve(new Response(null));
    };
    const secureFetch = createSupabaseSecretKeyFetch(secretKey, implementation);

    await secureFetch('https://example.test/rest/v1/users', {
      headers: {
        apikey: secretKey,
        Authorization: `Bearer ${secretKey}`,
      },
    });

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('apikey')).toBe(secretKey);
    expect(headers.has('Authorization')).toBe(false);
  });

  it('preserva um Authorization que contenha um JWT real', async () => {
    let capturedInit: RequestInit | undefined;
    const implementation: typeof fetch = (_input, init) => {
      capturedInit = init;
      return Promise.resolve(new Response(null));
    };
    const secureFetch = createSupabaseSecretKeyFetch(secretKey, implementation);

    await secureFetch('https://example.test/rest/v1/users', {
      headers: { Authorization: 'Bearer jwt-utilizador' },
    });

    const headers = new Headers(capturedInit?.headers);
    expect(headers.get('Authorization')).toBe('Bearer jwt-utilizador');
  });
});
