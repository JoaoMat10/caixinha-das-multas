import { describe, expect, it, vi } from 'vitest';

import {
  adminPhotoMaxBytes,
  adminPhotoQuality,
  constrainAdminPhotoSize,
  processAdminPhoto,
  type AdminPhotoDecoder,
} from '@/domains/admin/rules/photoProcessing';

describe('processamento de fotografias administrativas', () => {
  it('redimensiona sem aumentar imagens pequenas', () => {
    expect(constrainAdminPhotoSize(2400, 1200)).toEqual({
      width: 1024,
      height: 512,
    });
    expect(constrainAdminPhotoSize(320, 640)).toEqual({
      width: 320,
      height: 640,
    });
  });

  it.each([
    ['image/jpeg', adminPhotoQuality, 'foto.jpg'],
    ['image/png', undefined, 'foto.png'],
    ['image/webp', adminPhotoQuality, 'foto.webp'],
  ] as const)('recodifica %s antes do upload', async (type, quality, name) => {
    const encode = vi
      .fn()
      .mockResolvedValue(new Blob(['imagem-comprimida'], { type }));
    const close = vi.fn();
    const decode: AdminPhotoDecoder = vi.fn().mockResolvedValue({
      width: 2400,
      height: 1200,
      encode,
      close,
    });
    const original = new File(['original'], 'foto.original', { type });

    const processed = await processAdminPhoto(original, decode);

    expect(encode).toHaveBeenCalledWith({
      width: 1024,
      height: 512,
      type,
      quality,
    });
    expect(processed.name).toBe(name);
    expect(processed.type).toBe(type);
    expect(processed.size).toBeLessThan(original.size + 100);
    expect(close).toHaveBeenCalledOnce();
  });

  it('rejeita o resultado quando continua acima de 5 MiB', async () => {
    const close = vi.fn();
    const decode: AdminPhotoDecoder = vi.fn().mockResolvedValue({
      width: 1024,
      height: 1024,
      encode: vi.fn().mockResolvedValue(
        new Blob([new Uint8Array(adminPhotoMaxBytes + 1)], {
          type: 'image/png',
        }),
      ),
      close,
    });

    await expect(
      processAdminPhoto(
        new File(['x'], 'foto.png', { type: 'image/png' }),
        decode,
      ),
    ).rejects.toThrow('5 MiB');
    expect(close).toHaveBeenCalledOnce();
  });
});
