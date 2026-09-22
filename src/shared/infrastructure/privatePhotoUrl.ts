import type { SupabaseClient } from '@supabase/supabase-js';

export async function createPrivatePhotoUrl(
  client: SupabaseClient,
  path: string | null,
) {
  if (!path) return null;
  const { data, error } = await client.storage
    .from('private-photos')
    .createSignedUrl(path, 3600);
  if (error) return null;
  return data.signedUrl;
}
